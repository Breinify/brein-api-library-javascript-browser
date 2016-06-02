//noinspection JSUnresolvedVariable
/**
 * The method has two scopes, the global scope (typically window),
 * and the dependency scope. Within the dependency scope all the
 * dependencies are bound.
 */
!function (scope, dependencyScope) {
    "use strict";

    //noinspection JSUnresolvedVariable
    var misc = dependencyScope.misc;

    // the two instances will be used internally as constants
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
        },

        is: function (attribute) {
            return _settings.hasOwnProperty(attribute);
        },

        setAll: function () {
            var instance = this;

            $.each(this, function (key, setting) {
                instance.add(key, setting);
            });
        }
    };

    /*
     * Overview of all the different properties available for a user.
     */
    _attributes_enum.EMAIL = {
        name: 'email',
        group: 1,
        optional: false,
        is: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim();
        }
    };
    _attributes_enum.FIRSTNAME = {
        name: 'firstName',
        group: 2,
        optional: false,
        validate: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim() && value.charAt(0) === '/';
        }
    };
    _attributes_enum.LASTNAME = {
        name: 'lastName',
        group: 2,
        optional: false,
        validate: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim() && value.charAt(0) === '/';
        }
    };
    _attributes_enum.DATEOFBIRTH = {
        name: 'dateOfBirth',
        group: 2,
        optional: false,
        validate: function (value) {
            return value === null || (typeof value === 'string' && '' !== value.trim());
        }
    };
    _attributes_enum.DEVICEID = {
        name: 'deviceId',
        group: 3,
        optional: false,
        is: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim();
        }
    };
    _attributes_enum.MD5EMAIL = {
        name: 'md5Email',
        group: 4,
        optional: false,
        is: function (value) {
            return value !== null && typeof value === 'string' && '' !== value.trim();
        }
    };
    _attributes_enum.setAll();

    var _privates = {

        resolveGeoLocation: function (callback) {

            var geo = navigator.geolocation;
            //noinspection JSUnresolvedVariable
            var permissions = navigator.permissions;

            // make sure we have a geolocation implementation
            if (typeof geo !== 'object') {
                callback(null);
            } else if (typeof permissions !== 'object') {
                callback(null);
            } else {

                // check if the permission is already granted
                permissions.query({name: 'geolocation'}).then(function (permission) {
                    if (permission.state === 'granted') {
                        geo.getCurrentPosition(
                            function (position) {
                                callback({
                                    'accuracy': position.coords.accuracy,
                                    'latitude': position.coords.latitude,
                                    'longitude': position.coords.longitude,
                                    'speed': position.coords.speed
                                });
                            }, function () {
                                callback(null)
                            }, {
                                'timeout': 150
                            });
                    } else {
                        callback(null);
                    }
                });
            }
        }
    };

    var BreinifyUser = function (user, onReady) {
        var instance = this;
        instance.version = '{{PROJECT.VERSION}}';
        instance._user = {};

        _privates.resolveGeoLocation(function (location) {

            /*
             * Get the default values we have for the user
             */
            instance.addAdditional({
                'userAgent': navigator.userAgent,
                'location': location
            });

            /*
             * Validate the passed user-parameters.
             */
            if (typeof user == 'undefined' || user == null) {
                // nothing to do, we don't have more
            } else if (user instanceof BreinifyUser) {
                $.extend(true, instance._user, user._user);
            } else if ($.isPlainObject(user)) {
                $.extend(true, instance._user, user);
            } else {
                throw new Error('The passed parameter "user" is invalid.');
            }

            if (instance._user.hasOwnProperty(_attributes.EMAIL) && !instance._user.hasOwnProperty(_attributes.MD5EMAIL)) {
                //noinspection JSUnresolvedVariable,JSUnresolvedFunction
                instance._user[_attributes.MD5EMAIL] = CryptoJS.MD5(instance._user[_attributes.EMAIL]).toString(CryptoJS.enc.Base64)
            }

            if ($.isFunction(onReady)) {
                onReady(instance);
            }
        });
    };

    /*
     * Static attributes, someone may change these, so we use
     * a copy for the outer world, internally we evaluate everything
     * against the _attributes_enum.
     */
    BreinifyUser.ATTRIBUTES = $.extend({}, _attributes);

    /*
     * The prototype of the user.
     */
    BreinifyUser.prototype = {

        addAdditional: function (additional) {
            if (!$.isPlainObject(additional)) {
                throw new Error('The additional must be a plain object');
            }

            this._user.additional = $.extend(this._user.additional, additional)
        },

        get: function (attribute) {
            return this._user[attribute];
        },

        all: function () {
            return this._user;
        },

        set: function (attribute, value) {

            // set the new value
            this._user[attribute] = value;
        },

        isValid: function () {


            return true;
        }
    };

    //noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'BreinifyUser', BreinifyUser);
}(window, dependencyScope);