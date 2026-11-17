"use strict";

describe('Breinify shared storage', function () {
    const storage = Breinify.UTL.storage;
    const local = window.localStorage;
    const session = window.sessionStorage;
    const prefix = 'br-storage-spec-';
    let previousInstance;

    beforeEach(function () {
        previousInstance = storage.instance;
    });

    afterEach(function () {
        storage.instance = previousInstance;
        [local, session, storage.getStorage('memory')].forEach(function (store) {
            for (let i = store.length - 1; i >= 0; i--) {
                const key = store.key(i);
                if (key.indexOf(prefix) !== -1) store.removeItem(key);
            }
        });
    });

    it('preserves existing raw values and separates local and session entries', function () {
        const key = prefix + 'raw';
        local.setItem(key, 'existing');
        expect(storage.getItem('local', key)).toBe('existing');
        storage.setItem('session', key, 'session');
        expect(storage.getItem('session', key)).toBe('session');
        expect(local.getItem(key)).toBe('existing');
        storage.removeItem('session', key);
        expect(session.getItem(key)).toBeNull();
        expect(local.getItem(key)).toBe('existing');
    });

    it('uses no browser storage for explicitly requested memory values', function () {
        spyOnProperty(window, 'localStorage', 'get').and.throwError('Local unavailable');
        spyOnProperty(window, 'sessionStorage', 'get').and.throwError('Session unavailable');
        storage.setItem('memory', prefix + 'memory', 12);
        expect(storage.getItem('memory', prefix + 'memory')).toBe('12');
        expect(storage.keys('memory')).toContain(prefix + 'memory');
    });

    it('routes previously obtained handles through the current shared access methods', function () {
        const handle = storage.getStorage('local');
        const read = spyOn(storage, 'getItem').and.returnValue('current');
        const write = spyOn(storage, 'setItem');
        const remove = spyOn(storage, 'removeItem');
        expect(handle.getItem(prefix + 'handle')).toBe('current');
        handle.setItem(prefix + 'handle', 'value');
        handle.removeItem(prefix + 'handle');
        expect(read).toHaveBeenCalledWith('local', prefix + 'handle');
        expect(write).toHaveBeenCalledWith('local', prefix + 'handle', 'value');
        expect(remove).toHaveBeenCalledWith('local', prefix + 'handle');
    });

    it('does not retain native storage access after the browser denies access', function () {
        const handle = storage.getStorage('local');
        spyOnProperty(window, 'localStorage', 'get').and.throwError('Storage blocked');
        expect(function () { handle.getItem(prefix + 'blocked'); }).toThrowError('Storage blocked');
        expect(function () { handle.setItem(prefix + 'blocked', 'data'); }).toThrowError('Storage blocked');
        expect(function () { storage.getItem('local', prefix + 'blocked'); }).toThrowError('Storage blocked');
        expect(storage.getItem('memory', prefix + 'blocked')).toBeNull();
    });

    it('propagates write failures so existing cookie fallback code can handle them', function () {
        const failure = new Error('Storage quota exceeded');
        spyOn(Storage.prototype, 'setItem').and.throwError(failure);
        expect(function () { storage.setItem('local', prefix + 'full', 'data'); }).toThrow(failure);
        expect(storage.isAvailable('local')).toBe(false);
        expect(storage.getItem('memory', prefix + 'full')).toBeNull();
    });

    it('probes availability without leaving data or overwriting existing probe keys', function () {
        const key = prefix + 'probe';
        local.setItem(key, 'keep');
        const before = storage.keys('local').sort();
        expect(storage.isAvailable('local')).toBe(true);
        expect(storage.keys('local').sort()).toEqual(before);
        expect(local.getItem(key)).toBe('keep');
    });

    it('returns an explicit fallback for missing, malformed, or inaccessible JSON', function () {
        const key = prefix + 'json';
        const fallback = {missing: true};
        expect(storage.getJson('local', key)).toBeNull();
        expect(storage.getJson('local', key, fallback)).toBe(fallback);
        local.setItem(key, '{broken');
        expect(function () { storage.getJson('local', key); }).toThrowError(SyntaxError);
        expect(storage.getJson('local', key, fallback)).toBe(fallback);
        expect(storage.getJson('local', key, undefined)).toBeUndefined();
        spyOnProperty(window, 'localStorage', 'get').and.throwError('Read blocked');
        expect(function () { storage.getJson('local', key); }).toThrowError('Read blocked');
        expect(storage.getJson('local', key, fallback)).toBe(fallback);
    });

    it('preserves falsy JSON values and copies objects by serialization', function () {
        const key = prefix + 'values';
        [false, 0, '', null, [], {value: 'é'}].forEach(function (value) {
            storage.setJson('session', key, value);
            expect(session.getItem(key)).toBe(JSON.stringify(value));
            expect(storage.getJson('session', key, 'fallback')).toEqual(value);
        });
        const value = {count: 1};
        storage.setJson('local', key, value);
        value.count = 2;
        expect(storage.getJson('local', key)).toEqual({count: 1});
    });

    it('does not overwrite an entry when JSON serialization fails', function () {
        const key = prefix + 'serialize';
        storage.setJson('local', key, {keep: true});
        const circular = {};
        circular.self = circular;
        expect(function () { storage.setJson('local', key, circular); }).toThrowError(TypeError);
        expect(function () { storage.setJson('local', key, undefined); }).toThrowError(TypeError);
        expect(storage.getJson('local', key)).toEqual({keep: true});
    });

    it('preserves JSON fallback behavior through a retained storage handle', function () {
        const handle = storage.getStorage('session');
        const key = prefix + 'json-handle';
        handle.setJson(key, {count: 1});
        expect(handle.getJson(key)).toEqual({count: 1});
        handle.setItem(key, 'invalid');
        expect(function () { handle.getJson(key); }).toThrowError(SyntaxError);
        expect(handle.getJson(key, false)).toBe(false);
    });

    it('keeps the legacy cache envelope and prefix readable', function () {
        const name = prefix + 'cache';
        const key = 'breinify-' + name;
        const stored = {created: 10, expires: Date.now() + 60000, data: {products: [1, 2]}};
        local.setItem(key, JSON.stringify(stored));
        storage.instance = null;
        storage.init({});
        expect(storage.get(name)).toEqual(stored.data);
        expect(storage.isExpired(name)).toBe(false);
        storage.update(name, 60, {products: [3]});
        const updated = JSON.parse(local.getItem(key));
        expect(updated.data).toEqual({products: [3]});
        expect(updated.expires - updated.created).toBe(60000);
    });

    it('filters entries before parsing JSON and tolerates malformed entries only with a fallback', function () {
        local.setItem(prefix + 'entry-a', '{"count":1}');
        local.setItem(prefix + 'entry-b', 'invalid');
        local.setItem(prefix + 'unrelated', 'also invalid');
        expect(function () { storage.entries('local', {prefix: prefix + 'entry', json: true}); })
            .toThrowError(SyntaxError);
        const entries = storage.entries('local', {prefix: prefix + 'entry', json: true, fallback: null});
        expect(Object.fromEntries(entries)).toEqual({
            [prefix + 'entry-a']: {count: 1},
            [prefix + 'entry-b']: null
        });
        expect(storage.entries('local', {prefix: prefix + 'entry-a', json: true}))
            .toEqual([[prefix + 'entry-a', {count: 1}]]);
        expect(storage.entries('local', {prefix: prefix + 'entry-b'}))
            .toEqual([[prefix + 'entry-b', 'invalid']]);
    });

    it('applies the key filter after the prefix without reading rejected values', function () {
        const accepted = prefix + 'filter-accepted';
        const rejected = prefix + 'filter-rejected';
        local.setItem(accepted, '{"count":1}');
        local.setItem(rejected, 'invalid');
        local.setItem(prefix + 'unrelated', 'invalid');
        const read = spyOn(storage, 'getItem').and.callThrough();
        const filter = jasmine.createSpy('filter').and.callFake(function (key) {
            return key === accepted;
        });

        expect(storage.entries('local', {prefix: prefix + 'filter-', json: true}, filter))
            .toEqual([[accepted, {count: 1}]]);
        expect(filter.calls.allArgs().sort()).toEqual([[accepted], [rejected]]);
        expect(read.calls.allArgs()).toEqual([['local', accepted]]);
    });

    it('supports a filter without options and reads nothing when every key is rejected', function () {
        storage.setItem('memory', prefix + 'filtered', 'value');
        const read = spyOn(storage, 'getItem').and.callThrough();
        expect(storage.entries('memory', undefined, function () { return false; })).toEqual([]);
        expect(read).not.toHaveBeenCalled();
    });

    it('propagates filter errors even when a JSON fallback is supplied', function () {
        local.setItem(prefix + 'filter-error', 'invalid');
        const failure = new Error('Invalid filter');
        const read = spyOn(storage, 'getItem').and.callThrough();
        expect(function () {
            storage.entries('local', {prefix: prefix + 'filter-error', json: true, fallback: null}, function () {
                throw failure;
            });
        }).toThrow(failure);
        expect(function () { storage.entries('local', {}, 'invalid'); }).toThrowError(TypeError);
        expect(read).not.toHaveBeenCalled();
    });

    it('returns a snapshot that supports removal without skipping entries', function () {
        [1, 2, 3].forEach(function (index) {
            storage.setItem('session', prefix + 'remove-' + index, String(index));
        });
        const entries = storage.entries('session', {prefix: prefix + 'remove-'});
        entries.forEach(function (entry) { storage.removeItem('session', entry[0]); });
        expect(entries.length).toBe(3);
        expect(storage.entries('session', {prefix: prefix + 'remove-'})).toEqual([]);
        expect(entries.map(function (entry) { return entry[1]; }).sort()).toEqual(['1', '2', '3']);
    });

    it('preserves the legacy cache memory fallback when browser storage is unavailable', function () {
        spyOnProperty(window, 'localStorage', 'get').and.throwError('Storage blocked');
        storage.instance = null;
        storage.init({});
        storage.update(prefix + 'fallback-cache', 60, ['cached']);
        expect(storage.get(prefix + 'fallback-cache')).toEqual(['cached']);
        expect(storage.instance).toBe(storage.getStorage('memory'));
    });

    it('keeps cookie callers and the central cookie API on the same object', function () {
        expect(storage.cookie).toBe(Breinify.UTL.cookie);
        const read = spyOn(Breinify.UTL.cookie, 'getJson').and.returnValue({legacy: true});
        expect(storage.cookie.getJson(prefix + 'cookie')).toEqual({legacy: true});
        expect(read).toHaveBeenCalledWith(prefix + 'cookie');
    });

    it('rejects unsupported storage types without touching another location', function () {
        expect(function () { storage.getStorage('other'); }).toThrowError(TypeError);
        expect(function () { storage.setItem('other', prefix + 'invalid', 'data'); }).toThrowError(TypeError);
        expect(local.getItem(prefix + 'invalid')).toBeNull();
        expect(session.getItem(prefix + 'invalid')).toBeNull();
    });
});
