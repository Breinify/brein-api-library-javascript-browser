"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("uiModifyContent")) {
        return;
    }

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

                    if (this._applyOperation(target, settings)) {
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
                    for (let i = 0; i < currentTargets.length; i++) {
                        _private.markAppliedTarget(runtime, actionIndex, currentTargets[i]);
                    }
                }
            },

            _applyOperation: function (target, settings) {
                const operation = settings && settings.operation;
                const content = settings && typeof settings.content === "string" ? settings.content : null;
                const allowHtml = settings && settings.allowHtml === true;
                if (!target || !settings || content === null) {
                    return false;
                }

                try {
                    if (operation === "replace") {
                        if (!target.parentNode) {
                            return false;
                        }

                        target[allowHtml ? "insertAdjacentHTML" : "insertAdjacentText"]("beforebegin", content);
                        target.parentNode.removeChild(target);
                    } else if (operation === "replaceContent") {
                        if (allowHtml) {
                            target.innerHTML = content;
                        } else {
                            target.textContent = content;
                        }
                    } else if (operation === "before") {
                        target[allowHtml ? "insertAdjacentHTML" : "insertAdjacentText"]("beforebegin", content);
                    } else if (operation === "after") {
                        target[allowHtml ? "insertAdjacentHTML" : "insertAdjacentText"]("afterend", content);
                    } else if (operation === "prepend") {
                        target[allowHtml ? "insertAdjacentHTML" : "insertAdjacentText"]("afterbegin", content);
                    } else if (operation === "append") {
                        target[allowHtml ? "insertAdjacentHTML" : "insertAdjacentText"]("beforeend", content);
                    } else {
                        return false;
                    }

                    return true;
                } catch (e) {
                    return false;
                }
            }
        }
    };

    /*
     * Condition implementations are isolated by type. Each condition can add
     * preEvaluate, evaluate, and optional scheduling helpers as defined by
     * its generated evaluation contract. Methods prefixed with _ are private
     * helpers of the individual condition implementation.
     */
    const conditions = {

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
        }
    };

    const _private = {
        runtimes: {},

        getActionSettings: function (action) {
            return action && action.settings && typeof action.settings === "object"
                ? action.settings
                : null;
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
                    hourCycle: "h23"
                };
                if (timeZone) {
                    options.timeZone = timeZone;
                }

                const formatter = new Intl.DateTimeFormat("en-US", options);
                const parts = formatter.formatToParts(date);
                const result = {};
                for (let i = 0; i < parts.length; i++) {
                    if (parts[i].type !== "literal") {
                        result[parts[i].type] = parseInt(parts[i].value, 10);
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
            const configuredConditions = runtime.config && Array.isArray(runtime.config.conditions)
                ? runtime.config.conditions
                : [];

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

            const root = this.getRootElement($el);
            const configuredActions = runtime.config && Array.isArray(runtime.config.actions)
                ? runtime.config.actions
                : [];

            for (let i = 0; i < configuredActions.length; i++) {
                const action = configuredActions[i];
                if (changeType === "full-scan" && this.isDomAction(action) !== true) {
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
            if (!Array.isArray(runtime.appliedTargets[actionIndex])) {
                runtime.appliedTargets[actionIndex] = [];
            }

            return runtime.appliedTargets[actionIndex];
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

        getApplicationCount: function (runtime, actionIndex) {
            return typeof runtime.applicationCounts[actionIndex] === "number"
                ? runtime.applicationCounts[actionIndex]
                : 0;
        },

        hasReachedApplicationLimit: function (runtime, actionIndex, action) {
            const maxApplications = this.getMaxApplications(action);
            return maxApplications !== null && this.getApplicationCount(runtime, actionIndex) >= maxApplications;
        },

        markApplication: function (runtime, actionIndex) {
            runtime.applicationCounts[actionIndex] = this.getApplicationCount(runtime, actionIndex) + 1;
        },

        key: function (webExId, webExVersionId) {
            return String(webExId || "") + ":" + String(webExVersionId || "");
        },

        getRuntime: function (webExId, webExVersionId) {
            const runtime = this.runtimes[this.key(webExId, webExVersionId)];
            return runtime && typeof runtime === "object" ? runtime : null;
        },

        preEvaluateConditions: function (runtime) {
            const configuredConditions = runtime.config && Array.isArray(runtime.config.conditions)
                ? runtime.config.conditions
                : [];

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

        conditionsMatch: function (runtime) {
            const configuredConditions = runtime.config && Array.isArray(runtime.config.conditions)
                ? runtime.config.conditions
                : [];

            for (let i = 0; i < configuredConditions.length; i++) {
                const condition = configuredConditions[i];
                const implementation = this.getConditionImplementation(condition);
                const evaluator = implementation && typeof implementation.evaluate === "function"
                    ? implementation.evaluate
                    : null;

                if (evaluator === null || evaluator.call(implementation, condition, runtime) !== true) {
                    return false;
                }
            }

            return true;
        },

        executeActions: function (runtime) {
            const configuredActions = runtime.config && Array.isArray(runtime.config.actions)
                ? runtime.config.actions
                : [];

            for (let i = 0; i < configuredActions.length; i++) {
                const action = configuredActions[i];
                const implementation = this.getActionImplementation(action);
                const handler = implementation && typeof implementation.execute === "function"
                    ? implementation.execute
                    : null;

                if (typeof handler === "function" &&
                    (this.isDomAction(action) === true || runtime.executedActions[i] !== true)) {
                    handler.call(implementation, action, runtime, i);

                    if (this.isDomAction(action) !== true) {
                        runtime.executedActions[i] = true;
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
            runtime.preEvaluation = _private.preEvaluateConditions(runtime);

            if (_private.conditionsMatch(runtime) === false) {
                return false;
            }

            _private.executeActions(runtime);
            return true;
        }
    };

    Breinify.plugins._add("uiModifyContent", UiModifyContent);
})();
