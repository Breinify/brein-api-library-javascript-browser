<blockquote class="lang-specific javascript--browser">
<p>It is recommended to use the JavaScript library without any signature (i.e., 
the <code class="prettyprint">Verification Signature</code> in the UI is disabled and no secret is needed).
For a full list of all possible settings have a look 
<a href="https://github.com/Breinify/brein-api-library-javascript-browser/blob/master/documentation/api.md#general-attributes" target="_blank">here</a>.</p>
</blockquote>

>
```javascript--browser
Breinify.setConfig({ 
    'apiKey': '938D-3120-64DD-413F-BB55-6573-90CE-473A' 
});
```

<blockquote class="lang-specific javascript--browser">
<p>The configuration must be performed prior to any other usage, thus it is recommended to place the specified code
right after the library is loaded, e.g.:</p>
</blockquote>

>
```javascript--browser
<script type="text/javascript" src="https://cdn.jsdelivr.net/breinify-api/{version}/breinify-api.min.js"></script>
<script type="text/javascript">
Breinify.setConfig({ 
    'apiKey': '938D-3120-64DD-413F-BB55-6573-90CE-473A' 
});
</script>
```

<blockquote class="lang-specific javascript--browser">
<p>It is also possible to use, e.g., the jQuery <a href="https://api.jquery.com/ready/" target="_blank">ready-method</a>
and make sure that the configuration is called prior to any other usage of the library.</p>
</blockquote>

>
```javascript--browser
$(document).ready(function() {
    Breinify.setConfig({ 
        'apiKey': '938D-3120-64DD-413F-BB55-6573-90CE-473A' 
    });
});
```

<blockquote class="lang-specific javascript--browser">
<p>Another solution is to use the <a href="https://www.w3schools.com/tags/ev_onload.asp" target="_blank">onload-method</a>
to execute the configuration script right after the library is loaded.</p>
</blockquote>

>
```javascript--browser
<script type="text/javascript" onload="function() { Breinify.setConfig({...}); }" src="https://cdn.jsdelivr.net/breinify-api/{version}/breinify-api.min.js"></script>
```