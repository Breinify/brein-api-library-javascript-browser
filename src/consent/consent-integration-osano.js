"use strict";

(function (scope) {
    const consent = scope.Breinify && scope.Breinify.UTL && scope.Breinify.UTL.consent;
    if (!consent || !consent.integrations || consent.integrations.osano) {
        return;
    }

    const _private = {
        defaults: {
            functional: ['PERSONALIZATION'],
            analytics: ['ANALYTICS'],
            personalization: ['PERSONALIZATION']
        },

        snapshot: function (api, mappings) {
            const value = api.getConsent();
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                return null;
            }
            const result = {};
            Object.keys(mappings).forEach(function (level) {
                result[level] = mappings[level].every(function (category) {
                    return Object.prototype.hasOwnProperty.call(value, category) && value[category] === 'ACCEPT';
                });
            });
            return result;
        },

        osano: function () {
            /*
             * Osano processes this documented preload queue when its CMP script initializes.
             * cm.ready() integrates other APIs with Osano; it is not a CMP readiness callback.
             * https://developers.osano.com/cmp/javascript-api/developer-documentation-consent-javascript-api
             */
            if (typeof scope.Osano === 'undefined') {
                scope.Osano = function () { scope.Osano.data.push(arguments); };
            }
            if (typeof scope.Osano === 'function') {
                scope.Osano.data = scope.Osano.data || [];
            }
            return scope.Osano;
        }
    };

    consent.integrations.osano = {
        create: function (settings) {
            const mappings = consent.utils.mappings(settings, _private.defaults);
            let api = null;
            let ready = null;
            let generation = 0;

            const observer = consent.utils.createObserver(stop);

            function publish() {
                if (observer.isIdle()) {
                    return;
                }

                let snapshot;
                try {
                    snapshot = _private.snapshot(api, mappings);
                } catch (error) {
                    scope.console.error('Osano consent read failed.', error);
                    return;
                }

                observer.publish(snapshot);
                if (observer.isIdle()) {
                    detach();
                }
            }

            function stop() {
                generation++;
                detach();
                const osano = scope.Osano;
                if (ready !== null && osano && Array.isArray(osano.data)) {
                    // remove only our queued readiness callback, preserving customer preload entries
                    for (let i = osano.data.length - 1; i >= 0; i--) {
                        const command = osano.data[i];
                        if (command && command[0] === 'onInitialized' && command[1] === ready) {
                            osano.data.splice(i, 1);
                        }
                    }
                }
                ready = null;
            }

            function detach() {
                if (api !== null) {
                    api.removeEventListener('osano-cm-initialized', publish);
                    api.removeEventListener('osano-cm-consent-saved', publish);
                    api = null;
                }
            }

            function connect() {
                const current = scope.Osano && scope.Osano.cm;
                if (!current || typeof current.getConsent !== 'function' ||
                    typeof current.addEventListener !== 'function' || typeof current.removeEventListener !== 'function') {
                    return false;
                } else if (api === current) {
                    return true;
                }
                detach();
                api = current;
                // saved consent is authoritative; consent-changed is only an unsaved category toggle
                current.addEventListener('osano-cm-consent-saved', publish);
                if (api === current) {
                    current.addEventListener('osano-cm-initialized', publish);
                }
                return true;
            }

            function start() {
                if (connect() || ready !== null) {
                    return;
                }
                const osano = _private.osano();
                if (typeof osano !== 'function') {
                    return;
                }
                const activeGeneration = generation;
                ready = function () {
                    const callback = readyCallback;
                    const current = scope.Osano && scope.Osano.cm;
                    if (current && typeof current.removeEventListener === 'function') {
                        current.removeEventListener('osano-cm-initialized', callback);
                    }
                    if (activeGeneration !== generation) {
                        return;
                    }
                    ready = null;
                    if (connect()) {
                        publish();
                    }
                };
                const readyCallback = ready;
                osano('onInitialized', readyCallback);
            }

            return {
                getSettings: function () {
                    return {provider: 'osano', mappings: consent.utils.mappings(undefined, mappings)};
                },

                evaluate: function (callback) {
                    // read the current API on every operation, including after the CMP replaces its bootstrap
                    const current = scope.Osano && scope.Osano.cm;
                    if (current && typeof current.getConsent === 'function') {
                        const snapshot = _private.snapshot(current, mappings);
                        if (snapshot !== null) {
                            callback(snapshot);
                            return;
                        }
                    }
                    observer.wait(callback);
                    start();
                },

                onChange: function (callback) {
                    const unsubscribe = observer.subscribe(callback);
                    start();
                    return unsubscribe;
                }
            };
        }
    };
})(window);
