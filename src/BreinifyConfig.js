//noinspection JSUnresolvedVariable
/**
 * The method has two scopes, the global scope (typically window),
 * and the dependency scope. Within the dependency scope all the
 * dependencies are bound.
 */
!function (scope, dependencyScope) {

    //noinspection JSUnresolvedVariable
    var misc = dependencyScope.misc;

    // the two instances will be used internally as constants
    var _defaultConfig = {};
    var _settings = {};
    var _attributes = {};

    /*
     * Create the _attributes and _defaultConfig and the internally used
     * _attributes_enum for validation.
     */
    var _attributes_enum = {
        add: function (key, setting) {
            _attributes[key] = setting.name;
            _settings[setting.name] = setting;
            _defaultConfig[setting.name] = setting.defaultValue;
        },

        is: function (attribute) {
            return _settings.hasOwnProperty(attribute);
        },

        validate: function (attribute, value) {
            var setting = _settings[attribute];

            if (setting === null || typeof setting === 'undefined') {
                return false;
            } else if ($.isFunction(setting.validate)) {
                return setting.validate(value);
            } else {
                return true;
            }
        },

        setAll: function () {
            var instance = this;

            $.each(this, function (key, setting) {
                instance.add(key, setting);
            });
        },

        validateConfig: function (config) {
            var instance = this;

            $.each(config, function (property, value) {

                // check if it's a valid value
                if (!instance.is(property)) {
                    throw new Error('The property "' + property + '" is not a valid attribute for the configuration.');
                } else if (!instance.validate(property, value)) {
                    throw new Error('The value "' + value + '" is invalid for the property "' + property + '".');
                }
            });
        }
    };

    /*
     * Overview of all the different properties available in the configuration.
     */
    _attributes_enum.URL = {
        name: 'url',
        defaultValue: 'https://api.breinify.com',
        validate: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim();
        }
    };
    _attributes_enum.ACTIVITY_ENDPOINT = {
        name: 'activityEndpoint',
        defaultValue: '/activity',
        validate: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim() && value.charAt(0) === '/';
        }
    };
    _attributes_enum.LOOKUP_ENDPOINT = {
        name: 'lookupEndpoint',
        defaultValue: '/lookup',
        validate: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim() && value.charAt(0) === '/';
        }
    };
    _attributes_enum.CATEGORY = {
        name: 'category',
        defaultValue: 'other',
        validate: function (value) {
            return value === null || (typeof value === 'string' && '' !== value.trim());
        }
    };
    _attributes_enum.API_KEY = {
        name: 'apiKey',
        defaultValue: '0000-0000-0000-0000-0000-0000-0000-0000',
        validate: function (value) {

            if (value !== null && typeof value === 'string') {
                return value.match(/([A-Z0-9]{4}\-){7}([A-Z0-9]{4})/);
            } else {
                return false;
            }
        }
    };
    _attributes_enum.SECRET = {
        name: 'secret',
        defaultValue: null,
        validate: function (value) {
            return value === null || typeof value === 'string';
        }
    };
    _attributes_enum.VALIDATE = {
        name: 'validate',
        defaultValue: true,
        validate: function (value) {
            return value === true || value === false;
        }
    };
    _attributes_enum.setAll();

    var BreinifyConfig = function (config) {
        this.version = '{{PROJECT.VERSION}}';

        /*
         * Validate the passed config-parameters.
         */
        if (typeof config == 'undefined' || config == null) {
            this._config = $.extend({}, _defaultConfig);
        } else if (config instanceof BreinifyConfig) {
            this._config = $.extend({}, _defaultConfig, config._config);
        } else if ($.isPlainObject(config)) {
            this._config = $.extend({}, _defaultConfig, config);
        } else {
            throw new Error('The passed parameter "config" is invalid.');
        }

        /*
         * Validate the set configuration.
         */
        if (this._config.validate === true) {
            _attributes_enum.validateConfig(this._config);
        }
    };

    /*
     * Static attributes, someone may change these, so we use
     * a copy for the outer world, internally we evaluate everything
     * against the _attributes_enum.
     */
    BreinifyConfig.ATTRIBUTES = $.extend({}, _attributes);

    /*
     * The prototype of the configuration.
     */
    BreinifyConfig.prototype = {

        get: function (attribute) {
            return this._config[attribute];
        },

        all: function () {
            return this._config;
        },

        default: function (attribute) {
            return _defaultConfig[attribute];
        },

        set: function (attribute, value) {

            // set the new value
            this._config[attribute] = value;

            // validate it
            _attributes_enum.validateConfig(this._config);
        }
    };

    //noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'BreinifyConfig', BreinifyConfig);
}(window, dependencyScope);