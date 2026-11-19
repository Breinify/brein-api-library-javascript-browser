"use strict";

describe('Breinify core consent', function () {
    const consent = Breinify.UTL.consent;
    const features = consent.features;
    const levels = consent.levels;
    let subscriptions;

    function decision(feature, granted, identifiers, profile, storage) {
        return {feature: feature, granted: granted,
            userData: {identifiers: identifiers === true, profile: profile === true, allowedFields: [], deniedFields: []},
            storage: {read: storage === true, write: storage === true}};
    }

    function provide(permissions, settings) {
        consent.configure(Object.assign({}, settings, {
            provider: {evaluate: function (resolve) { resolve(permissions); }}
        }));
    }

    function evaluate(feature) {
        const callback = jasmine.createSpy(feature);
        expect(consent.evaluate(feature, callback)).toBeUndefined();
        return callback;
    }

    beforeEach(function () {
        jasmine.clock().install();
        subscriptions = [];
    });

    afterEach(function () {
        subscriptions.forEach(function (unsubscribe) { unsubscribe(); });
        consent.configure({timeoutInMs: 0});
        jasmine.clock().tick(1);
        jasmine.clock().uninstall();
    });

    it('is available before setConfig and utility initialization without granting optional permissions', function () {
        expect(typeof consent).toBe('object');
        const configure = spyOn(Breinify, 'setConfig');
        const initialize = spyOn(Breinify.UTL, '_init');
        expect(evaluate(features.RECOMMENDATIONS)).toHaveBeenCalledOnceWith(decision(features.RECOMMENDATIONS, true));
        expect(evaluate(features.ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, false));
        expect(configure).not.toHaveBeenCalled();
        expect(initialize).not.toHaveBeenCalled();
    });

    it('exposes frozen level and registered feature names', function () {
        expect(levels).toEqual({CONTENT: 'content', FUNCTIONAL: 'functional', ANALYTICS: 'analytics', PERSONALIZATION: 'personalization'});
        expect(Object.isFrozen(levels)).toBe(true);
        expect(Object.isFrozen(features)).toBe(true);
        expect(Object.keys(features).length).toBe(13);
        expect(features.MODIFY_CONTENT).toBe('modifyContent');
    });

    it('requires a registered feature and valid callbacks before querying the provider', function () {
        const provider = {evaluate: jasmine.createSpy('provider')};
        consent.configure({provider: provider});
        const calls = provider.evaluate.calls.count();
        [undefined, null, {}, [], 1, function () {}].forEach(function (feature) {
            expect(function () { consent.evaluate(feature, function () {}); }).toThrowError(TypeError);
            expect(function () { consent.isGranted(feature, function () {}); }).toThrowError(TypeError);
        });
        ['', 'toString', '__proto__', 'unknown', levels.ANALYTICS, levels.CONTENT].forEach(function (feature) {
            expect(function () { consent.evaluate(feature, function () {}); }).toThrowError(RangeError);
            expect(function () { consent.isGranted(feature, function () {}); }).toThrowError(RangeError);
        });
        expect(function () { consent.evaluate(features.ACTIVITIES); }).toThrowError(TypeError);
        expect(function () { consent.isGranted(features.ACTIVITIES); }).toThrowError(TypeError);
        [null, false, 'denied', {}].forEach(function (callback) {
            expect(function () { consent.isGranted(features.ACTIVITIES, function () {}, callback); }).toThrowError(TypeError);
        });
        expect(provider.evaluate.calls.count()).toBe(calls);
    });

    it('resolves all eight permission combinations against feature purposes and storage dependencies', function () {
        [false, true].forEach(function (functional) {
            [false, true].forEach(function (analytics) {
                [false, true].forEach(function (personalization) {
                    const source = {functional: functional, analytics: analytics, personalization: personalization};
                    provide(source);
                    const profile = analytics && personalization;
                    [features.RECOMMENDATIONS, features.MODIFY_CONTENT, features.CONTENT_TOKENS].forEach(function (feature) {
                        expect(evaluate(feature)).toHaveBeenCalledOnceWith(decision(feature, true, analytics, profile));
                    });
                    expect(evaluate(features.TEMPORAL_DATA)).toHaveBeenCalledOnceWith(decision(features.TEMPORAL_DATA, true, false, profile));
                    [features.ACTIVITIES, features.DELAYED_ACTIVITIES].forEach(function (feature) {
                        const stored = feature === features.DELAYED_ACTIVITIES && analytics;
                        expect(evaluate(feature)).toHaveBeenCalledOnceWith(decision(feature, analytics, analytics, profile, stored));
                    });
                    expect(evaluate(features.PRESENTATION_STORAGE)).toHaveBeenCalledOnceWith(
                        decision(features.PRESENTATION_STORAGE, functional, false, false, functional));
                    expect(evaluate(features.CONTENT_STORAGE)).toHaveBeenCalledOnceWith(
                        decision(features.CONTENT_STORAGE, true, false, false, true));
                    expect(source.personalization).toBe(personalization);
                });
            });
        });
    });

    it('passes the complete immutable decision only to the selected branch', function () {
        provide({analytics: true});
        const granted = jasmine.createSpy('granted');
        const denied = jasmine.createSpy('denied');
        expect(consent.isGranted(features.ACTIVITIES, granted, denied)).toBeUndefined();
        expect(granted).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, true, true));
        expect(denied).not.toHaveBeenCalled();
        const result = granted.calls.mostRecent().args[0];
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.userData)).toBe(true);
        expect(Object.isFrozen(result.storage)).toBe(true);
        expect(function () { result.userData.profile = true; }).toThrowError(TypeError);
        provide({});
        const second = jasmine.createSpy('second');
        consent.isGranted(features.ACTIVITIES, second, denied);
        expect(second).not.toHaveBeenCalled();
        expect(denied).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, false));
        consent.isGranted(features.ACTIVITIES, second);
        expect(second).not.toHaveBeenCalled();
    });

    it('applies a temporal-data override without adding identifiers or affecting other content calls', function () {
        const settings = {features: {temporalData: {requires: levels.ANALYTICS}}};
        provide({}, settings);
        expect(evaluate(features.TEMPORAL_DATA)).toHaveBeenCalledOnceWith(decision(features.TEMPORAL_DATA, false));
        expect(evaluate(features.MODIFY_CONTENT)).toHaveBeenCalledOnceWith(decision(features.MODIFY_CONTENT, true));
        provide({analytics: true, personalization: true}, settings);
        expect(evaluate(features.TEMPORAL_DATA)).toHaveBeenCalledOnceWith(decision(features.TEMPORAL_DATA, true, false, true));
    });

    it('supports combined requirements and disables a feature independently of consent', function () {
        const settings = {features: {modifyContent: {requires: [levels.FUNCTIONAL, levels.ANALYTICS]},
            recommendations: {enabled: false}}};
        provide({analytics: true, personalization: true}, settings);
        expect(evaluate(features.MODIFY_CONTENT)).toHaveBeenCalledOnceWith(decision(features.MODIFY_CONTENT, false));
        provide({functional: true, analytics: true, personalization: true}, settings);
        expect(evaluate(features.MODIFY_CONTENT)).toHaveBeenCalledOnceWith(decision(features.MODIFY_CONTENT, true, true, true));
        expect(evaluate(features.RECOMMENDATIONS)).toHaveBeenCalledOnceWith(decision(features.RECOMMENDATIONS, false));
    });

    it('does not allow feature overrides to remove intrinsic analytics or storage-purpose requirements', function () {
        provide({}, {features: {activities: {requires: levels.CONTENT}, delayedActivities: {requires: levels.CONTENT},
            presentationStorage: {requires: levels.CONTENT}}});
        [features.ACTIVITIES, features.DELAYED_ACTIVITIES, features.PRESENTATION_STORAGE].forEach(function (feature) {
            expect(evaluate(feature)).toHaveBeenCalledOnceWith(decision(feature, false));
        });
    });

    it('distinguishes immediate delivery without storage from required cross-page storage', function () {
        const settings = {storage: {requires: levels.PERSONALIZATION}};
        provide({functional: true, analytics: true}, settings);
        expect(evaluate(features.ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, true, true));
        expect(evaluate(features.DELAYED_ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.DELAYED_ACTIVITIES, false));
        expect(evaluate(features.PRESENTATION_STORAGE)).toHaveBeenCalledOnceWith(decision(features.PRESENTATION_STORAGE, false));
        provide({functional: true, analytics: true, personalization: true}, settings);
        expect(evaluate(features.DELAYED_ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.DELAYED_ACTIVITIES, true, true, true, true));
        expect(evaluate(features.PRESENTATION_STORAGE)).toHaveBeenCalledOnceWith(decision(features.PRESENTATION_STORAGE, true, false, false, true));
        expect(evaluate(features.TEMPORAL_DATA)).toHaveBeenCalledOnceWith(decision(features.TEMPORAL_DATA, true, false, true));
    });

    it('requires Continuity Storage independently of the delayed activity operation', function () {
        provide({analytics: true}, {features: {continuityStorage: {enabled: false}}});
        expect(evaluate(features.DELAYED_ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.DELAYED_ACTIVITIES, false));
        expect(evaluate(features.ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, true, true));
        provide({analytics: true}, {features: {continuityStorage: {requires: 'functional'}}});
        expect(evaluate(features.DELAYED_ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.DELAYED_ACTIVITIES, false));
        provide({analytics: true, functional: true}, {features: {continuityStorage: {requires: 'functional'}}});
        expect(evaluate(features.DELAYED_ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.DELAYED_ACTIVITIES, true, true, false, true));
        provide({});
        expect(evaluate(features.CONTINUITY_STORAGE)).toHaveBeenCalledOnceWith(decision(features.CONTINUITY_STORAGE, true, false, false, true));
        expect(evaluate(features.DELAYED_ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.DELAYED_ACTIVITIES, false));
    });

    it('copies configuration and restores defaults when reconfigured without overrides', function () {
        const settings = {features: {temporalData: {requires: [levels.ANALYTICS]}}, storage: {requires: [levels.PERSONALIZATION]}};
        provide({analytics: true}, settings);
        settings.features.temporalData.requires[0] = levels.PERSONALIZATION;
        settings.storage.requires[0] = levels.CONTENT;
        expect(evaluate(features.TEMPORAL_DATA)).toHaveBeenCalledOnceWith(decision(features.TEMPORAL_DATA, true));
        expect(evaluate(features.DELAYED_ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.DELAYED_ACTIVITIES, false));
        provide({analytics: true});
        expect(evaluate(features.DELAYED_ACTIVITIES)).toHaveBeenCalledOnceWith(decision(features.DELAYED_ACTIVITIES, true, true, false, true));
    });

    it('rejects invalid configuration before changing the provider or policy', function () {
        provide({}, {features: {temporalData: {requires: levels.ANALYTICS}}});
        [
            {timeoutInMs: -1}, {timeoutInMs: Infinity}, {provider: {}}, {features: null},
            {features: {unknown: {}}}, {features: {temporalData: {requires: []}}},
            {features: {temporalData: {requires: 'other'}}}, {features: {temporalData: {requires: [true]}}},
            {features: {temporalData: {requires: new Array(1)}}}, {features: {temporalData: {enabled: 'true'}}},
            {features: {temporalData: {userData: 'profile'}}}, {storage: null},
            {storage: {requires: 'other'}}, {storage: {read: true}}
        ].forEach(function (settings) {
            expect(function () { consent.configure(settings); }).toThrow();
        });
        expect(evaluate(features.TEMPORAL_DATA)).toHaveBeenCalledOnceWith(decision(features.TEMPORAL_DATA, false));
        expect(evaluate(features.MODIFY_CONTENT)).toHaveBeenCalledOnceWith(decision(features.MODIFY_CONTENT, true));
    });

    it('shares one pending permission query while returning different feature decisions', function () {
        let resolve;
        const provider = {evaluate: jasmine.createSpy('evaluate').and.callFake(function (callback) { resolve = callback; })};
        consent.configure({provider: provider, timeoutInMs: 50});
        const activity = evaluate(features.ACTIVITIES);
        const recommendation = evaluate(features.RECOMMENDATIONS);
        jasmine.clock().tick(49);
        expect(activity).not.toHaveBeenCalled();
        expect(recommendation).not.toHaveBeenCalled();
        expect(provider.evaluate).toHaveBeenCalledTimes(1);
        resolve({analytics: true});
        expect(activity).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, true, true));
        expect(recommendation).toHaveBeenCalledOnceWith(decision(features.RECOMMENDATIONS, true, true));
        jasmine.clock().tick(100);
        expect(activity).toHaveBeenCalledTimes(1);
    });

    it('waits even for content and applies feature overrides to timeout decisions', function () {
        let resolve;
        consent.configure({timeoutInMs: 20, provider: {evaluate: function (callback) { resolve = callback; }},
            features: {temporalData: {requires: levels.ANALYTICS}}});
        const content = jasmine.createSpy('content');
        const activity = jasmine.createSpy('activity');
        const denied = jasmine.createSpy('denied');
        consent.isGranted(features.RECOMMENDATIONS, content);
        consent.isGranted(features.ACTIVITIES, activity, denied);
        const temporal = evaluate(features.TEMPORAL_DATA);
        jasmine.clock().tick(19);
        expect(content).not.toHaveBeenCalled();
        expect(denied).not.toHaveBeenCalled();
        jasmine.clock().tick(1);
        expect(content).toHaveBeenCalledOnceWith(decision(features.RECOMMENDATIONS, true));
        expect(activity).not.toHaveBeenCalled();
        expect(denied).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, false));
        expect(temporal).toHaveBeenCalledOnceWith(decision(features.TEMPORAL_DATA, false));
        resolve({analytics: true});
        expect(content).toHaveBeenCalledTimes(1);
        expect(activity).not.toHaveBeenCalled();
        expect(denied).toHaveBeenCalledTimes(1);
    });

    it('uses the default timeout when the provider is absent', function () {
        consent.configure({});
        const callback = evaluate(features.ACTIVITIES);
        jasmine.clock().tick(2499);
        expect(callback).not.toHaveBeenCalled();
        jasmine.clock().tick(1);
        expect(callback).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, false));
    });

    it('queries again for each subsequent operation instead of caching a grant', function () {
        let permissions = {analytics: true, personalization: true};
        const provider = {evaluate: jasmine.createSpy('evaluate').and.callFake(function (callback) { callback(permissions); })};
        consent.configure({provider: provider});
        expect(evaluate(features.RECOMMENDATIONS)).toHaveBeenCalledOnceWith(decision(features.RECOMMENDATIONS, true, true, true));
        permissions = {analytics: false, personalization: true};
        expect(evaluate(features.RECOMMENDATIONS)).toHaveBeenCalledOnceWith(decision(features.RECOMMENDATIONS, true));
        expect(provider.evaluate).toHaveBeenCalledTimes(3);
    });

    it('resolves pending decisions from normalized observer updates and ignores older responses', function () {
        let resolve;
        let change;
        consent.configure({provider: {evaluate: function (callback) { resolve = callback; },
            onChange: function (listener) { change = listener; }}});
        const callback = evaluate(features.RECOMMENDATIONS);
        const changes = jasmine.createSpy('changes');
        subscriptions.push(consent.onChange(changes));
        change({analytics: false, personalization: true});
        resolve({analytics: true, personalization: true});
        change({analytics: false, personalization: true});
        expect(callback).toHaveBeenCalledOnceWith(decision(features.RECOMMENDATIONS, true));
        expect(changes).toHaveBeenCalledOnceWith({analytics: false, personalization: false});
    });

    it('accepts late updates without replay and ignores timed-out responses after a newer query', function () {
        const replies = [];
        consent.configure({timeoutInMs: 10, provider: {evaluate: function (callback) { replies.push(callback); }}});
        const changes = jasmine.createSpy('changes');
        subscriptions.push(consent.onChange(changes));
        const first = evaluate(features.ACTIVITIES);
        jasmine.clock().tick(10);
        replies[0]({analytics: true});
        expect(changes.calls.mostRecent().args).toEqual([{analytics: true}]);
        expect(first).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, false));
        const second = evaluate(features.ACTIVITIES);
        replies[0]({analytics: true});
        expect(second).not.toHaveBeenCalled();
        replies[1]({analytics: false});
        expect(second).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, false));
    });

    it('does not deliver a stale grant when an observer revokes consent during notification', function () {
        let resolve;
        let change;
        consent.configure({provider: {evaluate: function (callback) { resolve = callback; },
            onChange: function (listener) { change = listener; }}});
        subscriptions.push(consent.onChange(function (permissions) {
            if (permissions.analytics === true) change({analytics: false});
        }));
        const observer = jasmine.createSpy('observer');
        subscriptions.push(consent.onChange(observer));
        const callback = evaluate(features.ACTIVITIES);
        resolve({analytics: true});
        expect(observer).toHaveBeenCalledOnceWith({analytics: false});
        expect(callback).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, false));
    });

    it('denies pending operations on reconfiguration, including previously unrestricted content', function () {
        let resolve;
        let change;
        const cleanup = jasmine.createSpy('cleanup');
        consent.configure({provider: {evaluate: function (callback) { resolve = callback; },
            onChange: function (listener) { change = listener; return cleanup; }}});
        const callback = evaluate(features.RECOMMENDATIONS);
        provide({}, {features: {recommendations: {requires: levels.PERSONALIZATION}}});
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledOnceWith(decision(features.RECOMMENDATIONS, false));
        const changes = jasmine.createSpy('changes');
        subscriptions.push(consent.onChange(changes));
        resolve({analytics: true, personalization: true});
        change({analytics: true, personalization: true});
        expect(changes).not.toHaveBeenCalled();
        expect(evaluate(features.RECOMMENDATIONS)).toHaveBeenCalledOnceWith(decision(features.RECOMMENDATIONS, false));
    });

    it('copies and freezes permission notifications and supports independent unsubscribe functions', function () {
        let change;
        consent.configure({provider: {evaluate: function () {}, onChange: function (listener) { change = listener; }}});
        const listener = jasmine.createSpy('listener');
        const first = consent.onChange(listener);
        subscriptions.push(first);
        subscriptions.push(consent.onChange(listener));
        first();
        first();
        const source = {personalization: true, custom: true};
        change(source);
        source.custom = false;
        const snapshot = listener.calls.mostRecent().args[0];
        expect(listener).toHaveBeenCalledTimes(1);
        expect(snapshot).toEqual({personalization: false, custom: true});
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(function () { consent.onChange(null); }).toThrowError(TypeError);
    });

    it('waits for timeout on malformed consent or provider errors', function () {
        spyOn(console, 'error');
        consent.configure({timeoutInMs: 10, provider: {evaluate: function (callback) {
            callback({analytics: 'true'});
            throw new Error('CMP unavailable');
        }}});
        const callback = evaluate(features.ACTIVITIES);
        jasmine.clock().tick(9);
        expect(callback).not.toHaveBeenCalled();
        jasmine.clock().tick(1);
        expect(callback).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, false));
        expect(console.error).toHaveBeenCalled();
    });

    it('isolates failed observers and granted callbacks without invoking denial or causing side effects', function () {
        spyOn(console, 'error');
        const activity = spyOn(Breinify, 'activity');
        const createUser = spyOn(Breinify.UTL.user, 'create');
        const probe = spyOn(Breinify.UTL.storage, 'isAvailable');
        let resolve;
        consent.configure({provider: {evaluate: function (callback) { resolve = callback; }}});
        subscriptions.push(consent.onChange(function () { throw new Error('Observer failed'); }));
        const denied = jasmine.createSpy('denied');
        consent.isGranted(features.ACTIVITIES, function () { throw new Error('Consumer failed'); }, denied);
        const callback = evaluate(features.ACTIVITIES);
        resolve({analytics: true});
        expect(callback).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, true, true));
        expect(denied).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledTimes(2);
        expect(activity).not.toHaveBeenCalled();
        expect(createUser).not.toHaveBeenCalled();
        expect(probe).not.toHaveBeenCalled();
    });

    it('isolates failed denial callbacks and safely omits denial handlers', function () {
        spyOn(console, 'error');
        let resolve;
        consent.configure({provider: {evaluate: function (callback) { resolve = callback; }}});
        const granted = jasmine.createSpy('granted');
        consent.isGranted(features.ACTIVITIES, granted, function () { throw new Error('Denial failed'); });
        consent.isGranted(features.ACTIVITIES, granted);
        const denied = jasmine.createSpy('denied');
        consent.isGranted(features.ACTIVITIES, granted, denied);
        resolve({});
        expect(granted).not.toHaveBeenCalled();
        expect(denied).toHaveBeenCalledOnceWith(decision(features.ACTIVITIES, false));
        expect(console.error).toHaveBeenCalledTimes(1);
    });
});

