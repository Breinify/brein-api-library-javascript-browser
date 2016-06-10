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

  **Configuration Properties**:

  **{string} activityEndpoint**: The end-point of the API to send activities.

  **{string} apiKey**: The API-key to be used (mandatory).

  **{string} lookupEndpoint**: The end-point of the API to retrieve lookup results.

  **{string} secret**: The secret attached to the API-key (should always be null utilizing this type of library).

  **{number} timeout**: The maximum amount of time in milliseconds an API-call should take. If the API does not response after this amount of time, the call is cancelled.

  **{string} url**: The url of the API.

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

  **{object} config**: A plain object specifying the configuration properties to be set. If the validation of the configuration is activated, the passed values will be validated and an *Error* will be thrown, if the specified configuration property is invalid.

  **Example Usage**:
  ```javascript
  Breinify.setConfig({
    apiKey: '23AD-F31F-F324-6666-AC2D-C526-D829-BBC2'
  });
  ```
  <br/>

#### API

* **Breinify.activity(user, type, category, description, sign, onReady)**:<br/>
  Sends an activity to the engine utilizing the API. The call is done asynchronously as POST request. It is important, that a valid API-key is configured prior to using this function.

  **Parameters**:

  **{object} user**: A plain object specifying the user information the activity belongs to. More information about the structure can be found [here](TODO).

  **{string|null} type**: The type of the activity collected, i.e., one of *search*, *login*, *logout*, *addToCart*, *removeFromCart*, *checkOut*, *selectProduct*, or *other*. If not specified, the default *other* will be used.

  **{string|null} category**: The category of the platform/service/products, i.e., one of *apparel*, *home*, *education*, *family*, *food*, *health*, *job*, *services*, or *other*. If not specified, the configured type (see *Breinify.config().category*) is used.

  **{string|null} description**: A string with further information about hte activity performed. Depending on the type of the activity, these are typically: the used search query (type === 'search'), the name of the selected product (type === 'selectProduct'), the item added or removed from the cart (type === 'addToCart' || type === 'removeFromCart'), and the amount of items or the value of items with currency (type === 'checkout').

  **{boolean|null} sign**: A boolean value, specifying if the call should be sign, only available if the *secret* is configured. It is strongly advised, not to use a signed call when utilizing this library.

  **{function|null} onReady**: A function, which is triggered after the activity was sent to the user. The function has the information sent as first parameter.

  **Example Usage**:
  ```javascript
  var product = 'The selected product';
  var userEmail = 'thecurrentuser@me.com';
  Breinify.activity({
    'email': userEmail
  }, 'selectProduct', null, product, false, function () {
    show('Sent activity "selectProduct" with product "' + product + '".');
  });
  ```
  <br/>

* **Breinify.lookup(user, dimensions, sign, onLookUp)**:<br/>
  Retrieves a lookup result from the engine.

  **Parameters**:

  **{object} user**: A plain object specifying the user information the information should be retrieved for. More information about the structure can be found [here](TODO).

  **{[string]} dimensions**: An array containing the names of the dimensions to lookup.

  **{boolean|null} sign**: A boolean value, specifying if the call should be sign, only available if the *secret* is configured. It is strongly advised, not to use a signed call when utilizing this library.

  **{function|null} onLookUp**: A function, which is triggered after the result of the lookup was retrieved. The function has the retrieved information as first parameter.

  **Example Usage**:
  ```javascript
  var userEmail = 'thecurrentuser@me.com';
  Breinify.lookup({
    'email': userEmail
  }, ['firstname'], false, function (data) {
    if (Breinify.UTL.isEmpty(data)) {
      window.alert('Hello ' + data.firstname.result);
    }
  });
  ```
  <br/>

#### Utilities (UTL)

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