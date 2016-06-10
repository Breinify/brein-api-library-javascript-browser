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

  {string} **activityEndpoint**: The end-point of the API to send activities.

  {string} **apiKey**: The API-key to be used (mandatory).

  {string} **lookupEndpoint**: The end-point of the API to retrieve lookup results.

  {string} **secret**: The secret attached to the API-key (should always be null utilizing this type of library).

  {number} **timeout**: The maximum amount of time in milliseconds an API-call should take. If the API does not response after this amount of time, the call is cancelled.

  {string} **url**: The url of the API.

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

  {object} **config**: A plain object specifying the configuration properties to be set. If the validation of the configuration is activated, the passed values will be validated and an *Error* will be thrown, if the specified configuration property is invalid.

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

  {object} **user**: A plain object specifying the user information the activity belongs to. More information about the structure can be found [here](TODO).

  {string|null} **type**: The type of the activity collected, i.e., one of *search*, *login*, *logout*, *addToCart*, *removeFromCart*, *checkOut*, *selectProduct*, or *other*. If not specified, the default *other* will be used.

  {string|null} **category**: The category of the platform/service/products, i.e., one of *apparel*, *home*, *education*, *family*, *food*, *health*, *job*, *services*, or *other*. If not specified, the configured type (see *Breinify.config().category*) is used.

  {string|null} **description**: A string with further information about hte activity performed. Depending on the type of the activity, these are typically: the used search query (type === 'search'), the name of the selected product (type === 'selectProduct'), the item added or removed from the cart (type === 'addToCart' || type === 'removeFromCart'), and the amount of items or the value of items with currency (type === 'checkout').

  {boolean|null} **sign**: A boolean value, specifying if the call should be sign, only available if the *secret* is configured. It is strongly advised, not to use a signed call when utilizing this library.

  {function|null} **onReady**: A function, which is triggered after the activity was sent to the user. The function has the information sent as first parameter.

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

  {object} **user**: A plain object specifying the user information the information should be retrieved for. More information about the structure can be found [here](TODO).

  {[string]} **dimensions**: An array containing the names of the dimensions to lookup.

  {boolean|null} **sign**: A boolean value, specifying if the call should be sign, only available if the *secret* is configured. It is strongly advised, not to use a signed call when utilizing this library.

  {function|null} **onLookUp**: A function, which is triggered after the result of the lookup was retrieved. The function has the retrieved information as first parameter.

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

The utility library provides general functionality, which makes it easy to retrieve values from, e.g., the url or cookies. In addition, it simplifies the retrieval of values from the DOM-tree or the handling of events.

##### Breinify.UTL.loc

* {object} **Breinify.UTL.loc.params(paramListSeparator, paramSeparator, paramSplit, url)**:<br/>
  Retrieves an object with representing the parameters specified within the URL.

  **Parameters**:

  {string|null} **paramListSeparator**: The separator used to separate the list of parameters from the url (default: *?*).

  {string|null} **paramSeparator**: The separator used to separate the parameters from each other (default: *&*).

  {string|null} **paramSplit**: The separator used to split the name of the parameter and the value (default: *=*).

  {string|null} **url**: The url to read the parameters from (default: *Breinify.UTL.loc.url()*).

  **Example Usage**:
  ```javascript
  var params = Breinify.UTL.loc.params(null, null, null, 'http://mydomain.com?q=I\'m%20searching');
  window.alert('The parameter "q" has the value: ' + params.q);
  ```
  <br/>

* {boolean} **Breinify.UTL.loc.hasParam(param, paramListSeparator, paramSeparator, paramSplit, url)**:<br/>
  Validates if the URL contains a specific parameter.

  **Parameters**:

  {string} **param**: The parameter to look for.

  {string|null} **paramListSeparator**: The separator used to separate the list of parameters from the url (default: *?*).

  {string|null} **paramSeparator**: The separator used to separate the parameters from each other (default: *&*).

  {string|null} **paramSplit**: The separator used to split the name of the parameter and the value (default: *=*).

  {string|null} **url**: The url to read the parameters from (default: *Breinify.UTL.loc.url()*).

  **Example Usage**:
  ```javascript
  if (Breinify.UTL.loc.hasParam('#', null, null, 'http://mydomain.com#q=I\'m%20searching')) {
    window.alert('The parameter "q" was specified.');
  }
  ```
  <br/>

* {boolean} **Breinify.UTL.loc.isParam(param, params)**:<br/>
  Validates if the parameter is defined within the specified params.

  **Parameters**:

  {string} **param**: The parameter to look for.

  {object} **params**: The object with the parameters to check for the specified *param*.

  **Example Usage**:
  ```javascript
  var params = Breinify.UTL.loc.params(null, null, null, 'http://mydomain.com?q=I\'m%20searching');
  if (Breinify.UTL.loc.isParam('q', params)) {
    window.alert('The parameter "q" was specified.');
  }
  ```
  <br/>

* {boolean} **Breinify.UTL.loc.paramIs(expected, param, paramListSeparator, paramSeparator, paramSplit, url)**:<br/>
  Validates if the specified parameter is equal (*===*) to the *expected* value.

  {string} **expected**: The expected value of the parameter to look for.

  {string} **param**: The parameter to look for.

  {string|null} **paramListSeparator**: The separator used to separate the list of parameters from the url (default: *?*).

  {string|null} **paramSeparator**: The separator used to separate the parameters from each other (default: *&*).

  {string|null} **paramSplit**: The separator used to split the name of the parameter and the value (default: *=*).

  {string|null} **url**: The url to read the parameters from (default: *Breinify.UTL.loc.url()*).


  **Example Usage**:
  ```javascript
  if (Breinify.UTL.loc.paramIs(5, 'page', null, null, null, 'http://mydomain.com?page=5')) {
    window.alert('The parameter "q" is a number with the value 5.');
  }
  ```
  <br/>

* {boolean} **Breinify.UTL.loc.parsedParam(expectedType, param, paramListSeparator, paramSeparator, paramSplit, url)**:<br/>
  Parses the specified parameter to the expected type (i.e., *number*, *string*, *boolean*). If the parameter cannot be parsed, **null** is returned.

  **Example Usage**:
  ```javascript
  var page = Breinify.UTL.loc.parsedParam('number', 'page', null, null, null, 'http://mydomain.com?page=search')
  if (page === null) {
    window.alert('Invalid parameter information.');
  }
  ```
  <br/>

* {boolean} **Breinify.UTL.loc.param(param, paramListSeparator, paramSeparator, paramSplit, url)**:<br/>
  Gets a specific parameter from the url. The function returns *null*, if the parameter does not exist.

  **Example Usage**:
  ```javascript
  var page = Breinify.UTL.loc.param('page', null, null, null, 'http://mydomain.com?page=search')
  window.alert('The parameter "page" has the value "' + page + '".');
  ```
  <br/>

* {boolean} **Breinify.UTL.loc.url()**:<br/>
  Gets the current url.

  **Example Usage**:
  ```javascript
  window.alert('You are visiting: "' + Breinify.UTL.loc.url() + '".');
  ```
  <br/>

* {boolean} **Breinify.UTL.loc.matches()**:<br/>
  Validates if the current url matches the specified regular expression.

  **Example Usage**:
  ```javascript

  ```
  <br/>



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