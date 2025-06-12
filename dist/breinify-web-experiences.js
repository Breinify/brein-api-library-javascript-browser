"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('webExperiences')) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    const _private = {
        setup: function (configuration, module) {

            // ensure that we utilize the onChange method over the ready method
            if ($.isFunction(module.ready) && !$.isFunction(module.onChange)) {
                module.onChange = module.ready;
                module.ready = null;
            }

            // set up the activation-logic if it's defined and set-up the check
            if ($.isPlainObject(configuration.activationLogic)) {
                this.setupActivityLogic(configuration.activationLogic, module);
            }
        },

        setupActivityLogic: function (logic, module) {
            const _self = this;

            let currentIsValidPage = null;
            if ($.isFunction(module.isValidPage)) {
                currentIsValidPage = module.isValidPage;
            }

            /**
             * Checks if the current page (pathname) is valid for this module. If the method returns `true`, the
             * `findRequirements` and `onChange` method may follow up.
             *
             * @return {boolean} returns `true` if the page is valid for this module, or `false` if no further execution should be handled
             */
            module.isValidPage = function () {
                return _self.checkActivityLogic(logic) === true &&
                    (currentIsValidPage === null || currentIsValidPage.call(module) === true);
            };
        },

        checkActivityLogic: function (logic) {
            const paths = $.isArray(logic.paths) ? logic.paths : [];
            let isValidPage = paths.length === 0;

            for (let i = 0; i < paths.length && isValidPage === false; i++) {
                const path = $.isPlainObject(paths[i]) ? paths[i] : {};
                const type = Breinify.UTL.isNonEmptyString(path.type);

                if (type === 'ALL_PATHS') {
                    isValidPage = true;
                }

                const value = Breinify.UTL.isNonEmptyString(path.value);
                if (value === null) {
                    console.warn('found invalid value that was not or an empty string');
                } else if (type === 'STATIC_PATHS') {
                    if (value === window.location.pathname) {
                        isValidPage = true;
                    }
                } else if (type === 'REGEX') {
                    if (new RegExp(type.value).test(window.location.pathname) === true) {
                        isValidPage = true;
                    }
                } else {
                    console.warn('found undefined path type "' + path + '" in the activation logic, skipping');
                }
            }

            const snippet = Breinify.UTL.isNonEmptyString(logic.snippet);
            if (snippet === null) {
                return isValidPage;
            } else if (isValidPage === true) {
                return true; // TODO: return the snippet result
            } else {
                return false;
            }
        }
    };

    const WebExperiences = {

        bootstrap: function (id, configuration, module) {

            // the module must be a valid object
            if (typeof module !== 'object') {
                console.error('the module with id "' + id + '" is not a valid module and cannot be setup');
                return;
            }

            if (Breinify.plugins._isAdded('trigger') !== true) {

                // if we don't have the trigger plugin stop now, it's a required dependency for web-experiences
                console.error('the trigger plugin is not available, ' +
                    'skipping setup of the web-experiences with id "' + id + '"');
                return;
            } else if (Breinify.plugins.api.isModule(id) === true) {

                // if we have this module already there is nothing more to do
                return;
            } else {

                // initialize the plugin (can be called doubled)
                Breinify.plugins.trigger.init();
            }

            // set up the module and add it as such
            _private.setup(configuration, module);
            Breinify.plugins.api.addModule(id, module);
        }
    };

    // bind the module
    Breinify.plugins._add('webExperiences', WebExperiences);
})();