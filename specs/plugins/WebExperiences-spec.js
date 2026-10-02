"use strict";

describe('WebExperiences activity context interface', function () {
    var api;
    var consumer;
    var root;
    var container;
    var child;
    var $;

    function context(name, groupType, group) {
        return {tags: {splitTest: name, groupType: groupType || 'test', group: group || 'Breinify'}};
    }

    beforeEach(function () {
        api = Breinify.plugins.webExperiences;
        $ = Breinify.UTL._jquery();
        consumer = {activityContextSettings: function () { return {inheritSplitTest: true}; }};
        root = document.createElement('div');
        container = document.createElement('div');
        child = document.createElement('button');
        root.appendChild(container);
        container.appendChild(child);
    });

    afterEach(function () {
        $(root).remove();
    });

    it('requires explicit opt-in and leaves other modules unchanged', function () {
        api.setActivityContext(container, context('Parent'));
        var module = {name: 'ordinary experience'};
        expect(api.acceptsActivityContext(module)).toBe(false);
        expect(api.acceptsActivityContext(null)).toBe(false);
        expect(api.acceptsActivityContext({activityContextSettings: function () { return null; }})).toBe(false);
        expect(api.acceptsActivityContext({activityContextSettings: function () {
            return {inheritSplitTest: false};
        }})).toBe(false);
        expect(api.captureActivityContext(module, {element: child})).toEqual({tags: {}});
        expect(module).toEqual({name: 'ordinary experience'});
        expect(api.acceptsActivityContext(consumer)).toBe(true);
    });

    it('uses the nearest container, including the rendering element itself', function () {
        api.setActivityContext(root, context('Outer'));
        api.setActivityContext($(container), context('Nearest', 'control', 'Holdout'));
        var snapshot = api.captureActivityContext(consumer, {element: $(child)});
        expect(snapshot).toEqual(context('Nearest', 'control', 'Holdout'));
        expect(api.captureActivityContext(consumer, {element: container})).toEqual(snapshot);
        expect(container.attributes.length).toBe(0);
    });

    it('accepts direct context for embedded renderers without a DOM parent', function () {
        api.setActivityContext(container, context('DOM parent'));
        var snapshot = api.captureActivityContext(consumer, {
            element: child, parentContext: context('Direct parent')
        });
        expect(snapshot).toEqual(context('Direct parent'));
        expect(api.captureActivityContext(consumer, {parentContext: context('No DOM')}))
            .toEqual(context('No DOM'));
        expect(api.captureActivityContext(consumer, {element: child, parentContext: {}})).toEqual({tags: {}});
    });

    it('always preserves the child assignment as a unit without mixing parent fields', function () {
        api.setActivityContext(container, context('Parent', 'control', 'Parent group'));
        var own = context('Child', 'test', 'Child group');
        expect(api.captureActivityContext(consumer, {element: child, ownContext: own})).toEqual(own);
        expect(api.captureActivityContext({}, {element: child, ownContext: own})).toEqual(own);
        var unnamed = context(null, 'test', 'Unnamed child group');
        expect(api.captureActivityContext(consumer, {element: child, ownContext: unnamed})).toEqual(unnamed);
        var noAssignment = {tags: {groupType: 'none', splitTest: null, group: null}};
        expect(api.captureActivityContext(consumer, {element: child, ownContext: noAssignment}))
            .toEqual(context('Parent', 'control', 'Parent group'));
    });

    it('does not inherit identities, actions, rendering results or arbitrary tags', function () {
        var parent = context('Parent');
        parent.tags.campaignWebExId = 'parent-version';
        parent.tags.action = 'parent-branch';
        parent.tags.status = 500;
        parent.tags.rendered = false;
        parent.tags.unrelated = 'never inherited';
        var snapshot = api.captureActivityContext(consumer, {parentContext: parent});
        var tags = {campaignWebExId: 'child-version', action: 'child-action', status: 200, rendered: true,
            groupType: 'none', splitTest: null, group: null};
        var original = JSON.stringify(tags);
        var result = api.applyActivityContext(tags, snapshot);
        expect(result.campaignWebExId).toBe('child-version');
        expect(result.action).toBe('child-action');
        expect(result.status).toBe(200);
        expect(result.rendered).toBe(true);
        expect(result.unrelated).toBeUndefined();
        expect(result.splitTest).toBe('Parent');
        expect(result.groupType).toBe('test');
        expect(JSON.stringify(tags)).toBe(original);
        var ownTags = $.extend({}, tags, context('Child', 'control', 'Holdout').tags);
        expect(api.applyActivityContext(ownTags, snapshot)).toEqual(ownTags);
        expect(api.applyActivityContext(tags, {})).toEqual(tags);
    });

    it('keeps immutable per-rendering snapshots through replacement, removal and later clicks', function () {
        var parent = context('First parent');
        api.setActivityContext(container, parent);
        parent.tags.splitTest = 'Caller mutation';
        var snapshot = api.captureActivityContext(consumer, {element: child});
        api.setActivityContext(container, context('Second parent'));
        expect(api.captureActivityContext(consumer, {element: child}).tags.splitTest).toBe('Second parent');
        api.clearActivityContext(container);
        expect(api.captureActivityContext(consumer, {element: child})).toEqual({tags: {}});
        expect(api.applyActivityContext({activityType: 'clickedRecommendation'}, snapshot).splitTest)
            .toBe('First parent');
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.tags)).toBe(true);
    });

    it('treats an empty container context as a boundary and clearing it restores ancestor inheritance', function () {
        api.setActivityContext(root, context('Outer'));
        api.setActivityContext(container, {});
        expect(api.captureActivityContext(consumer, {element: child})).toEqual({tags: {}});
        expect(api.setActivityContext(container, null)).toBe(true);
        expect(api.captureActivityContext(consumer, {element: child})).toEqual(context('Outer'));
    });

    it('keeps simultaneous renderings of the same consumer independent', function () {
        api.setActivityContext(root, context('First'));
        api.setActivityContext(container, context('Second'));
        var first = api.captureActivityContext(consumer, {element: root});
        var second = api.captureActivityContext(consumer, {element: child});
        expect(first.tags.splitTest).toBe('First');
        expect(second.tags.splitTest).toBe('Second');
        expect(Object.keys(consumer)).toEqual(['activityContextSettings']);
    });

    it('rejects ambiguous or invalid targets without changing existing context', function () {
        api.setActivityContext(container, context('Keep'));
        expect(api.setActivityContext($(root).add(container), context('Ambiguous'))).toBe(false);
        expect(api.setActivityContext(null, context('Missing'))).toBe(false);
        expect(api.setActivityContext(container, {tags: 'invalid'})).toBe(false);
        expect(api.clearActivityContext('div')).toBe(false);
        expect(api.captureActivityContext(consumer, {element: child})).toEqual(context('Keep'));
        expect(api.captureActivityContext(consumer)).toEqual({tags: {}});
    });
});
