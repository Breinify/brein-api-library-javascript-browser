>
```javascript--browser
var text = 'NYC';
Breinify.temporalData({ additional: { location: {'text': text }}}, function(data) {
    // the location will be resolved to San Francisco, CA, US
	console.log(data);
});
```