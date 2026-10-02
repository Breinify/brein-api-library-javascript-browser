"use strict";

describe('Recommendations activity context integration', function () {
    var $;
    var recommendations;
    var experiences;
    var $root;
    var previousActivities;
    var activities;

    beforeEach(function () {
        $ = Breinify.UTL._jquery();
        recommendations = Breinify.plugins.recommendations;
        experiences = Breinify.plugins.webExperiences;
        $root = $('<div><section><div></div></section><section><div></div></section></div>').appendTo('body');
        activities = [];
        previousActivities = Breinify.plugins.activities;
        Breinify.plugins.activities = {generic: function (type, user, tags) {
            activities.push({type: type, tags: tags});
        }};
    });

    afterEach(function () {
        Breinify.plugins.activities = previousActivities;
        $root.remove();
    });

    function context(name, groupType) {
        return {tags: {splitTest: name, groupType: groupType || 'test', group: name + ' group'}};
    }

    function setup(index, splitTestData, extraOptions) {
        var $container = $root.children().eq(index).children();
        var result = {status: {code: 200, error: false}, splitTestData: splitTestData || {active: false},
            payload: {recommenderName: 'Context test'}, recommendations: [{id: 'product', name: 'Product'}]};
        var option = $.extend({activity: {clickedType: 'clickedRecommendation'}, process: {
            createActivity: function (event, settings) {
                settings.activityTags.campaignWebExId = 'child-version';
                settings.activityTags.action = 'child-action';
            }
        }}, extraOptions);
        recommendations._setupContainer($container, option, result);
        return {$container: $container, option: option, result: result};
    }

    function track(rendering) {
        recommendations._handleRender(rendering.result, rendering.option, rendering.$container);
        var $item = $('<a href="#context-click">Product</a>').addClass(recommendations.marker.item)
            .data(recommendations.marker.data, rendering.result.recommendations[0]).appendTo(rendering.$container);
        recommendations._handleRecommendationClick({target: $item.get(0), ctrlKey: true}, $item,
            rendering.$container, rendering.result, {}, rendering.option);
    }

    it('keeps DOM-inherited assignments independent and stable for impressions and clicks', function () {
        experiences.setActivityContext($root.children().eq(0), context('First parent', 'control'));
        experiences.setActivityContext($root.children().eq(1), context('Second parent'));
        var first = setup(0);
        var second = setup(1);
        experiences.setActivityContext($root.children().eq(0), context('Changed parent'));
        experiences.clearActivityContext($root.children().eq(1));
        track(first);
        track(second);
        expect(activities.length).toBe(4);
        activities.forEach(function (activity, index) {
            expect(activity.type).toBe(index % 2 === 0 ? 'renderedRecommendation' : 'clickedRecommendation');
            expect(activity.tags.splitTest).toBe(index < 2 ? 'First parent' : 'Second parent');
            expect(activity.tags.groupType).toBe(index < 2 ? 'control' : 'test');
            expect(activity.tags.campaignWebExId).toBe('child-version');
            expect(activity.tags.action).toBe('child-action');
        });
        // inheriting control attribution must not make the recommendation a control rendering
        expect(first.result.splitTestData).toEqual({active: false});
        expect(activities[0].tags.rendered).toBe(true);
    });

    it('preserves own assignments and supports opting out of inheritance', function () {
        experiences.setActivityContext($root, context('Parent'));
        var own = setup(0, {active: true, isControl: false, testName: 'Own',
            selectedInstance: 'instance', groupDecision: 'Own group'});
        track(own);
        var optedOut = setup(1, null, {activityContextSettings: function () {
            return {inheritSplitTest: false};
        }});
        track(optedOut);
        expect(activities[0].tags.splitTest).toBe('Own (instance)');
        expect(activities[1].tags.group).toBe('Own group');
        expect(activities[2].tags.groupType).toBe('none');
        expect(activities[3].tags.splitTest).toBeNull();
    });

    it('replaces the snapshot when a container is reused for a new rendering', function () {
        experiences.setActivityContext($root, context('First'));
        track(setup(0));
        experiences.setActivityContext($root, context('Next'));
        track(setup(0));
        expect(activities[0].tags.splitTest).toBe('First');
        expect(activities[1].tags.splitTest).toBe('First');
        expect(activities[2].tags.splitTest).toBe('Next');
        expect(activities[3].tags.splitTest).toBe('Next');
    });

    it('leaves standalone recommendation tracking intact without the Web Experiences plugin', function () {
        delete Breinify.plugins.webExperiences;
        try {
            track(setup(0));
            expect(activities.length).toBe(2);
            expect(activities[0].tags.groupType).toBe('none');
            expect(activities[1].tags.splitTest).toBeNull();
        } finally {
            Breinify.plugins.webExperiences = experiences;
        }
    });
});
