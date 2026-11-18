"use strict";

describe('Consent integration utilities', function () {
    const utils = Breinify.UTL.consent.utils;
    const snapshot = {functional: true, analytics: true, personalization: false};

    it('retains a pending query when a snapshot is unknown and delivers only the latest query', function () {
        const observer = utils.createObserver(function () {});
        const first = jasmine.createSpy('first');
        const latest = jasmine.createSpy('latest');
        observer.wait(first);
        observer.wait(latest);
        observer.publish(null);
        expect(observer.isIdle()).toBe(false);
        expect(latest).not.toHaveBeenCalled();
        observer.publish(snapshot);
        expect(first).not.toHaveBeenCalled();
        expect(latest).toHaveBeenCalledOnceWith(snapshot);
        expect(observer.isIdle()).toBe(true);
    });

    it('preserves a pending evaluation started by the callback being delivered', function () {
        const observer = utils.createObserver(function () {});
        const next = jasmine.createSpy('next');
        observer.wait(function () { observer.wait(next); });
        observer.publish(snapshot);
        expect(observer.isIdle()).toBe(false);
        expect(next).not.toHaveBeenCalled();
        observer.publish(snapshot);
        expect(next).toHaveBeenCalledOnceWith(snapshot);
        expect(observer.isIdle()).toBe(true);
    });

    it('skips listeners removed during delivery and defers new listeners until the next publication', function () {
        const observer = utils.createObserver(function () {});
        const removed = jasmine.createSpy('removed');
        const added = jasmine.createSpy('added');
        let stopRemoved;
        let subscribed = false;
        observer.subscribe(function () {
            stopRemoved();
            if (!subscribed) {
                observer.subscribe(added);
                subscribed = true;
            }
        });
        stopRemoved = observer.subscribe(removed);
        observer.publish(snapshot);
        expect(removed).not.toHaveBeenCalled();
        expect(added).not.toHaveBeenCalled();
        observer.publish(snapshot);
        expect(added).toHaveBeenCalledOnceWith(snapshot);
    });

    it('isolates snapshot mutations and callback exceptions without sending activities', function () {
        const observer = utils.createObserver(function () {});
        const error = spyOn(console, 'error');
        const activity = spyOn(Breinify, 'activity');
        const listener = jasmine.createSpy('listener');
        const pending = jasmine.createSpy('pending');
        observer.subscribe(function (value) {
            value.analytics = false;
            throw new Error('subscriber failed');
        });
        observer.subscribe(listener);
        observer.wait(pending);
        observer.publish(snapshot);
        expect(listener).toHaveBeenCalledOnceWith(snapshot);
        expect(pending).toHaveBeenCalledOnceWith(snapshot);
        expect(snapshot.analytics).toBe(true);
        expect(listener.calls.mostRecent().args[0]).not.toBe(pending.calls.mostRecent().args[0]);
        expect(error).toHaveBeenCalledTimes(1);
        expect(activity).not.toHaveBeenCalled();
    });

    it('cleans up once after the last unsubscribe and discards the unresolved query', function () {
        const cleanup = jasmine.createSpy('cleanup');
        const observer = utils.createObserver(cleanup);
        const pending = jasmine.createSpy('pending');
        const stopFirst = observer.subscribe(function () {});
        const stopLast = observer.subscribe(function () {});
        observer.wait(pending);
        stopFirst();
        stopFirst();
        expect(cleanup).not.toHaveBeenCalled();
        expect(observer.hasListeners()).toBe(true);
        stopLast();
        stopLast();
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(observer.hasListeners()).toBe(false);
        expect(observer.isIdle()).toBe(true);
        observer.publish(snapshot);
        expect(pending).not.toHaveBeenCalled();
    });

    it('keeps separate adapter instances independent', function () {
        const first = utils.createObserver(function () {});
        const second = utils.createObserver(function () {});
        const pending = jasmine.createSpy('pending');
        first.wait(pending);
        second.publish(snapshot);
        expect(pending).not.toHaveBeenCalled();
        expect(first.isIdle()).toBe(false);
        expect(second.isIdle()).toBe(true);
    });
});
