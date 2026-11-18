"use strict";

(function (scope) {
    const consent = scope.Breinify && scope.Breinify.UTL && scope.Breinify.UTL.consent;
    if (!consent || !consent.integrations || consent.integrations.onetrust) {
        return;
    }

    const _private = {
        defaults: {
            functional: ['C0003'],
            analytics: ['C0002'],
            personalization: ['C0003']
        },

        snapshot: function (mappings) {
            const value = scope.OnetrustActiveGroups;
            if (typeof value !== 'string') {
                return null;
            }
            const groups = value.split(',').map(function (group) { return group.trim(); }).filter(Boolean);
            const result = {};
            Object.keys(mappings).forEach(function (level) {
                result[level] = mappings[level].every(function (group) { return groups.indexOf(group) !== -1; });
            });
            return result;
        }
    };

    consent.integrations.onetrust = {
        create: function (settings) {
            const mappings = consent.utils.mappings(settings, _private.defaults);
            let observing = false;

            function stop() {
                if (observing) {
                    scope.removeEventListener('OneTrustGroupsUpdated', publish);
                    scope.removeEventListener('OTConsentApplied', publish);
                    observing = false;
                }
            }

            const observer = consent.utils.createObserver(stop);

            function publish() {
                let snapshot;
                try {
                    snapshot = _private.snapshot(mappings);
                } catch (error) {
                    scope.console.error('OneTrust consent read failed.', error);
                    return;
                }
                observer.publish(snapshot);
                if (observer.isIdle()) {
                    stop();
                }
            }

            function observe() {
                if (!observing) {
                    /*
                     * These window events can be observed before OneTrust loads. Read its active groups
                     * again for each event and evaluation; do not replace the customer's OptanonWrapper.
                     * https://developer.onetrust.com/onetrust/docs/javascript-events-guide
                     */
                    scope.addEventListener('OneTrustGroupsUpdated', publish);
                    scope.addEventListener('OTConsentApplied', publish);
                    observing = true;
                }
            }

            return {
                getSettings: function () {
                    return {provider: 'onetrust', mappings: consent.utils.mappings(undefined, mappings)};
                },

                evaluate: function (callback) {
                    const snapshot = _private.snapshot(mappings);
                    if (snapshot !== null) {
                        callback(snapshot);
                    } else {
                        observer.wait(callback);
                        observe();
                    }
                },

                onChange: function (callback) {
                    const unsubscribe = observer.subscribe(callback);
                    observe();
                    return unsubscribe;
                }
            };
        }
    };
})(window);
