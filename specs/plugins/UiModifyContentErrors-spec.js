"use strict";

describe('Modify Content error classification', function () {
    const plugin = Breinify.plugins.uiModifyContent;
    let id, sequence = 0, runtime, activities, requests, originalActivities;

    beforeEach(function () {
        id = 'error-spec-' + (++sequence);
        activities = [];
        requests = [];
        originalActivities = Breinify.plugins.activities;
        Breinify.plugins.activities = {generic: function (type, user, tags) { activities.push(tags); }};
        spyOn(Breinify, 'handleCaughtError').and.returnValue(true);
        spyOn(Breinify, 'service').and.callFake(function (service, payload, callback) {
            requests.push({payload: payload, callback: callback});
        });
        spyOn(console, 'log');
        spyOn(console, 'error');
        jasmine.clock().install();
    });

    afterEach(function () {
        plugin.register({}, id, 'version', {actions: {}});
        Breinify.plugins.activities = originalActivities;
        jasmine.clock().uninstall();
    });

    function handle() {
        plugin.handle(id, 'version', {});
        jasmine.clock().tick(51);
    }

    function lookup() {
        spyOn(Breinify.plugins.webExperiences, 'getActivationGroup').and.returnValue('133645012');
        const condition = {type: 'decision', settings: {
            refId: 'metric', input: {source: 'ACTIVATION_GROUP', group: 1}
        }};
        runtime = plugin.register({}, id, 'version', {
            decision: {required: true, service: id, configurationId: id, conditions: [condition]},
            conditionsGroups: [{actionGroup: 'matched', conditions: [condition]}],
            actions: {matched: [], _default: [], _failure: []}
        });
        handle();
    }

    it('records timeout diagnostics without calling a lookup failure a script error', function () {
        lookup();
        requests[0].callback({textStatus: 'timeout', httpStatus: 0, responseText: 'private data'}, null, null);
        handle();
        expect(activities.length).toBe(1);
        expect(activities[0].action).toBe('_failure');
        expect(activities[0].status).toBe(13000);
        expect(activities[0].lookupFailure).toEqual({category: 'TIMEOUT', batchSize: 1, httpStatus: 0});
        expect(Breinify.handleCaughtError).not.toHaveBeenCalled();
    });

    it('separates HTTP failures from transport failures', function () {
        lookup();
        requests[0].callback({httpStatus: 503}, null, null);
        handle();
        expect(activities[0].lookupFailure.category).toBe('HTTP_ERROR');
        expect(activities[0].lookupFailure.httpStatus).toBe(503);
        expect(Breinify.handleCaughtError).not.toHaveBeenCalled();
    });

    it('identifies transport failures without claiming they are JavaScript exceptions', function () {
        lookup();
        requests[0].callback({httpStatus: null, isNetworkError: true}, null, null);
        handle();
        expect(activities[0].lookupFailure.category).toBe('NETWORK_ERROR');
        expect(Breinify.handleCaughtError).not.toHaveBeenCalled();
    });

    it('reports a thrown service invocation as an execution error and a failed rendering', function () {
        Breinify.service.and.throwError('client execution failed');
        lookup();
        handle();
        expect(Breinify.handleCaughtError.calls.count()).toBe(1);
        expect(activities[0].lookupFailure.category).toBe('CLIENT_EXCEPTION');
        expect(activities[0].status).toBe(500);
    });

    it('preserves service codes but excludes the response body and message', function () {
        lookup();
        requests[0].callback({responseCode: 25211, message: 'private details', response: {user: 'private'}}, null, null);
        handle();
        expect(activities[0].lookupFailure).toEqual({category: 'SERVICE_ERROR', batchSize: 1, responseCode: 25211});
        expect(Breinify.handleCaughtError).not.toHaveBeenCalled();
    });

    it('distinguishes malformed replies from missing decisions', function () {
        lookup();
        requests[0].callback(null, null, {});
        handle();
        expect(activities[0].lookupFailure.category).toBe('INVALID_RESPONSE');
    });

    it('records missing decisions without inventing a JavaScript exception', function () {
        lookup();
        requests[0].callback(null, null, {decisions: []});
        handle();
        expect(activities[0].lookupFailure.category).toBe('MISSING_DECISION');
        expect(Breinify.handleCaughtError).not.toHaveBeenCalled();
    });

    it('reports caught execution errors once and records a failed rendering', function () {
        runtime = plugin.register({}, id, 'version', {iteration: {type: 'INVALID'}, actions: {_default: []}});
        handle();
        handle();
        expect(Breinify.handleCaughtError.calls.count()).toBe(1);
        expect(Breinify.handleCaughtError.calls.first().args[1].campaignWebExId).toBe('version');
        expect(activities.length).toBe(1);
        expect(activities[0].status).toBe(13200);
    });

    it('bounds reporting attempts per runtime and resets the budget on navigation', function () {
        const action = {type: 'writeToConsole', settings: {message: 'fails'}};
        runtime = plugin.register({}, id, 'version', {actions: {_default: [action]}});
        let count = 0;
        console.log.and.callFake(function () { throw new Error('distinct failure ' + (++count)); });
        for (let i = 0; i < 25; i++) handle();
        expect(Breinify.handleCaughtError.calls.count()).toBe(20);
        expect(count).toBe(25);

        const originalUrl = window.location.href;
        try {
            window.history.replaceState({}, '', '#error-budget-new-visit');
            handle();
            expect(Breinify.handleCaughtError.calls.count()).toBe(21);
        } finally {
            window.history.replaceState({}, '', originalUrl);
        }
    });

    it('allows one failure correction after an earlier successful rendering', function () {
        const action = {type: 'writeToConsole', settings: {message: 'ok'}};
        runtime = plugin.register({}, id, 'version', {actions: {_default: [action]}});
        handle();
        expect(activities[0].status).toBe(200);
        runtime.config.iteration = {type: 'INVALID'};
        handle();
        handle();
        expect(activities.map(function (tags) { return tags.status; })).toEqual([200, 13200]);
    });

    it('records JavaScript snippet failures even when the DOM action itself succeeds', function () {
        const error = new Error('snippet failed');
        runtime = plugin.register({webExperienceSnippets: {
            'web-experience:failure': {type: 'javascript', value: function () { throw error; }}
        }}, id, 'version', {actions: {_default: [{type: 'writeToConsole', settings: {
            message: 'ok', js: {snippetId: 'web-experience:failure'}
        }}]}});
        handle();
        handle();
        expect(Breinify.handleCaughtError.calls.count()).toBe(1);
        expect(activities.length).toBe(1);
        expect(activities[0].status).toBe(500);
    });
});

