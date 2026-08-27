"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("uiModifyContent")) {
        return;
    }

    const $ = Breinify.UTL._jquery();

    const WEB_EXPERIENCE_SNIPPET_PREFIX = "web-experience:";
    const DEFAULT_DECISION_SERVICE = "webExperienceDecision";
    const DEFAULT_ACTION_GROUP = "_default";
    const FAILURE_ACTION_GROUP = "_failure";

    const SNIPPET_SETTING_JAVASCRIPT = "js";
    const SNIPPET_SETTING_CSS = "css";
    const SNIPPET_TYPE_JAVASCRIPT = "javascript";
    const SNIPPET_TYPE_CSS = "css";

    const DECISION_STATUS_IDLE = "idle";
    const DECISION_STATUS_PENDING = "pending";
    const DECISION_STATUS_RESOLVED = "resolved";
    const DECISION_STATUS_FAILED = "failed";

    /*
     * Action implementations are isolated by type. New actions belong here;
     * the runtime coordinator only resolves and invokes them. Methods prefixed
     * with _ are private helpers of the individual action implementation.
     */
    const actions = {

        /**
         * Writes the configured message to the browser console. This is the
         * initial Modify Content action used to verify lifecycle handling.
         */
        writeToConsole: {
            execute: function (action) {
                const settings = action && action.settings;
                console.log(settings && settings.message);
            }
        },

        /**
         * Applies the configured HTML operation to matching targets, subject
         * to the optional maxApplications limit. The action owns its
         * operation-specific behavior while the runtime coordinator provides
         * target discovery and duplicate tracking.
         */
        changeContent: {
            isDomAction: true,

            execute: function (action, runtime, actionIndex) {
                if (_private.hasReachedApplicationLimit(runtime, actionIndex, action)) {
                    return;
                }

                const settings = _private.getActionSettings(action);
                const content = settings && typeof settings.content === "string" ? settings.content : null;
                const allowHtml = settings && settings.allowHtml === true;
                const targets = _private.getTargets(action, null);
                let applied = false;

                for (let i = 0; i < targets.length; i++) {
                    if (_private.hasReachedApplicationLimit(runtime, actionIndex, action)) {
                        break;
                    }

                    const target = targets[i];
                    if (_private.hasAppliedTarget(runtime, actionIndex, target)) {
                        continue;
                    }

                    if (_private.applyDomOperation(target, settings && settings.operation, content, allowHtml)) {
                        _private.markAppliedTarget(runtime, actionIndex, target);
                        _private.markApplication(runtime, actionIndex);
                        applied = true;
                    }
                }

                /*
                 * An inserted HTML fragment may itself match the configured
                 * selector. Mark current matches after the operation so the
                 * DOM observer cannot immediately apply the same action
                 * recursively. Newly rendered nodes added later remain
                 * eligible.
                */
                if (applied) {
                    const currentTargets = _private.getTargets(action, null);
                    _private.markAppliedTargets(runtime, actionIndex, currentTargets);
                }
            },

        },

        /**
         * Replaces or inserts structured image content. The replace operation
         * resolves an image root directly or finds the single image root in a
         * selected container.
         */
        changeImage: {
            isDomAction: true,

            findRequirements: function (runtime, action, actionIndex, root, data) {
                if (_private.hasReachedApplicationLimit(runtime, actionIndex, action)) {
                    return false;
                }

                const candidates = _private.getTargets(action, root);
                const operation = action && action.settings && typeof action.settings.operation === "string"
                    ? action.settings.operation.toLowerCase()
                    : null;
                const changeType = data && data.type ? data.type : "full-scan";
                if (changeType === "full-scan") {
                    return candidates.length > 0;
                }

                const targets = operation === "replace"
                    ? this._resolveReplacementTargets(candidates, action.settings)
                    : candidates;
                for (let i = 0; i < targets.length; i++) {
                    if (!_private.hasAppliedTarget(runtime, actionIndex, targets[i])) {
                        return true;
                    }
                }

                return false;
            },

            execute: function (action, runtime, actionIndex) {
                if (_private.hasReachedApplicationLimit(runtime, actionIndex, action)) {
                    return;
                }

                const settings = _private.getActionSettings(action);
                const operation = settings && typeof settings.operation === "string"
                    ? settings.operation.toLowerCase()
                    : null;
                const candidates = _private.getTargets(action, null);
                const targets = operation === "replace"
                    ? this._resolveReplacementTargets(candidates, settings)
                    : candidates;
                let applied = false;

                for (let i = 0; i < targets.length; i++) {
                    if (_private.hasReachedApplicationLimit(runtime, actionIndex, action)) {
                        break;
                    }

                    const target = targets[i];
                    if (_private.hasAppliedTarget(runtime, actionIndex, target)) {
                        continue;
                    }

                    const replacement = this._createImageStructure(settings && settings.render, target);
                    if (replacement !== null &&
                        _private.applyDomOperation(target, operation, replacement, false)) {
                        _private.markAppliedTarget(runtime, actionIndex, target);
                        _private.markApplication(runtime, actionIndex);
                        applied = true;
                    }
                }

                if (applied) {
                    const currentCandidates = _private.getTargets(action, null);
                    const currentTargets = operation === "replace"
                        ? this._resolveReplacementTargets(currentCandidates, settings)
                        : currentCandidates;
                    _private.markAppliedTargets(runtime, actionIndex, currentTargets);
                }
            },

            _resolveReplacementTargets: function (candidates, settings) {
                const render = settings && settings.render;
                const renderType = render && typeof render.type === "string" ? render.type.toLowerCase() : null;
                const targets = [];
                const addTarget = function (target) {
                    if (target && targets.indexOf(target) === -1) {
                        targets.push(target);
                    }
                };

                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i];
                    const tagName = candidate && candidate.tagName ? candidate.tagName.toLowerCase() : null;
                    if (tagName === "picture") {
                        addTarget(candidate);
                    } else if (tagName === "img") {
                        if (renderType === "picture") {
                            const picture = this._findParent(candidate, "picture");
                            addTarget(picture || candidate);
                        } else {
                            addTarget(candidate);
                        }
                    } else {
                        const pictures = candidate && candidate.querySelectorAll
                            ? candidate.querySelectorAll("picture")
                            : [];
                        const images = candidate && candidate.querySelectorAll
                            ? candidate.querySelectorAll("img")
                            : [];
                        const imageRoots = [];
                        for (let j = 0; j < pictures.length; j++) {
                            imageRoots.push(pictures[j]);
                        }
                        for (let j = 0; j < images.length; j++) {
                            if (!this._findParent(images[j], "picture")) {
                                imageRoots.push(images[j]);
                            }
                        }

                        if (imageRoots.length === 1) {
                            addTarget(imageRoots[0]);
                        }
                    }
                }

                return targets;
            },

            _findParent: function (element, tagName) {
                let current = element && element.parentElement;
                while (current) {
                    if (current.tagName && current.tagName.toLowerCase() === tagName) {
                        return current;
                    }
                    current = current.parentElement;
                }

                return null;
            },

            _createImageStructure: function (render, target) {
                if (!render || typeof render !== "object" || !render.image ||
                    typeof document !== "object" || typeof document.createElement !== "function") {
                    return null;
                }

                const renderType = typeof render.type === "string" ? render.type.toLowerCase() : null;
                if (renderType === "img") {
                    const image = document.createElement("img");
                    const sourceImage = target && target.tagName && target.tagName.toLowerCase() === "img"
                        ? target
                        : null;
                    this._applyElementSettings(image, render, sourceImage);
                    this._applyImageSettings(image, render.image, sourceImage);
                    return image;
                } else if (renderType !== "picture") {
                    return null;
                }

                const picture = document.createElement("picture");
                const sourcePicture = target && target.tagName && target.tagName.toLowerCase() === "picture"
                    ? target
                    : null;
                this._applyElementSettings(picture, render, sourcePicture);
                const sources = Array.isArray(render.sources) ? render.sources : [];
                for (let i = 0; i < sources.length; i++) {
                    const sourceSettings = sources[i];
                    if (!sourceSettings || typeof sourceSettings !== "object") {
                        continue;
                    }

                    const source = document.createElement("source");
                    this._applyAttribute(source, "media", sourceSettings.media);
                    this._applyAttribute(source, "type", sourceSettings.type);
                    this._applyAttribute(source, "sizes", sourceSettings.sizes);
                    this._applyAttribute(source, "srcset", this._serializeSrcSet(sourceSettings.srcset));
                    picture.appendChild(source);
                }

                const image = document.createElement("img");
                const sourceImage = sourcePicture && sourcePicture.querySelector
                    ? sourcePicture.querySelector("img")
                    : null;
                this._applyImageSettings(image, render.image, sourceImage);
                picture.appendChild(image);
                return picture;
            },

            _applyImageSettings: function (image, settings, sourceImage) {
                this._applyElementSettings(image, {}, sourceImage);
                this._applyAttribute(image, "src", settings && settings.src);
                this._applyAttribute(image, "srcset", this._serializeSrcSet(settings && settings.srcset));
                this._applyAttribute(image, "sizes", settings && settings.sizes);
                this._applyAttribute(image, "alt", settings && settings.alt);
                this._applyAttribute(image, "width", settings && settings.width);
                this._applyAttribute(image, "height", settings && settings.height);
                this._applyElementSettings(image, settings);
            },

            _applyElementSettings: function (element, settings, sourceElement) {
                if (sourceElement && sourceElement.attributes) {
                    for (let i = 0; i < sourceElement.attributes.length; i++) {
                        const attribute = sourceElement.attributes[i];
                        element.setAttribute(attribute.name, attribute.value);
                    }
                }

                if (sourceElement && sourceElement.classList && element.classList) {
                    for (let i = 0; i < sourceElement.classList.length; i++) {
                        element.classList.add(sourceElement.classList[i]);
                    }
                }

                const classes = settings && settings.classes;
                if (classes && Array.isArray(classes.remove) && element.classList) {
                    for (let i = 0; i < classes.remove.length; i++) {
                        element.classList.remove(classes.remove[i]);
                    }
                }
                if (classes && Array.isArray(classes.add) && element.classList) {
                    for (let i = 0; i < classes.add.length; i++) {
                        element.classList.add(classes.add[i]);
                    }
                }

                const attributes = settings && settings.attributes;
                const setAttributes = attributes && attributes.set;
                if (setAttributes && typeof setAttributes === "object") {
                    const keys = Object.keys(setAttributes);
                    for (let i = 0; i < keys.length; i++) {
                        this._applyAttribute(element, keys[i], setAttributes[keys[i]]);
                    }
                }
                if (attributes && Array.isArray(attributes.remove)) {
                    for (let i = 0; i < attributes.remove.length; i++) {
                        element.removeAttribute(attributes.remove[i]);
                    }
                }
            },

            _applyAttribute: function (element, name, value) {
                if (value !== undefined && value !== null) {
                    element.setAttribute(name, String(value));
                }
            },

            _serializeSrcSet: function (srcset) {
                if (typeof srcset === "string") {
                    return srcset;
                } else if (!Array.isArray(srcset)) {
                    return null;
                }

                const values = [];
                for (let i = 0; i < srcset.length; i++) {
                    const candidate = srcset[i];
                    if (typeof candidate === "string") {
                        values.push(candidate);
                    } else if (candidate && typeof candidate.url === "string") {
                        values.push(candidate.url + (candidate.descriptor ? " " + candidate.descriptor : ""));
                    }
                }

                return values.length > 0 ? values.join(", ") : null;
            }
        }
    };

    /*
     * Condition implementations are isolated by type. Conditions inside one
     * conditionsGroups entry are combined with AND; the entries themselves
     * are evaluated in order. Each condition can add preEvaluate, evaluate,
     * and optional scheduling helpers as defined by its generated evaluation
     * contract. Methods prefixed with _ are private helpers of the individual
     * condition implementation.
     */
    const conditions = {

        /**
         * Resolves an opaque backend decision result returned for this
         * web-experience. The browser receives only the reference and the
         * boolean result, never the backend condition settings.
         */
        decision: {
            evaluate: function (condition, runtime) {
                const settings = _private.getConditionSettings(condition);
                const refId = settings && typeof settings.refId === "string" ? settings.refId : null;
                const results = runtime && runtime.decision && runtime.decision.conditionResults;
                return refId !== null && results && results[refId] === true;
            }
        },

        /**
         * Provides a low-cost browser-side device-type candidate. It is not a
         * final result; Customer Journey remains authoritative for user-agent
         * classification through the future decision service.
         */
        deviceType: {

            /**
             * This method deliberately performs only a simple browser check. The
             * backend may classify the same user-agent more thoroughly.
             */
            preEvaluate: function (condition) {
                const settings = condition && condition.settings;
                const configuredTypes = settings && Array.isArray(settings.types) ? settings.types : [];
                const currentType = this._determineDeviceType();

                return configuredTypes.indexOf(currentType) > -1;
            },

            _determineDeviceType: function () {
                const userAgent = typeof navigator === "object" && typeof navigator.userAgent === "string"
                    ? navigator.userAgent
                    : "";

                if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) {
                    return "MOBILE";
                } else if (/Android.*Mobile|iPhone|iPod|Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
                    return "MOBILE";
                }

                return "DESKTOP";
            }
        },

        /**
         * Resolves recurring daily time ranges in the selected browser
         * timezone.
         */
        timeOfDay: {
            evaluate: function (condition) {
                const settings = _private.getConditionSettings(condition);
                const parts = _private.getZonedDateParts(new Date(), settings);
                if (!parts) {
                    return false;
                }

                const currentTime = parts.hour * 60 + parts.minute;
                const ranges = _private.getTemporalRanges(condition);
                for (let i = 0; i < ranges.length; i++) {
                    if (_private.isValueInTemporalRange(currentTime, ranges[i], this._parse)) {
                        return true;
                    }
                }

                return false;
            },

            nextEvaluationDelay: function (condition, now) {
                return _private.getNextMinuteEvaluationDelay(now);
            },

            _parse: function (value) {
                if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
                    return null;
                }

                return parseInt(value.substring(0, 2), 10) * 60 + parseInt(value.substring(3, 5), 10);
            }
        },

        /**
         * Resolves annual or absolute calendar-date ranges in the selected
         * browser timezone.
         */
        calendarDate: {
            evaluate: function (condition) {
                const settings = _private.getConditionSettings(condition);
                const parts = _private.getZonedDateParts(new Date(), settings);
                if (!parts) {
                    return false;
                }

                const isAnnual = settings && settings.mode === "ANNUAL";
                const parser = isAnnual ? this._parseAnnual : this._parseAbsolute;
                const currentDate = isAnnual
                    ? parts.month * 100 + parts.day
                    : parts.year * 10000 + parts.month * 100 + parts.day;
                const ranges = _private.getTemporalRanges(condition);
                for (let i = 0; i < ranges.length; i++) {
                    if (_private.isValueInTemporalRange(currentDate, ranges[i], parser)) {
                        return true;
                    }
                }

                return false;
            },

            nextEvaluationDelay: function (condition, now) {
                return _private.getNextMinuteEvaluationDelay(now);
            },

            _parseAnnual: function (value) {
                if (typeof value !== "string" ||
                    !/^(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])$/.test(value)) {
                    return null;
                }

                const parts = value.split("/");
                return parseInt(parts[0], 10) * 100 + parseInt(parts[1], 10);
            },

            _parseAbsolute: function (value) {
                if (typeof value !== "string" ||
                    !/^\d{4}\/(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])$/.test(value)) {
                    return null;
                }

                const parts = value.split("/");
                return parseInt(parts[0], 10) * 10000 + parseInt(parts[1], 10) * 100 +
                    parseInt(parts[2], 10);
            }
        },

        /**
         * Resolves absolute Unix epoch-millisecond ranges.
         */
        dateTime: {
            evaluate: function (condition) {
                const currentTime = Date.now();
                const ranges = _private.getTemporalRanges(condition);
                for (let i = 0; i < ranges.length; i++) {
                    if (_private.isValueInTemporalRange(currentTime, ranges[i], this._parse)) {
                        return true;
                    }
                }

                return false;
            },

            nextEvaluationDelay: function (condition, now) {
                let delay = null;
                const ranges = _private.getTemporalRanges(condition);
                for (let i = 0; i < ranges.length; i++) {
                    const range = ranges[i];
                    ["from", "to"].forEach(function (endpoint) {
                        if (range && typeof range[endpoint] === "number" && isFinite(range[endpoint]) &&
                            range[endpoint] > now) {
                            const endpointDelay = range[endpoint] - now + 25;
                            delay = delay === null ? endpointDelay : Math.min(delay, endpointDelay);
                        }
                    });
                }

                return delay;
            },

            _parse: function (value) {
                return typeof value === "number" && isFinite(value) ? value : null;
            }
        },

        dayOfWeek: {
            evaluate: function (condition) {
                const settings = _private.getConditionSettings(condition);
                const parts = _private.getZonedDateParts(new Date(), settings);
                const configuredDays = settings && Array.isArray(settings.days) ? settings.days : [];
                const currentDay = parts && parts.weekday ? parts.weekday.toUpperCase() : null;
                for (let i = 0; i < configuredDays.length; i++) {
                    if (String(configuredDays[i]).toUpperCase() === currentDay) {
                        return true;
                    }
                }
                return false;
            },

            nextEvaluationDelay: function (condition, now) {
                return _private.getNextMinuteEvaluationDelay(now);
            }
        }
    };

    const _private = {
        runtimes: {},

        /*
         * Actions are grouped in the generated configuration. The selected
         * condition group's action list is used. An optional _default action
         * list is used only when no condition group matches. A decision
         * response supplies opaque backend condition results; action groups
         * remain local and are selected after the complete group is evaluated.
         */

        getActionSettings: function (action) {
            return action && action.settings && typeof action.settings === "object"
                ? action.settings
                : null;
        },

        isDecisionRequired: function (runtime) {
            const decision = runtime && runtime.config && runtime.config.decision;
            return $.isPlainObject(decision) && decision.required === true;
        },

        getDecisionSettings: function (runtime) {
            return runtime && runtime.config && $.isPlainObject(runtime.config.decision)
                ? runtime.config.decision
                : {};
        },

        getDecisionService: function (runtime) {
            const decision = this.getDecisionSettings(runtime);
            return typeof decision.service === "string" && decision.service.trim() !== ""
                ? decision.service.trim()
                : DEFAULT_DECISION_SERVICE;
        },

        getDecisionPayload: function (runtime) {
            const decision = this.getDecisionSettings(runtime);
            return {
                configurationId: typeof decision.configurationId === "string"
                    ? decision.configurationId
                    : null,
                conditionRefs: this.getDecisionConditionReferences(runtime)
            };
        },

        getDecisionConfigurationId: function (runtime) {
            const decision = this.getDecisionSettings(runtime);
            return typeof decision.configurationId === "string" ? decision.configurationId : null;
        },

        getDecisionConditionReferences: function (runtime) {
            const decision = this.getDecisionSettings(runtime);
            const conditions = Array.isArray(decision.conditions) ? decision.conditions : [];
            const references = [];
            for (let i = 0; i < conditions.length; i++) {
                const settings = conditions[i] && conditions[i].settings;
                if (settings && typeof settings.refId === "string" && settings.refId.trim() !== "") {
                    references.push(settings.refId);
                }
            }
            return references;
        },

        isDecisionResponseForRuntime: function (runtime, response) {
            if (!$.isPlainObject(response)) {
                return false;
            }

            const expectedConfigurationId = this.getDecisionConfigurationId(runtime);
            return expectedConfigurationId === null || response.configurationId === expectedConfigurationId;
        },

        getDecisionConditionResults: function (response) {
            const conditionResults = {};
            const conditions = response && Array.isArray(response.conditions) ? response.conditions : [];
            for (let i = 0; i < conditions.length; i++) {
                const condition = conditions[i];
                const settings = condition && condition.settings;
                const refId = condition && typeof condition.refId === "string"
                    ? condition.refId
                    : settings && typeof settings.refId === "string" ? settings.refId : null;
                const matched = condition && typeof condition.matched === "boolean"
                    ? condition.matched
                    : settings && typeof settings.matched === "boolean" ? settings.matched : null;
                if (refId !== null && matched !== null) {
                    conditionResults[refId] = matched;
                }
            }
            return conditionResults;
        },

        getDecisionMaxAgeSeconds: function (response) {
            const cache = response && response.cache;
            const maxAgeSeconds = cache && cache.maxAgeSeconds;
            return typeof maxAgeSeconds === "number" && isFinite(maxAgeSeconds) && maxAgeSeconds >= 0
                ? maxAgeSeconds
                : 0;
        },

        completeDecision: function (runtime, response) {
            const maxAgeSeconds = this.getDecisionMaxAgeSeconds(response);

            runtime.decision.inFlight = false;
            runtime.decision.resolved = true;
            runtime.decision.status = DECISION_STATUS_RESOLVED;
            runtime.decision.conditionResults = this.getDecisionConditionResults(response);
            runtime.conditionResults = runtime.decision.conditionResults;
            runtime.decision.expiresAt = maxAgeSeconds > 0
                ? Date.now() + maxAgeSeconds * 1000
                : 0;
            runtime.selectedGroupId = this.selectGroup(runtime);

            if (runtime.module && typeof runtime.module.onChange === "function") {
                runtime.module.onChange({type: "decision", status: DECISION_STATUS_RESOLVED});
            }
        },

        failDecision: function (runtime) {
            runtime.decision.inFlight = false;
            runtime.decision.resolved = false;
            runtime.decision.status = DECISION_STATUS_FAILED;
            runtime.decision.conditionResults = {};
            runtime.conditionResults = {};
            runtime.decision.expiresAt = 0;
            runtime.selectedGroupId = FAILURE_ACTION_GROUP;

            if (runtime.module && typeof runtime.module.onChange === "function") {
                runtime.module.onChange({type: "decision", status: DECISION_STATUS_FAILED});
            }
        },

        requestDecision: function (runtime) {
            if (!this.isDecisionRequired(runtime)) {
                return false;
            }

            const decisionState = runtime.decision;
            const now = Date.now();
            if (decisionState.inFlight === true) {
                return true;
            }
            if (decisionState.status === DECISION_STATUS_FAILED) {
                return true;
            }
            if (decisionState.resolved === true &&
                (decisionState.expiresAt === 0 || decisionState.expiresAt > now)) {
                return true;
            }

            if (typeof Breinify !== "object" || typeof Breinify.service !== "function") {
                this.failDecision(runtime);
                return true;
            }

            decisionState.resolved = false;
            decisionState.status = DECISION_STATUS_PENDING;
            decisionState.expiresAt = 0;
            decisionState.inFlight = true;
            try {
                Breinify.service(this.getDecisionService(runtime), this.getDecisionPayload(runtime),
                    function (error, progress, response) {
                        if (runtime.decision.status !== DECISION_STATUS_PENDING) {
                            return;
                        }
                        if (progress !== null && typeof progress !== "undefined" &&
                            (response === null || typeof response === "undefined")) {
                            return;
                        }

                        if (error !== null && typeof error !== "undefined") {
                            this.failDecision(runtime);
                        } else if (!this.isDecisionResponseForRuntime(runtime, response)) {
                            this.failDecision(runtime);
                        } else {
                            this.completeDecision(runtime, response);
                        }
                    }.bind(this));
            } catch (e) {
                this.failDecision(runtime);
            }

            return true;
        },

        applyActionSnippets: function (runtime, action, actionIndex) {
            this.applyActionSnippet(runtime, action, actionIndex,
                SNIPPET_SETTING_JAVASCRIPT, SNIPPET_TYPE_JAVASCRIPT);
            this.applyActionSnippet(runtime, action, actionIndex,
                SNIPPET_SETTING_CSS, SNIPPET_TYPE_CSS);
        },

        applyActionSnippet: function (runtime, action, actionIndex, setting, expectedType, expectedStateIndex) {
            const settings = this.getActionSettings(action);
            const snippetSettings = settings && settings[setting];
            if (!snippetSettings || typeof snippetSettings !== "object") {
                return;
            }

            const snippetId = this.getSnippetId(snippetSettings);
            if (snippetId === null) {
                return;
            }

            const stateIndex = this.getActionSnippetStateIndex(runtime, actionIndex, setting);
            if (expectedStateIndex && expectedStateIndex !== stateIndex) {
                return;
            } else if (runtime.appliedSnippets[stateIndex] === true) {
                return;
            }

            const resolvedSnippet = this.resolveSnippet(runtime, snippetId);
            if (resolvedSnippet === null) {
                this.observeSnippet(runtime, action, actionIndex, setting, expectedType, snippetId, stateIndex);
                return;
            }

            const configuredType = this.normalizeSnippetType(snippetSettings.snippetType);
            const resolvedType = this.normalizeSnippetType(resolvedSnippet.type);
            const snippetType = configuredType || resolvedType || expectedType;
            if (snippetType !== expectedType) {
                this.logSnippetWarning("snippet type does not match its action setting", {
                    snippetId: snippetId,
                    setting: setting,
                    expectedType: expectedType,
                    actualType: snippetType
                });
                runtime.appliedSnippets[stateIndex] = true;
                return;
            }

            let applied = false;
            if (expectedType === SNIPPET_TYPE_JAVASCRIPT) {
                if (typeof resolvedSnippet.value === "function") {
                    try {
                        resolvedSnippet.value.call(runtime.module, this.createSnippetContext(runtime, action, actionIndex));
                        applied = true;
                    } catch (e) {
                        this.logSnippetError("JavaScript snippet execution failed", snippetId, e);
                        applied = true;
                    }
                } else {
                    this.logSnippetWarning("JavaScript snippets must resolve to a function", {
                        snippetId: snippetId
                    });
                    applied = true;
                }
            } else if (expectedType === SNIPPET_TYPE_CSS && typeof resolvedSnippet.value === "string") {
                applied = this.injectCssSnippet(snippetId, resolvedSnippet.value);
            }

            if (applied) {
                runtime.appliedSnippets[stateIndex] = true;
            }
        },

        getSnippetId: function (snippetSettings) {
            const snippetId = snippetSettings && snippetSettings.snippetId;
            return typeof snippetId === "string" && snippetId.trim() !== ""
                ? snippetId.trim()
                : null;
        },

        getActionSnippetStateIndex: function (runtime, actionIndex, setting) {
            return this.getActionStateIndex(runtime, actionIndex) + ":snippet:" + setting;
        },

        resolveSnippet: function (runtime, snippetId) {
            if (snippetId.indexOf(WEB_EXPERIENCE_SNIPPET_PREFIX) === 0) {
                const snippets = runtime.module && runtime.module.webExperienceSnippets;
                const localSnippet = snippets && snippets[snippetId];
                if (!localSnippet || typeof localSnippet !== "object" ||
                    !Object.prototype.hasOwnProperty.call(localSnippet, "value")) {
                    return null;
                }

                return {
                    type: localSnippet.type,
                    value: localSnippet.value
                };
            }

            /*
             * Global JavaScript snippets are resolved through SnippetManager.
             * Inline web-experience snippets are already available as their
             * executable function in the local registry above.
             */
            const globalSnippet = Breinify.plugins.snippetManager.get(snippetId);
            return globalSnippet === null || globalSnippet === undefined
                ? null
                : { value: globalSnippet };
        },

        observeSnippet: function (runtime, action, actionIndex, setting, expectedType, snippetId, stateIndex) {
            if (runtime.observedSnippets[stateIndex] === true ||
                snippetId.indexOf(WEB_EXPERIENCE_SNIPPET_PREFIX) === 0) {
                return;
            }

            runtime.observedSnippets[stateIndex] = true;
            const _self = this;
            Breinify.plugins.snippetManager.onSnippetRegistered(snippetId, function () {
                delete runtime.observedSnippets[stateIndex];
                _self.applyActionSnippet(runtime, action, actionIndex, setting, expectedType, stateIndex);
            });
        },

        normalizeSnippetType: function (type) {
            if (typeof type !== "string") {
                return null;
            }

            const normalizedType = type.toLowerCase();
            if (normalizedType === "js" || normalizedType === SNIPPET_TYPE_JAVASCRIPT) {
                return SNIPPET_TYPE_JAVASCRIPT;
            } else if (normalizedType === SNIPPET_TYPE_CSS) {
                return SNIPPET_TYPE_CSS;
            }

            return null;
        },

        createSnippetContext: function (runtime, action, actionIndex) {
            return {
                action: action,
                actionIndex: actionIndex,
                config: runtime.config,
                groupId: runtime.selectedGroupId,
                module: runtime.module,
                webExId: runtime.webExId,
                webExVersionId: runtime.webExVersionId
            };
        },

        injectCssSnippet: function (snippetId, snippet) {
            if (snippetId.indexOf(WEB_EXPERIENCE_SNIPPET_PREFIX) !== 0) {
                Breinify.plugins.snippetManager.inject(snippetId, "body", "prepend");
                return true;
            }

            Breinify.plugins.snippetManager.injectCode(snippet, "body", "prepend");
            return true;
        },

        logSnippetWarning: function (message, details) {
            if (typeof console === "object" && typeof console.warn === "function") {
                console.warn("uiModifyContent: " + message, details);
            }
        },

        logSnippetError: function (message, snippetId, error) {
            if (typeof console === "object" && typeof console.error === "function") {
                console.error("uiModifyContent: " + message, snippetId, error);
            }
        },

        getEffectiveAction: function (runtime, action) {
            if (!action || typeof action !== "object") {
                return null;
            }

            const effectiveAction = {};
            const actionKeys = Object.keys(action);
            for (let i = 0; i < actionKeys.length; i++) {
                effectiveAction[actionKeys[i]] = action[actionKeys[i]];
            }
            effectiveAction.enabled = action.enabled !== false;
            return effectiveAction;
        },

        getActionStateIndex: function (runtime, actionIndex) {
            return String(actionIndex) + ":" + String(runtime.selectedGroupId || "_none");
        },

        getActionSelector: function (action) {
            const settings = this.getActionSettings(action);
            return settings && typeof settings.selector === "string" && settings.selector.trim() !== ""
                ? settings.selector
                : null;
        },

        getActionImplementation: function (action) {
            const actionType = action && typeof action.type === "string" ? action.type : null;
            return actionType === null ? null : actions[actionType] || null;
        },

        getConfiguredActions: function (runtime) {
            const configuredActions = runtime.config && runtime.config.actions;
            if (!configuredActions || typeof configuredActions !== "object") {
                return [];
            }

            if (this.isDecisionRequired(runtime)) {
                if (runtime.decision && runtime.decision.status === DECISION_STATUS_FAILED) {
                    const failureActions = configuredActions[FAILURE_ACTION_GROUP];
                    return Array.isArray(failureActions) ? failureActions : [];
                }

                if (!runtime.decision || runtime.decision.resolved !== true) {
                    return [];
                }
            }

            const selectedActions = configuredActions[runtime.selectedGroupId];
            if (Array.isArray(selectedActions)) {
                return selectedActions;
            }

            const defaultActions = configuredActions[DEFAULT_ACTION_GROUP];
            return Array.isArray(defaultActions) ? defaultActions : [];
        },

        getConfiguredConditions: function (runtime) {
            const conditionGroups = runtime.config && Array.isArray(runtime.config.conditionsGroups)
                ? runtime.config.conditionsGroups
                : [];
            const configuredConditions = [];
            for (let i = 0; i < conditionGroups.length; i++) {
                const group = conditionGroups[i];
                const conditions = group && Array.isArray(group.conditions) ? group.conditions : [];
                for (let j = 0; j < conditions.length; j++) {
                    configuredConditions.push(conditions[j]);
                }
            }
            return configuredConditions;
        },

        getConditionSettings: function (condition) {
            return condition && condition.settings && typeof condition.settings === "object"
                ? condition.settings
                : null;
        },

        getConditionImplementation: function (condition) {
            const conditionType = condition && typeof condition.type === "string" ? condition.type : null;
            return conditionType === null ? null : conditions[conditionType] || null;
        },

        getTemporalTimezone: function (settings) {
            const timeZone = settings && settings.timeZone;
            const mode = timeZone && timeZone.mode;
            if (mode === "BROWSER") {
                try {
                    if (typeof Intl === "object" && typeof Intl.DateTimeFormat === "function") {
                        return new Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
                    }
                } catch (e) {
                    return null;
                }
            } else if (mode === "IANA" && timeZone && typeof timeZone.value === "string") {
                return timeZone.value;
            }

            return null;
        },

        getZonedDateParts: function (date, settings) {
            const timeZone = this.getTemporalTimezone(settings);
            try {
                const options = {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                    weekday: "long"
                };
                if (timeZone) {
                    options.timeZone = timeZone;
                }

                const formatter = new Intl.DateTimeFormat("en-US", options);
                const parts = formatter.formatToParts(date);
                const result = {};
                for (let i = 0; i < parts.length; i++) {
                    if (parts[i].type !== "literal") {
                        result[parts[i].type] = parts[i].type === "weekday"
                            ? parts[i].value
                            : parseInt(parts[i].value, 10);
                    }
                }

                return result;
            } catch (e) {
                return null;
            }
        },

        getTemporalRanges: function (condition) {
            const settings = this.getConditionSettings(condition);
            return settings && Array.isArray(settings.ranges) ? settings.ranges : [];
        },

        isValueInTemporalRange: function (value, range, parser) {
            if (!range || typeof range !== "object") {
                return false;
            }

            const from = range.from === undefined || range.from === null ? null : parser(range.from);
            const to = range.to === undefined || range.to === null ? null : parser(range.to);
            if (from === null && to === null) {
                return false;
            }

            if (from === null) {
                return value < to;
            } else if (to === null) {
                return value >= from;
            } else if (from < to) {
                return value >= from && value < to;
            }

            // A descending range crosses midnight or the end of the year.
            return value >= from || value < to;
        },

        getNextMinuteEvaluationDelay: function (now) {
            return 60000 - now % 60000 + 25;
        },

        getNextConditionEvaluationDelay: function (runtime) {
            const now = Date.now();
            let delay = null;
            const configuredConditions = this.getConfiguredConditions(runtime);

            for (let i = 0; i < configuredConditions.length; i++) {
                const condition = configuredConditions[i];
                const evaluation = condition && condition.evaluation;
                const reEvaluateOn = evaluation && evaluation.reEvaluateOn;
                if (!Array.isArray(reEvaluateOn) || reEvaluateOn.indexOf("timeBoundary") === -1) {
                    continue;
                }

                const implementation = this.getConditionImplementation(condition);
                if (!implementation || typeof implementation.nextEvaluationDelay !== "function") {
                    continue;
                }

                const conditionDelay = implementation.nextEvaluationDelay.call(implementation, condition, now);
                if (typeof conditionDelay === "number" && isFinite(conditionDelay) && conditionDelay > 0) {
                    delay = delay === null ? conditionDelay : Math.min(delay, conditionDelay);
                }
            }

            return delay === null ? null : Math.max(25, delay);
        },

        scheduleConditionEvaluation: function (runtime) {
            if (runtime.conditionEvaluationTimer !== null) {
                return;
            }

            const delay = this.getNextConditionEvaluationDelay(runtime);
            if (delay === null) {
                return;
            }

            const _self = this;
            runtime.conditionEvaluationTimer = window.setTimeout(function () {
                runtime.conditionEvaluationTimer = null;
                _self.scheduleConditionEvaluation(runtime);

                if (!runtime.module.isValidPage || runtime.module.isValidPage() === true) {
                    runtime.module.onChange({type: "time-boundary"});
                }
            }, delay);
        },

        getMaxApplications: function (action) {
            const settings = this.getActionSettings(action);
            const maxApplications = settings && settings.maxApplications;
            return typeof maxApplications === "number" && isFinite(maxApplications) &&
                maxApplications > 0 && Math.floor(maxApplications) === maxApplications
                ? maxApplications
                : null;
        },

        isDomAction: function (action) {
            const implementation = this.getActionImplementation(action);
            return implementation !== null && implementation.isDomAction === true;
        },

        getRootElement: function ($el) {
            if ($el && typeof $el.get === "function") {
                return $el.get(0) || null;
            } else if ($el && $el.nodeType === 1) {
                return $el;
            }

            return null;
        },

        matchesSelector: function (element, selector) {
            if (!element || element.nodeType !== 1 || !selector) {
                return false;
            }

            const matches = element.matches || element.webkitMatchesSelector || element.msMatchesSelector;
            if (typeof matches !== "function") {
                return false;
            }

            try {
                return matches.call(element, selector);
            } catch (e) {
                return false;
            }
        },

        applyDomOperation: function (target, operation, content, allowHtml) {
            if (!target || content === null || content === undefined) {
                return false;
            }

            const isNode = typeof content === "object" && content.nodeType;
            const insert = function (position) {
                if (!isNode) {
                    const method = allowHtml === true ? "insertAdjacentHTML" : "insertAdjacentText";
                    target[method](position, String(content));
                    return true;
                }

                if (position === "beforebegin") {
                    if (!target.parentNode) {
                        return false;
                    }
                    target.parentNode.insertBefore(content, target);
                } else if (position === "afterend") {
                    if (!target.parentNode) {
                        return false;
                    }
                    target.parentNode.insertBefore(content, target.nextSibling);
                } else if (position === "afterbegin") {
                    target.insertBefore(content, target.firstChild);
                } else if (position === "beforeend") {
                    target.appendChild(content);
                } else {
                    return false;
                }

                return true;
            };

            try {
                if (operation === "replace") {
                    if (!target.parentNode || !insert("beforebegin")) {
                        return false;
                    }
                    target.parentNode.removeChild(target);
                } else if (operation === "replaceContent") {
                    if (isNode) {
                        return false;
                    } else if (allowHtml === true) {
                        target.innerHTML = String(content);
                    } else {
                        target.textContent = String(content);
                    }
                } else if (operation === "before") {
                    return insert("beforebegin");
                } else if (operation === "after") {
                    return insert("afterend");
                } else if (operation === "prepend") {
                    return insert("afterbegin");
                } else if (operation === "append") {
                    return insert("beforeend");
                } else {
                    return false;
                }

                return true;
            } catch (e) {
                return false;
            }
        },

        getTargets: function (action, root) {
            const selector = this.getActionSelector(action);
            if (selector === null) {
                return [];
            }

            const targets = [];
            const addTarget = function (target) {
                if (target && targets.indexOf(target) === -1) {
                    targets.push(target);
                }
            };

            try {
                if (root !== null && this.matchesSelector(root, selector)) {
                    addTarget(root);
                }

                let parent = root && root.parentElement;
                while (parent) {
                    if (this.matchesSelector(parent, selector)) {
                        addTarget(parent);
                        break;
                    }
                    parent = parent.parentElement;
                }

                const searchRoot = root || document;
                const selected = searchRoot.querySelectorAll(selector);
                for (let i = 0; i < selected.length; i++) {
                    addTarget(selected[i]);
                }
            } catch (e) {
                // Invalid selectors are rejected by the server-side validator
                // in the future; keep the browser runtime fail-safe meanwhile.
            }

            return targets;
        },

        findRequirements: function (runtime, $el, data) {
            const changeType = data && data.type ? data.type : "full-scan";
            if (changeType !== "full-scan" && changeType !== "added-element" && changeType !== "attribute-change") {
                return false;
            }

            if (this.isDecisionRequired(runtime)) {
                this.requestDecision(runtime);
                if (!runtime.decision ||
                    (runtime.decision.resolved !== true && runtime.decision.status !== DECISION_STATUS_FAILED)) {
                    return false;
                }
            }

            const root = this.getRootElement($el);
            runtime.conditionResults = this.isDecisionRequired(runtime) && runtime.decision
                ? runtime.decision.conditionResults
                : {};
            runtime.selectedGroupId = this.isDecisionRequired(runtime) &&
                runtime.decision.status === DECISION_STATUS_FAILED
                ? FAILURE_ACTION_GROUP
                : this.selectGroup(runtime);
            const configuredActions = this.getConfiguredActions(runtime);

            for (let i = 0; i < configuredActions.length; i++) {
                const action = this.getEffectiveAction(runtime, configuredActions[i]);
                if (!action || action.enabled === false) {
                    continue;
                }
                const implementation = this.getActionImplementation(action);
                if (implementation && typeof implementation.findRequirements === "function") {
                    if (implementation.findRequirements.call(implementation, runtime, action, i, root, data) === true) {
                        return true;
                    }
                } else if (changeType === "full-scan" && this.isDomAction(action) !== true) {
                    return true;
                } else if (this.isDomAction(action) === true &&
                    this.hasReachedApplicationLimit(runtime, i, action) !== true &&
                    this.getTargets(action, root).length > 0) {
                    return true;
                }
            }

            return false;
        },

        getAppliedTargets: function (runtime, actionIndex) {
            const stateIndex = this.getActionStateIndex(runtime, actionIndex);
            if (!Array.isArray(runtime.appliedTargets[stateIndex])) {
                runtime.appliedTargets[stateIndex] = [];
            }

            return runtime.appliedTargets[stateIndex];
        },

        hasAppliedTarget: function (runtime, actionIndex, target) {
            return this.getAppliedTargets(runtime, actionIndex).indexOf(target) > -1;
        },

        markAppliedTarget: function (runtime, actionIndex, target) {
            const appliedTargets = this.getAppliedTargets(runtime, actionIndex);
            if (appliedTargets.indexOf(target) === -1) {
                appliedTargets.push(target);
            }
        },

        markAppliedTargets: function (runtime, actionIndex, targets) {
            for (let i = 0; i < targets.length; i++) {
                this.markAppliedTarget(runtime, actionIndex, targets[i]);
            }
        },

        getApplicationCount: function (runtime, actionIndex) {
            const stateIndex = this.getActionStateIndex(runtime, actionIndex);
            return typeof runtime.applicationCounts[stateIndex] === "number"
                ? runtime.applicationCounts[stateIndex]
                : 0;
        },

        hasReachedApplicationLimit: function (runtime, actionIndex, action) {
            const maxApplications = this.getMaxApplications(action);
            return maxApplications !== null && this.getApplicationCount(runtime, actionIndex) >= maxApplications;
        },

        markApplication: function (runtime, actionIndex) {
            const stateIndex = this.getActionStateIndex(runtime, actionIndex);
            runtime.applicationCounts[stateIndex] = this.getApplicationCount(runtime, actionIndex) + 1;
        },

        key: function (webExId, webExVersionId) {
            return String(webExId || "") + ":" + String(webExVersionId || "");
        },

        getRuntime: function (webExId, webExVersionId) {
            const runtime = this.runtimes[this.key(webExId, webExVersionId)];
            return runtime && typeof runtime === "object" ? runtime : null;
        },

        preEvaluateConditions: function (runtime) {
            const configuredConditions = this.getConfiguredConditions(runtime);

            const results = [];
            for (let i = 0; i < configuredConditions.length; i++) {
                const condition = configuredConditions[i];
                const implementation = this.getConditionImplementation(condition);
                const evaluator = implementation && typeof implementation.preEvaluate === "function"
                    ? implementation.preEvaluate
                    : null;

                results.push(evaluator === null ? null : evaluator.call(implementation, condition, runtime));
            }

            return results;
        },

        evaluateCondition: function (runtime, condition, visiting) {
            if (!condition || typeof condition !== "object") {
                return false;
            }

            const implementation = this.getConditionImplementation(condition);
            let result = false;
            if (implementation && typeof implementation.evaluate === "function") {
                result = implementation.evaluate.call(implementation, condition, runtime, visiting) === true;
            } else if (implementation && typeof implementation.preEvaluate === "function") {
                result = implementation.preEvaluate.call(implementation, condition, runtime) === true;
            }

            return result;
        },

        selectGroup: function (runtime) {
            const conditionGroups = runtime.config && Array.isArray(runtime.config.conditionsGroups)
                ? runtime.config.conditionsGroups
                : [];
            for (let i = 0; i < conditionGroups.length; i++) {
                const group = conditionGroups[i];
                if (!group || typeof group.actionGroup !== "string" ||
                    !Array.isArray(group.conditions) || group.conditions.length === 0) {
                    continue;
                }

                let matches = true;
                for (let j = 0; j < group.conditions.length; j++) {
                    if (!this.evaluateCondition(runtime, group.conditions[j], {})) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    return group.actionGroup;
                }
            }
            return DEFAULT_ACTION_GROUP;
        },

        conditionsMatch: function (runtime) {
            return true;
        },

        executeActions: function (runtime) {
            const configuredActions = this.getConfiguredActions(runtime);

            for (let i = 0; i < configuredActions.length; i++) {
                const action = this.getEffectiveAction(runtime, configuredActions[i]);
                if (!action || action.enabled === false) {
                    continue;
                }
                const implementation = this.getActionImplementation(action);
                const handler = implementation && typeof implementation.execute === "function"
                    ? implementation.execute
                    : null;

                if (typeof handler === "function" &&
                    (this.isDomAction(action) === true ||
                        runtime.executedActions[this.getActionStateIndex(runtime, i)] !== true)) {
                    handler.call(implementation, action, runtime, i);
                    this.applyActionSnippets(runtime, action, i);

                    if (this.isDomAction(action) !== true) {
                        runtime.executedActions[this.getActionStateIndex(runtime, i)] = true;
                    }
                }
            }
        }
    };

    /*
     * This is the single browser-side entry point for Modify Content.
     *
     * The generated web-experience remains stable while type-specific
     * conditions and actions evolve behind the implementation registries.
     */
    const UiModifyContent = {
        register: function (module, webExId, webExVersionId, config) {
            if (!module || typeof module !== "object") {
                return null;
            }

            const key = _private.key(webExId, webExVersionId);
            const runtime = {
                module: module,
                config: config,
                webExId: webExId,
                webExVersionId: webExVersionId,
                appliedTargets: [],
                applicationCounts: [],
                executedActions: [],
                appliedSnippets: {},
                observedSnippets: {},
                conditionResults: {},
                selectedGroupId: DEFAULT_ACTION_GROUP,
                decision: {
                    inFlight: false,
                    resolved: false,
                    status: DECISION_STATUS_IDLE,
                    conditionResults: {},
                    expiresAt: 0
                },
                conditionEvaluationTimer: null
            };

            _private.runtimes[key] = runtime;

            module.onChange = function (data) {
                return UiModifyContent.handle(webExId, webExVersionId, data);
            };

            module.findRequirements = function ($el, data) {
                return _private.findRequirements(runtime, $el, data);
            };

            return runtime;
        },

        handle: function (webExId, webExVersionId, data) {
            const runtime = _private.getRuntime(webExId, webExVersionId);
            if (runtime === null) {
                return false;
            }

            _private.scheduleConditionEvaluation(runtime);

            if (_private.isDecisionRequired(runtime)) {
                _private.requestDecision(runtime);
                if (runtime.decision.resolved !== true &&
                    runtime.decision.status !== DECISION_STATUS_FAILED) {
                    return true;
                }

                runtime.selectedGroupId = runtime.decision.status === DECISION_STATUS_FAILED
                    ? FAILURE_ACTION_GROUP
                    : _private.selectGroup(runtime);
            } else {
                runtime.preEvaluation = _private.preEvaluateConditions(runtime);
                runtime.conditionResults = {};
                runtime.selectedGroupId = _private.selectGroup(runtime);
            }

            _private.executeActions(runtime);
            return true;
        }
    };

    Breinify.plugins._add("uiModifyContent", UiModifyContent);
})();
