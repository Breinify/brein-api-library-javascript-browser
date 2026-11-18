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
        }
    };

    consent.integrations.airgap = {
        create: function (settings) {
            const mappings = consent.utils.mappings(settings, _private.defaults);
            let api = null;
            let started = false;
            let observing = false;

            const observer = consent.utils.createObserver(stop);

            function publish() {
                let snapshot;
                try {
                    snapshot = _private.snapshot(api, mappings);
                } catch (error) {
                    scope.console.error('Airgap consent read failed.', error);
                    return;
                }
                observer.publish(snapshot);
            }

            function stop() {
                if (observing) {
                    api.removeEventListener('consent-change', publish);
                    api.removeEventListener('consent-resolution', publish);
                    observing = false;
                }
            }

            function observe() {
                if (api !== null && !observing && observer.hasListeners()) {
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
                getSettings: function () {
                    return {provider: 'airgap', mappings: consent.utils.mappings(undefined, mappings)};
                },

                evaluate: function (callback) {
                    if (api !== null) {
                        const snapshot = _private.snapshot(api, mappings);
                        if (snapshot !== null) {
                            callback(snapshot);
                        }
                    } else {
                        // only the latest pending core query is needed while Airgap is loading
                        observer.wait(callback);
                        start();
                    }
                },

                onChange: function (callback) {
                    const unsubscribe = observer.subscribe(callback);
                    observe();
                    start();
                    return unsubscribe;
                }
            };
        }
    };
})(window);
