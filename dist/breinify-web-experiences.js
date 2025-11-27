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

            // set up the activation-logic if it's defined and set up the check
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

        /**
         * Checks whether the current page's query parameters match the given rule.
         *
         * @param {Object} condition - The condition object.
         * @param {string} condition.operator - One of: 'equals', 'contains', 'startsWith', 'endsWith', 'regex'.
         * @param {string} condition.param - The query parameter name (case-insensitive).
         * @param {string} condition.value - The value to test against.
         * @returns {boolean} true if condition matches, otherwise false.
         */
        checkSearchParams: function (condition) {
            if (!condition || !condition.param || !condition.operator) {
                return false;
            }

            const params = new URLSearchParams(window.location.search);
            const targetName = condition.param.toLowerCase();

            // collect all values for this param (case-insensitive)
            const values = [];
            for (const [key, val] of params.entries()) {
                if (key.toLowerCase() === targetName) {
                    values.push(val);
                }
            }

            // if we could not find the parameter we are done
            if (values.length === 0) {
                return false;
            }

            const expected = condition.value ?? '';
            let matcher;

            // prepare matcher once (no re-creation per value)
            switch (condition.operator) {
                case 'equals':
                    matcher = v => v === expected;
                    break;
                case 'contains':
                    matcher = v => v.includes(expected);
                    break;
                case 'startsWith':
                    matcher = v => v.startsWith(expected);
                    break;
                case 'endsWith':
                    matcher = v => v.endsWith(expected);
                    break;
                case 'regex':
                    try {
                        const re = new RegExp(expected);
                        matcher = v => re.test(v);
                    } catch (err) {
                        // invalid regex in checkSearchParams
                        return false;
                    }
                    break;
                default:
                    // undefined operator, we should add it in
                    return false;
            }

            // check if any value matches
            return values.some(matcher);
        },

        checkActivityLogic: function (logic) {
            const paths = $.isArray(logic.paths) ? logic.paths : [];
            let isValidPage = paths.length === 0;

            for (let i = 0; i < paths.length && isValidPage === false; i++) {
                const path = $.isPlainObject(paths[i]) ? paths[i] : {};
                const type = Breinify.UTL.isNonEmptyString(path.type);
                const value = Breinify.UTL.isNonEmptyString(path.value);

                if (type === 'ALL_PATHS') {
                    isValidPage = true;
                } else if (value === null) {
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

                // if we have a valid-page and search params, we need to evaluate these next
                if (isValidPage === true && $.isArray(path.searchParameters) && path.searchParameters.length > 0) {
                    for (let j = 0; j < path.searchParameters.length && isValidPage === true; j++) {

                        // the parameters are AND concatenated so once we find one that is not fulfilled we can stop
                        isValidPage = this.checkSearchParams(path.searchParameters[j]);
                    }
                }
            }

            const snippet = Breinify.UTL.isNonEmptyString(logic.snippet);
            if (snippet === null) {
                return isValidPage;
            } else if (isValidPage === false) {
                return false;
            }

            // check if we have a snippet, if one is defined, and we cannot find it we return false as fallback
            const activationSnippet = Breinify.plugins.snippetManager.getSnippet(snippet);
            if (!$.isFunction(activationSnippet)) {
                return false;
            }

            try {
                return activationSnippet() === true;
            } catch (e) {
                console.error('[breinify] error occurred while executing activationSnippet: ', e)
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
        },

        attach: function(settings, $el) {
            const position = $.isPlainObject(settings) && $.isPlainObject(settings.position) ? settings.position : null;
            if (position == null) {
                return false;
            }

            // determine the operation to utilize, it is needed
            const operation = Breinify.UTL.isNonEmptyString(position.operation);
            if (operation === null) {
                return false;
            }

            // determine the anchor, it is needed but evaluated within the utility method
            let $anchor;
            const selector = Breinify.UTL.isNonEmptyString(position.selector);
            const snippet = Breinify.UTL.isNonEmptyString(position.snippet);
            if (snippet === null && selector === null) {
                $anchor = null;
            } else if (selector !== null) {
                $anchor = $(selector);
            } else if (snippet !== null) {
                $anchor = null
            }

            // now attach the element and if successful move on (otherwise return)
            return Breinify.UTL.dom.attachByOperation(operation, $anchor, $el);
        }
    };

    // bind the module
    Breinify.plugins._add('webExperiences', WebExperiences);
})();