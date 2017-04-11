>
```javascript--browser
var sId = Breinify.UTL.cookie.get('JSESSIONID');
Breinify.activity({ 'sessionId': sId }, 'pageVisit');
```