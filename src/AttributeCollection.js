"use strict";

!function (scope, dependencyScope) {

    //noinspection JSUnresolvedVariable
    var misc = dependencyScope.misc;

    var AttributeCollection = function () {
        this._defaultValues = {};
        this._settings = {};
        this._attributes = {};
    };

    AttributeCollection.prototype = {

        defaults: function () {
            return this._defaultValues;
        },

        default: function (attribute) {
            return this._defaultValues[attribute];
        },

        all: function () {
            return this._attributes;
        },

        add: function (key, setting) {
            var name;
            if ($.isPlainObject(setting)) {
                if (typeof setting.name === 'string') {
                    name = setting.name;
                } else {
                    name = key;
                }
            } else if (typeof setting === 'string') {
                name = setting;
                setting = {
                    name: setting
                }
            } else {
                name = key;
                setting = {
                    name: key
                }
            }

            this._attributes[key] = name;
            this._settings[setting.name] = setting;
            this._defaultValues[setting.name] = setting.defaultValue;
        },

        is: function (attribute) {
            return this._settings.hasOwnProperty(attribute);
        },

        validate: function (attribute, value) {
            var setting = this._settings[attribute];

            if (setting === null || typeof setting === 'undefined') {
                return false;
            } else if ($.isFunction(setting.validate)) {
                return setting.validate(value);
            } else {
                return true;
            }
        },

        validateProperties: function (obj) {
            var instance = this;

            $.each(obj, function (property, value) {

                // check if it's a valid value
                if (!instance.is(property)) {
                    throw new Error('The property "' + property + '" is not a valid attribute.');
                } else if (!instance.validate(property, value)) {
                    throw new Error('The value "' + value + '" is invalid for the property "' + property + '".');
                }
            });

            return true;
        }
    };

    //noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'AttributeCollection', AttributeCollection);
}(window, dependencyScope);