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
            if (typeof func === 'function') {
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
                if (typeof arg === 'undefined' || arg === null) {
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
                var typeRegEx = new RegExp('^' + types.toString() + '$', 'i');

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

                // send also the credentials
                'xhrFields': {
                    'withCredentials': _config.get(ATTR_CONFIG.AJAX_WITH_CREDENTIALS)
                },

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

        generateRecommendationMessage: function (recommendation, unixTimestamp) {
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
        },

        handleUtmParameters: function () {

            // get the mapper to be used
            var mapper = _config.get(ATTR_CONFIG.UTM_MAPPER);
            if (typeof mapper !== 'function') {
                return;
            }

            // see https://en.wikipedia.org/wiki/UTM_parameters
            var params = BreinifyUtil.loc.params();

            var utmSource = Breinify.UTL.isEmpty(params['utm_source']) ? null : params['utm_source'];
            var utmMedium = Breinify.UTL.isEmpty(params['utm_medium']) ? null : params['utm_medium'];
            var utmCampaign = Breinify.UTL.isEmpty(params['utm_campaign']) ? null : params['utm_campaign'];
            var utmTerm = Breinify.UTL.isEmpty(params['utm_term']) ? null : params['utm_term'];
            var utmContent = Breinify.UTL.isEmpty(params['utm_content']) ? null : params['utm_content'];

            // check if we even have parameters, otherwise return
            if (Breinify.UTL.isEmpty(utmSource) && Breinify.UTL.isEmpty(utmMedium) && Breinify.UTL.isEmpty(utmCampaign) &&
                Breinify.UTL.isEmpty(utmTerm) && Breinify.UTL.isEmpty(utmContent)) {
                return;
            }

            // create the data
            var result = mapper({
                'utmSource': utmSource,
                'utmMedium': utmMedium,
                'utmCampaign': utmCampaign,
                'utmTerm': utmTerm,
                'utmContent': utmContent
            }, Breinify.UTL.user.create());

            // make sure we have a result and send the activity
            if ($.isPlainObject(result) && $.isPlainObject(result.user) && $.isPlainObject(result.utmData)) {
                Breinify.activity(result.user, 'utmData', null, null, result.utmData);
            }
        },

        handleGetParameters: function () {
            var knownParams = {
                'brec': {
                    'activity': {
                        'type': 'clickedRecommendation'
                    }
                },
                'btrk': {
                    'activity': {
                        'type': 'clickedTracking'
                    }
                }
            };

            var result = {};
            var params = BreinifyUtil.loc.params();

            // check for known types
            for (var knownParam in knownParams) {

                // skip if the are not own properties
                if (!knownParams.hasOwnProperty(knownParam)) {
                    continue;
                }
                // check if the parameter is set
                else if (!params.hasOwnProperty(knownParam)) {
                    continue;
                }

                // handle the parameter
                _privates.handleGetParameter(knownParam, params[knownParam], knownParams[knownParam]);
            }
        },

        handleGetParameter: function (name, value, overrides) {

            // parse it and make sure it was parseable
            var parsedValue = _privates.parseGetParameter(name, value);
            if (parsedValue === null) {
                return;
            }

            // get the mapper to be used
            var mapper = _config.get(ATTR_CONFIG.PARAMETERS_MAPPER);
            if (typeof mapper !== 'function') {
                mapper = function (data) {
                    return data;
                };
            }

            var combinedValue = mapper($.extend(true, {
                'user': Breinify.UTL.user.create(),
                'activity': {
                    'category': null,
                    'description': null,
                    'tags': {}
                }
            }, parsedValue, overrides));

            // calculate a hash as unique identifier
            var hashId = BreinifyUtil.md5(JSON.stringify(combinedValue));
            if (BreinifyUtil.cookie.check(hashId)) {
                return;
            }

            /*
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
            var user = combinedValue.user;
            var activity = combinedValue.activity;
            Breinify.activity(user, activity.type, activity.category, activity.description, activity.tags, null, function () {

                // mark it as successfully sent
                BreinifyUtil.cookie.set(hashId, true);
            });
        },

        parseGetParameter: function (name, value) {

            var base64;
            if (typeof value !== 'string' || value === null) {
                return null;
            } else if (value.charAt(0) === '.') {
                base64 = value.substr(1)
                    .replace(/~/g, '+')
                    .replace(/-/g, '/')
                    .replace(/_/g, '=');
            } else {
                base64 = decodeURIComponent(value);
            }

            try {
                return JSON.parse(atob(base64));
            } catch (e) {
                return null;
            }
        },

        createUser: function (user, onSuccess) {
            new BreinifyUser(BreinifyUtil.user.create(user), onSuccess);
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

        // trigger the Breinify ready event on both jQuery instances
        $(document).trigger('breinifyReady');
        if (typeof window.$ === 'function' && typeof window.$.fn === 'function') {
            window.$(document).trigger('breinifyReady');
        }

        // if the parameters should be handled it's done directly after the configuration is set
        if (_config.get(ATTR_CONFIG.HANDLE_PARAMETERS) === true) {
            _privates.handleGetParameters();
        }

        // check if UTM should be handled
        if (_config.get(ATTR_CONFIG.HANDLE_UTM) === true) {
            _privates.handleUtmParameters();
        }
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
                Breinify.recommendationUser(user, {
                    'numRecommendations': 3
                }, false, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Number,Function': function (user, nrOfRecommendations, callback) {
                Breinify.recommendationUser(user, {
                    'numRecommendations': nrOfRecommendations
                }, false, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Number,String,Function': function (user, nrOfRecommendations, category, callback) {
                Breinify.recommendationUser(user, {
                    'numRecommendations': nrOfRecommendations,
                    'recommendationCategory': category
                }, false, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Number,Boolean,Function': function (user, nrOfRecommendations, sign, callback) {
                Breinify.recommendationUser(user, {
                    'numRecommendations': nrOfRecommendations
                }, sign, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Number,String,Boolean,Function': function (user, nrOfRecommendations, category, sign, callback) {
                Breinify.recommendationUser(user, {
                    'numRecommendations': nrOfRecommendations,
                    'recommendationCategory': category
                }, sign, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Object,Function': function (user, recommendation, callback) {
                Breinify.recommendationUser(user, recommendation, false, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            },
            'Object,Object,Boolean,Function': function (user, recommendation, sign, callback) {
                Breinify.recommendationUser(user, recommendation, sign, function (data) {
                    _privates.ajax(url, data, callback, callback);
                });
            }
        }, arguments, this);
    };

    /**
     * Creates a user instance and executes the specified method.
     *
     * @param user {object} the user-information
     * @param recommendation the instance of the recommendations settings
     * @param sign {boolean|null} true if a signature should be added (needs the secret to be configured - not recommended in open systems), otherwise false (can be null or undefined)
     * @param onReady {function|null} function to be executed after successful user creation
     */
    Breinify.recommendationUser = function (user, recommendation, sign, onReady) {

        var _onReady = function (user) {
            if ($.isFunction(onReady)) {
                onReady(user);
            }
        };

        // get the user information
        _privates.createUser(user, function (user) {

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
                    var message = _privates.generateRecommendationMessage(recommendation, unixTimestamp);
                    signature = _privates.determineSignature(message, _config.get(ATTR_CONFIG.SECRET))
                } else {
                    _onReady(null);
                    return;
                }
            }

            // create the data set
            var data = {
                'user': user.all(),

                'recommendation': recommendation,

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
                Breinify.activityUser(user, type, null, null, null, null, function (data) {
                    _privates.ajax(url, data);
                });
            },
            'Object,String,Object': function (user, type, tags) {
                Breinify.activityUser(user, type, null, null, tags, null, function (data) {
                    _privates.ajax(url, data);
                });
            },
            'Object,String,String,Object': function (user, type, description, tags) {
                Breinify.activityUser(user, type, null, description, tags, null, function (data) {
                    _privates.ajax(url, data);
                });
            },
            'Object,String,String,String,Object': function (user, type, category, description, tags) {
                Breinify.activityUser(user, type, category, description, tags, null, function (data) {
                    _privates.ajax(url, data);
                });
            },
            'Object,String,String,String,Object,Function': function (user, type, category, description, tags, callback) {
                Breinify.activityUser(user, type, category, description, tags, null, function (data) {
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
        _privates.createUser(user, function (user) {

            if (!user.validate()) {
                _onReady(null);
                return;
            }

            // get some default values for the passed parameters - if not set
            type = typeof type === 'undefined' || type === null ? null : type;
            category = typeof category === 'undefined' || category === null ? _config.get(ATTR_CONFIG.CATEGORY) : category;
            description = typeof description === 'undefined' || description === null ? null : description;
            tags = BreinifyUtil.isSimpleObject(tags) ? tags : null;
            sign = typeof sign === 'boolean' ? sign : (sign === null ? !BreinifyUtil.isEmpty(_config.get(ATTR_CONFIG.SECRET)) : false);

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
        _privates.createUser(user, function (user) {

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
        _privates.createUser(user, function (user) {

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

    // also set a plug-ins instance, with the needed accessible stuff
    Breinify.plugins = {
        _overload: function () {
            return overload;
        },

        _addCustomization: function (name, customization) {

            var customizations = this[BreinifyConfig.CONSTANTS.CUSTOMER_PLUGIN];
            if (!$.isPlainObject(customizations)) {
                customizations = this._add(BreinifyConfig.CONSTANTS.CUSTOMER_PLUGIN, {});
            }

            // add the customization
            customizations[name] = customization;
        },

        _getCustomization: function (name) {
            var customerPlugIn = this[BreinifyConfig.CONSTANTS.CUSTOMER_PLUGIN];
            if (!$.isPlainObject(customerPlugIn)) {
                return null;
            }

            var plugIn = customerPlugIn[name];
            if (!$.isPlainObject(plugIn)) {
                return null;
            }

            return plugIn;
        },

        _add: function (name, plugin, def) {
            var defConfig = $.isPlainObject(def) ? def : {};

            this[name] = $.extend({
                config: defConfig,

                setConfig: function (key, value) {
                    if ($.isPlainObject(key) && (typeof value === 'undefined' || value == null)) {
                        this.config = $.extend(this.config, key);
                    } else if (typeof key === 'string') {
                        this.config[key] = value;
                    } else {
                        // ignore
                    }

                    // trigger an onConfigChange
                    if (typeof this['_onConfigChange'] === 'function') {
                        this['_onConfigChange']();
                    }
                },

                getConfig: function (key, def) {
                    var current = this.config[key];
                    if (typeof current === 'undefined') {
                        return typeof def === 'undefined' ? null : def;
                    } else {
                        return current;
                    }
                }
            }, plugin);

            return this[name];
        }
    };

    //noinspection JSUnresolvedFunction
    misc.export(scope, 'Breinify', Breinify);
}(window, dependencyScope);