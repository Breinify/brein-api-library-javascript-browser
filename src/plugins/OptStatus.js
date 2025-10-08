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
    const $ = Breinify.UTL._jquery();

    const _private = {
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

    const OptStatus = {

        _tokens: function () {
            return {
                validateOptCode: this.getConfig('tokenValidateOptCode', null),
                optViaCode: this.getConfig('tokenOptViaCode', null)
            };
        },

        hasValidTokens: function () {
            let validateOptCodeToken = this._tokens().validateOptCode;
            let optViaCodeToken = this._tokens().optViaCode;

            return _private.validateToken(validateOptCodeToken) &&
                _private.validateToken(optViaCodeToken);
        },

        isValidCode: function (code) {
            return typeof code === 'string' && code === code.trim() && code !== '';
        },

        validateOptCode: function (code, cb) {
            let token = this._tokens().validateOptCode;
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

        optViaCode: function (code, cb, overrides) {
            let token = this._tokens().optViaCode;
            if (!_private.validateToken(token, cb)) {
                return;
            }

            Breinify.UTL.internal.token(token, $.extend({code: code}, overrides), function (error, response) {
                if (error == null) {
                    _private.handleOptStatusChange(response, cb);
                } else {
                    _private.handleError(error, cb);
                }
            }, 30000);
        },

        opt: function (user, optStatus, campaigns, additional, callback) {
            const token = this.getConfig('tokenOpt', null)
            if (_private.validateToken(token) === false) {
                callback({success: false, failed: [], results: {}});
                return;
            }

            // make sure we have a valid user
            if (!$.isPlainObject(user)) {
                callback({success: false, failed: [], results: {}});
                return;
            }

            // get the entries and check if there are any
            const userEntries = Object.entries(user);
            if (userEntries.length === 0) {
                callback({success: true, failed: [], results: {}});
                return;
            }

            campaigns = $.isArray(campaigns) ? campaigns : [];
            const optInCampaigns = optStatus === true ? campaigns : [];
            const optOutCampaigns = optStatus === false ? campaigns : [];

            additional = $.isPlainObject(additional) ? additional : {};

            const results = {};
            const failed = [];

            // execute for each passed user
            let remaining = userEntries.length;
            for (const [channel, userId] of userEntries) {
                Breinify.UTL.internal.token(token, {
                    optInGeneral: optStatus === true,
                    optInCampaigns: optInCampaigns,
                    optOutGeneral: optStatus === false,
                    optOutCampaigns: optOutCampaigns,
                    deliveryChannel: channel,
                    user: userId, // email, phone, depending on deliveryChannel
                    additionalData: additional
                }, function (error, response) {

                    if (error !== null || !$.isPlainObject(response)) {
                        results[channel] = {
                            error: error
                        };

                        failed.push(channel);
                    } else if (response.optInResponseCode === 200) {
                        results[channel] = {
                            response: response
                        };
                    } else {
                        results[channel] = {
                            error: 'response'
                        };
                    }

                    // check if we are done and have all responses
                    remaining -= 1;
                    if (remaining === 0) {
                        callback({success: failed.length === 0, failed: failed, results: results});
                    }
                }, 30000);
            }
        }
    };

    // bind the module
    Breinify.plugins._add('optStatus', OptStatus);
})();