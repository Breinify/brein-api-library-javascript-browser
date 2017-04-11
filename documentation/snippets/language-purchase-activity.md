<blockquote class="lang-specific javascript--browser">
<p>The JavaScript library offers several overloaded version
of the <code class="prettyprint">temporalData</code> method.</p>
</blockquote>

>
```javascript--browser
var sId = Breinify.UTL.cookie.get('JSESSIONID');
var tags = {
    'productIds': [ '125689', '982361', '157029' ],
    'productPrices': [ 134.23, 15.13, 12.99 ]
};
Breinify.activity({ 'sessionId': sId }, 'checkOut', tags);
```