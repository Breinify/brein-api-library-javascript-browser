<p align="center">
  <img src="https://www.breinify.com/img/Breinify_logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

# Breinify's API Library [![](https://data.jsdelivr.com/v1/package/npm/breinify-api/badge)](https://www.jsdelivr.com/package/npm/breinify-api)
[![Bower version](https://badge.fury.io/bo/breinify-api.svg)](https://badge.fury.io/bo/breinify-api)
[![npm version](https://badge.fury.io/js/breinify-api.svg)](https://badge.fury.io/js/breinify-api)
[![MIT licensed](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/hyperium/hyper/master/LICENSE)
<sup>Features: **Temporal Data**, **(Reverse) Geocoding**, **Events**, **Weather**, **Holidays**, **Analytics**</sup>

This library utilizes [Breinify's API](https://www.breinify.com) to provide tasks like `geocoding`, `reverse geocoding`, `weather and events look up`, `holidays determination` through the API's endpoints, i.e., `/activity` and `/temporaldata`. Each endpoint provides different features, which are explained in the following paragraphs. In addition, this documentation gives detailed examples for each of the features available for the different endpoints.

**Activity Endpoint**: The endpoint is used to understand the usage-patterns and the behavior of a user using, e.g., an application, a mobile app, or a web-browser. The endpoint offers analytics and insights through Breinify's dashboard.

**TemporalData Endpoint**: The endpoint offers features to resolve temporal information like a timestamp, a location (latitude and longitude or free-text), or an IP-address, to temporal information (e.g., timezone, epoch, formatted dates, day-name),  holidays at the specified time and location, city, zip-code, neighborhood, country, or county of the location, events at the specified time and location (e.g., description, size, type), weather at the specified time and location (e.g., description, temperature).

## Running tests

The `test` task runs `dist` → `test-setup` → `test-run`. Specs test the generated distribution
in headless Chromium. Use Node.js 20 or newer.
The project directory is the checkout containing **this README, `package.json`, and `gruntfile.js`**.
The test task prints the full path to its `gruntfile.js` whenever setup is missing.

### IntelliJ: setup and everyday use

No `npx` or globally installed Grunt is required.

1. Open this project's `gruntfile.js` in IntelliJ's Grunt tool window. Refresh its task list if
   `test` or `test-run` is not yet visible.
2. For a fresh checkout, install the dependencies in `package.json` using IntelliJ's configured
   Node interpreter and package manager.
3. Run **`test`**. It resolves browser library dependencies through `dist`, builds the distribution,
   ensures the matching Chromium browser is installed, and runs the specs. The first browser download
   needs internet access and can take several minutes; later runs reuse it.

You can still run **`test-setup`** separately to prepare the browser. For a quick repeat against an
already built distribution, use **`test-run`**. It skips rebuilding and setup, so source edits require
another `test` run before they are covered. Use the same Node interpreter and environment throughout.

To run fewer tests, add `--spec=UiModifyContent` or `--spec=specs/Breinify-spec.js` to the Grunt run
configuration's arguments. This is a case-sensitive substring filter on spec file paths.

### Terminal use without npx

A missing-browser error prints a complete command with the **actual Node executable, local Grunt
CLI, and absolute gruntfile path**. Paste that command into a terminal: it works from any directory
and requires neither `node` nor `npx` on PATH. After setup succeeds, the output prints the equivalent
command to run the tests.

If Node is already on PATH, the shorter equivalents below work from the project directory:

```sh
node node_modules/grunt/bin/grunt test
node node_modules/grunt/bin/grunt test --spec=UiModifyContent
```

`npm test` is also available when npm is on PATH. These commands assume the dependencies in
`package.json` have been installed as described above.

### If the task fails

- **Test browser is not installed / Executable doesn't exist:** run `test-setup` in IntelliJ,
  wait for `Browser ready`, then rerun `test`. Alternatively, paste the complete terminal command
  printed in the error. No specs have run when this error appears.
- **Missing distribution files:** run `test` instead of `test-run` to rebuild and prepare everything.
- **A build or dependency step fails:** fix the reported `dist`/`dep` error, then rerun `test`; the specs have not started.
- **A spec fails:** the output lists the failing spec and assertion. Detailed results, including
  stack traces, are in `target/test-results.json`. Fix the failure and rerun that file using `--spec`.
- **A file times out:** the default limit is 60 seconds. Add `--test-timeout=120000` to the Grunt
  arguments to allow 120 seconds per file for a deliberately longer suite.

Do not use `--force` to bypass failures; it does not fix setup or failing tests.
On Linux CI, install the browser's system dependencies by running the local Playwright CLI with
`install --with-deps --only-shell chromium` before running the tests.

### Test isolation and results

Each spec file gets a fresh browser context with isolated storage, cookies, and SDK instances.
Plugin specs receive the SDK's jQuery as a local `$` variable; it is not exposed on the page globally.
Non-fixture browser requests are blocked, so tests must mock calls to live services.

The task exits nonzero for failed specs, browser errors, timeouts, or an empty file selection.
Pending specs are counted separately. The `test` task regenerates `dist` through the existing build tasks;
`test-run` reads those generated files without changing them. Both the core bundle and plugins are
loaded from the unminified distribution files.

## Getting Started

For feature-based experiences, see [Feature resolution and UI configuration](../../brein-external/brein-external-script-creator/docs/feature-definitions.md#waiting-for-freshness-when-using-a-feature)
for waiting on current-page observations while retaining persisted values.

### Retrieving an API-Key

First of all, you need a valid API-key, which you can get for free at [https://www.breinify.com](https://www.breinify.com). In the examples, we assume you have the following api-key:

**938D-3120-64DD-413F-BB55-6573-90CE-473A**

### Including the Library

The library can be added as script, using:

```html
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/breinify-api@1.0.15/dist/breinify-api.min.js"></script>
```

If you want to use the most current **snapshot** version (only recommended for development purposes), you can also use:

```html
<script type="text/javascript" src="https://rawgit.com/Breinify/brein-api-library-javascript-browser/master/dist/breinify-api.min.js"></script>
```

If you prefer to use **bower** the newest version can be installed using:

```bash
bower install breinify-api --save
```

## Activity: Selected Usage Examples

The endpoint is used to track the usage of, e.g., an application, an app, or a web-site. There are several libraries available to be used for different system (e.g., [iOS](https://github.com/Breinify/brein-api-library-ios), [Android](https://github.com/Breinify/brein-api-library-android), [Java](https://github.com/Breinify/brein-api-library-java), [nodeJs](https://github.com/Breinify/brein-api-library-node), [ruby](https://github.com/Breinify/brein-api-library-ruby), [php](https://github.com/Breinify/brein-api-library-php), [python](https://github.com/Breinify/brein-api-library-python)).

### Track jsFiddle Usage

The [jsFiddle (ojkvwwd9)](https://jsfiddle.net/breinify/ojkvwwd9/) shows how to use the endpoint to track the usage of this specific fiddle. There are plenty more use-cases in which the tracking of activities can be useful to understand and enhance a service. There are also several more possibilities on how to add identification, descriptions, categories, or tags. Have a look at the [additional documentation](#further-links).

## TemporalData: Selected Usage Examples

### Retrieve Client's Information (Location, Weather, Events, Timezone, Time)

The endpoint is capable to retrieve some information about the client, based on client specific information (e.g., the IP-address). The first example uses this information to retrieve some information, like the weather, events, or the timezone.

<p align="center">
  <img src="https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/documentation/img/sample-text.png" alt="Client Information" width="500"><br/>
  <sup>This is a screenshot of the jsFiddle (3wz4u5d1) created on the 29/03/2017 at 8:54 p.m.</sup>
</p>

The whole information is retrieved using the following simple JavaScript (see also [jsFiddle (3wz4u5d1)](https://jsfiddle.net/breinify/3wz4u5d1/)):

```javascript
Breinify.setConfig({ 'apiKey': '938D-3120-64DD-413F-BB55-6573-90CE-473A' });
Breinify.temporalData(function(data) {
	document.getElementById('result').innerHTML = createText(data);
});
```

### Geocoding (resolve Free-Text to Locations)

The library enables you to use the geocoding feature of the `temporalData` endpoint by passing a free-text and resolving it
to an associated location.

```javascript
var loc = {
  text: 'NYC'
};

Breinify.temporalData({ additional: { location: loc }}, false, function(data) {
    // use the returned data
});
````

The endpoint will return the specific information to the defined location (i.e., the city, the state, and coordinates as 
latitude/longitude pair). A more advanced example can be found at the [jsFiddle (egyhn5fz)](https://jsfiddle.net/breinify/egyhn5fz/).

<p align="center">
  <img src="https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/documentation/img/sample-geocoding.png" alt="Geocoding" width="500"><br/>
  <sup>Screenshot of the sFiddle (egyhn5fz) resolving the texts: `NYC`, `San Francisco`, `Dallas`, `Miami`, `Bemidji`</sup>
</p>


### Reverse Geocoding (retrieve GeoJsons for, e.g., Cities, Neighborhoods, or Zip-Codes)

The `temporalData` endpoint enables you to perform reverse geocoding. To do so, simple pass in the known latitude and longitude
into the request.

```javascript
var loc = {
  latitude: 37.7609295,
  longitude: -122.4194155
};

Breinify.temporalData({ additional: { location: loc }}, false, function(data) {
    // use the returned data
});
````

If you like to get further information or even visualize the country, county, city, or neighborhood the location is in, it
is possible to ask for appropriate geoJson instances and utilize them directly in, e.g., [leafLet](http://www.leafletjs.com).

```javascript
var loc = {
  latitude: latLon[0],
  longitude: latLon[1],
  shapeTypes: ['CITY', 'NEIGHBORHOOD']
};

Breinify.temporalData({ additional: { location: loc }}, false, function(data) {
    // use the returned data
});
````

Have a look at [jsFiddle (qq4ryw6y)](https://jsfiddle.net/breinify/qq4ryw6y/) for a complete example.

<p align="center">
  <img src="https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/documentation/img/sample-geojson.png" alt="Reverse Geocoding" width="500"><br/>
  <sup>This is a screenshot of the jsFiddle (qq4ryw6y), utilizing leafLet to visualize the resolved geoJsons</sup>
</p>

## Limitations

The open `/temporalData` endpoint is limited to US specific locations only. Furthermore, weather specific data is only available for the years 2016 and later.

## Further links

To understand all the capabilities of Breinify's API, you can find further information:
- the [library documentation](documentation/api.md),
- the [full API documentation](https://www.breinify.com/documentation/index.html),
- [Breinify's Website](https://www.breinify.com).
