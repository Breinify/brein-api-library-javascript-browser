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

**TemporalData Endpoint**: The endpoint offers features to resolve temporal information like a timestamp, a location (latitude and longitude or free-text), or an IP-address, to temporal information (e.g., timezone, epoch, formatted dates, day-name),  holidays at the specified time and location, city, zip-code, neighborhood, country, or county of the location, events at the specified time and location (e.g., description, size, type), weather at the specified time and location (e.g., description, temperature).

## Getting Started

### Retrieving an API-Key

First of all, you need a valid API-key, which you can get for free at [https://www.breinify.com](https://www.breinify.com). In the examples, we assume you have the following api-key:

**938D-3120-64DD-413F-BB55-6573-90CE-473A**

### Including the Library

The library can be added as script, using:

```html
<script type="text/javascript" src="https://cdn.jsdelivr.net/breinify-api/1.0.12/breinify-api.min.js"></script>
```

If you want to use the most current **snapshot** version (only recommended for development purposes), you can also use:

```html
<script type="text/javascript" src="https://rawgit.com/pmeisen/js-gantt/master/dist/js-gantt.min.js"></script>
```

If you prefer to use **bower** the newest version can be installed using:

```bash
bower install breinify-api --save
```

## TemporalData: Selected Usage Examples

### Retrieve Client's Information (Location, Weather, Events, Timezone, Time)

The endpoint is capable to retrieve some information about the client, based on client specific information (e.g., the IP-address). The first example uses this information to retrieve some information, like the weather, events, or the timezone.

<p align="center">
  <img src="documentation/img/sample-text.png" alt="Client Information" width="500"><br/>
  <sup>This is a screenshot of the jsFiddle (3wz4u5d1) created on the 29/03/2017 at 8:54 p.m.</sup>
</p>

The whole information is retrieved using the following simple JavaScript (see also [jsFiddle (3wz4u5d1)](https://jsfiddle.net/breinify/3wz4u5d1/)):

```javascript
Breinify.setConfig({ 'apiKey': '938D-3120-64DD-413F-BB55-6573-90CE-473A' });
Breinify.temporalData(function(data) {
	document.getElementById('result').innerHTML = createText(data);
});
```

### Geocoding and Reverse Geocoding

## Limitations

The open `/temporalData` endpoint is limited to US specific locations only. Furthermore, weather specific data is only available for the years 2016 and later.

## Further links

To understand all the capabilities of Breinify's API, you can find further information:
- the [library documentation](documentation/api.md),
- the [full API documentation](https://www.breinify.com/documentation/index.html),
- [Breinify's Website](https://www.breinify.com).
