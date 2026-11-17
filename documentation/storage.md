# Browser storage

`Breinify.UTL.storage` provides shared access to local storage, session storage, and explicit in-memory
storage. Core code and bundled plugins use this object for browser storage access. Cookies use
`Breinify.UTL.storage.cookie`, which is the same object as the existing `Breinify.UTL.cookie`.

This foundation preserves existing keys, serialized formats, and caller-specific fallbacks. It does
not yet enforce consent, classify data by consent level, or invalidate plugin memory caches when consent
changes. Customer integration code and script-creator code outside this library need a separate review.

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
data may also remain cached in memory; central persistence access alone does not control those caches.

## Stored data inventory

Local and session entries have no browser-enforced TTL. Expiry below describes checks performed by the
library; expired entries can remain physically stored until read, cleanup, or explicit removal. Browser
session storage normally lasts for the page session and can be restored by browser session restoration.

### Core

| Location and key | Stored data and purpose | Lifetime / cleanup |
| --- | --- | --- |
| Local `x-breinify-bid` | Browser identifier as JSON `{v, exp}`. Links activity and requests to a browser. | 3,650-day expiry, checked when read. Cookie fallback uses the same key and raw ID. |
| Session `x-breinify-uuid` | Raw session identifier. | Page session; can be replaced by `user.resetSessionId`. Cookie fallback is a session cookie. |
| Session `x-breinify-rfr` | Referrer state: `{sessionId, entryUrl, entryReferrer, lastUrl, distance}`. Used when `handleReferrer` is enabled. | Session-scoped state, reset for a changed session ID. Cookie fallback stores the JSON in a session cookie. |
| Local `breinify-split-test-data` | Named-cache envelope containing split-test assignments and attribution metadata. Preview assignments can include `expiresAt`. | Current envelope duration is `30 * 24 * 60` **seconds (12 hours)**. Assignment reads separately prune data older than 24 hours and expired previews; cache `get` itself does not check envelope expiry. |
| Local `breinify-gp-data` | Named-cache envelope containing tracking-parameter hashes already handled, for deduplication. | 60-second envelope metadata; `get` does not independently enforce expiry. |
| Local `breinify-<name>` | Other caller-defined named-cache data. | Caller-supplied seconds; explicit expiry checking required. Memory fallback when local storage cannot be obtained at cache initialization. |
| Session `breinify` | Developer-mode flag, read as the string `'true'`. | Written by integration/script-creator code outside this library; session lifetime. |
| Local/session `br-storage-test-<time>-<random>` | Temporary read/write availability probe. Contains its own key. | Removed during the probe; removal can fail if storage access becomes unavailable. |

### Plugins

| Owner / location and key | Stored data and purpose | Lifetime / cleanup |
| --- | --- | --- |
| Activities / local `breinify-sa-data-<id>` | Delayed activity containing `user`, `tags`, `type`, `maxAgeInMs`, `filter`, and `timestamp`. Tags can include page URL/title. | Until processed/removed; positive `maxAgeInMs` is checked when processing. |
| Activities / cookie `x-breinify-delayed` | Fallback map of delayed activity IDs to their data, using cookie JSON encoding. | Session cookie. Reads merge both stores and removal attempts both; fallback is used when local writes fail. |
| Journey / session `br::journey` | Array of the last 20 tracked `{path, group, item}` entries. | Page session; also held in plugin memory. |
| SplitTests / local, configurable `storageKey.live` and `storageKey.test` | Assignment response with `lastUpdated` and `isControl`. | Default freshness is one hour, configurable by `timing.expirationAfterMs`; stale persistent data can remain until replaced. Keys may be omitted to avoid persistence. |
| UiCountdown via SplitTests / local `br-ctd-<splitTestName>` | Countdown split-test assignment, using the SplitTests format. | SplitTests freshness rules. |
| UiCountdown / local or session `br-wed-<webExVersionId>` | Session: campaign response. Local: `{time, ttl, renew, response}`. Maintains the display window. | Per-tab uses session storage. Time-limited uses configured seconds. Default local duration is 30 minutes and is written with `renew: false`; reads renew only entries already marked `renew: true`. One-time visibility removes both copies. |
| FeatureStorage / local `breinify::featureStorage::feature::<name>` | Feature value, metadata, definition, and persistence timestamps: `{value, meta, definition, persistedAt, expiresAt}`. | Persistence enabled by default, default TTL 24 hours, configurable per definition. Touching a feature can refresh persistence. Expired values are checked on reads and periodic cleanup. |
| FeatureStorage / local `breinify::featureStorage::cleanupAt` | Last cleanup timestamp as a numeric string. | Used to limit cleanup to once per six hours. |
| UiModifyContent / local or session `br::wemc::decision` | Version 2 envelope `{version, entries}` of cached decisions. | Configured cache scope and `maxAgeSeconds`; page/memory decisions stay in memory. |
| UiModifyContent / session `br::wemc::random` | Version 1 envelope `{version, entries}` of stable random assignments. | Page session. |
| UiModifyContent / local `br::wemc::suppression` | Version 1 envelope `{version, entries}` of suppression expiry timestamps, keyed by API key and web-experience ID. | Configured cooldown; expired entries are ignored. Memory fallback remains usable when persistence fails. |
| DevStudio / session `breinify::dev-studio::state` | `{isVisible, activeTab}` UI preferences. | Page session. |
| DevStudio / session `previewIds` | Comma-separated preview IDs. | Page session; consumed IDs are removed and the key is removed when empty. |

### Cookie details and extension points

Core identifier cookies are used as a fallback with the same names listed above. Browser-ID cookies
expire after 3,650 days; session-ID and referrer cookies have no explicit expiry. The cookie helper
controls domain, root path, SameSite, and secure attributes using its existing configuration and arguments.
Delayed activities use the helper's JSON encoding and the determined cookie domain.

The public cookie methods and named-cache methods also accept caller-defined keys and values. Integrations
can therefore store additional data not covered by this built-in inventory. Feature values, split-test
responses, campaign responses, and configured user/tag data can contain integration-specific information.
These contents need review alongside the key when assigning consent behavior.

## Consent integration boundary

Consent policy should be applied to reads as well as writes, including data that already exists. The
shared access methods provide that integration point, but policy is not implemented here yet. Follow-up
work must also address in-memory identifiers and plugin caches, cleanup of known keys, and any customer
code that accesses browser storage directly. Consent categories and per-operation behavior remain
separate decisions; storage duration or a key's name alone does not establish its consent category.
