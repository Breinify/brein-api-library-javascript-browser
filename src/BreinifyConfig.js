"use strict";

/**
 * The method has two scopes, the global scope (typically window),
 * and the dependency scope. Within the dependency scope all the
 * dependencies are bound.
 */
!function (scope, dependencyScope) {

    //noinspection JSUnresolvedVariable
    var misc = dependencyScope.misc;
    //noinspection JSUnresolvedVariable
    var AttributeCollection = dependencyScope.AttributeCollection;

    /*
     * Overview of all the different properties available in the configuration.
     */
    var attributes = new AttributeCollection();
    attributes.add('URL', {
        name: 'url',
        defaultValue: 'https://api.breinify.com',
        validate: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim();
        }
    });
    attributes.add('ACTIVITY_ENDPOINT', {
        name: 'activityEndpoint',
        defaultValue: '/activity',
        validate: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim() && value.charAt(0) === '/';
        }
    });
    attributes.add('LOOKUP_ENDPOINT', {
        name: 'lookupEndpoint',
        defaultValue: '/lookup',
        validate: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim() && value.charAt(0) === '/';
        }
    });
    attributes.add('TEMPORAL_DATA_ENDPOINT', {
        name: 'temporaldataEndpoint',
        defaultValue: '/temporaldata',
        validate: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim() && value.charAt(0) === '/';
        }
    });
    attributes.add('RECOMMENDATION_ENDPOINT', {
        name: 'recommendationEndpoint',
        defaultValue: '/recommendation',
        validate: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim() && value.charAt(0) === '/';
        }
    });
    attributes.add('CATEGORY', {
        name: 'category',
        defaultValue: 'other',
        validate: function (value) {
            return value === null || (typeof value === 'string' && '' !== value.trim());
        }
    });
    attributes.add('API_KEY', {
        name: 'apiKey',
        defaultValue: '0000-0000-0000-0000-0000-0000-0000-0000',
        validate: function (value) {

            if (value !== null && typeof value === 'string') {
                return value.match(/([A-Z0-9]{4}\-){7}([A-Z0-9]{4})/);
            } else {
                return false;
            }
        }
    });
    attributes.add('SECRET', {
        name: 'secret',
        defaultValue: null,
        validate: function (value) {
            return value === null || typeof value === 'string';
        }
    });
    attributes.add('VALIDATE', {
        name: 'validate',
        defaultValue: true,
        validate: function (value) {
            return value === true || value === false;
        }
    });
    attributes.add('AJAX_TIMEOUT', {
        name: 'timeout',
        defaultValue: 1000,
        validate: function (value) {
            return $.isNumeric(value);
        }
    });

    var BreinifyConfig = function (config) {
        this.version = '{{PROJECT.VERSION}}';

        /*
         * Validate the passed config-parameters.
         */
        if (typeof config == 'undefined' || config == null) {
            this._config = $.extend({}, attributes.defaults());
        } else if (config instanceof BreinifyConfig) {
            this._config = $.extend({}, attributes.defaults(), config._config);
        } else if ($.isPlainObject(config)) {
            this._config = $.extend({}, attributes.defaults(), config);
        } else {
            throw new Error('The passed parameter "config" is invalid.');
        }

        /*
         * Validate the set configuration.
         */
        this.validate();
    };

    /*
     * Static attributes, someone may change these, so we use
     * a copy for the outer world, internally we evaluate everything
     * against the _attributes_enum.
     */
    BreinifyConfig.ATTRIBUTES = $.extend({}, attributes.all());

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
            var defaults = attributes.defaults();
            return defaults[attribute];
        },

        set: function (attribute, value) {
            this._config[attribute] = value;
            this.validate();
        },

        validate: function (force) {
            if (force === true || this._config.validate === true) {
                return attributes.validateProperties(this._config);
            } else {
                return true;
            }
        }
    };

    //noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'BreinifyConfig', BreinifyConfig);
}(window, dependencyScope);