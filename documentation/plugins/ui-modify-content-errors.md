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
`console.error` calls, and performs no polling or DOM scanning. Only the Modify Content execution
catches call it; unrelated customer-page exceptions do not invoke this helper. The existing separate
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
