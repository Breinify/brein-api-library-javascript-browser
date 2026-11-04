"use strict";

describe('Explicit execution error reporting', function () {
    var url, sequence = 0;
    var context = {plugin: 'test', phase: 'hook', webExperienceId: 'experience'};

    beforeEach(function () {
        url = window.location.href;
        window.history.replaceState({}, '', '#execution-report-' + (++sequence));
        spyOn(Breinify, 'handleCaughtError').and.returnValue(true);
    });

    afterEach(function () { window.history.replaceState({}, '', url); });

    function failure(message) {
        var error = new TypeError(message || 'broken hook');
        error.stack = error.name + ': ' + error.message +
            '\n    at hook (https://bradfordexchange.breinify.com/api/personalized.js:10:4)';
        return error;
    }

    it('reports only allowlisted context fields without forwarding runtime data', function () {
        var error = failure();
        expect(Breinify.reportExecutionError(error, Object.assign({runtime: {secret: 'private'}}, context))).toBe(true);
        expect(Breinify.handleCaughtError).toHaveBeenCalledWith(error, context);
    });

    it('deduplicates both nested catches and repeated errors from the same boundary', function () {
        var error = failure();
        Breinify.reportExecutionError(error, context);
        Breinify.reportExecutionError(error, {plugin: 'outer', phase: 'dispatch'});
        var repeated = failure();
        Breinify.reportExecutionError(repeated, context);
        Breinify.reportExecutionError(repeated, {plugin: 'outer', phase: 'dispatch'});
        expect(Breinify.handleCaughtError.calls.count()).toBe(1);
    });

    it('caps reporting attempts and allows new reports on a new page', function () {
        for (var i = 0; i < 25; i++) Breinify.reportExecutionError(failure('failure ' + i), context);
        expect(Breinify.handleCaughtError.calls.count()).toBe(20);
        var reads = 0;
        var extra = new Error('extra');
        Object.defineProperty(extra, 'stack', {get: function () { reads++; return 'unused stack'; }});
        Breinify.reportExecutionError(extra, context);
        expect(reads).toBe(0);
        window.history.replaceState({}, '', '#execution-report-next');
        Breinify.reportExecutionError(failure('failure 0'), context);
        expect(Breinify.handleCaughtError.calls.count()).toBe(21);
    });

    it('does not retry rejected reports or let telemetry failures escape', function () {
        Breinify.handleCaughtError.and.throwError('telemetry unavailable');
        var error = failure();
        expect(Breinify.reportExecutionError(error, context)).toBe(false);
        expect(Breinify.reportExecutionError(error, context)).toBe(false);
        expect(Breinify.handleCaughtError.calls.count()).toBe(1);
    });

    it('ignores cancellation, transport, configuration, and browser-environment failures', function () {
        var errors = ['AbortError', 'TimeoutError', 'NetworkError', 'SecurityError', 'QuotaExceededError']
            .map(function (name) { var error = failure(); error.name = name; return error; });
        errors.push(Object.assign(failure(), {isNetworkError: true}));
        errors.push(Object.assign(failure(), {httpStatus: 503}));
        errors.push(Object.assign(failure(), {textStatus: 'timeout'}));
        errors.push(Object.assign(failure(), {breinifyErrorCategory: 'configuration'}));
        errors.push(new DOMException('Invalid selector', 'SyntaxError'));
        errors.push({message: 'service rejected', stack: failure().stack});
        errors.push(null, 'failure');
        errors.forEach(function (error) { expect(Breinify.reportExecutionError(error, context)).toBe(false); });
        expect(Breinify.handleCaughtError).not.toHaveBeenCalled();
    });

    it('passes an actionable error through the real mapper to scriptError', function () {
        Breinify.handleCaughtError.and.callThrough();
        spyOn(Breinify.plugins, '_getCustomization').and.returnValue({map: Breinify.config().errorTagsMapper});
        spyOn(Breinify, 'activity');
        var script = document.createElement('script');
        script.textContent = 'window.__executionReportTest = function () { throw new TypeError("broken hook"); };' +
            '\n//# sourceURL=https://reporting-test.breinify.com/runtime.js';
        document.head.appendChild(script);
        var error;
        try { window.__executionReportTest(); } catch (caught) { error = caught; }
        finally { script.remove(); delete window.__executionReportTest; }
        expect(Breinify.reportExecutionError(error, context)).toBe(true);
        expect(Breinify.activity.calls.count()).toBe(1);
        expect(Breinify.activity.calls.first().args[1]).toBe('scriptError');
        expect(Breinify.activity.calls.first().args[2].execution).toEqual(context);
    });
});

describe('Activation snippet error reporting', function () {
    var config = {activationLogic: {snippet: 'activation-test'}};
    var module = {webExId: 'activation-test', webExVersionId: 'version'};

    beforeEach(function () {
        spyOn(console, 'error');
        spyOn(Breinify, 'reportExecutionError').and.returnValue(true);
        spyOn(Breinify.plugins.snippetManager, 'getSnippet');
    });

    it('reports thrown snippet defects and preserves inactive behavior', function () {
        var error = new ReferenceError('broken activation');
        Breinify.plugins.snippetManager.getSnippet.and.returnValue(function () { throw error; });
        expect(Breinify.plugins.webExperiences.checkActivationLogic(config, module)).toBe(false);
        expect(Breinify.reportExecutionError).toHaveBeenCalledWith(error, {
            plugin: 'webExperiences', phase: 'activationSnippet', snippetId: 'activation-test',
            webExperienceId: 'activation-test', campaignWebExId: 'version'
        });
    });

    it('does not report missing snippets or normal true/false results', function () {
        [null, function () { return false; }, function () { return true; }].forEach(function (snippet, index) {
            Breinify.plugins.snippetManager.getSnippet.and.returnValue(snippet);
            expect(Breinify.plugins.webExperiences.checkActivationLogic(config, module)).toBe(index === 2);
        });
        expect(Breinify.reportExecutionError).not.toHaveBeenCalled();
    });

    it('keeps the fallback if an overridden reporter itself throws', function () {
        Breinify.reportExecutionError.and.throwError('reporter failed');
        Breinify.plugins.snippetManager.getSnippet.and.returnValue(function () { throw new Error('hook failed'); });
        expect(Breinify.plugins.webExperiences.checkActivationLogic(config, module)).toBe(false);
        expect(console.error).toHaveBeenCalled();
    });
    it('remains compatible with an older core without the optional reporter', function () {
        var reporter = Breinify.reportExecutionError;
        Breinify.reportExecutionError = undefined;
        Breinify.plugins.snippetManager.getSnippet.and.returnValue(function () { throw new Error('hook failed'); });
        try {
            expect(Breinify.plugins.webExperiences.checkActivationLogic(config, module)).toBe(false);
        } finally {
            Breinify.reportExecutionError = reporter;
        }
        expect(console.error).toHaveBeenCalled();
    });

});
