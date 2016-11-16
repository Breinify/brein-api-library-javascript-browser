<p align="center">
  <img src="https://www.breinify.com/img/Breinify_logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

<p align="center">
Breinify's DigitalDNA API puts dynamic behavior-based, people-driven data right at your fingertips.
</p>

### Quick start
First of all, you need a valid API-key, which you can get for free at [https://www.breinify.com](https://www.breinify.com). In this example, we assume you have the following api-key:

**772A-47D7-93A3-4EA9-9D73-85B9-479B-16C6**

There are currently three different end-points available through the API. The first one is used to send data - so called activities - to the engine, whereas the second is used to retrieve temporal data from the engine for a visitor (e.g., the current city, weather, or the current timezone, or the current holidays), and the last one is used to look up detailed information about your visitor (e.g., first name).

The following code-snippet shows how easy it is to utilize the different end-points:

```html

    <!-- load the library -->
    <script src="https://cdn.jsdelivr.net/breinify-api/1.0.7/breinify-api.min.js"></script>
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
          * If you want your visitor to see the current weather 
          * (holidays, location), or if you'd like to know it 
          * (for analytical purposes or just to personalize the 
          * store).
          */
          Breinify.temporalData(function(data) {
              if (typeof data.weather !== 'undefined') {
                  window.alert('The temperature is currently ' + data.weather.temperature);
              }
          });
          
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
* the [API library documentation](documentation/api.md),
* an [example using Google Tag Manager](documentation/example-google-tag-manager.md),
* a [more comprehensive example](documentation/example-comprehensive.md), or
* the [full API documentation](https://www.breinify.com/documentation/index.html)
* [Breinify's Website](https://www.breinify.com).