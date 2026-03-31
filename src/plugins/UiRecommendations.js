"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("uiRecommendations")) {
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
                onLoadHandled: false,
                onLoadHandling: false
            };

            this._runtimeByVersionId[normalizedWebExVersionId] = runtime;
            return runtime;
        },

        _getSnippetValue: function (snippetId) {
            const normalizedSnippetId = Breinify.UTL.isNonEmptyString(snippetId);
            if (normalizedSnippetId === null || Breinify.plugins._isAdded("snippetManager") !== true) {
                return null;
            }

            const snippet = Breinify.plugins.snippetManager.getSnippet(normalizedSnippetId);
            if (typeof snippet === "string" || $.isFunction(snippet)) {
                return snippet;
            }

            return null;
        },

        _getSnippetFunction: function (snippetId) {
            const snippet = this._getSnippetValue(snippetId);
            return $.isFunction(snippet) ? snippet : null;
        },

        _createRenderIdentity: function (webExId, singleConfig) {
            const positionId = Breinify.UTL.isNonEmptyString(singleConfig?.position?.positionId);
            const recommenderName = Breinify.UTL.isNonEmptyString(
                singleConfig?.recommender?.preconfiguredRecommendation
            );

            return {
                webExId: Breinify.UTL.isNonEmptyString(webExId),
                positionId: positionId,
                recommenderName: recommenderName
            };
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
             * We additionally guard against parallel/in-flight onLoad handling.
             */
            if (handlingType === "onLoad") {
                if (runtime.onLoadHandled === true || runtime.onLoadHandling === true) {
                    return;
                }

                runtime.onLoadHandling = true;
            }
            /*
             * If onChange is used we may be on an attribute activation path, we need to ensure that we are
             * ready to handle this correctly.
             */
            else if (Breinify.plugins.webExperiences.hasAttributeActivation(config) === true) {
                this._cleanUpAttributeActivation(webExId, webExVersionId, runtime, recommendations);
            }

            try {
                const results = await Promise.all(
                    normalizedRecommendations.map((recommendation) =>
                        Promise.resolve()
                            .then(() => this._handle(webExId, webExVersionId, recommendation, config))
                            .catch(function (err) {
                                console.error(err);
                                return null;
                            })
                    )
                );

                const filteredResults = results.filter(function (entry) {
                    return $.isPlainObject(entry);
                });

                if (filteredResults.length === 0) {
                    return;
                }

                Breinify.plugins.recommendations.render(filteredResults);

                if (handlingType === "onLoad") {
                    runtime.onLoadHandled = true;
                }
            } finally {
                if (handlingType === "onLoad") {
                    runtime.onLoadHandling = false;
                }
            }
        },

        _cleanUpAttributeActivation: function (webExId, webExVersionId, runtime, recommendations) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            const normalizedRecommendations = $.isArray(recommendations) ? recommendations : [];

            if (normalizedWebExId === null ||
                !$.isPlainObject(runtime) ||
                normalizedRecommendations.length === 0) {
                return;
            }

            console.log("uiRecommendations cleanUpAttributeActivation", {
                webExId: normalizedWebExId,
                webExVersionId: webExVersionId,
                runtime: runtime,
                recommendations: normalizedRecommendations
            });
        },

        _handle: async function (webExId, webExVersionId, singleConfig, configuration) {
            if (!$.isPlainObject(singleConfig)) {
                return null;
            }

            const config = {};
            config.recommender = await this._createPayload(singleConfig.recommender);
            config.activity = this._createActivitySettings(singleConfig);
            config.splitTests = this._createSplitTestsSettings(singleConfig.splitTestControl);
            config.position = this._createPosition(webExId, configuration, singleConfig.position, singleConfig);
            config.placeholders = this._createPlaceholders(singleConfig.placeholders);
            config.templates = this._createTemplates(singleConfig.templates);
            config.process = this._createProcess(webExId, webExVersionId, singleConfig.process);
            config.meta = {
                renderIdentity: this._createRenderIdentity(webExId, singleConfig)
            };

            this._applyStyle(singleConfig.style);

            /*
             * TODO:
             *  - add: bindings (bindings.selector <-- singleConfig)
             *  - add: modifications (data.modify <-- singleConfig.modifyData)
             */
            return config;
        },

        _determineAttributeAnchors: function (webExId) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            if (normalizedWebExId === null) {
                return {
                    specific: {},
                    fallback: null
                };
            }

            const anchors = {
                specific: {},
                fallback: null
            };

            $('div[data-br-webexpid="' + normalizedWebExId + '"]').each((idx, el) => {
                const $anchor = this._normalizeAttributeResolvedTarget($(el));
                if ($anchor === null) {
                    return;
                }

                const positionId = Breinify.UTL.isNonEmptyString($anchor.attr("data-br-webexppos"));
                if (positionId === null) {
                    if (anchors.fallback === null) {
                        anchors.fallback = $anchor;
                    }

                    return;
                }

                if (!$.isPlainObject(anchors.specific)) {
                    anchors.specific = {};
                }

                if (!anchors.specific[positionId]) {
                    anchors.specific[positionId] = $anchor;
                }
            });

            return anchors;
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
            let resolvedProcesses = {};

            if ($.isPlainObject(config)) {
                resolvedProcesses = Object.fromEntries(
                    Object.entries(config).flatMap(([key, snippetId]) => {
                        const func = this._getSnippetFunction(snippetId);
                        return func == null ? [] : [[key, func]];
                    })
                );
            }

            const originalCreateActivity = $.isFunction(resolvedProcesses.createActivity)
                ? resolvedProcesses.createActivity
                : null;

            resolvedProcesses.createActivity = function (event, settings) {
                if ($.isFunction(originalCreateActivity)) {
                    originalCreateActivity.call(this, event, settings);
                }

                settings.activityTags.campaignWebExId = webExVersionId;
            };

            return resolvedProcesses;
        },

        _createPosition: function (webExId, configuration, position, singleConfig) {
            const hasAttributeActivation = Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true;
            if (hasAttributeActivation === true) {
                return this._createAttributeActivationPosition(webExId, position, singleConfig);
            }

            const normalizedPosition = $.isPlainObject(position) ? position : {};
            const func = this._createPositionSelector(webExId, configuration, normalizedPosition, singleConfig);
            if (!$.isFunction(func)) {
                return {};
            }

            let operation = Breinify.UTL.isNonEmptyString(normalizedPosition.operation);
            if (operation === null) {
                return {};
            }

            operation = operation.toLowerCase();
            if ($.inArray(operation, ALLOWED_POSITIONS) === -1) {
                return {};
            }

            return {[operation]: func};
        },

        _createAttributeActivationPosition: function (webExId, position, singleConfig) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            const positionId = Breinify.UTL.isNonEmptyString(position?.positionId);

            return {
                append: function () {
                    if (normalizedWebExId === null) {
                        return $();
                    }

                    let $anchor = $();

                    if (positionId !== null) {
                        $anchor = $('div[data-br-webexpid="' + normalizedWebExId + '"][data-br-webexppos="' + positionId + '"]').eq(0);
                        if ($anchor.length === 1) {
                            return $anchor;
                        }
                    }

                    $anchor = $('div[data-br-webexpid="' + normalizedWebExId + '"]:not([data-br-webexppos])').eq(0);
                    return $anchor;
                }
            };
        },

        _createPositionSelector: function (webExId, configuration, position, singleConfig) {
            const hasAttributeActivation = Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true;
            if (hasAttributeActivation === true) {
                return null;
            }

            if (!$.isPlainObject(position)) {
                return null;
            }

            const resolvedRenderTarget = singleConfig?._resolvedRenderTarget;
            if (Breinify.UTL.dom.isNodeType(resolvedRenderTarget, 1)) {
                return function () {
                    return $(resolvedRenderTarget);
                };
            }

            if ($.isFunction(position._func)) {
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
                position._func = this._getSnippetFunction(snippet);
            }

            return $.isFunction(position._func) ? position._func : null;
        },

        _createTemplates: function (templates) {
            if (!$.isPlainObject(templates)) {
                return {};
            }

            return {
                container: this._getSnippetValue(templates.container),
                item: this._getSnippetValue(templates.item)
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
                    const func = this._getSnippetFunction(snippetId);
                    return func == null ? [] : [[key, func]];
                })
            );
        },

        _createActivitySettings: function (config) {
            let activityType = $.isPlainObject(config)
                ? Breinify.UTL.isNonEmptyString(config.activityType)
                : null;
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
            const func = this._getSnippetFunction(recommender.itemsForRecommendation);
            if ($.isFunction(func)) {
                recommendationForItems = await func();
            }

            if (!$.isArray(recommendationForItems)) {
                recommendationForItems = null;
            }

            return {
                payload: {
                    recommendationQueryName: queryLabel,
                    namedRecommendations: [namedRec],
                    recommendationForItems: recommendationForItems
                }
            };
        },

        _recommenderName: function (rec) {
            return Breinify.UTL.isNonEmptyString(
                rec?.recommender?.preconfiguredRecommendation
            );
        },

        _createMarkerKey: function (webExId, webExVersionId, rec) {
            const recommenderName = this._recommenderName(rec) || "unknown";
            return "br-marked-for-" + webExId + "::" + webExVersionId + "::" + recommenderName;
        },

        _findRequirements: function (webExId, webExVersionId, configuration, recs, $changedContainer, data) {
            if (!$.isPlainObject(data)) {
                return false;
            } else if (!$changedContainer?.jquery || $changedContainer.length !== 1) {
                return false;
            } else if (!$.isArray(recs) || recs.length === 0) {
                return false;
            }

            const hasAttributeActivation = Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true;

            if (hasAttributeActivation === true) {
                if (data.type === "attribute-change") {
                    if (data.attribute !== "data-br-webexpid" && data.attribute !== "data-br-webexppos") {
                        return false;
                    }
                } else if (data.type !== "added-element" &&
                    data.type !== "removed-element" &&
                    data.type !== "full-scan") {
                    return false;
                }

                /*
                 * Attribute path intentionally disabled for now.
                 * We still return the recs so `_handle(...)` can log the current configuration.
                 */
                return recs.slice();
            }

            if (data.type === "removed-element") {
                return false;
            } else if (data.type === "attribute-change") {
                return false;
            } else if (data.type !== "added-element" && data.type !== "full-scan") {
                return false;
            }

            const markerContainerClass = Breinify.plugins.recommendations.marker.container;
            const markerSelector = "." + markerContainerClass;

            const selectedRecs = [];
            const localSelections = Object.create(null);

            for (let i = 0; i < recs.length; i++) {
                const rec = recs[i];
                if (!$.isPlainObject(rec)) {
                    continue;
                }

                const func = $.isFunction(rec._positionSelector)
                    ? rec._positionSelector
                    : this._createPositionSelector(webExId, configuration, rec.position, rec);

                rec._positionSelector = func;

                if (!$.isFunction(func)) {
                    continue;
                }

                const recommenderName = this._recommenderName(rec);
                const $target = func(recommenderName, $changedContainer, data);
                const $resolvedTarget = this._normalizeGenericResolvedTarget($target);

                if ($resolvedTarget === null) {
                    continue;
                }

                const targetEl = $resolvedTarget.get(0);
                const markerKey = this._createMarkerKey(webExId, webExVersionId, rec);
                const alreadySelectedTargets = $.isArray(localSelections[markerKey])
                    ? localSelections[markerKey]
                    : [];

                let alreadySelected = false;
                for (let j = 0; j < alreadySelectedTargets.length; j++) {
                    if (alreadySelectedTargets[j] === targetEl) {
                        alreadySelected = true;
                        break;
                    }
                }

                if (alreadySelected === true) {
                    continue;
                }

                if ($resolvedTarget.hasClass(markerContainerClass)) {
                    continue;
                } else if ($resolvedTarget.data(markerKey) === "true") {
                    continue;
                } else if (targetEl.querySelector && targetEl.querySelector(markerSelector) !== null) {
                    continue;
                }

                $resolvedTarget.data(markerKey, "true");

                if (!$.isArray(localSelections[markerKey])) {
                    localSelections[markerKey] = [];
                }
                localSelections[markerKey].push(targetEl);

                const selectedRec = $.extend(true, {}, rec);
                selectedRec._resolvedRenderTarget = targetEl;
                selectedRecs.push(selectedRec);
            }

            return selectedRecs.length > 0 ? selectedRecs : false;
        },

        _normalizeGenericResolvedTarget: function ($target) {
            if (!$target?.jquery || $target.length === 0) {
                return null;
            }

            const $resolvedTarget = $target.length === 1 ? $target : $target.eq(0);
            const targetEl = $resolvedTarget.get(0);

            if (!Breinify.UTL.dom.isNodeType(targetEl, 1)) {
                return null;
            } else if (targetEl.isConnected !== true) {
                return null;
            }

            return $resolvedTarget;
        }
    };

    Breinify.plugins._add("uiRecommendations", {
        register: function (module, webExId, webExVersionId, config) {
            const _self = this;

            const recs = $.isPlainObject(config) && $.isArray(config.recommendations)
                ? config.recommendations
                : [];
            const runtime = _private.getRuntime(webExVersionId);

            if (runtime === null) {
                return;
            }

            const configOnLoad = [];
            const configOnChange = [];

            for (let i = 0; i < recs.length; i++) {
                const rec = recs[i];
                const position = $.isPlainObject(rec?.position) ? rec.position : {};

                let behavior = Breinify.UTL.isNonEmptyString(position.renderingBehavior);
                behavior = behavior === null ? null : behavior.toLowerCase();

                if (behavior === "onchange" || behavior === "on_change") {
                    configOnChange.push(rec);
                } else {
                    configOnLoad.push(rec);
                }
            }

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

            module.findRequirements = function ($container, data) {
                const result = {};

                if (runtime.onLoadHandled !== true &&
                    runtime.onLoadHandling !== true &&
                    configOnLoad.length > 0) {
                    result.onLoad = {
                        activationLogic: config.activationLogic,
                        recommendations: configOnLoad,
                        type: "onLoad"
                    };
                }

                const selectedRecommenders = _private._findRequirements(
                    webExId,
                    webExVersionId,
                    config,
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
            const recommendations = $.isArray(config?.recommendations)
                ? config.recommendations
                : [];

            if (recommendations.length === 0) {
                return;
            }

            Promise.resolve()
                .then(function () {
                    return _private.handle(webExId, webExVersionId, recommendations, config);
                })
                .catch(function () {
                    // intentionally swallowed to preserve existing behavior
                });
        }
    });
})();