describe('Consent inspection', function () {
    const consent = Breinify.UTL.consent;

    afterEach(function () { consent.configure({enabled: false}); });

    it('does not query providers and returns isolated configuration and decisions', function () {
        const evaluate = jasmine.createSpy('provider').and.callFake(function (callback) {
            callback({analytics: true, personalization: true});
        });
        consent.configure({provider: {evaluate: evaluate}, features: {temporalData: {requires: ['personalization']}},
            storage: {requires: ['personalization']}});
        evaluate.calls.reset();
        const snapshot = consent.inspect();
        expect(snapshot.status).toBe('known');
        expect(snapshot.settings.provider).toBe('custom');
        expect(snapshot.levels.personalization).toBe(true);
        snapshot.settings.features.temporalData.requires.push('functional');
        snapshot.levels.analytics = false;
        const again = consent.inspect();
        expect(again.settings.features.temporalData.requires).toEqual(['personalization']);
        expect(again.levels.analytics).toBe(true);
        expect(evaluate).not.toHaveBeenCalled();
    });

    it('reports disabled consent without claiming that feature enforcement is active', function () {
        consent.configure({enabled: false});
        const snapshot = consent.inspect();
        expect(snapshot.enabled).toBe(false);
        expect(snapshot.status).toBe('disabled');
        expect(snapshot.features.every(function (feature) { return feature.decision === null; })).toBe(true);
    });
});

