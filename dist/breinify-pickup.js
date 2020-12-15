"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('pickUp')) {
        return;
    }

    // bind the jQuery default object $
    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var prefixValidation = Breinify.UTL.constants.errors.prefix.validation;
    var prefixApi = Breinify.UTL.constants.errors.prefix.api;

    var PickUp = {

        addOrder: function () {

            var _self = this;
            overload.overload({
                'String,Object,Function': function (externalId, location, cb) {
                    _self._addOrder({}, {}, [externalId], location, cb);
                },
                'Array,Object,Function': function (externalIds, location, cb) {
                    _self._addOrder({}, {}, externalIds, location, cb);
                },
                'String,Object,Object,Function': function (externalId, location, entity, cb) {
                    _self._addOrder(entity, {}, [externalId], location, cb);
                },
                'Array,Object,Object,Function': function (externalIds, location, entity, cb) {
                    _self._addOrder(entity, {}, externalIds, location, cb);
                },
                'String,Object,Object,Object,Function': function (externalId, user, location, entity, cb) {
                    _self._addOrder(entity, user, [externalId], location, cb);
                },
                'Array,Object,Object,Object,Function': function (externalIds, user, location, entity, cb) {
                    _self._addOrder(entity, user, externalIds, location, cb);
                }
            }, arguments, this);
        },

        _addOrder: function (entity, user, externalIds, location, callback) {
            var _self = this;

            // collect the callbacks and handle the validated values
            var callbacks = Breinify.UTL.internal.cbCollector({
                _callback: function (errors, results) {
                    if (errors === null) {
                        _self._addOrderValidated(results.entity, user, results.externalIds, results.location, callback);
                    } else {
                        for (var key in errors) {
                            if (errors.hasOwnProperty(key)) {
                                var error = errors[key];
                                callback(error);
                                break;
                            }
                        }
                    }
                },
                location: function (error, data) {
                    callbacks._set('location', error, data);
                },
                entity: function (error, data) {
                    callbacks._set('entity', error, data);
                },
                externalIds: function (error, data) {
                    callbacks._set('externalIds', error, data);
                }
            });

            // get the values we received and do a validation
            this._validateLocation(location, callbacks.location);
            this._validateEntity(entity, callbacks.entity);
            this._validateExternalIds(externalIds, callbacks.externalIds);
        },

        _validateExternalIds: function (externalIds, callback) {

            if (typeof externalIds === 'undefined' || externalIds === null) {
                callback(null, null);
                return;
            }

            if ($.isArray(externalIds)) {
                for (var i = 0; i < externalIds.length; i++) {
                    if (typeof externalIds[i] !== "string") {
                        callback(new Error(prefixValidation + 'ExternalIds ' + externalIds[i] + ' must be a string.'));
                        return;
                    }
                }
                callback(null, externalIds);
            } else if (typeof externalIds === 'string' && externalIds.trim() !== '') {
                callback(null, [externalIds]);
            }
        },

        _validateLocation: function (location, callback) {

            if (typeof location === 'undefined' || location === null) {
                callback(null, null);
                return;
            } else if (!$.isPlainObject(location)) {
                callback(new Error(prefixValidation + 'Location must be a plain-object.'));
                return;
            }

            // first take car of the id and name
            var hasId = !Breinify.UTL.isEmpty(location.id);
            var hasName = !Breinify.UTL.isEmpty(location.name);
            if (!hasId && !hasName) {
                callback(new Error(prefixValidation + 'Must specify a location\'s id or name.'));
                return;
            } else if (!hasId) {
                location.id = null;
            } else if (!hasName) {
                location.name = null;
            }

            // if we made it so far
            callback(null, location);
        },

        _validateEntity: function (entity, callback) {

            // check the whole entity
            if (typeof entity === 'undefined' || entity === null) {
                callback(null, null);
                return;
            } else if (!$.isPlainObject(entity)) {
                callback(new Error(prefixValidation + 'Entity must be a plain-object.'));
                return;
            }

            // check the type
            if (typeof entity.type === 'undefined' || entity.type === null) {
                entity.type = 'sms';
            } else if (typeof entity.type !== 'string') {
                callback(new Error(prefixValidation + 'EntityType must be a string (or empty).'));
                return;
            } else if ('sms' !== entity.type) {
                callback(new Error(prefixValidation + 'EntityType ' + entity.type + ' not supported.'));
                return;
            }

            // check the name
            if (typeof entity.name === 'undefined' || entity.name === null) {
                entity.name = null;
            } else if (typeof entity.name !== 'string') {
                callback(new Error(prefixValidation + 'EntityName must be a string (or empty).'));
                return;
            }

            // check the id
            if (typeof entity.id === 'undefined' || entity.id === null) {
                entity.id = null;
            } else if (typeof entity.id !== 'string') {
                callback(new Error(prefixValidation + 'EntityId must be a string (or empty).'));
                return;
            }

            // type specific checking
            if (entity.id === null) {
                // nothing more to do
            } else if (entity.type === 'sms') {

                // test the values
                if (typeof entity.id !== 'string') {
                    callback(new Error(prefixValidation + 'Invalid phone-number (entityId) defined: ' + entity.id));
                    return
                }

                entity.id = entity.id.trim();
                if (!/\+?\d+/.test(entity.id)) {
                    callback(new Error(prefixValidation + 'Invalid phone-number (entityId) defined: ' + entity.id));
                    return;
                }

                // we have a semi-valid something that looks like a possible phone-number
                // to support more advanced validation, it is recommend to use another
                // library https://github.com/googlei18n/libphonenumber
                if (entity.id.indexOf('+') !== 0) {
                    callback(new Error(prefixValidation + 'Phone-number (entityId) must include the country-code (e.g., +1): ' + entity.id));
                    return;
                }
            } else {
                callback(new Error(prefixValidation + 'EntityType ' + entityType + ' not supported.'));
            }

            // if we got so far we are done
            callback(null, entity);
        },

        _addOrderValidated: function (entity, user, externalIds, location, callback) {

            // make sure that the mandatory values are given
            if (externalIds === null) {
                callback(new Error(prefixValidation + 'The pick-up\'s identifier(s) must be set.'));
                return;
            } else if (location === null) {
                callback(new Error(prefixValidation + 'The pick-up\'s location must be set.'));
                return;
            } else if ($.isPlainObject(entity) && entity.id !== null && entity.type === null) {
                callback(new Error(prefixValidation + 'The pick-up\'s entity-type must be set (if the id is specified).'));
                return;
            }

            user = Breinify.UTL.user.create(user);

            var pickUp = {
                'pickUpMessage': 'addPickUp',
                'pickUpExternalIds': externalIds,
                'pickUpLocation': location.name,
                'pickUpLocationId': location.id,
                'pickUpEntities': [{
                    'pickUpEntityId': entity.id,
                    'pickUpEntityType': entity.type,
                    'pickUpEntityName': entity.name
                }]
            };

            // create the tags
            var tags = {
                'messageServiceUserIdentifier': entity.id === null ? 'UNIDENTIFIED' : entity.id,
                'gameKeyword': 'pickup',
                'gameInputText': JSON.stringify(pickUp),
                'messageText': 'ADD PICKUP ' + externalIds[0] +
                ' FOR ' + entity.id +
                ' AT ' + location.name
            };

            // user, type, category, description, tags, callback
            Breinify.activity(user, 'gameSms', null, null, tags, function (data, error) {
                if (typeof error === 'string') {
                    callback(new Error(prefixApi + error));
                } else {
                    callback(null, pickUp);
                }
            });
        }
    };

    // bind the module
    Breinify.plugins._add('pickUp', PickUp);
})();