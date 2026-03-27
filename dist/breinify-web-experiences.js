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
        idPrefix: 'web-experience-',

        setup: function (configuration, module) {

            // ensure that we utilize the onChange method over the ready method
            if ($.isFunction(module.ready) && !$.isFunction(module.onChange)) {
                module.onChange = module.ready;
                module.ready = null;
            }

            // set up the activation-logic if it's defined and set up the check
            this.setupActivityLogic(configuration, module);
        },

        setupActivityLogic: function (configuration, module) {
            const _self = this;

            if (!$.isPlainObject(configuration?.activationLogic)) {
                return;
            }

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
                return _self.checkActivityLogic(configuration, module) === true &&
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

        checkActivityLogic: function (configuration, module) {
            if (!$.isPlainObject(configuration?.activationLogic)) {
                return;
            }

            const logic = configuration.activationLogic;
            const paths = $.isArray(logic.paths) ? logic.paths : [];
            let isValidPage = paths.length === 0;

            for (let i = 0; i < paths.length && isValidPage === false; i++) {
                const path = $.isPlainObject(paths[i]) ? paths[i] : {};
                const type = Breinify.UTL.isNonEmptyString(path.type);
                const value = Breinify.UTL.isNonEmptyString(path.value);

                if (type === 'ALL_PATHS') {
                    isValidPage = true;
                } else if (type === 'ATTRIBUTE') {
                    this._setupAttribute(configuration, module);
                    isValidPage = true;

                    // we do not need to do anything else, the attribute is set up and active
                    break;
                } else if (value === null) {
                    console.warn('found invalid value that was not or an empty string');
                } else if (type === 'STATIC_PATHS') {
                    if (value === window.location.pathname) {
                        isValidPage = true;
                    }
                } else if (type === 'REGEX') {
                    if (new RegExp(value).test(window.location.pathname) === true) {
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

            // if the page is not valid, we do not have to check the snippet
            return isValidPage ? this._checkActivationSnippet(logic.snippet) : false;
        },

        _setupAttribute: function (configuration, module) {
            const _self = this;

            // prevent double wrapping and return true early
            if (module._hasAttributeFindRequirements === true) {
                return true;
            } else {
                module._hasAttributeFindRequirements = true;
            }

            module.renderingBehavior = 'onChange';
            module.findRequirements = function ($el, data) {
                _self._findAttributeRequirements(module, $el, data);
            };

            return false;
        },

        _findAttributeRequirements: function (module, $el, data) {
            const type = data?.type;

            if (type === 'removed-element') {
                return false;
            } else if (type === 'attribute-change') {
                if (data?.attribute !== 'data-br-webexpid') {
                    return false;
                }

                const el = $el ? $el[0] : null;
                if (this._isWebExpDiv(el, true)) {
                    return this._handleAttribute(module, $el, data, el);
                } else {
                    return false;
                }
            }

            const root = $el ? $el[0] : null;
            if (!root || root.nodeType !== 1) {
                return false;
            } else if (this._isWebExpDiv(root, false)) {
                return this._handleAttribute(module, $el, data, root);
            } else {
                const match = root.querySelector('div[data-br-webexpid]:not([data-br-webexpfnd="true"])');

                if (match) {
                    return this._handleAttribute(module, $el, data, match);
                } else {
                    return false;
                }
            }
        },

        _isWebExpDiv: function (el, ignoreFoundFlag) {
            if (!el || !Breinify.UTL.dom.isNodeType(el, 1) || el.tagName !== 'DIV') {
                return false;
            } else if (!el.hasAttribute('data-br-webexpid')) {
                return false;
            } else if (ignoreFoundFlag === true) {
                return true;
            } else {
                return el.getAttribute('data-br-webexpfnd') !== 'true';
            }
        },

        _handleAttribute: function (module, $el, data, el) {

            // mark the element as handled
            el.setAttribute('data-br-webexpfnd', 'true');

            // read the information of the experience
            const webExpId = el.getAttribute('data-br-webexpid');
            const webExpPos = el.getAttribute('data-br-webexppos');

            const existingFindRequirements = $.isFunction(module.findRequirements) ? module.findRequirements : null;
            if (existingFindRequirements === null) {
                return true;
            } else {
                return existingFindRequirements.call(this, $el, data);
            }
        },

        _checkActivationSnippet: function (logicSnippet) {

            // get the snippet a not existing snippet means we return true
            const snippet = Breinify.UTL.isNonEmptyString(logicSnippet);
            if (snippet === null) {
                return true;
            }

            // check if the snippet resolves, if so we utilize it, if not we return false as fallback
            const activationSnippet = Breinify.plugins.snippetManager.getSnippet(snippet);
            if ($.isFunction(activationSnippet)) {
                try {
                    return activationSnippet() === true;
                } catch (e) {
                    console.error('[breinify] error occurred while executing activationSnippet: ', e)
                    return false;
                }
            } else {
                return false;
            }
        },

        determineId: function (id) {
            const normId = Breinify.UTL.isNonEmptyString(id);
            if (normId === null) {
                return null;
            } else if (normId.indexOf(this.idPrefix) === 0) {
                return normId;
            } else {
                return this.idPrefix + normId;
            }
        },

        _resolveCurrentAnchor: function (operation, $el) {
            if (!$el || $el.length === 0 || $el.get(0).isConnected !== true) {
                return null;
            }

            const el = $el.get(0);
            const parent = el.parentNode;
            if (!parent || parent.nodeType !== 1) {
                return null;
            }

            if (operation === 'append' || operation === 'prepend') {
                return parent;
            } else if (operation === 'before') {
                return el.nextElementSibling;
            } else if (operation === 'after') {
                return el.previousElementSibling;
            } else {
                return null;
            }
        }
    };

    const WebExperiences = {

        determineActivationLogicType: function (configuration) {
            if (!$.isPlainObject(configuration?.activationLogic)) {
                return 'NONE';
            }

            const logic = configuration.activationLogic;
            const paths = $.isArray(logic.paths) ? logic.paths : [];
            if (paths.length) {
                return 'ANY_PATH';
            }

            for (let i = 0; i < paths.length && isValidPage === false; i++) {
                const path = $.isPlainObject(paths[i]) ? paths[i] : {};
                const type = Breinify.UTL.isNonEmptyString(path.type);
                const value = Breinify.UTL.isNonEmptyString(path.value);

                if (type === 'ALL_PATHS') {
                    return 'ANY_PATH';
                } else if (type === 'ATTRIBUTE') {
                    return 'BY_ATTRIBUTE';
                } else if (value === null) {
                    return 'INVALID';
                } else if (type === 'STATIC_PATHS' || type === 'REGEX') {
                    // nothing to do, there can be multiple, or we can find one of the override any
                } else {
                    return 'INVALID';
                }
            }

            return 'BY_PATH';
        },

        isBootstrapped: function (id) {
            const normId = _private.determineId(id);
            if (normId === null) {
                return false;
            }

            return Breinify.plugins.api.isModule(normId) === true;
        },

        bootstrap: function (id, configuration, module) {

            // the module must be a valid object
            if (typeof module !== 'object') {
                console.error('the module is not a valid module and cannot be setup (id: ' + id + ')');
                return;
            }

            // check if the id has the prefix
            id = _private.determineId(id);
            if (id === null) {
                console.error('the id "' + id + '" is not a valid identifier');
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

        style(settings, $el, selector) {

            const snippetId = $.isPlainObject(settings.style) ? Breinify.UTL.isNonEmptyString(settings.style.snippet) : null;
            if (snippetId !== null && Breinify.plugins._isAdded('snippetManager')) {
                const snippet = Breinify.UTL.isNonEmptyString(Breinify.plugins.snippetManager.getSnippet(snippetId));
                if (snippet !== null) {
                    try {
                        selector = Breinify.UTL.isNonEmptyString(selector);
                        if (selector === null) {
                            $el.prepend($(snippet));
                        } else {
                            $el.find(selector).after($(snippet));
                        }
                    } catch (e) {
                        // invalid snippet
                    }
                }
            }
        },

        attach: function (webExpSettings, $el, placement) {

            // ensure valid inputs
            placement = $.extend(true, {
                cardinality: 'single'
            }, $.isPlainObject(placement) ? placement : {});

            if (!$el || $el.length === 0) {
                return false;
            }

            const position = $.isPlainObject(webExpSettings) && $.isPlainObject(webExpSettings.position) ? webExpSettings.position : null;
            if (position == null) {
                return false;
            }

            // determine the operation to utilize, it is needed
            const operation = Breinify.UTL.isNonEmptyString(position.operation);
            if (operation === null) {
                return false;
            }

            // determine the anchor candidates
            let $anchor = null;
            const selector = Breinify.UTL.isNonEmptyString(position.selector);
            const snippet = Breinify.UTL.isNonEmptyString(position.snippet);

            if (snippet === null && selector === null) {
                return false;
            } else if (selector !== null) {
                $anchor = $(selector);
            } else if (snippet !== null) {
                const positionFunc = Breinify.plugins.snippetManager.getSnippet(snippet);
                $anchor = $.isFunction(positionFunc) ? $(positionFunc()) : null;
            }

            if (!$anchor || $anchor.length === 0) {
                return false;
            }

            /*
             * For now, singleton is the default and only fully supported mode.
             * We attach the element to exactly one valid anchor.
             */
            const cardinality = Breinify.UTL.isNonEmptyString(placement.cardinality) || 'single';
            if (cardinality !== 'single') {
                return false;
            }

            // normalize and keep only element nodes
            const $candidates = $anchor.filter(function () {
                return this && this.nodeType === 1;
            });

            if ($candidates.length === 0) {
                return false;
            }

            /*
             * Step 1: if the element is already attached in a valid place for the
             * current operation, keep it there. This prevents unnecessary moves.
             */
            const currentAnchor = _private._resolveCurrentAnchor(operation, $el);
            if (currentAnchor !== null) {
                const $currentAnchor = $(currentAnchor);
                const isStillValid = $candidates.filter(function () {
                    return this === currentAnchor;
                }).length > 0;

                if (isStillValid) {
                    $el.data('br.webexp.attach.operation', operation);
                    $el.data('br.webexp.attach.anchor', currentAnchor);
                    return true;
                }
            }

            /*
             * Step 2: if we previously chose an anchor and it is still valid, prefer it.
             * This keeps the placement stable across repeated onChange calls.
             */
            const previousAnchor = $el.data('br.webexp.attach.anchor');
            if (previousAnchor != null) {
                const $previousAnchor = $(previousAnchor);
                const isPreviousStillValid = $candidates.filter(function () {
                    return this === previousAnchor;
                }).length > 0;

                if (isPreviousStillValid) {
                    const attached = Breinify.UTL.dom.attachByOperation(operation, $previousAnchor, $el);
                    if (attached === true) {
                        $el.data('br.webexp.attach.operation', operation);
                        $el.data('br.webexp.attach.anchor', previousAnchor);
                        return true;
                    }
                }
            }

            /*
             * Step 3: choose the first valid candidate in DOM order.
             */
            const targetAnchor = $candidates.get(0);
            if (targetAnchor == null) {
                return false;
            }

            const $targetAnchor = $(targetAnchor);
            const attached = Breinify.UTL.dom.attachByOperation(operation, $targetAnchor, $el);
            if (attached === true) {
                $el.data('br.webexp.attach.operation', operation);
                $el.data('br.webexp.attach.anchor', targetAnchor);
                return true;
            }

            return false;
        }
    };

    // bind the module
    Breinify.plugins._add('webExperiences', WebExperiences);
})();