<p align="center">
  <img src="https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/sample/img/logo.png" alt="Breinify API JavaScript Library" width="226">
</p>

<p align="center" style="border-bottom:0px;padding-bottom:0.1em;font-size:2.25em;">
Breinify API JavaScript Library
</p>

<p align="center">
Breinify's DigitalDNA API puts dynamic behavior-based, people-driven data right at your fingertips.
</p>

## A quick start
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

## A step-by-step instruction

In this step-by-step instruction, we assume that the following API-key is used:

**772A-47D7-93A3-4EA9-9D73-85B9-479B-16C6**

1. Load the library:

    As with every JavaScript library, it has to be loaded. To achieve that, you can host the library on your own web-server or use the one hosted on the breinify server (i.e., [https://libs.breinify.com/javascript/breinify.min.js](https://libs.breinify.com/javascript/breinify.min.js)).

    ```html
    <script src="https://libs.breinify.com/javascript/breinify.min.js"></script>
    ```

    **Note:** The library will also be available through common CDN (content delivery networks). We will keep you updated regarding the available links and recommend a specific CDN to increase performance gains using CDN.

2. Configure the library:

    The configuration of the library is done by calling the **setConfig** method. The method validates the specified attributes and uses the specified configuration directly.

    ```html
    <script>
       Breinify.setConfig({
           'apiKey': '772A-47D7-93A3-4EA9-9D73-85B9-479B-16C6'
       });
    </script>
    ```

    Currently, the following options are available:



### Requirements
This library is used to integrate the Brein Engine (more specific, the API's end-points: activity and lookup) with a web-platform (using JavaScript). The library requires [TODO: add lists of supported and tested browsers].

[TODO: add documentation]