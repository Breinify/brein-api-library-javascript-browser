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
});
