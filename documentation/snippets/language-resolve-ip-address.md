<blockquote class="lang-specific javascript--browser">
<p>With the JavaScript library it is really simple to resolve temporal information
based on a client's ip-address. The endpoint utilizes the requesting ip-address to
determine, which information to return. Thus, the call does not need any additional 
data.</p>
</blockquote>

>
```javascript--browser
Breinify.temporalData(function(data) {
	console.log(data);
});
```

<blockquote class="lang-specific javascript--browser">
<p>Sometimes, it may be necessary to resolve a specific ip-address instead of the client's
one. To specify the ip-address to resolve, the library provides an overriden version, i.e.,</p>
</blockquote>

>
```javascript--browser
var ip = '72.229.28.185'; 
Breinify.temporalData({ additional: { ipAddress: ip }}, function(data) {
	console.log(data);
});
```