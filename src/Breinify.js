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
    var BreinifyUtil = dependencyScope.BreinifyUtil;

    var ATTR_CONFIG = BreinifyConfig.ATTRIBUTES;

    /*
     * The internally used configuration used for all calls.
     */
    var _config = null;

    var _privates = {
        'ajax': function (url, data, success, error) {

            $.ajax({

                // set some general stuff regarding communication
                'url': url,
                'type': 'POST',
                'crossDomain': true,

                // set the data
                'dataType': 'json',
                'contentType': 'application/json; charset=utf-8',
                'data': JSON.stringify(data),

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
                },

                'timeout': _config.get(ATTR_CONFIG.AJAX_TIMEOUT)
            });
        }
    };

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

    /**
     * Sends an activity to the Breinify server.
     *
     * @param user {object} the user-information
     * @param type {string} the type of activity
     * @param category {string} the category (can be null or undefined)
     */
    Breinify.activity = function (user, type, category) {

        // get the user information
        new BreinifyUser(user, function (user) {

            if (!user.validate()) {
                // just silently return
                return;
            }

            // get some default values for the passed parameters - if not set
            type = typeof type === 'undefined' || type === null ? null : type;
            category = typeof category === 'undefined' || category === null ? _config.get(ATTR_CONFIG.CATEGORY) : category;

            // get the other values needed
            var unixTimestamp = Math.floor(new Date().getTime() / 1000);

            // create the data set
            var data = {
                'user': user.all(),

                'activity': {
                    'type': type,
                    'category': category
                },

                'apiKey': _config.get(ATTR_CONFIG.API_KEY),
                'unixTimestamp': unixTimestamp
            };

            var url = _config.get(ATTR_CONFIG.URL) + _config.get(ATTR_CONFIG.ACTIVITY_ENDPOINT);
            _privates.ajax(url, data);
        });
    };

    /**
     * Method to lookup available information.
     */
    Breinify.lookup = function () {
        var url = _config.get(ATTR_CONFIG.URL) + _config.get(ATTR_CONFIG.LOOKUP_ENDPOINT);
    };


    /**
     * Helper method to create an MD5-hash. Internally the Breinify system uses
     * other hashes. We even do not store this information, because of the possible
     * use of rainbow tables. Nevertheless, it is a possible way to send information
     * to us.
     *
     * @param value the value to be hashed
     * @returns {string} the hashed value
     */
    Breinify.md5 = function (value) {
        //noinspection JSUnresolvedVariable,JSUnresolvedFunction
        return CryptoJS.MD5(value).toString(CryptoJS.enc.Base64);
    };

    // bind the utilities to be available through Breinify
    Breinify.UTL = BreinifyUtil;

    //noinspection JSUnresolvedFunction
    misc.export(scope, 'Breinify', Breinify);
}(window, dependencyScope);