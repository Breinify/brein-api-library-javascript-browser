"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    }
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
                onLoadHandling: false,
                attributeReservations: {}
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
            let renderedPositionId = null;

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

        _createAttributeReservationKey: function (webExId, webExVersionId, recommender) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            const normalizedWebExVersionId = Breinify.UTL.isNonEmptyString(webExVersionId);
            const recommenderName = this._recommenderName(recommender);

            if (normalizedWebExId === null ||
                normalizedWebExVersionId === null ||
                recommenderName === null) {
                return null;
            }

            return normalizedWebExId + "::" + normalizedWebExVersionId + "::" + recommenderName;
        },

        _reserveAttributeTarget: function (webExId, webExVersionId, recommender, $target) {
            const runtime = this.getRuntime(webExVersionId);
            const reservationKey = this._createAttributeReservationKey(webExId, webExVersionId, recommender);

            if (runtime === null ||
                reservationKey === null ||
                !$target ||
                !$target.jquery ||
                $target.length !== 1) {
                return null;
            }

            const reservationId = Breinify.UTL.uuid();
            runtime.attributeReservations[reservationKey] = {
                id: reservationId,
                target: $target.get(0)
            };

            return {
                key: reservationKey,
                id: reservationId
            };
        },

        _matchesAttributeReservation: function (webExVersionId, reservationKey, reservationId, targetEl) {
            const runtime = this.getRuntime(webExVersionId);
            if (runtime === null ||
                !$.isPlainObject(runtime.attributeReservations) ||
                typeof reservationKey !== "string" ||
                typeof reservationId !== "string") {
                return false;
            }

            const reservation = runtime.attributeReservations[reservationKey];
            if (!$.isPlainObject(reservation)) {
                return false;
            }

            if (reservation.id !== reservationId) {
                return false;
            }

            if (typeof targetEl !== "undefined" && reservation.target !== targetEl) {
                return false;
            }

            return true;
        },

        _releaseAttributeReservation: function (webExVersionId, reservationKey, reservationId) {
            const runtime = this.getRuntime(webExVersionId);
            if (runtime === null ||
                !$.isPlainObject(runtime.attributeReservations) ||
                typeof reservationKey !== "string") {
                return;
            }

            const reservation = runtime.attributeReservations[reservationKey];
            if (!$.isPlainObject(reservation)) {
                return;
            }

            if (typeof reservationId === "string" && reservation.id !== reservationId) {
                return;
            }

            delete runtime.attributeReservations[reservationKey];
        },

        _releaseAttributeReservationForConfig: function (webExVersionId, config) {
            const reservationKey = Breinify.UTL.isNonEmptyString(config?._attributeReservationKey);
            const reservationId = Breinify.UTL.isNonEmptyString(config?._attributeReservationId);

            if (reservationKey === null) {
                return;
            }

            this._releaseAttributeReservation(webExVersionId, reservationKey, reservationId);
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

            try {
                const results = await Promise.all(
                    normalizedRecommendations.map((recommendation) =>
                        Promise.resolve()
                            .then(() => this._handle(webExId, webExVersionId, recommendation, config))
                            .catch((err) => {
                                console.error(err);
                                this._releaseAttributeReservationForConfig(webExVersionId, recommendation);
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

        _handle: async function (webExId, webExVersionId, singleConfig, configuration) {
            if (!$.isPlainObject(singleConfig)) {
                return null;
            }

            const hasAttributeActivation = Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true;
            const effectiveConfig = $.extend(true, {}, singleConfig);

            if (hasAttributeActivation === true) {
                let $resolvedTarget = null;
                const existingResolvedRenderTarget = effectiveConfig._resolvedRenderTarget;

                if (Breinify.UTL.dom.isNodeType(existingResolvedRenderTarget, 1)) {
                    $resolvedTarget = this._normalizeAttributeResolvedTarget($(existingResolvedRenderTarget));
                } else {
                    $resolvedTarget = this._resolveAttributeAnchor(webExId, effectiveConfig.position);
                }

                if ($resolvedTarget === null) {
                    this._releaseAttributeReservationForConfig(webExVersionId, effectiveConfig);
                    return null;
                }

                const reservationKey = Breinify.UTL.isNonEmptyString(effectiveConfig._attributeReservationKey);
                const reservationId = Breinify.UTL.isNonEmptyString(effectiveConfig._attributeReservationId);
                if (reservationKey !== null &&
                    reservationId !== null &&
                    this._matchesAttributeReservation(
                        webExVersionId,
                        reservationKey,
                        reservationId,
                        $resolvedTarget.get(0)
                    ) !== true) {
                    this._releaseAttributeReservationForConfig(webExVersionId, effectiveConfig);
                    return null;
                }

                if (this._validateAndNormalizeAttributeTarget(
                    webExId,
                    effectiveConfig.position,
                    effectiveConfig,
                    $resolvedTarget
                ) !== true) {
                    this._releaseAttributeReservationForConfig(webExVersionId, effectiveConfig);
                    return null;
                }

                effectiveConfig._resolvedRenderTarget = $resolvedTarget.get(0);
            }

            const config = {};
            config.recommender = await this._createPayload(effectiveConfig.recommender);
            config.activity = this._createActivitySettings(effectiveConfig);
            config.splitTests = this._createSplitTestsSettings(effectiveConfig.splitTestControl);
            config.position = this._createPosition(webExId, configuration, effectiveConfig.position, effectiveConfig);
            config.placeholders = this._createPlaceholders(effectiveConfig.placeholders);
            config.templates = this._createTemplates(effectiveConfig.templates);
            config.process = this._createProcess(webExId, webExVersionId, effectiveConfig.process, effectiveConfig);
            config.meta = {
                renderIdentity: this._createRenderIdentity(webExId, effectiveConfig)
            };

            this._applyStyle(effectiveConfig.style);

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
            const originalFinalize = $.isFunction(resolvedProcesses.finalize)
                ? resolvedProcesses.finalize
                : null;

            resolvedProcesses.createActivity = function (event, settings) {
                if ($.isFunction(originalCreateActivity)) {
                    originalCreateActivity.call(this, event, settings);
                }

                settings.activityTags.campaignWebExId = webExVersionId;
            };

            resolvedProcesses.finalize = ($option, result, $container) => {
                try {
                    const resolvedRenderTarget = recommenderConfig?._resolvedRenderTarget;
                    if (Breinify.UTL.dom.isNodeType(resolvedRenderTarget, 1)) {
                        const $activeTarget = this._normalizeAttributeResolvedTarget($(resolvedRenderTarget));
                        if ($activeTarget !== null) {
                            this._cleanupStaleAttributeRenderedRecommendations(
                                webExId,
                                recommenderConfig.position,
                                recommenderConfig,
                                $activeTarget
                            );
                        }
                    }
                } finally {
                    this._releaseAttributeReservationForConfig(webExVersionId, recommenderConfig);

                    if ($.isFunction(originalFinalize)) {
                        originalFinalize.call(this, $option, result, $container);
                    }
                }
            };

            return resolvedProcesses;
        },

        _createPosition: function (webExId, configuration, position, singleConfig) {
            const normalizedPosition = $.isPlainObject(position) ? position : {};
            const hasAttributeActivation = Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true;
            const func = this._createPositionSelector(webExId, configuration, normalizedPosition, singleConfig);

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

            let operation = Breinify.UTL.isNonEmptyString(normalizedPosition.operation);
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

            const runtime = this.getRuntime(webExVersionId);
            if (runtime === null) {
                return false;
            }

            const hasAttributeActivation = Breinify.plugins.webExperiences.hasAttributeActivation(configuration) === true;

            if (hasAttributeActivation === true) {
                if (data.type === "attribute-change") {
                    if (data.attribute !== "data-br-webexpid" && data.attribute !== "data-br-webexppos") {
                        return false;
                    }
                } else if (data.type === "added-element" || data.type === "removed-element" || data.type === "full-scan") {
                    if (data.type !== "full-scan" &&
                        this._hasRelevantAttributeMutationRoot(webExId, $changedContainer) !== true) {
                        return false;
                    }
                } else {
                    return false;
                }
            } else {
                if (data.type === "removed-element") {
                    return false;
                } else if (data.type === "attribute-change") {
                    return false;
                } else if (data.type !== "added-element" && data.type !== "full-scan") {
                    return false;
                }
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

                if (hasAttributeActivation === true) {
                    if (this._validateAndNormalizeAttributeTarget(webExId, rec.position, rec, $resolvedTarget) !== true) {
                        continue;
                    }

                    const reservation = this._reserveAttributeTarget(webExId, webExVersionId, rec, $resolvedTarget);
                    if (reservation === null) {
                        continue;
                    }

                    if (!$.isArray(localSelections[markerKey])) {
                        localSelections[markerKey] = [];
                    }
                    localSelections[markerKey].push(targetEl);

                    const selectedRec = $.extend(true, {}, rec);
                    selectedRec._resolvedRenderTarget = targetEl;
                    selectedRec._attributeReservationKey = reservation.key;
                    selectedRec._attributeReservationId = reservation.id;
                    selectedRecs.push(selectedRec);
                } else {
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
        },

        _hasRelevantAttributeMutationRoot: function (webExId, $changedContainer) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            if (normalizedWebExId === null || !$changedContainer?.jquery || $changedContainer.length !== 1) {
                return false;
            }

            const root = $changedContainer.get(0);
            if (!Breinify.UTL.dom.isNodeType(root, 1)) {
                return false;
            }

            const selector =
                'div[data-br-webexpid="' + normalizedWebExId + '"],' +
                '[data-br-rec-webexpid="' + normalizedWebExId + '"]';

            if ($.isFunction(root.matches) && root.matches(selector)) {
                return true;
            }

            if (!$.isFunction(root.querySelector)) {
                return false;
            }

            return root.querySelector(selector) !== null;
        },

        _resolveAttributeAnchorFromMutation: function (webExId, position, $changedContainer) {
            if (this._hasRelevantAttributeMutationRoot(webExId, $changedContainer) !== true) {
                return null;
            }

            return this._resolveAttributeAnchor(webExId, position);
        },

        _normalizeAttributeResolvedTarget: function ($target) {
            if (!$target?.jquery || $target.length === 0) {
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

        _getRenderedRecommendationMeta: function ($candidate) {
            if (!$candidate?.jquery || $candidate.length !== 1) {
                return null;
            }

            return {
                webExId: Breinify.UTL.isNonEmptyString($candidate.attr("data-br-rec-webexpid")),
                positionId: Breinify.UTL.isNonEmptyString($candidate.attr("data-br-rec-positionid")),
                recommenderName: Breinify.UTL.isNonEmptyString($candidate.attr("data-br-rec-name"))
            };
        },

        _matchesLogicalRecommenderIdentity: function (meta, webExId, configuredPositionId, recommenderName) {
            if (!$.isPlainObject(meta)) {
                return false;
            }

            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            const normalizedRecommenderName = Breinify.UTL.isNonEmptyString(recommenderName);

            if (Breinify.UTL.isNonEmptyString(meta.webExId) !== normalizedWebExId) {
                return false;
            }

            /*
             * A recommender is logically unique by webExId + recommenderName.
             * Position only decides where it should live right now, not whether
             * an already-rendered block belongs to the same logical recommender.
             */
            if (normalizedRecommenderName !== null) {
                return Breinify.UTL.isNonEmptyString(meta.recommenderName) === normalizedRecommenderName;
            }

            return false;
        },

        _matchesRenderedRecommendationIdentity: function (meta, webExId, positionId, recommenderName) {
            if (!$.isPlainObject(meta)) {
                return false;
            }

            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            const normalizedPositionId = Breinify.UTL.isNonEmptyString(positionId);
            const normalizedRecommenderName = Breinify.UTL.isNonEmptyString(recommenderName);

            if (Breinify.UTL.isNonEmptyString(meta.webExId) !== normalizedWebExId) {
                return false;
            }

            if (normalizedPositionId !== null) {
                return Breinify.UTL.isNonEmptyString(meta.positionId) === normalizedPositionId;
            }

            if (Breinify.UTL.isNonEmptyString(meta.positionId) !== null) {
                return false;
            }

            if (normalizedRecommenderName !== null) {
                return Breinify.UTL.isNonEmptyString(meta.recommenderName) === normalizedRecommenderName;
            }

            return true;
        },

        _cleanupStaleAttributeRenderedRecommendations: function (webExId, position, recommender, $activeTarget) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            if (normalizedWebExId === null || !$activeTarget?.jquery || $activeTarget.length !== 1) {
                return false;
            }

            const activePositionId = Breinify.UTL.isNonEmptyString($activeTarget.attr("data-br-webexppos"));
            const recommenderName = this._recommenderName(recommender);
            const activeTargetEl = $activeTarget.get(0);

            let hasExactMatchAtActiveTarget = false;

            $('div[data-br-webexpid="' + normalizedWebExId + '"]').each((idx, anchorEl) => {
                const $anchor = $(anchorEl);
                const isActiveAnchor = anchorEl === activeTargetEl;
                const $rendered = $anchor.children('[data-br-rec-webexpid="' + normalizedWebExId + '"]');

                $rendered.each((renderIdx, renderEl) => {
                    const $candidate = $(renderEl);
                    const meta = this._getRenderedRecommendationMeta($candidate);

                    if (this._matchesLogicalRecommenderIdentity(
                        meta,
                        normalizedWebExId,
                        null,
                        recommenderName
                    ) !== true) {
                        return;
                    }

                    /*
                     * Any matching logical recommender rendered in a non-active anchor
                     * is stale and must be removed.
                     */
                    if (isActiveAnchor !== true) {
                        $candidate.remove();
                        return;
                    }

                    /*
                     * Inside the active anchor, keep only the exact match for the current
                     * rendered identity and remove everything else.
                     */
                    if (this._matchesRenderedRecommendationIdentity(
                        meta,
                        normalizedWebExId,
                        activePositionId,
                        recommenderName
                    ) === true) {
                        if (hasExactMatchAtActiveTarget === true) {
                            $candidate.remove();
                        } else {
                            hasExactMatchAtActiveTarget = true;
                        }
                    } else {
                        $candidate.remove();
                    }
                });
            });

            return hasExactMatchAtActiveTarget;
        },

        _validateAndNormalizeAttributeTarget: function (webExId, position, recommender, $resolvedTarget) {
            if (!$resolvedTarget?.jquery || $resolvedTarget.length !== 1) {
                return false;
            }

            const targetEl = $resolvedTarget.get(0);
            if (!Breinify.UTL.dom.isNodeType(targetEl, 1) ||
                targetEl.tagName !== "DIV" ||
                targetEl.isConnected !== true) {
                return false;
            }

            if ($resolvedTarget.is('[data-' + Breinify.plugins.recommendations.marker.container + '="true"]')) {
                return false;
            }

            const anchorWebExpId = Breinify.UTL.isNonEmptyString($resolvedTarget.attr("data-br-webexpid"));
            if (anchorWebExpId !== Breinify.UTL.isNonEmptyString(webExId)) {
                return false;
            }

            const hasExactMatch = this._cleanupStaleAttributeRenderedRecommendations(
                webExId,
                position,
                recommender,
                $resolvedTarget
            );

            return hasExactMatch !== true;
        },

        _resolveAttributeAnchor: function (webExId, position) {
            const normalizedWebExId = Breinify.UTL.isNonEmptyString(webExId);
            if (normalizedWebExId === null) {
                return null;
            }

            const positionId = Breinify.UTL.isNonEmptyString(position?.positionId);
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
            const resolvedRenderTarget = recommender?._resolvedRenderTarget;

            if (Breinify.UTL.dom.isNodeType(resolvedRenderTarget, 1)) {
                return function () {
                    return $(resolvedRenderTarget);
                };
            }

            return function () {
                return _self._resolveAttributeAnchor(webExId, position);
            };
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