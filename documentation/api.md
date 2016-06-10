<p align="center">
  <img src="https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/documentation/img/logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

<p align="center">
Breinify's DigitalDNA API puts dynamic behavior-based, people-driven data right at your fingertips.
</p>

### API Library Documentation

The library provides several attributes, methods, and objects to simplify the usage of the Breinify API. Besides methods to actually send or retrieve data, it also includes general information (e.g., about the version and used configuration), as well as utilities. Thus, the following documentation is organized in three sections: *General Information*, *API*, and *Utilities (UTL)*.

This documentation is organized as following:

* [General Attributes](#general-attributes)
  * Breinify.version
  * Breinify.config()
  * Breinify.setConfig(config)
* [API](#api)
  * Breinify.activity(user, type, category, description, sign, onReady)
  * Breinify.lookup(user, dimensions, sign, onLookUp)
* [Utilities (UTL)](#utilities-utl)
  * [Breinify.UTL (general functions)](#breinifyutl-general-functions)
    * Breinify.UTL.texts(selector, excludeChildren)
    * Breinify.UTL.text(selector, excludeChildren)
    * Breinify.UTL.setText(selector, value)
    * Breinify.UTL.md5(value)
    * Breinify.UTL.isEmpty(value)
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
    * Breinify.UTL.loc.matches(regEx)
  * [Breinify.UTL.cookie](#breinifyutlcookie)
    * Breinify.UTL.cookie.all()
    * Breinify.UTL.cookie.reset(name)
    * Breinify.UTL.cookie.set(name, value, expiresInDays)
    * Breinify.UTL.cookie.get(name)
    * Breinify.UTL.cookie.check(name)

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
  Retrieves a lookup result from the engine. The function needs a valid API-key to be configured to succeed.

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

##### Breinify.UTL (general functions)

* {[string]} **Breinify.UTL.texts(selector, excludeChildren)**:<br/>
  Gets the text of the elements selected by the specified *selector*.

  **Parameters**:

  {string} **selector**: The CSS-selector to specify the element(s) to read from (see [jQuery Selectors](https://api.jquery.com/category/selectors/) for a detailed overview of available selectors). In addition, the selector can also be a DOM-element.

  {boolean|null} **excludeChildren**: true, if the result for an element should also include the text of the children (concatenated by newline if needed), or false, if only the text of the selected element should be read (default true).

  **Example Usage**:
  ```javascript
  var texts = Breinify.UTL.texts('ul li', false);
  console.log(texts);
  ```
  <br/>

* {string} **Breinify.UTL.text(selector, excludeChildren)**:<br/>
  Gets the concatenated text of the specified element(s).

  **Parameters**:

  {string} **selector**: The CSS-selector to specify the element(s) to read from (see [jQuery Selectors](https://api.jquery.com/category/selectors/) for a detailed overview of available selectors). In addition, the selector can also be a DOM-element.

  {boolean|null} **excludeChildren**: true, if the result for an element should also include the text of the children (concatenated by newline if needed), or false, if only the text of the selected element should be read (default true).

  **Example Usage**:
  ```javascript
  var text = Breinify.UTL.text('input[attr="name"]', false);
  console.log(text);
  ```
  <br/>

* {string} **Breinify.UTL.setText(selector, value)**:<br/>
  Sets the text for the selected element(s).

  **Parameters**:

  {string} **selector**: The CSS-selector to specify the element(s) to read from (see [jQuery Selectors](https://api.jquery.com/category/selectors/) for a detailed overview of available selectors). In addition, the selector can also be a DOM-element.

  {string} **value**: The text to be set.

  **Example Usage**:
  ```javascript
  Breinify.UTL.setText('input[attr="name"]', 'Philipp');
  ```
  <br/>

* {string} **Breinify.UTL.md5(value)**:<br/>
  Gets the hashed value for the passed *value*.

  **Parameters**:

  {string} **value**: The value to be hashed.

  **Example Usage**:
  ```javascript
  var md5 = Breinify.UTL.text('HELLO', false);
  window.alert('The hashed value of "HELLO" is ' + md5);
  ```
  <br/>

* {boolean} **Breinify.UTL.isEmpty(value)**:<br/>
  Checks if the passed *value* is empty. Empty has a different meaning for different types. An *object* is assumed to be empty:
    * if it is plain and has no attributes
    * if it is a string equal to *''* after it is trimmed
    * if it is *null*

  **Parameters**:

  {mixed} **value**: The value to be checked.

  **Example Usage**:
  ```javascript
  Breinify.UTL.isEmpty({});     // returns true
  Breinify.UTL.isEmpty('    '); // returns true
  Breinify.UTL.isEmpty(null);   // returns true
  ```
  <br/>

##### Breinify.UTL.events

For simplicity the library provides the possibility to handle/react to specific events triggered by the DOM-tree. Currently, two events are supported, i.e., *click* and *pageloaded*.

* **Breinify.UTL.events.click(selector, func, onlyOnce)**:<br/>
  Gets all the cookies currently defined and accessible.

  **Parameters**:

  {string} **selector**: The CSS-selector to specify the element(s) to listen for click-events (see [jQuery Selectors](https://api.jquery.com/category/selectors/) for a detailed overview of available selectors).

  {function} **func**: The function to execute when the event is captured. The function retrieves an *event* object which can be used to control the further processing. In addition, the handling function also has access to the DOM-element that the handler was bound to using *this*. For further details, have a look at [jQuery Event Handling](https://learn.jquery.com/events/inside-event-handling-function/).

  {boolean} **onlyOnce**: Specify if the event should only be trigger at most once.

  **Example Usage**:
  ```javascript
  Breinify.UTL.events.click('body', function () {
    window.alert('You clicked the document.');
  });
  ```
  <br/>

* **Breinify.UTL.events.pageloaded(func)**:<br/>
  Gets all the cookies currently defined and accessible.

  **Parameters**:

  {function} **func**: The function to execute when the event is captured. The function retrieves an *event* object which can be used to control the further processing. In addition, the handling function also has access to the DOM-element that the handler was bound to using *this*. For further details, have a look at [jQuery Event Handling](https://learn.jquery.com/events/inside-event-handling-function/).

  **Example Usage**:
  ```javascript
  Breinify.UTL.events.click('body', function () {
    window.alert('The document is loaded.');
  });
  ```
  <br/>

##### Breinify.UTL.loc

The location part of the utilities contains functions to validate, match, or retrieve information from the url or parameters specified within.

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

  **Parameters**:

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

  **Parameters**:

  {string} **expectedType**: The expected type, i.e., *number*, *string*, or *boolean*.

  {string} **param**: The parameter to look for.

  {string|null} **paramListSeparator**: The separator used to separate the list of parameters from the url (default: *?*).

  {string|null} **paramSeparator**: The separator used to separate the parameters from each other (default: *&*).

  {string|null} **paramSplit**: The separator used to split the name of the parameter and the value (default: *=*).

  {string|null} **url**: The url to read the parameters from (default: *Breinify.UTL.loc.url()*).

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

  **Parameters**:

  {string} **param**: The parameter to look for.

  {string|null} **paramListSeparator**: The separator used to separate the list of parameters from the url (default: *?*).

  {string|null} **paramSeparator**: The separator used to separate the parameters from each other (default: *&*).

  {string|null} **paramSplit**: The separator used to split the name of the parameter and the value (default: *=*).

  {string|null} **url**: The url to read the parameters from (default: *Breinify.UTL.loc.url()*).

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

* {boolean} **Breinify.UTL.loc.matches(regEx)**:<br/>
  Validates if the current url matches the specified regular expression.

  **Parameters**:

  {string|RegEx} **regEx**: The regular expression used for matching.

  **Example Usage**:
  ```javascript
  if (Breinify.UTL.loc.matches('^https?//product.shop.com')) {
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
  var cookies = Breinify.UTL.cookie.all();
  window.alert('The following cookies were found: ' + JSON.stringify(cookies));
  ```
  <br/>

* **Breinify.UTL.cookie.reset(name)**:<br/>
  Removes the specified cookie.

  **Parameters**:

  {string} **name**: The name of the cookie to be removed.

  **Example Usage**:
  ```javascript
  Breinify.UTL.cookie.reset('myFunnyCookie');
  ```
  <br/>

* **Breinify.UTL.cookie.set(name, value, expiresInDays)**:<br/>
  Sets the specified cookie with the specified value.

  **Parameters**:

  {string} **name**: The name of the cookie to be set.

  {string} **value**: The value to be set for the cookie.

  {number|null} **expiresInDays**: The time (in days) after which the cookie expires (default 1).

  **Example Usage**:
  ```javascript
  Breinify.UTL.cookie.set('myFunnyCookie', 'A year of fun!', 365);
  ```
  <br/>

* {string} **Breinify.UTL.cookie.get(name)**:<br/>
  Gets the value of the cookie with the specified name, if no such cookie exists *null* is returned.

  **Parameters**:

  {string} **name**: The name of the cookie to be get.

  **Example Usage**:
  ```javascript
  Breinify.UTL.cookie.get('myFunnyCookie');
  ```
  <br/>

* {boolean} **Breinify.UTL.cookie.check(name)**:<br/>
  Checks if a cookie is currently set or not.

  **Parameters**:

  {string} **name**: The name of the cookie to be get.

  **Example Usage**:
  ```javascript
  if (!Breinify.UTL.cookie.check('myFunnyCookie')) {
    window.alert('Is the funny session over or did it never start?');
  }
  ```
  <br/>