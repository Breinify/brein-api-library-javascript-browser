"use strict";

describe('Activities delayed storage', function () {
    var state, plugin, originalFilter, hadFilter;
    var prefix = 'breinify-sa-data-';

    beforeEach(function () {
        state = {
            entries: new Map(),
            cookieJson: null,
            localFull: false,
            localBlocked: false,
            cookieBlocked: false,
            cookieThrows: false
        };
        var activities = Breinify.plugins.activities;
        originalFilter = activities._delayedStorageSpecFilter;
        hadFilter = Object.prototype.hasOwnProperty.call(activities, '_delayedStorageSpecFilter');
        plugin = {
            activities: activities,
            sent: [],
            ready: function () { activities.checkDelayedActivityData(); }
        };
        spyOn(activities, '_send').and.callFake(function (type, user, tags) {
            plugin.sent.push({type: type, user: user, tags: tags});
        });

        var quotaError = new Error('Storage quota exceeded');
        quotaError.name = 'QuotaExceededError';
        var localStorage = {
            get length() { return state.entries.size; },
            key: function (index) { return Array.from(state.entries.keys())[index] || null; },
            getItem: function (key) { return state.entries.has(key) ? state.entries.get(key) : null; },
            setItem: function (key, value) {
                if (state.localFull) {
                    throw quotaError;
                }
                state.entries.set(key, value);
            },
            removeItem: function (key) { state.entries.delete(key); }
        };
        spyOnProperty(window, 'localStorage', 'get').and.callFake(function () {
            if (state.localBlocked) {
                throw new Error('Storage access denied');
            }
            return localStorage;
        });
        spyOn(Breinify.UTL.cookie, 'domain').and.returnValue('example.com');
        spyOn(Breinify.UTL.cookie, 'getJson').and.callFake(function () {
            if (state.cookieThrows) {
                throw new Error('Cookies are inaccessible');
            }
            return JSON.parse(state.cookieJson);
        });
        spyOn(Breinify.UTL.cookie, 'setJson').and.callFake(function (name, value) {
            if (state.cookieThrows) {
                throw new Error('Cookies are inaccessible');
            } else if (state.cookieBlocked) {
                return;
            }
            // mirror the serialization performed by Breinify.UTL.cookie.setJson
            var json = JSON.stringify(value);
            state.cookieJson = json.replace(/[\u00A0-\u2666]/g, function (c) {
                return '&#' + c.charCodeAt(0) + ';';
            });
        });
    });

    afterEach(function () {
        if (hadFilter) {
            plugin.activities._delayedStorageSpecFilter = originalFilter;
        } else {
            delete plugin.activities._delayedStorageSpecFilter;
        }
    });

    function schedule(plugin, id, tags, filter) {
        return plugin.activities.scheduleDelayedActivity({}, 'clickedRecommendation', tags || {}, 60000, filter, id);
    }

    it('assigns distinct IDs and returns them for activities scheduled without IDs', function () {
        const first = schedule(plugin);
        const second = schedule(plugin);
        expect(typeof first).toBe('string');
        expect(first).not.toBe(second);
        expect(state.entries.has(prefix + 'undefined')).toBe(false);
        expect(state.entries.size).toBe(2);
        expect(plugin.activities.readDelayedActivityData(first).type).toBe('clickedRecommendation');
    });

    it('explicit IDs override a pending activity', function () {
        schedule(plugin, 'click', {product: 'first'});
        expect(schedule(plugin, 'click', {product: 'second'})).toBe('click');
        expect(state.entries.size).toBe(1);
        expect(plugin.activities.readDelayedActivityData('click').tags.product).toBe('second');
    });

    it('falls back after storage fills and drains both stores when pending activities are checked', function () {
        schedule(plugin, 'local');
        state.localFull = true;
        expect(schedule(plugin, 'cookie')).toBe('cookie');
        expect(plugin.activities.readDelayedActivityData('cookie').type).toBe('clickedRecommendation');
        state.localFull = false;
        plugin.ready();
        plugin.ready();
        expect(plugin.sent.length).toBe(2);
        expect(state.entries.size).toBe(0);
        expect(JSON.parse(state.cookieJson)).toEqual({});
    });

    it('drains local activities even when new local writes exceed quota', function () {
        schedule(plugin, 'pending');
        state.localFull = true;
        plugin.ready();
        expect(plugin.sent.length).toBe(1);
        expect(state.entries.size).toBe(0);
    });

    it('overrides IDs across fallback and recovery without sending the old activity', function () {
        schedule(plugin, 'click', {product: 'local'});
        state.localFull = true;
        schedule(plugin, 'click', {product: 'cookie'});
        expect(state.entries.has(prefix + 'click')).toBe(false);
        expect(plugin.activities.readDelayedActivityData('click').tags.product).toBe('cookie');
        state.localFull = false;
        schedule(plugin, 'click', {product: 'latest'});
        plugin.ready();
        expect(plugin.sent.length).toBe(1);
        expect(plugin.sent[0].tags.product).toBe('latest');
        expect(JSON.parse(state.cookieJson)).toEqual({});
    });

    it('falls back when access to localStorage itself is denied', function () {
        state.localBlocked = true;
        expect(schedule(plugin, 'blocked')).toBe('blocked');
        plugin.ready();
        expect(plugin.sent.length).toBe(1);
        expect(plugin.activities.readDelayedActivityData('blocked')).toBe(null);
    });

    it('returns null without throwing when both stores are unavailable', function () {
        state.localBlocked = true;
        state.cookieThrows = true;
        expect(schedule(plugin)).toBe(null);
        expect(plugin.activities.readDelayedActivityData('missing')).toBe(null);
        expect(plugin.ready).not.toThrow();
        expect(function () { plugin.activities.removeDelayedActivityData('missing'); }).not.toThrow();
    });

    it('detects silently rejected cookie writes', function () {
        state.localFull = true;
        state.cookieBlocked = true;
        expect(schedule(plugin)).toBe(null);
        expect(plugin.sent.length).toBe(0);
    });

    it('verifies cookie writes with unicode activity data', function () {
        state.localFull = true;
        expect(schedule(plugin, 'unicode', {product: 'Café'})).toBe('unicode');
    });

    it('preserves delayed filters and expiration when using cookies', function () {
        state.localFull = true;
        schedule(plugin, 'filtered', {}, 'activities::_delayedStorageSpecFilter');
        schedule(plugin, 'expired');
        const data = JSON.parse(state.cookieJson);
        data.expired.timestamp = 0;
        state.cookieJson = JSON.stringify(data);
        plugin.activities._delayedStorageSpecFilter = function () {};
        plugin.ready();
        expect(plugin.sent.length).toBe(0);
        expect(plugin.activities.readDelayedActivityData('expired')).toBe(null);
        expect(plugin.activities.readDelayedActivityData('filtered')).not.toBe(null);
        plugin.activities._delayedStorageSpecFilter = function (id, activity, callback) { callback(id, activity, true); };
        plugin.ready();
        expect(plugin.sent.length).toBe(1);
    });

    it('ignores corrupt stored JSON and preserves unrelated storage', function () {
        state.entries.set('other-script', 'keep');
        state.entries.set(prefix + 'corrupt', '{');
        state.entries.set(prefix + 'invalid', '42');
        schedule(plugin, 'valid');
        plugin.ready();
        expect(plugin.sent.length).toBe(1);
        expect(state.entries.get('other-script')).toBe('keep');
    });

    it('reads and removes legacy undefined-ID entries', function () {
        schedule(plugin, 'undefined');
        plugin.ready();
        expect(plugin.sent.length).toBe(1);
        expect(state.entries.has(prefix + 'undefined')).toBe(false);
    });
});
