"use strict";

describe('FeatureStorage inspection', function () {
    var storage;
    var name;
    var sequence = 0;

    beforeEach(function () {
        storage = Breinify.plugins.featureStorage;
        sequence += 1;
        name = 'feature-storage-inspection-spec-' + sequence;
    });

    afterEach(function () {
        storage.remove(name);
        storage.removeFeatureDefinition(name);
        storage.flush();
    });

    function findFeature() {
        return storage.inspect().features.filter(function (feature) { return feature.name === name; })[0];
    }

    it('includes definitions waiting for a value without recording an observation', function () {
        storage.defineFeature(name, {valueType: 'BOOLEAN', persistence: {enabled: false}});
        var feature = findFeature();
        expect(storage.getFeatureNames()).toContain(name);
        expect(feature.hasValue).toBe(false);
        expect(feature.definition.valueType).toBe('BOOLEAN');
        expect(feature.observation).toBe(null);
        expect(feature.persistence.state).toBe('disabled');
    });

    it('retains managed labels and source through inspection, persistence and inline TTL overrides', function () {
        storage.defineFeature(name, {
            name: 'Current page product ID', description: 'The product shown on this page.', source: 'scriptCreator',
            valueType: 'STRING', persistence: {enabled: true, ttlInMs: 60000}
        });
        storage.set(name, '12345', {persistence: {ttlInMs: 120000}});
        var feature = findFeature();
        expect(feature.name).toBe(name);
        expect(feature.definition.name).toBe('Current page product ID');
        expect(feature.definition.description).toBe('The product shown on this page.');
        expect(feature.definition.source).toBe('scriptCreator');
        var key = 'breinify::featureStorage::feature::' + name;
        var persisted = JSON.parse(window.localStorage.getItem(key));
        expect(persisted.definition.name).toBe(feature.definition.name);
        expect(persisted.definition.source).toBe('scriptCreator');
    });

    it('preserves false, zero, empty string and null as current values', function () {
        storage.defineFeature(name, {persistence: {enabled: false}});
        [false, 0, '', null].forEach(function (value) {
            storage.set(name, value);
            var feature = findFeature();
            expect(feature.hasValue).toBe(true);
            expect(feature.value).toBe(value);
        });
    });

    it('reports expired persisted data without renewing or deleting it or clearing the memory value', function () {
        storage.defineFeature(name, {persistence: {enabled: true, ttlInMs: 60000}});
        storage.set(name, 'current value');
        storage.flush();
        var key = 'breinify::featureStorage::feature::' + name;
        var entry = JSON.parse(window.localStorage.getItem(key));
        entry.expiresAt = Date.now() - 1000;
        var raw = JSON.stringify(entry);
        window.localStorage.setItem(key, raw);
        var observation = storage.observation(name);

        var feature = findFeature();

        expect(feature.persistence.state).toBe('expired');
        expect(feature.persistence.expiresAt).toBe(entry.expiresAt);
        expect(feature.value).toBe('current value');
        expect(window.localStorage.getItem(key)).toBe(raw);
        expect(storage.observation(name)).toEqual(observation);
    });
});

