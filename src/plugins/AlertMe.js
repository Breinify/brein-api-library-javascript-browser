"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }

    // bind the jQuery default object $
    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var prefixValidation = Breinify.UTL.constants.errors.prefix.validation;
    var prefixApi = Breinify.UTL.constants.errors.prefix.api;

    var AlertMe = {

        set: function () {

            var _self = this;
            overload.overload({
                'String,Object,Object,Object,Function': function (to, product, location, time, cb) {
                    _self._set(to, {}, product, location, time, cb);
                },
                'String,Object,Array,Object,Function': function (to, product, locations, time, cb) {
                    _self._set(to, {}, product, locations, time, cb);
                },
                'String,String,Object,Object,Function': function (to, product, location, time, cb) {
                    _self._set(to, {}, {sku: product}, location, time, cb);
                },
                'String,String,Array,Object,Function': function (to, product, locations, time, cb) {
                    _self._set(to, {}, {sku: product}, locations, time, cb);
                },
                'String,Object,Object,Object,Object,Function': function (to, user, product, location, time, cb) {
                    _self._set(to, user, product, location, time, cb);
                },
                'String,Object,Object,Array,Object,Function': function (to, user, product, locations, time, cb) {
                    _self._set(to, user, product, locations, time, cb);
                },
                'String,Object,String,Object,Object,Function': function (to, user, product, location, time, cb) {
                    _self._set(to, user, {sku: product}, location, time, cb);
                },
                'String,Object,String,Array,Object,Function': function (to, user, product, locations, time, cb) {
                    _self._set(to, user, {sku: product}, locations, time, cb);
                }
            }, arguments, this);
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

            // next validate the type
            var validTypes = this.getConfig('locationTypes', [/.*/]);
            var hasType = !Breinify.UTL.isEmpty(location.type);
            if (!hasType) {
                callback(new Error(prefixValidation + 'Must specify a location\'s type.'));
                return;
            } else if (!$.isArray(validTypes)) {
                callback(new Error(prefixValidation + 'Invalid locationTypes configuration: ' + JSON.stringify(validTypes)));
                return;
            }

            var isValidType = false;
            for (var i = 0; i < validTypes.length; i++) {
                var validType = validTypes[i];
                if (typeof validType === 'string' && validType === location.type) {
                    isValidType = true;
                    break;
                } else if (validType instanceof RegExp && validType.test(location.type)) {
                    isValidType = true;
                    break;
                }
            }
            if (!isValidType) {
                callback(new Error(prefixValidation + 'Invalid location-type specified: ' + location.type));
                return;
            }

            // if we made it so far
            callback(null, location);
        },

        _validateLocations: function (locations, callback) {
            if (typeof locations === 'undefined' || locations === null) {
                return null;
            } else if ($.isArray(locations)) {
                var validatedLocations = [];
                var failedLocations = [];
                for (var i = 0; i < locations.length; i++) {
                    this._validateLocation(locations[i], function (error, result) {

                        // check the result
                        if (error === null) {
                            validatedLocations.push(result);
                        } else {
                            failedLocations.push(error);
                        }

                        // determine if we are done
                        if (failedLocations.length + validatedLocations.length === locations.length) {
                            if (failedLocations.length > 0) {
                                callback(failedLocations[0]);
                            } else {
                                callback(null, validatedLocations);
                            }
                        }
                    });
                }
            } else if ($.isPlainObject(locations)) {
                this._validateLocation(locations, function (error, result) {
                    callback(error, result ? [result] : null);
                });
            } else {
                callback(new Error(prefixValidation + 'The specified locations cannot be validated.'));
            }
        },

        _validateTime: function (time, callback) {
            if (typeof time === 'undefined' || time === null) {
                callback(null, null);
                return;
            } else if (!$.isPlainObject(time)) {
                callback(new Error(prefixValidation + 'Time must be a plain-object.'));
                return;
            }

            var hasStart = !Breinify.UTL.isEmpty(time.start) && typeof time.start === 'number';
            var hasEnd = !Breinify.UTL.isEmpty(time.end) && typeof time.end === 'number';
            if (!hasStart || !hasEnd) {
                callback(new Error(prefixValidation + 'Time must have a start and end defined.'));
            } else if (time.start >= time.end) {
                callback(new Error(prefixValidation + 'The start must be smaller than the end.'));
            } else if (time.start < 0 || time.end < 0) {
                callback(new Error(prefixValidation + 'The start and end must be larger than 0.'));
            } else if (time.start > 24 * 60 * 60 || time.end > 24 * 60 * 60) {
                callback(new Error(prefixValidation + 'The start and end must be smaller than ' + (24 * 60 * 60) + ' (max. seconds until midnight).'));
            }

            // check the weekdays and weekends
            time.weekdays = typeof time.weekdays === 'boolean' ? time.weekdays : true;
            time.weekends = typeof time.weekends === 'boolean' ? time.weekends : false;
            if (time.weekdays === false && time.weekends === false) {
                callback(new Error(prefixValidation + 'The time must be specified for at least one type of days (i.e., weekdays or weekends).'));
            }

            callback(null, time);
        },

        _validateProduct: function (product, callback) {
            if (typeof product === 'undefined' || product === null) {
                callback(null, null);
                return;
            } else if (!$.isPlainObject(product)) {
                callback(new Error(prefixValidation + 'Product must be a plain-object.'));
                return;
            }

            // first take car of the id and name
            var hasId = !Breinify.UTL.isEmpty(product.sku);
            var hasName = !Breinify.UTL.isEmpty(product.name);
            if (!hasId && !hasName) {
                callback(new Error(prefixValidation + 'Must specify a product\'s sku or name.'));
                return;
            } else if (!hasId) {
                product.sku = null;
            } else if (!hasName) {
                product.name = null;
            }

            callback(null, product);
        },

        _validatePhoneNumber: function (number, allowShortCode, callback) {
            if (number === null) {
                callback(null, null);
                return;
            }
            if (typeof number === 'number') {
                number = '' + number;
            }

            // test the values
            if (typeof number !== 'string') {
                callback(new Error(prefixValidation + 'Invalid phone-number defined: ' + number));
                return
            }

            number = number.trim();
            if (!/\+?\d+/.test(number)) {
                callback(new Error(prefixValidation + 'Invalid phone-number defined: ' + number));
                return;
            }

            // we have a semi-valid something that looks like a possible phone-number
            // to support more advanced validation, it is recommend to use another
            // library https://github.com/googlei18n/libphonenumber
            if (!allowShortCode && number.indexOf('+') !== 0) {
                callback(new Error(prefixValidation + 'Phone-number must include the country-code (e.g., +1): ' + number));
                return;
            }

            callback(null, number);
        },

        _set: function (to, user, product, locations, time, callback) {
            var _self = this;

            // collect the callbacks and handle the validated values
            var callbacks = Breinify.UTL.internal.cbCollector({
                _callback: function (errors, results) {
                    if (errors === null) {
                        _self._setValidated(results.from, results.to, user, results.product, results.locations, results.time, callback);
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
                locations: function (error, data) {
                    callbacks._set('locations', error, data);
                },
                from: function (error, data) {
                    callbacks._set('from', error, data);
                },
                to: function (error, data) {
                    callbacks._set('to', error, data);
                },
                product: function (error, data) {
                    callbacks._set('product', error, data);
                },
                time: function (error, data) {
                    callbacks._set('time', error, data);
                }
            });

            // get the values we received and do a validation
            this._validateLocations(locations, callbacks.locations);
            this._validatePhoneNumber(this.getConfig('from', null), true, callbacks.from);
            this._validatePhoneNumber(to, false, callbacks.to);
            this._validateProduct(product, callbacks.product);
            this._validateTime(time, callbacks.time);
        },

        _setValidated: function (from, to, user, product, locations, time, callback) {

            // make sure that the mandatory values are given
            if (from === null) {
                callback(new Error(prefixValidation + 'The alert\'s from-number must be configured (see configuration).'));
                return;
            } else if (to === null) {
                callback(new Error(prefixValidation + 'The alert\'s to-number must be set.'));
                return;
            } else if (product === null) {
                callback(new Error(prefixValidation + 'The alert\'s product must be set.'));
                return;
            } else if (locations === null) {
                callback(new Error(prefixValidation + 'The alert\'s location(s) must be set.'));
                return;
            } else if (time === null) {
                callback(new Error(prefixValidation + 'The alert\'s time must be set.'));
                return;
            }

            user = Breinify.UTL.user.create(user);

            // split the locations into a primary (and secondary)
            var primaryLocation, secondaryLocations;
            if ($.isArray(locations)) {
                primaryLocation = locations[0];
                secondaryLocations = locations.length > 1 ? locations.slice(1) : [];
            } else if ($.isPlainObject(locations)) {
                primaryLocation = locations;
                secondaryLocations = [];
            } else {
                callback(new Error(prefixValidation + 'The alert\'s location(s) must be set.'));
                return;
            }

            // map the secondaryLocations
            var mappedSecondaryLocations = [];
            for (var i = 0; i < secondaryLocations.length; i++) {
                var secondaryLocation = secondaryLocations[i];
                var mappedSecondaryLocation = {
                    'alertMeLocation': secondaryLocation.name,
                    'alertMeLocationId': secondaryLocation.id,
                    'alertMeLocationType': secondaryLocation.type
                };
                mappedSecondaryLocations.push(mappedSecondaryLocation);
            }

            // create the alert instance
            var alert = {
                'alertMeMessage': 'SetAlert',
                'alertMeAlternativeLocations': mappedSecondaryLocations,
                'alertMeLocation': primaryLocation.name,
                'alertMeLocationId': primaryLocation.id,
                'alertMeLocationType': primaryLocation.type,
                'alertMeProduct': product.name,
                'alertMeProductSku': product.sku,
                'alertMeStart': {
                    'secondsSinceMidnight': time.start
                },
                'alertMeEnd': {
                    'secondsSinceMidnight': time.end
                },
                'alertMeWeekdays': time.weekdays,
                'alertMeWeekends': time.weekends
            };

            // create the tags
            var tags = {
                'messageServiceIdentifier': from,
                'messageServiceUserIdentifier': to,
                'gameKeyword': 'alertme',
                'gameInputText': JSON.stringify(alert),
                'messageText': 'SET ALERT FOR ' + alert.alertMeProduct + ' AT ' + alert.alertMeLocation + ' BETWEEN ' +
                alert.alertMeStart.secondsSinceMidnight + ' AND ' + alert.alertMeEnd.secondsSinceMidnight +
                (!alert.alertMeWeekdays ? ' NO WEEKDAYS' : '') + (!alert.alertMeWeekends ? ' NO WEEKENDS' : '')
            };

            // user, type, category, description, tags, callback
            Breinify.activity(user, 'gameSms', null, null, tags, function (data, error) {
                if (typeof error === 'string') {
                    callback(new Error(prefixApi + error));
                } else {
                    callback(null, alert);
                }
            });
        }
    };

    // bind the module
    Breinify.plugins._add('alertMe', AlertMe);
})();