"use strict";

describe('Airgap consent integration', function () {
    const consent = Breinify.UTL.consent;
    const integration = consent.integrations.airgap;
    let original;
    let state;
    let api;
    let subscriptions;

    function createApi() {
        const target = new EventTarget();
        target.getConsent = jasmine.createSpy('getConsent').and.callFake(function () { return state; });
        target.ready = function (callback) { callback(target); };
        spyOn(target, 'addEventListener').and.callThrough();
        spyOn(target, 'removeEventListener').and.callThrough();
        return target;
    }

    function evaluate(feature) {
        const callback = jasmine.createSpy('decision');
        consent.evaluate(feature, callback);
        return callback;
    }

    beforeEach(function () {
        original = window.airgap;
        subscriptions = [];
        state = {purposes: {Functional: true, Analytics: true, Advertising: true}, confirmed: true};
        api = createApi();
        window.airgap = api;
        jasmine.clock().install();
    });

    afterEach(function () {
        subscriptions.forEach(function (unsubscribe) { unsubscribe(); });
        consent.configure({timeoutInMs: 0});
        jasmine.clock().tick(1);
        jasmine.clock().uninstall();
        if (typeof original === 'undefined') {
            delete window.airgap;
        } else {
            window.airgap = original;
        }
    });

    it('creates a provider without reading consent, configuring the core or creating the CMP', function () {
        delete window.airgap;
        const configure = spyOn(consent, 'configure');
        const provider = integration.create();
        expect(typeof provider.evaluate).toBe('function');
        expect(typeof provider.onChange).toBe('function');
        expect(window.airgap).toBeUndefined();
        expect(configure).not.toHaveBeenCalled();
        expect(api.getConsent).not.toHaveBeenCalled();
    });

    it('reads fresh values on every evaluation and honors Auto without requiring confirmation', function () {
        const provider = integration.create();
        const result = jasmine.createSpy('result');
        state = {confirmed: false, purposes: {Functional: 'Auto', Analytics: false, Advertising: true}};
        provider.evaluate(result);
        expect(result).toHaveBeenCalledOnceWith({functional: true, analytics: false, personalization: true});
        state = {purposes: {Functional: false, Analytics: true, Advertising: false}};
        provider.evaluate(result);
        expect(result.calls.mostRecent().args).toEqual([{functional: false, analytics: true, personalization: false}]);
        expect(api.getConsent).toHaveBeenCalledTimes(2);
    });

    it('never treats missing, inherited or malformed purposes as grants', function () {
        const purposes = Object.create({Functional: true, Analytics: true, Advertising: true});
        state = {purposes: purposes};
        const result = jasmine.createSpy('result');
        const provider = integration.create();
        provider.evaluate(result);
        expect(result).toHaveBeenCalledOnceWith({functional: false, analytics: false, personalization: false});
        ['true', 'auto', 1, {}, null, undefined].forEach(function (value) {
            state = {purposes: {Functional: value, Analytics: value, Advertising: value}};
            provider.evaluate(result);
            expect(result.calls.mostRecent().args).toEqual([{functional: false, analytics: false, personalization: false}]);
        });
    });

    it('maps all permission combinations through the core without granting personalization alone', function () {
        [false, true].forEach(function (functional) {
            [false, true].forEach(function (analytics) {
                [false, true].forEach(function (personalization) {
                    state = {purposes: {Functional: functional, Analytics: analytics, Advertising: personalization}};
                    consent.configure({provider: integration.create()});
                    const result = evaluate(consent.features.RECOMMENDATIONS).calls.mostRecent().args[0];
                    expect(result.granted).toBe(true);
                    expect(result.userData.profile).toBe(analytics && personalization);
                    expect(evaluate(consent.features.ACTIVITIES).calls.mostRecent().args[0].granted).toBe(analytics);
                    expect(evaluate(consent.features.PRESENTATION_STORAGE).calls.mostRecent().args[0].granted).toBe(functional);
                });
            });
        });
    });

    it('copies configurable purpose mappings and requires every mapped purpose', function () {
        const mappings = {functional: 'Preferences', personalization: ['Experience', 'SaleOfInfo']};
        const provider = integration.create(mappings);
        mappings.personalization.push('LaterMutation');
        state = {purposes: {Preferences: true, Analytics: 'Auto', Experience: true, SaleOfInfo: false}};
        const result = jasmine.createSpy('result');
        provider.evaluate(result);
        expect(result).toHaveBeenCalledOnceWith({functional: true, analytics: true, personalization: false});
        state.purposes.SaleOfInfo = true;
        provider.evaluate(result);
        expect(result.calls.mostRecent().args).toEqual([{functional: true, analytics: true, personalization: true}]);
        [null, [], {unknown: 'Analytics'}, {analytics: []}, {analytics: ''}, {analytics: [true]}].forEach(function (value) {
            expect(function () { integration.create(value); }).toThrow();
        });
    });

    it('uses one ready callback while loading and preserves existing Airgap options', function () {
        window.airgap = {loadOptions: {testOption: true}};
        const provider = integration.create();
        consent.configure({timeoutInMs: 10, provider: provider});
        const initial = evaluate(consent.features.ACTIVITIES);
        expect(window.airgap.loadOptions).toEqual({testOption: true});
        expect(window.airgap.readyQueue.length).toBe(1);
        jasmine.clock().tick(10);
        expect(initial.calls.mostRecent().args[0].granted).toBe(false);
        const next = evaluate(consent.features.ACTIVITIES);
        const queue = window.airgap.readyQueue.slice();
        expect(queue.length).toBe(1);
        window.airgap = api;
        queue[0](api);
        expect(next.calls.mostRecent().args[0].granted).toBe(true);
        expect(initial).toHaveBeenCalledTimes(1);
    });

    it('updates on consent-change and consent-resolution and removes both listeners on unsubscribe', function () {
        const provider = integration.create();
        const listener = jasmine.createSpy('listener');
        const unsubscribe = provider.onChange(listener);
        subscriptions.push(unsubscribe);
        listener.calls.reset();
        state.purposes.Analytics = false;
        api.dispatchEvent(new Event('consent-change'));
        expect(listener).toHaveBeenCalledOnceWith({functional: true, analytics: false, personalization: true});
        state.purposes.Advertising = false;
        api.dispatchEvent(new Event('consent-resolution'));
        expect(listener.calls.mostRecent().args).toEqual([{functional: true, analytics: false, personalization: false}]);
        unsubscribe();
        unsubscribe();
        expect(api.removeEventListener).toHaveBeenCalledTimes(2);
        api.dispatchEvent(new Event('consent-change'));
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('ignores late readiness after core reconfiguration and does not retain event subscriptions', function () {
        let ready;
        window.airgap = {ready: function (callback) { ready = callback; }};
        consent.configure({provider: integration.create(), timeoutInMs: 10});
        const result = evaluate(consent.features.RECOMMENDATIONS);
        consent.configure({timeoutInMs: 10});
        expect(result.calls.mostRecent().args[0].granted).toBe(false);
        window.airgap = api;
        ready(api);
        expect(api.addEventListener).not.toHaveBeenCalled();
        expect(result).toHaveBeenCalledTimes(1);
    });

    it('uses the core timeout for unknown snapshots and read errors, then recovers on updates', function () {
        spyOn(console, 'error');
        state = null;
        consent.configure({provider: integration.create(), timeoutInMs: 10});
        const unknown = evaluate(consent.features.RECOMMENDATIONS);
        expect(unknown).not.toHaveBeenCalled();
        jasmine.clock().tick(10);
        expect(unknown.calls.mostRecent().args[0].userData).toEqual({identifiers: false, profile: false});
        api.getConsent.and.throwError('CMP unavailable');
        const failed = evaluate(consent.features.ACTIVITIES);
        jasmine.clock().tick(10);
        expect(failed.calls.mostRecent().args[0].granted).toBe(false);
        api.getConsent.and.callFake(function () { return {purposes: {Analytics: true}}; });
        api.dispatchEvent(new Event('consent-resolution'));
        expect(evaluate(consent.features.ACTIVITIES).calls.mostRecent().args[0].granted).toBe(true);
    });

    it('does not send activities, collect users or probe storage while evaluating', function () {
        const activity = spyOn(Breinify, 'activity');
        const user = spyOn(Breinify.UTL.user, 'create');
        const storage = spyOn(Breinify.UTL.storage, 'isAvailable');
        consent.configure({provider: integration.create()});
        evaluate(consent.features.ACTIVITIES);
        expect(activity).not.toHaveBeenCalled();
        expect(user).not.toHaveBeenCalled();
        expect(storage).not.toHaveBeenCalled();
    });
});
