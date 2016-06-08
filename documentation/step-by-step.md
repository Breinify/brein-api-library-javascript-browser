<p align="center">
  <img src="https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/documentation/img/logo.png" alt="Breinify API JavaScript Library" width="250">
</p>

<p align="center">
Breinify's DigitalDNA API puts dynamic behavior-based, people-driven data right at your fingertips.
</p>

### Step By Step Introduction

#### What is Breinify's DigitialDNA

Breinify's DigitalDNA API puts dynamic behavior-based, people-driven data right at your fingertips. Did you ever asked yourself why it is so difficult to provide great user experience to your visitors? With all this data out there in the world wide web, it should be so easy to provide a unique experience to every visitor.

Thanks to **Breinify's DigitalDNA** you are now able to adapt your online presence to your visitors needs and **provide a unique experience**. Let's walk step-by-step through a simple example.

#### 1. Step: Download the library

As with every JavaScript library, the first things you have to do, is to load the library (or integerate it into your project).

##### Using *bower* to download the library

The library breinify.js can be easily integrated using

```bash
bower install breinify/brein-api-library-javascript-browser
bower install github:breinify/brein-api-library-javascript-browser
bower install https://github.com/breinify/brein-api-library-javascript-browser/tarball/master
```

##### Using *npm* to download the library

```bash
npm install breinify/brein-api-library-javascript-browser
npm install github:breinify/brein-api-library-javascript-browser
npm install https://github.com/breinify/brein-api-library-javascript-browser/tarball/master
```

##### Download the library directly from GitHub

or just download the version from [GitHub](https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/dist/breinify.min.js) directly.

#### 2. Step: Integrate (npm/bower) downloaded files

There are several different ways on how to use the downloaded file(s). The easiest way is to use the minified version *breinify.min.js*. The library is concatenated and contains all the dependencies needed. Thus, the library does not need any additional files and can be directly loaded (same applies for the unminified version [breinify.js](https://raw.githubusercontent.com/Breinify/brein-api-library-javascript-browser/master/dist/breinify.js)).

The file is integrated within a web-site by adding the needed script-tag, pointing to the location of the downloaded file (e.g., *js/breinify.min.js*):

```html
<script src="js/breinify.min.js"></script>
```

It is also possible to omit the download and just point to the library file provided through a CDN (currently we do not publish the library to any CDN, but we will keep you updated) or Breinify's site.

```html
<script src="https://libs.breinify.com/javascript/breinify.min.js"></script>
```

**Note:** The library can also be loaded asynchroniously using the *async* and *onload* attribute (officially introduced in HTML5). In that case, the configuration of the library and all bindings should be performed after the library is loaded (i.e., within the *onload* function).

#### 3. Step: Configure the library

The library can be configured easily within a script-block, which should be placed after the loading of the library, but prior to any other usage. This ensures, that the library will be ready for usage, whenever a *activity* or *lookup* is triggered.

```html
<script>
    Breinify.setConfig({ 'apiKey': '<your-api-key>' });
</script>
```

**Note:**
A full list of the configuration parameters can be found [here](documentation/api.md).
