# Core consent capability

`Breinify.UTL.consent` is a core utility object available as soon as the library loads, before
`Breinify.setConfig()`, `UTL._init()`, and customer `initCode.js` in the default generated order.
Private state and policy helpers live in `_private.consent`.

The manager evaluates registered features against mapped consent, customer overrides, and storage
requirements. It returns immutable decisions. Existing requests, user creation, cookies, storage, and
plugins are **not yet automatically connected to these decisions**. Script Creator supports opt-in settings
injection before customer initialization; CMP adapters remain separate integration work.

## Feature decisions

A registered feature is mandatory for every operation decision. A level, arbitrary string, missing
argument, or the old `evaluate(callback)` form cannot stand in for a feature.

```javascript
const consent = Breinify.UTL.consent;
consent.isGranted(consent.features.ACTIVITIES, function (decision) {
    // collect/use identifiers only if decision.userData.identifiers is true
    // collect/use configured account fields only if decision.userData.profile is true
    // use persistence only within decision.storage permissions
}, function (decision) {
    // optional: skip or report the unavailable operation without tracking it
});
```

Both callbacks receive the same decision shape:

```javascript
{
    feature: 'activities',
    granted: true,
    userData: {
        identifiers: true,
        profile: false
    },
    storage: {
        read: false,
        write: false
    }
}
```

The decision and its two permission objects are frozen. `UserDataPermissions` and `StoragePermissions`
are documentation names for these plain objects, not classes or additional consent levels.

| Field | Meaning |
| --- | --- |
| `feature` | The registered feature being evaluated. |
| `granted` | The feature meets its intrinsic consent requirements, configured requirements, and required storage permission. |
| `userData.identifiers` | May collect/use/send browser and session identifiers for this operation. |
| `userData.profile` | May collect/use/send configured account/profile fields needed by this operation. Identifier permission remains separate; temporal-data can use profile coordinates without identifiers. |
| `storage.read` | May read persistent data belonging to this feature's declared storage purpose. |
| `storage.write` | May persist data belonging to this feature's declared storage purpose. |

A denied decision has all data and storage permissions set to `false`. A grant does not authorize all
available fields or arbitrary storage keys. A stored identifier needs both the identifier permission
and storage read permission. Denied storage must not fall back to cookies. Permission to use a permitted
in-memory identifier does not make that identifier persist across navigation.

The current policy resolves read and write together, while exposing them separately for consumers.
These are permissions, not a browser availability probe: quota errors or blocked browser storage still
need handling by the feature. Evaluation itself does not read storage, create users, or send requests.

## Public methods

| Method | Contract |
| --- | --- |
| `configure(settings)` | Validates and installs the provider and policies, subscribes to updates, and starts an initial permission query. Does not wait for completion. |
| `evaluate(feature, callback)` | Calls `callback(decision)` once, whether granted or denied. May resolve synchronously; returns no value. |
| `isGranted(feature, onGranted[, onDenied])` | Evaluates the feature and invokes only `onGranted(decision)` or the optional `onDenied(decision)`. Returns no value. |
| `onChange(listener)` | Registers `listener(permissions)` for changes in normalized CMP permissions and returns an idempotent unsubscribe function. Does not replay the last notification. |

`onChange` reports permission changes, not a decision for every feature. Consumers evaluate their feature
for the next operation. This also applies when feature settings are replaced.

Missing/non-string features and invalid callbacks throw `TypeError`. Unknown feature strings, including
level names, throw `RangeError`. Validation happens before querying the provider. `onGranted` is required;
omit `onDenied` or pass `undefined` when denial needs no handling. A callback exception is logged and
isolated; it never invokes the other branch or creates a tracking activity.

No callback runs while the permission query is unresolved. On timeout, the manager evaluates the feature
against the Content-only baseline while still honoring overrides. Therefore, default recommendations
can proceed without user information, but temporal-data configured to require Analytics remains denied.
A later grant does not replay a completed operation. Before configuration, a check resolves immediately
using the baseline and default rules; configure before starting operations to enable the timeout wait.

## Levels and mapped permissions

The frozen `consent.levels` object defines requirement names, not ordered numeric ranks. Functional is
independent; Personalization requires Analytics. Use levels in configuration, and features in evaluations.

