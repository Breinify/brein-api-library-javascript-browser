>
```javascript--browser
var q = {additional: {location: {'text': 'SFO'}}};
Breinify.temporalData(q, false, function(data) {
    // the location will be resolved to San Francisco, CA, US
	console.log(data);
});
```