>
```javascript--browser
var sId = Breinify.UTL.cookie.get('JSESSIONID');
var email = 'max@sample.com'; // typically read from an input field
Breinify.activity({ 'sessionId': sId, 'email': email }, 'login');
```