describe('Consent storage dependency inspection', function () {
    const consent = Breinify.UTL.consent;

    function configure(permissions, settings) {
        consent.configure(Object.assign({}, settings, {
            provider: {evaluate: function (callback) { callback(permissions); }}
        }));
    }

    function feature(name) {
        return consent.inspect().features.filter(function (entry) { return entry.feature === name; })[0];
    }

    function dependency(name, required, allowed) {
        return {feature: name, required: required, read: allowed, write: allowed};
    }

    afterEach(function () { consent.configure({enabled: false}); });

    it('shows optional activity storage with Accept all without changing enforcement decisions', function () {
        configure({functional: true, analytics: true, personalization: true});
        const activity = feature('activities');
        expect(activity.storage).toBeUndefined();
        expect(activity.decision.storage).toBeUndefined();
        expect(activity.storageDependencies).toEqual([
            dependency('identifierStorage', false, true),
            dependency('profileStorage', false, true),
            dependency('splitTestStorage', false, true)
        ]);
        expect(consent.getDecision('activities').storage).toEqual({read: false, write: false});
        expect(feature('identifierStorage').storageDependencies).toEqual([
            dependency('identifierStorage', true, true)
        ]);
    });

    it('distinguishes Analytics-only access from profile-dependent storage', function () {
        configure({analytics: true});
        expect(feature('activities').storageDependencies).toEqual([
            dependency('identifierStorage', false, true),
            dependency('profileStorage', false, false),
            dependency('splitTestStorage', false, false)
        ]);
        expect(feature('recommendations').storageDependencies).toEqual([
            dependency('identifierStorage', false, true),
            dependency('profileStorage', false, false),
            dependency('splitTestStorage', false, true)
        ]);
        expect(feature('temporalData').storageDependencies.map(function (entry) { return entry.feature; }))
            .toEqual(['profileStorage', 'splitTestStorage']);
        expect(feature('contentTokens').storageDependencies).toEqual([]);
        expect(feature('preferenceManagement').storageDependencies).toEqual([]);
    });

    it('keeps immediate requests allowed when global storage restrictions block optional access', function () {
        configure({analytics: true}, {storage: {requires: 'personalization'}});
        const activity = feature('activities');
        expect(activity.decision.granted).toBe(true);
        expect(activity.storageDependencies.every(function (entry) { return !entry.read && !entry.write; })).toBe(true);
        const delayed = feature('delayedActivities');
        expect(delayed.decision.granted).toBe(false);
        expect(delayed.storageDependencies[0]).toEqual(dependency('continuityStorage', true, false));
    });

    it('honors purpose overrides and exposes required continuity storage for delayed activities', function () {
        configure({analytics: true, personalization: true}, {features: {identifierStorage: {enabled: false}}});
        expect(feature('activities').storageDependencies[0]).toEqual(dependency('identifierStorage', false, false));
        expect(feature('activities').decision.granted).toBe(true);
        expect(feature('delayedActivities').storageDependencies[0]).toEqual(dependency('continuityStorage', true, true));
    });

    it('reports denied and disabled states without inventing permissions or retaining returned mutations', function () {
        configure({});
        const recommendations = feature('recommendations');
        expect(recommendations.decision.granted).toBe(true);
        expect(recommendations.storageDependencies.every(function (entry) { return !entry.read && !entry.write; })).toBe(true);
        recommendations.storageDependencies[0].read = true;
        expect(feature('recommendations').storageDependencies[0].read).toBe(false);
        consent.configure({enabled: false});
        expect(feature('activities').storageDependencies.every(function (entry) {
            return entry.read === null && entry.write === null;
        })).toBe(true);
    });
});


