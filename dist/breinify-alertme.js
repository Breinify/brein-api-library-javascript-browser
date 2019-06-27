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

        pages: {
            setAlert: {
                init: function (popup, $setAlertPage, settings) {
                    var _self = this;

                    this.settings = settings;
                    if (typeof this.settings.validator === 'object') {
                        this.validator = this.settings.validator;
                    } else if (typeof Breinify.plugins.uiValidator === 'object') {
                        this.validator = Breinify.plugins.uiValidator;
                    } else {
                        this.validator = null;
                    }

                    var $mobileInput = $setAlertPage.find('#breinify-alert-me-mobile-number');
                    var $timeInput = $setAlertPage.find('#breinify-alert-me-alert-time');
                    var $setAlertButton = $setAlertPage.find('#breinify-alert-me-set-alert');

                    if (typeof $().mask === 'function') {
                        $mobileInput
                            .mask('(999) 999-9999')
                            .on('propertychange change keyup input paste', function () {
                                _self.validate(popup, $setAlertPage);
                            });
                    } else {
                        $mobileInput
                            .on('propertychange change keyup input paste', function () {
                                _self.validate(popup, $setAlertPage);
                            });
                    }

                    $timeInput.change(function () {
                        _self.validate(popup, $setAlertPage);
                    });

                    $setAlertButton.click(function () {
                        _self.sendAlert(popup, $setAlertPage);
                    });

                    this.validate(popup, $setAlertPage);
                },

                validate: function (popup, $setAlertPage) {
                    var $mobileInput = $setAlertPage.find('#breinify-alert-me-mobile-number');
                    var $timeInput = $setAlertPage.find('#breinify-alert-me-alert-time');
                    var $setAlertButton = $setAlertPage.find('#breinify-alert-me-set-alert');

                    var mobileNr = typeof $().mask === 'function' ? $mobileInput.data().mask.getCleanVal() : $mobileInput.val();
                    var validMobileNr = this.validator !== null && this.validator.usMobile(mobileNr);

                    var time = $timeInput.val();
                    var validTime = this.validator !== null && this.validator.mandatory(time);

                    if (validMobileNr && validTime) {
                        popup.extendBindings({
                            alert: {
                                time: AlertMe.parseTime(time),
                                mobileNr: mobileNr,
                                e164MobileNr: '+1' + mobileNr
                            }
                        });
                        $setAlertButton.prop('disabled', false);
                    } else {
                        $setAlertButton.prop('disabled', true);
                    }
                },

                sendAlert: function (popup, $setAlertPage) {
                    var alert = popup.getBinding('alert');
                    var location = popup.getBinding('location');
                    var product = popup.getBinding('product');
                    console.log(JSON.stringify(alert));

                    // AlertMe.set(alert.e164MobileNr, product, location, alert.time, function (error, data) {
                    //
                    // });
                },

                style:
                '<style id=\"' + alertMePrefix + '-set-alert-style\">' +
                '   .' + alertMePrefix + '-set-alert-container { color:#000;font-size:13px;line-height:17px; }' +
                '   .' + alertMePrefix + '-set-alert-container .paragraph { padding:10px 0 0 0; }' +
                '   .' + alertMePrefix + '-set-alert-container .labeled { margin-bottom:5px;font-weight:bold; }' +
                '   .' + alertMePrefix + '-set-alert-container .centered { text-align:center; }' +
                '   .' + alertMePrefix + '-set-alert-container .small-print { font-size:10px;line-height:13px;font-weight:400;color:#222222; }' +
                '   .' + alertMePrefix + '-set-alert-container input, .' + alertMePrefix + '-set-alert-container select { font-size:inherit;font-family:inherit;color:#000;box-sizing:border-box;max-width:450px;width:100%;height:40px;padding: 0 8px;background-color:#fff;border-radius:5px;border:1px solid #999999; }' +
                '   .' + alertMePrefix + '-set-alert-container select { -moz-appearance:none;-webkit-appearance:none; }' +
                '   .' + alertMePrefix + '-set-alert-container button { min-width:150px;width:50%;white-space:nowrap;cursor:pointer;line-height:25px;font-size:14px;border-radius:4px;border-color:#de0000;background:#de0000;color:#fff; }' +
                '   .' + alertMePrefix + '-set-alert-container button:disabled { cursor:not-allowed;border-color:#eeeeee;background:#cccccc; }' +
                '</style>',

                html:
                '<div class="' + alertMePrefix + '-set-alert-container">' +
                '   <div>You are about to set an alert to be informed via text message when <b data-breinify-placeholder=\"product.name\"></b> will be available at <span data-breinify-placeholder=\"company.name\"></span> within the next <span data-breinify-placeholder=\"settings.alertExpiresInDays\"></span> days. Setting an alert does not reserve the product, it notifies you when it is available.</div>' +
                '   <div class="paragraph">Please provide the following information:</div>' +
                '   <div class="paragraph">' +
                '       <div class="labeled"><label style="" for=\"' + alertMePrefix + '-mobile-number\">Mobile Number:</label></div>  ' +
                '       <div><input id=\"' + alertMePrefix + '-mobile-number\" type=\"text\" placeholder=\"(xxx) xxx-xxxx\" autocomplete=\"off\" maxlength=\"14\" data-alert-me-visualize-error=\"false\"></div>' +
                '   </div>' +
                '   <div class="paragraph">' +
                '       <div class="labeled"><label for=\"' + alertMePrefix + '-alert-time\">Alert-Time (when available):</label></div>  ' +
                '       <div><select id=\"' + alertMePrefix + '-alert-time\">' +
                '           <option value=\"0|24|-1\">anytime, as soon as available</option>' +
                '           <option value=\"9|18|-1\">between 9:00am - 6:00pm</option>' +
                '           <option value=\"9|12|-1\">between 9:00am - noon</option>' +
                '           <option value=\"12|18|-1\">between noon - 6:00pm</option>' +
                '           <option value=\"9|18|0\">between 9:00am - 6:00pm (weekdays only)</option>' +
                '           <option value=\"9|18|1\">between 9:00am - 6:00pm (weekends only)</option>' +
                '           <option value=\"9|12|0\">between 9:00am - noon (weekdays only)</option>' +
                '           <option value=\"9|12|1\">between 9:00am - noon (weekends only)</option>' +
                '           <option value=\"12|18|0\">between noon - 6:00pm (weekdays only)</option>' +
                '           <option value=\"12|18|1\">between noon - 6:00pm (weekends only)</option>' +
                '       </select></div>' +
                '   </div>' +
                '   <div class="paragraph small-print">By setting this alert, you confirm that the entered mobile number is yours and that you consent to receive text messages to inform you about the alert. By providing your mobile number and signing up for alerts you agree to receive text messages that may be deemed marketing under applicable law, and that these messages may be sent using an autodialer. Your consent is not a condition of any purchase. Setting an alert is not a reservation of a product.</div>' +
                '   <div class="paragraph centered">' +
                '       <button id=\"' + alertMePrefix + '-set-alert\" type=\"submit\" title=\"Set Alert\"><span>Set Alert</span></button>' +
                '   </div>' +
                '</div>'
            }
        },

        parseTime: function (time) {
            if ($.isPlainObject(time)) {
                return time;
            } else if (typeof time === 'string') {
                var timeParts = time.split('|');
                var start = timeParts.length > 0 ? parseInt(timeParts[0]) : 9;
                var end = timeParts.length > 1 ? parseInt(timeParts[1]) : 18;
                var weekends = timeParts.length > 2 ? parseInt(timeParts[2]) : 0;

                return {
                    start: start * 60 * 60, end: end * 60 * 60, weekends: weekends === -1 || weekends === 1
                }
            } else {
                return {
                    start: 9 * 60 * 60, end: 18 * 60 * 60, weekends: false
                }
            }
        },

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