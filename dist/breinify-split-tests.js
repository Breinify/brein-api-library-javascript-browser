"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('splitTests')) {
        return;
    }

    // bind the jQuery default object $
    const $ = Breinify.UTL._jquery();

    const SplitTest = {
        status: 'setup',
        error: null,
        timing: {
            expirationAfterMs: 60 * 60 * 1000,
            intervalInMs: 50,
            maxTimeInMs: 15000,
            durationInMs: 0
        },
        storageKey: {
            live: null,
            test: null
        },
        tokens: {
            live: null,
            test: null
        },
        payload: null,
        cachedResult: null,

        init: function (settings) {
            const _self = this;

            // make sure we have valid settings (enrich as much as possible)
            settings = $.isPlainObject(settings) ? settings : {};
            this.tokens = $.extend(true, {}, this.tokens, $.isPlainObject(settings.tokens) ? settings.tokens : {});
            this.storageKey = $.extend(true, {}, this.storageKey, $.isPlainObject(settings.storageKey) ? settings.storageKey : {});
            this.timing = $.extend(true, {}, this.timing, $.isPlainObject(settings.timing) ? settings.timing : {});
            this.payload = $.isPlainObject(settings.payload) || $.isFunction(settings.payload) ? settings.payload : {};

            const checker = function (error, status) {
                if (error !== null) {
                    // we are done, we had an error - so we keep whatever we have right now
                    _self.status = 'error';
                    _self.error = error;
                } else if (status === true) {
                    // we are done, we have a result already
                    _self.status = 'done';
                    _self.error = null;
                } else if (_self.timing.durationInMs >= _self.timing.maxTimeInMs) {
                    _self.status = 'timed-out';
                    _self.error = new Error('call timed out after ' + _self.timing.maxTimeInMs + 'ms');

                    // reset the split-test data, we most likely do not have a user
                    _self.setSplitTestData({}, null);
                } else {
                    _self.status = 'loading';
                    _self.error = null;

                    setTimeout(function () {
                        _self.timing.durationInMs += _self.timing.intervalInMs;
                        _self.resolveSplitTest(checker);
                    }, _self.timing.intervalInMs);
                }
            };

            _self.status = 'loading';
            this.resolveSplitTest(checker);
        },

        resolveSplitTest: function (cb) {
            const _self = this;

            // determine the payload to utilize for the test
            let payload;
            if ($.isFunction(this.payload)) {
                payload = this.payload(this.checkForUserInfo());
            } else {
                payload = this.checkForUserInfo();
            }

            if (!$.isPlainObject(payload)) {

                /*
                 * We do not have any user yet, so we return with false (not resolved) and no error,
                 * if a user appears it will be resolved.
                 */
                cb(null, false);
                return;
            }

            const currentData = this.getSplitTestData();

            // check if the data is already there and not expired
            if ($.isPlainObject(currentData) &&
                typeof currentData.lastUpdated === 'number' &&
                new Date().getTime() - currentData.lastUpdated <= this.timing.expirationAfterMs) {

                cb(null, true);
            }
            // request information about the split-test
            else {
                const token = Breinify.UTL.internal.isDevMode() ? this.tokens.test : this.tokens.live;
                Breinify.UTL.internal.token(token, payload, function (error, response) {
                    if (error == null) {
                        _self.setSplitTestData(payload, response);
                        cb(null, true);
                    } else {
                        cb(error, false);
                    }
                }, 30000);
            }
        },

        determineSplitTestData: function (cb) {
            const _self = this;

            if (!$.isFunction(cb)) {
                return;
            }

            // we have an "ending" status, so let's get the information
            if (this.status === 'setup' || this.status === 'loading') {
                setTimeout(function () {
                    _self.determineSplitTestData(cb);
                }, 50);

            } else if (this.status === 'error' || this.error !== null) {
                const data = $.extend({
                    status: this.status
                }, this.getSplitTestData());

                cb(this.error, data);
            } else {
                const data = $.extend({
                    status: this.status
                }, this.getSplitTestData());

                cb(null, data);
            }
        },

        getSplitTestData: function () {

            // check if we already have a value
            if (this.cachedResult !== null) {
                return this.cachedResult;
            }

            // check if storage is used for this instance, if so return the value else return null (no data cached)
            const key = this.determineStorageKey();
            if (key === null) {
                return null;
            }

            try {
                const jsonData = window.localStorage.getItem(key);
                return typeof jsonData === 'string' ? JSON.parse(jsonData) : null;
            } catch (e) {
                return null;
            }
        },

        setSplitTestData: function (payload, response) {
            const key = this.determineStorageKey();
            if (response === null) {
                response = {};
            }

            const splitTestData = {
                lastUpdated: new Date().getTime(),
                loggedInUser: typeof payload.email === 'string'
            };

            // keep the result locally (it will not change within the session)
            this.cachedResult = $.extend(true, {}, splitTestData, payload, response);

            // store the result in the local-storage if a storage is provided
            if (key !== null) {
                try {
                    window.localStorage.setItem(key, JSON.stringify(this.cachedResult));
                } catch (e) {
                    // do nothing
                }
            }

            try {
                let currentData = Breinify.UTL.user.getSplitTestData();
                currentData = $.isPlainObject(currentData) ? currentData : {};

                console.log(currentData);
                console.log(splitTestData);
                console.log(response);

                // delete currentData['Abandoned Cart'];

                // const newData = $.extend(true, {
                //     'Abandoned Cart': $.extend(true, {}, splitTestData, {
                //         testName: 'Abandoned Cart',
                //         groupDecision: typeof response.group === 'string' ? response.group : null
                //     })
                // }, currentData);
                //
                // Breinify.UTL.user.updateSplitTestData(newData);
            } catch (e) {
                // do nothing
            }
        },

        determineStorageKey: function () {
            return Breinify.UTL.internal.isDevMode() ? this.storageKey.test : this.storageKey.live;
        },

        checkForUserInfo: function () {
            const user = Breinify.UTL.user.create();
            return !$.isPlainObject(user) ? null : user;
        }
    };

    const _private = {
        initSplitTest: function (tokens, payload, storageKeys, timing) {

            // we allow to utilize just non-empty strings for tokens and storage
            if (typeof tokens === 'string' && tokens.trim() !== '') {
                tokens = {live: tokens, test: tokens};
            }
            if (typeof storageKeys === 'string' && storageKeys.trim() !== '') {
                storageKeys = {live: storageKeys, test: storageKeys};
            }

            // there is no way to retrieve anything without tokens
            if (!$.isPlainObject(tokens)) {
                return null;
            }

            // we set test to be live if only one is defined
            if (typeof tokens.test !== 'string') {
                tokens.test = tokens.live;
            }
            if ($.isPlainObject(storageKeys) && typeof storageKeys.test !== 'string') {
                storageKeys.test = storageKeys.live;
            }

            // we need a live token
            if (typeof tokens.live !== 'string') {
                return null;
            }

            const splitTest = new Object.create(SplitTest);
            splitTest.init({
                payload: payload,
                timing: timing,
                storageKey: $.extend(true, {
                    live: null,
                    test: null
                }, $.isPlainObject(storageKeys) ? storageKeys : {}),
                tokens: $.extend(true, {
                    live: null,
                    test: null
                }, $.isPlainObject(tokens) ? tokens : {})
            });

            return splitTest;
        }
    };

    const module = {
        splitTests: {},

        retrieveSplitTest(name, tokens, payload, storageKeys, cb, timing) {
            let splitTest = this.splitTests[name];

            // if we do not have one create one and keep it
            if (splitTest === null || typeof splitTest === 'undefined') {
                splitTest = _private.initSplitTest(tokens, payload, storageKeys, timing);
                this.splitTests[name] = splitTest;
            }

            console.log(splitTest);
            console.log(splitTest instanceof SplitTest);

            return splitTest === null ? null : splitTest.determineSplitTestData(cb);
        }
    };

    // bind the module
    Breinify.plugins._add('splitTests', module);
})();