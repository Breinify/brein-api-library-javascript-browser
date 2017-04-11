<blockquote class="lang-specific javascript--browser">
<p>The JavaScript library offers several overloaded version
of the <code class="prettyprint">temporalData</code> method.</p>
</blockquote>

>
```javascript--browser
Breinify.activity(function(data) {
	console.log(data);
});
```

'Object,String': function (user, type) {
                Breinify.activityUser(user, type, null, null, null, false, function (data) {
                    _privates.ajax(url, data);
                });
            },
            'Object,String,Object': function (user, type, tags) {
                Breinify.activityUser(user, type, null, null, tags, false, function (data) {
                    _privates.ajax(url, data);
                });
            },
            'Object,String,String,Object': function (user, type, description, tags) {
                Breinify.activityUser(user, type, null, description, tags, false, function (data) {
                    _privates.ajax(url, data);
                });
            },
            'Object,String,String,String,Object': function (user, type, category, description, tags) {
                Breinify.activityUser(user, type, category, description, tags, false, function (data) {
                    _privates.ajax(url, data);
                });
            },
            'Object,String,String,String,Object,Function': function (user, type, category, description, tags, callback) {
                Breinify.activityUser(user, type, category, description, tags, false, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,String,String,String,Object,Boolean,Function': function (user, type, category, description, tags, sign, callback) {
                Breinify.activityUser(user, type, category, description, tags, sign, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            }