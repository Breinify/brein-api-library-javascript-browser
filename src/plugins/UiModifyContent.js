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
            console.log(action.message);
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

                if (typeof handler === "function") {
                    handler(action, runtime);
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
                webExVersionId: webExVersionId
            };

            _private.runtimes[key] = runtime;

            module.onChange = function (data) {
                return UiModifyContent.handle(webExId, webExVersionId, data);
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