describe('FeatureStorage consumer resolution', function () {
    var storage;
    var names;
    var resolvers;
    var url;
    var sequence = 0;

    beforeEach(function () {
        storage = Breinify.plugins.featureStorage;
        sequence++;
        names = ['resolution-sku-' + sequence, 'resolution-category-' + sequence];
        resolvers = [];
        url = window.location.href;
        storage.flush();
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date());
        names.forEach(function (name) {
            storage.defineFeature(name, {valueType: 'STRING', persistence: {enabled: false}});
        });
    });

    afterEach(function () {
        resolvers.forEach(function (resolver) { resolver.dispose(); });
        names.forEach(function (name) {
            storage.remove(name);
            storage.removeFeatureDefinition(name);
        });
        storage.flush();
        window.history.replaceState({}, '', url);
        jasmine.clock().uninstall();
    });

    function navigate(suffix) {
        window.history.replaceState({}, '', '#feature-resolution-' + sequence + '-' + suffix);
    }

    function create(requests) {
        var resolver = storage.createResolver(requests);
        resolvers.push(resolver);
        return resolver;
    }

    function pageRequest(index, overrides) {
        return {key: String(index), feature: names[index], resolution: Object.assign({
            source: 'PAGE', waitTimeoutInMs: 3000, onTimeout: 'USE_STORED'
        }, overrides)};
    }

    it('waits for both fresh values without hiding the retained values from immediate readers', function () {
        storage.set(names[0], 'A');
        storage.set(names[1], 'old category');
        storage.flush();
        navigate('next');
        var resolver = create([pageRequest(0), pageRequest(1)]);
        expect(resolver.snapshot().status).toBe('PENDING');
        expect(storage.get(names[0])).toBe('A');
        storage.set(names[0], 'B');
        storage.flush();
        expect(resolver.snapshot().status).toBe('PENDING');
        storage.set(names[0], 'C');
        storage.set(names[1], 'new category');
        storage.flush();
        expect(resolver.snapshot().status).toBe('READY');
        expect(resolver.snapshot().values).toEqual({'0': 'C', '1': 'new category'});
    });

    it('accepts unchanged observations on this visit and observations predating registration', function () {
        storage.set(names[0], 'A');
        storage.flush();
        navigate('next');
        var resolver = create([pageRequest(0)]);
        expect(resolver.snapshot().status).toBe('PENDING');
        storage.set(names[0], 'A');
        storage.flush();
        expect(resolver.snapshot().entries['0']).toEqual({
            feature: names[0], value: 'A', status: 'READY', source: 'PAGE'
        });
        expect(create([pageRequest(0)]).snapshot().status).toBe('READY');
    });

    it('uses stored values only at the deadline and observes later changes', function () {
        storage.set(names[0], 'A');
        storage.flush();
        navigate('next');
        var resolver = create([pageRequest(0)]);
        var listener = jasmine.createSpy('resolved');
        resolver.subscribe(listener);
        jasmine.clock().tick(2999);
        expect(resolver.snapshot().status).toBe('PENDING');
        jasmine.clock().tick(1);
        expect(resolver.snapshot().entries['0'].source).toBe('STORED');
        expect(resolver.snapshot().values['0']).toBe('A');
        storage.set(names[0], 'B');
        storage.flush();
        expect(resolver.snapshot().entries['0'].source).toBe('PAGE');
        expect(resolver.snapshot().values['0']).toBe('B');
        expect(listener.calls.count()).toBe(2);
    });

    it('settles explicit null and removal without resurrecting a previous SKU', function () {
        storage.set(names[0], 'A');
        storage.flush();
        navigate('next');
        var resolver = create([pageRequest(0)]);
        storage.set(names[0], null);
        storage.flush();
        expect(resolver.snapshot().status).toBe('UNAVAILABLE');
        expect(resolver.snapshot().entries['0'].source).toBe('PAGE');
        jasmine.clock().tick(3000);
        expect(resolver.snapshot().values['0']).toBeNull();
        storage.set(names[0], 'B');
        storage.remove(names[0]);
        storage.flush();
        expect(resolver.snapshot().values['0']).toBeNull();
    });

    it('supports unavailable and zero-timeout fallbacks and independent policies for one feature', function () {
        storage.set(names[0], 'A');
        storage.flush();
        navigate('next');
        var immediate = pageRequest(0, {waitTimeoutInMs: 0});
        var unavailable = pageRequest(0, {waitTimeoutInMs: 0, onTimeout: 'UNAVAILABLE'});
        unavailable.key = 'unavailable';
        var snapshot = create([immediate, unavailable]).snapshot();
        expect(snapshot.status).toBe('UNAVAILABLE');
        expect(snapshot.values['0']).toBe('A');
        expect(snapshot.values.unavailable).toBeNull();
        expect(storage.get(names[0])).toBe('A');
    });

    it('cancels old-visit waits and starts a new deadline', async function () {
        var resolver = create([pageRequest(0)]);
        var pending = resolver.ready();
        var oldPageId = resolver.snapshot().pageId;
        jasmine.clock().tick(2000);
        navigate('next');
        expect(resolver.snapshot().pageId).not.toBe(oldPageId);
        expect((await pending).status).toBe('CANCELLED');
        jasmine.clock().tick(1000);
        expect(resolver.snapshot().status).toBe('PENDING');
        jasmine.clock().tick(2000);
        expect(resolver.snapshot().status).toBe('UNAVAILABLE');
    });

    it('disposes pending waits and subscriptions without clearing the stored feature', async function () {
        storage.set(names[0], 'A');
        storage.flush();
        navigate('next');
        var resolver = create([pageRequest(0)]);
        var pending = resolver.ready();
        var listener = jasmine.createSpy('resolved');
        resolver.subscribe(listener);
        resolver.dispose();
        expect((await pending).status).toBe('CANCELLED');
        jasmine.clock().tick(3000);
        storage.set(names[0], 'B');
        storage.flush();
        expect(listener).not.toHaveBeenCalled();
        expect(storage.get(names[0])).toBe('B');
    });

    it('keeps immediate reads and falsy typed values intact', function () {
        storage.defineFeature(names[0], {persistence: {enabled: false}});
        [false, 0, '', []].forEach(function (value) {
            storage.set(names[0], value);
            var resolver = create([{feature: names[0]}]);
            expect(resolver.snapshot().status).toBe('READY');
            expect(resolver.snapshot().values[names[0]]).toEqual(value);
        });
    });

    it('rejects invalid configuration instead of silently using a stored value', function () {
        [
            {source: 'CHANGE'}, {waitTimeoutInMs: -1}, {waitTimeoutInMs: 0.5},
            {waitTimeoutInMs: '3000'}, {waitTimeoutInMs: Infinity}, {waitTimeoutInMs: 2147483648},
            {onTimeout: 'USE_CURRENT'}, {onTimeout: 'SKIP'}
        ].forEach(function (settings) {
            expect(function () { create([pageRequest(0, settings)]); }).toThrowError(TypeError);
        });
        expect(function () { create([pageRequest(0), pageRequest(0)]); }).toThrowError(TypeError);
    });
});
