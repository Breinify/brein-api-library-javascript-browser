"use strict";

describe('UiModifyContent shared JavaScript lifecycle', function () {
    const plugin = Breinify.plugins.uiModifyContent;
    let id, module, runtime, activities, previousActivities, fixture, callbacks, previousSnippets;
    let sequence = 0;

    beforeEach(function () {
        id = 'javascript-spec-' + (++sequence);
        module = {webExperienceSnippets: {}};
        fixture = document.createElement('div');
        fixture.id = id;
        document.body.appendChild(fixture);
        previousActivities = Breinify.plugins.activities;
        activities = jasmine.createSpy('activity');
        Breinify.plugins.activities = {generic: activities};
        previousSnippets = Breinify.plugins.snippetManager;
        callbacks = {};
        Breinify.plugins.snippetManager = {get: function () { return null; },
            onSnippetRegistered: function (key, callback) { callbacks[key] = callback; },
            injectCode: previousSnippets.injectCode};
        spyOn(console, 'error');
        spyOn(console, 'log');
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date());
    });

    afterEach(function () {
        plugin.register({}, id, 'v', {actions: {}});
        fixture.remove();
        document.getElementById('br-style-' + id)?.remove();
        Breinify.plugins.activities = previousActivities;
        Breinify.plugins.snippetManager = previousSnippets;
        jasmine.clock().uninstall();
    });

    function configure(fn, options) {
        options = options || {};
        const key = options.snippetId || 'web-experience:' + id;
        if (!options.snippetId) module.webExperienceSnippets[key] = {type: 'javascript', value: fn};
        const js = Object.assign({snippetId: key}, options.js);
        const action = {type: options.type || 'runJavaScript', settings: Object.assign({}, options.settings, {js: js})};
        const config = Object.assign({actions: {[options.group || '_default']: [action]}, conditionsGroups: []},
            options.config);
        runtime = plugin.register(module, id, 'v', config);
        if (!options.defer) evaluate();
        return action;
    }

    function evaluate() { plugin.handle(id, 'v', {type: 'full-scan'}); }
    function outcome() { return activities.calls.mostRecent().args[2]; }
    async function flush() {
        for (let i = 0; i < 8; i++) await Promise.resolve();
        jasmine.clock().tick(51);
        for (let i = 0; i < 8; i++) await Promise.resolve();
    }

    it('preserves the synchronous advanced signature, this binding, existing fields and undefined return', function () {
        let context, receiver;
        const fn = jasmine.createSpy('legacy').and.callFake(function (ctx) { context = ctx; receiver = this; });
        const action = configure(fn, {type: 'writeToConsole', settings: {message: 'legacy'}});
        evaluate();
        expect(fn).toHaveBeenCalledTimes(1);
        expect(receiver).toBe(module);
        expect(context.module).toBe(module);
        expect(context.action.settings).toEqual(action.settings);
        expect(context.groupId).toBe('_default');
        expect(context.iteration).toBeUndefined();
        expect(context.element).toBeNull();
        expect(context.params).toEqual({});
        expect(outcome().rendered).toBeTrue();
        expect(activities).toHaveBeenCalledTimes(1);
    });

    it('does not change an existing action outcome based on its synchronous advanced return value', function () {
        configure(function () { return {rendered: false}; }, {type: 'writeToConsole', settings: {message: 'existing'}});
        expect(outcome().rendered).toBeTrue();
        expect(outcome().status).toBe(200);
    });

    it('awaits advanced JavaScript on applyCss and reports the existing action once', async function () {
        let resolve;
        const fn = jasmine.createSpy('async css hook').and.callFake(function () {
            return new Promise(function (done) { resolve = done; });
        });
        configure(fn, {type: 'applyCss', settings: {style: '.test { color: red; }', styleId: id}});
        expect(document.getElementById('br-style-' + id)).not.toBeNull();
        expect(activities).not.toHaveBeenCalled();
        evaluate();
        expect(fn).toHaveBeenCalledTimes(1);
        resolve();
        await flush();
        expect(outcome().rendered).toBeTrue();
        expect(activities).toHaveBeenCalledTimes(1);
    });

    it('uses the standalone Promise result and snapshots typed parameters without interpolating code or data', async function () {
        let resolve, context;
        const params = {productId: '141236001', enabled: true, ids: [1, 2], text: '%%iteration.value%%'};
        configure(function (ctx) {
            context = ctx;
            return new Promise(function (done) { resolve = done; });
        }, {js: {params: params}});
        params.ids.push(3);
        expect(context.params.ids).toEqual([1, 2]);
        expect(context.params.enabled).toBeTrue();
        expect(context.params.text).toBe('%%iteration.value%%');
        expect(Object.isFrozen(context.params.ids)).toBeTrue();
        expect(activities).not.toHaveBeenCalled();
        resolve({rendered: false});
        await flush();
        expect(outcome().rendered).toBeFalse();
        expect(outcome().status).toBe(13000);
    });

    it('reports Promise rejection as failure and runs registered cleanup once', async function () {
        const cleanup = jasmine.createSpy('cleanup');
        let context;
        configure(function (ctx) {
            context = ctx;
            ctx.onCleanup(cleanup);
            return Promise.reject(new Error('image failed'));
        });
        await flush();
        expect(outcome().status).toBe(500);
        expect(context.signal.aborted).toBeTrue();
        expect(cleanup).toHaveBeenCalledTimes(1);
        evaluate();
        expect(activities).toHaveBeenCalledTimes(1);
    });

    it('bounds a never-settling Promise and ignores its later fulfillment', async function () {
        let resolve, context;
        configure(function (ctx) {
            context = ctx;
            return new Promise(function (done) { resolve = done; });
        }, {js: {timeoutInMs: 10}});
        jasmine.clock().tick(10);
        await flush();
        expect(outcome().status).toBe(500);
        expect(context.signal.aborted).toBeTrue();
        resolve(true);
        await flush();
        expect(activities).toHaveBeenCalledTimes(1);
    });

    it('waits for late snippet registration without reporting completion early', async function () {
        const fn = jasmine.createSpy('late').and.returnValue(Promise.resolve({rendered: true}));
        configure(null, {snippetId: 'late-snippet'});
        expect(activities).not.toHaveBeenCalled();
        Breinify.plugins.snippetManager.get = function () { return fn; };
        callbacks['late-snippet']();
        await flush();
        expect(fn).toHaveBeenCalledTimes(1);
        expect(outcome().rendered).toBeTrue();
    });

    it('cancels an old runtime and never invokes its late registered snippet', async function () {
        configure(null, {snippetId: 'late-snippet'});
        plugin.register({}, id, 'v', {actions: {}});
        const fn = jasmine.createSpy('stale');
        Breinify.plugins.snippetManager.get = function () { return fn; };
        callbacks['late-snippet']();
        await flush();
        expect(fn).not.toHaveBeenCalled();
        expect(activities).not.toHaveBeenCalled();
    });

    it('aborts on deactivation, ignores stale resolution and handles asynchronous cleanup', async function () {
        let active = true, resolve, context;
        module.isValidPage = function () { return active; };
        const cleanup = jasmine.createSpy('cleanup').and.returnValue(Promise.resolve());
        configure(function (ctx) {
            context = ctx;
            ctx.onCleanup(cleanup);
            return new Promise(function (done) { resolve = done; });
        });
        active = false;
        evaluate();
        resolve(true);
        await flush();
        expect(context.signal.aborted).toBeTrue();
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(activities).not.toHaveBeenCalled();
    });

    it('provides independent selector iteration contexts, native elements and completion outcomes', async function () {
        fixture.innerHTML = '<div class="row" data-id="A"></div><div class="row" data-id="B"></div>';
        const seen = [], resolve = [];
        configure(function (ctx) {
            seen.push(ctx);
            return new Promise(function (done) { resolve.push(done); });
        }, {config: {iteration: {type: 'SELECTOR', selector: '#' + id + ' .row',
            extract: {type: 'ATTRIBUTE', attribute: 'data-id'}}}});
        expect(seen.length).toBe(2);
        expect(seen[0].element).toBe(fixture.children[0]);
        expect(seen[0].iteration.$el[0]).toBe(seen[0].element);
        expect(seen.map(function (ctx) { return ctx.iteration.value; })).toEqual(['A', 'B']);
        expect(seen.map(function (ctx) { return ctx.iteration.index; })).toEqual([0, 1]);
        resolve[1](true);
        await flush();
        expect(activities).toHaveBeenCalledTimes(1);
        fixture.children[0].remove();
        evaluate();
        resolve[0](true);
        await flush();
        expect(seen[0].signal.aborted).toBeTrue();
        expect(activities).toHaveBeenCalledTimes(1);
    });

    it('provides typed feature items with no implicit DOM element', async function () {
        const storage = Breinify.plugins.featureStorage;
        const get = storage.get;
        const seen = [];
        storage.get = function (key) {
            return key === '__br_feature.feature-test' ? [{id: 'A'}, {id: 'B'}] : get.apply(this, arguments);
        };
        try {
            configure(function (ctx) { seen.push(ctx); return Promise.resolve(true); },
                {config: {iteration: {type: 'FEATURE', featureId: 'feature-test'}}});
            await flush();
            expect(seen.length).toBe(2);
            expect(seen[0].element).toBeNull();
            expect(seen[0].iteration.value).toEqual({id: 'A'});
            expect(seen[1].iteration.originalValue).toEqual({id: 'B'});
            expect(seen[1].iteration.index).toBe(1);
            expect(activities).toHaveBeenCalledTimes(2);
        } finally {
            storage.get = get;
        }
    });

    it('does not report completion for a branch that no longer matches', async function () {
        let resolve, context;
        const cleanup = jasmine.createSpy('branch cleanup');
        configure(function (ctx) {
            context = ctx;
            ctx.onCleanup(cleanup);
            return new Promise(function (done) { resolve = done; });
        }, {defer: true, group: 'matched', config: {
            conditionsGroups: [{actionGroup: 'matched', conditions: [{type: 'decision', settings: {refId: 'A'}}]}]
        }});
        runtime.config.actions._default = [];
        runtime.decision.conditionResults.A = true;
        runtime.decision.conditionCache.A = {scope: 'SESSION', expiresAt: 0};
        evaluate();
        expect(activities).not.toHaveBeenCalled();
        runtime.decision.conditionResults.A = false;
        evaluate();
        expect(context.signal.aborted).toBeTrue();
        expect(cleanup).toHaveBeenCalledTimes(1);
        resolve(true);
        await flush();
        expect(activities).toHaveBeenCalledTimes(1);
        expect(outcome().rendered).toBeFalse();
        expect(outcome().action).toBe('_default');
    });
});
