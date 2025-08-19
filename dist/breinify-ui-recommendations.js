"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('uiRecommendations')) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    const ALLOWED_POSITIONS = ['before', 'after', 'prepend', 'append', 'replace', 'externalRender'];

    const _private = {
        handle: async function (webExId, recommendations) {
            const results = await Promise.all(
                recommendations.map(recommendation =>
                    Promise.resolve()
                        .then(() => _private._handle(webExId, recommendation))
                        .catch(err => {
                            // handle/log error, and decide what to return
                            console.error(err);
                            return null; // or some fallback
                        })
                )
            );

            Breinify.plugins.recommendations.render(results);
        },

        _handle: async function (webExId, singleConfig) {
            const config = {};

            if (!$.isPlainObject(singleConfig)) {
                return;
            }

            config.recommender = await this._createPayload(singleConfig.recommender);
            config.activity = this._createActivitySettings(singleConfig);
            config.splitTests = this._createSplitTestsSettings(singleConfig.splitTestControl);
            config.position = this._createPosition(singleConfig.position);
            config.placeholders = this._createPlaceholders(singleConfig.placeholders);
            config.templates = this._createTemplates(singleConfig.templates);
            config.process = this._createProcess(webExId, singleConfig.process);
            this._applyStyle(singleConfig.style);

            /*
             * TODO:
             *  - add: bindings (bindings.selector <-- singleConfig)
             *  - add: modifications (data.modify <-- singleConfig.modifyData)
             */

            return config;
        },

        _applyStyle: function(config) {
            if (!$.isPlainObject(config)) {
                return;
            }

            // we do not support any changes via selectors currently, so we only check the snippet
            const snippetId = Breinify.UTL.isNonEmptyString(config.snippet);
            if (snippetId === null) {
                return;
            }

            const css = Breinify.plugins.snippetManager.getSnippet(snippetId);
            const $css = $(css);
            let id = Breinify.UTL.isNonEmptyString($css.attr('id'));
            if (id === null) {
                id = 'br-' + snippetId;
                $css.attr('id', id);
            }

            const $body = $('body');
            const $existingCss = $body.find('#' + id);
            if ($existingCss.length === 0) {
                $body.prepend($css);
            }
        },

        _createProcess: function (webExId, config) {

            let resolvedProcesses;
            if ($.isPlainObject(config)) {
                resolvedProcesses = Object.fromEntries(
                    Object.entries(config).flatMap(([key, snippetId]) => {
                        const func = Breinify.plugins.snippetManager.getSnippet(snippetId);
                        return func == null ? [] : [[key, func]];
                    })
                );
            } else {
                resolvedProcesses = {};
            }

            // we need to change the activity handling, to add in the additional data
            let createActivityFunc = null;
            if ($.isFunction(resolvedProcesses.createActivity)) {
                createActivityFunc = resolvedProcesses.createActivity;
            }

            resolvedProcesses.createActivity = function (event, settings) {
                if ($.isFunction(createActivityFunc)) {
                    createActivityFunc.call(this, event, settings);
                }

                settings.activityTags.campaignWebExId = webExId;
            }

            return resolvedProcesses;
        },

        _createPosition: function (position) {
            if (!$.isPlainObject(position)) {
                return {};
            }

            let operation = Breinify.UTL.isNonEmptyString(position.operation);
            if (operation === null) {
                return {};
            }

            operation = operation.toLowerCase();
            if (ALLOWED_POSITIONS.indexOf(operation) === -1) {
                return {};
            }

            // determine the right position
            const func = this._createPositionSelector(position);
            return $.isFunction(func) ? {[operation]: func} : {};
        },

        _createPositionSelector: function (position) {
            if (!$.isPlainObject(position)) {
                return null;
            }

            const selector = Breinify.UTL.isNonEmptyString(position.selector);
            const snippet = Breinify.UTL.isNonEmptyString(position.snippet);

            let func = null;
            if (selector === null && snippet === null) {
                return null;
            } else if (selector !== null) {
                func = function () {
                    return $(selector);
                };
            } else {
                func = Breinify.plugins.snippetManager.getSnippet(snippet);
            }

            return func;
        },

        _createTemplates: function (templates) {
            if (!$.isPlainObject(templates)) {
                return {};
            }

            const containerSnippetId = Breinify.UTL.isNonEmptyString(templates.container);
            const itemSnippetId = Breinify.UTL.isNonEmptyString(templates.item);

            return {
                container: Breinify.plugins.snippetManager.getSnippet(containerSnippetId),
                item: Breinify.plugins.snippetManager.getSnippet(itemSnippetId)
            };
        },

        _createSplitTestsSettings: function (splitTestControl) {
            if (!$.isPlainObject(splitTestControl)) {
                return {};
            }

            const containerSelector = Breinify.UTL.isNonEmptyString(splitTestControl.selector);
            if (containerSelector === null) {
                return {};
            }

            return {
                control: {
                    containerSelector: containerSelector
                }
            };
        },

        _createPlaceholders: function (placeholders) {
            if (!$.isPlainObject(placeholders)) {
                return {};
            }

            return Object.fromEntries(
                Object.entries(placeholders).flatMap(([key, snippetId]) => {
                    const func = Breinify.plugins.snippetManager.getSnippet(snippetId);
                    return func == null ? [] : [[key, func]];
                })
            );
        },

        _createActivitySettings: function (config) {
            let activityType = $.isPlainObject(config) ? Breinify.UTL.isNonEmptyString(config.activityType) : null;
            activityType = activityType === null ? 'clickedRecommendation' : activityType;

            return {
                type: activityType
            };
        },

        _createPayload: async function (recommender) {
            if (!$.isPlainObject(recommender)) {
                return {};
            }

            // check if we have to load anything async
            const namedRec = Breinify.UTL.isNonEmptyString(recommender.preconfiguredRecommendation);
            let queryLabel = Breinify.UTL.isNonEmptyString(recommender.queryLabel);
            queryLabel = queryLabel === null ? namedRec : queryLabel;

            let recommendationForItems = null;
            const recForItemsSnippetId = Breinify.UTL.isNonEmptyString(recommender.itemsForRecommendation);
            if (recForItemsSnippetId !== null) {
                const func = Breinify.plugins.snippetManager.getSnippet(recForItemsSnippetId);
                recommendationForItems = await func();
            }

            // make sure we have a valid type
            if (!$.isArray(recommendationForItems)) {
                recommendationForItems = null;
            }

            // TODO: add additional parameters
            // --> additionalParameters   (snippet)
            return {
                payload: {
                    recommendationQueryName: queryLabel,
                    namedRecommendations: [namedRec],
                    // recommendationAdditionalParameters: {
                    //     additionalOtherParameters: {}
                    // },
                    recommendationForItems: recommendationForItems
                }
            };
        },

        _findRequirements: function (webExId, recs, $container, data) {

            // we only care about specific events, so filter early
            if (!$.isPlainObject(data) ||
                data.type === 'attribute-change' ||
                data.type === 'removed-element') {
                return false;
            }

            const selectedRecs = [];
            for (const rec of recs) {

                // check if the selected element is affected by this change
                const func = this._createPositionSelector(rec.position);
                const $el = func();
                if ($el.length === 0) {
                    // continue;
                } else if ($el.find('.' + Breinify.plugins.recommendations.marker.container).length > 0 ||
                    $el.hasClass(Breinify.plugins.recommendations.marker.container)) {
                    // continue;
                } else if ($el.data('br-marked-for-' + webExId) === 'true') {
                    // continue
                } else if (!$container.is($el) && $container.has($el).length === 0) {
                    // continue;
                } else {
                    $el.data('br-marked-for-' + webExId, 'true');
                    selectedRecs.push(rec);
                }
            }

            if (selectedRecs.length > 0) {
                return selectedRecs;
            } else {
                return false;
            }
        },
    };

    // bind the plugin
    Breinify.plugins._add('uiRecommendations', {
        register: function (module, webExId, config) {
            const _self = this;

            /*
             * In the case that we have the rendering behavior configured to be "onChange" we need to observe the dom-tree
             * via findRequirements. The detection of the path change is not enough in that case, and we need to render
             * on "every" requirement fulfillment.
             */
            const configOnLoad = [];
            const configOnChange = [];

            const recs = $.isPlainObject(config) && $.isArray(config.recommendations) ? config.recommendations : [];
            for (const rec of recs) {
                const position = $.isPlainObject(rec) && $.isPlainObject(rec.position) ? rec.position : {};

                let behavior = Breinify.UTL.isNonEmptyString(position.renderingBehavior);
                behavior = behavior === null ? null : behavior.toLowerCase();

                if (behavior === 'onchange' || behavior === 'on_change') {
                    configOnChange.push(rec);
                } else {
                    configOnLoad.push(rec);
                }
            }

            /*
             * It would be very untypical to have mixed renders, since on-change rendering can only happen for one
             * element, the one that observes the change (or a group of elements observing the same change.
             */
            if (configOnChange.length > 0 && configOnLoad.length > 0) {
                // TODO: decide what this would mean and how to handle it correctly
            } else if (configOnLoad.length > 0) {
                module.onChange = function () {
                    _self.handle(webExId, {
                        activationLogic: config.activationLogic,
                        recommendations: configOnLoad
                    });
                }
            } else {
                module.findRequirements = function ($container, data) {

                    const selectedRecommenders = _private._findRequirements(webExId, configOnChange, $container, data);
                    if (!$.isArray(selectedRecommenders) || selectedRecommenders.length === 0) {
                        return false;
                    }

                    return {
                        activationLogic: config.activationLogic,
                        recommendations: selectedRecommenders
                    };
                };
                module.onChange = function (data) {
                    _self.handle(webExId, data);
                }
            }
        },
        handle: function (webExId, config) {
            const recommendations = $.isArray(config.recommendations) ? config.recommendations : [];
            if (recommendations.length === 0) {
                return;
            }

            Promise.resolve()
                .then(() => _private.handle(webExId, recommendations))
                .catch(err => {
                });
        }
    });
})();