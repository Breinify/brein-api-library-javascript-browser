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

        check: function(token, code, callback) {
            if (typeof token !== 'string') {
                callback(new Error('token not configured'));
                return false;
            } else if (typeof code !== 'string') {
                callback(new Error('unsubscribe code not specified or found'));
                return false;
            } else {
                return true;
            }
        },

        getValidationToken: function (plugin) {
            if (this.tokenCodeValidation === null) {
                this.tokenCodeValidation = this._determineValidationToken(plugin);
            }

            return this.tokenCodeValidation;
        },

        getUnsubscribeToken: function (plugin) {
            if (this.tokenCodeUnsubscribe === null) {
                this.tokenCodeUnsubscribe = this._determineUnsubscribeToken(plugin);
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

        _determineValidationToken: function (plugin) {
            return this._determineToken('tokenCodeValidation', 'testTokenCodeValidation', plugin);
        },

        _determineUnsubscribeToken: function (plugin) {
            return this._determineToken('tokenCodeUnsubscribe', 'testTokenCodeUnsubscribe', plugin);
        },

        _determineToken: function (cfgName, cfgTestName, plugin) {
            var token = null;
            if (Breinify.plugins._isAdded('api') && Breinify.plugins.api.determineMode() !== 'prod') {
                token = plugin.getConfig(cfgTestName, null);
            }

            if (token === null) {
                token = plugin.getConfig(cfgName, null);
            }

            return token;
        }
    };

    var Unsubscribe = {

        code: function() {
            return _private.getCode();
        },

        validate: function (callback, code) {
            var token = _private.getValidationToken(this);
            code = _private.getCode(code);

            if (!_private.check(token, code, callback)) {
                return;
            }

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
                        delete data.payload.dynamicPermissions;
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

        change: function (status, callback, code) {
            var token = _private.getUnsubscribeToken(this);
            code = _private.getCode(code);

            if (!_private.check(token, code, callback)) {
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
                        delete data.payload.dynamicPermissions;
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