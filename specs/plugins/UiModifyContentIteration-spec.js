"use strict";

describe('UiModifyContent optional iteration', function () {
    const plugin = Breinify.plugins.uiModifyContent;
    let fixture, runtime, module, requests, originalService, originalStorage, originalActivities, observation;
    let sequence = 0;
    let id;

    beforeEach(function () {
        id = 'iteration-spec-' + (++sequence);
        fixture = document.createElement('div');
        fixture.id = id;
        fixture.innerHTML = '<div class="row" data-item="A"><span class="target"></span></div>' +
            '<div class="row" data-item="B"><span class="target"></span></div><span class="target outside"></span>';
        document.body.appendChild(fixture);
        originalService = Breinify.service;
        originalStorage = Breinify.plugins.featureStorage;
        originalActivities = Breinify.plugins.activities;
        Breinify.plugins.activities = {generic: function () {}};
        requests = [];
        Breinify.service = function (service, payload, callback) {
            requests.push({payload: payload, callback: callback});
        };
        module = {};
        spyOn(console, 'error');
        spyOn(console, 'log');
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date());
    });

    afterEach(function () {
        plugin.register({}, id, 'v', {actions: {}});
        fixture.remove();
        Breinify.service = originalService;
        Breinify.plugins.featureStorage = originalStorage;
        Breinify.plugins.activities = originalActivities;
        jasmine.clock().uninstall();
    });

    function action(content) {
        return {type: 'changeContent', enabled: true, settings: {
            selector: '.target', operation: 'append', content: content, maxApplications: 1, allowHtml: false
        }};
    }

    function configure(iteration, backend, defaults, content) {
        const config = {actions: {_default: [action(content || '%%iteration.value%%')]}, conditionsGroups: []};
        if (iteration !== undefined) config.iteration = iteration;
        if (iteration == null) config.actions._default[0].settings.selector = '#' + id + ' .target';
        if (defaults) config.actionDefaults = defaults;
        if (backend) {
            const condition = {type: 'decision', settings: {refId: 'metric', input: {source: 'ITERATION'}}};
            config.conditionsGroups = [{actionGroup: 'matched', conditions: [condition]}];
            config.actions = {matched: [action('%%condition.dataFeedMetric.metricValue | number:0%%')], _default: []};
            config.decision = {required: true, configurationId: id, conditions: [condition]};
        }
        runtime = plugin.register(module, id, 'v', config);
        plugin.handle(id, 'v', {type: 'full-scan'});
        jasmine.clock().tick(1);
    }

    function selector() {
        return {type: 'SELECTOR', selector: '#' + id + ' .row',
            extract: {type: 'ATTRIBUTE', attribute: 'data-item'}};
    }

    function respond(index, reverse, omitRequestId) {
        const request = requests[index];
        const decisions = request.payload.webExperiences.map(function (entry) {
            const value = entry.conditionInputs.metric === 'A' ? 21 : 37;
            const result = {configurationId: id, matched: true, conditions: [{
                refId: 'metric', matched: true, cache: {scope: 'PAGE', maxAgeSeconds: 0},
                bindings: {dataFeedMetric: {metricValue: value}}
            }]};
            if (!omitRequestId) result.requestId = entry.requestId;
            return result;
        });
        if (reverse) decisions.reverse();
        request.callback(null, null, {decisions: decisions});
        jasmine.clock().tick(51);
    }

    it('batches multiple items and correlates reversed replies without leaking counts or targets', function () {
        configure(selector(), true);
        expect(requests.length).toBe(1);
        const entries = requests[0].payload.webExperiences;
        expect(entries.length).toBe(2);
        expect(entries[0].requestId).not.toBe(entries[1].requestId);
        expect(entries[0].conditionInputs.metric).toBe('A');
        expect(entries[1].conditionInputs.metric).toBe('B');
        respond(0, true);
        expect(fixture.querySelectorAll('.row .target')[0].textContent).toBe('21');
        expect(fixture.querySelectorAll('.row .target')[1].textContent).toBe('37');
        expect(fixture.querySelector('.outside').textContent).toBe('');
        plugin.handle(id, 'v', {});
        expect(fixture.querySelectorAll('.row .target')[0].textContent).toBe('21');
        expect(requests.length).toBe(1);
    });

    it('fails closed rather than guessing which item an uncorrelated response belongs to', function () {
        configure(selector(), true);
        respond(0, false, true);
        expect(fixture.textContent).toBe('');
    });

    it('selects a branch independently for each item without carrying over another item\'s bindings', function () {
        configure(selector(), true);
        runtime.config.actions._default = [action('fallback %%iteration.value%%')];
        const decisions = requests[0].payload.webExperiences.map(function (entry) {
            const matched = entry.conditionInputs.metric === 'B';
            return {configurationId: id, requestId: entry.requestId, matched: true, conditions: [{
                refId: 'metric', matched: matched, cache: {scope: 'PAGE', maxAgeSeconds: 0},
                bindings: matched ? {dataFeedMetric: {metricValue: 37}} : {}
            }]};
        });
        requests[0].callback(null, null, {decisions: decisions});
        jasmine.clock().tick(51);
        expect(fixture.querySelectorAll('.row .target')[0].textContent).toBe('fallback A');
        expect(fixture.querySelectorAll('.row .target')[1].textContent).toBe('37');
    });

    it('does not iterate before page activation and performs no global fallback for an empty selection', function () {
        module.isValidPage = function () { return false; };
        configure(selector(), true);
        expect(requests.length).toBe(0);
        expect(runtime.iterationState).toBeUndefined();
        module.isValidPage = function () { return true; };
        fixture.querySelectorAll('.row').forEach(function (row) { row.remove(); });
        plugin.handle(id, 'v', {});
        jasmine.clock().tick(1);
        expect(requests.length).toBe(0);
        expect(runtime.iterationState.children.size).toBe(0);
        expect(fixture.textContent).toBe('');
    });

    it('ignores a removed row and starts a new runtime when the same DOM row changes entity', function () {
        configure(selector(), true);
        fixture.querySelectorAll('.row')[1].remove();
        fixture.querySelector('.row').setAttribute('data-item', 'C');
        respond(0);
        expect(fixture.textContent).toBe('');
        expect(requests.length).toBe(2);
        expect(requests[1].payload.webExperiences.length).toBe(1);
        expect(requests[1].payload.webExperiences[0].conditionInputs.metric).toBe('C');
        respond(1);
        expect(fixture.querySelector('.target').textContent).toBe('37');
    });

    it('skips missing extraction values without running fallback actions for that item', function () {
        fixture.querySelector('.row').setAttribute('data-item', '   ');
        configure(selector(), false);
        expect(runtime.iterationState.children.size).toBe(1);
        expect(fixture.querySelectorAll('.row .target')[0].textContent).toBe('');
        expect(fixture.querySelectorAll('.row .target')[1].textContent).toBe('B');
    });

    it('allows DOM-only iteration without inventing a value placeholder', function () {
        configure({type: 'SELECTOR', selector: '#' + id + ' .row'}, false, null, 'row');
        const children = Array.from(runtime.iterationState.children.values());
        expect(children[0].iteration.value).toBeUndefined();
        expect(children[0].iteration.$el[0]).toBe(fixture.querySelector('.row'));
        expect(children[0].iterationValues.$el).toBeUndefined();
        expect(fixture.querySelectorAll('.row .target')[0].textContent).toBe('row');
        expect(fixture.querySelectorAll('.row .target')[1].textContent).toBe('row');
    });

    it('rejects an oversized selection without partially executing the cart', function () {
        const row = fixture.querySelector('.row');
        for (let index = 0; index < 99; index++) fixture.appendChild(row.cloneNode(true));
        configure(selector(), false);
        expect(fixture.textContent).toBe('');
        expect(runtime.iterationState.children.size).toBe(0);
        expect(console.error).toHaveBeenCalled();
    });

    it('runs registered extraction functions without eval and skips only the item that throws', function () {
        module.webExperienceSnippets = {'web-experience:extract': {type: 'javascript', value: function ($el) {
            if ($el.attr('data-item') === 'A') throw new Error('broken extraction');
            return $el.attr('data-item');
        }}};
        const config = selector();
        config.extract = {type: 'JAVASCRIPT', snippetId: 'web-experience:extract'};
        configure(config, false);
        expect(runtime.iterationState.children.size).toBe(1);
        expect(fixture.querySelectorAll('.row .target')[1].textContent).toBe('B');
        expect(console.error).toHaveBeenCalled();
    });

    it('preserves original feature entries and keeps unchanged items stable across reordering', function () {
        let values = [{id: 'A'}, {id: 'B'}];
        let disposed = false;
        Breinify.plugins.featureStorage = {
            get: function () { return values; },
            getPageId: function () { return 'page'; },
            onFeatureObservation: function (names, listener) {
                observation = listener;
                return function () { disposed = true; };
            }
        };
        module.webExperienceSnippets = {'web-experience:feature-extract': {
            type: 'javascript', value: function (value) {
                expect(Object.isFrozen(value)).toBe(true);
                return value.id;
            }
        }};
        configure({type: 'FEATURE', featureId: 'feature', extract: {
            type: 'JAVASCRIPT', snippetId: 'web-experience:feature-extract'
        }}, true);
        const child = Array.from(runtime.iterationState.children.values())[0];
        expect(child.iteration.value).toBe('A');
        expect(child.iteration.originalValue.id).toBe('A');
        expect(child.iteration.featureId).toBe('feature');
        expect(child.iteration.$el).toBeUndefined();
        values = [values[1], values[0]];
        observation();
        expect(Array.from(runtime.iterationState.children.values()).indexOf(child)).not.toBe(-1);
        values = [];
        observation();
        expect(runtime.iterationState.children.size).toBe(0);
        expect(child.disposed).toBe(true);
        plugin.register({}, id, 'v', {actions: {}});
        expect(disposed).toBe(true);
    });

    it('admits siblings together but suppresses newly added rows during the experience cooldown', function () {
        configure(selector(), false, {_suppression: {durationInSec: 60}});
        expect(fixture.querySelectorAll('.row .target')[0].textContent).toBe('A');
        expect(fixture.querySelectorAll('.row .target')[1].textContent).toBe('B');
        const row = fixture.querySelector('.row').cloneNode(true);
        row.setAttribute('data-item', 'C');
        row.querySelector('.target').textContent = '';
        fixture.appendChild(row);
        plugin.handle(id, 'v', {});
        expect(row.textContent).toBe('');
        expect(runtime.iterationState.children.size).toBe(2);
    });

    it('coalesces DOM observation using the existing optional trigger contract', function () {
        configure(selector(), false);
        const row = fixture.querySelector('.row').cloneNode(true);
        row.setAttribute('data-item', 'C');
        row.querySelector('.target').textContent = '';
        fixture.appendChild(row);
        module.findRequirements(Breinify.UTL._jquery()(row), {type: 'added-element'});
        module.findRequirements(Breinify.UTL._jquery()(row), {type: 'text-change'});
        expect(module.triggerSettings().observeTextChanges).toBe(true);
        jasmine.clock().tick(51);
        expect(row.textContent).toBe('C');
    });

    it('retains the ordinary single-runtime path when iteration is absent', function () {
        configure(undefined, false, null, 'ordinary');
        expect(runtime.iterationState).toBeUndefined();
        expect(fixture.textContent).toBe('ordinary');
    });

    it('also treats an explicit null iteration as the ordinary flow', function () {
        configure(null, false, null, 'ordinary');
        expect(runtime.iterationState).toBeUndefined();
        expect(fixture.textContent).toBe('ordinary');
    });

    it('runs ordinary actions with empty iteration without changing the supplied configuration', function () {
        const ordinary = action('ordinary');
        ordinary.settings.selector = '#' + id + ' .target';
        const config = {iteration: {}, actions: {_default: [ordinary]}};
        Object.freeze(config);
        runtime = plugin.register(module, id, 'v', config);
        const eligible = module.findRequirements(Breinify.UTL._jquery()(fixture), {type: 'full-scan'});
        expect(eligible).toBe(true);
        plugin.handle(id, 'v', {type: 'full-scan'});
        plugin.handle(id, 'v', {type: 'full-scan'});
        expect(fixture.textContent).toBe('ordinary');
        expect(runtime.iterationState).toBeUndefined();
        expect(config.iteration).toEqual({});
        expect(console.error).not.toHaveBeenCalled();
    });

    it('evaluates product metrics and renders their bindings with empty optional iteration', function () {
        spyOn(Breinify.plugins.webExperiences, 'getActivationGroup').and.returnValue('133645012');
        const condition = {type: 'decision', settings: {
            refId: 'metric', input: {source: 'ACTIVATION_GROUP', group: 1}
        }};
        const banner = action('POPULAR! %%condition.dataFeedMetric.metricValue | number:0%% purchases');
        banner.settings.selector = '#' + id + ' .target';
        runtime = plugin.register(module, id, 'v', {
            iteration: {},
            decision: {required: true, service: id, configurationId: id, conditions: [condition]},
            conditionsGroups: [{actionGroup: 'matched', conditions: [condition]}],
            actions: {matched: [banner], _default: []}
        });
        plugin.handle(id, 'v', {type: 'full-scan'});
        jasmine.clock().tick(1);
        expect(requests.length).toBe(1);
        const entries = requests[0].payload.webExperiences;
        expect(entries.length).toBe(1);
        expect(entries[0].conditionInputs.metric).toBe('133645012');
        expect(entries[0].requestId).toBeUndefined();
        respond(0);
        expect(fixture.textContent).toBe('POPULAR! 37 purchases');
        expect(runtime.iterationState).toBeUndefined();
        expect(console.error).not.toHaveBeenCalled();
    });

    it('still rejects nonempty iteration settings without a supported type', function () {
        configure({selector: '#' + id + ' .row'}, false, null, 'invalid');
        expect(fixture.textContent).toBe('');
        expect(console.error).toHaveBeenCalled();
    });
});
