# Browser storage

`Breinify.UTL.storage` provides shared access to local storage, session storage, and explicit in-memory
storage. Core code and bundled plugins use this object for browser storage access. Cookies use
`Breinify.UTL.storage.cookie`, which is the same object as the existing `Breinify.UTL.cookie`.

This foundation preserves existing keys, serialized formats, and caller-specific fallbacks when consent
is disabled. When enabled, reads, writes, enumeration, and previously obtained storage handles enforce
consent. Customer integration code outside this library needs a separate review.

## Direct access

These methods work immediately after the core library loads; they do not require `storage.init()`.
The type is explicitly `'local'`, `'session'`, or `'memory'`. Memory lasts for the current library instance.

| Method | Behavior |
| --- | --- |
| `getItem(type, key)` | Reads a string, or returns `null` when absent. |
| `setItem(type, key, value)` | Writes a string, using the storage backend's string conversion. |
| `removeItem(type, key)` | Removes one entry. Missing entries are harmless. |
| `getJson(type, key[, fallback])` | Parses JSON. Missing entries return the explicit fallback, or `null`. Read and parse errors throw unless a fallback argument is supplied. |
| `setJson(type, key, value)` | Serializes and writes JSON. Serialization and write errors throw. A value that cannot produce a JSON string, such as `undefined`, is rejected before writing. |
| `keys(type)` | Returns a snapshot array of keys. Ordering follows the backend and is not guaranteed. |
| `entries(type[, options[, filter]])` | Returns a snapshot array of `[key, value]` pairs. Options support `prefix`, `json`, and `fallback`. An optional `filter(key)` selects keys before reading values. |
| `isAvailable(type)` | Checks read/write access using a temporary key and removes it. Returns `false` on failure. This is an explicit probe, not a guarantee that later operations will succeed. |
| `getStorage(type)` | Returns a Storage-like handle with `length`, `key`, `getItem`, `setItem`, `removeItem`, `clear`, `getJson`, and `setJson`. Operations resolve storage again instead of retaining a native browser storage object. |

Raw access propagates browser errors, including blocked storage and quota failures, allowing the caller
to apply its own fallback. It never silently switches from local/session storage to memory or cookies.
`getJson` with an explicit fallback is the exception for read/parse failures. Valid JSON values including
`null`, `false`, `0`, and `""` are returned unchanged; the fallback is not schema validation.

```javascript
const storage = Breinify.UTL.storage;
const settings = storage.getJson('session', 'my-settings', {});
storage.setJson('session', 'my-settings', settings);

// omit the fallback when malformed JSON or inaccessible storage should throw
const requiredData = storage.getJson('local', 'my-data');
```

### Iterating entries

`entries` filters keys by `options.prefix` before reading their values. Values are raw strings by default.
Set `json: true` to decode them. An explicitly supplied `fallback` handles missing values or individual
JSON read/parse errors, including when the fallback is `undefined`. Enumeration failures still throw.
The prefix remains part of each returned key; it is not removed automatically.

An optional third argument, `filter(key)`, runs after the prefix check and before any values are read.
Return a truthy value to include the key. Rejected values are never read, parsed, or returned. Keys still
need to be enumerated because browser storage has no query API. Filter exceptions propagate, even when
a JSON fallback is provided. A filter that needs the stored value must instead run after reading it.

```javascript
const entries = Breinify.UTL.storage.entries('local', {
    prefix: 'breinify-sa-data-',
    json: true,
    fallback: null
});

for (const [key, value] of entries) {
    if (value === null) {
        continue;
    }
    // use the stored value or remove this known entry
}
```

For a custom key selection:

```javascript
const entries = Breinify.UTL.storage.entries('local', {
    prefix: 'breinify-sa-data-',
    json: true,
    fallback: null
}, function (key) {
    return selectedKeys.has(key);
});
```

Pass `undefined` as the second argument to use a key filter with the default options.

The returned array can be iterated while removing entries without skipping later keys. It is a snapshot
assembled synchronously, not a transaction across tabs. Prefer these methods over manually indexing a
storage handle. A handle's `clear()` clears the entire selected backend, including unrelated origin data;
use known keys or a specific prefix for library cleanup.

### Existing named cache and cookies

