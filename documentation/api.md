<p align="center">
  <img src="https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/documentation/img/logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

<p align="center">
Breinify's DigitalDNA API puts dynamic behavior-based, people-driven data right at your fingertips.
</p>

### API Library Documentation

The library provides several attributes, methods, and objects to simplify the usage of the Breinify API. Besides methods to actually send or retrieve data, it also includes general information (e.g., about the version and used configuration), as well as utilities. Thus, the following documentation is organized in three sections: *General Information*, *API*, and *Utilities (UTL)*.

#### General Attributes

* {string} **Breinify.version**:<br/>
  Contains the current version of the usage library. If an error occurred while loading the library, the version is set to be *'FALLBACK'*.

  **Example Usage**:
  ```javascript
  window.alert('The current version of the library is: ' + Breinify.version);
  ```
  <br/>

* {object} **Breinify.config()**:<br/>
  Retrieves the current configuration of the library. The following JSON is a sample object return by this function.

  ```javascript
  {
    activityEndpoint: '/activity',
    apiKey: '0000-0000-0000-0000-0000-0000-0000-0000',
    category: 'other',
    lookupEndpoint: '/lookup',
    secret: null,
    timeout: 1000,
    url: 'https://api.breinify.com',
    validate: true
  }
  ```

  **Example Usage**:
  ```javascript
  $.each(Breinify.config(), function (property, value) {
    console.log('The configuration property "' + property + '" has the value "' + value + '".')
  });
  ```
  <br/>

* **Breinify.setConfig(config)**:<br/>
  Contains the current version of the usage library. If an error occurred while loading the library, the version is set to be *'FALLBACK'*.

  **Parameters**:

  {object} config: a plain object specifying the configuration properties to be set


  **Example Usage**:
  ```javascript
  Breinify.setConfig({
    apiKey: '23AD-F31F-F324-6666-AC2D-C526-D829-BBC2'
  });
  ```
  <br/>

##### Example Usage

#### API

#### Utilities (UTL)

    Breinify.activityUser = function (user, type, category, description, sign, onReady) {
        if (typeof onReady === 'function') {
            onReady();
        }
    };
    Breinify.activity = function (user, type, category, description, sign, onReady) {
        if (typeof onReady === 'function') {
            onReady();
        }
    };
    Breinify.lookupUser = function (user, dimensions, sign, onReady) {
        if (typeof onReady === 'function') {
            onReady();
        }
    };
    Breinify.lookup = function (user, dimensions, sign, onLookUp) {
        if (typeof onLookUp === 'function') {
            onLookUp();
        }
    };
    Breinify.unixTimestamp = function () {
        return Math.floor(new Date().getTime() / 1000);
    };
    Breinify.UTL = {
        loc: {
            params: function () { return []; },
            hasParam: function() { return false; },
            isParam: function() { return false; },
            paramIs: function() { return false; },
            parsedParam: function() { return null; },
            param: function() { return null; },
            url: function() { return window.location.href; },
            matches: function() { return false; }
        },
        cookie: {
            all: function () { return []; },
            set: function() {},
            reset: function() {},
            get: function() { return null; },
            check: function() { return false; },
        },
        events: {
            click: function() {},
            pageloaded: function() {}
        },
        texts: function() { return []; },
        text: function() { return null; },
        md5: function () { return null; },
        isEmpty: function() { return false; }
    };