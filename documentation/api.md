<p align="center">
  <img src="https://www.breinify.com/img/Breinify_logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

### Library Documentation

The library provides several attributes, methods, and objects to simplify the usage of the Breinify API. Besides methods to actually send or retrieve data, it also includes general information (e.g., about the version and used configuration), as well as utilities. This reference covers the core library. Separately loaded plugins have their own APIs and documentation.

The examples use modern JavaScript and assume that the library has been loaded and configured.
This page covers the following API methods and utilities:

* [Version availability](#version-availability)
* [General Attributes](#general-attributes)
  * Breinify.version
  * Breinify.config()
  * Breinify.setConfig(config)
  * Breinify.onReady(callback)
  * [Complete configuration reference](#complete-configuration-reference)
* [API](#api)
  * Breinify.activity(user, type, category, description, tags, sign, onReady)
  * Breinify.temporalData(user, sign, onReady)
  * [Breinify.recommendation](#recommendations)
  * [Breinify.service](#services)
  * [Request builders](#request-builders)
  * [Error reporting](#error-reporting)
* [Utilities (UTL)](#utilities-utl)
  * [Breinify.UTL (general functions)](#breinifyutl-general-functions)
    * Breinify.UTL.trimQuotes(str, inclSingleQuotes)
    * Breinify.UTL.texts(selector, excludeChildren)
    * Breinify.UTL.text(selector, excludeChildren)
    * Breinify.UTL.setText(selector, value)
    * Breinify.UTL.md5(value)
    * Breinify.UTL.isEmpty(value)
    * Breinify.UTL.isSimpleObject(obj)
    * Breinify.UTL.unixTimestamp()
    * Breinify.UTL.timezone()
    * Breinify.UTL.localDateTime()
    * Breinify.UTL.endsWith(str, suffix)
    * Breinify.UTL.getNested(obj, str1, str2, ...)
    * Breinify.UTL.deleteNullProperties(obj)
    * Breinify.UTL.uuid()
    * Breinify.UTL.capitalize(str)
    * Breinify.UTL.lowerize(str)
    * Breinify.UTL.firstLetter(str, toLowerCase)
    * Breinify.UTL.toNumber(value)
    * Breinify.UTL.isNonEmptyString(value)
    * Breinify.UTL.toPrice(value)
    * Breinify.UTL.formatPrice(price, settings)
    * [Breinify.UTL.formatDuration(value, unit, settings)](#duration-formatting)
    * [Breinify.UTL.formatValue(value, formatter, options)](#typed-value-formatting)
    * [Breinify.UTL.placeholders](#placeholder-utilities)
    * Breinify.UTL.toInteger(value)
    * Breinify.UTL.equals(first, second)
  * [Breinify.UTL.events](#breinifyutlevents)
    * Breinify.UTL.events.click(selector, func, onlyOnce)
    * Breinify.UTL.events.pageloaded(func)
  * [Breinify.UTL.loc](#breinifyutlloc)
    * Breinify.UTL.loc.params(paramListSeparator, paramSeparator, paramSplit, url)
    * Breinify.UTL.loc.hasParam(param, paramListSeparator, paramSeparator, paramSplit, url)
    * Breinify.UTL.loc.isParam(param, params)
    * Breinify.UTL.loc.paramIs(expected, param, paramListSeparator, paramSeparator, paramSplit, url)
    * Breinify.UTL.loc.parsedParam(expectedType, param, paramListSeparator, paramSeparator, paramSplit, url)
    * Breinify.UTL.loc.param(param, paramListSeparator, paramSeparator, paramSplit, url)
    * Breinify.UTL.loc.url()
    * Breinify.UTL.loc.extract(url)
    * Breinify.UTL.loc.matches(regEx)
  * [Breinify.UTL.cookie](#breinifyutlcookie)
    * Breinify.UTL.cookie.all()
    * Breinify.UTL.cookie.reset(name, domain)
    * Breinify.UTL.cookie.set(name, value, expiresInDays, global, domain, httpsOnly, sameSite)
    * Breinify.UTL.cookie.get(name)
    * Breinify.UTL.cookie.check(name)
  * Breinify.UTL._jquery()
  * [Additional utility methods](#additional-utility-methods)
  * [User, storage, and integration utilities](#user-storage-and-integration-utilities)
* [Constructors and plugins](#constructors-and-plugins)

#### Version availability

This reference describes the current source API. `package.json` reports **1.0.25**. The GitHub `master`
revision checked on 2026-11-17 is [`c8139fb`](https://github.com/Breinify/brein-api-library-javascript-browser/commit/c8139fbdf4a6b8639f5fb07668f78527c964c909), matching the local committed source.
The highest available Git tag is **1.0.23**; neither `1.0.24` nor `1.0.25` has a Git tag.
Later functionality was added while the package version remained unchanged. A version string alone therefore
does not establish that a deployed bundle contains every method below. Check the actual bundle's methods or
use a build from the required source revision. Git history does not prove npm/CDN publication availability.

The table replaces the old, partly incorrect “since version” labels. “Verified tag” means the earliest
available tag whose source contains the method, not a claim about its first published release or current signature.

| Feature | Earliest verified tag | Source-history evidence where useful |
| --- | --- | --- |
| `version`, `config`, `setConfig`, `activity`; text helpers, `md5`, `isEmpty` | `1.0.4` | Earlier untagged source exists; no `1.0.1` tag is available. |
| `UTL.events.click/pageloaded`; basic URL-parameter helpers and `loc.matches`; `cookie.all/reset/set/get/check` | `1.0.4` | Verified in the earliest available tag; this does not verify the former `1.0.1` claims. |
| `UTL.isSimpleObject` | `1.0.6` | Added in `f5830af9`, with package version `1.0.6`. |
| `temporalData`, `UTL.unixTimestamp`, `UTL.timezone`, `UTL.localDateTime` | `1.0.7` | These predate the old `temporalData` claim of `1.0.11`. |
| `recommendation`, `UTL.trimQuotes` | `1.0.8` | `trimQuotes` was added in `e397e73a`; its old `1.0.1` label was incorrect. |
| `UTL.uuid` | `1.0.15` | Added in `a8c9ff5f` while the package said `1.0.13`; no `1.0.13` tag is available. |
| `UTL.endsWith`, `UTL.getNested`, `UTL.loc.extract`, `UTL._jquery` | `1.0.16` | `getNested` was already present before the old `1.0.18` claim. |
| `UTL.deleteNullProperties` | `1.0.19` | Added in `66258a68` with package version `1.0.19`. |
| `onReady`, `UTL.capitalize`, `UTL.lowerize`, `UTL.firstLetter`, `UTL.toNumber` | `1.0.23` | Added during the untagged `1.0.22` development period. |
| `handleError` | `1.0.23` | Present in the tagged source; later error-reporting helpers are separate additions. |
| `UTL.isNonEmptyString`, `UTL.toPrice`, `UTL.toInteger`, `UTL.formatPrice`, `UTL.equals` | No available tag | Added in `ad727cf6`, `7f9a2b04`, and `b17167f9` while the package said `1.0.24`. |
| `service` and `serviceUser` | No available tag | Added in `77a5a78d` (2026-06-30), package version `1.0.25`. |
| `UTL.formatValue`, `UTL.placeholders` | No available tag | Added in `d2a6708b` (2026-10-27), package version `1.0.25`. |
| `UTL.formatDuration` | No available tag | Added in `015eeae9` (2026-11-04); singular labels followed in `501f568`. Package version stayed `1.0.25`. |
| `handleCaughtError`, `reportExecutionError` | No available tag | Added in `e1127098` and `0c4218c5` (2026-11-04), package version `1.0.25`. |
| `UTL.user.getReferrerData` | No available tag | Added in `81d1d886` (2026-07-18), package version `1.0.25`; its current behavior is described below. |
| `UTL.consent` | Working-tree addition at review time | Not present in the audited `master` revision; do not infer availability from `1.0.25`. |

The core request methods and non-internal utility methods are covered below. Private implementation details
(`UTL.internal`, underscore-prefixed lifecycle hooks, mutable caches, and plugin internals) are not a supported
application contract. `_jquery()` is documented because integrations use it explicitly. Plugin-specific methods
are outside the core reference; see [Constructors and plugins](#constructors-and-plugins).

#### General Attributes

* {string} **Breinify.version**:<br/>
  Contains the current version of the usage library. If an error occurred while loading the library, the version is set to be *'FALLBACK'*.

  **Example Usage**:
  ```javascript
  window.alert(`The current version of the library is: ${Breinify.version}`);
  ```
  <br/>

* {object} **Breinify.config()**:<br/>
  Retrieves the current configuration object. The following example shows selected default properties; the returned object also includes other settings and callback functions.

  ```javascript
  const config = {
    activityEndpoint: '/activity',
    apiKey: '0000-0000-0000-0000-0000-0000-0000-0000',
    category: 'other',
    secret: null,
    temporaldataEndpoint: '/temporaldata',
    timeout: 4000,
    url: 'https://api.breinify.com',
    validate: true
  };
  ```

  **Configuration Properties**:

  {string} **activityEndpoint**: The end-point of the API to send activities.

  {string} **apiKey**: The API-key to be used (mandatory).

  {string} **temporaldataEndpoint**: The end-point of the API to retrieve temporal-data results.

  {string|null} **secret**: The secret attached to the API-key (should always be null utilizing this type of library).

  {number} **timeout**: The request timeout in milliseconds (default: `4000`). If the API does not respond within this time, the request is cancelled.

  {string} **url**: The URL of the API.

  {string|null} **category**: The default activity category (default: `'other'`).

  {boolean} **validate**: Whether configuration properties are validated (default: `true`).

  **Example Usage**:
  ```javascript
  for (const [property, value] of Object.entries(Breinify.config())) {
    console.log(`The configuration property "${property}" has the value "${value}".`);
  }
  ```
  <br/>

* **Breinify.setConfig(config)**:<br/>
  Replaces the current configuration with the supplied properties plus library defaults. Omitted properties reset to their defaults. To preserve existing settings, pass `{...Breinify.config(), ...changes}`.

  **Parameters**:

  {object} **config**: A plain object specifying the configuration properties to be set. If the validation of the configuration is activated, the passed values will be validated and an *Error* will be thrown, if the specified configuration property is invalid.

  **Example Usage**:
  ```javascript
  Breinify.setConfig({
    apiKey: '23AD-F31F-F324-6666-AC2D-C526-D829-BBC2'
  });
  ```
  <br/>

* **Breinify.onReady(callback)**:<br/>
  Registers a function to run after the first `setConfig` call. If already ready, schedules the callback with
  a zero-delay timer. This indicates configuration readiness, not completion of requests or DOM readiness.
  Do not depend on callback arguments: registration before configuration uses an event handler, while later
  registration invokes the callback without arguments.

* {string} **Breinify.jQueryVersion**:<br/>
  The version of the bundled jQuery instance, or `'FALLBACK'` if normal library loading failed.

##### Complete configuration reference

In addition to the properties described above, the following settings are accepted by
[`BreinifyConfig`](../src/BreinifyConfig.js). This table covers all remaining registered configuration keys.

| Property | Default | Meaning |
| --- | --- | --- |
| `recommendationEndpoint` | `'/recommendation'` | Recommendation path relative to `url`. |
| `serviceUrl` | `'https://aps.breinify.com'` | Base URL for service-gateway requests. |
| `serviceEndpoint` | `'/services/request'` | Service-gateway path. |
| `withCredentials` | `false` | Sets the AJAX request's `xhrFields.withCredentials`. |
| `handleParameters` | `false` | Processes Breinify tracking parameters when `setConfig` runs. |
| `parametersMapper` | Identity function | Maps decoded tracking-parameter data before handling it. |
| `handleUtm` | `false` | Processes UTM parameters when `setConfig` runs. |
| `utmMapper` | Returns `{utmData, user}` | Maps UTM data and its user before activity generation. |
| `handleReferrer` | `true` | Enables referrer enrichment; adds session-entry journey information. |
| `createUser` | Returns `{}` | Supplies default user information before request-specific enrichment and overrides. |
| `errorTagsMapper` | Built-in mapper | Maps eligible script-error events to activity tags; returning a non-plain-object value suppresses reporting. |
| `cookieDomain` | `null` | Optional domain used by `UTL.cookie.domain()`; it is not automatically applied to every raw `cookie.set` call. |
| `cookieHttpsOnly` | `true` | Default Secure flag for cookies. |
| `cookieSameSite` | `'none'` | Default SameSite value for cookies. |

Calling `setConfig` can run configured parameter handlers and initialize DOM observation. Set callbacks and
tracking settings before calling it. Mapper functions and `createUser` are synchronous; returning a Promise
is not a supported replacement for their result objects.

#### API

* **Breinify.activity(user, type, category, description, tags, sign, onReady)**:<br/>
  Sends an activity to the engine utilizing the API. The call is done asynchronously as a POST request. It is important that a valid API-key is configured prior to using this function.

  **Parameters**:

  {object} **user**: A plain object specifying the user information the activity belongs to. More information about the structure can be found [here](./user.md).

  {string|null} **type**: The activity type, for example `search`, `login`, `logout`, `addToCart`, `removeFromCart`, `checkOut`, `selectProduct`, or `other`. The library does not enforce this list or default the type to `other`; pass the intended type explicitly.

  {string|null} **category**: The platform, service, or product category, for example `apparel`, `home`, `education`, `family`, `food`, `health`, `job`, `services`, or `other`. The library does not enforce this list. If not specified, the configured category (see *Breinify.config().category*) is used.

  {string|null} **description**: A string with further information about the activity performed. Depending on the type of the activity, some typical descriptions are: the used search query (type === 'search'), the name of the selected product (type === 'selectProduct'), the item added or removed from the cart (type === 'addToCart' || type === 'removeFromCart'), and checkout details (type === 'checkOut').

  {object|null} **tags**: Activity tags as a simple object (see [isSimpleObject](#breinifyutl-general-functions)). Omitted or `null` tags become `{}`. Unsupported property values and incompatible array entries become `null`.

  {boolean|null} **sign**: Whether to sign the request using a configured `secret`. For activities, omitted or `null` signing follows whether a secret is configured; temporal-data requests default to unsigned. Keep `secret` set to `null` and use `false` in browser examples; do not expose a signing secret in browser code.

  {function|null} **onReady**: Optional callback. On success it receives the response as its first argument. On request failure it receives an error-details object and an error-message string as its second argument.

  **Supported call forms** (argument count matters):

  * `activity(user, type)`
  * `activity(user, type, tags)`
  * `activity(user, type, description, tags)`
  * `activity(user, type, category, description, tags)`
  * `activity(user, type, category, description, tags, onReady)`
  * `activity(user, type, category, description, tags, sign, onReady)`

  Use `null` for an unused category or description in the longer forms. There is no six-argument form ending in a boolean; use the seven-argument form with a callback to set `sign` explicitly.

  **Example Usage**:
  ```javascript
  const product = 'The selected product';
  const userEmail = 'thecurrentuser@me.com';
  Breinify.activity({
    email: userEmail
  }, 'selectProduct', null, product, {
    isAdvertised: true
  }, false, (data, error) => {
    if (error) {
      console.error(error, data);
      return;
    }
    console.log(`Sent activity "selectProduct" with product "${product}".`);
  });
  ```
  <br/>

* **Breinify.temporalData(user, sign, onReady)**:<br/>
  Retrieves temporal information about the passed user information.

  **Parameters**:

  {object} **user**: A plain object specifying the user information the temporal data should be retrieved for. More information about the structure can be found [here](./user.md).

  {boolean|null} **sign**: Whether to sign the request using a configured `secret`. Omitted or `null` signing defaults to `false`. Keep `secret` set to `null` and use `false` in browser examples; do not expose a signing secret in browser code.

  {function} **onReady**: Callback receiving the response on success, or an error-details object and an error-message string on request failure.

  **Supported call forms**: `temporalData(onReady)`, `temporalData(sign, onReady)`, `temporalData(user, onReady)`, and `temporalData(user, sign, onReady)`. Use `{}` when no user information is available.

  **Example Usage**:
  ```javascript
  Breinify.temporalData({}, false, (data, error) => {
    if (error) {
      console.error(error, data);
      return;
    }
    console.log(data);
  });
  ```
  <br/>

##### Recommendations

`Breinify.recommendation(...)` sends a POST request to `url + recommendationEndpoint`. The callback uses
`(data, errorText)`, like activities and temporal data. Supported forms are:

* `recommendation(user, callback)` — requests three recommendations.
* `recommendation(user, count, callback)`
* `recommendation(user, count, category, callback)`
* `recommendation(user, count, sign, callback)`
* `recommendation(user, count, category, sign, callback)`
* `recommendation(user, settings, callback)`
* `recommendation(user, settings, sign, callback)`

`user` is a plain object, `count` is a number, `category` is a string, and `sign` is a boolean (default `false`).
`settings` can be a plain recommendation object or an array of them. A count becomes `numRecommendations`;
a category becomes a one-element `recommendationCategories` array. An array of settings is sent under
`recommendations`; one object is sent under `recommendation`.

```javascript
Breinify.recommendation({}, {numRecommendations: 3}, false, (data, error) => {
  if (error) {
    console.error(error, data);
    return;
  }
  console.log(data);
});
```

The library stores returned split-test data. If the Recommendations plugin is loaded, its render/activity
hooks can also run for core recommendation calls. A configured `recommendationRequestWrapper` customization
can intercept the request and response. Recommendation-object fields beyond the core count/category mapping
belong to the backend or the selected plugin contract.

##### Services

`Breinify.service(service, payload, callback)` and `Breinify.service(service, payload, user, callback)` submit
a request to the service gateway. `service` is a nonempty service-token string, `payload` is a plain object,
and the optional `user` is a plain object. The library adds the resolved user to `payload.user`; explicit
`payload.user` values override the separate user argument and generated defaults. The supplied payload is copied.

**The callback is different from the other request methods:** `callback(error, progress, result)`.

* Running job: `(null, {progress, additionalData}, null)`; the library automatically polls again.
* Success: `(null, null, result)`.
* Failure: `(error, null, null)`, where the error may be an `Error` or a structured backend/transport value.

Polling uses the returned job ID, optional service URL, and `backOffInMs` (default `250` milliseconds).
The callback can run multiple times for progress before a terminal result. This API does not return a Promise
or expose a cancellation handle.

```javascript
// replace the token with one supplied by your service integration
const serviceToken = 'YOUR_SERVICE_TOKEN';
Breinify.service(serviceToken, {}, (error, progress, result) => {
  if (error != null) {
    console.error(error);
  } else if (progress !== null) {
    console.log('Service progress:', progress);
  } else {
    console.log('Service result:', result);
  }
});
```

##### Request builders

These exposed helpers prepare request data and invoke a callback; they do not send the network request.
They can still enrich users, access identifier storage, or resolve geolocation.

| Method | Callback/result |
| --- | --- |
| `Breinify.activityUser(user, type, category, description, tags, sign, onReady)` | `onReady(requestData)` containing `user`, `activity`, `apiKey`, `signature`, and `unixTimestamp`. |
| `Breinify.temporalDataUser(user, sign, onReady)` | `onReady(requestData)` containing the user, key, signature, and timestamp. |
| `Breinify.recommendationUser(user, settings, sign, onReady, preFunction)` | `onReady(requestData)` with `recommendation` or `recommendations`. Optional `preFunction(continueWith)` must invoke `continueWith`; `continueWith(false)` cancels creation. |
| `Breinify.serviceUser(service, payload, user, onReady)` | `onReady({requestData, servicePayload}, null)`, or `onReady(null, error)` on handled preparation failures. |

The first three builders can call back with `null` when preparation fails, such as when signing is requested
without a string secret. Invalid user/configuration fields may throw instead. They are callback APIs, not Promise APIs.

##### Error reporting

These methods report script errors as activities; a `true` result means reporting was initiated, not that the
server acknowledged it. Reporting depends on the configured error mapper and eligible source information.

| Method | Behavior |
| --- | --- |
| `Breinify.reportExecutionError(error, context)` | Preferred helper for caught execution defects. Requires a JavaScript `Error`, filters operational/configuration failures, deduplicates reports, and limits attempts to 20 per page URL. Returns a boolean. |
| `Breinify.handleCaughtError(error, context)` | Extracts the first eligible HTTPS stack frame on a single `*.breinify.com` subdomain and delegates to `handleError`. No shared reporting budget; use when the caller owns filtering and deduplication. Returns a boolean. |
| `Breinify.handleError(event, scriptSourceRegEx, scriptSettings, context)` | Low-level error-event mapping and `scriptError` activity submission. Returns `false` when no mapper is available or it declines the event. |

`reportExecutionError` retains string context fields `plugin`, `phase`, `webExperienceId`, `campaignWebExId`,
`module`, and `snippetId`. Expected service, network, validation, and permission failures should remain part of
normal application error handling. See [execution-error behavior](./plugins/ui-modify-content-errors.md).

#### Utilities (UTL)

The utility library provides general functionality, which makes it easy to retrieve values from, e.g., the url or cookies. In addition, it simplifies the retrieval of values from the DOM-tree or the handling of events.

##### Breinify.UTL (general functions)

* {string} **Breinify.UTL.trimQuotes(str, inclSingleQuotes)**:<br/>
  Trims a string by removing quotes, i.e. if *inclSingleQuotes* is *true* *"* and *'*, otherwise only *"*. It should be noted, that a value like "test' leads to test, if *inclSingleQuotes* is set to *true*.

  **Parameters**:

  {string} **str**: The string to be trimmed

  {boolean|null} **inclSingleQuotes**: `true` to remove surrounding single or double quotes; otherwise only double quotes are removed. Non-string input is returned unchanged.

  **Example Usage**:
    ```javascript
    const trimmedText = Breinify.UTL.trimQuotes('"Hello World"', false);
    console.log('"Hello World"', trimmedText);
    ```
    <br/>

* {string[]} **Breinify.UTL.texts(selector, excludeChildren)**:<br/>
  Gets the text of the elements selected by the specified *selector*.

  **Parameters**:

  {string|Element|jQuery} **selector**: The CSS-selector to specify the element(s) to read from (see [jQuery Selectors](https://api.jquery.com/category/selectors/) for a detailed overview of available selectors). In addition, the selector can also be a DOM-element.

  {boolean|null} **excludeChildren**: `true` (default) reads text and inline content while skipping ordinary block children; `false` also reads immediate block children and adds a newline after them. Inline content, inputs, and `<br>` elements receive special handling. Nested block descendants are not recursively included without limit.

  **Example Usage**:
  ```javascript
  const texts = Breinify.UTL.texts('ul li', false);
  console.log(texts);
  ```
  <br/>

* {string} **Breinify.UTL.text(selector, excludeChildren)**:<br/>
  Gets the text of the specified elements joined without a separator. Returns `''` when there are no text results.

  **Parameters**:

  {string|Element|jQuery} **selector**: The CSS-selector to specify the element(s) to read from (see [jQuery Selectors](https://api.jquery.com/category/selectors/) for a detailed overview of available selectors). In addition, the selector can also be a DOM-element.

  {boolean|null} **excludeChildren**: `true` (default) reads text and inline content while skipping ordinary block children; `false` also reads immediate block children and adds a newline after them. Inline content, inputs, and `<br>` elements receive special handling. Nested block descendants are not recursively included without limit.

  **Example Usage**:
  ```javascript
  const text = Breinify.UTL.text('input[name="name"]', false);
  console.log(text);
  ```
  <br/>

* **Breinify.UTL.setText(selector, value)**:<br/>
  Sets the value of selected inputs, or the text content of other selected elements. Returns `undefined`.

  **Parameters**:

  {string|Element|jQuery} **selector**: The CSS-selector to specify the element(s) to read from (see [jQuery Selectors](https://api.jquery.com/category/selectors/) for a detailed overview of available selectors). In addition, the selector can also be a DOM-element.

  {string} **value**: The text to be set.

  **Example Usage**:
  ```javascript
  Breinify.UTL.setText('input[name="name"]', 'Philipp');
  ```
  <br/>

* {string|null} **Breinify.UTL.md5(value)**:<br/>
  Returns the MD5 hash of the supplied string, or `null` for a null input.

  **Parameters**:

  {string|null} **value**: The value to be hashed.

  **Example Usage**:
  ```javascript
  const md5 = Breinify.UTL.md5('HELLO');
  window.alert(`The hashed value of "HELLO" is ${md5}`);
  ```
  <br/>

* {boolean} **Breinify.UTL.isEmpty(value)**:<br/>
  Checks if the passed *value* is empty. Empty has a different meaning for different types. An *object* is assumed to be empty:
    * if it is an object with no enumerable properties (including an empty array)
    * if it is a string equal to *''* after it is trimmed
    * if it is *null* or *undefined*

  **Parameters**:

  {mixed} **value**: The value to be checked.

  **Example Usage**:
  ```javascript
  Breinify.UTL.isEmpty({});     // returns true
  Breinify.UTL.isEmpty('    '); // returns true
  Breinify.UTL.isEmpty(null);   // returns true
  ```
  <br/>

* {boolean} **Breinify.UTL.isSimpleObject(obj)**:<br/>
  Checks if the passed object is a simple object, i.e., is *null* or *undefined*, or is a plain object without any function and just using simple types (e.g., *boolean*, *string*, *number*, *null*) or an array of simple types (all non-null entries must have the same type; null entries are allowed).

  **Example of a simple object**:
  ```javascript
  const simpleObject = {
    string: 'string',
    int: 5,
    double: 9.1,
    array: ['a', 'b', 'c'],
    null: null
  };
  ```

* {number} **Breinify.UTL.unixTimestamp()**:<br/>
  Returns the current Unix timestamp in whole seconds since the Unix epoch.

* {string|null} **Breinify.UTL.timezone()**:<br/>
  Returns the client’s timezone name, or `null` if it cannot be determined.

* {string} **Breinify.UTL.localDateTime()**:<br/>
  Returns the current local date and time using `new Date().toString()`.

* {boolean} **Breinify.UTL.endsWith(str, suffix)**:<br/>
  Checks if `str` ends with `suffix`.

* {mixed} **Breinify.UTL.getNested(obj, str1, str2, ...)**:<br/>
  Gets the value at `obj.str1.str2...` through plain objects and own properties. Returns `null` for missing or undefined values; it does not traverse arrays.

* **Breinify.UTL.deleteNullProperties(obj)**:<br/>
  Mutates the supplied plain object, recursively removing null properties and empty plain-object properties. It does not traverse arrays or remove undefined values. Returns `undefined` for a plain-object input; other inputs are returned unchanged.

* {string} **Breinify.UTL.uuid()**:<br/>
  Creates a randomly generated UUID-shaped string using `Math.random()`. It is not a cryptographic identifier.

* {string} **Breinify.UTL.capitalize(str)**, **Breinify.UTL.lowerize(str)**, and **Breinify.UTL.firstLetter(str, toLowerCase)**:<br/>
  Change only the first character's case, leaving the rest unchanged. `capitalize` uppercases it; `lowerize` lowercases it. `firstLetter` lowercases only when its second argument is `true`, otherwise it uppercases. Empty strings and non-string inputs are returned unchanged.

* {number} **Breinify.UTL.toNumber(value)**:<br/>
  Returns numeric inputs unchanged and parses signed integer or decimal strings (also `Infinity`). Invalid strings and non-number/non-string values return `NaN`; whitespace, exponent notation, and thousands separators are not accepted.

* {string|null} **Breinify.UTL.isNonEmptyString(value)**:<br/>
  Returns the trimmed string when it is nonempty, otherwise `null`. Despite its name, this method does not return a boolean.

* {number|null} **Breinify.UTL.toPrice(value)** and **Breinify.UTL.toInteger(value)**:<br/>
  Convert with `toNumber`, then round using `toFixed(2)` or `toFixed(0)` and return a number. Invalid conversions return `null`. `toInteger` rounds rather than truncating; `toPrice` does not preserve trailing zeros in its numeric result.

* {string|null} **Breinify.UTL.formatPrice(price, settings)**:<br/>
  Formats a price with two fraction digits. Settings default to `{locales: 'en-US', symbol: '$', symbolPosition: 'prefix'}`. Use `symbolPosition: 'suffix'` to append the symbol; other position values omit it. This legacy helper accepts numeric strings, uses permissive coercion, and writes defaults into the supplied settings object. Prefer `formatValue` for strict typed formatting and explicit currency codes.

* {boolean} **Breinify.UTL.equals(first, second)**:<br/>
  Compares plain objects recursively and arrays without regard to order, while respecting duplicate counts. Other values are compared using strict equality; cyclic structures are not supported.

```javascript
Breinify.UTL.capitalize('hello');                    // 'Hello'
Breinify.UTL.lowerize('Hello');                      // 'hello'
Breinify.UTL.firstLetter('hello', false);            // 'Hello'
Breinify.UTL.toNumber('12.5');                       // 12.5
Breinify.UTL.isNonEmptyString('  hello  ');          // 'hello'
Breinify.UTL.toPrice('12.345');                      // 12.35
Breinify.UTL.toInteger('12.6');                      // 13
Breinify.UTL.formatPrice(12.5);                      // '$12.50'
Breinify.UTL.equals({items: [1, 2]}, {items: [2, 1]}); // true
```

###### Duration formatting

`Breinify.UTL.formatDuration(value, unit, settings)` formats an integer duration as plain text using the same
flat settings as the SpEL duration formatter. Partial settings override defaults without modifying the supplied object.

```javascript
const settings = {smallestUnit: 'minutes', labelHours: ' hr', labelMinutes: ' min'};
Breinify.UTL.formatDuration(30, 'minutes', settings);  // '30 min'
Breinify.UTL.formatDuration(60, 'minutes', settings);  // '1 hr'
Breinify.UTL.formatDuration(90, 'minutes', settings);  // '1 hr 30 min'
Breinify.UTL.formatDuration(390, 'minutes', settings); // '6 hr 30 min'
Breinify.UTL.formatDuration(0, 'minutes', settings);   // '0 min'
Breinify.UTL.formatDuration(3601, 'seconds');         // '1h 1s'
Breinify.UTL.formatDuration(3601, 'seconds', {omitZeroUnits: false}); // '1h 0min 1s'
```

| Setting | Default | Meaning |
| --- | --- | --- |
| `largestUnit` | `'hours'` | Largest displayed unit; larger durations accumulate here. |
| `smallestUnit` | `'seconds'` | Smallest displayed unit; smaller remainders are discarded. |
| `labelDays` | `'d'` | Literal day suffix. |
| `labelHours` | `'h'` | Literal hour suffix. |
| `labelMinutes` | `'min'` | Literal minute suffix. |
| `labelSeconds` | `'s'` | Literal second suffix. |
| `labelMilliseconds` | `'ms'` | Literal millisecond suffix. |
| `labelDay`, `labelHour`, `labelMinute`, `labelSecond`, `labelMillisecond` | Unset | Optional suffix for a component of magnitude one; falls back to the corresponding plural-named label. |
| `unitSeparator` | `' '` | Text between components. |
| `omitZeroUnits` | `true` | Omit zero components; an entirely zero result still displays its smallest unit. |
| `locale` | `'en_US'` | Number locale; underscore/hyphen forms work. Null or empty uses the browser locale. |

Input units are case-insensitive plural names from days through nanoseconds. Output bounds support days through
milliseconds, with fixed 24-hour days. Labels preserve spaces. Singular labels apply to components of magnitude one,
including negative durations. Omitted or null singular labels fall back to the existing plural-named labels, preserving
existing output. Empty labels and separators are allowed. Negative durations have one leading minus sign; truncation
toward zero never produces a negative zero.

```javascript
const websiteSettings = {smallestUnit: 'minutes', labelHour: ' HR', labelHours: ' HRS', labelMinutes: ' MINS'};
Breinify.UTL.formatDuration(60, 'minutes', websiteSettings);  // '1 HR'
Breinify.UTL.formatDuration(120, 'minutes', websiteSettings); // '2 HRS'
Breinify.UTL.formatDuration(390, 'minutes', websiteSettings); // '6 HRS 30 MINS'
```

Omitted or null settings use defaults; unknown settings are ignored. Invalid values, units, bounds, selected labels,
separators, booleans, or locales return `null`. Numeric strings and fractional values are not coerced. Both the input
and its conversion to the smallest output unit must be safe JavaScript integers; unsafe conversions return `null`.
This differs from Java's arbitrary-precision intermediate conversion. HTML, recipe labels, and hiding zero durations
belong in the caller.

###### Typed value formatting

`Breinify.UTL.formatValue(value, formatter, options)` formats a typed value as plain text without modifying the value
or options. It is independent of Modify Content, Recommendations, and placeholder parsing. Existing `formatPrice`
behavior is unchanged.

```javascript
Breinify.UTL.formatValue(1234.567, 'number', {locale: 'en-US', decimalPlaces: 0}); // '1,235'
Breinify.UTL.formatValue(0.3, 'percent', {locale: 'en-US', decimalPlaces: 0}); // '30%'
Breinify.UTL.formatValue(1234.5, 'currency', {locale: 'en-US', currency: 'USD'}); // '$1,234.50'
Breinify.UTL.formatValue('social', 'upper', {locale: 'en-US'}); // 'SOCIAL'
Breinify.UTL.formatValue(['A', 'B'], 'join', {separator: ', '}); // 'A, B'
```

| Formatter | Accepted value | Options | Default precision / behavior |
| --- | --- | --- | --- |
| `number` | Finite number | `locale`, `decimalPlaces` | Grouping enabled, zero to three decimal places. |
| `percent` | Finite number representing a fraction | `locale`, `decimalPlaces` | Zero decimal places; `0.3` means 30%, not `30`. |
| `currency` | Finite number | `locale`, `decimalPlaces`, required `currency` | Uses the currency's `Intl.NumberFormat` minor-unit defaults when precision is omitted. |
| `upper` | String | `locale` | Locale-aware uppercase conversion. |
| `lower` | String | `locale` | Locale-aware lowercase conversion. |
| `join` | Array of strings, booleans, and/or finite numbers | Required `separator` | Joins scalar values without locale formatting; an empty array produces `''`. |

`options` may be omitted but must otherwise be a plain object. Only the listed options are accepted for each formatter.
Optional values set to `undefined` behave as omitted. `null` is not a valid option value.

* `locale`: a nonempty BCP 47 language-tag string without surrounding whitespace. Omission uses the browser's default
  locale. Well-formed but unavailable locales follow the browser's normal `Intl` fallback. Locale arrays are not supported.
* `decimalPlaces`: an integer from 0 through 20, inclusive. When supplied, sets both minimum and maximum fraction
  digits, including trailing zeros. Rounding affects display only.
* `currency`: an explicit three-letter currency code, case-insensitive. It is never inferred from locale or location.
  Codes are syntax-validated; recognition and display follow `Intl.NumberFormat`, not a separate currency catalog.
* `separator`: an explicit string, including `''` if desired. Sparse arrays, nested arrays, objects, missing array
  entries, and nonfinite numbers are rejected rather than silently stringified.

The return value is a string, or `null` when the input value is `null`/`undefined`. Formatter/options validation runs
even for missing values. Missing values never become zero; valid `0`, `false` array entries, and empty strings are not
treated as absent. Numeric strings and booleans are not coerced to numbers.

Invalid value types, option-object types, currency syntax, separators, and locale types throw `TypeError`. Unknown
formatters, unsupported option names, out-of-range/noninteger precision, and malformed language tags throw `RangeError`.
Consumers must handle errors and missing values explicitly; the utility does not decide rendering fallbacks.
Numeric formatting and explicit locale validation require browser `Intl.NumberFormat` support; no polyfill is bundled.

This method does not resolve `%%...%%` tokens, evaluate expressions, fetch data, or escape output. The caller is
responsible for destination-specific escaping and URL validation. A formatted string is not trusted HTML, CSS, or
JavaScript. Date/time formatting and formatter chaining are not supported. Recommendation and Modify Content
integration is consumer-specific; Modify Content uses it for its supported display fields, while other recommendation
renderers retain their existing behavior.

###### Placeholder utilities

`Breinify.UTL.placeholders` separates value resolution from execution-path selection. The caller must supply an
eligible context; these utilities do not decide which conditions matched or which action group was selected.

Modify Content reads backend condition `bindings` generically: Discovery owns the public namespace and field catalog.
New backend fields do not require a frontend catalog update. Each namespace must be a plain object containing safe
JSON-shaped values; invalid namespaces are discarded without changing the condition's match result. Valid bindings
are snapshotted and cached with that result, and only successful contributors to the selected path become available.

* `snapshot(value)` creates a deeply frozen copy of JSON-shaped data (maximum nesting depth 16). It rejects functions,
  nonfinite numbers, non-plain objects, and prototype-related keys. It does not mutate the input.
* `read(context, path)` reads a dotted path using own properties only. Missing values return `undefined`; malformed
  paths and `__proto__`, `constructor`, or `prototype` segments throw. Numeric segments support activation captures.
* `has(text)` detects a namespaced token opening. It is not a validation function.
* `render(text, context)` substitutes namespaced `%%path%%` tokens once, returning plain text. Unqualified tokens such
  as `%%name%%` remain unchanged for existing recommendation consumers. Missing values and invalid tokens/formatters
  throw; an unavailable value error carries `placeholderPath`. Arrays require an explicit `join` formatter.

```javascript
const context = Breinify.UTL.placeholders.snapshot({condition: {dataFeedMetric: {metricValue: 23}}});
const text = Breinify.UTL.placeholders.render(
    'Currently hot: %%condition.dataFeedMetric.metricValue | number:0%% purchases.', context);
```

Supported suffixes are `number[:decimalPlaces]`, `percent[:decimalPlaces]`, `currency:USD[:decimalPlaces]`, `upper`,
`lower`, and `join:", "`. Join separators use JSON string quoting/escaping; the token delimiter `%%` cannot occur in
an argument. Whitespace around the path and pipe is allowed. Tokens use the browser locale. Locale overrides are
available only through direct `formatValue` calls. Chaining and JavaScript expressions are not supported.

Values containing token-like text are never recursively evaluated. Output is not HTML-escaped: use text nodes or
appropriate destination validation. Modify Content additionally limits substitution to supported display fields and
uses text-node insertion inside configured HTML, rejecting tokens in attributes or executable/embedded markup.

##### Breinify.UTL.events

For simplicity the library provides the possibility to handle/react to specific events triggered by the DOM-tree. The following helpers register click handlers and DOM-ready callbacks.

* **Breinify.UTL.events.click(selector, func, onlyOnce)**:<br/>
  Registers a click handler on the elements currently matched by the selector.

  **Parameters**:

  {string|Element|jQuery} **selector**: The CSS-selector to specify the element(s) to listen for click-events (see [jQuery Selectors](https://api.jquery.com/category/selectors/) for a detailed overview of available selectors).

  {function} **func**: The function to execute when the event is captured. The function retrieves an *event* object which can be used to control the further processing. In addition, the handling function also has access to the DOM-element that the handler was bound to using `this` in a regular function, or `event.currentTarget` in an arrow function. For further details, have a look at [jQuery Event Handling](https://learn.jquery.com/events/inside-event-handling-function/).

  {boolean} **onlyOnce**: If `true`, runs the handler at most once per matched element (default: `false`).

  **Example Usage**:
  ```javascript
  Breinify.UTL.events.click('body', () => {
    window.alert('You clicked the document.');
  });
  ```
  <br/>

* **Breinify.UTL.events.pageloaded(func)**:<br/>
  Runs a callback when the DOM is ready, including when it is registered after DOM readiness. It does not wait for all images and other resources to finish loading.

  **Parameters**:

  {function} **func**: A jQuery ready callback. Its argument is the library's jQuery instance, not an event object.

  **Example Usage**:
  ```javascript
  Breinify.UTL.events.pageloaded(() => {
    window.alert('The document is ready.');
  });
  ```
  <br/>

##### Breinify.UTL.loc

The location part of the utilities contains functions to validate, match, or retrieve information from the url or parameters specified within.

* {object} **Breinify.UTL.loc.params(paramListSeparator, paramSeparator, paramSplit, url)**:<br/>
  Returns an object containing URL parameters. Repeated names keep the last value. With no explicit URL and default separators, it uses `URLSearchParams` on the current query string (including `+` decoding and empty values). Explicit URLs, custom separators, or browsers without `URLSearchParams` use the legacy parser: values are decoded with `decodeURIComponent`, and entries without exactly one value separator become `null`.

  **Parameters**:

  {string|null} **paramListSeparator**: The separator used to separate the list of parameters from the url (default: *?*).

  {string|null} **paramSeparator**: The separator used to separate the parameters from each other (default: *&*).

  {string|null} **paramSplit**: The separator used to split the name of the parameter and the value (default: *=*).

  {string|null} **url**: The url to read the parameters from (default: *Breinify.UTL.loc.url()*).

  **Example Usage**:
  ```javascript
  const params = Breinify.UTL.loc.params(null, null, null, 'https://example.com?q=hello%20world');
  window.alert(`The parameter "q" has the value: ${params.q}`);
  ```
  <br/>

* {boolean} **Breinify.UTL.loc.hasParam(param, paramListSeparator, paramSeparator, paramSplit, url)**:<br/>
  Checks whether the parsed URL contains a string-valued parameter. A legacy-parser entry with value `null` is not considered present.

  **Parameters**:

  {string} **param**: The parameter to look for.

  {string|null} **paramListSeparator**: The separator used to separate the list of parameters from the url (default: *?*).

  {string|null} **paramSeparator**: The separator used to separate the parameters from each other (default: *&*).

  {string|null} **paramSplit**: The separator used to split the name of the parameter and the value (default: *=*).

  {string|null} **url**: The url to read the parameters from (default: *Breinify.UTL.loc.url()*).

  **Example Usage**:
  ```javascript
  if (Breinify.UTL.loc.hasParam('q', '#', null, null, 'https://example.com#q=hello%20world')) {
    window.alert('The parameter "q" was specified.');
  }
  ```
  <br/>

* {boolean} **Breinify.UTL.loc.isParam(param, params)**:<br/>
  Checks whether `params` is a plain object with its own string-valued property named `param`.

  **Parameters**:

  {string} **param**: The parameter to look for.

  {object} **params**: The object with the parameters to check for the specified *param*.

  **Example Usage**:
  ```javascript
  const params = Breinify.UTL.loc.params(null, null, null, 'https://example.com?q=hello%20world');
  if (Breinify.UTL.loc.isParam('q', params)) {
    window.alert('The parameter "q" was specified.');
  }
  ```
  <br/>

* {boolean} **Breinify.UTL.loc.paramIs(expected, param, paramListSeparator, paramSeparator, paramSplit, url)**:<br/>
  Parses the parameter using the type of `expected`, then compares with strict equality (`===`).

  **Parameters**:

  {string|number|boolean} **expected**: The expected value of the parameter to look for.

  {string} **param**: The parameter to look for.

  {string|null} **paramListSeparator**: The separator used to separate the list of parameters from the url (default: *?*).

  {string|null} **paramSeparator**: The separator used to separate the parameters from each other (default: *&*).

  {string|null} **paramSplit**: The separator used to split the name of the parameter and the value (default: *=*).

  {string|null} **url**: The url to read the parameters from (default: *Breinify.UTL.loc.url()*).


  **Example Usage**:
  ```javascript
  if (Breinify.UTL.loc.paramIs(5, 'page', null, null, null, 'https://example.com?page=5')) {
    window.alert('The parameter "page" is a number with the value 5.');
  }
  ```
  <br/>

* {string|number|boolean|object|Array|null} **Breinify.UTL.loc.parsedParam(expectedType, param, paramListSeparator, paramSeparator, paramSplit, url)**:<br/>
  Parses a parameter as `number`, `string`, `boolean`, or `json`. Missing parameters, unsupported types, and invalid JSON return `null`. Invalid numeric strings return `NaN`. Boolean parsing returns `true` only for case-insensitive `"true"`; every other present string returns `false`.

  **Parameters**:

  {string} **expectedType**: The expected type: `number`, `string`, `boolean`, or `json`.

  {string} **param**: The parameter to look for.

  {string|null} **paramListSeparator**: The separator used to separate the list of parameters from the url (default: *?*).

  {string|null} **paramSeparator**: The separator used to separate the parameters from each other (default: *&*).

  {string|null} **paramSplit**: The separator used to split the name of the parameter and the value (default: *=*).

  {string|null} **url**: The url to read the parameters from (default: *Breinify.UTL.loc.url()*).

  **Example Usage**:
  ```javascript
  const page = Breinify.UTL.loc.parsedParam('number', 'page', null, null, null, 'https://example.com?page=search');
  if (page === null || Number.isNaN(page)) {
    window.alert('Invalid parameter information.');
  }
  ```
  <br/>

* {string|null} **Breinify.UTL.loc.param(param, paramListSeparator, paramSeparator, paramSplit, url)**:<br/>
  Gets a specific parameter from the url. The function returns *null*, if the parameter does not exist.

  **Parameters**:

  {string} **param**: The parameter to look for.

  {string|null} **paramListSeparator**: The separator used to separate the list of parameters from the url (default: *?*).

  {string|null} **paramSeparator**: The separator used to separate the parameters from each other (default: *&*).

  {string|null} **paramSplit**: The separator used to split the name of the parameter and the value (default: *=*).

  {string|null} **url**: The url to read the parameters from (default: *Breinify.UTL.loc.url()*).

  **Example Usage**:
  ```javascript
  const page = Breinify.UTL.loc.param('page', null, null, null, 'https://example.com?page=search');
  window.alert(`The parameter "page" has the value "${page}".`);
  ```
  <br/>

* {string} **Breinify.UTL.loc.url()**:<br/>
  Gets the current url.

  **Example Usage**:
  ```javascript
  const url = Breinify.UTL.loc.url();
  window.alert(`You are visiting: "${url}".`);
  ```
  <br/>

* {object|null} **Breinify.UTL.loc.extract(url)**:<br/>
  Tries to extract the parts `full`, `protocol`, `port`, `username`, `password`, `domain`, `path`, and `parameters`
  from a URL using a legacy regular expression. Returns `null` when the expression does not match; absent components are `null`, and `port` is a number. This is not a general URL validator.

  **Parameters**:

  {string} **url**: The url to extract the information from.

  **Example Usage**:
  ```javascript
  const extract = Breinify.UTL.loc.extract('https://example.com');
  console.log(extract?.domain);
  ```
  <br/>

* {Array|null} **Breinify.UTL.loc.matches(regEx)**:<br/>
  Returns the match array for the current URL, or `null` when it does not match.

  **Parameters**:

  {string|RegExp} **regEx**: The regular expression used for matching.

  **Example Usage**:
  ```javascript
  if (Breinify.UTL.loc.matches(/^https?:\/\/product\.shop\.com(?:[/:?#]|$)/)) {
    window.alert('Welcome to our product list.');
  }
  ```
  <br/>

##### Breinify.UTL.cookie

The cookie part of the utilities contains functions to validate, match, or retrieve information from the available cookies.

* {object} **Breinify.UTL.cookie.all()**:<br/>
  Gets all the cookies currently defined and accessible.

  **Example Usage**:
  ```javascript
  const cookies = Breinify.UTL.cookie.all();
  window.alert(`The following cookies were found: ${JSON.stringify(cookies)}`);
  ```
  <br/>

* **Breinify.UTL.cookie.reset(name, domain)**:<br/>
  Expires the cookie for the current default path and `/`. Pass the same domain used when setting it; cookies on other paths may need separate removal.

  **Parameters**:

  {string} **name**: The name of the cookie to be removed.
  {string|null} **domain**: Optional cookie domain. If omitted, no Domain attribute is written (a host-only cookie).

  **Example Usage**:
  ```javascript
  Breinify.UTL.cookie.reset('myFunnyCookie');
  ```
  <br/>

* **Breinify.UTL.cookie.set(name, value, expiresInDays, global, domain, httpsOnly, sameSite)**:<br/>
  Sets a cookie without encoding its name or value. Use `encodeURIComponent` and `decodeURIComponent` when storing values that need encoding.

  **Parameters**:

  {string} **name**: The name of the cookie to be set.

  {string} **value**: The value to be set for the cookie.

  {number|null} **expiresInDays**: The time (in days) after which the cookie expires (default `Session` cookie). If a negative value is passed in, the cookie will be removed.

  {boolean} **global**: If `true`, sets `Path=/`; otherwise omits Path and uses the browser’s default cookie path (default: `false`).

  {string|null} **domain**: Optional cookie domain. If omitted, no Domain attribute is written (a host-only cookie).

  {boolean|null} **httpsOnly**: Overrides the Secure attribute; otherwise uses `config().cookieHttpsOnly` (default: `true`).

  {string|null} **sameSite**: Overrides SameSite with a nonempty string; otherwise uses `config().cookieSameSite` (default: `'none'`). The default cookie settings are intended for HTTPS pages.

  **Example Usage**:
  ```javascript
  Breinify.UTL.cookie.set('myFunnyCookie', 'A year of fun!', 365);
  ```
  <br/>

* {string|null} **Breinify.UTL.cookie.get(name)**:<br/>
  Gets the value of the cookie with the specified name, if no such cookie exists *null* is returned.

  **Parameters**:

  {string} **name**: The name of the cookie to look up.

  **Example Usage**:
  ```javascript
  Breinify.UTL.cookie.get('myFunnyCookie');
  ```
  <br/>

* {boolean} **Breinify.UTL.cookie.check(name)**:<br/>
  Checks if a cookie is currently set or not.

  **Parameters**:

  {string} **name**: The name of the cookie to look up.

  **Example Usage**:
  ```javascript
  if (!Breinify.UTL.cookie.check('myFunnyCookie')) {
    window.alert('Is the funny session over or did it never start?');
  }
  ```
  <br/>

##### Internal jQuery instance

* {function} **Breinify.UTL._jquery()**:<br/>
  Returns the jQuery instance used internally by the library.

  **Example Usage**:
  ```javascript
  const $ = Breinify.UTL._jquery();
  ```
  <br/>

##### Additional utility methods

All names in this section are relative to `Breinify.UTL`. These complement the detailed helpers above.
`UTL.cookies` contains the internal storage-key names `sessionId`, `browserId`, `referrerKey`, and
`delayedActivities`; `UTL.constants.errors.prefix` contains diagnostic prefixes `validation`, `api`, and `assets`.

| Method | Behavior |
| --- | --- |
| `select(selector, childSelector, directChild)` | Returns the internal jQuery selection of matching descendants, or direct children when `directChild === true`. |
| `ensureSimpleObject(value)` | Returns a normalized plain object suitable for tags. Null/non-plain inputs become `{}`; unsupported values and incompatible array entries become `null`. |
| `getNestedByPath(object, path)` | Dotted-path counterpart to `getNested`; traverses plain objects and returns `null` for missing/undefined values. |
| `localString(date, options)` | Calls `date.toLocaleString('en-US', options)` with defaults `year: 'numeric'`, `month/day: '2-digit'`, `hour12: false`, and `timeZone: 'UTC'`. Pass a `Date`. |
| `extend(target, ...sources)` | Mutates and returns `target`, recursively merging plain objects and skipping null/undefined source values. Arrays and other values are assigned directly. |
| `bindjQueryPlugins(plugins, jQuery)` | Runs named plugin functions with the supplied jQuery instance (default: the internal one), temporarily assigning it to `window.jQuery`. |
| `loc.createGetParameter(value)` | JSON/base64 encodes a value into Breinify's dot-prefixed URL-parameter format. Returns `null` if encoding fails, including unsupported input for `btoa`. |
| `loc.parseGetParameter(name, value)` | Decodes Breinify parameter data or legacy URI-encoded base64 JSON. `name` is currently unused. Returns `null` for invalid base64/JSON; malformed URI escaping in legacy input may throw. |
| `cookie.setJson(name, object, expiresInDays, global, domain, httpsOnly)` | Encodes a plain object as base64 JSON in a cookie. Non-plain inputs or encoding errors reset the cookie. Some Unicode characters are converted to numeric HTML entities. |
| `cookie.getJson(name)` | Decodes a JSON cookie; returns `null` when absent or invalid. It does not reverse the HTML-entity conversion performed by `setJson`. |
| `cookie.domain()` | Returns a cached domain derived from `cookieDomain` or a hostname heuristic, or `null`. This is not a public-suffix parser. |
| `events.observeDomChange(selector, callback)` | Polls every 50 ms for matching elements and calls `callback($element)` for unmarked elements. Returns an observer ID. A shared `data-brnfy-observation-triggered` marker means overlapping observers can affect one another. |
| `events.removeDomObserver(id)` | Removes one polling observer and stops the timer if no observers remain. |
| `events.removeAllDomObserver()` | Removes all polling observers and stops the timer. Existing element markers remain. |
| `placeholders.format(value, expression)` | Applies one supported placeholder formatter suffix, such as `'number:0'` or `'join:", "'`, directly to a value. Invalid expressions or inputs throw. |

###### DOM utilities

These methods are relative to `Breinify.UTL.dom`. `$element` and `$anchor` mean jQuery objects from
`Breinify.UTL._jquery()`.

| Method | Behavior |
| --- | --- |
| `isNodeType(element, nodeTypes)` | Checks a DOM node or every node in a nonempty jQuery selection against a node-type number or array of numbers. Returns a boolean. |
| `getTagName($element)` | Returns the lowercase tag name, or `'no tag'` when unavailable. |
| `determineElementType($element, mapper)` | Returns a descriptive element category; an optional `mapper(tagName, $element)` can override it with a nonempty string. |
| `attachByOperation(operation, $anchor, $element)` | Applies `replace`, `before`, `after`, `prepend`, or `append`. Returns whether the operation was applied. |
| `applyContentByOperation(operation, $anchor, content, allowHtml)` | Also supports `replaceContent`, requires one anchor, and inserts string content as text unless `allowHtml === true`. Node/jQuery content is accepted for structural operations, but not `replaceContent`. Returns a boolean. |
| `addModification(id, modification)` | Registers `{selector, preCondition, modifier}` for DOM observation. Optional `preCondition($elements)` gates execution; `modifier($elements)` must return `true` to mark the modification as applied. |
| `removeModification(id)` | Removes the registered modification; it does not undo existing DOM changes. |
| `addClassChangeObserver($elements, callback)` | Immediately reports initial classes, then class changes through `callback(null, {el, modified, addedClasses, removedClasses})`. |
| `addClickObserver(selector, name, settings, callback)` | Registers a delegated click callback for present/future matching elements. `settings` defaults to `{allowMultiFire: false, useCapture: false}`; it may be omitted by passing the callback third. The callback receives `(event, {triggered, selector, name})`. Registration with an existing selector/name replaces that callback. |

###### Logging and data-layer integration

* `Breinify.UTL.out.log(level, message, ...values)` logs in development mode. The convenience methods
  `out.error`, `out.warn`, `out.info`, `out.debug`, and `out.trace` accept a message and additional values.
  Logging is suppressed outside development mode.
* `Breinify.UTL.out.normalizeErrorMessage(error)` converts errors or other values into diagnostic text.
* `Breinify.UTL.google.addDataLayerEventListener(name, listener, replayExisting)` registers a named listener
  for `window.dataLayer` pushes. The listener is either `(name, event) => { ... }` or an object with
  `handle(name, event)` and optional `filter(name, event)` functions. An object filter must return `true`
  to deliver the event. `replayExisting === true` also delivers existing entries. The helper waits up to
  approximately ten seconds for a data layer to appear. A fourth `checkTime` parameter is used internally
  for retries; omit it in application calls.

##### User, storage, and integration utilities

###### User utilities

These methods are relative to `Breinify.UTL.user`.

| Method | Behavior |
| --- | --- |
| `create(user)` | Returns merged user data from configured defaults, generated identifiers, customization lookup, and the explicit user (highest priority). This can read/write identifier storage; the `BreinifyUser` constructor adds further browser context. |
| `getBrowserId()` | Reads or creates the persisted browser identifier and caches it in memory. |
| `getSessionId()` | Reads or creates the session identifier and caches it in memory. |
| `resetSessionId(reset)` | Generates a new ID when `reset === true` or no ID is cached, persists it, and returns it. |
| `getMarkerSessionId()` | Returns the nonempty `br-msid` URL parameter, or `null`. |
| `determineApiVersion()` | Returns `Breinify.plugins.api.version` when available, otherwise `'n/a'`. This is separate from `Breinify.version`. |
| `getSplitTestData()` | Returns stored assignments, removing entries with expired/missing timestamps and expired preview assignments. Reads do not renew them. |
| `replaceSplitTestData(name, assignment)` | Replaces one named assignment and updates `testName` and `lastUpdated`. Also accepts a single assignment object containing `testName`. |
| `updateSplitTestData(assignments)` | Replaces all stored split-test data. |
| `createSplitTestActivityTag(assignment)` | Returns `'testName (selectedInstance)'`, the bare test name if the instance is missing, or `null` without a test name. |
| `applySplitTestTags(tags, assignment, defaults)` | Mutates and returns the supplied tags, setting `splitTest`, `group`, and `groupType` from the captured assignment. Does not read stored assignments. See [split-test attribution](../README.md#split-test-activity-attribution). |
| `getReferrerData(sessionId)` | Returns session-entry `{entryUrl, entryReferrer, distance}` or `null` when `handleReferrer` is disabled. It persists journey state and increases distance when the page URL changes. |

###### Storage utilities

`Breinify.UTL.storage` provides direct local/session/memory access through `getItem`, `setItem`, `removeItem`,
`getJson`, `setJson`, `keys`, and `entries`. These methods need no initialization. `getJson` throws read/parse
errors unless an explicit fallback is supplied. `storage.cookie` aliases `UTL.cookie`. See
[browser storage](storage.md) for signatures, examples, and the inventory of stored data.

The existing named JSON cache below uses local storage when available, with an in-memory fallback when
storage cannot be obtained. Initialize this cache before reading or writing. Storage access and malformed
stored JSON can throw; these helpers do not universally suppress browser-storage errors.

| Method | Behavior |
| --- | --- |
| `storage.init(entries, callback)` | Initializes storage and loads missing/expired named entries. Each entry uses `{values, expiresInSec}` or `{loader, expiresInSec}`; a loader calls `done(error, data)`. Completion is `callback(null, {loaded, failed})`. |
| `storage.load(name, entry, callback)` | Loads one entry; completion is `callback(error, name)` on the normal loader/value path. |
| `storage.update(name, expiresInSec, data)` | Stores JSON under `breinify-<name>` with a creation time and expiry. Returns no value and does nothing before initialization. |
| `storage.get(name)` | Returns stored data or `null`; **does not check expiry**. |
| `storage.isExpired(name)` | Checks the stored expiry; missing/uninitialized entries are expired. Nonpositive lifetimes are stored with expiry `-1` and are therefore considered expired by this method. |
| `storage.getOrWait(name, callback, timeout)` | Polls every 50 ms until `get` returns a non-null value or the timeout is exceeded. Uses `callback(error, data)`. Pass an explicit timeout in milliseconds; the fourth `waitedFor` argument is internal. |
| `storage.createStorableData(expiresInSec, data)` | Returns the JSON storage envelope `{expires, created, data}`. |

Anonymous identifier storage is private implementation state. It is not exposed as `UTL.browserStorage` or
`UTL.cookieStorage`; use the user-identifier methods above. The named cache uses seconds for expiry, while
the public cookie setter uses days.

###### Consent

`Breinify.UTL.consent` exposes `configure(settings)`, `evaluate(feature, callback)`,
`isGranted(feature, onGranted, onDenied)`, and
`onChange(listener)`. Configuration selects a provider and timeout, evaluation resolves an immutable
feature decision with `granted`, `userData`, and `storage` permissions. Observation reports normalized
CMP permissions and returns an unsubscribe function. `isGranted` invokes `onGranted(decision)` only when
the feature is granted, otherwise the optional `onDenied(decision)`. Neither runs while consent is unknown.
Both decision methods require a registered feature and return no value synchronously.

The frozen `consent.levels` object defines `CONTENT`, `FUNCTIONAL`, `ANALYTICS`, and `PERSONALIZATION`.
Functional is independent; Personalization requires Analytics. The frozen `consent.features` object
identifies supported operations, including recommendations, Modify Content, temporal-data, immediate/delayed
activities, and presentation storage. Levels belong in feature/storage requirements; passing a level
instead of a feature is rejected. Customer overrides and storage dependencies apply even after timeout.
These decisions do not yet gate existing requests, user creation, cookies, storage, or plugins automatically.
See the [consent contract](./consent.md) for defaults, overrides, and integration boundaries.

#### Constructors and plugins

The library exposes these constructors for integrations that need its model objects:

| Constructor | Instance methods |
| --- | --- |
| `new Breinify.BreinifyUser(user, onReady)` | `set(attribute, value)`, `setAll(user)`, `get(attribute)`, `reset(attribute)`, `all()`, `validate()`, `add(key, value)` or `add(object)`, `read(key)`, and `addGeoLocation(onReady)`. See [user fields](./user.md). `add`/`read` operate on `additional`. |
| `new Breinify.BreinifyConfig(config)` | `get(attribute)`, `set(attribute, value)`, `all()`, `default(attribute)`, and `validate(force)`. Constructing one does not install it globally; use `setConfig` to do that. |
| `new Breinify.AttributeCollection()` | Schema helpers `add(key, setting)`, `all()`, `defaults()`, `default(attribute)`, `is(attribute)`, `setting(attribute)`, `group(groupId)`, `validate(attribute, value)`, and `validateProperties(object)`. Primarily used by the library's models. |

`Breinify.BreinifyUser.ATTRIBUTES` and `Breinify.BreinifyConfig.ATTRIBUTES` map symbolic names to property
keys; `Breinify.BreinifyConfig.CONSTANTS` includes customization identifiers. Model `all()` methods expose
the current backing object rather than a defensive copy. Validation may throw.

`Breinify.plugins` contains plugins only after their separate scripts have loaded. Plugins added through
the standard registry receive `setConfig(object)` or `setConfig(key, value)` and `getConfig(key, fallback)`.
Unlike core `Breinify.setConfig`, the standard plugin setter merges supplied keys. Methods beginning with
`_` on the registry are lifecycle/customization internals, not a general application API.

Plugin contracts are separate from this core reference. Available focused guides include
[Modify Content errors](./plugins/ui-modify-content-errors.md), [surveys](./plugins/ui-survey.md), and
[custom survey pages](./plugins/ui-survey-custom-pages-api.md). Other plugin implementations are in
[`src/plugins`](../src/plugins); this page does not claim complete documentation of each plugin's methods.
