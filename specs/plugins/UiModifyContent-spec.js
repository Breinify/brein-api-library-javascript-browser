"use strict";

describe('UiModifyContent', function () {

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

    function createPlacementAction(selector) {
        return {
            type: 'placeWebExperience',
            settings: {
                selector: selector,
                operation: 'append',
                webExperienceId: 'target-web-experience',
                positionId: 'target-position'
            }
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
                _default: [createPlacementAction('.modify-content-placement-target')]
            }
        });

        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        var $container = $fixture.children('[data-br-webexpid="target-web-experience"]');
        expect($container.length).toBe(1);
        expect(activitySpy.renderedElements.length).toBe(1);
        expectRenderedElement(activitySpy.renderedElements[0], true, 200, '_default');
        expect(activitySpy.renderedElements[0].tags.groupType).toBe('none');
        expect(activitySpy.renderedElements[0].tags.splitTest).toBeNull();
        expect(activitySpy.renderedElements[0].tags.group).toBeNull();

        activitySpy.restore();
        $fixture.remove();
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
