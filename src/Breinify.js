//noinspection JSUnresolvedVariable
/**
 * The method has two scopes, the global scope (typically window),
 * and the dependency scope. Within the dependency scope all the
 * dependencies are bound.
 */
//noinspection JSUnresolvedVariable
!function (scope, dependencyScope) {
    "use strict";

    //noinspection JSUnresolvedVariable
    var misc = dependencyScope.misc;
    var $ = dependencyScope.jQuery;
    var AttributeCollection = dependencyScope.AttributeCollection;
    var BreinifyUser = dependencyScope.BreinifyUser;
    var BreinifyConfig = dependencyScope.BreinifyConfig;

    var ConfigAttributes = BreinifyConfig.ATTRIBUTES;

    var _privates = {
        'ajax': function (url, data, success, error) {

            $.ajax({

                // set some general stuff regarding communication
                'url': url,
                'type': 'POST',
                'crossDomain': true,

                // set the data
                'data': data,

                // let's hope it worked
                'success': function (data) {
                    if ($.isFunction(success)) {
                        success(data);
                    }
                },

                // let's ignore any error
                'error': function (jqXHR, text, exception) {
                    if ($.isFunction(error)) {
                        error(exception, text);
                    }
                }
            });
        }
    };

    /*
     * The internally used configuration used for all calls.
     */
    var _config = null;

    /**
     * The one and only instance of the library.
     */
    var Breinify = {
        version: '{{PROJECT.VERSION}}',
        jQueryVersion: $.fn.jquery
    };

    Breinify.BreinifyConfig = BreinifyConfig;
    Breinify.BreinifyUser = BreinifyUser;
    Breinify.AttributeCollection = AttributeCollection;

    /**
     * Modify the configuration to the specified configuration.
     *
     * @param c the new configuration to be used, can be a plain object,
     * an instance of BreinifyConfig, or null
     */
    Breinify.setConfig = function (c) {

        //noinspection JSUnresolvedFunction
        _config = new BreinifyConfig(c);
    };

    /**
     * Gets the current configuration.
     *
     * @returns {BreinifyConfig} the current configuration
     */
    Breinify.config = function () {

        if (_config === null) {
            //noinspection JSUnresolvedFunction
            _config = new BreinifyConfig();
        }

        return _config.all();
    };

    Breinify.activity = function (user, type, category) {

        // get the user information
        new BreinifyUser(user, function (user) {

            if (!user.validate()) {
                // just silently return
                return;
            }

            // get some default values for the passed parameters - if not set
            type = typeof category === 'undefined' || category === null ? null : type;
            category = typeof category === 'undefined' || category === null ? _config.get(ConfigAttributes.CATEGORY) : category;

            // get the other values needed
            var unixTimestamp = Math.floor(new Date().getTime() / 1000);

            // create the data set
            var data = {
                'user': user.all(),

                'activity': {
                    'type': type,
                    'category': category
                },

                'apiKey': _config.get(ConfigAttributes.API_KEY),
                'unixTimestamp': unixTimestamp
            };

            var url = _config.get(ConfigAttributes.URL) + _config.get(ConfigAttributes.ACTIVITY_ENDPOINT);
            console.log(data);
            //_privates.ajax(url, data);
        });
    };

    Breinify.lookup = function () {
        var url = _config.get(ConfigAttributes.URL) + _config.get(ConfigAttributes.LOOKUP_ENDPOINT);

    };

    Breinify.md5 = function (value) {
        //noinspection JSUnresolvedVariable,JSUnresolvedFunction
        return CryptoJS.MD5(null).toString(CryptoJS.enc.Base64);
    };

    //noinspection JSUnresolvedFunction
    misc.export(scope, 'Breinify', Breinify);
}(window, dependencyScope);