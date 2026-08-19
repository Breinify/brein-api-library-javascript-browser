"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("uiModifyContent")) {
        return;
    }

    const _private = {
        runtimes: {},

        actionHandlers: {
            writeToConsole: function (action) {
                console.log(action.message);
            }
        },

        key: function (webExId, webExVersionId) {
            return String(webExId || "") + ":" + String(webExVersionId || "");
        },

        getRuntime: function (webExId, webExVersionId) {
            const runtime = this.runtimes[this.key(webExId, webExVersionId)];
            return runtime && typeof runtime === "object" ? runtime : null;
        },

        executeActions: function (runtime) {
            const actions = runtime.config && Array.isArray(runtime.config.actions)
                ? runtime.config.actions
                : [];

            for (let i = 0; i < actions.length; i++) {
                const action = actions[i];
                const actionType = action && typeof action.type === "string" ? action.type : null;
                const handler = actionType === null ? null : this.actionHandlers[actionType];

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

            _private.executeActions(runtime);
            return true;
        }
    };

    Breinify.plugins._add("uiModifyContent", UiModifyContent);
})();
