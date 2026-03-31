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
                onLoadHandled: false,
                onLoadHandling: false
            };

            this._runtimeByVersionId[normalizedWebExVersionId] = runtime;
            return runtime;
        },

        _getSnippetFunction: function (snippetId) {
            const normalizedSnippetId = Breinify.UTL.isNonEmptyString(snippetId);
            if (normalizedSnippetId === null || Breinify.plugins._isAdded("snippetManager") !== true) {
                return null;
            }

            const func = Breinify.plugins.snippetManager.getSnippet(normalizedSnippetId);
            return $.isFunction(func) ? func : null;
        },

        handle: async function (webExId, webExVersionId, recommendations, config) {
            const normalizedRecommendations = $.isArray(recommendations) ? recommendations : [];
            if (normalizedRecommendations.length === 0) {
                return;
            }

            const handlingType = Breinify.UTL.isNonEmptyString(config && config.type);
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

            try {
                const results = await Promise.all(
                    normalizedRecommendations.map(recommendation =>
                        Promise.resolve()
                            .then(() => this._handle(webExId, webExVersionId, recommendation, config))
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
            } finally {
                if (handlingType === "onLoad") {
                    runtime.onLoadHandling = false;
                }
            }
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
            config.process = this._createProcess(webExId, webExVersionId, singleConfig.process, singleConfig);
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

        _createProcess: function (webExId, webExVersionId, config, recommenderConfig) {
            let resolvedProcesses;
            if ($.isPlainObject(config)) {
                resolvedProcesses = Object.fromEntries(
                    Object.entries(config).flatMap(([key, snippetId]) => {
                        const func = this._getSnippetFunction(snippetId);
                        return func == null ? [] : [[key, func]];
                    })
                );
            } else {
                resolvedProcesses = {};
            }

            const originalAttachedContainer = $.isFunction(resolvedProcesses.attachedContainer)
                ? resolvedProcesses.attachedContainer
                : null;

            resolvedProcesses.attachedContainer = function ($container, $itemContainer, data, option) {
                if ($container && $container.length === 1) {
                    $container.attr("data-br-rec-webexpid", webExId);

                    const positionId = Breinify.UTL.isNonEmptyString(recommenderConfig && recommenderConfig.position && recommenderConfig.position.positionId);
                    if (positionId !== null) {
                        $container.attr("data-br-rec-positionid", positionId);
                    }

                    const recommenderName = Breinify.UTL.isNonEmptyString(
                        recommenderConfig && recommenderConfig.recommender && recommenderConfig.recommender.preconfiguredRecommendation
                    );
                    if (recommenderName !== null) {
                        $container.attr("data-br-rec-name", recommenderName);
                    }
                }

                if ($.isFunction(originalAttachedContainer)) {
                    originalAttachedContainer.call(this, $container, $itemContainer, data, option);
                }
            };

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
            if (!$.isPlainObject(position)) {
                position = {};
            }

            const hasAttributeActivation = Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true;
            const func = this._createPositionSelector(webExId, configuration, position, singleConfig);
            if (!$.isFunction(func)) {
                return {};
            }

            /*
             * ATTRIBUTE activation forces anchor resolution through data-br-webexpid / data-br-webexppos.
             * The configured operation is ignored in that case and we always append into the resolved host.
             */
            if (hasAttributeActivation === true) {
                return {
                    append: func
                };
            }

            let operation = Breinify.UTL.isNonEmptyString(position.operation);
            if (operation === null) {
                return {};
            }

            operation = operation.toLowerCase();
            if ($.inArray(operation, ALLOWED_POSITIONS) === -1) {
                return {};
            }

            return { [operation]: func };
        },

        _createPositionSelector: function (webExId, configuration, position, singleConfig) {
            const hasAttributeActivation = Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true;
            if (hasAttributeActivation === true) {
                return this._createAttributePositionSelector(webExId, position, singleConfig);
            }

            if (!$.isPlainObject(position)) {
                return null;
            }

            const resolvedRenderTarget = singleConfig && singleConfig._resolvedRenderTarget;
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
                container: this._getSnippetFunction(templates.container),
                item: this._getSnippetFunction(templates.item)
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
            const func = this._getSnippetFunction(recommender.itemsForRecommendation);
            if ($.isFunction(func)) {
                recommendationForItems = await func();
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
            return Breinify.UTL.isNonEmptyString(rec && rec.recommender && rec.recommender.preconfiguredRecommendation);
        },

        _createMarkerKey: function (webExId, webExVersionId, rec) {
            const recommenderName = this._recommenderName(rec) || "unknown";
            return "br-marked-for-" + webExId + "::" + webExVersionId + "::" + recommenderName;
        },

        _findRequirements: function (webExId, webExVersionId, configuration, recs, $changedContainer, data) {
            if (!$.isPlainObject(data)) {
                return false;
            } else if (!$changedContainer || !$changedContainer.jquery || $changedContainer.length !== 1) {
                return false;
            } else if (!$.isArray(recs) || recs.length === 0) {
                return false;
            }

            const hasAttributeActivation = Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true;

            /*
             * Hot path:
             * - always ignore removals
             * - allow added elements
             * - allow attribute changes only for ATTRIBUTE activation and only for data-br-webexpid
             */
            if (data.type === "removed-element") {
                return false;
            } else if (data.type === "attribute-change") {
                if (hasAttributeActivation !== true || data.attribute !== "data-br-webexpid") {
                    return false;
                }
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

                let $resolvedTarget = null;

                if (hasAttributeActivation === true) {
                    $resolvedTarget = this._resolveAttributeAnchorFromMutation(webExId, rec.position, $changedContainer);
                } else {
                    const func = $.isFunction(rec._positionSelector)
                        ? rec._positionSelector
                        : this._createPositionSelector(webExId, configuration, rec.position, rec);
                    rec._positionSelector = func;

                    if (!$.isFunction(func)) {
                        continue;
                    }

                    const recommenderName = this._recommenderName(rec);
                    const $target = func(recommenderName, $changedContainer, data);
                    $resolvedTarget = this._normalizeGenericResolvedTarget($target);
                }

                if ($resolvedTarget === null) {
                    continue;
                }

                const targetEl = $resolvedTarget.get(0);
                const markerKey = this._createMarkerKey(webExId, webExVersionId, rec);
                const alreadySelectedTargets = $.isArray(localSelections[markerKey]) ? localSelections[markerKey] : [];

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

                if (hasAttributeActivation === true) {
                    if (this._validateAndNormalizeAttributeTarget(webExId, rec.position, rec, $resolvedTarget) !== true) {
                        continue;
                    }
                } else {
                    /*
                     * Restore old non-ATTRIBUTE protection.
                     * This is needed especially for before/after/replace where the rendered
                     * container may not be a descendant of the anchor.
                     */
                    if ($resolvedTarget.hasClass(markerContainerClass)) {
                        continue;
                    } else if ($resolvedTarget.data(markerKey) === "true") {
                        continue;
                    } else if (targetEl.querySelector && targetEl.querySelector(markerSelector) !== null) {
                        continue;
                    }

                    $resolvedTarget.data(markerKey, "true");
                }

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
            if (!$target || !$target.jquery || $target.length === 0) {
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
        },

        _resolveAttributeAnchorFromMutation: function (webExId, position, $changedContainer) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            if (normalizedWebExId === null || !$changedContainer || $changedContainer.length !== 1) {
                return null;
            }

            const root = $changedContainer.get(0);
            if (!Breinify.UTL.dom.isNodeType(root, 1)) {
                return null;
            }

            const positionId = Breinify.UTL.isNonEmptyString(position && position.positionId);

            /*
             * Prefer the exact specific anchor inside the changed subtree.
             */
            if (positionId !== null) {
                const $specific = this._findAttributeAnchorInRoot(
                    root,
                    'div[data-br-webexpid="' + normalizedWebExId + '"][data-br-webexppos="' + positionId + '"]'
                );
                if ($specific !== null) {
                    return $specific;
                }
            }

            /*
             * Fallback to a generic anchor inside the changed subtree only.
             * Specific anchors are explicitly excluded.
             */
            return this._findAttributeAnchorInRoot(
                root,
                'div[data-br-webexpid="' + normalizedWebExId + '"]:not([data-br-webexppos])'
            );
        },

        _findAttributeAnchorInRoot: function (root, selector) {
            if (!Breinify.UTL.dom.isNodeType(root, 1)) {
                return null;
            }

            if ($.isFunction(root.matches) && root.matches(selector)) {
                return this._normalizeAttributeResolvedTarget($(root));
            }

            if (!$.isFunction(root.querySelector)) {
                return null;
            }

            return this._normalizeAttributeResolvedTarget($(root.querySelector(selector)));
        },

        _normalizeAttributeResolvedTarget: function ($target) {
            if (!$target || !$target.jquery || $target.length === 0) {
                return null;
            }

            const $resolvedTarget = $target.length === 1 ? $target : $target.eq(0);
            const targetEl = $resolvedTarget.get(0);
            if (!Breinify.UTL.dom.isNodeType(targetEl, 1)) {
                return null;
            } else if (targetEl.tagName !== "DIV") {
                return null;
            } else if (targetEl.isConnected !== true) {
                return null;
            }

            return $resolvedTarget;
        },

        _validateAndNormalizeAttributeTarget: function (webExId, position, recommender, $resolvedTarget) {
            if (!$resolvedTarget || $resolvedTarget.length !== 1) {
                return false;
            }

            const targetEl = $resolvedTarget.get(0);
            if (!Breinify.UTL.dom.isNodeType(targetEl, 1) || targetEl.tagName !== "DIV" || targetEl.isConnected !== true) {
                return false;
            }

            if ($resolvedTarget.is('[data-' + Breinify.plugins.recommendations.marker.container + '="true"]')) {
                return false;
            }

            const existingSelector = this._createRenderedRecommendationSelector(webExId, position, recommender);
            if (existingSelector === null) {
                return false;
            }

            const isSpecificAnchor = this._isSpecificAttributeAnchor(webExId, position, $resolvedTarget);
            if (isSpecificAnchor === true) {
                this._removeRenderedRecommendationsOutsideTarget(webExId, position, recommender, $resolvedTarget);
            }

            return $resolvedTarget.find(existingSelector).length <= 0;
        },

        _removeRenderedRecommendationsOutsideTarget: function (webExId, position, recommender, $currentTarget) {
            const selector = this._createRenderedRecommendationSelector(webExId, position, recommender);
            if (selector === null || !$currentTarget || $currentTarget.length !== 1) {
                return;
            }

            const $rendered = $(selector);
            if ($rendered.length === 0) {
                return;
            }

            $rendered.each(function () {
                const $candidate = $(this);
                if ($currentTarget.has($candidate).length === 0 && !$currentTarget.is($candidate)) {
                    $candidate.remove();
                }
            });
        },

        _isSpecificAttributeAnchor: function (webExId, position, $target) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            const positionId = Breinify.UTL.isNonEmptyString(position && position.positionId);

            if (normalizedWebExId === null || positionId === null || !$target || $target.length !== 1) {
                return false;
            }

            return $target.is('div[data-br-webexpid="' + normalizedWebExId + '"][data-br-webexppos="' + positionId + '"]');
        },

        _resolveAttributeAnchor: function (webExId, position) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            if (normalizedWebExId === null) {
                return null;
            }

            const positionId = Breinify.UTL.isNonEmptyString(position && position.positionId);
            let $anchor = null;

            if (positionId !== null) {
                $anchor = $('div[data-br-webexpid="' + normalizedWebExId + '"][data-br-webexppos="' + positionId + '"]').eq(0);
                $anchor = this._normalizeAttributeResolvedTarget($anchor);
                if ($anchor !== null) {
                    return $anchor;
                }
            }

            $anchor = $('div[data-br-webexpid="' + normalizedWebExId + '"]:not([data-br-webexppos])').eq(0);
            return this._normalizeAttributeResolvedTarget($anchor);
        },

        _createAttributePositionSelector: function (webExId, position, recommender) {
            const _self = this;
            const resolvedRenderTarget = recommender && recommender._resolvedRenderTarget;

            if (Breinify.UTL.dom.isNodeType(resolvedRenderTarget, 1)) {
                return function () {
                    return $(resolvedRenderTarget);
                };
            }

            return function () {
                return _self._resolveAttributeAnchor(webExId, position);
            };
        },

        _createRenderedRecommendationSelector: function (webExId, position, recommender) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            if (normalizedWebExId === null) {
                return null;
            }

            const positionId = Breinify.UTL.isNonEmptyString(position && position.positionId);
            if (positionId !== null) {
                return '[data-br-rec-webexpid="' + normalizedWebExId + '"][data-br-rec-positionid="' + positionId + '"]';
            }

            const recommenderName = this._recommenderName(recommender);
            if (recommenderName !== null) {
                return '[data-br-rec-webexpid="' + normalizedWebExId + '"][data-br-rec-name="' + recommenderName + '"]';
            }

            /*
             * Legacy fallback:
             * if neither positionId nor recommender name is available, we can only identify by webExId.
             */
            return '[data-br-rec-webexpid="' + normalizedWebExId + '"]';
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

            for (let i = 0; i < recs.length; i++) {
                const rec = recs[i];
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
                if ($.isPlainObject(data) && $.isPlainObject(data.onLoad)) {
                    _self.handle(webExId, webExVersionId, data.onLoad);
                }

                if ($.isPlainObject(data) && $.isPlainObject(data.onChange)) {
                    _self.handle(webExId, webExVersionId, data.onChange);
                }
            };
        },

        handle: function (webExId, webExVersionId, config) {
            const recommendations = $.isArray(config && config.recommendations) ? config.recommendations : [];
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