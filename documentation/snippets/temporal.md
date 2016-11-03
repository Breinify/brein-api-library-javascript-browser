> ```javascript
> var withSecret = false;
> 
> // Example with just IP address set
> var response = Breinify.temporalData({
>     'ipAddress': '74.115.209.58'
> }, withSecret);
>
> // Example with IP address, timezone and localdata time
> var response = Breinify.temporalData({
>     'ipAddress': '74.115.209.58',
>     'localDateTime': 'Wed Oct 26 2016 13:02:06 GMT-0700 (EDT)',
>     'timezone': 'America/New_York'
> }, withSecret);
> ```
