```javascript
var userEmail = 'thecurrentuser@me.com';
Breinify.lookup({
    'email': userEmail
}, ['firstname'], false, function (data) {
    if (Breinify.UTL.isEmpty(data)) {
        window.alert('Hello ' + data.firstname.result);
    }
});
```