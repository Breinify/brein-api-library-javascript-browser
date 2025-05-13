//noinspection JSUnresolvedVariable
/**
 * The method has two scopes, the global scope (typically window),
 * and the dependency scope. Within the dependency scope all the
 * dependencies are bound.
 */
!function (scope, dependencyScope) {
    "use strict";

    const misc = dependencyScope.misc;
    if (misc.check(window, 'BreinifyUser', true)) {
        return;
    }

    const AttributeCollection = dependencyScope.AttributeCollection;
    const BreinifyUtil = dependencyScope.BreinifyUtil;

    /*
     * Overview of all the different properties available in the configuration.
     */
    const attributes = new AttributeCollection();

    /*
     * Overview of all the different properties available for a user.
     */
    attributes.add('EMAIL', {
        name: 'email',
        group: 1,
        optional: false
    });
    attributes.add('EMAILS', {
        name: 'emails',
        group: 2,
        optional: false
    });
    attributes.add('FIRSTNAME', {
        name: 'firstName',
        group: 3,
        optional: true
    });
    attributes.add('LASTNAME', {
        name: 'lastName',
        group: 3,
        optional: true
    });
    attributes.add('DATEOFBIRTH', {
        name: 'dateOfBirth',
        group: 3,
        optional: true
    });
    attributes.add('DEVICEID', {
        name: 'deviceId',
        group: 4,
        optional: false
    });
    attributes.add('MD5EMAIL', {
        name: 'md5Email',
        group: 5,
        optional: false
    });
    attributes.add('SESSIONID', {
        name: 'sessionId',
        group: 6,
        optional: false
    });
    attributes.add('SESSIONIDS', {
        name: 'sessionIds',
        group: 7,
        optional: false
    });
    attributes.add('PHONE', {
        name: 'phone',
        group: 8,
        optional: false
    });
    attributes.add('USERID', {
        name: 'userId',
        group: 9,
        optional: false
    });
    attributes.add('USERIDS', {
        name: 'userIds',
        group: 10,
        optional: false
    });
    attributes.add('TWITTERID', {
        name: 'twitterId',
        group: 11,
        optional: false
    });
    attributes.add('additional', {
        validate: function (value) {
            return typeof value === 'undefined' || $.isPlainObject(value);
        }
    });

    const _privates = {
        resolvedGeoLocation: false,
        geoLocation: null,

        resolveGeoLocation: function (callback) {
            const _self = this;

            if (_self.resolvedGeoLocation) {
                callback(_self.geoLocation);
                return;
            }

            const geo = navigator.geolocation;
            const permissions = navigator.permissions;

            // make sure we have a geolocation implementation
            if (typeof geo !== 'object') {
                _self.resolvedGeoLocation = true;
                callback(null);

                return;
            } else if (typeof permissions !== 'object') {
                _self.resolvedGeoLocation = true;
                callback(null);

                return;
            }

            // any error should be caught here
            try {

                // check if the permission is already granted
                permissions.query({name: 'geolocation'}).then(function (permission) {
                    if (permission.state !== 'granted') {
                        _self.resolvedGeoLocation = true;
                        callback(null);

                        return;
                    }

                    geo.getCurrentPosition(function (position) {
                        _self.resolvedGeoLocation = true;
                        _self.geoLocation = {
                            'accuracy': position.coords.accuracy,
                            'latitude': position.coords.latitude,
                            'longitude': position.coords.longitude,
                            'speed': position.coords.speed
                        };

                        callback(_self.geoLocation);
                    }, function () {
                        _self.resolvedGeoLocation = true;
                        callback(null)
                    }, {
                        'timeout': 150
                    });
                }).catch(function(e) {
                    _self.resolvedGeoLocation = true;
                    callback(null);
                });
            } catch (e) {
                _self.resolvedGeoLocation = true;
                callback(null);
            }
        }
    };

    const BreinifyUser = function (user, onReady) {
        const instance = this;
        instance.version = '{{PROJECT.VERSION}}';

        // set the values provided
        instance.setAll(user);

        // set the user-agent to a default value if there isn't one yet
        if (instance.read('userAgent') === null) {
            const userAgent = navigator.userAgent;

            if (!BreinifyUtil.isEmpty(userAgent)) {
                instance.add('userAgent', userAgent);
            }
        }

        // set the referrer to a default value if there isn't one yet
        if (instance.read('referrer') === null) {
            const referrer = document.referrer;

            if (!BreinifyUtil.isEmpty(referrer)) {
                instance.add('referrer', referrer);
            }
        }

        // also add the current URL if not provided
        if (instance.read('url') === null) {
            const url = window.location.href;

            if (!BreinifyUtil.isEmpty(url)) {
                instance.add('url', url);
            }
        }

        // add the timezone
        if (instance.read('timezone') === null) {
            const timezone = BreinifyUtil.timezone();

            if (!BreinifyUtil.isEmpty(timezone)) {
                instance.add('timezone', timezone);
            }
        }

        // add the localDateTime
        if (instance.read('localDateTime') === null) {
            const localDateTime = BreinifyUtil.localDateTime();

            if (!BreinifyUtil.isEmpty(localDateTime)) {
                instance.add('localDateTime', localDateTime);
            }
        }

        // try to set the location if there isn't one yet
        const location = instance.read('location');
        const hasLocation = $.isPlainObject(location) && typeof location.latitude === 'number' && typeof location.longitude === 'number';
        if (!hasLocation && $.isFunction(onReady)) {
            instance.addGeoLocation(onReady);
        } else if ($.isFunction(onReady)) {
            onReady(instance);
        }
    };

    /*
     * Static attributes, someone may change these, so we use
     * a copy for the outer world, internally we evaluate everything
     * against the _attributes_enum.
     */
    BreinifyUser.ATTRIBUTES = $.extend({}, attributes.all());

    /*
     * The prototype of the user.
     */
    BreinifyUser.prototype = {

        addGeoLocation: function (onReady) {
            const instance = this;

            _privates.resolveGeoLocation(function (location) {
                if (!BreinifyUtil.isEmpty(location)) {
                    instance.add('location', location);
                }

                if ($.isFunction(onReady)) {
                    onReady(instance);
                }
            });
        },

        add: function (additional, value) {

            if (!$.isPlainObject(this._user)) {
                this._user = {
                    'additional': {}
                };
            } else if (!$.isPlainObject(this._user.additional)) {
                this._user['additional'] = {};
            }

            if ($.isPlainObject(additional) && typeof value === 'undefined') {
                $.extend(this._user.additional, additional)
            } else if (typeof additional === 'string' && typeof value !== 'undefined') {
                const additionalValue = {};
                additionalValue[additional] = value;

                this._user.additional = $.extend(true, {}, this._user.additional, additionalValue);
            } else {
                throw new Error('The additional must be a plain object');
            }
        },

        read: function (additional) {
            if (!$.isPlainObject(this._user) || !$.isPlainObject(this._user.additional)) {
                return null;
            } else if (this._user.additional.hasOwnProperty(additional)) {
                return this._user.additional[additional];
            } else {
                return null;
            }
        },

        get: function (attribute) {
            if (!$.isPlainObject(this._user) || !attributes.is(attribute)) {
                return null;
            } else if (this._user.hasOwnProperty(attribute)) {
                return this._user[attribute];
            } else {
                return null;
            }
        },

        all: function () {
            return this._user;
        },

        set: function (attribute, value) {

            if (!attributes.is(attribute)) {
                throw new Error('The attribute "' + attribute + '" is not supported by a user.');
            } else if (attribute === BreinifyUser.ATTRIBUTES.EMAIL) {
                this.reset(BreinifyUser.ATTRIBUTES.MD5EMAIL);

                if (!BreinifyUtil.isEmpty(value)) {
                    //noinspection JSUnresolvedFunction
                    this.set(BreinifyUser.ATTRIBUTES.MD5EMAIL, BreinifyUtil.md5(value));
                }
            } else if (attribute === BreinifyUser.ATTRIBUTES.MD5EMAIL) {
                const email = this.get(BreinifyUser.ATTRIBUTES.EMAIL);

                // if we have an email, we do not change the MD5
                if (email !== null) {
                    return;
                }
            }

            // make sure we have a user instance
            if (!$.isPlainObject(this._user)) {
                this._user = {};
            }

            // if the attribute is an empty value, we reset it
            if (BreinifyUtil.isEmpty(value)) {
                this.reset(attribute);
            } else {
                this._user[attribute] = value;
            }
        },

        reset: function (attribute) {
            if ($.isPlainObject(this._user)) {
                delete this._user[attribute];
            }
        },

        setAll: function (user) {

            let plainUser = {};
            if (typeof user === 'undefined' || user == null) {
                // nothing to do
            } else if (user instanceof BreinifyUser) {
                plainUser = user._user;
            } else if ($.isPlainObject(user)) {
                plainUser = user;
            } else {
                throw new Error('The passed parameter "user" is invalid.');
            }

            let instance = this;
            $.each(plainUser, function (attribute, value) {
                if (attribute === 'additional') {
                    instance.add(value);
                } else {
                    instance.set(attribute, value);
                }
            });
        },

        validate: function () {
            return attributes.validateProperties(this._user);
        }
    };

    //noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'BreinifyUser', BreinifyUser, true);
}(window, dependencyScope);