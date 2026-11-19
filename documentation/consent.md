# Core consent capability

`Breinify.UTL.consent` is a core utility object available as soon as the library loads, before
`Breinify.setConfig()`, `UTL._init()`, and customer `initCode.js` in the default generated order.
Private state and policy helpers live in `_private.consent`.

The manager evaluates registered features against mapped consent, customer overrides, and storage
requirements. Core requests, user creation, storage, cookies, and the bundled consumer paths described
below enforce these decisions when consent is enabled. Omitted or disabled settings preserve legacy
behavior. Script Creator injects settings before customer initialization and loads the selected adapter;
Airgap, Osano, and OneTrust adapters are available in `src/consent/consent-integration-<provider>.js`.

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
need handling by the feature. Permission changes remove denied library-owned stored data and invalidate
relevant cached data; evaluation does not create users or send application requests.

## Public methods

| Method | Contract |
| --- | --- |
| `configure(settings)` | Validates and installs the provider and policies, subscribes to updates, and starts an initial permission query. Does not wait for completion. |
| `evaluate(feature, callback)` | Calls `callback(decision)` once, whether granted or denied. May resolve synchronously; returns no value. |
| `isGranted(feature, onGranted[, onDenied])` | Evaluates the feature and invokes only `onGranted(decision)` or the optional `onDenied(decision)`. Returns no value. |
| `isEnabled()` | Reports whether runtime enforcement is configured. |
| `evaluateOperation(feature, callback)` | Evaluates an enabled operation asynchronously; passes `null` when enforcement is disabled to preserve legacy behavior. |
| `getDecision(feature)` | Refreshes from a synchronous provider where possible and returns the current decision; unresolved permissions use the baseline. Returns `null` when enforcement is disabled. Async operations should use `evaluateOperation`. |
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
| `RECOMMENDATIONS` / `recommendations` | Content | Fresh request IDs without Analytics; browser/session identifiers with Analytics; account/profile fields additionally with Personalization. | None for the request itself. |
| `MODIFY_CONTENT` / `modifyContent` | Content | Same as recommendations. | None for Modify Content's content-decision service request. |
| `TEMPORAL_DATA` / `temporalData` | Content | Explicit query inputs or transient request-IP context; with Personalization, available profile latitude/longitude may also be used. No stable browser/session identifiers. | None. |
| `ACTIVITIES` / `activities` | Analytics | Identifiers with Analytics; configured account/profile fields additionally with Personalization. | None for immediate delivery. |
| `DELAYED_ACTIVITIES` / `delayedActivities` | Analytics | Same data permissions as immediate activities when granted. | Required `continuityStorage`, plus Analytics for the operation. |
| `CONTENT_STORAGE` / `contentStorage` | Content | No identifiers/profile; only declared non-user content. | Storage permitted without optional consent by default; global storage requirements and feature overrides still apply. |
| `CONTINUITY_STORAGE` / `continuityStorage` | Content | No independent identifier/profile grant; the owning operation controls its payload. | Required storage for temporary operations carried across navigation. Global and feature storage overrides apply. |
| `PRESENTATION_STORAGE` / `presentationStorage` | Functional | No identifiers/profile. | Required Functional storage for approved display preferences/state. |
| `CONTENT_TOKENS` / `contentTokens` | Content | Same as recommendations. | None for the request. |
| `PREFERENCE_MANAGEMENT` / `preferenceManagement` | Content | Explicit preference-management inputs are preserved without automatic user enrichment. | None. |
| `IDENTIFIER_STORAGE` / `identifierStorage` | Analytics | Browser/session IDs. | Required Analytics storage. |
| `PROFILE_STORAGE` / `profileStorage` | Personalization | Profile/referrer and unclassified stored data. | Required Personalization storage. |
| `SPLIT_TEST_STORAGE` / `splitTestStorage` | Analytics | Assignments and attribution metadata. | Required Analytics storage. |

`MODIFY_CONTENT` does not classify every possible service-gateway token as content. Other service purposes
need their own reviewed feature definition. A cache or side effect of a content response is not authorized
by the content request's grant. Persisting assignments, feature values, and other caches needs a separate
purpose review rather than treating all caches as one visitor-history store.

