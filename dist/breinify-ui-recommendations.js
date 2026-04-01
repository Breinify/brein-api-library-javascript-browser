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
                onLoadHandling: false,
                /*
                 * Tracks the current anchor resolution state for attribute-based rendering.
                 * This state is used to determine:
                 * - which anchor is currently assigned to each recommender/slot
                 * - whether a fallback or specific anchor is active
                 * - whether previously rendered content must be cleaned up or moved
                 */
                anchorState: {}
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
            const resolvedRenderTarget = singleConfig?._resolvedRenderTarget;

            let renderedPositionId;
            if (Breinify.UTL.dom.isNodeType(resolvedRenderTarget, 1)) {
                renderedPositionId = Breinify.UTL.isNonEmptyString($(resolvedRenderTarget).attr("data-br-webexppos"));
            } else {
                renderedPositionId = Breinify.UTL.isNonEmptyString(singleConfig?.position?.positionId);
            }

            const recommenderName = Breinify.UTL.isNonEmptyString(
                singleConfig?.recommender?.preconfiguredRecommendation
            );

            return {
                webExId: Breinify.UTL.isNonEmptyString(webExId),
                positionId: renderedPositionId,
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
                if (this._isAttributeAnchorChanged(webExId, normalizedRecommendations, runtime) !== true) {
                    return;
                }

                this._cleanUpAttributeActivation(webExId, webExVersionId, runtime);
            }

            try {
                const results = await Promise.all(
                    normalizedRecommendations.map((recommendation) =>
                        Promise.resolve()
                            .then(() => this._handle(webExId, webExVersionId, recommendation, config, runtime))
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
                } else if (Breinify.plugins.webExperiences.hasAttributeActivation(config) === true) {
                    runtime.anchorState = $.isPlainObject(runtime._nextAnchorState) ? runtime._nextAnchorState : {};
                    delete runtime._nextAnchorState;
                }
            } finally {
                if (handlingType === "onLoad") {
                    runtime.onLoadHandling = false;
                }

                delete runtime._nextAnchorState;
            }
        },

        _isAttributeAnchorChanged: function (webExId, recommendations, runtime) {
            if (!$.isPlainObject(runtime?.anchorState)) {
                return false;
            }

            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            const normalizedRecommendations = $.isArray(recommendations) ? recommendations : [];

            if (normalizedWebExId === null || normalizedRecommendations.length === 0) {
                return false;
            }

            const anchorState = $.isPlainObject(runtime._nextAnchorState)
                ? runtime._nextAnchorState
                : runtime.anchorState;
            const nextAnchorState = {};
            let changed = false;

            /*
             * Build the currently available anchors once for this web-experience.
             * This avoids repeated DOM queries for every single recommendation.
             */
            const anchorByPositionId = Object.create(null);
            let fallbackAnchorElement = null;

            const anchorElements = document.querySelectorAll('div[data-br-webexpid="' + normalizedWebExId + '"]');
            for (let i = 0; i < anchorElements.length; i++) {
                const anchorElement = anchorElements[i];
                if (!Breinify.UTL.dom.isNodeType(anchorElement, 1) || anchorElement.isConnected !== true) {
                    continue;
                }

                const anchorPositionId = Breinify.UTL.isNonEmptyString(anchorElement.getAttribute("data-br-webexppos"));
                if (anchorPositionId === null) {
                    if (fallbackAnchorElement === null) {
                        fallbackAnchorElement = anchorElement;
                    }
                } else if (typeof anchorByPositionId[anchorPositionId] === "undefined") {
                    anchorByPositionId[anchorPositionId] = anchorElement;
                }
            }

            for (let i = 0; i < normalizedRecommendations.length; i++) {
                const recommendation = normalizedRecommendations[i];
                if (!$.isPlainObject(recommendation)) {
                    continue;
                }

                const anchorStateKey = this._createAnchorStateKey(normalizedWebExId, recommendation, i);
                if (anchorStateKey === null) {
                    continue;
                }

                const normalizedPositionId = Breinify.UTL.isNonEmptyString(recommendation?.position?.positionId);
                const recommenderName = this._recommenderName(recommendation);

                let anchorElement = null;
                let anchorType = null;

                if (normalizedPositionId !== null &&
                    Breinify.UTL.dom.isNodeType(anchorByPositionId[normalizedPositionId], 1)) {
                    anchorElement = anchorByPositionId[normalizedPositionId];
                    anchorType = "specific";
                } else if (Breinify.UTL.dom.isNodeType(fallbackAnchorElement, 1)) {
                    anchorElement = fallbackAnchorElement;
                    anchorType = "fallback";
                }

                nextAnchorState[anchorStateKey] = {
                    anchorStateKey: anchorStateKey,
                    webExId: normalizedWebExId,
                    recommenderName: recommenderName,
                    configuredPositionId: normalizedPositionId,
                    anchorType: anchorType,
                    anchorElement: anchorElement
                };

                const currentState = $.isPlainObject(anchorState[anchorStateKey]) ? anchorState[anchorStateKey] : null;
                if (currentState === null) {
                    changed = true;
                } else if (currentState.anchorElement !== anchorElement) {
                    changed = true;
                } else if (currentState.anchorType !== anchorType) {
                    changed = true;
                }
            }

            if (changed !== true) {
                const currentKeys = Object.keys(anchorState);
                const nextKeys = Object.keys(nextAnchorState);

                if (currentKeys.length !== nextKeys.length) {
                    changed = true;
                } else {
                    for (let i = 0; i < currentKeys.length; i++) {
                        const key = currentKeys[i];
                        if (!$.isPlainObject(nextAnchorState[key])) {
                            changed = true;
                            break;
                        }
                    }
                }
            }

            runtime._nextAnchorState = nextAnchorState;
            return changed;
        },

        _cleanUpAttributeActivation: function (webExId, webExVersionId, runtime) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            if (normalizedWebExId === null || !$.isPlainObject(runtime?.anchorState)) {
                return;
            }

            Object.keys(runtime.anchorState).forEach(function (anchorStateKey) {
                const state = runtime.anchorState[anchorStateKey];
                const anchorElement = state && state.anchorElement;
                if (Breinify.UTL.dom.isNodeType(anchorElement, 1)) {
                    $(anchorElement)
                        .children('[data-br-rec-webexpid="' + normalizedWebExId + '"]')
                        .remove();
                }
            });

            runtime.anchorState = {};
        },

        _handle: async function (webExId, webExVersionId, singleConfig, configuration, runtime) {
            if (!$.isPlainObject(singleConfig)) {
                return null;
            }

            const extensionModule = this._getExtensionModule();

            const frameworkConfig = {};
            frameworkConfig.recommender = await this._createPayload(singleConfig.recommender);
            frameworkConfig.activity = this._createActivitySettings(singleConfig);
            frameworkConfig.splitTests = this._createSplitTestsSettings(webExId, configuration, singleConfig);
            frameworkConfig.position = this._createPosition(webExId, configuration, singleConfig, runtime);
            frameworkConfig.placeholders = this._createPlaceholders(singleConfig.placeholders);
            frameworkConfig.templates = this._createTemplates(singleConfig.templates);
            frameworkConfig.process = this._createProcess(webExId, webExVersionId, configuration, singleConfig);
            frameworkConfig.meta = {
                renderIdentity: this._createRenderIdentity(webExId, singleConfig)
            };

            if (!$.isFunction(extensionModule?.create) &&
                !$.isFunction(extensionModule?.finalize) &&
                !$.isFunction(extensionModule?.style)) {
                this._applyStyle(singleConfig.style);
                return frameworkConfig;
            }

            const context = {
                webExId: webExId,
                webExVersionId: webExVersionId,
                configuration: $.isPlainObject(configuration) ? configuration : {},
                runtime: $.isPlainObject(runtime) ? runtime : {},
                recommenderName: this._recommenderName(singleConfig),

                ensurePath: function (obj, path, factory) {
                    const root = $.isPlainObject(obj) ? obj : {};
                    const keys = $.isArray(path) ? path : Array.prototype.slice.call(arguments, 1, -1);
                    const create = $.isFunction(factory) ? factory : function () {
                        return null;
                    };

                    let current = root;
                    $.each(keys, function (idx, key) {
                        if (typeof key !== "string" || key === "") {
                            return;
                        }

                        if (typeof current[key] === "undefined" || current[key] === null) {
                            current[key] = create(key, idx, keys);
                        }

                        current = current[key];
                    });

                    return root;
                },

                ensureObject: function (obj) {
                    const path = Array.prototype.slice.call(arguments, 1);
                    return this.ensurePath(obj, path, function () {
                        return {};
                    });
                },

                ensureArray: function (obj) {
                    const path = Array.prototype.slice.call(arguments, 1);
                    return this.ensurePath(obj, path, function () {
                        return [];
                    });
                },

                mergeArray: function (target, values, removeDuplicates) {
                    const result = $.isArray(target) ? target.slice() : [];
                    const additions = $.isArray(values) ? values : [];

                    $.each(additions, function (idx, value) {
                        if (!removeDuplicates || $.inArray(value, result) === -1) {
                            result.push(value);
                        }
                    });

                    return result;
                }
            };

            const createdConfig = this._applyExtensionHook(context, {}, "create", extensionModule);
            let config = this._mergeConfig(frameworkConfig, createdConfig);
            config = this._applyExtensionHook(context, config, "finalize", extensionModule);

            this._applyStyle(singleConfig.style);

            if ($.isFunction(extensionModule?.style)) {
                this._applyExtensionStyle(context, extensionModule);
            }

            /*
             * TODO:
             *  - add: bindings (bindings.selector <-- singleConfig)
             *  - add: modifications (data.modify <-- singleConfig.modifyData)
             */
            return config;
        },

        _applyExtensionHook: function (context, config, methodName, extensionModule) {
            const normalizedMethodName = Breinify.UTL.isNonEmptyString(methodName);
            const extensionMethod = normalizedMethodName === null ? null : extensionModule?.[normalizedMethodName];
            if (!$.isFunction(extensionMethod)) {
                return config;
            }

            try {
                const result = extensionMethod(context, config);
                return $.isPlainObject(result) ? result : config;
            } catch (e) {
                console.error(e);
                return config;
            }
        },

        _applyExtensionStyle: function (context, extensionModule) {
            if (!$.isFunction(extensionModule?.style)) {
                return;
            }

            try {
                const result = extensionModule.style(context);
                const styleEntries = $.isArray(result) ? result : [result];

                for (let i = 0; i < styleEntries.length; i++) {
                    const styleEntry = styleEntries[i];
                    if (!$.isPlainObject(styleEntry)) {
                        continue;
                    }

                    const styleId = Breinify.UTL.isNonEmptyString(styleEntry.id);
                    const css = Breinify.UTL.isNonEmptyString(styleEntry.css);

                    if (styleId === null || css === null) {
                        continue;
                    }

                    const domStyleId = "br-ui-recommendations-style-" + styleId;
                    if (document.getElementById(domStyleId) !== null) {
                        continue;
                    }

                    const styleEl = document.createElement("style");
                    styleEl.id = domStyleId;
                    styleEl.type = "text/css";
                    styleEl.appendChild(document.createTextNode(css));
                    document.head.appendChild(styleEl);
                }
            } catch (e) {
                console.error(e);
            }
        },

        _getExtensionModule: function () {
            if (!$.isFunction(Breinify?.plugins?.api?.getModule)) {
                return null;
            }

            const extensionModule = Breinify.plugins.api.getModule("uiRecommendationsConfig");
            return $.isPlainObject(extensionModule) ? extensionModule : null;
        },

        _mergeFunction: function (frameworkFunc, extensionFunc, extensionFirst) {
            const normalizedFrameworkFunc = $.isFunction(frameworkFunc) ? frameworkFunc : null;
            const normalizedExtensionFunc = $.isFunction(extensionFunc) ? extensionFunc : null;

            if (normalizedFrameworkFunc === null) {
                return normalizedExtensionFunc;
            } else if (normalizedExtensionFunc === null) {
                return normalizedFrameworkFunc;
            } else {
                return function () {
                    if (extensionFirst === true) {
                        normalizedExtensionFunc.apply(this, arguments);
                        return normalizedFrameworkFunc.apply(this, arguments);
                    } else {
                        normalizedFrameworkFunc.apply(this, arguments);
                        return normalizedExtensionFunc.apply(this, arguments);
                    }
                };
            }
        },

        _mergeConfig: function (frameworkConfig, initialConfig) {
            const normalizedFrameworkConfig = $.isPlainObject(frameworkConfig) ? frameworkConfig : {};
            const normalizedInitialConfig = $.isPlainObject(initialConfig) ? initialConfig : {};

            const mergedConfig = $.extend(true, {}, normalizedFrameworkConfig, normalizedInitialConfig);

            const frameworkProcess = $.isPlainObject(normalizedFrameworkConfig.process)
                ? normalizedFrameworkConfig.process
                : {};
            const initialProcess = $.isPlainObject(normalizedInitialConfig.process)
                ? normalizedInitialConfig.process
                : {};

            const mergedProcess = {};
            const processKeys = {};

            Object.keys(frameworkProcess).forEach(function (key) {
                processKeys[key] = true;
            });
            Object.keys(initialProcess).forEach(function (key) {
                processKeys[key] = true;
            });

            Object.keys(processKeys).forEach((key) => {
                const frameworkValue = frameworkProcess[key];
                const initialValue = initialProcess[key];

                if ($.isFunction(frameworkValue) || $.isFunction(initialValue)) {
                    mergedProcess[key] = this._mergeFunction(frameworkValue, initialValue, true);
                } else if (typeof initialValue !== "undefined") {
                    mergedProcess[key] = initialValue;
                } else {
                    mergedProcess[key] = frameworkValue;
                }
            });

            mergedConfig.process = mergedProcess;
            return mergedConfig;
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

        _createAnchorStateKey: function (webExId, singleConfig, index) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            const positionId = Breinify.UTL.isNonEmptyString(singleConfig?.position?.positionId);

            if (normalizedWebExId === null) {
                return null;
            }

            if (positionId !== null) {
                return normalizedWebExId + "::pos::" + positionId;
            }

            return normalizedWebExId + "::fallback::" + index;
        },

        _createProcess: function (webExId, webExVersionId, configuration, singleConfig) {
            const processConfig = $.isPlainObject(singleConfig?.process) ? singleConfig.process : {};
            let resolvedProcesses = Object.fromEntries(
                Object.entries(processConfig).flatMap(([key, value]) => {
                    if ($.isFunction(value)) {
                        return [[key, value]];
                    }

                    const func = this._getSnippetFunction(value);
                    return func == null ? [] : [[key, func]];
                })
            );

            // hook into the createActivity
            const originalCreateActivity = $.isFunction(resolvedProcesses.createActivity)
                ? resolvedProcesses.createActivity
                : null;
            resolvedProcesses.createActivity = function (event, settings) {
                if ($.isFunction(originalCreateActivity)) {
                    originalCreateActivity.call(this, event, settings);
                }

                settings.activityTags = $.isPlainObject(settings.activityTags) ? settings.activityTags : {};
                settings.activityTags.campaignWebExId = webExVersionId;
            };

            // for attribute based activation we also hook into the attachedContainer
            if (Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true) {
                const originalAttachedContainer = $.isFunction(resolvedProcesses.attachedContainer)
                    ? resolvedProcesses.attachedContainer
                    : null;

                resolvedProcesses.attachedContainer = function ($container, $itemContainer, data, option) {
                    const isControl = $.isPlainObject(data?.splitTestData) && data.splitTestData.isControl === true;
                    if (isControl !== true) {
                        const controlSelector = Breinify.UTL.isNonEmptyString(option?.splitTests?.control?.containerSelector);
                        if (controlSelector !== null) {
                            document.querySelectorAll(controlSelector).forEach(function (controlElement) {
                                if (Breinify.UTL.dom.isNodeType(controlElement, 1)) {
                                    controlElement.style.setProperty("display", "none", "important");
                                }
                            });
                        }
                    }

                    if ($.isFunction(originalAttachedContainer)) {
                        originalAttachedContainer.call(this, $container, $itemContainer, data, option);
                    }
                };
            }

            return resolvedProcesses;
        },

        _createPosition: function (webExId, configuration, singleConfig, runtime) {
            const normalizedPosition = $.isPlainObject(singleConfig?.position) ? singleConfig.position : {};
            if (Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true) {
                return this._createAttributeActivationPosition(webExId, normalizedPosition, singleConfig, runtime);
            }

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

        _createAttributeActivationPosition: function (webExId, position, singleConfig, runtime) {
            const _self = this;

            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            const normalizedPositionId = Breinify.UTL.isNonEmptyString(position?.positionId);

            return {
                append: function () {
                    if (normalizedWebExId === null) {
                        return $();
                    }

                    const anchor = _self._determineAnchor(normalizedWebExId, normalizedPositionId);
                    return anchor.$anchor;
                }
            };
        },

        _determineAnchor: function (webExId, positionId) {
            if (positionId !== null) {
                const specificAnchorElement = document.querySelector('div[data-br-webexpid="' + webExId + '"][data-br-webexppos="' + positionId + '"]');
                if (Breinify.UTL.dom.isNodeType(specificAnchorElement, 1) && specificAnchorElement.isConnected === true) {
                    return {
                        $anchor: $(specificAnchorElement),
                        type: "specific"
                    };
                }
            }

            const fallbackAnchorElement = document.querySelector('div[data-br-webexpid="' + webExId + '"]:not([data-br-webexppos])');
            if (Breinify.UTL.dom.isNodeType(fallbackAnchorElement, 1) && fallbackAnchorElement.isConnected === true) {
                return {
                    $anchor: $(fallbackAnchorElement),
                    type: "fallback"
                };
            }

            return {
                $anchor: $(),
                type: null
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

        _createSplitTestsSettings: function (webExId, configuration, singleConfig) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            const splitTestControl = $.isPlainObject(singleConfig?.splitTestControl) ? singleConfig.splitTestControl : null;
            const containerSelector = $.isPlainObject(splitTestControl) ? Breinify.UTL.isNonEmptyString(splitTestControl.selector) : null;

            if (containerSelector !== null) {
                return {
                    control: {
                        containerSelector: containerSelector
                    }
                };
            } else if (normalizedWebExId !== null && Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true) {
                return {
                    control: {
                        containerSelector: '[data-br-ctrl-webexpid="' + normalizedWebExId + '"]'
                    }
                };
            } else {
                return {};
            }
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