describe('Consent data rules', function () {
    const consent = Breinify.UTL.consent;
    afterEach(function () { consent.configure({enabled: false}); });

    it('validates exact paths, level names and supported rule fields', function () {
        [null, [], {x: null}, {x: {other: []}}, {x: {path: ''}}, {x: {path: 'additional.*'}},
            {x: {path: '__proto__.bad'}}, {x: {path: 'additional.constructor.bad'}},
            {x: {path: 'additional.prototype.bad'}}, {x: {path: 'email', requires: ['unknown']}}].forEach(function (data) {
            expect(function () { consent.configure({data: data}); }).toThrow();
        });
    });

    it('rejects duplicate and ancestor conflicts in either order without changing active rules', function () {
        consent.configure({data: {store: {path: 'additional.location.goPuffStoreId'}}});
        [['additional.location', 'additional.location'], ['additional', 'additional.location.lat'],
            ['additional.location.lat', 'additional.location']].forEach(function (paths) {
            expect(function () {
                consent.configure({data: {a: {path: paths[0]}, b: {path: paths[1]}}});
            }).toThrowError(RangeError);
            expect(consent.inspect().settings.data.store.path).toBe('additional.location.goPuffStoreId');
        });
        expect(function () {
            consent.configure({data: {a: {path: 'additional.location.lat'}, b: {path: 'additional.location.latitude'}}});
        }).not.toThrow();
    });

    it('copies only scalar leaf fields and leaves getters, parents and unrelated data unread', function () {
        consent.configure({data: {location: {path: 'additional.location'}, email: {path: 'email'}}});
        const getter = jasmine.createSpy('emailGetter');
        const input = {additional: {location: {goPuffStoreId: '482', latitude: 12}}};
        Object.defineProperty(input, 'email', {get: getter});
        const filtered = consent.filterUser(input, consent.getDecision('recommendations'));
        expect(filtered.additional.location).toBeUndefined();
        expect(filtered.email).toBeUndefined();
        expect(getter).not.toHaveBeenCalled();
    });

    it('evaluates field requirements independently and applies stricter rules with profile consent', function () {
        let permissions = {};
        const data = {store: {path: 'additional.location.goPuffStoreId', requires: null},
            lat: {path: 'additional.location.lat', requires: ['analytics']},
            email: {path: 'email', requires: ['functional', 'personalization']}};
        consent.configure({data: data, provider: {evaluate: function (callback) { callback(permissions); }}});
        const input = {email: 'private@example.test', additional: {location: {goPuffStoreId: '482', lat: 12, longitude: 34}}};
        let decision = consent.getDecision('recommendations');
        expect(decision.userData.allowedFields).toEqual(['additional.location.goPuffStoreId']);
        expect(consent.filterUser(input, decision).additional.location).toEqual({goPuffStoreId: '482'});
        permissions = {analytics: true};
        decision = consent.getDecision('recommendations');
        expect(decision.userData.profile).toBe(false);
        expect(consent.filterUser(input, decision).additional.location).toEqual({goPuffStoreId: '482', lat: 12});
        permissions = {analytics: true, personalization: true};
        decision = consent.getDecision('recommendations');
        expect(decision.userData.profile).toBe(true);
        expect(consent.filterUser(input, decision).email).toBeUndefined();
        permissions.functional = true;
        expect(consent.filterUser(input, consent.getDecision('recommendations')).email).toBe('private@example.test');
        permissions = {};
        const payload = consent.filterPayload({user: input}, consent.getDecision('recommendations'));
        expect(payload.user.additional.location).toEqual({goPuffStoreId: '482'});
        expect(payload.user.email).toBeUndefined();
        expect(input.email).toBe('private@example.test');
    });

    it('provides the shared collection check for explicit fields, denied subtrees and generated identifiers', function () {
        expect(consent.isFieldAllowed('email', null)).toBe(true);
        expect(consent.isFieldAllowed('email')).toBe(false);
        const permissions = {profile: false, identifiers: true, allowedFields: ['additional.location.goPuffStoreId'],
            deniedFields: ['additional.private']};
        expect(consent.isFieldAllowed('additional.location.goPuffStoreId', permissions)).toBe(true);
        expect(consent.isFieldAllowed('additional.location.lat', permissions)).toBe(false);
        expect(consent.isFieldAllowed('sessionId', permissions)).toBe(true);
        expect(consent.isFieldAllowed('sessionIds', permissions)).toBe(true);
        permissions.profile = true;
        expect(consent.isFieldAllowed('email', permissions)).toBe(true);
        expect(consent.isFieldAllowed('additional.private.value', permissions)).toBe(false);
    });

    it('uses one permission for each supported singular/plural pair, even with no explicit rule', function () {
        const permissions = {profile: false, identifiers: true};
        [['sessionId', 'sessionIds', true], ['userId', 'userIds', false], ['email', 'emails', false]].forEach(function (pair) {
            expect(consent.isFieldAllowed(pair[0], permissions)).toBe(pair[2]);
            expect(consent.isFieldAllowed(pair[1], permissions)).toBe(pair[2]);
        });
        permissions.profile = true;
        expect(consent.isFieldAllowed('email', permissions)).toBe(true);
        expect(consent.isFieldAllowed('emails', permissions)).toBe(true);
    });

    it('applies rules in either alias direction and copies plural string values without retaining the input', function () {
        [['sessionId', 'sessionIds'], ['userId', 'userIds'], ['email', 'emails']].forEach(function (pair) {
            pair.forEach(function (configuredPath) {
                consent.configure({data: {rule: {path: configuredPath}}});
                const decision = consent.getDecision('recommendations');
                const input = {};
                input[pair[0]] = 'value';
                input[pair[1]] = ['first', 'second'];
                const output = consent.filterUser(input, decision);
                expect(output[pair[0]]).toBe('value');
                expect(output[pair[1]]).toEqual(['first', 'second']);
                output[pair[1]].push('third');
                expect(input[pair[1]]).toEqual(['first', 'second']);
                expect(consent.isFieldAllowed(pair[0], decision.userData)).toBe(true);
                expect(consent.isFieldAllowed(pair[1], decision.userData)).toBe(true);

                consent.configure({data: {rule: {path: configuredPath, requires: ['functional']}},
                    provider: {evaluate: function (callback) { callback({analytics: true, personalization: true}); }}});
                const denied = consent.getDecision('recommendations');
                expect(consent.isFieldAllowed(pair[0], denied.userData)).toBe(false);
                expect(consent.isFieldAllowed(pair[1], denied.userData)).toBe(false);
                const filtered = consent.filterUser(input, denied);
                expect(filtered[pair[0]]).toBeUndefined();
                expect(filtered[pair[1]]).toBeUndefined();
            });
        });
    });

    it('rejects alias conflicts and ancestor overlaps after normalization', function () {
        [['sessionId', 'sessionIds'], ['userIds', 'userId'], ['email', 'emails'], ['emails.value', 'email']]
            .forEach(function (pair) {
                expect(function () {
                    consent.configure({data: {a: {path: pair[0]}, b: {path: pair[1]}}});
                }).toThrowError(RangeError);
            });
        expect(function () {
            consent.configure({data: {a: {path: 'additional.email'}, b: {path: 'additional.emails'}}});
        }).not.toThrow();
    });

    it('isolates configuration and decision snapshots without granting storage or activity permissions', function () {
        const data = {store: {path: 'additional.location.goPuffStoreId'}};
        consent.configure({data: data});
        data.store.path = 'email';
        const decision = consent.getDecision('recommendations');
        expect(decision.userData.allowedFields).toEqual(['additional.location.goPuffStoreId']);
        expect(decision.storage.read).toBe(false);
        decision.userData.allowedFields.push('email');
        const snapshot = consent.inspect();
        expect(snapshot.settings.data.store.path).toBe('additional.location.goPuffStoreId');
        snapshot.settings.data.store.path = 'phone';
        expect(consent.getDecision('recommendations').userData.allowedFields).toEqual(['additional.location.goPuffStoreId']);
        expect(consent.getDecision('activities').granted).toBe(false);
    });
});