describe('Caught error event adapter', function () {
    it('extracts Chrome and Firefox source coordinates for the existing error mapper', function () {
        spyOn(Breinify, 'handleError').and.returnValue(true);
        ['    at run (https://bradfordexchange.breinify.com/api/personalized.js:120:4)',
            'run@https://bradfordexchange.breinify.com/api/personalized.js:120:4'].forEach(function (frame) {
            const error = new Error('failed');
            error.stack = 'Error: failed\n' + frame;
            expect(Breinify.handleCaughtError(error, {plugin: 'uiModifyContent'})).toBe(true);
            const args = Breinify.handleError.calls.mostRecent().args;
            expect(args[0].filename).toBe('https://bradfordexchange.breinify.com/api/personalized.js');
            expect(args[0].lineno).toBe(120);
            expect(args[0].colno).toBe(4);
            expect(args[0].error).toBe(error);
        });
    });

    it('does not fabricate a script source for network errors or unrelated scripts', function () {
        spyOn(Breinify, 'handleError');
        expect(Breinify.handleCaughtError({message: 'timeout'})).toBe(false);
        expect(Breinify.handleCaughtError({stack: 'at https://example.com/app.js:10:2'})).toBe(false);
        expect(Breinify.handleError).not.toHaveBeenCalled();
    });

    it('sends an actual scriptError activity through the default mapper', function () {
        const config = Breinify.config();
        spyOn(Breinify.plugins, '_getCustomization').and.returnValue({map: config.errorTagsMapper});
        spyOn(Breinify, 'activity');
        const error = new TypeError('cannot render');
        error.stack = 'TypeError: cannot render\n    at render (https://bradfordexchange.breinify.com/api/personalized.js:40:8)';
        expect(Breinify.handleCaughtError(error, {plugin: 'uiModifyContent'})).toBe(true);
        const args = Breinify.activity.calls.mostRecent().args;
        expect(args[1]).toBe('scriptError');
        expect(args[2].type).toBe('TypeError');
        expect(args[2].line).toBe(40);
        expect(args[2].execution.plugin).toBe('uiModifyContent');
    });

    it('rejects lookalike hosts and preserves mapper rejection without trying later frames', function () {
        spyOn(Breinify, 'handleError').and.returnValue(false);
        const unrelated = new Error('unrelated');
        unrelated.stack = 'at https://bradfordexchange.breinify.com.example.org/app.js:10:2\n' +
            'at https://breinify.com/app.js:11:2\n' +
            'at http://bradfordexchange.breinify.com/app.js:12:2';
        expect(Breinify.handleCaughtError(unrelated)).toBe(false);
        expect(Breinify.handleError).not.toHaveBeenCalled();

        const caught = new Error('caught');
        caught.stack = 'at https://cdns-script.breinify.com/customer/script.js:10:2\n' +
            'at https://bradfordexchange.breinify.com/api/personalized.js:11:2';
        expect(Breinify.handleCaughtError(caught)).toBe(false);
        expect(Breinify.handleError.calls.count()).toBe(1);
        expect(Breinify.handleError.calls.first().args[0].filename)
            .toBe('https://cdns-script.breinify.com/customer/script.js');
    });

    it('contains failures of the reporting path', function () {
        spyOn(Breinify, 'handleError').and.throwError('telemetry failed');
        const error = new Error('original');
        error.stack = 'at https://bradfordexchange.breinify.com/api/personalized.js:10:2';
        expect(Breinify.handleCaughtError(error)).toBe(false);
    });
});

