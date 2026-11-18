"use strict";

describe('Breinify core consent', function () {
    const consent = Breinify.UTL.consent;
    const features = consent.features;
    const levels = consent.levels;
    let subscriptions;

    function decision(feature, granted, identifiers, profile, storage) {
        return {feature: feature, granted: granted,
            userData: {identifiers: identifiers === true, profile: profile === true},
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
        expect(Object.keys(features).length).toBe(12);
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
                    [features.RECOMMENDATIONS, features.MODIFY_CONTENT].forEach(function (feature) {
                        expect(evaluate(feature)).toHaveBeenCalledOnceWith(decision(feature, true, profile, profile));
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
        expect(recommendation).toHaveBeenCalledOnceWith(decision(features.RECOMMENDATIONS, true));
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
