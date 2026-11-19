"use strict";

describe('Osano consent integration', function () {
    const consent = Breinify.UTL.consent;
    const integration = consent.integrations.osano;
    let original;
    let subscriptions;
    let state;
    let api;

    function install(state) {
        const api = new EventTarget();
        api.getConsent = jasmine.createSpy('getConsent').and.callFake(function () { return state.value; });
        spyOn(api, 'addEventListener').and.callThrough();
        spyOn(api, 'removeEventListener').and.callThrough();
        window.Osano = {cm: api};
        return api;
    }

    function setState(functional, analytics) {
        state.value = {PERSONALIZATION: functional ? 'ACCEPT' : 'DENY', ANALYTICS: analytics ? 'ACCEPT' : 'DENY'};
    }

    function emit() {
        api.dispatchEvent(new Event('osano-cm-consent-saved'));
    }

    function evaluate(feature) {
        const callback = jasmine.createSpy('decision');
        consent.evaluate(feature, callback);
        return callback;
    }

    beforeEach(function () {
        original = window.Osano;
        subscriptions = [];
        state = {};
        api = install(state);
        setState(true, true);
        jasmine.clock().install();
    });

    afterEach(function () {
        subscriptions.forEach(function (unsubscribe) { unsubscribe(); });
        consent.configure({timeoutInMs: 0});
        jasmine.clock().tick(1);
        jasmine.clock().uninstall();
        if (typeof original === 'undefined') {
            delete window.Osano;
        } else {
            window.Osano = original;
        }
    });

    it('creates a provider without changing globals or configuring consent', function () {
        delete window.Osano;
        const configure = spyOn(consent, 'configure');
        const provider = integration.create();
        expect(typeof provider.evaluate).toBe('function');
        expect(typeof provider.onChange).toBe('function');
        expect(window.Osano).toBeUndefined();
        expect(configure).not.toHaveBeenCalled();
    });

    it('reads fresh grants and revocations for every operation', function () {
        const provider = integration.create();
        const result = jasmine.createSpy('result');
        provider.evaluate(result);
        expect(result).toHaveBeenCalledOnceWith({functional: true, analytics: true, personalization: true});
        setState(false, false);
        provider.evaluate(result);
        expect(result.calls.mostRecent().args[0]).toEqual({functional: false, analytics: false, personalization: false});
        setState(false, true);
        provider.evaluate(result);
        expect(result.calls.mostRecent().args[0]).toEqual({functional: false, analytics: true, personalization: false});
    });

    it('maps all default combinations through the core and requires Analytics for Personalization', function () {
        [false, true].forEach(function (functional) {
            [false, true].forEach(function (analytics) {
                setState(functional, analytics);
                consent.configure({provider: integration.create()});
                const result = evaluate(consent.features.RECOMMENDATIONS).calls.mostRecent().args[0];
                expect(result.granted).toBe(true);
                expect(result.userData.profile).toBe(functional && analytics);
                expect(evaluate(consent.features.ACTIVITIES).calls.mostRecent().args[0].granted).toBe(analytics);
                expect(evaluate(consent.features.PRESENTATION_STORAGE).calls.mostRecent().args[0].granted).toBe(functional);
            });
        });
    });

    it('rejects invalid mappings', function () {
        [null, [], {unknown: 'Analytics'}, {analytics: []}, {analytics: ''}, {analytics: [true]}].forEach(function (value) {
            expect(function () { integration.create(value); }).toThrow();
        });
    });

    it('shares observation and removes it when the last listener unsubscribes', function () {
        const provider = integration.create();
        const first = jasmine.createSpy('first');
        const second = jasmine.createSpy('second');
        const stopFirst = provider.onChange(first);
        const stopSecond = provider.onChange(second);
        subscriptions.push(stopFirst, stopSecond);
        setState(false, true);
        emit();
        expect(first).toHaveBeenCalledOnceWith({functional: false, analytics: true, personalization: false});
        expect(second).toHaveBeenCalledTimes(1);
        stopFirst();
        stopFirst();
        setState(false, false);
        emit();
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
        stopSecond();
        emit();
        expect(second).toHaveBeenCalledTimes(2);
    });

    it('does not collect users, send activities or probe storage while evaluating', function () {
        const activity = spyOn(Breinify, 'activity');
        const user = spyOn(Breinify.UTL.user, 'create');
        const storage = spyOn(Breinify.UTL.storage, 'isAvailable');
        consent.configure({provider: integration.create()});
        evaluate(consent.features.ACTIVITIES);
        expect(activity).not.toHaveBeenCalled();
        expect(user).not.toHaveBeenCalled();
        expect(storage).not.toHaveBeenCalled();
    });

    it('copies custom mappings and requires every category in an array', function () {
        const mappings = {functional: 'ESSENTIAL', personalization: ['PERSONALIZATION', 'MARKETING']};
        const provider = integration.create(mappings);
        mappings.personalization.push('MUTATION');
        state.value = {ESSENTIAL: 'ACCEPT', PERSONALIZATION: 'ACCEPT', ANALYTICS: 'ACCEPT', MARKETING: 'DENY'};
        const result = jasmine.createSpy('result');
        provider.evaluate(result);
        expect(result.calls.mostRecent().args[0]).toEqual({functional: true, analytics: true, personalization: false});
        state.value.MARKETING = 'ACCEPT';
        provider.evaluate(result);
        expect(result.calls.mostRecent().args[0].personalization).toBe(true);
    });

    it('accepts only own categories with the exact ACCEPT value', function () {
        const provider = integration.create();
        const result = jasmine.createSpy('result');
        state.value = Object.create({PERSONALIZATION: 'ACCEPT', ANALYTICS: 'ACCEPT'});
        provider.evaluate(result);
        expect(result.calls.mostRecent().args[0].analytics).toBe(false);
        [true, 1, 'accept', 'Auto', null, undefined, {}].forEach(function (value) {
            state.value = {PERSONALIZATION: value, ANALYTICS: value};
            provider.evaluate(result);
            expect(result.calls.mostRecent().args[0]).toEqual({functional: false, analytics: false, personalization: false});
        });
    });

    it('queues initialization before Osano loads and preserves customer queue entries and options', function () {
        delete window.Osano;
        const provider = integration.create();
        const listener = jasmine.createSpy('listener');
        subscriptions.push(provider.onChange(listener));
        const stub = window.Osano;
        stub.options = {example: true};
        stub('onInitialized', function () {});
        provider.evaluate(jasmine.createSpy('pending'));
        expect(stub.data.length).toBe(2);
        expect(stub.options).toEqual({example: true});
        const ready = stub.data[0][1];
        api = install(state);
        ready();
        expect(listener).toHaveBeenCalled();
        expect(api.addEventListener).toHaveBeenCalledTimes(2);
        setState(false, false);
        emit();
        expect(listener.calls.mostRecent().args[0].analytics).toBe(false);
    });

    it('ignores unsaved category toggles and observes saved consent', function () {
        const listener = jasmine.createSpy('listener');
        subscriptions.push(integration.create().onChange(listener));
        api.dispatchEvent(new CustomEvent('osano-cm-consent-changed', {detail: {ANALYTICS: 'DENY'}}));
        expect(listener).not.toHaveBeenCalled();
        setState(false, false);
        emit();
        expect(listener.calls.mostRecent().args[0].analytics).toBe(false);
    });

    it('times out unknown consent, recovers on initialization, and never replays the old operation', function () {
        state.value = undefined;
        consent.configure({provider: integration.create(), timeoutInMs: 10});
        const result = evaluate(consent.features.RECOMMENDATIONS);
        expect(result).not.toHaveBeenCalled();
        jasmine.clock().tick(10);
        expect(result.calls.mostRecent().args[0].userData).toEqual({identifiers: false, profile: false, allowedFields: [], deniedFields: []});
        setState(true, true);
        api.dispatchEvent(new Event('osano-cm-initialized'));
        expect(evaluate(consent.features.ACTIVITIES).calls.mostRecent().args[0].granted).toBe(true);
        expect(result).toHaveBeenCalledTimes(1);
    });

    it('handles synchronous initialized and saved callbacks from an already loaded CMP', function () {
        api.addEventListener.and.callFake(function (name, callback) { callback(); });
        consent.configure({provider: integration.create()});
        expect(evaluate(consent.features.ACTIVITIES).calls.mostRecent().args[0].granted).toBe(true);
    });

    it('removes temporary observers after a standalone pending evaluation resolves', function () {
        state.value = undefined;
        const result = jasmine.createSpy('result');
        integration.create().evaluate(result);
        expect(result).not.toHaveBeenCalled();
        setState(true, true);
        emit();
        expect(result).toHaveBeenCalledOnceWith({functional: true, analytics: true, personalization: true});
        expect(api.removeEventListener).toHaveBeenCalledTimes(2);
        emit();
        expect(result).toHaveBeenCalledTimes(1);
    });

    it('removes only its preload callback and ignores readiness after reconfiguration', function () {
        delete window.Osano;
        consent.configure({provider: integration.create(), timeoutInMs: 10});
        const stub = window.Osano;
        const ready = stub.data[0][1];
        const customer = function () {};
        stub('onInitialized', customer);
        consent.configure({timeoutInMs: 10});
        expect(stub.data.length).toBe(1);
        expect(stub.data[0][1]).toBe(customer);
        api = install(state);
        ready();
        expect(api.addEventListener).not.toHaveBeenCalled();
    });

    it('denies on read errors and recovers on a saved update', function () {
        spyOn(console, 'error');
        api.getConsent.and.throwError('CMP unavailable');
        consent.configure({provider: integration.create(), timeoutInMs: 10});
        const result = evaluate(consent.features.ACTIVITIES);
        jasmine.clock().tick(10);
        expect(result.calls.mostRecent().args[0].granted).toBe(false);
        api.getConsent.and.callFake(function () { return state.value; });
        emit();
        expect(evaluate(consent.features.ACTIVITIES).calls.mostRecent().args[0].granted).toBe(true);
    });

});