describe('Modify Content isolated decision responses', function () {
    const plugin = Breinify.plugins.uiModifyContent;
    let sequence = 0, service, runtimes, calls, activities, originalActivities, fixture;

    beforeEach(function () {
        service = 'isolated-batch-' + (++sequence);
        runtimes = [];
        calls = [];
        activities = [];
        originalActivities = Breinify.plugins.activities;
        Breinify.plugins.activities = {generic: function (type, user, tags) { activities.push(tags); }};
        spyOn(Breinify, 'service').and.callFake(function (name, payload, callback) {
            calls.push({payload: payload, callback: callback});
        });
        spyOn(Breinify, 'handleCaughtError');
        spyOn(console, 'log');
        spyOn(console, 'error');
        spyOn(Breinify.plugins.webExperiences, 'getActivationGroup').and.returnValue('product');
        fixture = document.createElement('div');
        fixture.id = service;
        fixture.innerHTML = '<i data-item="a"></i><i data-item="b"></i>';
        document.body.appendChild(fixture);
        jasmine.clock().install();
    });

    afterEach(function () {
        runtimes.forEach(function (runtime) { plugin.register({}, runtime.webExId, 'v', {actions: {}}); });
        fixture.remove();
        Breinify.plugins.activities = originalActivities;
        jasmine.clock().uninstall();
    });

    function register(name, iteration) {
        const id = service + '-' + name;
        const condition = {type: 'decision', settings: {refId: 'metric', input: {
            source: iteration ? 'ITERATION' : 'ACTIVATION_GROUP', group: 1
        }}};
        const config = {
            decision: {required: true, service: service, configurationId: id, conditions: [condition]},
            conditionsGroups: [{actionGroup: 'matched', conditions: [condition]}],
            actions: {matched: [{type: 'writeToConsole', settings: {message: id}}], _failure: [], _default: []}
        };
        if (iteration) config.iteration = {type: 'SELECTOR', selector: '#' + service + ' i',
            extract: {type: 'ATTRIBUTE', attribute: 'data-item'}};
        const runtime = plugin.register({}, id, 'v', config);
        runtimes.push(runtime);
        plugin.handle(id, 'v', {});
        return runtime;
    }

    function success(entry) {
        return {configurationId: entry.configurationId, requestId: entry.requestId, matched: true,
            conditions: [{refId: 'metric', matched: true}]};
    }

    function failure(entry) {
        return {configurationId: entry.configurationId, requestId: entry.requestId, errorCode: 25202,
            errorMessage: 'generic', errorParameters: {private: true}};
    }

    function flush() {
        jasmine.clock().tick(51);
        runtimes.forEach(function (runtime) { plugin.handle(runtime.webExId, 'v', {}); });
        jasmine.clock().tick(51);
    }

    it('opts in explicitly and accepts an unchanged legacy success response', function () {
        register('legacy');
        jasmine.clock().tick(1);
        expect(calls[0].payload.includeErrors).toBe(true);
        calls[0].callback(null, null, {decisions: [success(calls[0].payload.webExperiences[0])]});
        flush();
        expect(activities.length).toBe(1);
        expect(activities[0].status).toBe(200);
        expect(activities[0].lookupFailure).toBeUndefined();
    });

    it('keeps successful experiences rendering while identifying only the failed experience', function () {
        register('good');
        const bad = register('bad');
        jasmine.clock().tick(1);
        expect(calls.length).toBe(1);
        const entries = calls[0].payload.webExperiences;
        calls[0].callback(null, null, {
            decisions: [success(entries[0])], errors: [failure(entries[1])]});
        flush();
        expect(activities.length).toBe(2);
        expect(activities.filter(function (tags) { return tags.status === 200; }).length).toBe(1);
        const failed = activities.find(function (tags) { return tags.action === '_failure'; });
        expect(failed.lookupFailure).toEqual({category: 'EXPERIENCE_ERROR', batchSize: 2,
            errorCode: 25202, configurationId: bad.config.decision.configurationId});
        expect(Breinify.handleCaughtError).not.toHaveBeenCalled();
    });

    it('correlates a failed item independently from a successful item in the same experience', function () {
        register('items', true);
        jasmine.clock().tick(1);
        const entries = calls[0].payload.webExperiences;
        expect(entries.length).toBe(2);
        calls[0].callback(null, null, {
            decisions: [success(entries[1])], errors: [failure(entries[0])]});
        flush();
        const failed = activities.find(function (tags) { return tags.action === '_failure'; });
        expect(failed.lookupFailure.requestId).toBe(entries[0].requestId);
        expect(activities.filter(function (tags) { return tags.status === 200; }).length).toBe(1);
    });

    it('accepts an all-failed response as identified experience errors', function () {
        register('one');
        register('two');
        jasmine.clock().tick(1);
        calls[0].callback(null, null, { decisions: [],
            errors: calls[0].payload.webExperiences.map(failure).reverse()});
        flush();
        expect(activities.length).toBe(2);
        activities.forEach(function (tags) { expect(tags.lookupFailure.category).toBe('EXPERIENCE_ERROR'); });
    });

    it('does not attribute an uncorrelated item error to another item', function () {
        register('items', true);
        jasmine.clock().tick(1);
        const entries = calls[0].payload.webExperiences;
        const uncorrelated = failure(entries[0]);
        delete uncorrelated.requestId;
        calls[0].callback(null, null, { decisions: [success(entries[1])], errors: [uncorrelated]});
        flush();
        const failed = activities.find(function (tags) { return tags.action === '_failure'; });
        expect(failed.lookupFailure.category).toBe('MISSING_DECISION');
    });

    it('ignores errors belonging to another configuration', function () {
        register('legacy');
        jasmine.clock().tick(1);
        const entry = calls[0].payload.webExperiences[0];
        const unrelated = failure(entry);
        unrelated.configurationId = 'another-configuration';
        calls[0].callback(null, null, {decisions: [success(entry)], errors: [unrelated]});
        flush();
        expect(activities.length).toBe(1);
        expect(activities[0].status).toBe(200);
    });
});
