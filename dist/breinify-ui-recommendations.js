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
            config.process = {};

            /*
             * TODO:
             *  - add: bindings (bindings.selector <-- singleConfig)
             *  - add: modifications (data.modify <-- singleConfig.modifyData)
             *  - add: styles
             */

            return config;
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
            const selector = Breinify.UTL.isNonEmptyString(position.selector);
            const snippet = Breinify.UTL.isNonEmptyString(position.snippet);

            let func = null;
            if (selector === null && snippet === null) {
                return {};
            } else if (selector !== null) {
                func = function () {
                    return $(selector);
                };
            } else {
                func = Breinify.plugins.snippetManager.getSnippet(containerSnippetId);
            }

            return $.isFunction(func) ? {[operation]: func} : {};
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
                Object.entries(placeholders).map(([key, snippetId]) =>
                    [key, Breinify.plugins.snippetManager.getSnippet(snippetId)])
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

            // TODO: add additional parameters and recForItems
            // --> additionalParameters   (snippet)
            // --> itemsForRecommendation (snippet)
            return {
                payload: {
                    recommendationQueryName: queryLabel,
                    namedRecommendations: [namedRec]
                    // recommendationAdditionalParameters: {
                    //     additionalOtherParameters: {}
                    // },
                    // recommendationForItems: null
                }
            };
        }
    };

    // bind the plugin
    Breinify.plugins._add('uiRecommendations', {
        register: function () {

        },
        handle: function (webExId, config) {
            const recommendations = $.isArray(config.recommendations) ? config.recommendations : [];
            if (recommendations.length === 0) {
                return;
            }

            Promise.resolve()
                .then(() => _private.handle(webExId, recommendations))
                .catch(err => { /* handle/log */
                });
        }
    });
})();