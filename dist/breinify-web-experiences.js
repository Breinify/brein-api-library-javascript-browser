"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("webExperiences")) {
        return;
    }

    const $ = Breinify.UTL._jquery();

    const _private = {
        idPrefix: "web-experience-",

        setup: function (configuration, module) {

            if ($.isFunction(module.ready) && !$.isFunction(module.onChange)) {
                module.onChange = module.ready;
                module.ready = null;
            }

            this.setupDynamicRequirements(configuration, module);
            this.setupActivityLogic(configuration, module);
        },

        setupActivityLogic: function (configuration, module) {
            const _self = this;
            const currentIsValidPage = $.isFunction(module.isValidPage) ? module.isValidPage : null;

            module.isValidPage = function () {
                return _self.checkActivityLogic(configuration, module) === true &&
                    (currentIsValidPage === null || currentIsValidPage.call(module) === true);
            };
        },

        setupDynamicRequirements: function (configuration, module) {
            const _self = this;

            if (module._webExpDynamicRequirementsWrapped === true) {
                return;
            }

            const originalFindRequirements = $.isFunction(module.findRequirements) ? module.findRequirements : null;
            const hasAttributeActivation = this.hasAttributeActivation(configuration) === true;
            const hasDynamicPosition = this.hasDynamicPosition(configuration) === true;

            if (hasAttributeActivation !== true && hasDynamicPosition !== true) {
                return;
            }

            module._webExpDynamicRequirementsWrapped = true;
            module.renderingBehavior = "onChange";

            module.findRequirements = function ($el, data) {

                // fastest possible exit
                if (data?.type === "removed-element") {
                    return false;
                }

                const targets = _self.resolveTargets(configuration, module, $el, data);
                if (targets === null) {
                    return false;
                }

                module._lastResolvedTargets = targets;

                if (originalFindRequirements === null) {
                    return true;
                }

                return originalFindRequirements.call(module, $el, data) === true;
            };
        },

        resolveTargets: function (configuration, module, $el, data) {
            const type = data?.type;
            const root = $el && $el.length > 0 ? $el.get(0) : null;

            /*
             * We only care about:
             * - added elements
             * - attribute changes of data-br-webexpid
             */
            if (type === "attribute-change" && data?.attribute !== "data-br-webexpid") {
                return null;
            } else if (type !== "added-element" && type !== "attribute-change") {
                return null;
            }

            const result = {
                attributeTarget: null,
                positionTargets: null
            };

            /*
             * ------------------------------------------
             * ATTRIBUTE TARGET RESOLUTION
             * ------------------------------------------
             */
            if (this.hasAttributeActivation(configuration) === true) {
                result.attributeTarget = this.findAttributeTarget(module, root, type);
                if (result.attributeTarget === null) {
                    return null;
                }
            }

            /*
             * ------------------------------------------
             * POSITION TARGET RESOLUTION
             * ------------------------------------------
             */
            if (this.hasDynamicPosition(configuration) === true) {
                result.positionTargets = this.resolvePositionTargets(configuration, root, type);
                if (result.positionTargets === null || result.positionTargets.length === 0) {
                    return null;
                }
            }

            return result;
        },

        findAttributeTarget: function (module, root, type) {
            if (!Breinify.UTL.dom.isNodeType(root, 1)) {
                return null;
            }

            // direct hit
            if (this._isMatchingWebExpDiv(module, root)) {
                return root;
            }

            // on attribute-change only the changed element matters
            if (type === "attribute-change") {
                return null;
            }

            // on added-element we scan the subtree
            if (!$.isFunction(root.querySelectorAll)) {
                return null;
            }

            const matches = root.querySelectorAll("div[data-br-webexpid]");
            for (let i = 0; i < matches.length; i++) {
                if (this._isMatchingWebExpDiv(module, matches[i])) {
                    return matches[i];
                }
            }

            return null;
        },

        resolvePositionTargets: function (configuration, root) {
            const position = $.isPlainObject(configuration?.position) ? configuration.position : null;
            if (position === null) {
                return null;
            }

            const selector = Breinify.UTL.isNonEmptyString(position.selector);
            const snippet = Breinify.UTL.isNonEmptyString(position.snippet);

            if (selector !== null) {
                return this._resolveSelectorTargets(selector, root);
            } else if (snippet !== null) {
                return this._resolveSnippetTargets(snippet);
            } else {
                return null;
            }
        },

        _resolveSelectorTargets: function (selector, root) {
            let $targets = null;

            if (Breinify.UTL.dom.isNodeType(root, 1)) {
                const targets = [];

                if ($.isFunction(root.matches) && root.matches(selector)) {
                    targets.push(root);
                }

                if ($.isFunction(root.querySelectorAll)) {
                    const nested = root.querySelectorAll(selector);
                    for (let i = 0; i < nested.length; i++) {
                        targets.push(nested[i]);
                    }
                }

                $targets = $(targets);
            } else {
                $targets = $(selector);
            }

            return this._normalizeTargetElements($targets);
        },

        _resolveSnippetTargets: function (snippetId) {
            if (Breinify.plugins._isAdded("snippetManager") !== true) {
                return null;
            }

            const snippetFn = Breinify.plugins.snippetManager.getSnippet(snippetId);
            if (!$.isFunction(snippetFn)) {
                return null;
            }

            try {
                return this._normalizeTargetElements($(snippetFn()));
            } catch (e) {
                return null;
            }
        },

        _normalizeTargetElements: function ($targets) {
            if (!$targets || $targets.length === 0) {
                return null;
            }

            const seen = [];
            const result = [];

            $targets.each(function () {
                if (!Breinify.UTL.dom.isNodeType(this, 1)) {
                    return;
                }

                if ($.inArray(this, seen) > -1) {
                    return;
                }

                seen.push(this);
                result.push(this);
            });

            return result.length > 0 ? result : null;
        },

        checkActivityLogic: function (configuration) {
            if (!$.isPlainObject(configuration?.activationLogic)) {
                return true;
            }

            const logic = configuration.activationLogic;
            const paths = $.isArray(logic.paths) ? logic.paths : [];

            let isValidPage = paths.length === 0;
            let hasAttribute = false;

            for (let i = 0; i < paths.length && isValidPage === false; i++) {
                const path = $.isPlainObject(paths[i]) ? paths[i] : {};
                const type = Breinify.UTL.isNonEmptyString(path.type);
                const value = Breinify.UTL.isNonEmptyString(path.value);

                if (type === "ATTRIBUTE") {
                    hasAttribute = true;
                    continue;
                } else if (type === "ALL_PATHS") {
                    isValidPage = true;
                } else if (type === "STATIC_PATHS") {
                    if (value === window.location.pathname) {
                        isValidPage = true;
                    }
                } else if (type === "REGEX") {
                    try {
                        if (value !== null && new RegExp(value).test(window.location.pathname) === true) {
                            isValidPage = true;
                        }
                    } catch (e) {
                        // invalid regex
                    }
                }

                if (isValidPage === true && $.isArray(path.searchParameters) && path.searchParameters.length > 0) {
                    for (let j = 0; j < path.searchParameters.length && isValidPage === true; j++) {
                        isValidPage = this.checkSearchParams(path.searchParameters[j]);
                    }
                }
            }

            if (isValidPage !== true && hasAttribute === true) {
                isValidPage = true;
            }

            return isValidPage === true ? this._checkActivationSnippet(logic.snippet) : false;
        },

        hasAttributeActivation: function (configuration) {
            if (!$.isPlainObject(configuration)) {
                return false;
            } else if (typeof configuration._hasAttributeActivation === "boolean") {
                return configuration._hasAttributeActivation;
            } else {

                const paths = $.isArray(configuration?.activationLogic?.paths) ? configuration.activationLogic.paths : [];
                for (let i = 0; i < paths.length; i++) {
                    const type = Breinify.UTL.isNonEmptyString(paths[i]?.type);
                    if (type === "ATTRIBUTE") {
                        configuration._hasAttributeActivation = true;
                        return true;
                    }
                }

                configuration._hasAttributeActivation = false;
                return false;
            }
        },

        hasDynamicPosition: function (configuration) {
            const behavior = Breinify.UTL.isNonEmptyString(configuration?.position?.renderingBehavior);
            return behavior !== null && behavior.toLowerCase() === "onchange";
        },

        _isMatchingWebExpDiv: function (module, el) {
            if (!Breinify.UTL.dom.isNodeType(el, 1) || el.tagName !== "DIV") {
                return false;
            }

            const foundWebExpId = Breinify.UTL.isNonEmptyString(el.getAttribute("data-br-webexpid"));
            const expectedWebExpId = Breinify.UTL.isNonEmptyString(module?.webExId);

            return foundWebExpId !== null && expectedWebExpId !== null && foundWebExpId === expectedWebExpId;
        },

        checkSearchParams: function (condition) {
            if (!condition || !condition.param || !condition.operator) {
                return false;
            }

            const params = new URLSearchParams(window.location.search);
            const targetName = String(condition.param).toLowerCase();
            const values = [];

            for (const [key, value] of params.entries()) {
                if (String(key).toLowerCase() === targetName) {
                    values.push(value);
                }
            }

            if (values.length === 0) {
                return false;
            }

            const expected = condition.value ?? "";
            let matcher = null;

            switch (condition.operator) {
                case "equals":
                    matcher = function (v) {
                        return v === expected;
                    };
                    break;
                case "contains":
                    matcher = function (v) {
                        return v.includes(expected);
                    };
                    break;
                case "startsWith":
                    matcher = function (v) {
                        return v.startsWith(expected);
                    };
                    break;
                case "endsWith":
                    matcher = function (v) {
                        return v.endsWith(expected);
                    };
                    break;
                case "regex":
                    try {
                        const re = new RegExp(expected);
                        matcher = function (v) {
                            return re.test(v);
                        };
                    } catch (e) {
                        return false;
                    }
                    break;
                default:
                    return false;
            }

            return values.some(matcher);
        },

        _checkActivationSnippet: function (logicSnippet) {
            const snippetId = Breinify.UTL.isNonEmptyString(logicSnippet);
            if (snippetId === null) {
                return true;
            }

            if (Breinify.plugins._isAdded("snippetManager") !== true) {
                return false;
            }

            const activationSnippet = Breinify.plugins.snippetManager.getSnippet(snippetId);
            if (!$.isFunction(activationSnippet)) {
                return false;
            }

            try {
                return activationSnippet() === true;
            } catch (e) {
                console.error("[breinify] error occurred while executing activationSnippet: ", e);
                return false;
            }
        },

        determineId: function (id) {
            const normalizedId = Breinify.UTL.isNonEmptyString(id);
            if (normalizedId === null) {
                return null;
            } else if (normalizedId.indexOf(this.idPrefix) === 0) {
                return normalizedId;
            } else {
                return this.idPrefix + normalizedId;
            }
        },

        _resolveCurrentAnchor: function (operation, $el) {
            if (!$el || $el.length === 0 || $el.get(0).isConnected !== true) {
                return null;
            }

            const normalizedOperation = Breinify.UTL.isNonEmptyString(operation);
            if (normalizedOperation === null) {
                return null;
            }

            const operationLc = normalizedOperation.toLowerCase();
            const el = $el.get(0);
            const parent = el.parentNode;

            if (!Breinify.UTL.dom.isNodeType(parent, 1)) {
                return null;
            }

            if (operationLc === "append" || operationLc === "prepend") {
                return parent;
            } else if (operationLc === "before") {
                return el.nextElementSibling;
            } else if (operationLc === "after") {
                return el.previousElementSibling;
            } else {
                return null;
            }
        },

        _normalizeElementSupplierResult: function (value) {
            if (value == null) {
                return null;
            }

            if (value.jquery) {
                return value.length > 0 ? value.eq(0) : null;
            }

            if (Breinify.UTL.dom.isNodeType(value, 1)) {
                return $(value);
            }

            return null;
        },

        _createElementInstance: function (elementOrSupplier, context) {
            if ($.isFunction(elementOrSupplier)) {
                return this._normalizeElementSupplierResult(elementOrSupplier(context));
            }

            return this._normalizeElementSupplierResult(elementOrSupplier);
        }
    };

    const WebExperiences = {

        hasAttributeActivation: function (configuration) {
            return _private.hasAttributeActivation(configuration);
        },

        isBootstrapped: function (id) {
            const normalizedId = _private.determineId(id);
            if (normalizedId === null) {
                return false;
            }

            return Breinify.plugins.api.isModule(normalizedId) === true;
        },

        bootstrap: function (id, configuration, module) {
            if (typeof module !== "object") {
                console.error("the module is not a valid module and cannot be setup (id: " + id + ")");
                return;
            }

            id = _private.determineId(id);
            if (id === null) {
                console.error("the id \"" + id + "\" is not a valid identifier");
                return;
            }

            if (Breinify.plugins._isAdded("trigger") !== true) {
                console.error("the trigger plugin is not available, skipping setup of the web-experiences with id \"" + id + "\"");
                return;
            } else if (Breinify.plugins.api.isModule(id) === true) {
                return;
            }

            Breinify.plugins.trigger.init();

            _private.setup(configuration, module);
            Breinify.plugins.api.addModule(id, module);
        },

        style: function (settings, $el, selector) {
            const snippetId = $.isPlainObject(settings?.style)
                ? Breinify.UTL.isNonEmptyString(settings.style.snippet)
                : null;

            if (snippetId === null || Breinify.plugins._isAdded("snippetManager") !== true) {
                return;
            }

            const snippet = Breinify.UTL.isNonEmptyString(Breinify.plugins.snippetManager.getSnippet(snippetId));
            if (snippet === null) {
                return;
            }

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
        },

        /**
         * Attaches a web-experience element to one or more resolved anchor elements based on the configured
         * `position` of the experience.
         *
         * The method supports two attachment modes:
         * - `single`: attaches one existing element to one resolved anchor
         * - `multi`: creates one new element per resolved anchor by using a supplier function
         *
         * The anchor elements are resolved from `webExpSettings.position`. A valid position must define:
         * - `operation`: one of `append`, `prepend`, `before`, or `after`
         * - either `selector` or `snippet`
         *
         * Supported values for `elOrSupplier`:
         * - a jQuery-wrapped element or DOM element, used for `single` attachment
         * - a supplier function returning a new element instance, used for `multi` attachment
         *
         * For `multi`, the supplier must return a fresh element for each anchor. The framework uses
         * the optional `placement.key` together with the anchor element to keep attachment stable and
         * prevent duplicate instances for the same experience at the same anchor.
         *
         * Return behavior:
         * - in `single` mode, returns `true` if the element is attached or already correctly attached
         *   and `false` otherwise
         * - in `multi` mode, returns `true` if at least one instance is attached or already present
         *   at a valid anchor and `false` otherwise
         *
         * @param {Object} webExpSettings
         * the web-experience settings containing the `position` definition used to resolve anchor elements
         *
         * @param {jQuery|Element|Function} elOrSupplier
         * either the element to attach in `single` mode or a supplier function creating a new element for
         * each anchor in `multi` mode
         *
         * @param {Object} [placement]
         * optional placement configuration
         *
         * @param {String} [placement.cardinality='single']
         * determines whether the attachment is handled as `single` or `multi`
         *
         * @param {String} [placement.key]
         * stable identifier used in `multi` mode to deduplicate per-anchor instances for the same experience
         *
         * @return {boolean}
         * returns `true` if attachment succeeded, or if the required attachment state was already satisfied;
         * otherwise returns `false`
         */
        attach: function (webExpSettings, elOrSupplier, placement) {

            placement = $.extend(true, {
                cardinality: 'single',
                key: null
            }, $.isPlainObject(placement) ? placement : {});

            const position = $.isPlainObject(webExpSettings) && $.isPlainObject(webExpSettings.position)
                ? webExpSettings.position
                : null;
            if (position == null) {
                return false;
            }

            const operation = Breinify.UTL.isNonEmptyString(position.operation);
            if (operation === null) {
                return false;
            }

            let $anchor = null;
            const selector = Breinify.UTL.isNonEmptyString(position.selector);
            const snippet = Breinify.UTL.isNonEmptyString(position.snippet);

            if (selector === null && snippet === null) {
                return false;
            } else if (selector !== null) {
                $anchor = $(selector);
            } else if (snippet !== null) {
                const positionFunc = Breinify.plugins._isAdded('snippetManager') === true
                    ? Breinify.plugins.snippetManager.getSnippet(snippet)
                    : null;
                $anchor = $.isFunction(positionFunc) ? $(positionFunc()) : null;
            }

            if (!$anchor || $anchor.length === 0) {
                return false;
            }

            const $candidates = $anchor.filter(function () {
                return Breinify.UTL.dom.isNodeType(this, 1);
            });

            if ($candidates.length === 0) {
                return false;
            }

            const cardinality = Breinify.UTL.isNonEmptyString(placement.cardinality) || 'single';
            const isSupplier = $.isFunction(elOrSupplier);

            /*
             * SINGLE: old behavior, keep backward compatible.
             */
            if (cardinality !== 'multi') {
                if (!isSupplier && (!elOrSupplier || elOrSupplier.length === 0)) {
                    return false;
                }

                const $el = _private._createElementInstance(elOrSupplier);
                if (!$el || $el.length === 0) {
                    return false;
                }

                const currentAnchor = _private._resolveCurrentAnchor(operation, $el);
                if (currentAnchor !== null) {
                    const isStillValid = $candidates.filter(function () {
                        return this === currentAnchor;
                    }).length > 0;

                    if (isStillValid) {
                        $el.data('br.webexp.attach.operation', operation);
                        $el.data('br.webexp.attach.anchor', currentAnchor);
                        return true;
                    }
                }

                const previousAnchor = $el.data('br.webexp.attach.anchor');
                if (previousAnchor != null) {
                    const isPreviousStillValid = $candidates.filter(function () {
                        return this === previousAnchor;
                    }).length > 0;

                    if (isPreviousStillValid) {
                        const attached = Breinify.UTL.dom.attachByOperation(operation, $(previousAnchor), $el);
                        if (attached === true) {
                            $el.data('br.webexp.attach.operation', operation);
                            $el.data('br.webexp.attach.anchor', previousAnchor);
                            return true;
                        }
                    }
                }

                const targetAnchor = $candidates.get(0);
                if (targetAnchor == null) {
                    return false;
                }

                const attached = Breinify.UTL.dom.attachByOperation(operation, $(targetAnchor), $el);
                if (attached === true) {
                    $el.data('br.webexp.attach.operation', operation);
                    $el.data('br.webexp.attach.anchor', targetAnchor);
                    return true;
                }

                return false;
            }

            /*
             * MULTI: supplier required, dedupe per anchor.
             */
            if (!isSupplier) {
                return false;
            }

            const attachKey = Breinify.UTL.isNonEmptyString(placement.key) ||
                Breinify.UTL.isNonEmptyString(webExpSettings.webExId) ||
                Breinify.UTL.isNonEmptyString(webExpSettings.webExVersionId) ||
                Breinify.UTL.isNonEmptyString(selector) ||
                Breinify.UTL.isNonEmptyString(snippet);

            if (attachKey === null) {
                return false;
            }

            let attachedAny = false;
            const dataKey = 'br.webexp.multi.' + attachKey;

            $candidates.each(function () {
                const anchor = this;
                const $candidateAnchor = $(anchor);

                /*
                 * If this exact anchor already has an instance for this experience,
                 * skip it.
                 */
                if ($candidateAnchor.data(dataKey) === true) {
                    return;
                }

                const $newEl = _private._createElementInstance(elOrSupplier, {
                    anchor: anchor,
                    $anchor: $candidateAnchor,
                    operation: operation,
                    placement: placement,
                    webExpSettings: webExpSettings
                });
                if (!$newEl || $newEl.length === 0) {
                    return;
                }

                const attached = Breinify.UTL.dom.attachByOperation(operation, $candidateAnchor, $newEl);
                if (attached === true) {
                    $newEl.data('br.webexp.attach.operation', operation);
                    $newEl.data('br.webexp.attach.anchor', anchor);
                    $candidateAnchor.data(dataKey, true);
                    attachedAny = true;
                }
            });

            return attachedAny;
        }
    };

    Breinify.plugins._add("webExperiences", WebExperiences);
})();