describe('Injected consent definitions', function () {
    const consent = Breinify.UTL.consent;
    let definitions;

    function configure(permissions, extra) {
        consent.configure(Object.assign({definitions: definitions}, extra, {
            provider: {evaluate: function (callback) { callback(permissions); }}
        }));
    }

    beforeEach(function () {
        consent.configure({enabled: false});
        definitions = consent.inspect().definitions;
    });

    afterEach(function () { consent.configure({enabled: false}); });

    it('uses the injected operation and data requirements instead of standalone defaults', function () {
        definitions.recommendations.requires = 'functional';
        definitions.recommendations.userData = {identifiers: 'functional', profile: null};
        configure({analytics: true});
        expect(consent.getDecision('recommendations').granted).toBe(false);
        configure({functional: true});
        const decision = consent.getDecision('recommendations');
        expect(decision.granted).toBe(true);
        expect(decision.userData.identifiers).toBe(true);
        expect(decision.userData.profile).toBe(false);
        expect(consent.inspect().definitionSource).toBe('injected');
        expect(consent.inspect().settings.definitions).toBeUndefined();
    });

    it('applies customer overrides on top of the injected baseline', function () {
        definitions.recommendations.requires = 'functional';
        configure({analytics: true}, {features: {recommendations: {requires: ['content']}}});
        expect(consent.getDecision('recommendations').granted).toBe(false);
        configure({functional: true}, {features: {recommendations: {requires: ['analytics']}}});
        expect(consent.getDecision('recommendations').granted).toBe(false);
        configure({functional: true, analytics: true}, {features: {recommendations: {enabled: false}}});
        expect(consent.getDecision('recommendations').granted).toBe(false);
    });

    it('enforces injected storage purposes and required dependencies and reports the same dependencies', function () {
        definitions.recommendations.dependencies = [
            {feature: 'presentationStorage', required: true, requires: []}
        ];
        definitions.presentationStorage.requires = 'personalization';
        configure({analytics: true, functional: true});
        expect(consent.getDecision('recommendations').granted).toBe(false);
        configure({analytics: true, personalization: true});
        expect(consent.getDecision('recommendations').granted).toBe(true);
        const feature = consent.inspect().features.filter(function (entry) {
            return entry.feature === 'recommendations';
        })[0];
        expect(feature.storageDependencies).toEqual([
            {feature: 'presentationStorage', required: true, read: true, write: true}
        ]);
        configure({analytics: true, personalization: true}, {storage: {requires: ['functional']}});
        expect(consent.getDecision('recommendations').granted).toBe(false);
    });

    it('copies definitions and restores standalone defaults when the next configuration omits them', function () {
        definitions.recommendations.requires = 'functional';
        configure({analytics: true});
        definitions.recommendations.requires = 'content';
        consent.inspect().definitions.recommendations.requires = 'content';
        expect(consent.getDecision('recommendations').granted).toBe(false);
        consent.configure({provider: {evaluate: function (callback) { callback({analytics: true}); }}});
        expect(consent.getDecision('recommendations').granted).toBe(true);
        expect(consent.inspect().definitionSource).toBe('standalone');
    });

    it('rejects malformed or incompatible definitions without changing the active configuration', function () {
        configure({analytics: true});
        const copy = function () { return JSON.parse(JSON.stringify(definitions)); };
        const missing = copy();
        delete missing.activities;
        const unknown = copy();
        unknown.custom = unknown.activities;
        const level = copy();
        level.activities.requires = 'unknown';
        const data = copy();
        data.activities.userData.identifiers = ['analytics'];
        const dependency = copy();
        dependency.activities.dependencies = [{feature: 'recommendations', required: true, requires: []}];
        const cycle = copy();
        cycle.identifierStorage.dependencies = [{feature: 'identifierStorage', required: true, requires: []}];
        [null, {}, missing, unknown, level, data, dependency, cycle].forEach(function (value) {
            expect(function () { consent.configure({definitions: value}); }).toThrow();
            expect(consent.getDecision('activities').granted).toBe(true);
        });
    });
});
