"use strict";

describe('UiModifyContent', function () {

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

        it('does not evaluate or report an experience outside activation', function () {
            var settings = {source: {type: 'PATHNAME'}, operator: 'STARTS_WITH', value: '/'};
            evaluate(settings, [{type: 'REGEX', value: '(?!)'}]);
            expect(activitySpy.renderedElements.length).toBe(0);
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
