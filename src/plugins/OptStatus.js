"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('optStatus')) {
        return;
    }

    // bind the jQuery default object $
    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var _private = {
        handleError: function (error, cb) {
            if ($.isFunction(cb)) {
                cb(error);
            }
        },

        validateToken: function (token, cb) {
            if (typeof token !== 'string' || token.trim() !== token || token === '') {
                if ($.isFunction(cb)) {
                    cb(new Error('Invalid token specified: ' + token));
                }
                return false;
            } else {
                return true;
            }
        },

        handleOptCodeValidation: function (response, cb) {
            if ($.isFunction(cb)) {
                cb(null, response);
            }
        },

        handleOptStatusChange: function (response, cb) {
            if ($.isFunction(cb)) {
                cb(null, response);
            }
        }
    };

    var OptStatus = {

        tokens: function () {
            return {
                validateOptCode: this.getConfig('tokenValidateOptCode', null),
                optViaCode: this.getConfig('tokenOptViaCode', null)
            };
        },

        hasValidTokens: function () {
            var validateOptCodeToken = this.tokens().validateOptCode;
            var optViaCodeToken = this.tokens().optViaCode;

            return _private.validateToken(validateOptCodeToken) &&
                _private.validateToken(optViaCodeToken);
        },

        isValidCode: function (code) {
            return typeof code === 'string' && code === code.trim() && code !== '';
        },

        validateOptCode: function (code, cb) {
            var token = this.tokens().validateOptCode;
            if (!_private.validateToken(token, cb)) {
                return;
            }

            Breinify.UTL.internal.token(token, {code: code}, function (error, response) {
                if (error == null) {
                    _private.handleOptCodeValidation(response, cb);
                } else {
                    _private.handleError(error, cb);
                }
            }, 30000);
        },

        optViaCode: function (code, cb) {
            var token = this.tokens().optViaCode;
            if (!_private.validateToken(token, cb)) {
                return;
            }

            Breinify.UTL.internal.token(token, {code: code}, function (error, response) {
                if (error == null) {
                    _private.handleOptStatusChange(response, cb);
                } else {
                    _private.handleError(error, cb);
                }
            }, 30000);
        }
    };

    // bind the module
    Breinify.plugins._add('optStatus', OptStatus);
})();