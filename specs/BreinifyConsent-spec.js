"use strict";

describe('Breinify core consent', function () {
    const consent = Breinify.UTL.consent;
    let subscriptions;

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

    it('is a core object usable before setConfig or utility initialization', function () {
        expect(typeof consent).toBe('object');
        const configure = spyOn(Breinify, 'setConfig');
        const initialize = spyOn(Breinify.UTL, '_init');
        const callback = jasmine.createSpy('callback');
        consent.evaluate(callback);
        expect(callback).toHaveBeenCalledOnceWith({});
        consent.configure({provider: {evaluate: function (resolve) { resolve({example: true}); }}});
        const configuredCallback = jasmine.createSpy('configuredCallback');
        consent.evaluate(configuredCallback);
        expect(configuredCallback).toHaveBeenCalledOnceWith({example: true});
        expect(configure).not.toHaveBeenCalled();
        expect(initialize).not.toHaveBeenCalled();
    });

    it('waits for initial information and shares the evaluation across concurrent operations', function () {
        let resolve;
        const provider = {evaluate: jasmine.createSpy('evaluate').and.callFake(function (callback) {
            resolve = callback;
        })};
        consent.configure({provider: provider, timeoutInMs: 50});
        const first = jasmine.createSpy('first');
        const second = jasmine.createSpy('second');
        consent.evaluate(first);
        consent.evaluate(second);
        jasmine.clock().tick(49);
        expect(first).not.toHaveBeenCalled();
        expect(second).not.toHaveBeenCalled();
        expect(provider.evaluate).toHaveBeenCalledTimes(1);
        resolve({example: true});
        expect(first).toHaveBeenCalledOnceWith({example: true});
        expect(second).toHaveBeenCalledOnceWith({example: true});
        jasmine.clock().tick(100);
        expect(first).toHaveBeenCalledTimes(1);
    });

    it('queries the provider again for each subsequent operation without caching a grant', function () {
        let permissions = {example: true};
        const provider = {evaluate: jasmine.createSpy('evaluate').and.callFake(function (callback) {
            callback(permissions);
        })};
        consent.configure({provider: provider});
        const first = jasmine.createSpy('first');
        consent.evaluate(first);
        permissions = {example: false};
        const second = jasmine.createSpy('second');
        consent.evaluate(second);
        expect(first).toHaveBeenCalledOnceWith({example: true});
        expect(second).toHaveBeenCalledOnceWith({example: false});
        expect(provider.evaluate).toHaveBeenCalledTimes(3);
    });

    it('uses the configured timeout and accepts a late result without replaying the operation', function () {
        let resolve;
        consent.configure({timeoutInMs: 20, provider: {evaluate: function (callback) { resolve = callback; }}});
        const changes = jasmine.createSpy('changes');
        subscriptions.push(consent.onChange(changes));
        const operation = jasmine.createSpy('operation');
        consent.evaluate(operation);
        jasmine.clock().tick(20);
        expect(operation).toHaveBeenCalledOnceWith({});
        expect(changes).toHaveBeenCalledOnceWith({});
        resolve({example: true});
        expect(changes.calls.mostRecent().args).toEqual([{example: true}]);
        expect(operation).toHaveBeenCalledTimes(1);
    });

    it('uses the default timeout when the provider is absent', function () {
        consent.configure({});
        const callback = jasmine.createSpy('callback');
        consent.evaluate(callback);
        jasmine.clock().tick(2499);
        expect(callback).not.toHaveBeenCalled();
        jasmine.clock().tick(1);
        expect(callback).toHaveBeenCalledOnceWith({});
    });

    it('resolves pending operations from an observer and ignores an older query response', function () {
        let resolve;
        let change;
        consent.configure({provider: {
            evaluate: function (callback) { resolve = callback; },
            onChange: function (listener) { change = listener; }
        }});
        const callback = jasmine.createSpy('callback');
        const changes = jasmine.createSpy('changes');
        subscriptions.push(consent.onChange(changes));
        consent.evaluate(callback);
        change({example: false});
        resolve({example: true});
        change({example: false});
        expect(callback).toHaveBeenCalledOnceWith({example: false});
        expect(changes).toHaveBeenCalledOnceWith({example: false});
    });

    it('ignores a timed-out response after a newer evaluation has started', function () {
        const replies = [];
        consent.configure({timeoutInMs: 10, provider: {evaluate: function (callback) { replies.push(callback); }}});
        jasmine.clock().tick(10);
        const callback = jasmine.createSpy('callback');
        consent.evaluate(callback);
        replies[0]({example: true});
        expect(callback).not.toHaveBeenCalled();
        replies[1]({example: false});
        expect(callback).toHaveBeenCalledOnceWith({example: false});
    });

    it('does not deliver a stale grant when an observer revokes consent during notification', function () {
        let resolve;
        let change;
        consent.configure({provider: {
            evaluate: function (callback) { resolve = callback; },
            onChange: function (listener) { change = listener; }
        }});
        subscriptions.push(consent.onChange(function (permissions) {
            if (permissions.example === true) {
                change({example: false});
            }
        }));
        const observer = jasmine.createSpy('observer');
        subscriptions.push(consent.onChange(observer));
        const callback = jasmine.createSpy('callback');
        consent.evaluate(callback);
        resolve({example: true});
        expect(observer).toHaveBeenCalledOnceWith({example: false});
        expect(callback).toHaveBeenCalledOnceWith({});
    });

    it('cleans up replaced providers and discards their pending callbacks and observer updates', function () {
        let resolve;
        let change;
        const cleanup = jasmine.createSpy('cleanup');
        consent.configure({provider: {
            evaluate: function (callback) { resolve = callback; },
            onChange: function (listener) { change = listener; return cleanup; }
        }});
        const oldCallback = jasmine.createSpy('oldCallback');
        consent.evaluate(oldCallback);
        consent.configure({provider: {evaluate: function (callback) { callback({example: false}); }}});
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(oldCallback).toHaveBeenCalledOnceWith({});
        const changes = jasmine.createSpy('changes');
        subscriptions.push(consent.onChange(changes));
        resolve({example: true});
        change({example: true});
        expect(changes).not.toHaveBeenCalled();
    });

    it('copies and freezes permissions and supports independent unsubscribe functions', function () {
        let change;
        consent.configure({provider: {
            evaluate: function () {},
            onChange: function (listener) { change = listener; }
        }});
        const listener = jasmine.createSpy('listener');
        const first = consent.onChange(listener);
        subscriptions.push(first);
        subscriptions.push(consent.onChange(listener));
        first();
        first();
        const source = {example: true};
        change(source);
        source.example = false;
        const snapshot = listener.calls.mostRecent().args[0];
        expect(listener).toHaveBeenCalledTimes(1);
        expect(snapshot).toEqual({example: true});
        expect(Object.isFrozen(snapshot)).toBe(true);
    });

    it('does not grant malformed values or skip the wait when a provider throws', function () {
        spyOn(console, 'error');
        consent.configure({timeoutInMs: 10, provider: {evaluate: function (callback) {
            callback({example: 'true'});
            throw new Error('CMP unavailable');
        }}});
        const callback = jasmine.createSpy('callback');
        consent.evaluate(callback);
        jasmine.clock().tick(9);
        expect(callback).not.toHaveBeenCalled();
        jasmine.clock().tick(1);
        expect(callback).toHaveBeenCalledOnceWith({});
        expect(console.error).toHaveBeenCalled();
    });

    it('isolates failed observers and consumers without generating activity requests', function () {
        spyOn(console, 'error');
        const activity = spyOn(Breinify, 'activity');
        let resolve;
        consent.configure({provider: {evaluate: function (callback) { resolve = callback; }}});
        subscriptions.push(consent.onChange(function () { throw new Error('Observer failed'); }));
        const observer = jasmine.createSpy('observer');
        subscriptions.push(consent.onChange(observer));
        consent.evaluate(function () { throw new Error('Consumer failed'); });
        const callback = jasmine.createSpy('callback');
        consent.evaluate(callback);
        resolve({example: true});
        expect(observer).toHaveBeenCalledOnceWith({example: true});
        expect(callback).toHaveBeenCalledOnceWith({example: true});
        expect(activity).not.toHaveBeenCalled();
    });

    it('rejects invalid configuration before replacing the active provider', function () {
        consent.configure({provider: {evaluate: function (callback) { callback({example: true}); }}});
        expect(function () { consent.configure({timeoutInMs: -1}); }).toThrowError(RangeError);
        expect(function () { consent.configure({timeoutInMs: Infinity}); }).toThrowError(RangeError);
        expect(function () { consent.configure({provider: {}}); }).toThrowError(TypeError);
        expect(function () { consent.evaluate(null); }).toThrowError(TypeError);
        expect(function () { consent.onChange(null); }).toThrowError(TypeError);
        const callback = jasmine.createSpy('callback');
        consent.evaluate(callback);
        expect(callback).toHaveBeenCalledOnceWith({example: true});
    });
});
