> ```javascript--browser
> var withSecret = false;
> 
> // Example to retrieve temporal information through additional information
> Breinify.temporalData({ 'email':'example@breinify.com' }, function(data) {
>    window.alert(JSON.stringify(data, null, 2)); 
> });
> ```
