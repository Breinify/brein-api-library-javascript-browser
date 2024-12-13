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
        checker: {
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
        cachedResult: null,

        init: function (opt) {
            const _self = this;

            // make sure we won't fail
            opt = $.isPlainObject(opt) ? opt : {};
            opt.storageKey = $.extend(true, {
                live: null,
                test: null
            }, $.isPlainObject(opt.storageKey) ? opt.storageKey : {});
            opt.tokens = $.extend(true, {live: null, test: null}, $.isPlainObject(opt.tokens) ? opt.tokens : {});

            this.storageKey.live = opt.storageKey.live;
            this.storageKey.test = opt.storageKey.test;
            this.tokens.live = opt.tokens.live;
            this.tokens.test = opt.tokens.test;

            const checker = function (error, status) {
                if (error !== null) {
                    // we are done, we had an error - so we keep whatever we have right now
                    _self.status = 'error';
                } else if (status === true) {
                    // we are done, we have a result already
                    _self.status = 'done';
                } else if (_self.checker.durationInMs >= _self.checker.maxTimeInMs) {
                    _self.status = 'timed-out';

                    // reset the split-test data, we most likely do not have a user
                    _self.setSplitTestData({}, null);
                } else {
                    _self.status = 'loading';
                    setTimeout(function () {
                        _self.checker.durationInMs += _self.checker.intervalInMs;
                        _self.resolveSplitTest(checker);
                    }, _self.checker.intervalInMs);
                }
            };

            _self.status = 'loading';
            this.resolveSplitTest(checker);
        },

        resolveSplitTest: function (cb) {
            const _self = this;

            // check if we have a user
            const payload = this.checkForUserInfo();
            if (!$.isPlainObject(payload)) {

                /*
                 * We do not have any user yet, so we return with false (not resolved) and no error,
                 * if a user appears it will be resolved.
                 */
                cb(null, false);
                return;
            }

            // check if the data is already there (or expired)
            const currentData = this.getSplitTestData();
            if ($.isPlainObject(currentData)) {

                // make sure the data is semi up to date
                if (typeof currentData.lastUpdated === 'number' &&
                    new Date().getTime() - currentData.lastUpdated > 60 * 60 * 1000) {
                    // data is older than 1h, so we refresh
                }
                // we have valid data for this email, so nothing to do
                else if (payload.email === currentData.email) {
                    cb(null, true);
                    return;
                }
                // check if we have a "no-login" case, in that case reset now and be done
                else if (payload.email === null) {
                    _self.setSplitTestData({}, null);
                    cb(null, true);
                    return;
                }
            }

            // retrieve the split-test if we have valid information
            const token = Breinify.UTL.internal.isDevMode() ? this.tokens.test : this.tokens.live;
            Breinify.UTL.internal.token(token, payload, function (error, response) {
                if (error == null) {
                    _self.setSplitTestData(payload, response);
                    cb(null, true);
                } else {
                    cb(error, false);
                }
            }, 30000);
        },

        determineSplitTestData: function (cb) {
            const _self = this;

            if (!$.isFunction(cb)) {
                return;
            }

            // we have an "ending" status, so let's get the information
            if (this.status !== 'setup' && this.status !== 'loading') {
                const data = $.extend({
                    status: this.status
                }, this.getSplitTestData());

                cb(data);
            } else {
                setTimeout(function () {
                    _self.determineSplitTestData(cb);
                }, 50);
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
        initSplitTest: function (tokens, storageKeys) {

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

        retrieveSplitTest(name, tokens, storageKeys) {
            let splitTest = this.splitTests[name];

            // if we do not have one create one and keep it
            if (splitTest === null || typeof splitTest === 'undefined') {
                splitTest = _private.initSplitTest(tokens, storageKeys);
                this.splitTests[name] = splitTest;
            }

            console.log(splitTest);
            console.log(splitTest instanceof SplitTest);
            console.log(splitTest === null ? null : splitTest.getSplitTestData());
            return splitTest === null ? null : splitTest.getSplitTestData();
        }
    };

    // bind the module
    Breinify.plugins._add('splitTests', module);
})();