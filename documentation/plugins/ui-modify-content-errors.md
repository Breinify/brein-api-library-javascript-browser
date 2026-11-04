# Modify Content error reporting

`_failure` (shown as **On error**) identifies a failed decision lookup. It does not by itself mean
JavaScript execution failed. A failure fallback can render successfully (status `200`), be empty
(`13000`), or fail while rendering (`500`). Campaigns' failure breakdown describes that fallback's
rendering outcome, not the cause of the lookup failure.

Failed lookups now attach `lookupFailure` to the `renderedElement` activity:

- `category`: `TIMEOUT`, `NETWORK_ERROR`, `HTTP_ERROR`, `SERVICE_ERROR`, `INVALID_RESPONSE`,
  `MISSING_DECISION`, `CLIENT_EXCEPTION`, `SERVICE_UNAVAILABLE`, or `EXPERIENCE_ERROR`.
- `batchSize`: number of experience requests in the shared decision request.
- `httpStatus`, `responseCode`, `errorCode`: numeric codes when supplied by the service error.

Response bodies, request inputs, arbitrary error messages, and request URLs are excluded.
These details are available in new raw activities after publication; the existing Campaigns charts
do not yet aggregate these categories. Historical activities cannot be backfilled from their counts.
Legacy shared decision requests can fail because of another experience: the original Discovery path
propagates a resolver exception out of the batch and the browser marks all current requests failed.

## Opt-in isolated lookup failures

Updated clients send `includeErrors: true` alongside `webExperiences`. Only the boolean `true` enables
isolation in Discovery. An absent, false, or non-boolean value retains the original fail-fast path and
response shape, so existing scripts do not change behavior. The gateway forwards the flag unchanged.
An older server ignores the flag; the updated browser still accepts its ordinary response and retains
batch-wide failure handling when that server returns an error. Deploying Discovery first is recommended.

The response keeps the existing `decisions` structure and adds `errors` only when an experience/item
lookup fails. Successful responses have exactly the original shape; there is no version or echoed flag:

```json
{
  "decisions": [
    {"configurationId": "successful-config", "matched": true, "conditions": []}
  ],
  "errors": [
    {
      "configurationId": "failed-config",
      "webExperienceId": "failed-experience",
      "webExperienceVersionId": "failed-version",
      "requestId": "optional-item-correlation",
      "errorCode": 25202,
      "errorMessage": "The web-experience lookup could not be completed."
    }
  ]
}
```

`requestId` is omitted for non-iterated requests. Each requested decision appears in exactly one list.
An all-failed batch returns `decisions: []` with its identified errors. A below-threshold or inapplicable
condition remains an ordinary successful decision with `matched: false`, not an error. Successful
resolver data remains shared within the batch. The server continues after lookup exceptions, but does
not swallow cancellation or fatal JVM errors. Request validation and failures that prevent a complete
response, such as network timeouts, still affect the entire call.

The browser uses both `configurationId` and the item `requestId` when present. Only the failed runtime
selects `_failure`; its `lookupFailure` activity tag uses `category: "EXPERIENCE_ERROR"` and retains the
numeric `errorCode`, configuration ID, optional item request ID, and batch size. The `errors` array is
optional; ordinary legacy responses continue to work. Missing or uncorrelated results remain
`MISSING_DECISION`; exception messages and server parameters are never copied into activities.

## Caught-exception reporting cost and scope

This is an explicit helper, not a global exception hook. It registers no page listener, intercepts no
`console.error` calls, and performs no polling or DOM scanning. Modify Content execution catches call it directly. Activation snippets, trigger callbacks, and UI
recommendation execution boundaries use the opt-in reporter described below; unrelated customer-page
exceptions do not invoke either helper. The existing separate
window-error integration is unchanged.

Explicit execution catches report `scriptError` using `Breinify.handleCaughtError(error, context)`.
The adapter extracts a Breinify-hosted source URL and line/column from a Chrome/Firefox-style stack,
then uses the existing error mapper and activity sender. It preserves custom mapper filtering.
Without usable source information or an accepting mapper, the handler falls back to the console.
Network callbacks and unsuccessful service responses do not become script errors just because their
error value happens to be an `Error` object. Classification is based on the execution path.

Modify Content includes the experience/version and execution phase in `scriptError`'s `execution`
tag. Reporting is deduplicated by phase and error origin per runtime and page visit, capped at 20
unique reporting attempts. Duplicate checks use only the first two stack lines; after the budget is
exhausted, even that extraction is skipped. The full stack is scanned only for an admitted attempt,
and the existing mapper is called at most once. A rejected or failed attempt still consumes its slot
so repeated errors do not continually retry telemetry.

This is a per-runtime budget, including a separate budget for each iterated item, not a page-wide
limit. It reduces reporting work and activity traffic; it does not prevent the underlying action
from running and failing again. A Breinify frame identifies the execution path, not necessarily the
code responsible for the original bug. Unsupported/self-hosted sources retain the console fallback.
Caught snippet failures also mark rendering failed. One later failed-rendering
activity may correct an earlier successful/ignored outcome for the same visit; repeated failures
remain suppressed. Campaigns resolves the latest rendering outcome for its session metrics.


## Opt-in reporting at shared execution boundaries

`Breinify.reportExecutionError(error, context)` is used by activation snippets, trigger module checks,
DOM-change callbacks, trigger-settings hooks, and UI recommendation preparation/rendering and extension hooks.
These are execution boundaries where an unexpected exception indicates a broken SDK or snippet path.
Normal false/no-match results and missing optional snippets do not enter the reporter.

This is not an automatic classifier for arbitrary exceptions. Do not call it from storage recovery,
configuration validation, or ordinary service error callbacks. It additionally rejects non-Error values,
DOMExceptions (including invalid selectors), named cancellation/transport/environment errors, and Errors
carrying `isNetworkError`, numeric `httpStatus`, or string `textStatus` signals. Code explicitly identifying
configuration validation can mark an Error with `breinifyErrorCategory: 'configuration'` to exclude it.
An untagged Error from an arbitrary network callback cannot reliably be classified from its stack alone.

The shared reporter deduplicates the same Error object across nested catches, and repeated errors by
context plus their heading/first frame. It permits at most 20 distinct reporting attempts across these
new boundaries per observed page URL. The budget is separate from Modify Content's existing per-runtime
budget. After exhaustion, it skips stack access. Only the next reporting call that sees a different URL
resets this budget; it does not add navigation listeners. Mapper rejection or a telemetry failure still
consumes the attempt to avoid retry storms.

Context is limited to string identifiers: plugin, phase, experience/version, module, and snippet ID.
The existing adapter still requires an eligible HTTPS Breinify stack frame and an accepting error mapper.
Missing reporters on older cores and failures of overridden reporters preserve the original fallback.

These additions report `scriptError`; they do not introduce new rendering activity semantics. For example,
an extension failure followed by successful fallback rendering stays a successful rendering. Activation
still returns false on failure, subscribers continue independently, and caught recommendation promises
remain handled. Survey callbacks, feature listeners, snippet observers, and placement actions remain
separate follow-up work; they are not claimed as covered by this change.
