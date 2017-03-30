<p align="center">
  <img src="https://www.breinify.com/img/Breinify_logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

# Breinify's API Library (JavaScript for Browsers)

The purpose of the library is to simplify the usage of Breinify's available API endpoints, i.e.,
- /activity, and
- /temporaldata.

Each of the endpoints has different purposes, which are explained in the following paragraphs. In addition, this documentation gives detailed examples for each of the features available for the different endpoints.

**Activity Endpoint**: The endpoint is used to understand the usage-patterns and the behavior of a user using, e.g., an application, a mobile app, or a web-browser. The endpoint offers insights through [Breinify's dashboard](https://www.breinify.com).

**TemporalData Endpoint**: The endpoint offers features to resolve temporal information like:
- a timestamp, 
- a location (latitude and longitude or free-text), or 
- an ip-address, 
to:
- holidays at the specified time and location,
- city, zip-code, neighborhood, country, or county of the location,
- events at the specified time and location (e.g., description, size, type),
- weather at the specified time and location (e.g., description, temperature),
- temporal information (e.g., timezone, epoch, formatted dates, day-name)

## Getting Started

First of all, you need a valid API-key, which you can get for free at [https://www.breinify.com](https://www.breinify.com). In this example, we assume you have the following api-key:

**772A-47D7-93A3-4EA9-9D73-85B9-479B-16C6**

The following code-snippet shows how easy it is to utilize the different end-points:

```html

    <!-- load the library -->
    <script src="https://cdn.jsdelivr.net/breinify-api/1.0.12/breinify-api.min.js"></script>
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
          * (for analytical purposes or just for personalization 
          * purposes).
          */
          Breinify.temporalData(function(data) {
              if (typeof data.weather !== 'undefined') {
                  window.alert('The temperature is currently ' + data.weather.temperature);
              }
          });
    </script>
```

### Further links
To understand all the capabilities of Breinify's API, you should have a look at:

* the [step-by-step instruction](documentation/step-by-step.md),
* the [API library documentation](documentation/api.md),
* an [example using Google Tag Manager](documentation/example-google-tag-manager.md),
* a [more comprehensive example](documentation/example-comprehensive.md), or
* the [full API documentation](https://www.breinify.com/documentation/index.html)
* [Breinify's Website](https://www.breinify.com).
