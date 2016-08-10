```javascript
var product = 'The selected product';
var userEmail = 'thecurrentuser@me.com';
Breinify.activity({
    'email': userEmail
}, 'selectProduct', null, product, false, function () {
    show('Sent activity "selectProduct" with product "' + product + '".');
});
```