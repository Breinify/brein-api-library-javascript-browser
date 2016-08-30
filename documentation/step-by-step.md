<p align="center">
  <img src="https://www.breinify.com/img/Breinify_logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

<p align="center">
Breinify's DigitalDNA API puts dynamic behavior-based, people-driven data right at your fingertips.
</p>

### Step By Step Introduction

#### What is Breinify's DigitialDNA

Breinify's DigitalDNA API puts dynamic behavior-based, people-driven data right at your fingertips. We believe that in many situations, a critical component of a great user experience is personalization. With all the data available on the web it should be easy to provide a unique experience to every visitor, and yet, sometimes you may find yourself wondering why it is so difficult.

Thanks to **Breinify's DigitalDNA** you are now able to adapt your online presence to your visitors needs and **provide a unique experience**. Let's walk step-by-step through a simple example.

#### Step 1: Download the library

As with every JavaScript library, the first thing you have to do is to load the library (or integerate it into your project).

##### Using *bower* to download the library

The library breinify-api.js can be easily integrated using 1 of the following:

```bash
bower install breinify/brein-api-library-javascript-browser
bower install github:breinify/brein-api-library-javascript-browser
bower install https://github.com/breinify/brein-api-library-javascript-browser/tarball/master
```

##### Using *npm* to download the library
Please pick 1 of the following:
```bash
npm install breinify/brein-api-library-javascript-browser
npm install github:breinify/brein-api-library-javascript-browser
npm install https://github.com/breinify/brein-api-library-javascript-browser/tarball/master
```

##### Download the library directly from GitHub

or just download the version from [GitHub](https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/dist/breinify-api.min.js) directly.

#### Step 2: Integrate (npm/bower) downloaded files

There are several different to use the downloaded library file(s). The easiest way is to use the minified version *breinify-api.min.js*. The library is concatenated and contains all the dependencies needed. Thus, the library does not need any additional files and can be directly loaded (same applies for the unminified version [breinify-api.js](https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/dist/breinify-api.js)).

The file is integrated within a web-site by adding the needed script-tag, pointing to the location of the downloaded file (e.g., *js/breinify-api.min.js*):

```html
<script src="js/breinify-api.min.js"></script>
```

It is also possible to omit the download and just point to the library file provided through a CDN (currently we do not publish the library to any CDN, but we will keep you updated) or Breinify's site.

```html
<script src="https://cdn.jsdelivr.net/breinify-api/1.0.6/breinify-api.min.js"></script>
```

**Note:** The library can also be loaded asynchroniously using the *async* and *onload* attribute (officially introduced in HTML5). In that case, the configuration of the library and all bindings should be performed after the library is loaded (i.e., within the *onload* function).

#### Step 3: Configure the library

The library can be configured easily within a script-block, which should be placed after the loading of the library, but prior to any other usage. This ensures that the library will be ready for usage whenever an *activity* or *lookup* is triggered. The only mandatory configuration value is the API-key used to communicate with the engine. To retrieve a **free API-key** you may sign up at [https://www.breinify.com](https://www.breinify.com).

```html
<script>
    Breinify.setConfig({ 'apiKey': '<your-api-key>' });
</script>
```

**Note:**
A full list of the configuration parameters can be found [here](./api.md).

#### Step 4: Start using the library

##### Placing activity triggers

The engine powering the DigitalDNA API provides two endpoints. The first endpoint is used to inform the engine about the activities performed by visitors of your site. The activities are used to understand the user's current interest and infer the intent. It becomes more and more accurate across different users and verticals as more activities are collected. It should be noted, that any personal information is not stored within the engine, thus each individual's privacy is well protected. The engine understands several different activities performed by a user, e.g., landing, login, search, item selection, or logout.

The engine is informed of an activity by executing *Breinify.activity(...)*. If you want to trigger an activity, you normally observe events like page-loaded or click.

```html
<script>
    Breinify.UTL.events.click('.product', function () {
        var userEmail = Breinify.UTL.cookie.get('session-email');

        if (!Breinify.UTL.isEmpty(userEmail)) {
            var product = Breinify.UTL.text(this);

            Breinify.activity({
                'email': userEmail
            }, 'selectProduct', 'services', product);
        }
    });
</script>
```

The example above observes a click event on all elements with the *product* class. If such an element is clicked, the library is utilized to read a specific value from a session-cookie, which contains the current user's email. If such a cookie exists, the name of the product is read from the DOM-tree and send to the engine, adding the additional information *selectProduct* (to define the type of the activity), and the category (e.g., *services*).

**Note:**
A full list of the available utility functions (*Breinify.UTL*) and there purpose and parameters, can be found [here](./api.md).

##### Placing look-up triggers

Look-ups are used, e.g., to change the appearance of the site, increase the quality of service by enhancing recommendations or pre-filtering search results. In the following simple example, the site's message is adapted when the page is loaded.

```html
<script>
    Breinify.UTL.events.pageloaded(function () {
        var userEmail = Breinify.UTL.cookie.get('session-email');

        if (!Breinify.UTL.isEmpty(userEmail)) {

            Breinify.lookup({
                'email': userEmail
            }, ['firstname'], false, function (data) {
                if (!Breinify.UTL.isEmpty(data)) {
                    Breinify.UTL.setText('span.welcome', 'Hi ' + data.firstname.result + '!');
                }
            });
        }
    });
</script>
```

**Note:**
The JSON structure of the *lookup* response is documented in the [API library documentation](./api.md).
