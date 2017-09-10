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

    /**
     * As JS don't supports data types, implements an overload method. This implementation is inspired by
     * https://github.com/myfingersarebroken/aer
     */
    function Wrapper() {
        this.excludeNullType = function (type) {
            return false;
        };

        this.toString = function (pointer) {
            var output = '';

            var keys = Object.keys(pointer);
            keys.forEach(function (key) {
                output += '[' + key + '] ';
            });

            return output;
        };
    }

    //noinspection JSUnusedGlobalSymbols
    Wrapper.prototype = {
        setExcludeNullType: function (func) {
            if (typeof func == 'function') {
                this.excludeNullType = func;
            }
        },

        overload: function (o, args, context) {
            return this._$overload(o, args, context, this);
        },

        _$overload: function (pointer, args, context, wrapper) {
            var regex = /function\s+(\w+)s*/;
            var types = [];

            // create a string to identify the structure of the signature
            var containsRegEx = false;
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];

                var type;
                if (arg === null) {
                    type = '([A-Za-z0-9_\\-]+)';
                    containsRegEx = true;
                } else {
                    type = regex.exec(arg.constructor.toString())[1];
                }

                types.push(type);
            }

            // check which one of the functions can be used
            var func = null;
            if (containsRegEx) {
                var typeRegEx = new RegExp(types.toString(), 'i');

                Object.keys(pointer).forEach(function (key) {
                    var matches = typeRegEx.exec(key);
                    if (matches != null) {
                        var exclude = false;
                        for (var i = 1; i < matches.length; i++) {
                            if (wrapper.excludeNullType(matches[i])) {
                                exclude = true;
                                break;
                            }
                        }

                        if (exclude) {
                            // nothing to do
                        } else if (func === null) {
                            func = pointer[key];
                        } else {
                            throw new SyntaxError('Multiple signatures for  (' + types.toString() + ') found in: ' + JSON.stringify(pointer));
                        }
                    }
                });
            } else {
                func = pointer[types.toString()];
            }
            if (typeof func !== 'function') {
                throw new SyntaxError('Invalid signature (' + types.toString() + ') found, use one of: ' + JSON.stringify(pointer));
            }

            return func.apply(context, args);
        }
    };

    var overload = new Wrapper();

    /*
     * The internally used configuration used for all calls.
     */
    var _config = null;

    var _privates = {
        ajax: function (url, data, success, error) {

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
                        error(jqXHR.responseText, text + ' (' + exception + ')');
                    }
                },

                'timeout': _config.get(ATTR_CONFIG.AJAX_TIMEOUT)
            });
        },

        determineSignature: function (message, secret) {

            //noinspection JSUnresolvedFunction
            return CryptoJS.HmacSHA256(message, secret).toString(CryptoJS.enc.Base64);
        },

        generateActivityMessage: function (amount, unixTimestamp, type) {
            return type + unixTimestamp + amount;
        },

        generateRecommendationMessage: function (amount, unixTimestamp) {
            return '' + unixTimestamp;
        },

        generateLookUpMessage: function (dimensions, unixTimestamp) {
            dimensions = $.isArray(dimensions) ? dimensions : [];
            var dimension = dimensions.length === 0 ? '' : dimensions[0];
            return dimension + unixTimestamp + dimensions.length;
        },

        generateTemporalDataMessage: function (unixTimestamp, localDateTime, timezone) {
            var paraLocalDateTime = typeof localDateTime === 'undefined' || localDateTime === null ? "" : localDateTime;
            var paraTimezone = typeof timezone === 'undefined' || timezone === null ? "" : timezone;

            return unixTimestamp + "-" + paraLocalDateTime + "-" + paraTimezone;
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

    //noinspection JSCommentMatchesSignature,JSValidateJSDoc
    /**
     * Sends an recommendation request to the Breinify server.
     *
     * @param user {object} the user-information
     * @param nrOfRecommendations {number|null} the amount of recommendations to get
     * @param category {string|null} contains an optional category for the recommendation
     * @param sign {boolean|null} true if a signature should be added (needs the secret to be configured - not recommended in open systems), otherwise false (can be null or undefined)
     * @param onReady {function|null} unction to be executed after triggering the recommendation request
     */
    Breinify.recommendation = function () {
        var url = _config.get(ATTR_CONFIG.URL) + _config.get(ATTR_CONFIG.RECOMMENDATION_ENDPOINT);

        overload.overload({
            'Object,Function': function (user, callback) {
                Breinify.recommendationUser(user, 3, null, false, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Number,Function': function (user, nrOfRecommendations, callback) {
                Breinify.recommendationUser(user, nrOfRecommendations, null, false, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Number,String,Function': function (user, nrOfRecommendations, category, callback) {
                Breinify.recommendationUser(user, nrOfRecommendations, category, false, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Number,Boolean,Function': function (user, nrOfRecommendations, sign, callback) {
                Breinify.recommendationUser(user, nrOfRecommendations, null, sign, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Number,String,Boolean,Function': function (user, nrOfRecommendations, category, sign, callback) {
                Breinify.recommendationUser(user, nrOfRecommendations, category, sign, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            }
        }, arguments, this);
    };

    /**
     * Creates a user instance and executes the specified method.
     *
     * @param user {object} the user-information
     * @param nrOfRecommendations {number|null} the amount of recommendations to get
     * @param category {string|null} contains an optional category for the recommendation
     * @param sign {boolean|null} true if a signature should be added (needs the secret to be configured - not recommended in open systems), otherwise false (can be null or undefined)
     * @param onReady {function|null} function to be executed after successful user creation
     */
    Breinify.recommendationUser = function (user, nrOfRecommendations, category, sign, onReady) {

        var _onReady = function (user) {
            if ($.isFunction(onReady)) {
                onReady(user);
            }
        };

        // get the user information
        new BreinifyUser(user, function (user) {

            if (!user.validate()) {
                _onReady(null);
                return;
            }

            // get some default values for the passed parameters - if not set
            sign = typeof sign === 'boolean' ? sign : false;

            // get the other values needed
            var unixTimestamp = BreinifyUtil.unixTimestamp();
            var signature = null;
            if (sign) {
                var secret = _config.get(ATTR_CONFIG.SECRET);
                if (typeof secret === 'string') {
                    var message = _privates.generateRecommendationMessage(nrOfRecommendations, unixTimestamp);
                    signature = _privates.determineSignature(message, _config.get(ATTR_CONFIG.SECRET))
                } else {
                    _onReady(null);
                    return;
                }
            }

            category = typeof category === 'undefined' || category === null ? '' : category;

            // create the data set
            var data = {
                'user': user.all(),

                'recommendation': {
                    'numRecommendations': nrOfRecommendations,
                    'recommendationCategory': category
                },

                'apiKey': _config.get(ATTR_CONFIG.API_KEY),
                'signature': signature,
                'unixTimestamp': unixTimestamp
            };

            if ($.isFunction(onReady)) {
                _onReady(data);
            }
        });
    };

    //noinspection JSCommentMatchesSignature,JSValidateJSDoc
    /**
     * Sends an activity to the Breinify server.
     *
     * @param user {object} the user-information
     * @param type {string|null} the type of activity
     * @param category {string|null} the category (can be null or undefined)
     * @param description {string|null} the description for the activity
     * @param tags {object} added the change to pass in tags
     * @param sign {boolean|null} true if a signature should be added (needs the secret to be configured - not recommended in open systems), otherwise false (can be null or undefined)
     * @param onReady {function|null} function to be executed after triggering the activity
     */
    Breinify.activity = function () {
        var url = _config.get(ATTR_CONFIG.URL) + _config.get(ATTR_CONFIG.ACTIVITY_ENDPOINT);

        overload.overload({
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
        }, arguments, this);
    };

    /**
     * Creates a user instance and executes the specified method.
     *
     * @param user {object} the user-information
     * @param type {string|null} the type of activity
     * @param category {string|null} the category (can be null or undefined)
     * @param description {string|null} the description for the activity
     * @param tags {object} added the change to pass in tags
     * @param sign {boolean|null} true if a signature should be added (needs the secret to be configured - not recommended in open systems), otherwise false (can be null or undefined)
     * @param onReady {function|null} function to be executed after successful user creation
     */
    Breinify.activityUser = function (user, type, category, description, tags, sign, onReady) {

        var _onReady = function (user) {
            if ($.isFunction(onReady)) {
                onReady(user);
            }
        };

        // get the user information
        new BreinifyUser(user, function (user) {

            if (!user.validate()) {
                _onReady(null);
                return;
            }

            // get some default values for the passed parameters - if not set
            type = typeof type === 'undefined' || type === null ? null : type;
            category = typeof category === 'undefined' || category === null ? _config.get(ATTR_CONFIG.CATEGORY) : category;
            description = typeof description === 'undefined' || description === null ? null : description;
            tags = BreinifyUtil.isSimpleObject(tags) ? tags : null;
            sign = typeof sign === 'boolean' ? sign : false;

            // get the other values needed
            var unixTimestamp = BreinifyUtil.unixTimestamp();
            var signature = null;
            if (sign) {
                var secret = _config.get(ATTR_CONFIG.SECRET);
                if (typeof secret === 'string') {
                    var message = _privates.generateActivityMessage(1, unixTimestamp, type);
                    signature = _privates.determineSignature(message, _config.get(ATTR_CONFIG.SECRET))
                } else {
                    _onReady(null);
                    return;
                }
            }

            // create the data set
            var data = {
                'user': user.all(),

                'activity': {
                    'type': type,
                    'category': category,
                    'description': description,
                    'tags': tags
                },

                'apiKey': _config.get(ATTR_CONFIG.API_KEY),
                'signature': signature,
                'unixTimestamp': unixTimestamp
            };

            if ($.isFunction(onReady)) {
                _onReady(data);
            }
        });
    };

    //noinspection JSCommentMatchesSignature,JSValidateJSDoc
    /**
     * Sends an temporalData request to the Breinify backend.
     *
     * @param user {object} the user-information
     * @param sign {boolean|null} true if a signature should be added (needs the secret to be configured - not recommended in open systems), otherwise false (can be null or undefined)
     * @param onReady {function|null} function to be executed after triggering the temporalData request
     */
    Breinify.temporalData = function () {
        var url = _config.get(ATTR_CONFIG.URL) + _config.get(ATTR_CONFIG.TEMPORAL_DATA_ENDPOINT);

        overload.overload({
            'Function': function (callback) {
                Breinify.temporalDataUser({}, false, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Boolean,Function': function (sign, callback) {
                Breinify.temporalDataUser({}, sign, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Function': function (user, callback) {
                Breinify.temporalDataUser(user, false, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Boolean,Function': function (user, sign, callback) {
                Breinify.temporalDataUser(user, sign, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            }
        }, arguments, this);
    };

    /**
     * Creates a user instance and executes the specified method.
     *
     * @param user {object} the user-information
     * @param sign {boolean|null} true if a signature should be added (needs the secret to be configured - not recommended in open systems), otherwise false (can be null or undefined)
     * @param onReady {function|null} function to be executed after successful user creation
     */
    Breinify.temporalDataUser = function (user, sign, onReady) {

        var _onReady = function (user) {
            if ($.isFunction(onReady)) {
                onReady(user);
            }
        };

        // get the user information
        new BreinifyUser(user, function (user) {

            if (!user.validate()) {
                _onReady(null);
                return;
            }

            // get some default values for the passed parameters - if not set
            sign = typeof sign === 'boolean' ? sign : false;

            // get the other values needed
            var unixTimestamp = BreinifyUtil.unixTimestamp();
            var signature = null;
            if (sign) {

                // might be a different secret
                var secret = _config.get(ATTR_CONFIG.SECRET);
                if (typeof secret === 'string') {
                    var localDateTime = user.read('localDateTime');
                    var timezone = user.read('timezone');

                    var message = _privates.generateTemporalDataMessage(unixTimestamp, localDateTime, timezone);
                    signature = _privates.determineSignature(message, _config.get(ATTR_CONFIG.SECRET))
                } else {
                    _onReady(null);
                    return;
                }
            }

            // create the data set
            var data = {
                'user': user.all(),
                'apiKey': _config.get(ATTR_CONFIG.API_KEY),
                'signature': signature,
                'unixTimestamp': unixTimestamp
            };

            if ($.isFunction(onReady)) {
                _onReady(data);
            }
        });
    };

    /**
     * Method to lookup the specified dimensions information.
     */
    Breinify.lookup = function (user, dimensions, sign, onLookUp) {

        Breinify.lookupUser(user, dimensions, sign, function (data) {
            var url = _config.get(ATTR_CONFIG.URL) + _config.get(ATTR_CONFIG.LOOKUP_ENDPOINT);
            _privates.ajax(url, data, onLookUp, onLookUp);
        });
    };

    /**
     * Creates a user request entity used to fire a query against the lookup endpoint.
     *
     * @param user {object} the user-information
     * @param dimensions {Array|string} an array of dimensions
     * @param sign {boolean|null} true if a signature should be added (needs the secret to be configured - not recommended in open systems), otherwise false (can be null or undefined)
     * @param onReady {function|null} function to be executed after successful user creation
     */
    Breinify.lookupUser = function (user, dimensions, sign, onReady) {

        var _onReady = function (user) {
            if ($.isFunction(onReady)) {
                onReady(user);
            }
        };

        // get the user information
        new BreinifyUser(user, function (user) {

            if (!user.validate()) {
                _onReady(null);
                return;
            }

            // get some default values for the passed parameters - if not set
            dimensions = typeof dimensions === 'string' ? [dimensions] : ($.isArray(dimensions) ? dimensions : []);
            sign = typeof sign === 'boolean' ? sign : false;

            // get the other values needed
            var unixTimestamp = BreinifyUtil.unixTimestamp();
            var signature = null;
            if (sign) {
                var secret = _config.get(ATTR_CONFIG.SECRET);
                if (typeof secret === 'string') {
                    var message = _privates.generateLookUpMessage(dimensions, unixTimestamp);
                    signature = _privates.determineSignature(message, _config.get(ATTR_CONFIG.SECRET))
                } else {
                    _onReady(null);
                    return;
                }
            }

            // create the data set
            var data = {
                'user': user.all(),

                'lookup': {
                    'dimensions': dimensions
                },

                'apiKey': _config.get(ATTR_CONFIG.API_KEY),
                'signature': signature,
                'unixTimestamp': unixTimestamp
            };

            if ($.isFunction(onReady)) {
                _onReady(data);
            }
        });
    };

    // bind the utilities to be available through Breinify
    Breinify.UTL = BreinifyUtil;

    //noinspection JSUnresolvedFunction
    misc.export(scope, 'Breinify', Breinify);
}(window, dependencyScope);