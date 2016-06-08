<p align="center">
  <img src="https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/documentation/img/logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

<p align="center">
Breinify's DigitalDNA API puts dynamic behavior-based, people-driven data right at your fingertips.
</p>

### Quick start
First of all, you need a valid API-key, which you can get under [https://www.breinify.com](https://www.breinify.com). In this example, we assume you have the following api-key:

**772A-47D7-93A3-4EA9-9D73-85B9-479B-16C6**

There are currently two different end-points available through the API. The first one is used to send data - so called activities - to the engine, whereas the second one is used to retrieve data from it (lookup).

The following code-snippet shows how to send an activity to the engine:

```html

    <!-- load the library -->
    <script src="https://libs.breinify.com/javascript/breinify.min.js"></script>
    <script>
        /*
         * Configure the library, further info @step-by-step instruction
         * on GitHub.
         */
        Breinify.setConfig({
            'apiKey': '772A-47D7-93A3-4EA9-9D73-85B9-479B-16C6'
        });
        /*
         * Now use the library to inform about activities, e.g., about
         * a login (for a full list of activities see the @step-by-step
         * instruction on GitHub).
         */
         if (Breinify.UTL.loc.matches('/login$')) {
            Breinify.activity({
                'email': Breinify.text('input[name="name"]')
            }, 'login');
         }
         /*
          * You may want to greet your visitor appropriately, so let's
          * look-up the first name. Further information can be found
          * @step-by-step instruction on GitHub.
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

To understand all the capabilities of Breinify's DigitalDNA API, you should have a look at the [documentation/step-by-step.md](step-by-step instruction), [documentation/api.md](API documentation), [documentation/example-google-tag-manager.md](an example using Google Tag Manager), [example-comprehensive.md](a more comprehensive example), or just our website at [https://www.breinify.com](https://www.breinify.com).