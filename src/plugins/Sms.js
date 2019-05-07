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

    var Sms = {

        phoneNumberChange: function () {
            var _self = this;
            overload.overload({
                'String,String,Object,Function': function (oldPhoneNumber, newPhoneNumber, user, cb) {
                    var source = _self.getConfig('source', null);
                    var replyMessageKey = _self.getConfig('replyMessageKey', null);
                    _self._phoneNumberChange(source, replyMessageKey, oldPhoneNumber, newPhoneNumber, user, cb);
                },
                'String,String,Function': function (oldPhoneNumber, newPhoneNumber, cb) {
                    var source = _self.getConfig('source', null);
                    var replyMessageKey = _self.getConfig('replyMessageKey', null);
                    _self._phoneNumberChange(source, replyMessageKey, oldPhoneNumber, newPhoneNumber, {}, cb);
                },
                'String,String,String,Function': function (oldPhoneNumber, newPhoneNumber, source, cb) {
                    var replyMessageKey = _self.getConfig('replyMessageKey', null);
                    source = Breinify.UTL.isEmpty(source) ? _self.getConfig('source', null) : source;
                    _self._phoneNumberChange(source, replyMessageKey, oldPhoneNumber, newPhoneNumber, {}, cb);
                },
                'String,String,Object,String,Function': function (oldPhoneNumber, newPhoneNumber, user, source, cb) {
                    var replyMessageKey = _self.getConfig('replyMessageKey', null);
                    source = Breinify.UTL.isEmpty(source) ? _self.getConfig('source', null) : source;
                    _self._phoneNumberChange(source, replyMessageKey, oldPhoneNumber, newPhoneNumber, user, cb);
                },
                'String,String,String,String,Function': function (oldPhoneNumber, newPhoneNumber, source, replyMessageKey, cb) {
                    source = Breinify.UTL.isEmpty(source) ? _self.getConfig('source', null) : source;
                    replyMessageKey = Breinify.UTL.isEmpty(replyMessageKey) ? _self.getConfig('replyMessageKey', null) : replyMessageKey;
                    _self._phoneNumberChange(source, replyMessageKey, oldPhoneNumber, newPhoneNumber, {}, cb);
                },
                'String,String,Object,String,String,Function': function (oldPhoneNumber, newPhoneNumber, user, source, replyMessageKey, cb) {
                    source = Breinify.UTL.isEmpty(source) ? _self.getConfig('source', null) : source;
                    replyMessageKey = Breinify.UTL.isEmpty(replyMessageKey) ? _self.getConfig('replyMessageKey', null) : replyMessageKey;
                    _self._phoneNumberChange(source, replyMessageKey, oldPhoneNumber, newPhoneNumber, user, cb);
                }
            }, arguments, this);
        },

        _phoneNumberChange: function(source, replyMessageKey, oldPhoneNumber, newPhoneNumber, user, callback) {
            var _self = this;

            // collect the callbacks and handle the validated values
            var callbacks = Breinify.UTL.internal.cbCollector({
                _callback: function (errors, results) {
                    if (errors === null) {
                        _self._phoneNumberChangeValidated(results.source, replyMessageKey, results.from, results.oldPhoneNumber, results.newPhoneNumber, user, callback);
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
                from: function (error, data) {
                    callbacks._set('from', error, data);
                },
                oldPhoneNumber: function (error, data) {
                    callbacks._set('oldPhoneNumber', error, data);
                },
                newPhoneNumber: function (error, data) {
                    callbacks._set('newPhoneNumber', error, data);
                },
                source: function (error, data) {
                    callbacks._set('source', error, data);
                }
            });

            // get the values we received and do a validation
            this._validatePhoneNumber(this.getConfig('from', null), true, callbacks.from);
            this._validatePhoneNumber(oldPhoneNumber, false, callbacks.oldPhoneNumber);
            this._validatePhoneNumber(newPhoneNumber, false, callbacks.newPhoneNumber);
            this._validateSource(source, callbacks.source);
        },

        _phoneNumberChangeValidated: function(source, replyMessageKey, from, oldPhoneNumber, newPhoneNumber, user, callback) {
            if (from === null) {
                callback(new Error(prefixValidation + 'The from-number must be configured (see configuration).'));
                return;
            } else if (oldPhoneNumber === null) {
                callback(new Error(prefixValidation + 'The previous phone-number must be specified.'));
                return;
            } else if (source === null) {
                callback(new Error(prefixValidation + 'The source must be valid or configured (see configuration).'));
                return;
            }

            // make sure we don't have any empty replyMessageKey
            if (Breinify.UTL.isEmpty(newPhoneNumber)) {
                newPhoneNumber = null;
            }

            // make sure we don't have any empty replyMessageKey
            if (Breinify.UTL.isEmpty(replyMessageKey)) {
                replyMessageKey = null;
            }

            // create the user and attach it to the user passed
            user = Breinify.UTL.user.create(user);
            user.phone = oldPhoneNumber;

            // setup the tags
            var tags = {
                'source': source,
                'messageServiceIdentifier': from,
                'messageServiceUserIdentifier': user.phone,
                'messageContext': 'default',
                '_replyMessageKey': replyMessageKey
            };

            // sent the activity
            Breinify.activity(user, 'stopSms', null, null, tags, function (data, error) {
                if (typeof error === 'string') {
                    callback(new Error(prefixApi + error));
                } else {
                    callback(null, {
                        user: user,
                        tags: tags
                    });
                }
            });
        },

        optIn: function () {

            var _self = this;
            overload.overload({
                'String,Function': function (phoneNumber, cb) {
                    var source = _self.getConfig('source', null);
                    var replyMessageKey = _self.getConfig('replyMessageKey', null);
                    _self._optIn(source, replyMessageKey, phoneNumber, {}, cb);
                },
                'String,Object,Function': function (phoneNumber, user, cb) {
                    var source = _self.getConfig('source', null);
                    var replyMessageKey = _self.getConfig('replyMessageKey', null);
                    _self._optIn(source, replyMessageKey, phoneNumber, user, cb);
                },
                'String,Object,String,Function': function (phoneNumber, user, source, cb) {
                    var replyMessageKey = _self.getConfig('replyMessageKey', null);
                    source = Breinify.UTL.isEmpty(source) ? _self.getConfig('source', null) : source;
                    _self._optIn(source, replyMessageKey, phoneNumber, user, cb);
                },
                'String,String,Function': function (phoneNumber, source, cb) {
                    var replyMessageKey = _self.getConfig('replyMessageKey', null);
                    source = Breinify.UTL.isEmpty(source) ? _self.getConfig('source', null) : source;
                    _self._optIn(source, replyMessageKey, phoneNumber, {}, cb);
                },
                'String,String,String,Function': function (phoneNumber, source, replyMessageKey, cb) {
                    source = Breinify.UTL.isEmpty(source) ? _self.getConfig('source', null) : source;
                    replyMessageKey = Breinify.UTL.isEmpty(replyMessageKey) ? _self.getConfig('replyMessageKey', null) : replyMessageKey;
                    _self._optIn(source, replyMessageKey, phoneNumber, {}, cb);
                }
            }, arguments, this);
        },

        _optIn: function (source, replyMessageKey, phoneNumber, user, callback) {
            var _self = this;

            // collect the callbacks and handle the validated values
            var callbacks = Breinify.UTL.internal.cbCollector({
                _callback: function (errors, results) {
                    if (errors === null) {
                        _self._optInValidated(results.source, replyMessageKey, results.from, results.phoneNumber, user, callback);
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
                from: function (error, data) {
                    callbacks._set('from', error, data);
                },
                phoneNumber: function (error, data) {
                    callbacks._set('phoneNumber', error, data);
                },
                source: function (error, data) {
                    callbacks._set('source', error, data);
                }
            });

            // get the values we received and do a validation
            this._validatePhoneNumber(this.getConfig('from', null), true, callbacks.from);
            this._validatePhoneNumber(phoneNumber, false, callbacks.phoneNumber);
            this._validateSource(source, callbacks.source);
        },

        _optInValidated: function (source, replyMessageKey, from, phoneNumber, user, callback) {
            if (from === null) {
                callback(new Error(prefixValidation + 'The from-number must be configured (see configuration).'));
                return;
            } else if (source === null) {
                callback(new Error(prefixValidation + 'The source must be valid or configured (see configuration).'));
                return;
            } else if (phoneNumber === null) {
                callback(new Error(prefixValidation + 'The phone-number must be specified.'));
                return;
            }

            // make sure we don't have any empty replyMessageKey
            if (Breinify.UTL.isEmpty(replyMessageKey)) {
                replyMessageKey = null;
            }

            // create the user and attach it to the user passed
            user = Breinify.UTL.user.create(user);
            user.phone = phoneNumber;

            // setup the tags
            var tags = {
                'source': source,
                'messageServiceIdentifier': from,
                'messageServiceUserIdentifier': user.phone,
                'messageContext': 'default',
                '_replyMessageKey': replyMessageKey
            };

            // sent the activity
            Breinify.activity(user, 'joinSms', null, null, tags, function (data, error) {
                if (typeof error === 'string') {
                    callback(new Error(prefixApi + error));
                } else {
                    callback(null, {
                        user: user,
                        tags: tags
                    });
                }
            });
        },

        _validateSource: function (source, callback) {
            if (Breinify.UTL.isEmpty(source)) {
                callback(null, null);
            } else {
                callback(null, source);
            }
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
        }
    };

    // bind the module
    Breinify.plugins._add('sms', Sms);
})();