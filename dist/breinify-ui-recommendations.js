"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded("uiRecommendations")) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    const ALLOWED_POSITIONS = ["before", "after", "prepend", "append", "replace", "externalRender"];

    const _private = {
        _runtimeByVersionId: {},

        getRuntime: function (webExVersionId) {
            const normalizedWebExVersionId = Breinify.UTL.isNonEmptyString(webExVersionId);
            if (normalizedWebExVersionId === null) {
                return null;
            }

            let runtime = this._runtimeByVersionId[normalizedWebExVersionId];
            if ($.isPlainObject(runtime)) {
                return runtime;
            }

            runtime = {
                webExVersionId: normalizedWebExVersionId,
                onLoadHandled: false
            };

            this._runtimeByVersionId[normalizedWebExVersionId] = runtime;
            return runtime;
        },

        handle: async function (webExId, webExVersionId, recommendations, config) {
            const normalizedRecommendations = $.isArray(recommendations) ? recommendations : [];
            if (normalizedRecommendations.length === 0) {
                return;
            }

            const handlingType = Breinify.UTL.isNonEmptyString(config?.type);
            const runtime = this.getRuntime(webExVersionId);
            if (runtime === null) {
                return;
            }

            /*
             * If we have a handlingType of `onLoad` we only expect the actual element to be rendered once.
             * This protects against repeated trigger executions caused by DOM changes or history handling.
             */
            if (handlingType === "onLoad" && runtime.onLoadHandled === true) {
                return;
            }

            const results = await Promise.all(
                normalizedRecommendations.map(recommendation =>
                    Promise.resolve()
                        .then(() => this._handle(webExId, webExVersionId, recommendation))
                        .catch(err => {
                            console.error(err);
                            return null;
                        })
                )
            );

            const filteredResults = results.filter(entry => $.isPlainObject(entry));
            if (filteredResults.length === 0) {
                return;
            }

            Breinify.plugins.recommendations.render(filteredResults);

            if (handlingType === "onLoad") {
                runtime.onLoadHandled = true;
            }
        },

        _handle: async function (webExId, webExVersionId, singleConfig) {
            if (!$.isPlainObject(singleConfig)) {
                return null;
            }

            const config = {};
            config.recommender = await this._createPayload(singleConfig.recommender);
            config.activity = this._createActivitySettings(singleConfig);
            config.splitTests = this._createSplitTestsSettings(singleConfig.splitTestControl);
            config.position = this._createPosition(singleConfig.position);
            config.placeholders = this._createPlaceholders(singleConfig.placeholders);
            config.templates = this._createTemplates(singleConfig.templates);
            config.process = this._createProcess(webExId, webExVersionId, singleConfig.process);
            this._applyStyle(singleConfig.style);

            /*
             * TODO:
             *  - add: bindings (bindings.selector <-- singleConfig)
             *  - add: modifications (data.modify <-- singleConfig.modifyData)
             */
            return config;
        },

        _applyStyle: function (config) {
            if (!$.isPlainObject(config)) {
                return;
            }

            /*
             * We do not support selector-based changes currently, so only check the snippet.
             * injectSnippet should handle internal deduplication if applicable.
             */
            const snippetId = Breinify.UTL.isNonEmptyString(config.snippet);
            if (snippetId !== null && Breinify.plugins._isAdded("snippetManager")) {
                Breinify.plugins.snippetManager.injectSnippet(snippetId, "body", "prepend");
            }
        },

        _createProcess: function (webExId, webExVersionId, config) {
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

            let createActivityFunc = null;
            if ($.isFunction(resolvedProcesses.createActivity)) {
                createActivityFunc = resolvedProcesses.createActivity;
            }

            resolvedProcesses.createActivity = function (event, settings) {
                if ($.isFunction(createActivityFunc)) {
                    createActivityFunc.call(this, event, settings);
                }

                settings.activityTags.campaignWebExId = webExVersionId;
            };

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
            if ($.inArray(operation, ALLOWED_POSITIONS) === -1) {
                return {};
            }

            const func = this._createPositionSelector(position);
            return $.isFunction(func) ? { [operation]: func } : {};
        },

        _createPositionSelector: function (position) {
            if (!$.isPlainObject(position)) {
                return null;
            } else if ($.isFunction(position._func)) {
                return position._func;
            }

            const selector = Breinify.UTL.isNonEmptyString(position.selector);
            const snippet = Breinify.UTL.isNonEmptyString(position.snippet);

            if (selector === null && snippet === null) {
                return null;
            } else if (selector !== null) {
                position._func = function () {
                    return $(selector);
                };
            } else {
                position._func = Breinify.plugins.snippetManager.getSnippet(snippet);
            }

            return $.isFunction(position._func) ? position._func : null;
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
            activityType = activityType === null ? "clickedRecommendation" : activityType;

            return {
                clickedType: activityType
            };
        },

        _createPayload: async function (recommender) {
            if (!$.isPlainObject(recommender)) {
                return {};
            }

            const namedRec = Breinify.UTL.isNonEmptyString(recommender.preconfiguredRecommendation);
            let queryLabel = Breinify.UTL.isNonEmptyString(recommender.queryLabel);
            queryLabel = queryLabel === null ? namedRec : queryLabel;

            let recommendationForItems = null;
            const recForItemsSnippetId = Breinify.UTL.isNonEmptyString(recommender.itemsForRecommendation);
            if (recForItemsSnippetId !== null) {
                const func = Breinify.plugins.snippetManager.getSnippet(recForItemsSnippetId);
                if ($.isFunction(func)) {
                    recommendationForItems = await func();
                }
            }

            if (!$.isArray(recommendationForItems)) {
                recommendationForItems = null;
            }

            // TODO: add additional parameters
            // --> additionalParameters (snippet)
            return {
                payload: {
                    recommendationQueryName: queryLabel,
                    namedRecommendations: [namedRec],
                    recommendationForItems: recommendationForItems
                }
            };
        },

        _recommenderName: function (rec) {
            return Breinify.UTL.isNonEmptyString(rec?.recommender?.preconfiguredRecommendation);
        },

        _createMarkerKey: function (webExId, webExVersionId, rec) {
            const recommenderName = this._recommenderName(rec) || "unknown";
            return "br-marked-for-" + webExId + "-" + webExVersionId + "-" + recommenderName;
        },

        _findRequirements: function (webExId, webExVersionId, recs, $changedContainer, data) {

            /*
             * Hot path: we only care about added elements. Ignore removals and attribute changes.
             */
            if (!$.isPlainObject(data) || data.type !== "added-element") {
                return false;
            } else if (!$changedContainer || !$changedContainer.jquery || $changedContainer.length === 0) {
                return false;
            }

            const selectedRecs = [];
            for (const rec of recs) {
                if (!$.isPlainObject(rec)) {
                    continue;
                }

                const func = this._createPositionSelector(rec.position);
                if (!$.isFunction(func)) {
                    continue;
                }

                /*
                 * Align with recommendations plugin expectation:
                 * 1. recommenderName
                 * 2. changed container
                 * 3. mutation meta data
                 */
                const recommenderName = this._recommenderName(rec);
                const $target = func(recommenderName, $changedContainer, data);

                if (!$target || !$target.jquery || $target.length === 0) {
                    continue;
                } else if (!$target.is($changedContainer) && $target.has($changedContainer).length === 0) {
                    continue;
                }

                const markerKey = this._createMarkerKey(webExId, webExVersionId, rec);
                let shouldSelect = false;

                $target.each(function () {
                    const $entry = $(this);

                    if ($entry.find("." + Breinify.plugins.recommendations.marker.container).length > 0 ||
                        $entry.hasClass(Breinify.plugins.recommendations.marker.container)) {
                        return;
                    } else if ($entry.data(markerKey) === "true") {
                        return;
                    }

                    $entry.data(markerKey, "true");
                    shouldSelect = true;
                });

                if (shouldSelect === true) {
                    selectedRecs.push(rec);
                }
            }

            return selectedRecs.length > 0 ? selectedRecs : false;
        }
    };

    // bind the plugin
    Breinify.plugins._add("uiRecommendations", {
        register: function (module, webExId, webExVersionId, config) {
            const _self = this;

            const recs = $.isPlainObject(config) && $.isArray(config.recommendations) ? config.recommendations : [];
            const runtime = _private.getRuntime(webExVersionId);
            if (runtime === null) {
                return;
            }

            /*
             * In the case that we have the rendering behavior configured to be "onChange" we need to observe the dom-tree
             * via findRequirements. The detection of the path change is not enough in that case, and we need to render
             * on every requirement fulfillment.
             */
            const configOnLoad = [];
            const configOnChange = [];

            for (const rec of recs) {
                const position = $.isPlainObject(rec) && $.isPlainObject(rec.position) ? rec.position : {};

                let behavior = Breinify.UTL.isNonEmptyString(position.renderingBehavior);
                behavior = behavior === null ? null : behavior.toLowerCase();

                if (behavior === "onchange" || behavior === "on_change") {
                    configOnChange.push(rec);
                } else {
                    configOnLoad.push(rec);
                }
            }

            /*
             * Only on-load recommenders.
             */
            if (configOnLoad.length > 0 && configOnChange.length === 0) {
                module.onChange = function () {
                    _self.handle(webExId, webExVersionId, {
                        activationLogic: config.activationLogic,
                        recommendations: configOnLoad,
                        type: "onLoad"
                    });
                };
                return;
            }

            /*
             * Mixed mode or only on-change recommenders.
             */
            module.findRequirements = function ($container, data) {
                const result = {};

                if (runtime.onLoadHandled !== true && configOnLoad.length > 0) {
                    result.onLoad = {
                        activationLogic: config.activationLogic,
                        recommendations: configOnLoad,
                        type: "onLoad"
                    };
                }

                const selectedRecommenders = _private._findRequirements(
                    webExId,
                    webExVersionId,
                    configOnChange,
                    $container,
                    data
                );

                if ($.isArray(selectedRecommenders) && selectedRecommenders.length > 0) {
                    result.onChange = {
                        activationLogic: config.activationLogic,
                        recommendations: selectedRecommenders,
                        type: "onChange"
                    };
                }

                return Object.keys(result).length > 0 ? result : false;
            };

            module.onChange = function (data) {
                if ($.isPlainObject(data?.onLoad)) {
                    _self.handle(webExId, webExVersionId, data.onLoad);
                }

                if ($.isPlainObject(data?.onChange)) {
                    _self.handle(webExId, webExVersionId, data.onChange);
                }
            };
        },

        handle: function (webExId, webExVersionId, config) {
            const recommendations = $.isArray(config?.recommendations) ? config.recommendations : [];
            if (recommendations.length === 0) {
                return;
            }

            Promise.resolve()
                .then(() => _private.handle(webExId, webExVersionId, recommendations, config))
                .catch(function () {
                    // intentionally swallowed to preserve existing behavior
                });
        }
    });
})();