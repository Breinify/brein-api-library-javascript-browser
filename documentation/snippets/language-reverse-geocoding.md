>
```javascript--browser
var loc = {
    latitude: 37.7609295,
    longitude: -122.4194155,
    shapeTypes: ['CITY', 'NEIGHBORHOOD']
};
var q = {additional: { location: loc };

Breinify.temporalData(q, function(data) {
    
    /* 
     * The location will be resolved to San Francisco, CA, US.
     * In addition, it will contain the shapes of the 
     * neighborhood and the city the location points to.
     */
	console.log(data);
});
```