"use strict";

describe('UiModifyContent', function () {

    describe('applyCss', function () {
        var id = 'apply-css-spec';
        var version = 'version-1';
        var activitySpy;
        var fixture;
        var runtime;
        var registeredIds;

        beforeEach(function () {
            activitySpy = createActivitySpy();
            fixture = document.createElement('div');
            fixture.id = 'apply-css-fixture';
            document.body.appendChild(fixture);
            registeredIds = [];
        });

        afterEach(function () {
            uiModifyContent.register({}, id, version, {actions: {}});
            registeredIds.forEach(function (snippetId) {
                Breinify.plugins.snippetManager.registerSnippet(snippetId, null);
            });
            document.querySelectorAll('[id^="br-style-apply-css-"], [id^="br-apply-css-"]').forEach(function (el) {
                el.remove();
            });
            fixture.remove();
            activitySpy.restore();
        });

        function setup(settings, module, enabled) {
            runtime = uiModifyContent.register(module || {}, id, version, {
                conditionsGroups: [],
                actions: {_default: [{type: 'applyCss', enabled: enabled !== false, settings: settings}]}
            });
            return runtime.module;
        }

        function evaluate() {
            uiModifyContent.handle(id, version, {});
        }

        // a document-wide style stays deduplicated even when the action runtime is recreated
        it('injects inline CSS once, honors enabled, and keeps an existing conflicting style', function () {
            setup({style: '.promotion { color: green; }', styleId: 'apply-css-primary'}, {}, false);
            evaluate();
            expect(document.getElementById('br-style-apply-css-primary')).toBeNull();
            setup({style: '.promotion { color: green; }', styleId: 'apply-css-primary'});
            evaluate();
            evaluate();
            var style = document.getElementById('br-style-apply-css-primary');
            expect(style.parentNode).toBe(document.body);
            expect(style.textContent).toBe('.promotion { color: green; }');
            setup({style: '.promotion { color: red; }', styleId: 'apply-css-primary'});
            evaluate();
            expect(document.querySelectorAll('#br-style-apply-css-primary').length).toBe(1);
            expect(style.textContent).toBe('.promotion { color: green; }');
        });

        // primary local snippets have their own ID and do not replace optional advanced css/js
        it('renders generated local styles and invokes advanced JavaScript after insertion', function () {
            var localId = 'web-experience:apply-css-primary';
            var jsId = 'web-experience:apply-css-js';
            var cssId = 'web-experience:apply-css-advanced';
            var calls = 0;
            var snippets = {};
            snippets[localId] = {type: 'css',
                value: '<style id="br-style-apply-css-local">.primary { color: green; }</style>'};
            snippets[jsId] = {type: 'javascript', value: function () {
                expect(document.getElementById('br-style-apply-css-local')).not.toBeNull();
                calls++;
            }};
            snippets[cssId] = {type: 'css',
                value: '<style id="br-style-apply-css-advanced">.advanced { color: blue; }</style>'};
            setup({snippetId: localId, js: {snippetId: jsId}, css: {snippetId: cssId}},
                {webExperienceSnippets: snippets});
            evaluate();
            evaluate();
            expect(calls).toBe(1);
            expect(document.getElementById('br-style-apply-css-advanced')).not.toBeNull();
            expectRenderedElement(activitySpy.renderedElements[0], true, 200, '_default');
        });

        // the public injector is asynchronous even for a registered snippet; completion must wake the action
        it('waits for a registered CSS snippet and reports success only after injection', function (done) {
            var snippetId = 'apply-css-late';
            registeredIds.push(snippetId);
            setup({snippetId: snippetId});
            evaluate();
            evaluate();
            expect(activitySpy.renderedElements.length).toBe(0);
            Breinify.plugins.snippetManager.registerSnippet(snippetId, '<style>.late { color: green; }</style>');
            setTimeout(function () {
                expect(document.querySelectorAll('#br-apply-css-late').length).toBe(1);
                expect(activitySpy.renderedElements.length).toBe(1);
                expectRenderedElement(activitySpy.renderedElements[0], true, 200, '_default');
                done();
            }, 20);
        });

        // an observer from an old registration must not apply CSS or run advanced code on a replaced runtime
        it('ignores late snippet registration after the experience runtime is replaced', function (done) {
            var snippetId = 'apply-css-obsolete';
            registeredIds.push(snippetId);
            setup({snippetId: snippetId});
            evaluate();
            uiModifyContent.register({}, id, version, {actions: {}});
            Breinify.plugins.snippetManager.registerSnippet(snippetId,
                '<style id="br-apply-css-obsolete">.obsolete { color: red; }</style>');
            setTimeout(function () {
                expect(document.getElementById('br-apply-css-obsolete')).toBeNull();
                done();
            }, 20);
        });

        // a registered JS/HTML snippet must never be executed as though it were CSS
        it('rejects a non-CSS snippet without injecting or executing it', function () {
            var snippetId = 'apply-css-not-css';
            var invoked = false;
            registeredIds.push(snippetId);
            Breinify.plugins.snippetManager.registerSnippet(snippetId, function () { invoked = true; });
            setup({snippetId: snippetId});
            evaluate();
            expect(invoked).toBe(false);
            expectRenderedElement(activitySpy.renderedElements[0], false, 500, '_default');
        });

        // shared target tracking, rather than another observer, handles late elements and excludes already applied ones
        it('styles late targets once and stops at maxApplications without replacing unrelated styles', function () {
            var module = setup({elementStyle: {selector: '#apply-css-fixture .promotion',
                properties: {'background-color': 'green', '--accent': 'gold', color: 'red !important'}},
                maxApplications: 3});
            evaluate();
            for (var i = 0; i < 4; i++) {
                var target = document.createElement('div');
                target.className = 'promotion';
                target.style.padding = '4px';
                fixture.appendChild(target);
                var required = module.findRequirements($(target), {type: 'added-element'});
                expect(required).toBe(i < 3);
                if (required) evaluate();
                if (i < 3) {
                    expect(target.style.backgroundColor).toBe('green');
                    expect(target.style.getPropertyValue('--accent')).toBe('gold');
                    expect(target.style.getPropertyPriority('color')).toBe('important');
                    expect(target.style.padding).toBe('4px');
                } else {
                    expect(target.style.backgroundColor).toBe('');
                }
            }
            fixture.firstChild.style.backgroundColor = 'blue';
            evaluate();
            expect(fixture.firstChild.style.backgroundColor).toBe('blue');
            fixture.innerHTML = '<div class="promotion"></div>';
            evaluate();
            expect(fixture.firstChild.style.backgroundColor).toBe('');
        });

        // invalid declarations must fail before the selected element receives any partial inline changes
        it('does not count invalid CSS declarations as a successful application', function () {
            fixture.innerHTML = '<div class="promotion"></div>';
            setup({elementStyle: {selector: '#apply-css-fixture .promotion',
                properties: {color: 'green', 'background-color': 'not-a-color'}}});
            evaluate();
            expect(fixture.firstChild.style.color).toBe('');
            expectRenderedElement(activitySpy.renderedElements[0], false, 500, '_default');
        });
    });

    describe('attribute decision freshness', function () {
        var id = 'attribute-decision-freshness';
        var ref = 'attribute-freshness-ref';
        var runtime;
        var originalService;
        var originalUrl;
        var activitySpy;
        var calls;
        var callbacks;
        var scope;

        beforeEach(function () {
            originalService = Breinify.service;
            originalUrl = window.location.href;
            activitySpy = createActivitySpy();
            calls = 0;
            callbacks = [];
            scope = 'MEMORY';
            Breinify.plugins.trigger.init();
            Breinify.service = function (service, payload, callback) {
                calls++;
                callbacks.push(callback);
            };
            runtime = uiModifyContent.register({}, id, 'attribute-version', {
                actions: {},
                decision: {required: true, configurationId: id,
                    conditions: [{type: 'decision', settings: {refId: ref}}]}
            });
        });

        afterEach(function () {
            uiModifyContent.register({}, id, 'attribute-version', {actions: {}});
            Breinify.service = originalService;
            window.history.replaceState({}, '', originalUrl);
            activitySpy.restore();
        });

        function evaluate() {
            uiModifyContent.handle(id, 'attribute-version', {});
        }

        function complete(index) {
            callbacks[index](null, null, {decisions: [{configurationId: id, matched: true,
                conditions: [{refId: ref, matched: true,
                    cache: {scope: scope, maxAgeSeconds: scope === 'MEMORY' ? 10 : 0}}]}]});
        }

        // expiration makes data stale but does not schedule a request until an evaluation is requested
        it('expires memory results on the same page without polling or persisting them', function (done) {
            evaluate();
            setTimeout(function () {
                complete(0);
                evaluate();
                expect(calls).toBe(1);
                var session = window.sessionStorage.getItem('br::wemc::decision') || '';
                var persistent = window.localStorage.getItem('br::wemc::decision') || '';
                expect(session.indexOf(ref)).toBe(-1);
                expect(persistent.indexOf(ref)).toBe(-1);
                runtime.decision.conditionCache[ref].expiresAt = Date.now() - 1;
                setTimeout(function () {
                    expect(calls).toBe(1);
                    evaluate();
                    setTimeout(function () {
                        expect(calls).toBe(2);
                        complete(1);
                        done();
                    }, 10);
                }, 10);
            }, 10);
        });

        // returning to A is a new visit even when this experience was never evaluated on B
        it('invalidates PAGE results after A to B to A navigation', function (done) {
            scope = 'PAGE';
            evaluate();
            setTimeout(function () {
                complete(0);
                var firstPageKey = runtime.decision.conditionCache[ref].pageKey;
                window.history.replaceState({}, '', '#attribute-intermediate-page');
                window.history.replaceState({}, '', originalUrl);
                evaluate();
                setTimeout(function () {
                    expect(calls).toBe(2);
                    complete(1);
                    expect(runtime.decision.conditionCache[ref].pageKey).not.toBe(firstPageKey);
                    done();
                }, 10);
            }, 10);
        });

        // TTL may cross navigation while fresh, but registration does not reload it from browser storage
        it('reuses fresh memory results across navigation but not runtime replacement', function (done) {
            evaluate();
            setTimeout(function () {
                complete(0);
                window.history.replaceState({}, '', '#attribute-fresh-memory-page');
                evaluate();
                expect(calls).toBe(1);
                var config = runtime.config;
                runtime = uiModifyContent.register({}, id, 'attribute-version', config);
                evaluate();
                setTimeout(function () {
                    expect(calls).toBe(2);
                    complete(1);
                    done();
                }, 10);
            }, 10);
        });

        // a late response for the previous visit must not be treated as the current page's decision
        it('discards a response received after navigation and requests the current visit', function (done) {
            evaluate();
            setTimeout(function () {
                window.history.replaceState({}, '', '#attribute-late-response-page');
                complete(0);
                expect(runtime.decision.resolved).toBe(false);
                expect(runtime.decision.conditionResults[ref]).toBeUndefined();
                setTimeout(function () {
                    expect(calls).toBe(2);
                    complete(1);
                    expect(runtime.decision.resolved).toBe(true);
                    done();
                }, 10);
            }, 10);
        });
    });

    describe('showAnimation lifecycle', function () {
        var id = 'modify-content-animation-test';
        var version = 'animation-version';
        var module;
        var activitySpy;
        var originalGet;
        var renderCount;
        var finish;
        var target;
        var cancelled;
        var context;

        beforeEach(function () {
            module = {isValidPage: function () { return true; }};
            activitySpy = createActivitySpy();
            originalGet = Breinify.plugins.snippetManager.get;
            renderCount = 0;
            cancelled = 0;
            target = document.createElement('div');
            target.id = 'animation-action-target';
            document.body.appendChild(target);
            Breinify.plugins.snippetManager.get = function () {
                return function (ctx) {
                    context = ctx;
                    renderCount++;
                    return {
                        started: true,
                        cancel: function () { cancelled++; },
                        finished: {then: function (callback) { finish = callback; }}
                    };
                };
            };
        });

        afterEach(function () {
            uiModifyContent.register({}, id, version, {actions: {}});
            Breinify.plugins.snippetManager.get = originalGet;
            target.remove();
            activitySpy.restore();
        });

        function setup(settings) {
            return uiModifyContent.register(module, id, version, {
                conditionsGroups: [],
                actions: {_default: [{type: 'showAnimation', settings: settings}]}
            });
        }

        // callbacks are deliberately controlled so lifecycle assertions do not depend on actual drawing duration
        it('reserves before delayed playback and cleans up without replaying after completion', function (done) {
            setup({snippetId: 'animation-renderer', playback: {delayInMs: 10, durationInMs: 1200}});
            uiModifyContent.handle(id, version, {});
            uiModifyContent.handle(id, version, {});
            expect(renderCount).toBe(0);
            expect(activitySpy.renderedElements.length).toBe(0);
            setTimeout(function () {
                expect(renderCount).toBe(1);
                expect(context.container.style.position).toBe('fixed');
                expect(context.durationInMs).toBe(1200);
                uiModifyContent.handle(id, version, {});
                expect(renderCount).toBe(1);
                finish({status: 'completed'});
                expect(context.container.isConnected).toBe(false);
                expect(activitySpy.renderedElements[0].tags.status).toBe(200);
                uiModifyContent.handle(id, version, {});
                expect(renderCount).toBe(1);
                done();
            }, 25);
        });

        it('replays only on a new recognized call and cancels superseded animation playback', function (done) {
            var name = 'repeat-animation';
            uiModifyContent.register(module, id, version, {
                conditionsGroups: [{actionGroup: 'animation', conditions: [
                    {type: 'trigger', settings: {triggerName: name, frequency: 'everyTriggerCall'}}
                ]}],
                actions: {animation: [{type: 'showAnimation', settings: {snippetId: 'animation-renderer'}}]}
            });
            Breinify.plugins.webExperiences.trigger(id, name);
            setTimeout(function () {
                expect(renderCount).toBe(1);
                var oldFinish = finish;
                Breinify.plugins.webExperiences.trigger(id, name);
                expect(cancelled).toBe(1);
                oldFinish({status: 'completed'});
                setTimeout(function () {
                    expect(renderCount).toBe(2);
                    finish({status: 'completed'});
                    uiModifyContent.handle(id, version, {});
                    expect(renderCount).toBe(2);
                    done();
                }, 10);
            }, 10);
        });

        it('uses the existing target limit and restores section positioning', function (done) {
            target.style.position = 'static';
            setup({selector: '#animation-action-target', snippetId: 'animation-renderer', maxApplications: 1});
            uiModifyContent.handle(id, version, {});
            setTimeout(function () {
                expect(context.container.parentElement).toBe(target);
                expect(target.style.position).toBe('relative');
                finish({status: 'completed'});
                expect(target.style.position).toBe('static');
                uiModifyContent.handle(id, version, {});
                expect(renderCount).toBe(1);
                done();
            }, 10);
        });

        it('can discover a target added after the first scan', function (done) {
            target.remove();
            setup({selector: '#animation-action-target', snippetId: 'animation-renderer'});
            uiModifyContent.handle(id, version, {});
            expect(renderCount).toBe(0);
            document.body.appendChild(target);
            expect(module.findRequirements(target, {type: 'added-element'})).toBe(true);
            uiModifyContent.handle(id, version, {});
            setTimeout(function () {
                expect(renderCount).toBe(1);
                finish({status: 'completed'});
                done();
            }, 10);
        });

        it('cancels running playback when the experience is replaced', function (done) {
            setup({snippetId: 'animation-renderer'});
            uiModifyContent.handle(id, version, {});
            setTimeout(function () {
                uiModifyContent.register({}, id, version, {actions: {}});
                expect(cancelled).toBe(1);
                expect(context.container.isConnected).toBe(false);
                finish({status: 'completed'});
                expect(activitySpy.renderedElements.length).toBe(0);
                done();
            }, 10);
        });

        it('cancels a pending start when activation is lost', function (done) {
            setup({snippetId: 'animation-renderer', playback: {delayInMs: 20}});
            uiModifyContent.handle(id, version, {});
            module.isValidPage = function () { return false; };
            uiModifyContent.handle(id, version, {});
            setTimeout(function () {
                expect(renderCount).toBe(0);
                expect(document.querySelector('[data-br-animation]')).toBe(null);
                done();
            }, 30);
        });

        it('cancels on SPA navigation and allows a new visit without accepting old completion callbacks', function (done) {
            var originalUrl = window.location.href;
            setup({snippetId: 'animation-renderer'});
            uiModifyContent.handle(id, version, {});
            setTimeout(function () {
                var oldFinish = finish;
                var oldHost = context.container;
                window.history.replaceState({}, '', '#animation-next-page');
                uiModifyContent.handle(id, version, {});
                expect(cancelled).toBe(1);
                expect(oldHost.isConnected).toBe(false);
                oldFinish({status: 'completed'});
                expect(activitySpy.renderedElements.length).toBe(0);
                setTimeout(function () {
                    expect(renderCount).toBe(2);
                    finish({status: 'completed'});
                    expect(activitySpy.renderedElements.length).toBe(1);
                    uiModifyContent.register({}, id, version, {actions: {}});
                    window.history.replaceState({}, '', originalUrl);
                    done();
                }, 10);
            }, 10);
        });

        it('preserves an earlier successful action when a pending animation is skipped', function (done) {
            Breinify.plugins.snippetManager.get = function () {
                return function () {
                    return {started: false, cancel: function () {},
                        finished: {then: function (callback) { callback({status: 'skipped'}); }}};
                };
            };
            uiModifyContent.register(module, id, version, {
                conditionsGroups: [], actions: {_default: [
                    {type: 'writeToConsole', settings: {message: 'animation activity test'}},
                    {type: 'showAnimation', settings: {snippetId: 'skipped-animation'}}
                ]}
            });
            uiModifyContent.handle(id, version, {});
            expect(activitySpy.renderedElements.length).toBe(0);
            setTimeout(function () {
                expect(activitySpy.renderedElements[0].tags.status).toBe(200);
                expect(activitySpy.renderedElements[0].tags.rendered).toBe(true);
                done();
            }, 10);
        });

        it('reports missing renderer failures instead of a successful no-op', function (done) {
            Breinify.plugins.snippetManager.get = function () { return null; };
            setup({snippetId: 'missing-animation'});
            uiModifyContent.handle(id, version, {});
            setTimeout(function () {
                expect(activitySpy.renderedElements[0].tags.status).toBe(500);
                expect(activitySpy.renderedElements[0].tags.rendered).toBe(false);
                expect(document.querySelector('[data-br-animation]')).toBe(null);
                done();
            }, 10);
        });

        it('reports reduced-motion or zero-size skips without claiming an animation was rendered', function (done) {
            Breinify.plugins.snippetManager.get = function () {
                return function () {
                    return {started: false, cancel: function () {},
                        finished: {then: function (callback) { callback({status: 'skipped'}); }}};
                };
            };
            setup({snippetId: 'skipped-animation'});
            uiModifyContent.handle(id, version, {});
            setTimeout(function () {
                expect(activitySpy.renderedElements[0].tags.status).toBe(13000);
                expect(activitySpy.renderedElements[0].tags.rendered).toBe(false);
                expect(document.querySelector('[data-br-animation]')).toBe(null);
                done();
            }, 10);
        });
    });

    describe('URL conditions and activation captures', function () {
        var webExperiences = Breinify.plugins.webExperiences;
        var webExId = 'modify-content-url-condition-test';
        var versionId = 'url-condition-version';
        var module;
        var activitySpy;

        beforeEach(function () {
            module = {};
            activitySpy = createActivitySpy();
        });

        afterEach(function () {
            uiModifyContent.register({}, webExId, versionId, {actions: {}});
            activitySpy.restore();
        });

        function evaluate(settings, paths) {
            var runtime = uiModifyContent.register(module, webExId, versionId, {
                activationLogic: {paths: paths || [{type: 'ALL_PATHS'}]},
                conditionsGroups: [{actionGroup: 'matched', conditions: [{type: 'url', settings: settings}]}],
                actions: {matched: [], _default: []}
            });
            uiModifyContent.handle(webExId, versionId, {type: 'full-scan'});
            return runtime;
        }

        it('compares pathnames using scalar, array and regex operators', function () {
            var path = window.location.pathname;
            var cases = [
                {operator: 'EQUALS', value: path},
                {operator: 'NOT_EQUALS', value: path + '/different'},
                {operator: 'STARTS_WITH', value: '/'},
                {operator: 'ENDS_WITH', value: path.slice(-1)},
                {operator: 'CONTAINS', value: '/'},
                {operator: 'NOT_CONTAINS', value: 'not-a-real-path-fragment'},
                {operator: 'IS_ONE_OF', values: [path]},
                {operator: 'IS_NOT_ONE_OF', values: [path + '/different']},
                {operator: 'REGEX', value: '^/'}
            ];
            cases.forEach(function (settings) {
                settings.source = {type: 'PATHNAME'};
                expect(evaluate(settings).selectedGroupId).toBe('matched');
            });
        });

        it('evaluates nested condition types in any casing without rewriting the configuration', function () {
            [['any', 'all', 'url'], ['ANY', 'ALL', 'URL'], ['Any', 'aLl', 'Url']].forEach(function (types) {
                var leaf = {type: types[2], settings: {source: {type: 'PATHNAME'},
                    operator: 'EQUALS', value: window.location.pathname}};
                var expression = {type: types[0], settings: {conditions: [
                    {type: 'url', settings: {source: {type: 'PATHNAME'}, operator: 'REGEX', value: '(?!)'}},
                    {type: types[1], settings: {conditions: [leaf]}}
                ]}};
                var original = JSON.stringify(expression);
                var runtime = uiModifyContent.register(module, webExId, versionId, {
                    conditionsGroups: [{actionGroup: 'matched', conditions: [expression]}],
                    actions: {matched: [], _default: []}
                });
                uiModifyContent.handle(webExId, versionId, {type: 'full-scan'});
                expect(runtime.selectedGroupId).toBe('matched');
                expect(JSON.stringify(expression)).toBe(original);

                leaf.settings.value += '/different';
                uiModifyContent.handle(webExId, versionId, {type: 'full-scan'});
                expect(runtime.selectedGroupId).toBe('_default');
            });
        });

        it('supports case-insensitive capture comparisons and regex matching', function () {
            var paths = [{type: 'REGEX', value: '^(.*)$'}];
            var settings = {source: {type: 'ACTIVATION_GROUP', group: 1},
                operator: 'EQUALS', value: window.location.pathname.toUpperCase(), caseSensitive: false};
            expect(evaluate(settings, paths).selectedGroupId).toBe('matched');
            settings.operator = 'REGEX';
            settings.value = '^/';
            expect(evaluate(settings, paths).selectedGroupId).toBe('matched');
        });

        it('uses the first rule that passes both path and query checks', function () {
            var paths = [
                {type: 'REGEX', value: '^(.*)$', searchParameters: [
                    {param: '__missing_url_condition_test__', operator: 'equals', value: 'required'}
                ]},
                {type: 'REGEX', value: '^(/)(.*)$'}
            ];
            var settings = {source: {type: 'ACTIVATION_GROUP', group: 1}, operator: 'EQUALS', value: '/'};
            expect(evaluate(settings, paths).selectedGroupId).toBe('matched');
            expect(webExperiences.getActivationGroup(module, 1)).toBe('/');
        });

        it('does not match unavailable captures even with negative operators', function () {
            ['NOT_EQUALS', 'NOT_CONTAINS', 'IS_NOT_ONE_OF'].forEach(function (operator) {
                var settings = {source: {type: 'ACTIVATION_GROUP', group: 1},
                    operator: operator, value: 'anything', values: ['anything']};
                expect(evaluate(settings).selectedGroupId).toBe('_default');
                expect(evaluate(settings, [{type: 'REGEX', value: '^(missing)?/'}])
                    .selectedGroupId).toBe('_default');
                settings.source.group = 99;
                expect(evaluate(settings, [{type: 'REGEX', value: '^(.*)$'}])
                    .selectedGroupId).toBe('_default');
            });
        });

        it('preserves an existing empty-string capture', function () {
            var settings = {source: {type: 'ACTIVATION_GROUP', group: 1}, operator: 'EQUALS', value: ''};
            expect(evaluate(settings, [{type: 'REGEX', value: '^()'}]).selectedGroupId).toBe('matched');
        });

        it('invalidates captures on SPA navigation and on failed activation', function () {
            var config = {activationLogic: {paths: [{type: 'REGEX', value: '^(.*)$'}]}};
            var originalUrl = window.location.href;
            expect(webExperiences.checkActivationLogic(config, module)).toBe(true);
            try {
                window.history.replaceState({}, '', '#url-condition-new-page');
                expect(webExperiences.getActivationGroup(module, 1)).toBe(null);
                expect(webExperiences.checkActivationLogic(config, module)).toBe(true);
                expect(webExperiences.getActivationGroup(module, 1)).toBe(window.location.pathname);
                config.activationLogic.paths = [{type: 'REGEX', value: '(?!)'}];
                expect(webExperiences.checkActivationLogic(config, module)).toBe(false);
                expect(webExperiences.getActivationGroup(module, 1)).toBe(null);
            } finally {
                window.history.replaceState({}, '', originalUrl);
            }
        });

        it('compares decoded query values and distinguishes missing and empty parameters', function () {
            var originalUrl = window.location.href;
            try {
                window.history.replaceState({}, '', '?channel=Social+Media&empty=&encoded=%2B');
                var settings = {source: {type: 'QUERY_PARAMETER', name: 'channel'},
                    operator: 'EQUALS', value: 'social media', caseSensitive: false};
                expect(evaluate(settings).selectedGroupId).toBe('matched');
                settings.caseSensitive = true;
                expect(evaluate(settings).selectedGroupId).toBe('_default');
                settings.source.name = 'encoded';
                settings.value = '+';
                expect(evaluate(settings).selectedGroupId).toBe('matched');
                settings.source.name = 'empty';
                settings.value = '';
                expect(evaluate(settings).selectedGroupId).toBe('matched');
                settings.source.name = 'absent';
                expect(evaluate(settings).selectedGroupId).toBe('_default');
                settings.operator = 'NOT_EQUALS';
                expect(evaluate(settings).selectedGroupId).toBe('_default');
                settings.source.name = 'Channel';
                settings.caseSensitive = false;
                expect(evaluate(settings).selectedGroupId).toBe('_default');
            } finally {
                window.history.replaceState({}, '', originalUrl);
            }
        });

        it('checks all repeated values for negative comparisons and any for positive comparisons', function () {
            var originalUrl = window.location.href;
            try {
                window.history.replaceState({}, '', '?tag=red&tag=blue');
                var settings = {source: {type: 'QUERY_PARAMETER', name: 'tag'}, operator: 'EQUALS', value: 'blue'};
                expect(evaluate(settings).selectedGroupId).toBe('matched');
                settings.operator = 'IS_ONE_OF';
                settings.values = ['green', 'blue'];
                expect(evaluate(settings).selectedGroupId).toBe('matched');
                ['NOT_EQUALS', 'NOT_CONTAINS', 'IS_NOT_ONE_OF'].forEach(function (operator) {
                    settings.operator = operator;
                    expect(evaluate(settings).selectedGroupId).toBe('_default');
                });
                settings.values = ['green'];
                expect(evaluate(settings).selectedGroupId).toBe('matched');
                window.history.replaceState({}, '', '?tag=green');
                expect(evaluate(settings).selectedGroupId).toBe('_default');
            } finally {
                window.history.replaceState({}, '', originalUrl);
            }
        });

        it('does not evaluate or report an experience outside activation', function () {
            var settings = {source: {type: 'PATHNAME'}, operator: 'STARTS_WITH', value: '/'};
            evaluate(settings, [{type: 'REGEX', value: '(?!)'}]);
            expect(activitySpy.renderedElements.length).toBe(0);
        });
    });

    describe('trigger conditions', function () {
        var id;
        var sequence = 0;
        var runtime;
        var originalUrl;
        var originalLog;
        var originalService;
        var activitySpy;
        var messages;

        beforeEach(function () {
            id = 'trigger-condition-' + (++sequence);
            originalUrl = window.location.href;
            originalLog = console.log;
            originalService = Breinify.service;
            messages = [];
            console.log = function (message) { messages.push(message); };
            activitySpy = createActivitySpy();
            Breinify.plugins.trigger.init();
        });

        afterEach(function () {
            uiModifyContent.register({}, id, 'trigger-version', {actions: {}});
            window.history.replaceState({}, '', originalUrl);
            console.log = originalLog;
            Breinify.service = originalService;
            activitySpy.restore();
        });

        function trigger(frequency, name) {
            return {type: 'trigger', settings: {
                triggerName: name || 'show-animation', frequency: frequency || 'oncePerPage'
            }};
        }

        function path(matches) {
            return {type: 'url', settings: {source: {type: 'PATHNAME'},
                operator: 'REGEX', value: matches ? '^' : '(?!)'}};
        }

        function setup(conditions, module) {
            runtime = uiModifyContent.register(module || {}, id, 'trigger-version', {
                conditionsGroups: [{actionGroup: 'matched', conditions: conditions}],
                actions: {
                    matched: [{type: 'writeToConsole', settings: {message: 'matched'}}],
                    _default: [{type: 'writeToConsole', settings: {message: 'fallback'}}]
                }
            });
            evaluate();
        }

        function evaluate() {
            uiModifyContent.handle(id, 'trigger-version', {});
        }

        function call(name, scope) {
            return Breinify.plugins.webExperiences.trigger(scope || id, name || 'show-animation');
        }

        it('blocks fallback only while the trigger could change the result', function () {
            var other = path(false);
            setup([trigger(), other]);
            expect(runtime.selectedGroupId).toBe('_default');
            expect(runtime.conditionsPending).toBe(false);
            other.settings.value = '^';
            evaluate();
            expect(runtime.conditionsPending).toBe(true);
            expect(runtime.selectedGroupId).toBeNull();
            expect(messages).toEqual(['fallback']);
            call();
            expect(runtime.selectedGroupId).toBe('matched');
            expect(messages).toEqual(['fallback', 'matched']);
        });

        it('lets true dominate pending in any and false dominate pending in nested all', function () {
            var expression = {type: 'any', settings: {conditions: [
                {type: 'all', settings: {conditions: [trigger(), path(false)]}}, path(true)
            ]}};
            setup([expression]);
            expect(runtime.selectedGroupId).toBe('matched');
            expect(runtime.conditionsPending).toBe(false);
            call();
            expect(messages).toEqual(['matched']);
        });

        it('matches exact names in the owning experience scope', function () {
            setup([trigger()]);
            call('show-animation', id + '-other');
            call('Show-animation');
            expect(runtime.conditionsPending).toBe(true);
            expect(messages.length).toBe(0);
            expect(call()).toBe(true);
            expect(messages).toEqual(['matched']);
            expect(Breinify.plugins.webExperiences.trigger('', 'show-animation')).toBe(false);
            expect(Breinify.plugins.webExperiences.trigger(id, ' show-animation')).toBe(false);
        });

        it('remembers calls made before registration and does not recognize a second once-per-page call', function () {
            call();
            call();
            setup([trigger()]);
            expect(messages).toEqual(['matched']);
            call();
            evaluate();
            expect(messages).toEqual(['matched']);
        });

        it('counts the first call even when another condition is false and retains it for later evaluation', function () {
            var other = path(false);
            setup([trigger(), other]);
            call();
            other.settings.value = '^';
            call();
            expect(messages).toEqual(['fallback']);
            evaluate();
            expect(messages).toEqual(['fallback', 'matched']);
        });

        it('rearms a matching group for each recognized call without replaying on ordinary reevaluation', function () {
            setup([trigger('everyTriggerCall')]);
            call();
            evaluate();
            call();
            evaluate();
            expect(messages).toEqual(['matched', 'matched']);
        });

        it('does not rearm fallback or a branch where the called trigger did not contribute', function () {
            var other = path(false);
            setup([trigger('everyTriggerCall'), other]);
            call();
            call();
            expect(messages).toEqual(['fallback']);
            other.settings.value = '^';
            evaluate();
            expect(messages).toEqual(['fallback', 'matched']);
            call();
            expect(messages).toEqual(['fallback', 'matched', 'matched']);
        });

        it('resets on changed URLs and returning visits, but not history state changes at the same URL', function () {
            setup([trigger()]);
            call();
            window.history.replaceState({updated: true}, '', originalUrl);
            call();
            expect(messages).toEqual(['matched']);
            window.history.pushState({}, '', '#trigger-new-page');
            evaluate();
            expect(runtime.conditionsPending).toBe(true);
            call();
            expect(messages).toEqual(['matched', 'matched']);
            window.history.replaceState({}, '', originalUrl);
            evaluate();
            expect(runtime.conditionsPending).toBe(true);
            call();
            expect(messages).toEqual(['matched', 'matched', 'matched']);
        });

        it('isolates hash changes from shared observers and unrelated experiences and deduplicates notifications',
            function () {
                var observerId = id + '-shared-observer';
                var unrelatedId = id + '-unrelated';
                var sharedCalls = 0;
                var unrelatedCalls = 0;
                var triggerChanges = 0;
                setup([trigger()]);
                call();
                var onChange = runtime.module.onChange;
                runtime.module.onChange = function (data) {
                    triggerChanges++;
                    return onChange(data);
                };
                var unrelated = uiModifyContent.register({}, unrelatedId, 'trigger-version', {actions: {}});
                unrelated.module.onChange = function () { unrelatedCalls++; };
                Breinify.plugins.trigger.addUrlChangeObserver(observerId, function () { sharedCalls++; });
                try {
                    // bypass the history wrapper to isolate delivery of the hash event itself
                    History.prototype.replaceState.call(window.history, {}, '', '#isolated-trigger-hash');
                    window.dispatchEvent(new Event('hashchange'));
                    expect(triggerChanges).toBe(1);
                    expect(runtime.conditionsPending).toBe(true);
                    expect(sharedCalls).toBe(0);
                    expect(unrelatedCalls).toBe(0);

                    window.dispatchEvent(new Event('hashchange'));
                    expect(triggerChanges).toBe(1);
                    window.dispatchEvent(new Event('popstate'));
                    window.dispatchEvent(new Event('hashchange'));
                    expect(triggerChanges).toBe(1);
                    expect(sharedCalls).toBe(1);
                    expect(unrelatedCalls).toBe(0);
                    call();
                    expect(messages).toEqual(['matched', 'matched']);
                } finally {
                    Breinify.plugins.trigger.removeUrlChangeObserver(observerId);
                    uiModifyContent.register({}, unrelatedId, 'trigger-version', {actions: {}});
                }
            });

        it('records calls while inactive without executing until the experience becomes active', function () {
            var active = false;
            setup([trigger()], {isValidPage: function () { return active; }});
            call();
            expect(messages.length).toBe(0);
            active = true;
            evaluate();
            expect(messages).toEqual(['matched']);
        });

        it('retains a call while weather is loading and selects only after the backend result arrives', function (done) {
            var complete;
            var weather = {type: 'decision', settings: {refId: id + '-weather'}};
            Breinify.service = function (service, payload, callback) { complete = callback; };
            runtime = uiModifyContent.register({}, id, 'trigger-version', {
                conditionsGroups: [{actionGroup: 'matched', conditions: [trigger(), weather]}],
                decision: {required: true, configurationId: id, conditions: [weather]},
                actions: {
                    matched: [{type: 'writeToConsole', settings: {message: 'matched'}}],
                    _default: [{type: 'writeToConsole', settings: {message: 'fallback'}}]
                }
            });
            evaluate();
            call();
            expect(messages.length).toBe(0);
            setTimeout(function () {
                complete(null, null, {decisions: [{configurationId: id, matched: true,
                    conditions: [{refId: id + '-weather', matched: true,
                        cache: {scope: 'PAGE', maxAgeSeconds: 0}}]}]});
                expect(runtime.selectedGroupId).toBe('matched');
                expect(messages).toEqual(['matched']);
                call();
                expect(messages).toEqual(['matched']);
                done();
            }, 10);
        });

        it('does not let pending higher-priority trigger groups fall through to later matching groups', function () {
            setup([trigger()]);
            runtime.config.conditionsGroups.push({actionGroup: '_default', conditions: [path(true)]});
            evaluate();
            expect(runtime.conditionsPending).toBe(true);
            expect(messages.length).toBe(0);
            runtime.config.conditionsGroups[0].conditions.push(path(false));
            evaluate();
            expect(runtime.selectedGroupId).toBe('_default');
            expect(messages).toEqual(['fallback']);
        });
    });

    describe('feature conditions', function () {
        var storage;
        var runtime;
        var module;
        var activitySpy;
        var featureKey;
        var sequence = 0;
        var webExId = 'modify-content-feature-condition-test';

        beforeEach(function () {
            storage = Breinify.plugins.featureStorage;
            module = {isValidPage: function () { return true; }};
            activitySpy = createActivitySpy();
            sequence += 1;
            featureKey = '__br_feature.test-feature-' + sequence;
        });

        afterEach(function () {
            // replacing the runtime must dispose its observation subscription and outstanding timers
            uiModifyContent.register({}, webExId, 'feature-version', {actions: {}});
            storage.remove(featureKey);
            storage.flush();
            activitySpy.restore();
        });

        function setup(type, settings, expression) {
            storage.defineFeature(featureKey, {valueType: type, persistence: {enabled: false}});
            var feature = {type: 'feature', settings: $.extend({
                featureId: featureKey.substring('__br_feature.'.length),
                operator: 'EQUALS', value: '1234', waitTimeoutInMs: 3000
            }, settings)};
            runtime = uiModifyContent.register(module, webExId, 'feature-version', {
                conditionsGroups: [{actionGroup: 'matched', conditions: expression ? expression(feature) : [feature]}],
                actions: {matched: [], _default: []}
            });
            return feature;
        }

        function evaluate() {
            uiModifyContent.handle(webExId, 'feature-version', {type: 'full-scan'});
        }

        it('defers default and renderedElement reporting until a feature arrives', function () {
            setup('STRING');
            evaluate();
            expect(runtime.conditionsPending).toBe(true);
            expect(activitySpy.renderedElements.length).toBe(0);
            storage.set(featureKey, '1234');
            storage.flush();
            expect(runtime.selectedGroupId).toBe('matched');
            expect(runtime.conditionsPending).toBe(false);
            expect(activitySpy.renderedElements.length).toBe(1);
        });

        it('observes late features inside uppercase and mixed-case nested conditions', function () {
            setup('STRING', {}, function (feature) {
                feature.type = 'FEATURE';
                return [{type: 'ANY', settings: {conditions: [
                    {type: 'All', settings: {conditions: [feature]}}
                ]}}];
            });
            evaluate();
            expect(runtime.conditionsPending).toBe(true);
            expect(typeof runtime.disposeFeatureListener).toBe('function');
            storage.set(featureKey, '1234');
            storage.flush();
            expect(runtime.selectedGroupId).toBe('matched');
            expect(runtime.conditionsPending).toBe(false);
        });

        it('locks a timed-out STOP condition, but allows CONTINUE to match a late value', function () {
            setup('STRING');
            evaluate();
            runtime.featureLifecycle.startedAt -= 4000;
            evaluate();
            expect(runtime.selectedGroupId).toBe('_default');
            storage.set(featureKey, '1234');
            storage.flush();
            expect(runtime.selectedGroupId).toBe('_default');

            storage.remove(featureKey);
            setup('STRING', {afterTimeout: 'CONTINUE'});
            evaluate();
            runtime.featureLifecycle.startedAt -= 4000;
            evaluate();
            expect(runtime.selectedGroupId).toBe('_default');
            storage.set(featureKey, '1234');
            storage.flush();
            expect(runtime.selectedGroupId).toBe('matched');
        });

        it('does not consider initial discovery to be CHANGE, but does react to a changed value', function () {
            setup('STRING', {source: 'CHANGE'});
            storage.set(featureKey, '1234');
            evaluate();
            expect(runtime.conditionsPending).toBe(true);
            storage.set(featureKey, '5678');
            storage.flush();
            expect(runtime.selectedGroupId).toBe('_default');
            storage.set(featureKey, '1234');
            storage.flush();
            expect(runtime.selectedGroupId).toBe('matched');
        });

        it('requires a fresh PAGE observation, including an unchanged value after SPA navigation', function () {
            setup('STRING', {source: 'PAGE'});
            storage.set(featureKey, '1234');
            evaluate();
            expect(runtime.selectedGroupId).toBe('matched');
            var originalUrl = window.location.href;
            try {
                window.history.replaceState({}, '', '#feature-page-observation');
                evaluate();
                expect(runtime.conditionsPending).toBe(true);
                storage.set(featureKey, '1234');
                storage.flush();
                expect(runtime.selectedGroupId).toBe('matched');
            } finally {
                window.history.replaceState({}, '', originalUrl);
            }
        });

        it('lets a definitive false dominate pending in all, and true dominate pending in any', function () {
            setup('STRING', {}, function (feature) {
                return [{type: 'all', settings: {conditions: [
                    feature, {type: 'random', randomRefId: 'feature-all-never', settings: {probability: 0}}
                ]}}];
            });
            evaluate();
            expect(runtime.conditionsPending).toBe(false);
            expect(runtime.selectedGroupId).toBe('_default');
            setup('STRING', {}, function (feature) {
                return [{type: 'any', settings: {conditions: [
                    feature, {type: 'random', randomRefId: 'feature-any-always', settings: {probability: 1}}
                ]}}];
            });
            evaluate();
            expect(runtime.conditionsPending).toBe(false);
            expect(runtime.selectedGroupId).toBe('matched');
        });

        it('compares numbers without lexicographic ordering and keeps zero available', function () {
            setup('FLOATING_NUMBER', {operator: 'BETWEEN', from: 0, to: 10});
            storage.set(featureKey, '0');
            evaluate();
            expect(storage.get(featureKey)).toBe(0);
            expect(runtime.selectedGroupId).toBe('matched');
            storage.set(featureKey, '10');
            storage.flush();
            expect(runtime.selectedGroupId).toBe('_default');
            storage.set(featureKey, 'not a number');
            expect(storage.get(featureKey)).toBeNull();
        });

        it('holds an earlier possible group instead of executing a later matching group', function () {
            setup('STRING');
            runtime.config.conditionsGroups.push({
                actionGroup: 'later',
                conditions: [{type: 'random', randomRefId: 'feature-later-always', settings: {probability: 1}}]
            });
            runtime.config.actions.later = [];
            evaluate();
            expect(runtime.conditionsPending).toBe(true);
            expect(runtime.selectedGroupId).toBeNull();
            runtime.featureLifecycle.startedAt -= 4000;
            evaluate();
            expect(runtime.selectedGroupId).toBe('later');
        });

        it('does not start a wait or execute actions while page activation is false', function () {
            setup('STRING');
            module.isValidPage = function () { return false; };
            evaluate();
            expect(runtime.featureLifecycle).toBeUndefined();
            expect(activitySpy.renderedElements.length).toBe(0);
            storage.set(featureKey, '1234');
            storage.flush();
            expect(activitySpy.renderedElements.length).toBe(0);
            module.isValidPage = function () { return true; };
            evaluate();
            expect(runtime.selectedGroupId).toBe('matched');
        });

        it('enforces integer values and does not convert empty text or booleans into numbers', function () {
            setup('INTEGER', {value: 12});
            ['12.5', '', true, Infinity, '9007199254740992'].forEach(function (value) {
                storage.set(featureKey, value);
                expect(storage.get(featureKey)).toBeNull();
            });
            storage.set(featureKey, '12');
            evaluate();
            expect(runtime.selectedGroupId).toBe('matched');
        });

        it('supports false and empty text as available values', function () {
            setup('BOOLEAN', {value: false});
            storage.set(featureKey, false);
            evaluate();
            expect(runtime.selectedGroupId).toBe('matched');
            setup('STRING', {value: ''});
            storage.set(featureKey, '');
            evaluate();
            expect(runtime.selectedGroupId).toBe('matched');
        });

        it('applies case sensitivity to every string-array membership comparison', function () {
            setup('STRING_ARRAY', {operator: 'CONTAINS_ALL', values: ['Blue', '9'], caseSensitive: false});
            storage.set(featureKey, ['BLUE', '9', 'extra']);
            evaluate();
            expect(runtime.selectedGroupId).toBe('matched');
            setup('STRING_ARRAY', {operator: 'CONTAINS_ALL', values: ['Blue', '9'], caseSensitive: true});
            evaluate();
            expect(runtime.selectedGroupId).toBe('_default');
        });

        it('delivers the original change before observation callbacks rewrite the feature', function () {
            setup('STRING');
            storage.flush();
            var events = [];
            var rewritten = false;
            var globalListener = function (payload) {
                if (payload.changed[featureKey]) events.push('global:' + payload.changed[featureKey].newValue);
            };
            var featureListener = function (payload) {
                events.push('feature:' + payload.changed[featureKey].newValue);
            };
            storage.onChange(globalListener);
            storage.onFeatureChange(featureKey, featureListener);
            var dispose = storage.onFeatureObservation(featureKey, function () {
                events.push('observation');
                if (!rewritten) {
                    rewritten = true;
                    storage.set(featureKey, 'second');
                }
            });
            try {
                storage.set(featureKey, 'first');
                storage.flush();
                expect(events).toEqual(['global:first', 'feature:first', 'observation']);
                expect(storage.get(featureKey)).toBe('second');
                storage.flush();
                expect(events).toEqual([
                    'global:first', 'feature:first', 'observation',
                    'global:second', 'feature:second', 'observation'
                ]);
            } finally {
                dispose();
                storage.offChange(globalListener);
                storage.offFeatureChange(featureKey, featureListener);
            }
        });

        it('preserves the original change and queues removal performed by an observation callback', function () {
            setup('STRING');
            storage.flush();
            var changes = [];
            var removed = false;
            var listener = function (payload) {
                changes.push(payload.changed[featureKey]);
            };
            storage.onFeatureChange(featureKey, listener);
            var dispose = storage.onFeatureObservation(featureKey, function () {
                if (!removed) {
                    removed = true;
                    storage.remove(featureKey);
                }
            });
            try {
                storage.set(featureKey, 'first');
                storage.flush();
                expect(changes.length).toBe(1);
                expect(changes[0].newValue).toBe('first');
                expect(storage.get(featureKey)).toBeNull();
                storage.flush();
                expect(changes.length).toBe(2);
                expect(changes[1].oldValue).toBe('first');
                expect(changes[1].newValue).toBeNull();
                expect(changes[1].additional.removed).toBe(true);
            } finally {
                dispose();
                storage.offFeatureChange(featureKey, listener);
            }
        });

        it('defers recursive flushes so callback writes do not interrupt the original batch', function () {
            setup('STRING');
            storage.flush();
            var events = [];
            var updated = false;
            var globalListener = function (payload) {
                if (!payload.changed[featureKey]) return;
                events.push('global:' + payload.changed[featureKey].newValue);
                if (!updated) {
                    updated = true;
                    storage.set(featureKey, 'second');
                    storage.flush();
                }
            };
            var featureListener = function (payload) {
                events.push('feature:' + payload.changed[featureKey].newValue);
            };
            storage.onChange(globalListener);
            storage.onFeatureChange(featureKey, featureListener);
            var dispose = storage.onFeatureObservation(featureKey, function () {
                events.push('observation');
                storage.flush();
            });
            try {
                storage.set(featureKey, 'first');
                storage.flush();
                expect(events).toEqual(['global:first', 'feature:first', 'observation']);
                storage.flush();
                expect(events).toEqual([
                    'global:first', 'feature:first', 'observation',
                    'global:second', 'feature:second', 'observation'
                ]);
            } finally {
                dispose();
                storage.offChange(globalListener);
                storage.offFeatureChange(featureKey, featureListener);
            }
        });

        it('notifies removals while unchanged observations do not generate change events', function () {
            setup('STRING');
            storage.set(featureKey, '1234');
            storage.flush();
            var changes = 0;
            var listener = function () { changes += 1; };
            storage.onFeatureChange(featureKey, listener);
            try {
                storage.set(featureKey, '1234');
                storage.flush();
                expect(changes).toBe(0);
                storage.remove(featureKey);
                storage.flush();
                expect(changes).toBe(1);
                expect(runtime.conditionsPending).toBe(true);
            } finally {
                storage.offFeatureChange(featureKey, listener);
            }
        });
    });

    //noinspection JSUnresolvedVariable
    var uiModifyContent = window['Breinify'].plugins.uiModifyContent;

    function createActivitySpy() {
        var activities = Breinify.plugins.activities;
        var createdActivities = false;
        if (!activities) {
            activities = {};
            Breinify.plugins.activities = activities;
            createdActivities = true;
        }

        var originalGeneric = activities.generic;
        var renderedElements = [];
        activities.generic = function (type, user, tags) {
            renderedElements.push({type: type, user: user, tags: tags});
        };

        return {
            renderedElements: renderedElements,
            restore: function () {
                if (createdActivities) {
                    delete Breinify.plugins.activities;
                } else {
                    activities.generic = originalGeneric;
                }
            }
        };
    }

    function createPlacementAction(selector, positionId) {
        var settings = {
            selector: selector,
            operation: 'append',
            webExperienceId: 'target-web-experience'
        };
        if (positionId !== null) {
            settings.positionId = positionId || 'target-position';
        }

        return {
            type: 'placeWebExperience',
            settings: settings
        };
    }

    function createWriteToConsoleAction() {
        return {
            type: 'writeToConsole',
            settings: {
                message: 'Modify Content activity test'
            }
        };
    }

    function expectRenderedElement(activity, rendered, status, action) {
        expect(activity.type).toBe('renderedElement');
        expect(activity.tags.widgetType).toBe('modifyContent');
        expect(activity.tags.campaignWebExId).toBe('version-1');
        expect(activity.tags.rendered).toBe(rendered);
        expect(activity.tags.status).toBe(status);
        expect(activity.tags.actionType).toBe('executed');
        expect(activity.tags.action).toBe(action);
        expect(activity.tags.widget).toBeUndefined();
    }

    it('tracks a successful default action only once per page without split-test data', function () {
        var $fixture = $('<div class="modify-content-placement-target"></div>').appendTo('body');
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-default-activity-test';
        var webExperienceVersionId = 'version-1';

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {
                _default: [createPlacementAction('.modify-content-placement-target', null)]
            }
        });

        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        var $container = $fixture.children('[data-br-webexpid="target-web-experience"]');
        expect($container.length).toBe(1);
        expect($container.attr('data-br-webexppos')).toBeUndefined();
        expect(activitySpy.renderedElements.length).toBe(1);
        expectRenderedElement(activitySpy.renderedElements[0], true, 200, '_default');
        expect(activitySpy.renderedElements[0].tags.groupType).toBe('none');
        expect(activitySpy.renderedElements[0].tags.splitTest).toBeNull();
        expect(activitySpy.renderedElements[0].tags.group).toBeNull();

        activitySpy.restore();
        $fixture.remove();
    });

    it('keeps a random condition result stable for the current browser session', function () {
        var $fixture = $('<div class="modify-content-random-target"></div>').appendTo('body');
        var webExperienceId = 'modify-content-random-session-test';
        var webExperienceVersionId = 'version-1';
        var conditionReference = 'random-session-condition';
        var configuration = {
            actions: {
                random: [createPlacementAction('.modify-content-random-target', null)]
            },
            conditionsGroups: [{
                actionGroup: 'random',
                conditions: [{
                    type: 'random',
                    randomRefId: conditionReference,
                    settings: {
                        probability: 1
                    }
                }]
            }]
        };

        window.sessionStorage.removeItem('br::wemc::random');
        uiModifyContent.register({}, webExperienceId, webExperienceVersionId, configuration);
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        expect($fixture.children('[data-br-webexpid="target-web-experience"]').length).toBe(1);

        $fixture.empty();
        configuration.conditionsGroups[0].conditions[0].settings.probability = 0;
        uiModifyContent.register({}, webExperienceId, webExperienceVersionId, configuration);
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        expect($fixture.children('[data-br-webexpid="target-web-experience"]').length).toBe(1);

        window.sessionStorage.removeItem('br::wemc::random');
        $fixture.remove();
    });

    it('does not select a random condition whose probability is zero', function () {
        var $fixture = $('<div class="modify-content-random-zero-target"></div>').appendTo('body');
        var webExperienceId = 'modify-content-random-zero-test';
        var webExperienceVersionId = 'version-1';

        uiModifyContent.register({}, webExperienceId, webExperienceVersionId, {
            actions: {
                random: [createPlacementAction('.modify-content-random-zero-target', null)]
            },
            conditionsGroups: [{
                actionGroup: 'random',
                conditions: [{
                    type: 'random',
                    randomRefId: 'random-zero-condition',
                    settings: {
                        probability: 0
                    }
                }]
            }]
        });
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        expect($fixture.children('[data-br-webexpid="target-web-experience"]').length).toBe(0);

        $fixture.remove();
    });

    it('sends the applied preview ID only for the preview experience in a decision batch', function (done) {
        const originalService = Breinify.service;
        const webExperiences = Breinify.plugins.webExperiences;
        const originalPreviews = webExperiences._previews;
        const previewId = 'aa46bd74-c6e0-4278-bb11-25edd430961f';
        const previewExperienceId = 'decision-preview-experience';
        const normalExperienceId = 'decision-normal-experience';
        webExperiences._previews = {[previewExperienceId]: {previewId: previewId}};
        Breinify.service = function (service, payload, callback) {
            try {
                expect(service).toBe('webExperienceDecision');
                const preview = payload.webExperiences.find(entry => entry.webExperienceId === previewExperienceId);
                const normal = payload.webExperiences.find(entry => entry.webExperienceId === normalExperienceId);
                expect(preview.previewId).toBe(previewId);
                expect(preview.webExperienceVersionId).toBe('temporary-preview-version');
                expect(normal.previewId).toBeUndefined();
                callback(null, null, {decisions: []});
            } finally {
                Breinify.service = originalService;
                if (typeof originalPreviews === 'undefined') {
                    delete webExperiences._previews;
                } else {
                    webExperiences._previews = originalPreviews;
                }
                done();
            }
        };
        const register = (id, version) => {
            const config = {actions: {}, decision: {required: true, pageEvaluation: true, configurationId: id}};
            uiModifyContent.register({}, id, version, config);
            uiModifyContent.handle(id, version, {type: 'full-scan'});
        };
        register(previewExperienceId, 'temporary-preview-version');
        register(normalExperienceId, 'normal-version');
    });

    it('tracks a successful selected condition group with non-control split-test data', function (done) {
        var $fixture = $('<div class="modify-content-selected-activity-target"></div>').appendTo('body');
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-selected-activity-test';
        var webExperienceVersionId = 'version-1';
        var originalService = Breinify.service;

        Breinify.service = function (service, payload, callback) {
            expect(service).toBe('webExperienceDecision');
            expect(payload.webExperiences[0].conditionRefs).toEqual(['selected-ref']);
            callback(null, null, {
                decisions: [{
                    configurationId: 'selected-activity',
                    matched: true,
                    conditions: [{refId: 'selected-ref', matched: true}],
                    additionalData: {
                        splitTestData: {
                            testName: 'Modify Content Test',
                            selectedInstance: 'instance-1',
                            groupDecision: 'Breinify',
                            isControlGroup: false,
                            usedEnforcedGroup: false
                        }
                    }
                }]
            });
        };

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {
                selected: [createPlacementAction('.modify-content-selected-activity-target')]
            },
            conditionsGroups: [{
                actionGroup: 'selected',
                conditions: [{
                    type: 'decision',
                    settings: {refId: 'selected-ref'}
                }]
            }],
            decision: {
                required: true,
                pageEvaluation: true,
                service: 'webExperienceDecision',
                configurationId: 'selected-activity',
                conditions: [{
                    type: 'decision',
                    settings: {refId: 'selected-ref'}
                }]
            }
        });

        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        setTimeout(function () {
            expect($fixture.children('[data-br-webexpid="target-web-experience"]').length).toBe(1);
            expect(activitySpy.renderedElements.length).toBe(1);
            expectRenderedElement(activitySpy.renderedElements[0], true, 200, 'selected');
            expect(activitySpy.renderedElements[0].tags.groupType).toBe('test');
            expect(activitySpy.renderedElements[0].tags.splitTest).toBe('Modify Content Test (instance-1)');
            expect(activitySpy.renderedElements[0].tags.group).toBe('Breinify');

            Breinify.service = originalService;
            activitySpy.restore();
            $fixture.remove();
            done();
        }, 10);
    });

    it('tracks a split-test control assignment without selecting an action group', function (done) {
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-split-test-control';
        var webExperienceVersionId = 'version-1';
        var originalService = Breinify.service;
        var originalReplaceSplitTestData = Breinify.UTL.user.replaceSplitTestData;
        var storedSplitTestData = null;

        Breinify.UTL.user.replaceSplitTestData = function (testName, splitTestData) {
            storedSplitTestData = {testName: testName, splitTestData: splitTestData};
        };
        Breinify.service = function (service, payload, callback) {
            expect(service).toBe('webExperienceDecision');
            expect(payload.webExperiences[0].conditionRefs).toEqual([]);
            callback(null, null, {
                decisions: [{
                    configurationId: 'split-test-control',
                    matched: false,
                    conditions: [],
                    additionalData: {
                        splitTestData: {
                            testName: 'Test: Modify Content',
                            groupDecision: 'Control',
                            isControlGroup: true,
                            usedEnforcedGroup: false
                        }
                    }
                }]
            });
        };

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {
                _default: [createWriteToConsoleAction()]
            },
            decision: {
                required: true,
                pageEvaluation: true,
                service: 'webExperienceDecision',
                configurationId: 'split-test-control',
                conditions: []
            }
        });

        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        setTimeout(function () {
            expect(storedSplitTestData.testName).toBe('Test: Modify Content');
            expect(storedSplitTestData.splitTestData.groupDecision).toBe('Control');
            expect(storedSplitTestData.splitTestData.preview).toBeUndefined();
            expect(storedSplitTestData.splitTestData.expiresAt).toBeUndefined();
            expect(activitySpy.renderedElements.length).toBe(1);
            expectRenderedElement(activitySpy.renderedElements[0], false, 13000, undefined);
            expect(activitySpy.renderedElements[0].tags.groupType).toBe('control');
            expect(activitySpy.renderedElements[0].tags.splitTest).toBe('Test: Modify Content');
            expect(activitySpy.renderedElements[0].tags.group).toBe('Control');

            Breinify.service = originalService;
            Breinify.UTL.user.replaceSplitTestData = originalReplaceSplitTestData;
            activitySpy.restore();
            done();
        }, 10);
    });

    it('stores preview assignment expiry using the preview state sent in the request', function (done) {
        var activitySpy = createActivitySpy();
        var originalService = Breinify.service;
        var originalWebExperiences = Breinify.plugins.webExperiences;
        var originalReplace = Breinify.UTL.user.replaceSplitTestData;
        var stored = null;
        var webExId = 'modify-content-preview-expiry';
        var startedAt = Date.now();
        var responseData = {testName: 'preview-expiry', groupDecision: 'Control', isControlGroup: true};
        Breinify.plugins.webExperiences = {_previews: {}};
        Breinify.plugins.webExperiences._previews[webExId] = {previewId: 'preview-expiry-id'};
        Breinify.UTL.user.replaceSplitTestData = function (name, data) { stored = data; };
        Breinify.service = function (service, payload, callback) {
            expect(payload.webExperiences[0].previewId).toBe('preview-expiry-id');
            // simulate the preview closing while the request is in flight
            delete Breinify.plugins.webExperiences._previews[webExId];
            callback(null, null, {decisions: [{
                configurationId: 'preview-expiry', matched: false, conditions: [],
                additionalData: {splitTestData: responseData}
            }]});
        };
        uiModifyContent.register({}, webExId, 'preview-version', {
            actions: {},
            decision: {required: true, pageEvaluation: true, service: 'webExperienceDecision',
                configurationId: 'preview-expiry', conditions: []}
        });
        uiModifyContent.handle(webExId, 'preview-version', {type: 'full-scan'});
        setTimeout(function () {
            try {
                expect(stored.preview).toBe(true);
                expect(stored.expiresAt).not.toBeLessThan(startedAt + 1800000);
                expect(stored.expiresAt).not.toBeGreaterThan(Date.now() + 1800000);
                expect(responseData.preview).toBeUndefined();
                expect(responseData.expiresAt).toBeUndefined();
            } finally {
                Breinify.service = originalService;
                Breinify.plugins.webExperiences = originalWebExperiences;
                Breinify.UTL.user.replaceSplitTestData = originalReplace;
                activitySpy.restore();
                done();
            }
        }, 10);
    });

    it('tracks a successful failure action group when the decision request fails', function (done) {
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-decision-failure';
        var webExperienceVersionId = 'version-1';
        var originalService = Breinify.service;
        var originalLog = console.log;

        console.log = function () {
        };
        Breinify.service = function (service, payload, callback) {
            callback(new Error('Decision unavailable'), null, null);
        };

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {
                _failure: [createWriteToConsoleAction()]
            },
            decision: {
                required: true,
                service: 'webExperienceDecision',
                configurationId: 'decision-failure',
                conditions: [{
                    type: 'decision',
                    settings: {refId: 'decision-failure-ref'}
                }]
            }
        });

        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        setTimeout(function () {
            expect(activitySpy.renderedElements.length).toBe(1);
            expectRenderedElement(activitySpy.renderedElements[0], true, 200, '_failure');

            Breinify.service = originalService;
            console.log = originalLog;
            activitySpy.restore();
            done();
        }, 10);
    });

    it('tracks a successful default fallback as the logical failure action group', function (done) {
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-decision-default-fallback';
        var webExperienceVersionId = 'version-1';
        var originalService = Breinify.service;
        var originalLog = console.log;

        console.log = function () {
        };
        Breinify.service = function (service, payload, callback) {
            callback(new Error('Decision unavailable'), null, null);
        };

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {
                _default: [createWriteToConsoleAction()]
            },
            decision: {
                required: true,
                service: 'webExperienceDecision',
                configurationId: 'decision-default-fallback',
                conditions: [{
                    type: 'decision',
                    settings: {refId: 'decision-default-fallback-ref'}
                }]
            }
        });

        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        setTimeout(function () {
            expect(activitySpy.renderedElements.length).toBe(1);
            expectRenderedElement(activitySpy.renderedElements[0], true, 200, '_failure');

            Breinify.service = originalService;
            console.log = originalLog;
            activitySpy.restore();
            done();
        }, 10);
    });

    it('tracks an unavailable failure fallback as intentionally not rendered', function (done) {
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-empty-decision-fallback';
        var webExperienceVersionId = 'version-1';
        var originalService = Breinify.service;

        Breinify.service = function (service, payload, callback) {
            callback(new Error('Decision unavailable'), null, null);
        };

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {},
            decision: {
                required: true,
                service: 'webExperienceDecision',
                configurationId: 'empty-decision-fallback',
                conditions: [{
                    type: 'decision',
                    settings: {refId: 'empty-decision-fallback-ref'}
                }]
            }
        });

        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        setTimeout(function () {
            expect(activitySpy.renderedElements.length).toBe(1);
            expectRenderedElement(activitySpy.renderedElements[0], false, 13000, '_failure');

            Breinify.service = originalService;
            activitySpy.restore();
            done();
        }, 10);
    });

    it('tracks a normal no-action result when no default action group is configured', function () {
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-no-default';
        var webExperienceVersionId = 'version-1';

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {actions: {}});
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        expect(activitySpy.renderedElements.length).toBe(1);
        expectRenderedElement(activitySpy.renderedElements[0], false, 13000, undefined);
        activitySpy.restore();
    });

    it('tracks an empty default action group as intentionally not rendered', function () {
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-empty-default';
        var webExperienceVersionId = 'version-1';

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {actions: {_default: []}});
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        expect(activitySpy.renderedElements.length).toBe(1);
        expectRenderedElement(activitySpy.renderedElements[0], false, 13000, '_default');
        activitySpy.restore();
    });

    it('tracks an unavailable action target as intentionally not rendered', function () {
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-unavailable-target';
        var webExperienceVersionId = 'version-1';

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {
                _default: [createPlacementAction('.unavailable-modify-content-target')]
            }
        });
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        expect(activitySpy.renderedElements.length).toBe(1);
        expectRenderedElement(activitySpy.renderedElements[0], false, 13000, '_default');
        activitySpy.restore();
    });

    it('tracks an invalid configuration without attempting an action', function () {
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-invalid-configuration';
        var webExperienceVersionId = 'version-1';

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {
                _default: [{
                    type: 'unknownAction',
                    settings: {}
                }]
            }
        });
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        expect(activitySpy.renderedElements.length).toBe(1);
        expectRenderedElement(activitySpy.renderedElements[0], false, 13200, undefined);
        activitySpy.restore();
    });

    it('tracks an unexpected action failure as not rendered', function () {
        var activitySpy = createActivitySpy();
        var module = {};
        var webExperienceId = 'modify-content-action-failure';
        var webExperienceVersionId = 'version-1';
        var originalLog = console.log;

        console.log = function () {
            throw new Error('Console unavailable');
        };
        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {
                _default: [createWriteToConsoleAction()]
            }
        });
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        expect(activitySpy.renderedElements.length).toBe(1);
        expectRenderedElement(activitySpy.renderedElements[0], false, 500, '_default');
        console.log = originalLog;
        activitySpy.restore();
    });
});