Each definition declares separate `userData.identifiers` and `userData.profile` requirements.
For recommendations, Modify Content, content tokens, and activities these are Analytics and Personalization
respectively; `null` forbids that data category. Temporal data does not use stable identifiers.
An Analytics grant alone therefore never permits account/profile fields.

### Definition source

Generated scripts receive their complete `definitions` from Script Creator, which supplies the same policy to
portal metadata. `consent.configure({definitions: ..., provider: ..., features: ..., storage: ..., data: ...})`
uses that policy as the baseline and applies the customer overrides separately. An injected definition has
`type` (`operation` or `storage`), `requires` (one level), `userData` (`identifiers` and `profile`, each a level or
null), and `dependencies` (storage `feature`, boolean `required`, and a `requires` array). Optional dependencies
describe storage access; required dependencies also gate operation availability.

The library's `consent.definitionVersion` is `1`. Generated scripts check support before initialization.
Incomplete policies, unknown features/levels, invalid categories, and recursive dependencies are rejected before
changing the active configuration. Accepted definitions are copied, and supplied policies are never merged with
the bundled defaults. Omitting `definitions` on a subsequent configure call restores the standalone defaults.
The defaults in the table above describe that standalone fallback and the current backend policy.

`consent.inspect()` exposes the active `definitions` and `definitionSource` (`injected` or `standalone`). These
are separate from customer `settings`, so editing overrides does not accidentally persist a snapshot of defaults.

Immediate activity decisions always return both storage flags as `false`. Reading or persisting browser/session
identifiers belongs to user creation's separate `identifierStorage` policy. Permission to
include an identifier in a request does not authorize reading it from cookies or browser storage.

| Dependency | Without storage permission |
| --- | --- |
| None | Continue using permitted request inputs. |
| Required | Deny the dependent operation; memory is not an automatic replacement for cross-page persistence. |

`CONTENT_STORAGE` covers shared product/content caches, including keys under `breinify-content-` and
explicitly registered content keys. It remains available with optional consent denied or unknown unless
an override requires more consent. It does not grant permission to persist user information. Requiring
Personalization for all storage also restricts content caches. See the [storage inventory](storage.md).

Delayed activities require both their own operation permission and `continuityStorage`. Disabling or restricting
Continuity Storage blocks queue reads/writes and delayed delivery without changing immediate activities. Its Content
default adds no optional permission beyond the owning operation, which still intrinsically requires Analytics.

The current countdown same-tab click handler queues a delayed activity. That delivery path needs
persistent storage, while following the link does not. Denying the delayed activity must not prevent
navigation. The `PRESENTATION_STORAGE` feature represents persistence itself, not rendering the component.

## Configuration and overrides

| Setting | Meaning |
| --- | --- |
| `enabled` | Core configuration is enabled unless explicitly `false`; Script Creator requires `enabled: true` to inject configuration. |
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

## Runtime enforcement and integration boundaries

Request builders wait for feature evaluation before invoking user creation. If the feature is denied,
no request is sent. With Content-only permissions, recommendations, Modify Content/discovery, temporal
content and content tokens continue. User profile fields and existing browser/session IDs are removed;
when an ID is included it is a fresh UUID for that request, never retained as a replacement visitor ID.
Activity requests require Analytics. Personalization enables profile enrichment, including configured
user hooks. Browser geolocation also checks permission before collection and after asynchronous work.

`UTL.user.create(user)` remains synchronous and uses the current activity data permissions by default.
Request builders pass their own feature decision. Synchronous storage/user access cannot wait for an
unresolved provider, so it denies optional permissions until a usable snapshot is available. Delayed
activity storage, stored identifiers, and display state have separate requirements. See [storage](storage.md).

The final request gateway rechecks permissions and sanitizes user data, including nested service payload
user overrides. Service polling stops if its original identifier/profile permissions are withdrawn.
Anonymous service jobs can continue. Token payloads strip recognized identity fields recursively;
arbitrary customer-defined fields, opaque strings, and custom integration callbacks still need review.
Content payloads must not disguise personal data under unrelated names.

