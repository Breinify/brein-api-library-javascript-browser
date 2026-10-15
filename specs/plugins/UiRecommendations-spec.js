"use strict";

describe('UiRecommendations feature resolution', function () {
    var $;
    var storage;
    var ui;
    var webExId;
    var sku;
    var category;
    var mappings;
    var bindings;
    var config;
    var api;
    var url;
    var root;
    var options;
    var sequence = 0;

    beforeEach(function () {
        $ = Breinify.UTL._jquery();
        storage = Breinify.plugins.featureStorage;
        ui = Breinify.plugins.uiRecommendations;
        sequence++;
        webExId = 'ui-resolution-' + sequence;
        sku = webExId + '-sku';
        category = webExId + '-category';
        url = window.location.href;
        api = Breinify.plugins.api;
        options = [];
        root = $('<div>').appendTo('body');
        storage.flush();
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date());
        [sku, category].forEach(function (name) {
            storage.defineFeature(name, {valueType: 'STRING', persistence: {enabled: false}});
        });
        mappings = [
            {type: 'forItems', feature: sku,
                resolution: {source: 'PAGE', waitTimeoutInMs: 3000, onTimeout: 'USE_STORED'}},
            {type: 'parameter', feature: category, payloadKey: 'productCategory',
                resolution: {source: 'PAGE', waitTimeoutInMs: 3000, onTimeout: 'USE_STORED'}}
        ];
        bindings = {};
        bindings[webExId] = {webExpPos: {_fallback: {mappings: mappings}}};
        Breinify.plugins.api = {getModule: function (name) {
            return name === 'uiRecommendationsConfig' ? {getFeatureBindings: function () { return bindings; }} : null;
        }};
        spyOn(Breinify.plugins.webExperiences, 'hasAttributeActivation').and.returnValue(false);
        spyOn(Breinify.plugins.recommendations, 'render').and.callFake(function (batch) {
            options.push(batch);
            return 'resolution-process-' + options.length;
        });
        spyOn(Breinify.plugins.recommendations, 'refresh');
        spyOn(Breinify.plugins.recommendations, 'cancel');
        config = {type: 'onLoad', recommendations: [{
            recommender: {preconfiguredRecommendation: 'PDP'},
            position: {positionId: 'pdp', operation: 'append', selector: 'body'}
        }]};
        ui.register({}, webExId, 'version', config);
    });

    afterEach(function () {
        ui.unregister(webExId);
        [sku, category].forEach(function (name) {
            storage.remove(name);
            storage.removeFeatureDefinition(name);
        });
        storage.flush();
        root.remove();
        window.history.replaceState({}, '', url);
        Breinify.plugins.api = api;
        jasmine.clock().uninstall();
    });

    async function drain() {
        // allow the public handle method and its async payload/extension pipeline to finish
        for (var i = 0; i < 30; i++) await Promise.resolve();
    }

    function previousPage() {
        storage.set(sku, 'A');
        storage.set(category, 'old category');
        storage.flush();
        window.history.replaceState({}, '', '#ui-resolution-next-' + sequence);
    }

    function finish() {
        options[options.length - 1].forEach(function (option) {
            var identity = option.meta.renderIdentity;
            var container = $('<div>').attr({
                'data-br-rec-webexpid': identity.webExId,
                'data-br-rec-positionid': identity.positionId,
                'data-br-rec-name': identity.recommenderName
            }).appendTo(root);
            option.process.finalize(option, {status: {code: 200}}, container);
        });
    }

    it('waits for SKU and category, sends one initial request and refreshes changed inputs only', async function () {
        previousPage();
        ui.handle(webExId, 'version', config);
        await drain();
        expect(options.length).toBe(0);
        storage.set(sku, 'B');
        storage.flush();
        await drain();
        expect(options.length).toBe(0);
        storage.set(category, 'new category');
        storage.flush();
        await drain();
        expect(options.length).toBe(1);
        var payload = options[0][0].recommender.payload;
        expect(payload.recommendationForItems).toEqual(['B']);
        expect(payload.recommendationAdditionalParameters.additionalOtherParameters.productCategory)
            .toBe('new category');
        finish();
        await drain();
        expect(Breinify.plugins.recommendations.refresh).not.toHaveBeenCalled();
        storage.set(sku, 'C');
        storage.flush();
        expect(Breinify.plugins.recommendations.refresh.calls.count()).toBe(1);
        expect(Breinify.plugins.recommendations.refresh.calls.mostRecent().args[0].payload.recommendationForItems)
            .toEqual(['C']);
    });

    it('uses stored inputs at timeout without refreshing for a later observation of the same values', async function () {
        previousPage();
        ui.handle(webExId, 'version', config);
        await drain();
        jasmine.clock().tick(3000);
        await drain();
        expect(options.length).toBe(1);
        expect(options[0][0].recommender.payload.recommendationForItems).toEqual(['A']);
        finish();
        await drain();
        storage.set(sku, 'A');
        storage.set(category, 'old category');
        storage.flush();
        expect(Breinify.plugins.recommendations.refresh).not.toHaveBeenCalled();
        storage.set(sku, 'B');
        storage.flush();
        expect(Breinify.plugins.recommendations.refresh.calls.count()).toBe(1);
    });

    it('rechecks a changed feature after the initial response finishes rendering', async function () {
        storage.set(sku, 'A');
        storage.set(category, 'category');
        ui.handle(webExId, 'version', config);
        await drain();
        expect(options.length).toBe(1);
        storage.set(sku, 'B');
        storage.flush();
        expect(Breinify.plugins.recommendations.refresh).not.toHaveBeenCalled();
        finish();
        await drain();
        expect(Breinify.plugins.recommendations.refresh.calls.count()).toBe(1);
        expect(Breinify.plugins.recommendations.refresh.calls.mostRecent().args[0].payload.recommendationForItems)
            .toEqual(['B']);
    });

    it('coalesces overlapping initial handlers waiting for the same features', async function () {
        previousPage();
        ui.handle(webExId, 'version', config);
        ui.handle(webExId, 'version', config);
        await drain();
        storage.set(sku, 'B');
        storage.set(category, 'category');
        storage.flush();
        await drain();
        expect(options.length).toBe(1);
        finish();
        await drain();
        expect(Breinify.plugins.recommendations.refresh).not.toHaveBeenCalled();
    });

    it('targets legacy refreshes without bypassing a waiting position in a mixed experience', async function () {
        previousPage();
        bindings[webExId].webExpPos.legacy = {mappings: [
            {type: 'parameter', feature: category, payloadKey: 'productCategory'}
        ]};
        ['legacy', 'pdp'].forEach(function (position) {
            $('<div>').attr({
                'data-br-rec-webexpid': webExId,
                'data-br-rec-positionid': position,
                'data-br-rec-name': 'PDP'
            }).appendTo(root);
        });
        ui.handle(webExId, 'version', config);
        await drain();
        storage.set(category, 'new category');
        storage.flush();
        await drain();
        expect(options.length).toBe(0);
        expect(Breinify.plugins.recommendations.refresh.calls.count()).toBe(1);
        expect(Breinify.plugins.recommendations.refresh.calls.mostRecent().args[0].renderIdentity)
            .toEqual({webExId: webExId, positionId: 'legacy', exactPosition: true, recommenderName: 'PDP'});
    });

    it('cancels a previous-page wait instead of rendering it with the next page values', async function () {
        previousPage();
        ui.handle(webExId, 'version', config);
        await drain();
        window.history.replaceState({}, '', '#ui-resolution-another-' + sequence);
        storage.set(sku, 'B');
        storage.set(category, 'category');
        storage.flush();
        await drain();
        expect(options.length).toBe(0);
        ui.handle(webExId, 'version', config);
        await drain();
        expect(options.length).toBe(1);
        expect(options[0][0].recommender.payload.recommendationForItems).toEqual(['B']);
        finish();
        await drain();
    });

    it('cancels an initial render process when navigation occurs before its response', async function () {
        storage.set(sku, 'A');
        storage.set(category, 'category');
        ui.handle(webExId, 'version', config);
        await drain();
        expect(options.length).toBe(1);
        window.history.replaceState({}, '', '#ui-resolution-cancel-' + sequence);
        storage.flush();
        expect(Breinify.plugins.recommendations.cancel).toHaveBeenCalledWith('resolution-process-1');
        await drain();
    });

    it('clears a mapped SKU on an explicit unavailable observation', async function () {
        previousPage();
        ui.handle(webExId, 'version', config);
        await drain();
        storage.set(sku, null);
        storage.set(category, 'category');
        storage.flush();
        await drain();
        expect(options.length).toBe(1);
        expect(options[0][0].recommender.payload.recommendationForItems).toBeNull();
        finish();
        await drain();
    });

    it('keeps unconfigured bindings immediate and disposes pending configured consumers', async function () {
        previousPage();
        mappings.forEach(function (mapping) { delete mapping.resolution; });
        ui.handle(webExId, 'version', config);
        await drain();
        expect(options.length).toBe(1);
        expect(options[0][0].recommender.payload.recommendationForItems).toEqual(['A']);
        ui.unregister(webExId);
        mappings[0].resolution = {source: 'PAGE', waitTimeoutInMs: 3000, onTimeout: 'USE_STORED'};
        ui.register({}, webExId, 'version', config);
        ui.handle(webExId, 'version', config);
        await drain();
        ui.unregister(webExId);
        jasmine.clock().tick(3000);
        await drain();
        expect(options.length).toBe(1);
    });
});
