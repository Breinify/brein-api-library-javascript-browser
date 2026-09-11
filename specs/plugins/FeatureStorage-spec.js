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
