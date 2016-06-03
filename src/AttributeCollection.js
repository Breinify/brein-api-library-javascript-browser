"use strict";

!function (scope, dependencyScope) {

    //noinspection JSUnresolvedVariable
    var misc = dependencyScope.misc;

    var AttributeCollection = function () {
        this._defaultValues = {};
        this._settings = {};
        this._attributes = {};
        this._groups = {};
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

        /**
         * Adds a key to the attributes. The settings define some settings for the specified attribute, i.e.,
         * - name (optional string, default key, defines the name of the attributes, used to read from an object)
         * - validate (optional function, default none, function triggered to validate a value of the attribute)
         * - defaultValue (optional, default undefined, the value used if no value is defined)
         * - group (optional unique identifier, default undefined, specifies a group of attributes, which may have to be present if one is set
         * - optional (optional boolean, default true, specifies if the attribute has to have a value when in a group)
         *
         * @param {string} key the key used to access the attributes name from outside
         * @param {object} setting the settings of the attribute
         */
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
            this._settings[name] = setting;
            this._defaultValues[name] = setting.defaultValue;

            if (typeof setting.group !== 'undefined' && setting.optional === false) {
                var group = this._groups[setting.group];
                if (!$.isArray(group)) {
                    group = [];
                    this._groups[setting.group] = group;
                }

                group.push(setting);
            }
        },

        is: function (attribute) {
            return this._settings.hasOwnProperty(attribute);
        },

        setting: function (attribute) {
            var setting = this._settings[attribute];

            if (setting === null || typeof setting === 'undefined') {
                return null;
            } else {
                return setting;
            }
        },

        group: function (attribute) {
            var group = this._groups[attribute];

            if (group === null || typeof group === 'undefined') {
                return null;
            } else {
                return group;
            }
        },

        validate: function (attribute, value) {
            var setting = this.setting(attribute);

            if (setting === null) {
                return false;
            } else if ($.isFunction(setting.validate)) {
                return setting.validate(value);
            } else {
                return true;
            }
        },

        validateProperties: function (obj) {
            var instance = this;
            var groups = {};

            $.each(obj, function (attribute, value) {

                // check if it's a valid value
                if (!instance.is(attribute)) {
                    throw new Error('The attribute "' + attribute + '" is not valid.');
                } else if (!instance.validate(attribute, value)) {
                    throw new Error('The value "' + value + '" is invalid for the property "' + attribute + '".');
                }

                var setting = instance.setting(attribute);
                var groupName = setting.group;

                if (typeof groupName !== 'undefined' && setting.optional === false) {
                    var group = groups[groupName];
                    if (!$.isArray(group)) {
                        group = [];
                        groups[groupName] = group;
                    }

                    group.push(setting.name);
                }
            });

            console.log("FOUND GROUPS: " + JSON.stringify(groups));

            // check the groups, we validate if for each found group the needed values exists
            $.each(groups, function (groupName, attributeNames) {
                var group = instance.group(groupName);

                // get all the settings for the group (i.e., all the none-optional attributes)
                $.each(group, function (idx, groupSetting) {
                    if ($.inArray(groupSetting.name, attributeNames) === -1) {
                        throw new Error('The group "' + groupName + '" expects a valid value for the attribute "' + groupSetting.name + '".');
                    }
                });
            });

            return true;
        }
    };

    //noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'AttributeCollection', AttributeCollection);
}(window, dependencyScope);