"use strict";

describe('Survey trigger snippets', function () {
    var $, $root, snippets, activities, contexts, originalSnippets, originalActivities;

    beforeEach(function () {
        $ = Breinify.UTL._jquery();
        $root = $('<div><section class="survey-hook-anchor"></section></div>').appendTo('body');
        snippets = {};
        activities = [];
        contexts = [];
        originalSnippets = Breinify.plugins.snippetManager;
        originalActivities = Breinify.plugins.activities;
        Breinify.plugins.snippetManager = {getSnippet: function (id) { return snippets[id] || null; }};
        Breinify.plugins.activities = {
            generic: function (type, user, tags) { activities.push({type: type, tags: tags}); }
        };
    });

    afterEach(function () {
        $root.remove();
        $('br-ui-survey-popup').remove();
        document.body.classList.remove('br-survey-scroll-lock');
        Breinify.plugins.snippetManager = originalSnippets;
        Breinify.plugins.activities = originalActivities;
    });

    function render(trigger, style, survey) {
        var id = Breinify.UTL.uuid();
        var module = {webExId: id, webExVersionId: id + '-version', campaignName: 'Survey hook'};
        var config = {
            position: {selector: '.survey-hook-anchor', operation: 'append'},
            trigger: trigger || {snippet: 'hook'},
            style: style || {},
            survey: survey || {
                nodes: [
                    {id: 'start', type: 'start'},
                    {id: 'question', type: 'question', data: {question: 'Choose a wine', answers: []}}
                ],
                edges: [{source: 'start', target: 'question'}]
            }
        };
        Breinify.plugins.uiSurvey.render(module, config);
        return {module: module, config: config};
    }

    function hook(context) {
        contexts.push(context);
        $('<button type="button">Find my wine</button>').on('click', context.open).appendTo(context.$container);
    }

    it('defaults to three skeletons and isolates a trigger override to its experience', function () {
        var originalRecommendations = Breinify.plugins.recommendations;
        Breinify.plugins.recommendations = {render: function () {}};
        var survey = {
            nodes: [
                {id: 'start', type: 'start'},
                {id: 'results', type: 'recommendation', data: {preconfiguredRecommendation: 'Wine'}}
            ],
            edges: [{source: 'start', target: 'results'}]
        };
        try {
            snippets.hook = function (context) {
                context.setSkeletonCardCount(10);
                hook(context);
            };
            render(null, null, survey);
            contexts[0].open();
            var popup = document.querySelector('br-ui-survey-popup');
            expect(popup.shadowRoot.querySelectorAll('.br-survey-skeleton-card').length).toBe(10);

            [0, -1, 1.5, '10', NaN, Infinity].forEach(function (count) {
                var rejected = false;
                try {
                    contexts[0].setSkeletonCardCount(count);
                } catch (error) {
                    rejected = error instanceof RangeError;
                }
                expect(rejected).toBe(true);
            });

            snippets.hook = hook;
            render(null, null, survey);
            contexts[1].open();
            expect(popup.shadowRoot.querySelectorAll('.br-survey-skeleton-card').length).toBe(3);
        } finally {
            Breinify.plugins.recommendations = originalRecommendations;
        }
    });

    it('runs after insertion, passes context, and keeps opening and activity attribution intact', function () {
        snippets.hook = hook;
        Breinify.plugins.webExperiences.setActivityContext($root, {
            tags: {splitTest: 'Wine placement', groupType: 'test', group: 'Wine'}
        });
        var result = render();
        var context = contexts[0];
        expect(context.$container.get(0).isConnected).toBe(true);
        expect(context.webExId).toBe(result.module.webExId);
        expect(context.webExVersionId).toBe(result.module.webExVersionId);
        expect(context.position.$anchor.get(0)).toBe($root.children().get(0));
        expect(context.position.operation).toBe('append');
        expect(context.settings).toBe(result.config);
        expect(context.trigger).toBe(result.config.trigger);
        expect(context.$shadowRoot.get(0)).toBe(context.$host.get(0).shadowRoot);
        expect(context.$container.find('[role="button"]').length).toBe(0);
        context.$container.find('button').get(0).click();
        var popup = document.querySelector('br-ui-survey-popup');
        expect(popup.hasAttribute('open')).toBe(true);
        expect(popup.shadowRoot.querySelector('.br-survey-question-title').textContent).toBe('Choose a wine');
        var opens = activities.filter(function (activity) { return activity.tags.action === 'open survey'; });
        expect(opens.length).toBe(1);
        expect(opens[0].type).toBe('clickedElement');
        expect(opens[0].tags.campaignWebExId).toBe(result.module.webExVersionId);
        expect(opens[0].tags.splitTest).toBe('Wine placement');
        Breinify.plugins.uiSurvey.render(result.module, result.config);
        expect(contexts.length).toBe(1);
    });

    it('lets a hook choose not to bind opening', function () {
        snippets.hook = function (context) {
            contexts.push(context);
            context.$container.append('<button type="button">Unbound</button>');
        };
        render();
        contexts[0].$container.find('button').get(0).click();
        expect(document.querySelector('br-ui-survey-popup')).toBe(null);
        expect(activities.filter(function (activity) { return activity.type === 'clickedElement'; }).length).toBe(0);
    });

    it('retains default banner behavior when no snippet is configured or a reference is invalid', function () {
        [undefined, 'missing', 'not-a-function'].forEach(function (snippet) {
            snippets['not-a-function'] = '<div>Not JavaScript</div>';
            render({snippet: snippet, bannerUrl: '/desktop.png', mobileBannerUrl: '/mobile.png'});
            var triggers = $root.find('br-ui-survey');
            var root = triggers.last().get(0).shadowRoot;
            expect(root.querySelectorAll('.br-survey-root').length).toBe(1);
            expect(root.querySelector('.br-survey-trigger-desktop').getAttribute('src')).toBe('/desktop.png');
            expect(root.querySelector('.br-survey-trigger-mobile').getAttribute('src')).toBe('/mobile.png');
            root.querySelector('[role="button"]').click();
            expect(document.querySelector('br-ui-survey-popup').hasAttribute('open')).toBe(true);
        });
    });

    it('cleans up a failed hook before rendering the fallback', function () {
        var cleaned = 0;
        snippets.hook = function (context) {
            context.onCleanup(function () { cleaned++; });
            context.$container.append('<button>Partial content</button>');
            throw new Error('Expected trigger failure');
        };
        render({snippet: 'hook', bannerUrl: '/desktop.png'});
        var root = $root.find('br-ui-survey').get(0).shadowRoot;
        expect(cleaned).toBe(1);
        expect(root.querySelector('.br-survey-custom-trigger')).toBe(null);
        expect(root.querySelectorAll('.br-survey-trigger').length).toBe(1);
    });

    it('disposes bindings when removed and initializes once again on reconnect', function () {
        var cleaned = 0;
        snippets.hook = function (context) {
            hook(context);
            return function () { cleaned++; };
        };
        render();
        var host = contexts[0].$host.get(0);
        var parent = host.parentElement;
        host.remove();
        expect(cleaned).toBe(1);
        contexts[0].open();
        expect(document.querySelector('br-ui-survey-popup')).toBe(null);
        parent.appendChild(host);
        expect(contexts.length).toBe(2);
        expect(host.shadowRoot.querySelectorAll('button').length).toBe(1);
        contexts[1].open();
        expect(document.querySelector('br-ui-survey-popup').hasAttribute('open')).toBe(true);
    });

    it('applies shared styles once per root, with theme overrides and no leakage between surveys', function () {
        snippets.shared = '<style>:host { --test-theme: neutral; } .br-popup-dialog { max-width: 777px; }</style>';
        snippets.wine = '<style>:host { --test-theme: wine; }</style>';
        snippets.beer = '<style>:host { --test-theme: beer; }</style>';
        snippets.hook = function (context) {
            context.injectStyle('shared');
            context.injectStyle('shared');
            hook(context);
        };
        render(null, {snippet: 'wine'});
        var wine = contexts[0];
        expect(wine.$shadowRoot.find('style[data-br-survey-custom-style="shared"]').length).toBe(1);
        expect(getComputedStyle(wine.$host.get(0)).getPropertyValue('--test-theme').trim()).toBe('wine');
        wine.open();
        var popup = document.querySelector('br-ui-survey-popup');
        expect(getComputedStyle(popup).getPropertyValue('--test-theme').trim()).toBe('wine');
        expect(getComputedStyle(popup.shadowRoot.querySelector('.br-popup-dialog')).maxWidth).toBe('777px');

        render(null, {snippet: 'beer'});
        contexts[1].open();
        expect(getComputedStyle(popup).getPropertyValue('--test-theme').trim()).toBe('beer');
        expect(popup.shadowRoot.querySelector('[data-br-survey-custom-style="wine"]')).toBe(null);
        wine.open();
        expect(getComputedStyle(popup).getPropertyValue('--test-theme').trim()).toBe('wine');

        var plain = render({bannerUrl: '/plain.png'});
        Breinify.plugins.uiSurvey.open(plain.module.webExVersionId);
        expect(popup.shadowRoot.querySelectorAll('[data-br-survey-custom-style]').length).toBe(0);
        expect(getComputedStyle(popup.shadowRoot.querySelector('.br-popup-dialog')).maxWidth).toBe('520px');
    });

    it('attributes a custom trigger to its own placement when there are multiple anchors', function () {
        snippets.hook = hook;
        $root.append('<section class="survey-hook-anchor"></section>');
        $root.children().each(function (index) {
            Breinify.plugins.webExperiences.setActivityContext(this, {
                tags: {splitTest: 'Placement ' + index, groupType: 'test', group: 'Test'}
            });
        });
        render();
        expect(contexts.length).toBe(2);
        contexts[1].open();
        var opens = activities.filter(function (activity) { return activity.tags.action === 'open survey'; });
        expect(opens.length).toBe(1);
        expect(opens[0].tags.splitTest).toBe('Placement 1');
    });
});
