<p align="center">
  <img src="https://www.breinify.com/img/Breinify_logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

# Breinify's API Library
[![Bower version](https://badge.fury.io/bo/breinify-api.svg)](https://badge.fury.io/bo/breinify-api)
[![npm version](https://badge.fury.io/js/breinify-api.svg)](https://badge.fury.io/js/breinify-api)
<sup>Features: **Temporal Information**, **Geocoding**, **Reverse Geocoding**, **Events**, **Weather**, **Holidays**, **Analytics**</sup>

The purpose of the library is to simplify the usage of Breinify's available API endpoints, i.e.,
- /activity
- /temporaldata.

Each of the endpoints has different purposes, which are explained in the following paragraphs. In addition, this documentation gives detailed examples for each of the features available for the different endpoints.

**Activity Endpoint**: The endpoint is used to understand the usage-patterns and the behavior of a user using, e.g., an application, a mobile app, or a web-browser. The endpoint offers insights through [Breinify's dashboard](https://www.breinify.com).

**TemporalData Endpoint**: The endpoint offers features to resolve temporal information like:
- a timestamp, 
- a location (latitude and longitude or free-text), or 
- an IP-address, 

to:
- holidays at the specified time and location,
- city, zip-code, neighborhood, country, or county of the location,
- events at the specified time and location (e.g., description, size, type),
- weather at the specified time and location (e.g., description, temperature),
- temporal information (e.g., timezone, epoch, formatted dates, day-name)

## Getting Started

First of all, you need a valid API-key, which you can get for free at [https://www.breinify.com](https://www.breinify.com). In the examples, we assume you have the following api-key:

**938D-3120-64DD-413F-BB55-6573-90CE-473A**

### Retrieve Client's Information (Location, Weather, Events, Timezone, Time)

The endpoint is capable to retrieve some information about the client, based on client specific information (e.g., the IP-address). The first example uses this information to retrieve some information, like the weather, events, or the timezone.

<p align="center">
  <img src="documentation/img/sample-text.png" alt="Client Information" width="400">
</p>

The whole information is retrieved using the following simple JavaScript (see a running example at the following [jsFiddle (3wz4u5d1)](https://jsfiddle.net/breinify/3wz4u5d1/):

```javascript
Breinify.setConfig({ 'apiKey': '938D-3120-64DD-413F-BB55-6573-90CE-473A' });
Breinify.temporalData(function(data) {
	document.getElementById('result').innerHTML = createText(data);
});
```

### Further links
To understand all the capabilities of Breinify's API, you should have a look at:

* the [step-by-step instruction](documentation/step-by-step.md),
* the [API library documentation](documentation/api.md),
* an [example using Google Tag Manager](documentation/example-google-tag-manager.md),
* a [more comprehensive example](documentation/example-comprehensive.md), or
* the [full API documentation](https://www.breinify.com/documentation/index.html)
* [Breinify's Website](https://www.breinify.com).
