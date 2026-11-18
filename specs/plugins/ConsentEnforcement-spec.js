'use strict';

describe('Consent enforcement', function () {
    const consent = Breinify.UTL.consent;
    const storage = Breinify.UTL.storage;
    const user = Breinify.UTL.user;
    let permissions;
    let notify;
    let ajax;
    let createUser;

    function configure(value, extra) {
        permissions = value;
        consent.configure(Object.assign({}, extra, {
            provider: {
                evaluate: function (callback) { callback(permissions); },
                onChange: function (callback) { notify = callback; return function () {}; }
            }
        }));
    }

    function sent() {
        return JSON.parse(ajax.calls.mostRecent().args[0].data);
    }

    beforeEach(function () {
        consent.configure({enabled: false});
        localStorage.clear();
        sessionStorage.clear();
        user.browserId = null;
        user.sessionId = null;
        createUser = jasmine.createSpy('createUser').and.returnValue({email: 'private@example.test'});
        Breinify.setConfig({apiKey: 'test-key', validate: false, handleParameters: false,
            handleUtm: false, handleReferrer: false, createUser: createUser});
        ajax = spyOn(Breinify.UTL._jquery(), 'ajax');
    });

    afterEach(function () {
        consent.configure({enabled: false});
        localStorage.clear();
        sessionStorage.clear();
    });

    it('preserves legacy user enrichment and storage when disabled', function () {
        const value = user.create();
        expect(value.email).toBe('private@example.test');
        expect(createUser).toHaveBeenCalled();
        storage.setItem('local', 'custom', 'value');
        expect(storage.getItem('local', 'custom')).toBe('value');
        expect(user.getBrowserId()).toBe(user.getBrowserId());
    });

    it('sends content with fresh IDs and no profile, existing IDs, or enrichment hooks', function () {
        configure({});
        const input = {email: 'passed@example.test', sessionId: 'old-session',
            additional: {identifiers: {browserId: 'old-browser'}, location: {latitude: 1, longitude: 2}}};
        Breinify.recommendation(input, {namedRecommendations: ['home']}, function () {});
        const first = sent();
        Breinify.recommendation(input, {namedRecommendations: ['home']}, function () {});
        const second = sent();
        expect(first.user.email).toBeUndefined();
        expect(first.user.additional.location).toBeUndefined();
        expect(first.user.additional.url).toBeUndefined();
        expect(first.user.sessionId).not.toBe('old-session');
        expect(first.user.additional.identifiers.browserId).not.toBe('old-browser');
        expect(first.user.sessionId).not.toBe(second.user.sessionId);
        expect(first.user.additional.identifiers.browserId).not.toBe(second.user.additional.identifiers.browserId);
        expect(createUser).not.toHaveBeenCalled();
        expect(input.sessionId).toBe('old-session');
        expect(localStorage.length).toBe(0);
        expect(sessionStorage.length).toBe(0);
        expect(ajax.calls.mostRecent().args[0].xhrFields.withCredentials).toBe(false);
    });

    it('preserves explicitly configured credentials while filtering content user data', function () {
        configure({});
        Breinify.setConfig(Object.assign({}, Breinify.config(), {withCredentials: true}));
        Breinify.recommendation({email: 'private@example.test'}, {numRecommendations: 1}, function () {});
        expect(ajax.calls.mostRecent().args[0].xhrFields.withCredentials).toBe(true);
        expect(sent().user.email).toBeUndefined();
        expect(createUser).not.toHaveBeenCalled();

        Breinify.setConfig(Object.assign({}, Breinify.config(), {withCredentials: false}));
        Breinify.recommendation({}, {numRecommendations: 1}, function () {});
        expect(ajax.calls.mostRecent().args[0].xhrFields.withCredentials).toBe(false);
    });

    it('does not send denied activities and settles the callback', function () {
        configure({});
        const callback = jasmine.createSpy('callback');
        Breinify.activity({email: 'private@example.test'}, 'checkOut', null, null, {}, callback);
        expect(ajax).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalled();
        expect(createUser).not.toHaveBeenCalled();
    });

    it('allows Analytics with generated identifiers but excludes supplied profile fields', function () {
        configure({analytics: true});
        Breinify.activity({email: 'private@example.test', userId: 'account'}, 'checkOut', null, null,
            {email: 'tag@example.test', price: 30}, function () {});
        const data = sent();
        expect(data.user.email).toBeUndefined();
        expect(data.user.userId).toBeUndefined();
        expect(data.activity.tags.email).toBeUndefined();
        expect(data.activity.tags.price).toBe(30);
        expect(data.user.sessionId).toBe(user.getSessionId());
        expect(data.user.additional.identifiers.browserId).toBe(user.getBrowserId());
        expect(createUser).not.toHaveBeenCalled();
    });

    it('waits for unknown consent and uses content-only permissions on timeout', function () {
        jasmine.clock().install();
        try {
            consent.configure({timeoutInMs: 20, provider: {evaluate: function () {}}});
            Breinify.recommendation({}, {numRecommendations: 1}, function () {});
            Breinify.activity({}, 'checkOut');
            expect(ajax).not.toHaveBeenCalled();
            jasmine.clock().tick(21);
            expect(ajax.calls.count()).toBe(1);
            expect(sent().activity).toBeUndefined();
        } finally {
            jasmine.clock().uninstall();
        }
    });

    it('applies content overrides before creating a user or sending a request', function () {
        configure({}, {features: {recommendations: {requires: ['analytics']}, modifyContent: {enabled: false}}});
        Breinify.recommendation({}, {numRecommendations: 1}, function () {});
        const callback = jasmine.createSpy('service');
        Breinify.service('discovery', {product: 'sku'}, callback);
        expect(ajax).not.toHaveBeenCalled();
        expect(callback).toHaveBeenCalled();
        expect(createUser).not.toHaveBeenCalled();
    });

    it('strips service payload user overrides and retains content context', function () {
        configure({});
        const payload = {products: ['sku'], user: {email: 'override@example.test', sessionId: 'stored'}};
        Breinify.service('discovery', payload, {userId: 'account'}, function () {});
        const data = sent();
        expect(data.payload.products).toEqual(['sku']);
        expect(data.payload.user.email).toBeUndefined();
        expect(data.payload.user.userId).toBeUndefined();
        expect(data.payload.user.sessionId).not.toBe('stored');
        expect(data.checksum).toEqual(jasmine.any(String));
        expect(payload.user.email).toBe('override@example.test');
    });

    it('strips direct token identities, including nested user data', function () {
        configure({});
        const payload = {browserId: 'stored', splitTestName: 'banner', email: 'private@example.test',
            nested: {user: {email: 'nested@example.test'}}};
        Breinify.UTL.internal.token('content-token', payload, function () {});
        const data = ajax.calls.mostRecent().args[0].data;
        expect(data.browserId).not.toBe('stored');
        expect(data.email).toBeUndefined();
        expect(data.nested.user.email).toBeUndefined();
        expect(data.splitTestName).toBe('banner');
        expect(payload.browserId).toBe('stored');
    });

    it('does not strip explicit preference-management identities', function () {
        configure({});
        Breinify.UTL.internal.token('opt-out', {user: 'person@example.test', optOutGeneral: true},
            function () {}, 1000, consent.features.PREFERENCE_MANAGEMENT);
        expect(ajax.calls.mostRecent().args[0].data.user).toBe('person@example.test');
        expect(createUser).not.toHaveBeenCalled();
    });

    it('blocks existing storage reads, writes, enumeration, and previously obtained handles', function () {
        const handle = storage.getStorage('local');
        handle.setItem('x-breinify-bid', 'old');
        localStorage.setItem('unrelated', 'keep');
        configure({});
        expect(handle.getItem('x-breinify-bid')).toBeNull();
        expect(handle.length).toBe(0);
        expect(handle.key(0)).toBeNull();
        handle.setItem('x-breinify-bid', 'new');
        expect(localStorage.getItem('x-breinify-bid')).toBeNull();
        expect(localStorage.getItem('unrelated')).toBe('keep');
    });

    it('honors storage tightening even when identifiers are otherwise permitted', function () {
        configure({analytics: true, functional: true}, {storage: {requires: ['personalization']}});
        expect(user.getBrowserId()).not.toBe(user.getBrowserId());
        storage.setItem('local', 'br-wed-test', 'state');
        expect(localStorage.getItem('br-wed-test')).toBeNull();
        expect(Breinify.plugins.activities.scheduleDelayedActivity({}, 'checkOut', {}, 1000)).toBeNull();
    });

    it('clears cached identifiers and known persistent data when consent is revoked', function () {
        configure({analytics: true, personalization: true});
        const old = user.getBrowserId();
        expect(localStorage.getItem('x-breinify-bid')).not.toBeNull();
        permissions = {};
        notify(permissions);
        expect(localStorage.getItem('x-breinify-bid')).toBeNull();
        expect(user.getBrowserId()).not.toBe(old);
        expect(user.getBrowserId()).not.toBe(user.getBrowserId());
        expect(user.browserId).toBeNull();
    });

    it('uses fresh provider decisions for synchronous identity reads', function () {
        configure({analytics: true});
        const old = user.getSessionId();
        permissions = {};
        expect(user.getSessionId()).not.toBe(old);
        expect(sessionStorage.getItem('x-breinify-uuid')).toBeNull();
    });

    it('allows presentation storage without enabling identity storage', function () {
        configure({functional: true});
        storage.setItem('local', 'br-wed-test', 'display');
        expect(storage.getItem('local', 'br-wed-test')).toBe('display');
        expect(user.getBrowserId()).not.toBe(user.getBrowserId());
    });

    it('does not schedule delayed activities or send plugin activities when denied', function () {
        configure({});
        expect(Breinify.plugins.activities.scheduleDelayedActivity({}, 'checkOut', {}, 1000)).toBeNull();
        const callback = jasmine.createSpy('callback');
        Breinify.plugins.activities._send('checkOut', {}, {}, callback);
        expect(callback).toHaveBeenCalled();
        expect(ajax).not.toHaveBeenCalled();
        expect(localStorage.length).toBe(0);
    });

    it('exempts developer flags from feature rules, global restrictions and revocation', function () {
        configure({}, {features: {profileStorage: {enabled: false}}, storage: {requires: 'personalization'}});
        ['breinify', 'previewIds'].forEach(function (key) {
            storage.setItem('session', key, 'developer-value');
            expect(storage.getItem('session', key)).toBe('developer-value');
            expect(storage.keys('session')).toContain(key);
        });
        notify({});
        expect(storage.getItem('session', 'previewIds')).toBe('developer-value');
        storage.setItem('session', 'other-developer-key', 'blocked');
        expect(sessionStorage.getItem('other-developer-key')).toBeNull();
    });

    it('blocks and cleans delayed queues when Continuity Storage is disabled', function () {
        configure({analytics: true});
        const id = Breinify.plugins.activities.scheduleDelayedActivity({}, 'checkOut', {}, 60000);
        expect(id).not.toBeNull();
        expect(localStorage.getItem('breinify-sa-data-' + id)).not.toBeNull();
        configure({analytics: true}, {features: {continuityStorage: {enabled: false}}});
        expect(localStorage.getItem('breinify-sa-data-' + id)).toBeNull();
        expect(Breinify.plugins.activities.scheduleDelayedActivity({}, 'checkOut', {}, 60000)).toBeNull();
        storage.setItem('local', 'breinify-sa-data-direct', '{}');
        expect(storage.getItem('local', 'breinify-sa-data-direct')).toBeNull();
        Breinify.UTL.cookie.setJson('x-breinify-delayed', {queued: {}}, null, true);
        expect(Breinify.UTL.cookie.get('x-breinify-delayed')).toBeNull();
        Breinify.plugins.activities._send('checkOut', {}, {});
        expect(ajax).toHaveBeenCalled();
    });

    it('classifies feature keys before plugin registration and cleans only denied purposes', function () {
        const prefix = 'breinify::featureStorage::purpose::';
        const contentKey = prefix + 'contentStorage::feature::catalog';
        const unknownKey = prefix + 'retiredStorage::feature::legacy';
        localStorage.setItem(contentKey, 'shared');
        localStorage.setItem(unknownKey, 'private');
        configure({});
        expect(storage.getItem('local', contentKey)).toBe('shared');
        expect(localStorage.getItem(unknownKey)).toBeNull();
        configure({}, {features: {contentStorage: {enabled: false}}});
        expect(localStorage.getItem(contentKey)).toBeNull();
    });

    it('removes denied identity cookies and refuses to read or recreate them', function () {
        Breinify.UTL.cookie.set('x-breinify-bid', 'old', 1, true);
        configure({});
        expect(Breinify.UTL.cookie.get('x-breinify-bid')).toBeNull();
        Breinify.UTL.cookie.set('x-breinify-bid', 'new', 1, true);
        expect(document.cookie).not.toContain('x-breinify-bid=');
    });

    it('allows temporal content without geolocation or supplied user data', function () {
        configure({});
        const geo = spyOn(navigator.geolocation, 'getCurrentPosition');
        Breinify.temporalData({email: 'private@example.test', additional: {location: {latitude: 1, longitude: 2}}},
            function () {});
        expect(ajax.calls.count()).toBe(1);
        expect(sent().user.additional.location).toBeUndefined();
        expect(geo).not.toHaveBeenCalled();
    });

    it('preserves profile enrichment with Personalization and stable identifiers when permitted', function () {
        configure({analytics: true, personalization: true});
        Breinify.recommendation({additional: {location: {latitude: 1, longitude: 2}}},
            {numRecommendations: 1}, function () {});
        expect(sent().user.email).toBe('private@example.test');
        expect(sent().user.additional.location.latitude).toBe(1);
        expect(sent().user.additional.identifiers.browserId).toBe(user.getBrowserId());
        expect(createUser).toHaveBeenCalled();
    });

    it('stops identified service polling after consent is revoked', function () {
        jasmine.clock().install();
        try {
            configure({analytics: true, personalization: true});
            const callback = jasmine.createSpy('service');
            Breinify.service('discovery', {}, {additional: {location: {latitude: 1, longitude: 2}}}, callback);
            ajax.calls.mostRecent().args[0].success({responseCode: 200,
                payload: {status: 'RUNNING', jobId: 'identified-job', backOffInMs: 10}});
            permissions = {};
            notify(permissions);
            jasmine.clock().tick(300);
            expect(ajax.calls.count()).toBe(1);
            expect(callback.calls.mostRecent().args[0].code).toBe('CONSENT_DENIED');
        } finally {
            jasmine.clock().uninstall();
        }
    });

    it('continues anonymous service polling without optional consent', function () {
        jasmine.clock().install();
        try {
            configure({});
            const callback = jasmine.createSpy('service');
            Breinify.service('discovery', {product: 'sku'}, callback);
            ajax.calls.mostRecent().args[0].success({responseCode: 200,
                payload: {status: 'RUNNING', jobId: 'anonymous-job', backOffInMs: 10}});
            jasmine.clock().tick(300);
            expect(ajax.calls.count()).toBe(2);
            expect(sent().jobId).toBe('anonymous-job');
            expect(sent().payload.user.email).toBeUndefined();
            ajax.calls.mostRecent().args[0].success({responseCode: 200,
                payload: {status: 'SUCCEEDED', response: {content: 'banner'}}});
            expect(callback.calls.mostRecent().args).toEqual([null, null, {content: 'banner'}]);
        } finally {
            jasmine.clock().uninstall();
        }
    });

    it('applies content overrides to assets and tokens', function () {
        configure({}, {features: {modifyContent: {enabled: false}, contentTokens: {enabled: false}}});
        const assetCallback = jasmine.createSpy('asset');
        const tokenCallback = jasmine.createSpy('token');
        Breinify.plugins.assets.textResource('frame', assetCallback);
        Breinify.UTL.internal.token('token', {}, tokenCallback);
        expect(assetCallback.calls.mostRecent().args[0].code).toBe('CONSENT_DENIED');
        expect(tokenCallback.calls.mostRecent().args[0].code).toBe('CONSENT_DENIED');
        expect(ajax).not.toHaveBeenCalled();
    });

    it('rechecks consent after an asynchronous browser geolocation permission query', function () {
        configure({analytics: true, personalization: true});
        let resolvePermission;
        spyOn(navigator.permissions, 'query').and.returnValue({then: function (callback) {
            resolvePermission = callback;
            return {catch: function () {}};
        }});
        const geo = spyOn(navigator.geolocation, 'getCurrentPosition');
        Breinify.recommendation({}, {numRecommendations: 1}, function () {});
        expect(ajax).not.toHaveBeenCalled();
        permissions = {};
        notify(permissions);
        resolvePermission({state: 'granted'});
        expect(geo).not.toHaveBeenCalled();
        expect(ajax.calls.count()).toBe(1);
        expect(sent().user.email).toBeUndefined();
        expect(sent().user.additional.location).toBeUndefined();
    });

    it('does not send a delayed activity after storage is denied while its filter is pending', function () {
        configure({analytics: true, personalization: true}, {storage: {requires: 'personalization'}});
        let continueFilter;
        window.consentTestFilter = function (id, data, callback) { continueFilter = callback; };
        const data = {type: 'checkOut', tags: {}, user: {}, filter: 'consentTestFilter',
            timestamp: Date.now(), maxAgeInMs: 10000};
        try {
            Breinify.plugins.activities._checkDelayedActivityData('test', data);
            permissions = {analytics: true};
            notify(permissions);
            continueFilter('test', data, true, true);
            expect(ajax).not.toHaveBeenCalled();
        } finally {
            delete window.consentTestFilter;
        }
    });


    it('blocks mapped resource refresh without requiring a callback', function () {
        configure({}, {features: {modifyContent: {enabled: false}}});
        const errors = spyOn(console, 'error');
        const element = Breinify.UTL._jquery()('<div></div>');
        element.data('br-mapped-resource-data', {mapId: 'map', type: 'html'});
        Breinify.plugins.assets.refreshMapResource(element, {});
        expect(ajax).not.toHaveBeenCalled();
        expect(errors).not.toHaveBeenCalled();
    });

    it('filters identity overrides from mapped resource URLs', function () {
        configure({});
        const element = Breinify.UTL._jquery()('<div></div>');
        element.data('br-mapped-resource-data', {mapId: 'map', type: 'html'});
        Breinify.plugins.assets.refreshMapResource(element, {email: 'private@example.test',
            sessionId: 'stored', user: {email: 'nested@example.test'}, product: 'sku'});
        const url = ajax.calls.mostRecent().args[0].url;
        const encoded = url.split('/J/')[1].replaceAll('~', '+').replaceAll('-', '/').replaceAll('_', '=');
        const payload = JSON.parse(atob(encoded));
        expect(payload.email).toBeUndefined();
        expect(payload.user.email).toBeUndefined();
        expect(payload.sessionId).not.toBe('stored');
        expect(payload.product).toBe('sku');
        expect(createUser).not.toHaveBeenCalled();
    });


    it('preserves pre-existing public content through initial denial and optional-consent revocation', function () {
        const key = 'breinify-content-products';
        localStorage.setItem(key, JSON.stringify({items: ['sku']}));
        configure({});
        expect(storage.getJson('local', key)).toEqual({items: ['sku']});
        storage.setJson('local', key, {items: ['updated']});
        expect(consent.getDecision(consent.features.CONTENT_STORAGE).userData)
            .toEqual({identifiers: false, profile: false});
        permissions = {analytics: true, personalization: true};
        notify(permissions);
        permissions = {};
        notify(permissions);
        expect(storage.getJson('local', key)).toEqual({items: ['updated']});
        expect(storage.getJson('local', 'unclassified')).toBeNull();
    });

    it('allows declared content storage while optional consent is unknown and after timeout', function () {
        jasmine.clock().install();
        try {
            consent.configure({timeoutInMs: 20, provider: {evaluate: function () {}}});
            storage.setJson('session', 'breinify-content-products', ['sku']);
            storage.setItem('local', 'unclassified', 'private');
            expect(storage.getJson('session', 'breinify-content-products')).toEqual(['sku']);
            expect(localStorage.getItem('unclassified')).toBeNull();
            jasmine.clock().tick(21);
            expect(storage.getJson('session', 'breinify-content-products')).toEqual(['sku']);
        } finally {
            jasmine.clock().uninstall();
        }
    });

    it('honors global storage restrictions and content-storage overrides for public data', function () {
        const key = 'breinify-content-products';
        configure({}, {storage: {requires: 'personalization'}});
        storage.setItem('local', key, 'blocked');
        expect(localStorage.getItem(key)).toBeNull();
        permissions = {analytics: true, personalization: true};
        notify(permissions);
        storage.setItem('local', key, 'allowed');
        expect(storage.getItem('local', key)).toBe('allowed');
        permissions = {};
        notify(permissions);
        expect(localStorage.getItem(key)).toBeNull();
        configure({analytics: true, personalization: true}, {features: {contentStorage: {enabled: false}}});
        storage.setItem('session', key, 'blocked');
        expect(sessionStorage.getItem(key)).toBeNull();
        configure({}, {features: {contentStorage: {requires: 'functional'}}});
        expect(storage.isAllowed(key)).toBe(false);
        permissions = {functional: true};
        notify(permissions);
        expect(storage.isAllowed(key)).toBe(true);
    });

    it('allows explicitly registered public content without changing unclassified storage', function () {
        configure({});
        storage.register('test-public-catalog', consent.features.CONTENT_STORAGE);
        storage.setJson('local', 'test-public-catalog', {items: ['sku']});
        storage.setJson('local', 'test-unclassified-catalog', {items: ['sku']});
        expect(storage.getJson('local', 'test-public-catalog')).toEqual({items: ['sku']});
        expect(localStorage.getItem('test-unclassified-catalog')).toBeNull();
    });

});