| Constant | Value | Requirement |
| --- | --- | --- |
| `levels.CONTENT` | `'content'` | Baseline; no optional permission. |
| `levels.FUNCTIONAL` | `'functional'` | Mapped `functional === true`. |
| `levels.ANALYTICS` | `'analytics'` | Mapped `analytics === true`. |
| `levels.PERSONALIZATION` | `'personalization'` | Mapped `personalization === true` and `analytics === true`. |

Providers report a plain object of boolean permissions. Missing and `false` mean no grant. An empty
object is the baseline. Content is not controlled by a provider flag; a `content: false` field does not
disable it. To disable a feature, use its `enabled` setting.

The provider's object is copied and frozen. `personalization: true` becomes `false` when Analytics is not
explicitly granted; neither Analytics nor Functional is inferred. Additional boolean permission keys
remain supported for observers, but feature requirements use the four registered level names.

## Registered features and storage dependencies

The frozen `consent.features` constants identify the reviewed operation purposes below. A new feature
needs a constant, a private definition describing its purpose/data/storage behavior, and corresponding
checks. Customer configuration can override registered features; it cannot register unknown operations.

| Feature constant / value | Default and intrinsic requirement | User data | Storage dependency / purpose |
| --- | --- | --- | --- |
| `RECOMMENDATIONS` / `recommendations` | Content | None without Personalization; configured identifiers/profile with Personalization. | None for the request itself. |
| `MODIFY_CONTENT` / `modifyContent` | Content | Same as recommendations. | None for Modify Content's content-decision service request. |
| `TEMPORAL_DATA` / `temporalData` | Content | Explicit query inputs or transient request-IP context; with Personalization, available profile latitude/longitude may also be used. No browser/session identifiers. | None. |
| `ACTIVITIES` / `activities` | Analytics | Identifiers with Analytics; configured account/profile fields additionally with Personalization. | None for immediate delivery. |
| `DELAYED_ACTIVITIES` / `delayedActivities` | Analytics | Same data permissions as immediate activities when granted. | Required Analytics storage for cross-page delivery. |
| `PRESENTATION_STORAGE` / `presentationStorage` | Functional | No identifiers/profile. | Required Functional storage for approved display preferences/state. |

`MODIFY_CONTENT` does not classify every possible service-gateway token as content. Other service purposes
need their own reviewed feature definition. A cache or side effect of a content response is not authorized
by the content request's grant. Persisting assignments, feature values, and other caches needs a separate
purpose review rather than treating all caches as one visitor-history store.

Each private definition declares separate `userData.identifiers` and `userData.profile` requirements.
For activities these are Analytics and Personalization respectively; `null` forbids that data category.
An Analytics grant alone therefore never permits account/profile fields.

Immediate activity decisions always return both storage flags as `false`. Reading or persisting browser/session
identifiers belongs to user creation's separate storage policy, which still needs to be wired. Permission to
include an identifier in a request does not authorize reading it from cookies or browser storage.

| Dependency | Without storage permission |
| --- | --- |
| None | Continue using permitted request inputs. |
| Required | Deny the dependent operation; memory is not an automatic replacement for cross-page persistence. |

The current countdown same-tab click handler queues a delayed activity. That delivery path needs
persistent storage, while following the link does not. Denying the delayed activity must not prevent
navigation. The `PRESENTATION_STORAGE` feature represents persistence itself, not rendering the component.

## Configuration and overrides

| Setting | Meaning |
| --- | --- |
| `timeoutInMs` | Maximum wait per query, default `2500`. Finite number from `0` to `2147483647`. Zero permits synchronous resolution, otherwise timeout occurs on the next timer turn. |
| `provider` | Provider object described below. An absent provider remains unresolved until timeout. |
| `features` | Optional map keyed by registered feature values. Each rule supports `requires` and `enabled`. |
| `features[feature].requires` | A level string or a nonempty array of levels, all of which must be granted. Defaults to the feature's requirement. |
| `features[feature].enabled` | Optional boolean, default `true`. `false` always denies the feature. |
| `storage.requires` | Optional level or nonempty array of levels required for all persistent reads/writes in addition to the feature's own storage purpose. Default Content adds no extra restriction. |

```javascript
const consent = Breinify.UTL.consent;
consent.configure({
    provider: provider,
    timeoutInMs: 2500,
    features: {
        [consent.features.TEMPORAL_DATA]: {
            requires: consent.levels.ANALYTICS
        },
        [consent.features.MODIFY_CONTENT]: {
            requires: [consent.levels.FUNCTIONAL, consent.levels.ANALYTICS]
        }
    },
    storage: {
        requires: consent.levels.PERSONALIZATION
    }
});
```

