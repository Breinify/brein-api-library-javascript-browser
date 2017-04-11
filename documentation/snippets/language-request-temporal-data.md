<blockquote class="lang-specific javascript--browser">
<p>The JavaScript library offers several overloaded version
of the <code class="prettyprint">temporalData</code> method.</p>
</blockquote>

<blockquote class="lang-specific javascript--browser">
<h3>Callback only</h3>
<p>If a single callback is provided, the library retrieves other available information
from the client automatically, e.g., the user-agent, the location (if and only if shared), or
the ipAddress.</p>
</blockquote>

>
```javascript--browser
Breinify.temporalData(function(data) {
	console.log(data);
});
```

<blockquote class="lang-specific javascript--browser">
<h3>Providing a User Instance</h3>
<p>Another possibility is to provide a user object manually. This is typically done, if
some specific temporal data should be resolved, e.g., a location based on a free text, 
a pair of coordinates (latitude/longitude), or a specific ip-address. Have a look at the
<a href="#example-use-cases">further use cases</a> to see other examples.</p>
</blockquote>

>
```javascript--browser
var q = { additional: { ipAddress: '72.229.28.185' }}; 
Breinify.temporalData(q, function(data) {
	console.log(data);
});
```