Bundled Activities, mapped Assets, SplitTests, FeatureStorage, and UiModifyContent consumer paths use the
consent/storage layer. Revocation clears stored identifiers and relevant restored/cache state. Explicit
OptStatus preference requests retain the visitor's supplied target (for example, an email to unsubscribe)
without enriching a user; the Unsubscribe endpoint likewise serves explicit preference requests. Shopify
cart access and development tooling are separate functional tools, not analytics transports. The explicitly activated
developer flags `breinify` and `previewIds` are outside consent enforcement, including global storage restrictions.

Core API requests preserve the configured `withCredentials` value (default `false`), whether consent is
enabled or disabled. Credentials may support essential endpoint behavior, so consent does not override
this transport setting. Content-only payload filtering does not guarantee that a credentialed request
carries no identifying cookies. Endpoint cookies and browser-supplied IP/headers are separate from the
user payload and UTL storage policy. Customer integrations making their own network/storage calls need
their own review.

With `scriptSettings.consent.enabled: true`, Script Creator uses this order:

1. Load the core library, making `UTL.consent` available.
2. Load the configured CMP adapter, then inject settings and configure consent.
3. Run development observers, customer `initCode.js`, entry points, and subsequent scripts.
4. Evaluate consent at operation and data-access boundaries.

Injection precedes `initCode.js` and `setConfig()`, which can already trigger requests. Enabled integration
rejects custom library/prefix/suffix order and requires a compatible existing global library, if present.
Omitted, null, empty, or explicitly disabled creator settings add no setup code and preserve legacy behavior.
The creator resolves provider names through `ConsentProvider`; adapters register in `consent.integrations`.
Airgap maps Functional, Analytics, and Advertising to the corresponding library permissions. `Auto` grants
its mapped purpose; an all-false `purposes` object is known Content-only consent even when unconfirmed.
The CMP must permit the library script to load for these internal checks to run.

If normal library loading fails, the fallback exposes the same constants and feature-based methods.
Its `evaluate` calls the callback, when it is a function, with a fresh plain decision object containing
`granted: false` and all data/storage permissions false. It does not validate the feature or freeze the
decision; without a callback it simply returns.
The fallback `isGranted` only calls `onDenied()` when it is a function, without arguments or validation;
otherwise it returns without calling anything. It never calls `onGranted`. Configuration and observation
are inert in that fallback.


## CMP adapters

Set `scriptSettings.consent` to enable a provider, for example:

```json
{
  "enabled": true,
  "provider": "osano",
  "timeoutInMs": 2500
}
```

Provider names are `airgap`, `osano`, and `onetrust` (case-insensitive in Script Creator).
The creator includes only the selected adapter before configuring consent. Loading an adapter alone
registers its factory without reading the CMP or enabling consent.

| Library permission | Airgap purpose | Osano category | OneTrust group |
| --- | --- | --- | --- |
| Functional | `Functional` | `PERSONALIZATION` | `C0003` |
| Analytics | `Analytics` | `ANALYTICS` | `C0002` |
| Personalization | `Advertising` + Analytics | `PERSONALIZATION` + Analytics | `C0003` + Analytics |

The core enforces the Analytics prerequisite for Personalization. Functional remains independent.
Content is the baseline and needs no optional CMP category. Known denial permits content operations
with the feature's restricted user-data permissions; unknown consent waits for the configured timeout.

Customers can replace a permission's mapping with a list of CMP purpose/category/group names. Every
entry in that list must be granted. Unspecified mappings retain the defaults. For example, this OneTrust
configuration additionally requires the customer's advertising group for Personalization:

```json
{
  "enabled": true,
  "provider": "onetrust",
  "mappings": {
    "personalization": ["C0003", "C0004"]
  }
}
```

Group IDs and their purposes must match the customer's CMP configuration. These mappings change level
grants; feature and storage overrides still apply independently.

### Osano

The adapter reads `window.Osano.cm.getConsent()` for each evaluation and accepts only category values
of `ACCEPT`. Missing categories and other values do not grant permission. An unavailable result remains
unresolved. It uses Osano's documented preload queue and `onInitialized` hook when the CMP is not loaded,
preserving existing queue entries and options. Once available, it observes `osano-cm-initialized` and
`osano-cm-consent-saved`. The unsaved `osano-cm-consent-changed` toggle event does not itself grant consent.
`cm.ready()` registers external APIs with Osano and is not used as a readiness callback.

