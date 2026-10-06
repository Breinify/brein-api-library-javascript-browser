"use strict";

describe('Survey and countdown activity context', function () {
    var $, experiences, $root, activities, originalActivities, originalRecommendations, originalSnippets;
    var recommendationOptions, countdowns;

    beforeEach(function () {
        $ = Breinify.UTL._jquery();
        experiences = Breinify.plugins.webExperiences;
        $root = $('<div><section class="context-survey-anchor"></section><section></section></div>')
            .appendTo('body');
        activities = [];
        countdowns = [];
        recommendationOptions = [];
        originalActivities = Breinify.plugins.activities;
        originalRecommendations = Breinify.plugins.recommendations;
        originalSnippets = Breinify.plugins.snippetManager;
        Breinify.plugins.activities = {
            generic: function (type, user, tags) { activities.push({type: type, tags: tags}); },
            scheduleDelayedActivity: function (user, type, tags) {
                activities.push({type: type, tags: tags, delayed: true});
            }
        };
        Breinify.plugins.recommendations = {render: function (option) { recommendationOptions.push(option); }};
        Breinify.plugins.snippetManager = {getSnippet: function () { return null; }};
    });

    afterEach(function () {
        countdowns.forEach(function (countdown) { countdown._stopRefreshLoop(); });
        $('br-ui-survey-popup').remove();
        document.body.classList.remove('br-survey-scroll-lock');
        $root.remove();
        Breinify.plugins.activities = originalActivities;
        Breinify.plugins.recommendations = originalRecommendations;
        Breinify.plugins.snippetManager = originalSnippets;
    });

    function context(name, groupType) {
        return {tags: {splitTest: name, groupType: groupType || 'test', group: name + ' group'}};
    }

    function survey(multiple, optOut, operation, question) {
        if (multiple) {
            $root.children().eq(1).addClass('context-survey-anchor');
        }
        var module = {webExVersionId: 'survey-context-' + Breinify.UTL.uuid(), campaignName: 'Survey'};
        if (optOut) {
            module.activityContextSettings = function () { return {inheritSplitTest: false}; };
        }
        Breinify.plugins.uiSurvey.render(module, {
            position: {selector: '.context-survey-anchor', operation: operation || 'append'},
            survey: {
                nodes: [{id: 'start', type: 'start'}, {id: 'results', type: question ? 'question' : 'recommendation',
                    data: {preconfiguredRecommendation: 'Survey recommendations', question: 'Choose an answer',
                        answers: [{_id: 'answer', title: 'My answer'}]}},
                    {id: 'end', type: 'recommendation', data: {preconfiguredRecommendation: 'Survey recommendations'}}],
                edges: [{source: 'start', target: 'results'}, {source: 'results', target: 'end', answer: 'answer'}]
            }
        });
        return module;
    }

    it('activates and renders banners in element placeholders without a selector or operation', function () {
        var webExId = 'survey-element-' + Breinify.UTL.uuid();
        var module = {webExId: webExId, webExVersionId: webExId + '-version'};
        var config = {
            activationLogic: {paths: [{type: 'ATTRIBUTE'}]},
            position: {renderingBehavior: 'onChange'},
            trigger: {bannerUrl: '/survey-banner.png'},
            survey: {
                nodes: [{id: 'start', type: 'start'}, {id: 'question', type: 'question',
                    data: {question: 'Choose an answer', answers: []}}],
                edges: [{source: 'start', target: 'question'}]
            }
        };
        module.onChange = function () { Breinify.plugins.uiSurvey.render(module, config); };
        var $anchor = $('<div>').attr('data-br-webexpid', webExId).appendTo($root);
        var $other = $('<div>').attr('data-br-webexpid', module.webExVersionId).appendTo($root);
        var $span = $('<span>').attr('data-br-webexpid', webExId).appendTo($root);
        experiences.setActivityContext($anchor, context('Element parent'));

        spyOn(Breinify.plugins.api, 'isModule').and.returnValue(false);
        spyOn(Breinify.plugins.api, 'addModule');
        spyOn(Breinify.plugins.trigger, 'init');
        experiences.bootstrap(webExId, config, module);
        expect(module.findRequirements($root, {type: 'full-scan'})).toBe(true);
        module.onChange();
        module.onChange();

        expect($anchor.children('br-ui-survey').length).toBe(1);
        expect($other.children().length).toBe(0);
        expect($span.children().length).toBe(0);
        var trigger = $anchor.children('br-ui-survey').get(0);
        expect(trigger.shadowRoot.querySelector('img').getAttribute('src')).toBe('/survey-banner.png');
        trigger.shadowRoot.querySelector('[role="button"]').click();
        expect(document.querySelector('br-ui-survey-popup').shadowRoot.querySelector('.br-survey-question-title')
            .textContent).toBe('Choose an answer');
        expect(activities[0].tags.splitTest).toBe('Element parent');
        expect(config.position.selector).toBeUndefined();
        expect(config.position.operation).toBeUndefined();

        var $late = $('<div>').attr('data-br-webexpid', webExId).appendTo($root);
        expect(module.findRequirements($late, {type: 'added-element'})).toBe(true);
        module.onChange();
        expect($late.children('br-ui-survey').length).toBe(1);
        expect($anchor.children('br-ui-survey').length).toBe(1);

        var $changed = $('<div>').appendTo($root);
        expect(module.findRequirements($changed, {type: 'added-element'})).toBe(false);
        $changed.attr('data-br-webexpid', webExId);
        expect(module.findRequirements($changed, {type: 'attribute-change', attribute: 'data-br-webexpid'}))
            .toBe(true);
        module.onChange();
        expect($changed.children('br-ui-survey').length).toBe(1);
    });

    it('attributes popup events once to the clicked trigger and passes its snapshot to recommendations', function () {
        experiences.setActivityContext($root.children().eq(0), context('First'));
        experiences.setActivityContext($root.children().eq(1), context('Second', 'control'));
        var module = survey(true);
        expect(activities.length).toBe(2);
        expect(activities[0].tags.splitTest).toBe('First');
        expect(activities[1].tags.splitTest).toBe('Second');
        experiences.setActivityContext($root.children().eq(1), context('Changed'));
        var triggers = $root.find('br-ui-survey');
        triggers.get(1).shadowRoot.querySelector('[role="button"]').click();
        expect(activities.length).toBe(3);
        expect(activities[2].tags.splitTest).toBe('Second');
        expect(activities[2].tags.groupType).toBe('control');
        expect(recommendationOptions.length).toBe(1);
        var snapshot = recommendationOptions[0].activityContext;
        expect(snapshot.tags.splitTest).toBe('Second');
        // closing resets survey state before the document listener; attribution must survive that reset
        document.querySelector('br-ui-survey-popup').close('close-button');
        expect(activities.length).toBe(4);
        expect(activities[3].tags.splitTest).toBe('Second');
        triggers.get(0).shadowRoot.querySelector('[role="button"]').click();
        expect(activities.length).toBe(5);
        expect(activities[4].tags.splitTest).toBe('First');
        expect(recommendationOptions[1].activityContext.tags.splitTest).toBe('First');
        expect(snapshot.tags.splitTest).toBe('Second');
        activities.forEach(function (activity) {
            expect(activity.tags.campaignWebExId).toBe(module.webExVersionId);
            expect(activity.tags.widgetType).toBe('survey');
        });
    });

    it('does not guess a parent for programmatic opening with multiple placements', function () {
        experiences.setActivityContext($root, context('Parent'));
        var module = survey(true);
        Breinify.plugins.uiSurvey.open(module.webExVersionId);
        expect(activities.length).toBe(3);
        expect(activities[2].tags.splitTest).toBeUndefined();
        expect(recommendationOptions[0].activityContext).toBeNull();
    });

    it('tracks an answer once using the opening trigger, not every survey placement', function () {
        experiences.setActivityContext($root.children().eq(0), context('First'));
        experiences.setActivityContext($root.children().eq(1), context('Second'));
        var module = survey(true, false, 'append', true);
        var trigger = $root.find('br-ui-survey').get(1);
        Breinify.plugins.uiSurvey.open(module.webExVersionId, trigger);
        experiences.clearActivityContext($root.children().eq(1));
        var popup = document.querySelector('br-ui-survey-popup');
        var answer = popup.shadowRoot.querySelector('.br-survey-answer');
        answer.click();
        // selection is tracked when the answer is submitted, not when it is merely highlighted
        answer.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
        var answers = activities.filter(function (activity) { return activity.tags.action === 'selected answer'; });
        expect(answers.length).toBe(1);
        expect(answers[0].tags.splitTest).toBe('Second');
        expect(answers[0].tags.answerId).toBe('answer');
        expect(answers[0].tags.campaignWebExId).toBe(module.webExVersionId);
    });

    it('honors survey opt-out and does not inherit from an adjacent sibling', function () {
        experiences.setActivityContext($root.children().eq(0), context('Adjacent'));
        var module = survey(false, false, 'after');
        Breinify.plugins.uiSurvey.open(module.webExVersionId);
        expect(activities[0].tags.splitTest).toBeUndefined();
        expect(activities[1].tags.splitTest).toBeUndefined();
        $root.find('br-ui-survey').remove();
        // a fresh anchor avoids the normal per-anchor placement deduplication
        $root.children().eq(0).removeData();
        experiences.setActivityContext($root, context('Parent'));
        module = survey(false, true);
        Breinify.plugins.uiSurvey.open(module.webExVersionId);
        expect(activities[2].tags.splitTest).toBeUndefined();
        expect(activities[3].tags.splitTest).toBeUndefined();
    });

    function countdown(own, optOut) {
        var version = 'countdown-context-' + Breinify.UTL.uuid();
        var anchorId = 'anchor-' + version;
        $root.children().eq(0).attr('id', anchorId);
        var module = {webExVersionId: version, campaignName: 'Countdown', type: 'ONE_TIME'};
        if (optOut) {
            module.activityContextSettings = function () { return {inheritSplitTest: false}; };
        }
        var now = Math.floor(Date.now() / 1000);
        var config = {position: {selector: '#' + anchorId, operation: 'append'},
            experience: {startTime: now - 60, endTime: now + 3600, url: '#countdown', message: 'Countdown'}};
        if (own) {
            config.splitTestData = {isControlGroup: false, groupDecision: 'Own group',
                testName: 'Own', selectedInstance: 'instance'};
        }
        Breinify.plugins.uiCountdown.render(module, config);
        return new Promise(function (resolve) {
            setTimeout(function () {
                var el = document.getElementById('br-ui-countdown-' + version);
                if (el) { countdowns.push(el); }
                resolve(el);
            }, 20);
        });
    }

    it('keeps countdown attribution stable for clicks and recaptures after reattachment', function (done) {
        experiences.setActivityContext($root.children().eq(0), context('Parent', 'control'));
        countdown(false, false).then(function (el) {
            expect(activities[0].tags.rendered).toBe(true);
            expect(activities[0].tags.splitTest).toBe('Parent');
            expect(el.settings.splitTestData).toBeUndefined();
            experiences.setActivityContext($root.children().eq(0), context('Changed'));
            el.render();
            el._sendActivity('clickedElement', {});
            expect(activities[1].tags.splitTest).toBe('Parent');
            expect(activities[1].delayed).toBe(true);
            el.remove();
            el.render();
            el._sendActivity('clickedElement', {ctrlKey: true});
            expect(activities[2].tags.splitTest).toBe('Changed');
            expect(activities[2].tags.campaignWebExId).toBe(el.settings.webExVersionId);
            done();
        }).catch(done.fail);
    });

    it('preserves the countdown own assignment for both impressions and clicks', function (done) {
        experiences.setActivityContext($root, context('Parent', 'control'));
        countdown(true, false).then(function (el) {
            el._sendActivity('clickedElement', {ctrlKey: true});
            expect(activities.length).toBe(2);
            activities.forEach(function (activity) {
                expect(activity.tags.splitTest).toBe('Own (instance)');
                expect(activity.tags.groupType).toBe('test');
                expect(activity.tags.group).toBe('Own group');
                expect(activity.tags.campaignWebExId).toBe(el.settings.webExVersionId);
            });
            done();
        }).catch(done.fail);
    });

    it('honors countdown opt-out', function (done) {
        experiences.setActivityContext($root, context('Parent'));
        countdown(false, true).then(function (el) {
            el._sendActivity('clickedElement', {ctrlKey: true});
            expect(activities[0].tags.splitTest).toBeUndefined();
            expect(activities[1].tags.splitTest).toBeUndefined();
            done();
        }).catch(done.fail);
    });
});
