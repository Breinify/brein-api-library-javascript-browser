"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("uiModifyContent")) {
        return;
    }

    /*
     * Action implementations are isolated by type. New actions belong here;
     * the runtime coordinator only resolves and invokes them.
     */
    const actions = {

        /**
         * Writes the configured message to the browser console. This is the
         * initial Modify Content action used to verify lifecycle handling.
         */
        writeToConsole: function (action) {
            const settings = action && action.settings;
            console.log(settings && settings.message);
        },

        /**
         * Applies the configured HTML operation to each matching target.
         * Target discovery and duplicate protection are kept in the runtime
         * coordinator so all future DOM actions can share the same lifecycle.
         */
        changeContent: function (action, runtime, actionIndex) {
            _private.executeModifyContent(action, runtime, actionIndex);
        }
    };

    /*
     * Condition implementations are isolated by type. Each condition can add
     * a preEvaluate and/or evaluate method as defined by its generated
     * evaluation contract.
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
                const currentType = this.determineDeviceType();

                return configuredTypes.indexOf(currentType) > -1;
            },

            determineDeviceType: function () {
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

        isDomAction: function (action) {
            return action && action.type === "changeContent";
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
                } else if (this.isDomAction(action) === true && this.getTargets(action, root).length > 0) {
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

        applyOperation: function (target, settings) {
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
        },

        executeModifyContent: function (action, runtime, actionIndex) {
            const settings = this.getActionSettings(action);
            const targets = this.getTargets(action, null);
            let applied = false;

            for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                if (this.hasAppliedTarget(runtime, actionIndex, target)) {
                    continue;
                }

                if (this.applyOperation(target, settings)) {
                    this.markAppliedTarget(runtime, actionIndex, target);
                    applied = true;
                }
            }

            /*
             * An inserted HTML fragment may itself match the configured
             * selector. Mark current matches after the operation so the DOM
             * observer cannot immediately apply the same action recursively.
             * Newly rendered nodes added later remain eligible.
             */
            if (applied) {
                const currentTargets = this.getTargets(action, null);
                for (let i = 0; i < currentTargets.length; i++) {
                    this.markAppliedTarget(runtime, actionIndex, currentTargets[i]);
                }
            }
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
                const conditionType = condition && typeof condition.type === "string" ? condition.type : null;
                const implementation = conditionType === null ? null : conditions[conditionType];
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
                const conditionType = condition && typeof condition.type === "string" ? condition.type : null;
                const implementation = conditionType === null ? null : conditions[conditionType];
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
                const actionType = action && typeof action.type === "string" ? action.type : null;
                const handler = actionType === null ? null : actions[actionType];

                if (typeof handler === "function" &&
                    (this.isDomAction(action) === true || runtime.executedActions[i] !== true)) {
                    handler(action, runtime, i);

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
     * The initial implementation deliberately stops at registration and
     * lifecycle dispatch. Future condition evaluators, decision requests,
     * caches, and action handlers should be added behind this API so that the
     * generated web-experience remains stable.
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
                executedActions: []
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