Overrides change availability, not the data purpose: requiring Analytics for temporal-data does not add
identifiers, grant profile access, or authorize storing its result. Its profile permission separately requires
Personalization and covers relevant fields such as available latitude/longitude, not the entire profile.
A rule cannot remove the intrinsic Analytics requirement of
activities or the Functional purpose of display-state storage. All requirements are combined, including
the Personalization dependency and global storage requirement. Functional remains independent.

With Analytics granted but the example's storage requirement unmet, immediate activities can receive
`granted: true` with identifier permission and both storage flags `false`; delayed activities are denied.
Functional alone cannot enable presentation persistence until the global storage requirement is also met.

Unknown features, unknown levels, empty/invalid requirement arrays, unsupported rule fields, and invalid
settings are rejected before replacing the active configuration. Settings and arrays are copied; mutating
the supplied object later does not change policy. A later `configure` call replaces the configuration,
restoring defaults for omitted overrides.

## Provider contract and lifecycle

| Provider method | Contract |
| --- | --- |
| `evaluate(callback)` | Required. Calls `callback(permissions)` with a complete snapshot. May query synchronously/asynchronously or consult a provider-maintained cache. Return values/promises are not consumed. |
| `onChange(listener)` | Optional. Supplies complete permission snapshots and returns an unsubscribe function. |

```javascript
const provider = {
    evaluate: function (callback) {
        // replace with the customer's mapped CMP state
        callback({functional: true, analytics: true, personalization: false});
    },
    onChange: function (listener) {
        // subscribe to mapped CMP updates
        return function () {};
    }
};
```

Concurrent feature evaluations share the pending permission query, but each receives its own feature
policy decision. Subsequent operations query again; caching/freshness belong to the provider. Unknown,
malformed, or throwing providers wait for an update or timeout. Errors are logged without tracking.

Observer updates resolve pending queries and supersede older responses. Identical effective permission
snapshots do not notify observers again. A late response after timeout can notify observers but never
replays completed operations. A response superseded by a newer query is ignored.

Reconfiguration detaches the previous provider, invalidates its responses, and completes pending feature
checks with denied decisions, including pending content requests. Previously known permissions are cleared
with a baseline notification when changed. Existing observer subscriptions remain registered. Configure
once during normal startup; do not reconfigure before each operation.

## User creation and integration boundaries

Evaluate the feature before collecting information, then pass that same decision through user creation
and storage access for the operation. `UTL.user.create(user)` currently returns synchronously; callback-based
request builders provide the place to wait for consent before calling it. The `BreinifyUser` constructor
must also respect the decision instead of adding disallowed context or automatic browser geolocation.

A decision is an operation snapshot, not a reusable grant for later calls. Delayed activity processing,
service polling, and subsequent operations must evaluate again. Browser geolocation and explicit user
actions such as unsubscribe require their own reviewed operation behavior; do not infer them from a
transport endpoint. In-memory caches also need to obey data permissions when the consumer paths are wired.

With `scriptSettings.consent.enabled: true`, Script Creator uses this order:

1. Load the core library, making `UTL.consent` available.
2. Inject the consent settings and configure consent.
3. Run development observers, customer `initCode.js`, entry points, and subsequent scripts.
4. Evaluate registered features at operation and data-access boundaries once those consumers are wired.

Injection precedes `initCode.js` and `setConfig()`, which can already trigger requests. Enabled integration
rejects custom library/prefix/suffix order and requires a compatible existing global library, if present.
Omitted, null, empty, or explicitly disabled creator settings add no setup code and preserve existing behavior.
The creator can resolve an existing provider through `providerPath`; CMP adapters remain separate work.

If normal library loading fails, the fallback exposes the same constants and feature-based methods.
Its `evaluate` calls the callback, when it is a function, with a fresh plain decision object containing
`granted: false` and all data/storage permissions false. It does not validate the feature or freeze the
decision; without a callback it simply returns.
The fallback `isGranted` only calls `onDenied()` when it is a function, without arguments or validation;
otherwise it returns without calling anything. It never calls `onGranted`. Configuration and observation
are inert in that fallback.
