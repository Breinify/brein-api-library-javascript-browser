"use strict";

describe('UiModifyContent target observation', function () {
    var $ = Breinify.UTL._jquery();
    var plugin = Breinify.plugins.uiModifyContent;
    var selector = '#modify-content-target-fixture .mc-target';
    var sequence = 0;
    var id;
    var fixture;
    var module;
    var reports;
    var executions;
    var scans;
    var originalQuery;
    var originalActivities;
    var originalGeneric;
    var originalUrl;
    var extraIds;

    beforeEach(function () {
        id = 'modify-content-target-check-' + (++sequence);
        extraIds = [];
        reports = [];
        executions = 0;
        scans = 0;
        module = null;
        originalUrl = window.location.href;
        originalQuery = document.querySelectorAll;
        originalActivities = Breinify.plugins.activities;
        originalGeneric = originalActivities && originalActivities.generic;
        if (!originalActivities) Breinify.plugins.activities = {};
        Breinify.plugins.activities.generic = function (type, user, tags) {
            reports.push({type: type, tags: tags});
        };
        fixture = document.createElement('div');
        fixture.id = 'modify-content-target-fixture';
        document.body.appendChild(fixture);
        Breinify.plugins.trigger.init();
    });

    afterEach(function () {
        document.querySelectorAll = originalQuery;
        if (module) {
            module.isValidPage = function () { return false; };
            module.findRequirements = function () { return false; };
            module.triggerSettings = function () { return {}; };
        }
        plugin.register({}, id, 'v1', {actions: {}});
        extraIds.forEach(function (extraId) { plugin.register({}, extraId, 'v1', {actions: {}}); });
        fixture.remove();
        window.history.replaceState({}, '', originalUrl);
        if (originalActivities) {
            Breinify.plugins.activities.generic = originalGeneric;
        } else {
            delete Breinify.plugins.activities;
        }
    });

    function settle() {
        return new Promise(function (resolve) { window.setTimeout(resolve, 100); });
    }

    function content(settings) {
        return {type: 'changeContent', settings: $.extend({selector: selector, operation: 'append',
            content: 'X', allowHtml: false}, settings)};
    }

    function config(actions) {
        return {conditionsGroups: [], actions: {_default: actions || [content()]}};
    }

    async function setup(settings, html) {
        fixture.innerHTML = html || '<div class="mc-target">Original</div>';
        module = {};
        plugin.register(module, id, 'v1', settings);
        $(document).trigger('module-added', [id, module]);
        var onChange = module.onChange;
        module.onChange = function (data) {
            executions++;
            return onChange(data);
        };
        document.querySelectorAll = function (value) {
            if (value === selector) scans++;
            return originalQuery.call(document, value);
        };
        await settle();
        executions = 0;
        scans = 0;
    }

    it('ignores repeated mutations on completed targets without document scans', async function () {
        await setup(config());
        var target = fixture.querySelector('.mc-target');
        expect(target.textContent).toBe('OriginalX');
        expect(reports.filter(function (report) { return report.tags.rendered === true; }).length).toBe(1);
        for (var i = 0; i < 100; i++) target.setAttribute('data-update', String(i));
        target.appendChild(document.createElement('span'));
        await settle();
        expect(executions).toBe(0);
        expect(scans).toBe(0);
        expect(target.textContent).toBe('OriginalX');
    });

    it('still modifies new matching descendants and replacement nodes once', async function () {
        await setup(config());
        var nested = document.createElement('div');
        nested.className = 'mc-target';
        nested.textContent = 'Nested';
        fixture.querySelector('.mc-target').appendChild(nested);
        await settle();
        expect(nested.textContent).toBe('NestedX');
        var replacement = document.createElement('div');
        replacement.className = 'mc-target';
        replacement.textContent = 'Replacement';
        fixture.querySelector('.mc-target').replaceWith(replacement);
        await settle();
        expect(replacement.textContent).toBe('ReplacementX');
        expect(executions).toBe(2);
    });

    it('still respects application limits for later targets', async function () {
        await setup(config([content({maxApplications: 1})]));
        var target = document.createElement('div');
        target.className = 'mc-target';
        target.textContent = 'Later';
        fixture.appendChild(target);
        await settle();
        expect(target.textContent).toBe('Later');
        expect(executions).toBe(0);
    });

    it('preserves full scans and initial reporting', async function () {
        await setup(config());
        expect(module.findRequirements($(fixture), {type: 'full-scan'})).toBe(true);
        module.onChange({type: 'full-scan'});
        expect(fixture.querySelector('.mc-target').textContent).toBe('OriginalX');
        expect(reports.length).toBe(1);
        var fresh = {};
        var extraId = id + '-missing';
        extraIds.push(extraId);
        plugin.register(fresh, extraId, 'v1', config([content({selector: '#modify-content-target-fixture .missing'})]));
        var ready = fresh.findRequirements($(fixture), {type: 'full-scan'});
        expect(ready).toBe(true);
        if (ready) fresh.onChange({type: 'full-scan'});
        expect(reports[reports.length - 1].tags.rendered).toBe(false);
    });

    it('preserves explicit reapplication and navigation', async function () {
        await setup({conditionsGroups: [{actionGroup: 'triggered', conditions: [
            {type: 'trigger', settings: {triggerName: 'apply', frequency: 'everyTriggerCall'}}
        ]}], actions: {triggered: [content()]}});
        var target = fixture.querySelector('.mc-target');
        expect(target.textContent).toBe('Original');
        plugin.trigger(id, 'apply');
        await settle();
        expect(target.textContent).toBe('OriginalX');
        plugin.trigger(id, 'apply');
        await settle();
        expect(target.textContent).toBe('OriginalXX');
        window.history.pushState({}, '', '#modify-content-target-next-page');
        plugin.trigger(id, 'apply');
        await settle();
        expect(target.textContent).toBe('OriginalXXX');
    });

    it('allows one action to create a target for a later action without repeated application', async function () {
        await setup(config([
            content({selector: '#modify-content-target-fixture .host', allowHtml: true,
                content: '<div class="mc-target">Created</div>'}),
            content()
        ]), '<div class="host"></div>');
        expect(fixture.querySelector('.mc-target').textContent).toBe('CreatedX');
        expect(executions).toBe(0);
    });

    it('preserves delayed element-existence condition evaluation', async function () {
        await setup({conditionsGroups: [{actionGroup: 'ready', conditions: [
            {type: 'elementexists', settings: {selector: '#modify-content-target-fixture .gate',
                match: {operator: 'AT_LEAST', count: 1}}}
        ]}], actions: {ready: [content()]}});
        var target = fixture.querySelector('.mc-target');
        expect(target.textContent).toBe('Original');
        var gate = document.createElement('div');
        gate.className = 'gate';
        fixture.appendChild(gate);
        await settle();
        expect(target.textContent).toBe('OriginalX');
    });
});
