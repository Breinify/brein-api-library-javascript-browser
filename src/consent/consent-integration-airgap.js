"use strict";

(function (scope) {
    const consent = scope.Breinify && scope.Breinify.UTL && scope.Breinify.UTL.consent;
    if (!consent || !consent.integrations || consent.integrations.airgap) {
        return;
    }

    const _private = {
        defaults: {
            functional: ['Functional'],
            analytics: ['Analytics'],
            personalization: ['Advertising']
        },

        mappings: function (settings) {
            if (typeof settings !== 'undefined' && (!settings || typeof settings !== 'object' || Array.isArray(settings))) {
                throw new TypeError('Airgap consent mappings must be an object.');
            }
            const result = {};
            Object.keys(settings || {}).forEach(function (level) {
                if (!Object.prototype.hasOwnProperty.call(_private.defaults, level)) {
                    throw new RangeError('Unknown consent mapping level: ' + level);
                }
            });
            Object.keys(_private.defaults).forEach(function (level) {
                const value = settings && Object.prototype.hasOwnProperty.call(settings, level)
                    ? settings[level] : _private.defaults[level];
                const purposes = Array.isArray(value) ? value.slice() : [value];
                if (purposes.length === 0 || purposes.some(function (purpose) {
                    return typeof purpose !== 'string' || purpose.trim() === '';
                })) {
                    throw new TypeError('Airgap mappings require one or more purpose names.');
                }
                result[level] = purposes;
            });
            return result;
        },

        snapshot: function (api, mappings) {
            const value = api.getConsent();
            const purposes = value && value.purposes;
            if (!purposes || typeof purposes !== 'object' || Array.isArray(purposes)) {
                return null;
            }
            const result = {};
            Object.keys(mappings).forEach(function (level) {
                result[level] = mappings[level].every(function (purpose) {
                    return Object.prototype.hasOwnProperty.call(purposes, purpose) &&
                        (purposes[purpose] === true || purposes[purpose] === 'Auto');
                });
            });
            return result;
        },

        airgap: function () {
            /*
             * Airgap's documented bootstrap processes this readyQueue when the real CMP initializes,
             * even if it replaces window.airgap. Queued callbacks receive the initialized API.
             * https://docs.transcend.io/docs/consent-management/testing-and-troubleshooting/faq#asynchronous-loading-with-airgapready
             */
            const api = scope.airgap || (scope.airgap = {});
            if (typeof api.ready !== 'function') {
                api.readyQueue = api.readyQueue || [];
                api.ready = function (callback) {
                    this.readyQueue.push(callback);
                };
            }
            return api;
        },

        invoke: function (callback, value) {
            try {
                callback(Object.assign({}, value));
            } catch (error) {
                scope.console.error('Airgap consent callback failed.', error);
            }
        }
    };

    consent.integrations.airgap = {
        create: function (settings) {
            const mappings = _private.mappings(settings);
            const listeners = [];
            let api = null;
            let started = false;
            let observing = false;
            let pending = null;

            function publish() {
                let snapshot;
                try {
                    snapshot = _private.snapshot(api, mappings);
                } catch (error) {
                    scope.console.error('Airgap consent read failed.', error);
                    return;
                }
                if (snapshot === null) {
                    return;
                }
                const callback = pending;
                pending = null;
                listeners.slice().forEach(function (entry) {
                    if (listeners.indexOf(entry) !== -1) {
                        _private.invoke(entry.callback, snapshot);
                    }
                });
                if (typeof callback === 'function') {
                    _private.invoke(callback, snapshot);
                }
            }

            function observe() {
                if (api !== null && !observing && listeners.length > 0) {
                    api.addEventListener('consent-change', publish);
                    api.addEventListener('consent-resolution', publish);
                    observing = true;
                }
            }

            function start() {
                if (started) {
                    return;
                }
                started = true;
                const current = _private.airgap();
                current.ready(function (readyApi) {
                    api = readyApi || scope.airgap;
                    observe();
                    publish();
                });
            }

            return {
                evaluate: function (callback) {
                    if (api !== null) {
                        const snapshot = _private.snapshot(api, mappings);
                        if (snapshot !== null) {
                            callback(snapshot);
                        }
                    } else {
                        // only the latest pending core query is needed while Airgap is loading
                        pending = callback;
                        start();
                    }
                },

                onChange: function (callback) {
                    const entry = {callback: callback};
                    listeners.push(entry);
                    observe();
                    start();
                    return function () {
                        const index = listeners.indexOf(entry);
                        if (index === -1) {
                            return;
                        }
                        listeners.splice(index, 1);
                        if (listeners.length === 0) {
                            pending = null;
                            if (observing) {
                                api.removeEventListener('consent-change', publish);
                                api.removeEventListener('consent-resolution', publish);
                                observing = false;
                            }
                        }
                    };
                }
            };
        }
    };
})(window);