See the [Osano JavaScript API](https://developers.osano.com/cmp/javascript-api/developer-documentation-consent-javascript-api).

### OneTrust

The adapter reads the comma-separated `window.OnetrustActiveGroups` value on every evaluation and matches
whole group IDs. Missing/non-string data remains unresolved; an empty string or only `C0001` grants no
optional permissions. It subscribes to the window events `OneTrustGroupsUpdated` and `OTConsentApplied`
before the SDK loads, then rereads the active groups. It does not replace `OptanonWrapper` or create a
OneTrust stub. See the [OneTrust events guide](https://developer.onetrust.com/onetrust/docs/javascript-events-guide)
and [active groups documentation](https://docs.onetrust.com/en/consent--preferences/cookie-consent/managing-cookie-scripts-cookie-blocking-and-technical-implementation/onetrustactivegroups---using-the-data-layer-object).

Both adapters remove their observers when unsubscribed. Late CMP availability can update future
operations after a timeout; it does not replay an operation already completed with restricted permissions.
Neither adapter requests consent, changes CMP choices, reads CMP cookies directly, nor stores consent itself.


### Shared adapter utilities

`Breinify.UTL.consent.utils` supplies `mappings(settings, defaults)` and `createObserver(onEmpty)`.
Mappings are validated and copied. Each observer owns its listeners and latest pending core query;
`subscribe(callback)` returns an idempotent unsubscribe function, `wait(callback)` replaces that query,
and `publish(snapshot)` delivers independent copies of the flat permission snapshot. A null snapshot
leaves the query pending. Delivery isolates callback errors through the core consent callback handler.

Adapters retain their CMP reads, readiness hooks, event registration, and cleanup. They use
`hasListeners()` and `isIdle()` to decide whether observation is needed. Callbacks may start another
pending evaluation during publication, so cleanup checks `isIdle()` after delivery. Removing the last
listener clears the pending query and calls `onEmpty`. The fallback utility exposes inert helpers.
Updated adapters require the core version that supplies these utilities.


## Dev Studio Consent tab

When consent is enabled and the core supports inspection, Dev Studio shows a Consent tab. It displays
the provider, effective mappings and configuration, waiting/known/timeout state, effective consent levels,
and every registered feature's availability, identifier/profile permissions, and storage read/write
permissions. Feature requirements and required storage are shown alongside each decision.

The tab reads `Breinify.UTL.consent.inspect()` without querying the CMP, evaluating operations, collecting
users, or reading stored values. It refreshes once per second while visible. Its conservative permissions
while waiting describe the current snapshot; operations still wait for consent or their timeout. The tab
hides when consent is disabled and cleans up its refresh timer when Dev Studio is removed.

Built-in adapters expose `getSettings()` with copied provider names and mappings for inspection. Custom
providers may implement the same optional method; otherwise the tab identifies them as custom.


### Storage dependencies in inspection

`inspect().features` reports `storageDependencies` instead of the internal `storage` dependency flag.
Each entry names a storage feature and includes `required`, `read`, and `write`. The diagnostic `decision`
contains the operation's grant and user-data permissions; it omits the internal `decision.storage` flags.
`evaluate()` and `getDecision()` retain their existing enforcement shape and behavior.

For example, with Analytics and Personalization granted, an activity includes:

```javascript
storageDependencies: [
    {feature: 'identifierStorage', required: false, read: true, write: true},
    {feature: 'profileStorage', required: false, read: true, write: true},
    {feature: 'splitTestStorage', required: false, read: true, write: true}
]
```

Optional dependencies can be denied while the operation remains allowed. Delayed activities additionally
require `continuityStorage`; denying this dependency denies delayed delivery. Storage-purpose features
show their own required storage permission. Dependencies combine the operation's applicable user-data
permission with the storage purpose's decision, including feature overrides and global storage requirements.
Recommendation responses may persist split assignments independently of profile enrichment.

These entries describe permitted storage paths in the library, not a record of actual reads/writes or a
promise that a value exists. Configuration, available data, and the caller determine whether a path runs.
An empty list means no declared dependency, as with the core content-token transport and explicit preference
management. Custom callers and plugins can have additional storage needs. When enforcement is disabled,
dependency read/write values are `null`, indicating no active consent decision.
Dev Studio displays each dependency by name with its optional/required status and read/write permissions.

The Dev Studio Consent tab lists levels with green checks for granted permissions and red crosses for denied permissions.
Separate Feature permissions and Storage permissions tables use the same indicators. Feature rows retain their named
optional or required storage dependencies, while storage rows show read and write permissions for each storage purpose.


## Field-specific data permissions

`data` maps stable rule IDs (for example UUIDs) to an exact `path` relative to the request's `user` object
and optional `requires` levels. IDs are configuration keys; dotted paths are values.

```json
{
  "enabled": true,
  "data": {
    "d585b156-8117-46c3-a26a-0d13aeb54331": {
      "path": "additional.location.goPuffStoreId"
    },
    "9ea22c83-ceba-4baa-bae7-7fe6e49c6c12": {
      "path": "additional.location.lat",
      "requires": ["analytics"]
    }
  }
}
```

Omitted, `null`, or empty `requires` means always permitted. Otherwise all listed Breinify levels must be
satisfied, including the existing Analytics prerequisite of Personalization. A rule overrides the usual
user-data permission for that exact field: it can permit website context without profile consent or
restrict a field even with profile consent. Unlisted fields retain their normal permissions. These rules
never grant feature availability or storage access. Generic `user.create()` can collect permitted fields
for readiness checks even if its default Activities feature is denied; an activity still cannot be sent.

Duplicate paths and ancestor/descendant overlaps are rejected, regardless of rule order. For example,
`additional.location` conflicts with `additional.location.lat`, while `additional.location.lat` and
`additional.location.longitude` do not conflict. Wildcards, empty path segments and prototype-related
segments are rejected. Validation completes before replacing the active configuration.

Decisions expose `userData.allowedFields` and `userData.deniedFields`. When profile consent is denied and
no explicit field is allowed, `user.create()` skips customer lookup and profile enrichment. When at least
one field is allowed, existing customer lookup `get(userDataPermissions)` and configured
`createUser(userDataPermissions)` callbacks run, and the library copies only permitted fields from their
results. No new customer callback or field-specific handling is required for filtering. Explicitly supplied
user objects are filtered too. Disabled consent preserves the original argument-free callbacks.

Customer code may call `Breinify.UTL.consent.isFieldAllowed(path, userDataPermissions)` before reading a
value or making an auxiliary request. This optional check avoids unnecessary work, but is not relied upon
for request enforcement. Null permissions mean consent is disabled; omitted/invalid permissions fail closed.
The library cannot undo reads or other side effects performed inside an arbitrary existing customer callback.
The final user filter independently enforces the rules again, including nested `user` payloads, whether or not
customer code checked first. Explicit allowances copy scalar leaves (string, finite number, boolean or null),
not objects or getters. The supported plural attributes (`sessionIds`, `userIds`, `emails`) also accept
string arrays, copied independently; other arrays are not implicitly allowed. Allowing a parent path never
implicitly allows its children. Denied paths
remove the named field or subtree.

BevMo's lookup reads the current website store ID rather than customer addresses or coordinates.
It does not fetch cart tokens or collect profile fields for the store rule. The current store is read on every
user creation, so subsequent store changes are reflected without retaining an old store ID.

`inspect()` includes normalized rules in `settings.data` and field decisions in each feature's `userData`.
Dev Studio displays a Data permissions table with the paths, required levels and current decisions.


### Singular and plural user fields

The library treats `sessionId`/`sessionIds`, `userId`/`userIds`, and `email`/`emails` as permission aliases.
With no explicit rule, both session forms use identifier permission and both user/email forms use profile
permission. A configured rule for either form applies to both in `isFieldAllowed`, user creation and final
user filtering. Values remain separate; the rule does not merge, convert or synthesize plural values.

Conflict validation normalizes these root attributes: `email` and `emails` cannot have separate rules, and
`emails.value` conflicts with `email`. Nested custom fields such as `additional.email` and
`additional.emails` are not aliased. There is no automatic pluralization of arbitrary field names.
Decisions include both aliases in `allowedFields` or `deniedFields` so diagnostics expose their effective scope.
