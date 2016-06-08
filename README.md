<p align="center">
  <img src="https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/documentation/img/logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

<p align="center">
Breinify's DigitalDNA API puts dynamic behavior-based, people-driven data right at your fingertips.
</p>

### Quick start
First of all, you need a valid API-key, which you can get for free at [https://www.breinify.com](https://www.breinify.com). In this example, we assume you have the following api-key:

**772A-47D7-93A3-4EA9-9D73-85B9-479B-16C6**

There are currently two different end-points available through the API. The first one is used to send data - so called activities - to the engine, whereas the second one is used to retrieve data from it (lookup).

The following code-snippet shows how easy it is to utilize the different end-points:

```html

    <!-- load the library -->
    <script src="https://libs.breinify.com/javascript/breinify-api.min.js"></script>
    <script>
        /*
         * Configure the library (see 'further links' for a full list)
         */
        Breinify.setConfig({
            'apiKey': '772A-47D7-93A3-4EA9-9D73-85B9-479B-16C6'
        });
        /*
         * Now use the library to inform about activities, e.g., about
         * a login (for a full list of activities see 'further links').
         */
         if (Breinify.UTL.loc.matches('/login$')) {
            Breinify.activity({
                'email': Breinify.text('input[name="name"]')
            }, 'login');
         }
         /*
          * You may want to greet your visitor appropriately, so let's
          * look-up the first name. For a full list of dimensions have
          * a look at 'further links'.
          */
          if (Breinify.UTL.loc.matches('/welcome$') &&
              Breinify.UTL.cookie.get('session-email') !== null) {
              Breinify.lookup({
                'email': Breinify.UTL.cookie.get('session-email')
              }, ['firstname'], false, function (data) {
                  if (!breinify.UTL.isEmpty(data)) {
                      window.alert('Hi ' + data.firstname.result);
                  }
              });
          }
    </script>
```

### Further links
To understand all the capabilities of Breinify's DigitalDNA API, you should have a look at:

* the [step-by-step instruction](documentation/step-by-step.md),
* the [API documentation](documentation/api.md),
* an [example using Google Tag Manager](documentation/example-google-tag-manager.md),
* a [more comprehensive example](documentation/example-comprehensive.md), or
* [Breinify's Website](https://www.breinify.com).