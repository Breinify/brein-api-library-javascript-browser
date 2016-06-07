# brein-api-library-javascript-browser

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
          * In addition, you may want to greet your visitor appropriately,
          * without even knowing there name or asking for it.
          */
          if (Breinify.UTL.loc.matches('/welcome$') && Breinify.UTL.cookie.get('session-email') !== null) {
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
    <html>
      <head>
        <!--
          You can place the loading of the script where-ever you like. It is
          also possible to load the script within the body of your document.
          -->
        <script src="https://libs.breinify.com/javascript/breinify.min.js" async></script>
      </head>
      <body>
        <!-- ... -->
      </body>
    </html>
    ```

    **Note:** The library will also be available through common CDN (content delivery networks). We will keep you updated regarding the available links and recommend a specific CDN to increase performance gains using CDN.

2. Configure the library:

    The configuration of the library is done within one simple call

### Requirements
This library is used to integrate the Brein Engine (more specific, the API's end-points: activity and lookup) with a web-platform (using JavaScript). The library requires [TODO: add lists of supported and tested browsers].

[TODO: add documentation]