The existing `init`, `load`, `update`, `get`, `isExpired`, `getOrWait`, and `createStorableData` cache methods
remain available. They use `breinify-<name>` entries containing `{expires, created, data}`. Initialize that
cache before using it. It selects memory when local storage cannot be obtained at initialization; later
access errors can still throw. `get` does not enforce expiry; callers must use `isExpired` when needed.
Expiry durations passed to `update` are seconds. Nonpositive durations produce `expires: -1`, which
`isExpired` considers expired. See the [API reference](api.md#storage-utilities).

Cookie methods retain their existing signatures, encoding, domain/path handling, and expiry in days.
Cookie JSON uses its existing encoded representation, not the plain JSON format used by `storage.setJson`.
Both cookie namespaces refer to the same object, so existing callers continue to work. See
[cookie utilities](api.md#breinifyutlcookie).

Identifier storage selects its existing browser-storage or cookie fallback on first identifier access.
It uses browser storage only when both local and session storage pass the availability probe; otherwise
it uses cookies. Loading the core library alone does not run those probes. Identifier values and plugin
data also have consumer-side permission checks and cache invalidation. Denied persistence never enables
a cookie or memory fallback to bypass the same purpose requirement.

## Consent states and requirements

The inventory below describes the current source implementation, including its conservative defaults.
A listed entry is written only when its owning feature runs; enabling a permission does not create all
entries. The rules apply to reads as well as writes through UTL, including handles obtained before consent
was configured. [Consent configuration](consent.md#configuration-and-overrides) can tighten these defaults.

| Consent state | Library storage behavior |
| --- | --- |
| No consent settings, or enforcement explicitly disabled | Legacy behavior: entries may be read/written when their features run, subject to configuration and browser availability. No CMP grant is required by the library. |
| Enabled, provider not ready or not yet returning valid permissions | Synchronous storage access denies optional reads/writes immediately. Declared `contentStorage` remains available unless an override requires missing consent. Writes are not queued for later. Async request operations can still wait for consent. |
| Enabled, consent query times out | Content-only evaluation. Declared `contentStorage` is available under its default policy; storage requiring optional consent remains denied. A later grant permits subsequent access; denied writes are not replayed. |
| Enabled, valid consent with all optional purposes false | Content-only policy: declared content storage is available by default; optional storage is denied. Airgap's all-false purposes with `confirmed: false` is a known snapshot. |
| Enabled, relevant permissions granted | The corresponding purpose is available, subject to feature overrides and `storage.requires`. Personalization requires Analytics; Functional is independent. |
| Enabled, permissions revoked | Further denied reads return `null`, writes do nothing, and enumeration omits denied keys. Publication of the changed snapshot also cleans known denied data as described below. |

These purpose labels are used in every inventory table:

| Storage purpose / feature | Default required consent | What it covers |
| --- | --- | --- |
| `contentStorage` | Content (no optional grant) | Explicitly declared non-user product/content caches; no identifier or profile permission. |
| `identifierStorage` | Analytics | Generated browser/session identifiers and identifier availability probes. |
| `delayedActivities` | Analytics | Persisted activities awaiting delivery; storage is required for this feature. |
| `splitTestStorage` | Analytics | Stored assignments and attribution data. |
| `presentationStorage` | Functional | Display windows, decision/random/suppression persistence, and DevStudio UI state. |
| `profileStorage` | Personalization **and Analytics** | Referrer state and the current fallback for any unclassified key, including feature values, generic caches, and certain developer keys. This does not imply every such value is a profile. |

`storage.requires` adds a requirement to every purpose. For example, `storage.requires: 'personalization'`
means identifiers need Analytics + Personalization, while presentation storage needs Functional + Analytics
+ Personalization. A feature-specific `enabled: false` denies its storage regardless of granted levels.
Keys prefixed with `breinify-content-`, and keys explicitly registered as `contentStorage`, use Content-only
storage by default. A global Personalization requirement also blocks these content caches until Analytics
+ Personalization is granted. Content storage is a data-purpose declaration, not an exemption from overrides.

The classifier uses the key, not the backend: moving a key from local storage to a cookie or explicit
memory storage does not change its requirement. `storage.register(key, feature)` can classify a custom key;
SplitTests registers its configured storage keys as `splitTestStorage`. Keys without a recognized prefix or
explicit registration default to `profileStorage`. `storage.isAllowed(key[, 'read'|'write'])` queries the current key policy.

### Declaring non-user content storage

Use this purpose only for data such as a product catalog or shared sale information. Do not store visitor
IDs, account data, behavioral history, visitor-specific assignments, or personalized responses under it.
The storage manager does not inspect JSON contents to establish whether a declaration is accurate.

```javascript
const storage = Breinify.UTL.storage;
const key = 'breinify-content-products';
const cached = storage.getJson('local', key, null);
storage.setJson('local', key, {timestamp: Date.now(), items: products});
```

The prefix is recognized by the core before customer modules initialize, so an initial Content-only
snapshot preserves an existing cache. For a custom key:

```javascript
storage.register('public-product-catalog', Breinify.UTL.consent.features.CONTENT_STORAGE);
```

Register custom keys before using them. If the key also matches a library cleanup prefix, register before
consent initialization to avoid early cleanup using its previous/default classification; otherwise use
the `breinify-content-` prefix. Registration does not recover already-deleted data. The same purpose works
with local, session, and explicit memory storage, and applies to matching cookie names as well.

## Time and browser scope

**Lifetime** below means the configured expiry or freshness check, not a guarantee of physical deletion
at that instant. Local/session storage has no built-in TTL; stale entries can remain until the library
reads, replaces, or cleans them. Cookie durations are the expiry requested by the library. The browser
or visitor can clear data sooner.

| Backend | Browser scope | Lifetime boundary |
| --- | --- | --- |
| Local storage | Current page's origin (scheme, host, port), shared across same-origin tabs/windows and paths. No sharing with a different subdomain/origin merely because the script URL is the same. | Survives navigation and browser sessions until deletion; library expiry checks are listed per key. |
| Session storage | Current page's origin and top-level tab/window session; survives same-tab reload/navigation. A newly opened tab can initially copy its opener's session storage, then has separate state. | Tab/session lifetime; browser session restoration may restore it. Per-entry library expiry may be shorter. |
| Cookies | Domain and path passed to the helper. Built-in cookies use `UTL.cookie.domain()` and `Path=/`; they can be shared across matching subdomains and tabs. | Persistent cookies request an expiry; cookies without one are session cookies, not tab-only storage. Session restoration may retain them. |
| Explicit memory storage / plugin caches | Current loaded library/plugin instance. | Until cleared or the instance is destroyed; no cross-navigation persistence guarantee. |

Storage belongs to the page where JavaScript executes, not the host from which the library was downloaded.
The tables also identify logical scope (for example, a web-experience version). A key is not automatically
namespaced by API key or customer: only fields explicitly included in that key or its envelope separate data.

## Local-storage inventory

All rows use the origin scope above. Each purpose in the consent column resolves through the requirements
above; with enforcement disabled, the same writes follow legacy behavior.

| Key | Owner and stored data | When written / renewed | Consent purpose | Lifetime / logical scope |
| --- | --- | --- | --- | --- |
| `breinify-content-<name>` | Caller-declared non-user product/content cache. | When the owning content feature writes through UTL. | `contentStorage` | Caller-defined format, expiry and renewal; the prefix adds no automatic TTL. Logical scope is the supplied name. |
| `x-breinify-bid` | Core user: browser ID in `{v, exp}`. | First permitted browser-ID lookup when no valid ID exists. | `identifierStorage` | 3,650 days from creation, checked on read. Shared browser identity for this origin; reads do not renew it. Cookie fallback below. |
| `breinify-split-test-data` | Core named cache: assignments and attribution metadata in `{expires, created, data}`. | Updating/replacing split-test data, including recommendation and Modify Content result metadata. | `splitTestStorage` | Envelope duration is `30 * 24 * 60` seconds: **12 hours**, not 30 days. Assignment reads separately prune entries older than 24 hours and expired preview `expiresAt` values. Named-cache `get` does not itself enforce envelope expiry. Entries keyed by test name. |
| `breinify-gp-data` | Core: hashes of already-handled tracking parameters for deduplication. | Handling a newly recognized tracking-parameter activity. | `profileStorage` (fallback classification) | 60-second envelope metadata; `get` does not itself enforce expiry. Shared named cache for the origin. |
| `breinify-<name>` | Public named cache: caller-supplied data in `{expires, created, data}`. | `storage.load`, `init` loaders/values, or `update`. | `profileStorage` unless explicitly classified or matching a known key | Caller-supplied duration in **seconds**; callers must enforce expiry. Scope is the supplied name. Existing memory fallback applies if local storage cannot be obtained at cache initialization. |
| `breinify-sa-data-<id>` | Activities: `{user, tags, type, maxAgeInMs, filter, timestamp}`; tags can contain page URL/title. | Scheduling or replacing a delayed activity. | `delayedActivities` | Until sent/removed; positive `maxAgeInMs` is checked when processing, not by a timer deleting the entry. Scope is the supplied/generated activity ID. Cookie fallback below. |
| Configured `storageKey.live` / `storageKey.test` | SplitTests: assignment response plus `lastUpdated` and `isControl`. | A split-test result is received and a storage key was configured. | `splitTestStorage` (registered by the plugin) | Default freshness **1 hour**, configurable via `timing.expirationAfterMs`. Stale data may remain until replaced. Scope is the configured key/environment; omitting keys avoids persistence. |
| `br-ctd-<splitTestName>` | UiCountdown through SplitTests: assignment response. | Countdown split-test resolution. | `splitTestStorage` | Same default one-hour freshness as SplitTests. Scope is the split-test name. |
| `br-wed-<webExVersionId>` | UiCountdown: `{time, ttl, renew, response}` campaign/display state. | Receiving campaign settings for time-limited or active-browsing visibility. | `presentationStorage` | Time-limited: configured `displayWindowValue` in **seconds**. Default active-browsing window: **30 minutes**. Current writes set `renew: false`; only existing `renew: true` entries renew on read. Expired entries are removed on read. Scope is the web-experience version. |
| `breinify::featureStorage::feature::<name>` | FeatureStorage: `{value, meta, definition, persistedAt, expiresAt}`. | Feature changes and persistence touches, including permitted reads/restoration. | `profileStorage` (fallback classification) | Default TTL **24 hours**, configurable per definition with `ttlInMs`; touches can extend it. Persistence defaults to enabled. Expiry checked during restoration and cleanup; normal permitted reads can touch/extend existing persistence. Scope is the normalized feature name. |
| `breinify::featureStorage::cleanupAt` | FeatureStorage: numeric last-cleanup timestamp. | Completing persistence cleanup. | `profileStorage` (fallback classification) | No per-entry TTL; controls a **6-hour minimum interval** between eligible cleanup passes. It does not schedule browser deletion every six hours. Scope is the feature-storage collection. |
| `br::wemc::decision` | UiModifyContent: version 2 `{version, entries}`; condition outcomes, bindings, scope and expiry metadata. | Updating persistent condition decisions or pruning expired entries. | `presentationStorage` | Each persistent entry needs a positive `maxAgeSeconds` and an unexpired timestamp to be reused. Scope includes experience ID, version, configuration, condition reference, and iteration values where applicable. Default page-scoped decisions are not persisted. |
| `br::wemc::suppression` | UiModifyContent: version 1 envelope of cooldown expiry timestamps. | Experience execution or an action extends suppression. | `presentationStorage` | Configured cooldown in **seconds**; expired entries are ignored and pruned from subsequent writes. Scope is **API key + web-experience ID**. Existing page-memory cooldown behavior can remain when persistence is unavailable/denied. |
| `br-storage-test-<time>-<random>` | Storage availability probe containing its own key. | Explicit `storage.isAvailable('local')`, also used when selecting identifier storage. | `identifierStorage` | Written/read/removed during the same probe. Removal is attempted even on failure. Unique temporary key, no lasting application state intended. |

## Session-storage inventory

All rows use origin + tab/session scope. The session ends independently of a cookie session.

| Key | Owner and stored data | When written / renewed | Consent purpose | Lifetime / logical scope |
| --- | --- | --- | --- | --- |
| `x-breinify-uuid` | Core user: raw session ID. | First permitted session-ID lookup when absent, or `user.resetSessionId`. | `identifierStorage` | Tab/session lifetime or until reset. Shared by this origin's library consumers within that tab. Cookie fallback below has broader scope. |
| `x-breinify-rfr` | Core user: `{sessionId, entryUrl, entryReferrer, lastUrl, distance}`. | Referrer tracking with `handleReferrer` enabled and permitted profile access; updates navigation state. | `profileStorage` | Tab/session lifetime; resets for a changed session ID. Cookie fallback below. This is core referrer tracking, not the removed Journey plugin. |
| `br-wed-<webExVersionId>` | UiCountdown: campaign response. | Campaign settings use `PER_TAB_SESSION_VISIBILITY`. | `presentationStorage` | Tab/session lifetime; scope is the web-experience version. One-time visibility removes local and session copies; switching storage modes removes the other copy. |
| `br::wemc::decision` | UiModifyContent: version 2 envelope of session condition decisions and bindings. | Session-scoped condition results are updated or expired entries removed. | `presentationStorage` | Session lifetime; positive `maxAgeSeconds` shortens validity, while zero means no additional time limit within the session. Logical scope matches the local decision envelope. |
| `br::wemc::random` | UiModifyContent: version 1 envelope of random boolean assignments. | First evaluation of a random condition without a stored assignment. | `presentationStorage` | Session lifetime, with no additional TTL. Scope is experience ID + version + condition reference; the current runtime also keeps a memory result. |
| `breinify::dev-studio::state` | DevStudio: `{isVisible, activeTab}`. | Saving DevStudio UI state. | `presentationStorage` | Tab/session lifetime. One UI-state key per origin/tab. |
| `previewIds` | DevStudio: comma-separated preview IDs. | Removing a preview rewrites the remaining IDs; removes the key when empty. | `profileStorage` for **UTL access**; direct bootstrap exception below | Tab/session lifetime or explicit preview/reset removal. Scope is the development-preview selection. |
| `breinify` | Development-mode flag, read by the core helper; not written by the API library. | Written by Script Creator bootstrap, described below. | `profileStorage` for **UTL reads**; direct bootstrap exception below | Tab/session lifetime or explicit reset. Recognized values include `true` and `disabled`. |
| `br-storage-test-<time>-<random>` | Storage availability probe containing its own key. | Explicit `storage.isAvailable('session')`, also used when selecting identifier storage. | `identifierStorage` | Written/read/removed during the same probe. Removal may fail if browser access becomes unavailable. |

## Cookie inventory and attributes

These are the four built-in cookie names written by the library. Core identifiers/referrer use cookies
when the identifier-storage selector cannot use both local and session storage. Delayed activities use
cookies when their local-storage store operation fails. A fallback still needs the same consent.

| Cookie | Stored data / when set | Consent purpose | Requested lifetime | Domain, path, and logical scope |
| --- | --- | --- | --- | --- |
| `x-breinify-bid` | Raw browser ID; created on a permitted lookup when no valid ID is available. | `identifierStorage` | **3,650 days** from creation, no renewal on ordinary reads. | `UTL.cookie.domain()`, `Path=/`; shared across matching domain/subdomains and tabs. |
| `x-breinify-uuid` | Raw session ID; created when absent or explicitly reset. | `identifierStorage` | **Session cookie**, no explicit expiry. | Same domain/root path; unlike session storage, this can share a session ID across tabs. |
| `x-breinify-rfr` | JSON referrer/navigation state, stored as a string by the core identifier backend. | `profileStorage` | **Session cookie**, no explicit expiry. | Same domain/root path; state can be shared across matching tabs/subdomains. |
| `x-breinify-delayed` | Map of delayed activity IDs to user/tags/type/timing/filter data, encoded by `cookie.setJson`. Written when scheduling via cookie fallback or removing an entry from the map. | `delayedActivities` | **Session cookie**; individual activity `maxAgeInMs` is checked when processing. | Same domain/root path; queued records can be visible to matching tabs/subdomains. Reads merge permitted cookie and local records; removal attempts both backends. |

`UTL.cookie.domain()` uses configured `cookieDomain` if provided (with a leading dot), otherwise the
current hostname heuristic, with special handling for hosted domains. It returns no explicit domain for
localhost. With no Domain attribute the browser uses host-only scope. Check the returned value for the
customer's hostname; the helper is not a public-suffix database. Cookie scope is not the API hostname.

Built-in writes use `Path=/`. Default configuration requests **Secure** (`cookieHttpsOnly: true`) and
**SameSite=None** (`cookieSameSite: 'none'`). Helper arguments/configuration can override those attributes.
These JavaScript-written cookies are not HttpOnly. JSON cookie encoding is not encryption. The helper's
public `set`/`setJson` methods accept custom names, expiry in **days**, and domain/path options (`global`
selects root path; otherwise no explicit Path is emitted). Custom keys default to `profileStorage` unless
classified; their actual contents and scope depend on the caller.

## Customer integration: Bradford sale items

The sale-items module uses the library's token helper with `CONTENT_TOKENS` and an empty payload. It sends
no user information. Its cache uses `CONTENT_STORAGE`, independently of the network operation. This does
not enable consent settings for Bradford; absent settings retain legacy behavior. The migrated module
requires a library build containing `CONTENT_STORAGE`, its prefix classification, and the storage helpers.

| Location / key | Stored data and write trigger | Consent purpose | Time and scope |
| --- | --- | --- | --- |
| Local `breinify-content-sale-items` | `{timestamp, items}` for shared sale products. Written after a resource response and when filtering a cached array; cached rewrites retain the original timestamp. | `contentStorage` | Origin-wide product cache. **30-minute freshness interval**; stale items are served while refreshing. Expired promotions are excluded using their promotion timestamps. This is not a browser-enforced deletion TTL. |
| Local `breinify-sale-items` (legacy) | Previous cache with the same format. Registered as content storage during module initialization for migration. | `contentStorage` after registration; previously unclassified | Valid existing data is copied to the new key without renewing its timestamp, then the old key is removed if cleanup succeeds. If absent/already cleaned or migration fails, the module fetches fresh content. |

If persistence is denied by an explicit customer override, the module still loads products using its
separate content-token permission and keeps the current product index in memory. Denying `contentTokens`
can block the network request; denying `contentStorage` blocks the cache. Failed or denied token requests
clear the in-progress flag so a subsequent load can retry. No automatic consent replay is added.

## Script Creator bootstrap exception

The generated prefix runs before the library's consent initialization. Its current development-mode path
uses native `window.sessionStorage`, so those accesses **are not gated by UTL consent**, even when consent
will later be enabled. This is actual current behavior, not a declaration that these keys require no consent.

| Key | Trigger / contents | Consent behavior | Time and scope |
| --- | --- | --- | --- |
| `breinify` | `?breinify=true` or `?breinify=disabled` writes the selected mode; stored mode is read on later navigation. `?breinify=reset` removes it. | Native bootstrap read/write before configuration; later API-library reads use `profileStorage`. | Origin + tab/session, until reset or session end. |
| `previewIds` | A valid preview-ID query parameter in development mode writes the selection; later pages reuse it. Reset/disabled mode removes it. | Native bootstrap read/write before configuration; later DevStudio UTL writes use `profileStorage`. | Origin + tab/session, until changed, reset, removed, or session end. |

The different bootstrap and UTL behavior is a current integration boundary. These unprefixed keys are not
among the standard library-prefix cleanup targets. Other customer scripts using native storage or cookies
also require separate review; this inventory cannot enumerate arbitrary integration-defined keys or CMP-owned data.

## Revocation, cleanup, and memory

When a new valid snapshot or timeout baseline is published, the manager removes denied entries with known
library prefixes (`x-breinify-`, `breinify-`, `breinify::`, `br-wed-`, `br-ctd-`, `br::wemc::`) and explicitly
registered keys from local/session/explicit memory storage. It expires the four known cookie names above
using host-only and currently determined domain scopes, with root/default-path removal attempts. It does
not guarantee removal of cookies previously created at arbitrary other domains/paths. Access through UTL
is denied even when browser restrictions prevent physical removal. While the initial query is still pending,
old values can remain physically present but cannot be read through the denied UTL paths.

Unrelated keys are not deleted. Unclassified UTL reads/writes still require `profileStorage`, even if the
key was created elsewhere. Explicit `removeItem`/cookie expiry is allowed for cleanup without a grant;
`getStorage(type).clear()` still clears the entire backend, so use specific keys for normal cleanup.

The manager clears cached identifiers/referrer data and affected stored/restored consumer state on changes.
Not every page-memory value is persistence: live feature values, split-test response objects, current-runtime
random results, and suppression cooldowns can exist in memory. Their presence does not authorize sending
user data, reading denied persistent records, or carrying identity across navigation. No consent snapshot
or Airgap purpose value is itself persisted by this adapter; CMP-owned storage is outside this inventory.

## Source references and maintenance

* [Core storage, cookies, key classification, identifiers, and cleanup](../src/BreinifyUtil.js)
* [Cookie configuration defaults](../src/BreinifyConfig.js) and [tracking-parameter deduplication](../src/Breinify.js)
* [Activities](../src/plugins/Activities.js), [SplitTests](../src/plugins/SplitTests.js), and [UiCountdown](../src/plugins/UiCountdown.js)
* [FeatureStorage](../src/plugins/FeatureStorage.js), [UiModifyContent](../src/plugins/UiModifyContent.js), and [DevStudio](../src/plugins/DevStudio.js)
* Script Creator: `src/com/brein/external/scriptcreator/templates/snippets/prefix-snippet.js` in the sibling Script Creator repository.

When introducing a storage writer, add its exact key or configurable pattern, owner/data, write trigger,
consent purpose, lifetime/renewal/cleanup rules, and browser/logical scope here. Document direct native
access separately from UTL access. Registration or a functional-looking name does not establish that the
stored value is safe for that purpose; review the payload as well.
