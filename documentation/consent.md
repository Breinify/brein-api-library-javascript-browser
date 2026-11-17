# Core consent capability

`Breinify.UTL.consent` is a core utility object. It is available as soon as the library has loaded,
before `Breinify.setConfig()`, `UTL._init()`, and customer `initCode.js` in the default generated order.
Its internal state and helpers live in `_private.consent`.

This capability manages consent evaluation and notifications. It does **not yet** gate existing
requests, user lookups, cookies, storage, or plugins. No CMP implementations or script-creator
configuration injection are included yet. Applications must explicitly consult it to use its result.

## Public methods

| Method | Contract |
| --- | --- |
| `configure(settings)` | Installs the provider, subscribes to changes when supported, and starts an initial evaluation. Does not wait for the result before returning. |
| `evaluate(callback)` | Resolves the current permissions through `callback(permissions)`. May complete synchronously. Returns no value. |
| `onChange(listener)` | Registers `listener(permissions)` for changes and returns an idempotent unsubscribe function. Does not immediately replay the last result; use `evaluate` for an operation. |

`settings` has these properties:

| Property | Meaning |
| --- | --- |
| `timeoutInMs` | Maximum wait per evaluation, default `2500`. A finite number from `0` to `2147483647`. Zero allows a synchronous result, otherwise falls back on the next timer turn. |
| `provider` | Optional object implementing the provider contract below. An absent provider remains unresolved until timeout. |

Calling `evaluate` before configuration returns an empty permissions object immediately. It never
implicitly grants consent. Existing library behavior is unchanged because existing operations are
not connected to the manager yet.

## Permissions

A result is an immutable snapshot of an object whose own enumerable properties are booleans.
Only an explicitly present `true` grants a permission. Missing properties and `false` do not.
The empty object `{}` represents the lowest permission level: no permissions granted.

Permission names and CMP category mappings are intentionally not standardized yet. They must be
agreed while reviewing the individual operations and data access points. Names in examples below
are illustrative, not an established consent policy.

## Provider contract

The interface is documented here rather than declared as a separate JavaScript interface.

| Method | Contract |
| --- | --- |
| `evaluate(callback)` | Required. Calls `callback(permissions)` with current permissions. Can query synchronously, query asynchronously, or consult a provider-maintained cache. Return values and promises are not consumed. |
| `onChange(listener)` | Optional. Subscribes to CMP updates and returns an unsubscribe function. Supplies complete permission snapshots, not partial patches. |

Each evaluation after the preceding one has completed calls the provider again. Concurrent callers
share the pending evaluation and its original timeout. The manager does not reuse a previously
granted result to authorize a new evaluation; caching and freshness belong to the provider.

If consent is unknown, the provider may retain the callback until information is available.
`null`, `undefined`, and malformed results leave the evaluation waiting. Provider errors also leave
it waiting for an observer update or timeout. Errors are logged to the console without creating activities.

On timeout, waiting consumers receive `{}` once. A later valid response can notify observers,
but does not invoke those completed consumers again or replay an operation. A newer evaluation or
observer update supersedes older responses. Provider callbacks must report only one valid result;
later updates belong on the observer channel.

Observer updates resolve pending evaluations immediately. Repeated identical snapshots do not
notify observers again. Consumers cannot mutate the provider's data or another consumer's snapshot.
An exception in one consumer or observer is logged without preventing the other callbacks.

Reconfiguration detaches the old provider observer, invalidates old callbacks, and completes pending
consumers with `{}`. Previously known permissions are cleared, with a lowest-level notification when
they change, before the new provider starts. Consumer subscriptions remain registered. Configure
once during normal startup; do not configure before each operation.

```javascript
const provider = {
    evaluate: function (callback) {
        // replace with a CMP query or the provider's current cache
        callback({examplePermission: false});
    },
    onChange: function (listener) {
        // connect the CMP observer here and return its cleanup function
        return function () {};
    }
};

Breinify.UTL.consent.configure({
    timeoutInMs: 2500,
    provider: provider
});

Breinify.UTL.consent.evaluate(function (permissions) {
    if (permissions.examplePermission === true) {
        // perform the operation with the permitted data
    } else {
        // omit the restricted data or suppress the operation, according to its agreed policy
    }
});
```

## Script-creator integration point

The intended generated order is:

1. Load the core library, making `UTL.consent` available.
2. Inject settings from `ScriptSettings` and call `UTL.consent.configure(settings)`.
3. Run development observers, customer `initCode.js`, the entry point, and subsequent scripts.
4. Consult consent at the agreed data access and operation boundaries. While an evaluation is
   pending, do not read restricted data or send the operation being evaluated.

Injection must precede `initCode.js`, which can already perform requests. It must also precede
`setConfig()`, which triggers ready handlers and configured URL/UTM processing. Custom ordering and
an existing global Breinify instance need validation when the script creator is connected.

The library's fallback object also exposes the three methods if normal library loading fails.
It grants no permissions: evaluation immediately returns `{}`, and configuration and observation
are inert. This does not make the remaining fallback functionality operational.
