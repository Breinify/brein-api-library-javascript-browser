"use strict";

describe('OneTrust consent integration', function () {
    const consent = Breinify.UTL.consent;
    const integration = consent.integrations.onetrust;
    let original;
    let subscriptions;
    let state;
    let api;

    function setState(functional, analytics) {
        window.OnetrustActiveGroups = ',C0001,' + (functional ? 'C0003,' : '') + (analytics ? 'C0002,' : '');
    }

    function emit() {
        window.dispatchEvent(new Event('OneTrustGroupsUpdated'));
    }

    function evaluate(feature) {
        const callback = jasmine.createSpy('decision');
        consent.evaluate(feature, callback);
        return callback;
    }

    beforeEach(function () {
        original = window.OnetrustActiveGroups;
        subscriptions = [];
        state = {};

        setState(true, true);
        jasmine.clock().install();
    });

    afterEach(function () {
        subscriptions.forEach(function (unsubscribe) { unsubscribe(); });
        consent.configure({timeoutInMs: 0});
        jasmine.clock().tick(1);
        jasmine.clock().uninstall();
        if (typeof original === 'undefined') {
            delete window.OnetrustActiveGroups;
        } else {
            window.OnetrustActiveGroups = original;
        }
    });

    it('creates a provider without changing globals or configuring consent', function () {
        delete window.OnetrustActiveGroups;
        const configure = spyOn(consent, 'configure');
        const provider = integration.create();
        expect(typeof provider.evaluate).toBe('function');
        expect(typeof provider.onChange).toBe('function');
        expect(window.OnetrustActiveGroups).toBeUndefined();
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

    it('matches exact comma-delimited group IDs and denies empty active groups', function () {
        const provider = integration.create();
        const result = jasmine.createSpy('result');
        window.OnetrustActiveGroups = ', C0003 ,C00020,C0001,';
        provider.evaluate(result);
        expect(result).toHaveBeenCalledOnceWith({functional: true, analytics: false, personalization: true});
        ['', ',C0001,', ',c0002,'].forEach(function (value) {
            window.OnetrustActiveGroups = value;
            provider.evaluate(result);
            expect(result.calls.mostRecent().args[0]).toEqual({functional: false, analytics: false, personalization: false});
        });
    });

    it('copies configurable group mappings and requires all mapped groups', function () {
        const mappings = {functional: 'preferences', personalization: ['experience', 'advertising']};
        const provider = integration.create(mappings);
        mappings.personalization.push('mutation');
        const result = jasmine.createSpy('result');
        window.OnetrustActiveGroups = ',preferences,C0002,experience,';
        provider.evaluate(result);
        expect(result).toHaveBeenCalledOnceWith({functional: true, analytics: true, personalization: false});
        window.OnetrustActiveGroups += 'advertising,';
        provider.evaluate(result);
        expect(result.calls.mostRecent().args[0].personalization).toBe(true);
    });

    it('waits before the SDK loads and recovers after timeout without replaying the operation', function () {
        delete window.OnetrustActiveGroups;
        const wrapper = window.OptanonWrapper;
        consent.configure({provider: integration.create(), timeoutInMs: 10});
        const result = evaluate(consent.features.RECOMMENDATIONS);
        expect(result).not.toHaveBeenCalled();
        jasmine.clock().tick(10);
        expect(result.calls.mostRecent().args[0].userData).toEqual({identifiers: false, profile: false});
        setState(true, true);
        emit();
        expect(evaluate(consent.features.ACTIVITIES).calls.mostRecent().args[0].granted).toBe(true);
        expect(result).toHaveBeenCalledTimes(1);
        expect(window.OptanonWrapper).toBe(wrapper);
    });

    it('ignores malformed active groups until a usable event arrives', function () {
        window.OnetrustActiveGroups = ['C0002', 'C0003'];
        const provider = integration.create();
        const result = jasmine.createSpy('result');
        const remove = spyOn(window, 'removeEventListener').and.callThrough();
        provider.evaluate(result);
        emit();
        expect(result).not.toHaveBeenCalled();
        setState(true, true);
        emit();
        expect(result).toHaveBeenCalledOnceWith({functional: true, analytics: true, personalization: true});
        expect(remove.calls.allArgs().map(function (args) { return args[0]; })).toContain('OneTrustGroupsUpdated');
        expect(remove.calls.allArgs().map(function (args) { return args[0]; })).toContain('OTConsentApplied');
    });

    it('reads authoritative active groups on both events and ignores stale event data', function () {
        const result = jasmine.createSpy('result');
        subscriptions.push(integration.create().onChange(result));
        setState(false, false);
        window.dispatchEvent(new CustomEvent('OTConsentApplied', {detail: ['C0002', 'C0003']}));
        expect(result).toHaveBeenCalledOnceWith({functional: false, analytics: false, personalization: false});
    });

    it('removes observers after core reconfiguration', function () {
        delete window.OnetrustActiveGroups;
        const remove = spyOn(window, 'removeEventListener').and.callThrough();
        consent.configure({provider: integration.create(), timeoutInMs: 10});
        const result = evaluate(consent.features.ACTIVITIES);
        consent.configure({timeoutInMs: 10});
        expect(remove.calls.allArgs().map(function (args) { return args[0]; })).toContain('OneTrustGroupsUpdated');
        setState(true, true);
        emit();
        expect(result).toHaveBeenCalledTimes(1);
        expect(result.calls.mostRecent().args[0].granted).toBe(false);
    });

});
