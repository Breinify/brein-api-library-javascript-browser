"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('unsubscribe')) {
        return;
    }

    // bind the jQuery default object $
    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var _private = {
        tokenCodeValidation: null,
        tokenCodeUnsubscribe: null,

        getValidationToken: function () {
            if (this.tokenCodeValidation === null) {
                this.tokenCodeValidation = this._determineValidationToken();
            }

            return this.tokenCodeValidation;
        },

        getUnsubscribeToken: function () {
            if (this.tokenCodeUnsubscribe === null) {
                this.tokenCodeUnsubscribe = this._determineUnsubscribeToken();
            }

            return this.tokenCodeUnsubscribe;
        },

        getCode: function (code) {
            if (code === null || typeof code !== 'string') {
                code = Breinify.UTL.loc.param('c');
            }

            // make sure that after we read a code, we check the validity
            if (code === null || typeof code !== 'string') {
                return null;
            } else {
                return code;
            }
        },

        _determineValidationToken: function () {
            return this._determineToken('tokenCodeValidation', 'testTokenCodeValidation');
        },

        _determineUnsubscribeToken: function () {
            return this._determineToken('tokenCodeUnsubscribe', 'testTokenCodeUnsubscribe');
        },

        _determineToken: function (cfgName, cfgTestName) {
            var token = null;
            if (Breinify.plugins._isAdded('api') && Breinify.plugins.api.determineMode() !== 'prod') {
                token = this.getConfig(cfgTestName, null);
            }

            if (token === null) {
                token = this.getConfig(cfgName, null);
            }

            return token;
        }
    };

    var Unsubscribe = {

        validate: function (callback, code) {
            var token = _private.getValidationToken();
            code = _private.getCode(code);

            $.ajax({
                'url': 'https://api.breinify.com/res/' + token,
                'type': 'GET',
                'crossDomain': true,
                'data': {
                    'code': code
                },
                'success': function (data) {

                    if ($.isPlainObject(data) && $.isPlainObject(data.payload) &&
                        typeof data.payload.email === 'string' && data.payload.email.trim() !== '') {
                        callback(null, data.payload);
                    } else {
                        callback(new Error('failed to validate the specified code'));
                    }
                },
                'error': function (jqXHR, text, exception) {
                    callback(new Error('failed to validate the specified code: ' + text));
                },
                'timeout': 60000
            });
        },

        unsubscribe: function (status, callback, code) {
            var token = _private.getUnsubscribeToken();
            code = _private.getCode(code);

            if (typeof token !== 'string') {
                callback(new Error('unsubscribe token not configured'));
                return;
            } else if (typeof code !== 'string') {
                callback(new Error('unsubscribe code not specified or found'));
                return;
            }

            $.ajax({
                'url': 'https://api.breinify.com/res/' + token,
                'type': 'GET',
                'crossDomain': true,
                'data': {
                    'code': code,
                    'status': status
                },
                'success': function (data) {
                    if ($.isPlainObject(data) && $.isPlainObject(data.payload) &&
                        typeof data.payload.email === 'string' && data.payload.email.trim() !== '') {
                        callback(null, data.payload);
                    } else {
                        callback(new Error('failed to unsubscribe'));
                    }
                },
                'error': function (jqXHR, text, exception) {
                    callback(new Error('failed to unsubscribe: ' + text));
                },
                'timeout': 60000
            });
        }
    };

    // bind the module
    Breinify.plugins._add('unsubscribe', Unsubscribe);
})();