"use strict";

describe('UiModifyContent', function () {

    //noinspection JSUnresolvedVariable
    var uiModifyContent = window['Breinify'].plugins.uiModifyContent;

    it('places a web-experience container only once by default', function () {
        var $fixture = $('<div class="modify-content-placement-target"></div>').appendTo('body');
        var module = {};
        var webExperienceId = 'modify-content-placement-action-test';
        var webExperienceVersionId = 'version-1';

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {
                _default: [{
                    type: 'placeWebExperience',
                    settings: {
                        selector: '.modify-content-placement-target',
                        operation: 'append',
                        webExperienceId: 'target-web-experience',
                        positionId: 'target-position',
                        classes: ['target-container'],
                        attributes: {
                            'aria-label': 'Target web-experience'
                        }
                    }
                }]
            }
        });

        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});
        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        var $container = $fixture.children('[data-br-webexpid="target-web-experience"]');
        expect($container.length).toBe(1);
        expect($container.attr('data-br-webexppos')).toBe('target-position');
        expect($container.hasClass('target-container')).toBe(true);
        expect($container.attr('aria-label')).toBe('Target web-experience');

        $fixture.remove();
    });

    it('stores a split-test-only decision and skips actions when it does not match', function (done) {
        var $fixture = $('<div class="modify-content-split-test-target"></div>').appendTo('body');
        var module = {};
        var webExperienceId = 'modify-content-split-test-control';
        var webExperienceVersionId = 'version-1';
        var originalService = Breinify.service;
        var originalReplaceSplitTestData = Breinify.UTL.user.replaceSplitTestData;
        var storedSplitTestData = null;

        Breinify.UTL.user.replaceSplitTestData = function (testName, splitTestData) {
            storedSplitTestData = {
                testName: testName,
                splitTestData: splitTestData
            };
        };

        Breinify.service = function (service, payload, callback) {
            expect(service).toBe('webExperienceDecision');
            expect(payload.webExperiences.length).toBe(1);
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
                _default: [{
                    type: 'placeWebExperience',
                    settings: {
                        selector: '.modify-content-split-test-target',
                        operation: 'append',
                        webExperienceId: 'target-web-experience',
                        positionId: 'target-position'
                    }
                }]
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
            expect($fixture.children('[data-br-webexpid="target-web-experience"]').length).toBe(0);
            expect(storedSplitTestData.testName).toBe('Test: Modify Content');
            expect(storedSplitTestData.splitTestData.groupDecision).toBe('Control');
            Breinify.service = originalService;
            Breinify.UTL.user.replaceSplitTestData = originalReplaceSplitTestData;
            $fixture.remove();
            done();
        }, 10);
    });

    it('uses the default actions when a decision fails without a failure action group', function (done) {
        var $fixture = $('<div class="modify-content-decision-failure-target"></div>').appendTo('body');
        var module = {};
        var webExperienceId = 'modify-content-decision-default-fallback';
        var webExperienceVersionId = 'version-1';
        var originalService = Breinify.service;

        Breinify.service = function (service, payload, callback) {
            callback(new Error('Decision unavailable'), null, null);
        };

        uiModifyContent.register(module, webExperienceId, webExperienceVersionId, {
            actions: {
                _default: [{
                    type: 'placeWebExperience',
                    settings: {
                        selector: '.modify-content-decision-failure-target',
                        operation: 'append',
                        webExperienceId: 'target-web-experience',
                        positionId: 'target-position'
                    }
                }]
            },
            decision: {
                required: true,
                service: 'webExperienceDecision',
                configurationId: 'decision-default-fallback',
                conditions: [{
                    type: 'decision',
                    settings: {
                        refId: 'decision-default-fallback-ref'
                    }
                }]
            }
        });

        uiModifyContent.handle(webExperienceId, webExperienceVersionId, {type: 'full-scan'});

        setTimeout(function () {
            expect($fixture.children('[data-br-webexpid="target-web-experience"]').length).toBe(1);
            Breinify.service = originalService;
            $fixture.remove();
            done();
        }, 10);
    });
});
