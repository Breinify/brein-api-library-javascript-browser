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

            /*
             * If a module only defines ready, normalize it to onChange so the
             * web-experience framework can work with one unified lifecycle hook.
             */
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

            /*
             * Checks if the current page is valid for this module. If true, the
             * trigger framework may continue with findRequirements and onChange.
             */
            module.isValidPage = function () {
                return _self.checkActivityLogic(configuration, module) === true &&
                    (currentIsValidPage === null || currentIsValidPage.call(module) === true);
            };
        },

        setupDynamicRequirements: function (configuration, module) {

            /*
             * Only wrap if needed:
             * - ATTRIBUTE activation needs DOM observation
             * - dynamic position observation needs DOM observation
             * - an existing custom findRequirements must continue to work
             */
            const needsDynamicRequirements = this.hasAttributeActivation(configuration) === true ||
                this.hasDynamicPosition(configuration) === true ||
                $.isFunction(module.findRequirements);

            if (needsDynamicRequirements !== true || module._webExpDynamicRequirementsWrapped === true) {
                return;
            }

            const _self = this;
            const originalFindRequirements = $.isFunction(module.findRequirements) ? module.findRequirements : null;

            module._webExpDynamicRequirementsWrapped = true;
            module.renderingBehavior = "onChange";

            module.findRequirements = function ($el, data) {

                /*
                 * Fast exit: removed elements are never relevant for activation.
                 */
                if (data?.type === "removed-element") {
                    return false;
                }

                /*
                 * Resolve all framework-level targets first. If none match, we can
                 * stop immediately and avoid any additional module-specific work.
                 */
                const targets = _self.resolveTargets(configuration, module, $el, data);
                if (targets === null) {
                    return false;
                }

                /*
                 * Keep the last resolved targets so a module may use them later if needed.
                 */
                module._lastResolvedTargets = targets;

                /*
                 * If the module had no custom requirements, the framework-level match
                 * is already sufficient.
                 */
                if (originalFindRequirements === null) {
                    return true;
                }

                return originalFindRequirements.call(module, $el, data) === true;
            };
        },

        resolveTargets: function (configuration, module, $el, data) {
            const result = {
                attribute: null,
                position: null
            };

            const needsAttribute = this.hasAttributeActivation(configuration) === true;
            const needsDynamicPosition = this.hasDynamicPosition(configuration) === true;

            /*
             * Nothing framework-dynamic to resolve.
             */
            if (needsAttribute !== true && needsDynamicPosition !== true) {
                return result;
            }

            /*
             * ATTRIBUTE activation:
             * Only react to:
             * - added elements
             * - attribute changes of data-br-webexpid
             */
            if (needsAttribute === true) {
                result.attribute = this.findAttributeTarget(module, $el, data);
                if (result.attribute === null) {
                    return null;
                }
            }

            /*
             * Dynamic position observation:
             * Only resolve if the configured position itself is meant to be observed
             * on each change.
             */
            if (needsDynamicPosition === true) {
                result.position = this.findPositionTarget(configuration, $el, data);
                if (result.position === null) {
                    return null;
                }
            }

            return result;
        },

        checkActivityLogic: function (configuration, module) {
            if (!$.isPlainObject(configuration?.activationLogic)) {
                return true;
            }

            const logic = configuration.activationLogic;
            const paths = $.isArray(logic.paths) ? logic.paths : [];

            let isValidPage = paths.length === 0;
            let hasAttributeActivation = false;

            for (let i = 0; i < paths.length && isValidPage === false; i++) {
                const path = $.isPlainObject(paths[i]) ? paths[i] : {};
                const type = Breinify.UTL.isNonEmptyString(path.type);
                const value = Breinify.UTL.isNonEmptyString(path.value);

                if (type === "ATTRIBUTE") {
                    hasAttributeActivation = true;
                    continue;
                } else if (type === "ALL_PATHS") {
                    isValidPage = true;
                } else if (value === null) {
                    console.warn("found invalid activation-logic value, skipping");
                } else if (type === "STATIC_PATHS") {
                    if (value === window.location.pathname) {
                        isValidPage = true;
                    }
                } else if (type === "REGEX") {
                    try {
                        if (new RegExp(value).test(window.location.pathname) === true) {
                            isValidPage = true;
                        }
                    } catch (e) {
                        console.warn("found invalid activation-logic regex, skipping");
                    }
                } else {
                    console.warn('found undefined path type "' + type + '" in the activation logic, skipping');
                }

                /*
                 * Search parameters are AND-combined.
                 */
                if (isValidPage === true && $.isArray(path.searchParameters) && path.searchParameters.length > 0) {
                    for (let j = 0; j < path.searchParameters.length && isValidPage === true; j++) {
                        isValidPage = this.checkSearchParams(path.searchParameters[j]);
                    }
                }
            }

            /*
             * ATTRIBUTE activation is page-independent by design. If no path matched
             * but ATTRIBUTE exists, the page is still considered valid so DOM observation
             * can happen.
             */
            if (isValidPage !== true && hasAttributeActivation === true) {
                isValidPage = true;
            }

            return isValidPage === true ? this._checkActivationSnippet(logic.snippet) : false;
        },

        hasAttributeActivation: function (configuration) {
            const paths = $.isArray(configuration?.activationLogic?.paths) ? configuration.activationLogic.paths : [];

            for (let i = 0; i < paths.length; i++) {
                const path = $.isPlainObject(paths[i]) ? paths[i] : {};
                if (Breinify.UTL.isNonEmptyString(path.type) === "ATTRIBUTE") {
                    return true;
                }
            }

            return false;
        },

        hasDynamicPosition: function (configuration) {
            const renderingBehavior = Breinify.UTL.isNonEmptyString(configuration?.position?.renderingBehavior);
            return renderingBehavior !== null && renderingBehavior.toLowerCase() === "onchange";
        },

        findAttributeTarget: function (module, $el, data) {
            const type = data?.type;

            /*
             * Fast exits:
             * - removed elements are irrelevant
             * - attribute changes are only relevant for data-br-webexpid
             * - all other mutation types are irrelevant here
             */
            if (type === "removed-element") {
                return null;
            } else if (type === "attribute-change" && data?.attribute !== "data-br-webexpid") {
                return null;
            } else if (type !== "attribute-change" && type !== "added-element") {
                return null;
            }

            const root = $el && $el.length > 0 ? $el.get(0) : null;
            if (!Breinify.UTL.dom.isNodeType(root, 1)) {
                return null;
            }

            /*
             * Direct hit.
             */
            if (this._isMatchingWebExpDiv(module, root) === true) {
                return root;
            }

            /*
             * For attribute changes we only care about the changed element itself.
             * No subtree scan is needed.
             */
            if (type === "attribute-change") {
                return null;
            }

            /*
             * For added elements we scan the added subtree for the first matching target.
             */
            if (!$.isFunction(root.querySelectorAll)) {
                return null;
            }

            const nodes = root.querySelectorAll("div[data-br-webexpid]");
            for (let i = 0; i < nodes.length; i++) {
                if (this._isMatchingWebExpDiv(module, nodes[i]) === true) {
                    return nodes[i];
                }
            }

            return null;
        },

        findPositionTarget: function (configuration, $el, data) {
            const position = $.isPlainObject(configuration?.position) ? configuration.position : null;
            if (position === null) {
                return null;
            }

            const selector = Breinify.UTL.isNonEmptyString(position.selector);
            const snippet = Breinify.UTL.isNonEmptyString(position.snippet);
            const type = data?.type;

            /*
             * Fast exit: removed elements are never relevant.
             */
            if (type === "removed-element") {
                return null;
            }

            /*
             * Selector-based dynamic positioning:
             * Only search in the changed subtree / changed node so onChange stays cheap.
             */
            if (selector !== null) {
                const root = $el && $el.length > 0 ? $el.get(0) : null;
                if (!Breinify.UTL.dom.isNodeType(root, 1)) {
                    return null;
                }

                if ($.isFunction(root.matches) && root.matches(selector) === true) {
                    return root;
                }

                if ($.isFunction(root.querySelector)) {
                    const match = root.querySelector(selector);
                    return Breinify.UTL.dom.isNodeType(match, 1) ? match : null;
                }

                return null;
            }

            /*
             * Snippet-based positioning:
             * We cannot optimize against the changed subtree because the snippet controls
             * the lookup itself, so we execute it once and validate the result.
             */
            if (snippet !== null) {
                if (Breinify.plugins._isAdded("snippetManager") !== true) {
                    return null;
                }

                const snippetFunc = Breinify.plugins.snippetManager.getSnippet(snippet);
                if (!$.isFunction(snippetFunc)) {
                    return null;
                }

                try {
                    const $anchor = $(snippetFunc());
                    return $anchor.length > 0 && Breinify.UTL.dom.isNodeType($anchor.get(0), 1) ? $anchor.get(0) : null;
                } catch (e) {
                    return null;
                }
            }

            return null;
        },

        _isMatchingWebExpDiv: function (module, el) {
            if (!Breinify.UTL.dom.isNodeType(el, 1) || el.tagName !== "DIV") {
                return false;
            }

            const id = Breinify.UTL.isNonEmptyString(el.getAttribute("data-br-webexpid"));
            const expected = Breinify.UTL.isNonEmptyString(module?.webExId);

            return id !== null && expected !== null && id === expected;
        },

        checkSearchParams: function (condition) {
            if (!condition || !condition.param || !condition.operator) {
                return false;
            }

            const params = new URLSearchParams(window.location.search);
            const targetName = condition.param.toLowerCase();
            const values = [];

            for (const [key, val] of params.entries()) {
                if (key.toLowerCase() === targetName) {
                    values.push(val);
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
                    } catch (err) {
                        return false;
                    }
                    break;
                default:
                    return false;
            }

            return values.some(matcher);
        },

        _checkActivationSnippet: function (logicSnippet) {
            const snippet = Breinify.UTL.isNonEmptyString(logicSnippet);
            if (snippet === null) {
                return true;
            }

            if (Breinify.plugins._isAdded("snippetManager") !== true) {
                return false;
            }

            const activationSnippet = Breinify.plugins.snippetManager.getSnippet(snippet);
            if (!$.isFunction(activationSnippet)) {
                return false;
            }

            try {
                return activationSnippet() === true;
            } catch (e) {
                console.error("[breinify] error occurred while executing activationSnippet:", e);
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

            const op = Breinify.UTL.isNonEmptyString(operation);
            if (op === null) {
                return null;
            }

            const normalizedOperation = op.toLowerCase();
            const el = $el.get(0);
            const parent = el.parentNode;

            if (!Breinify.UTL.dom.isNodeType(parent, 1)) {
                return null;
            }

            if (normalizedOperation === "append" || normalizedOperation === "prepend") {
                return parent;
            } else if (normalizedOperation === "before") {
                return el.nextElementSibling;
            } else if (normalizedOperation === "after") {
                return el.previousElementSibling;
            } else {
                return null;
            }
        }
    };

    const WebExperiences = {

        determineActivationLogicType: function (configuration) {
            if (!$.isPlainObject(configuration?.activationLogic)) {
                return "NONE";
            }

            const logic = configuration.activationLogic;
            const paths = $.isArray(logic.paths) ? logic.paths : [];

            let hasAttribute = false;
            let hasPath = false;

            for (let i = 0; i < paths.length; i++) {
                const path = $.isPlainObject(paths[i]) ? paths[i] : {};
                const type = Breinify.UTL.isNonEmptyString(path.type);
                const value = Breinify.UTL.isNonEmptyString(path.value);

                if (type === "ATTRIBUTE") {
                    hasAttribute = true;
                } else if (type === "ALL_PATHS") {
                    hasPath = true;
                } else if (type === "STATIC_PATHS" || type === "REGEX") {
                    if (value === null) {
                        return "INVALID";
                    }
                    hasPath = true;
                } else {
                    return "INVALID";
                }
            }

            if (hasAttribute === true && hasPath === true) {
                return "ATTRIBUTE_AND_PATH";
            } else if (hasAttribute === true) {
                return "BY_ATTRIBUTE";
            } else if (hasPath === true) {
                return "BY_PATH";
            } else {
                return "NONE";
            }
        },

        isBootstrapped: function (id) {
            const normId = _private.determineId(id);
            if (normId === null) {
                return false;
            }

            return Breinify.plugins.api.isModule(normId) === true;
        },

        bootstrap: function (id, configuration, module) {

            if (typeof module !== "object") {
                console.error('the module is not a valid module and cannot be setup (id: ' + id + ')');
                return;
            }

            id = _private.determineId(id);
            if (id === null) {
                console.error('the id "' + id + '" is not a valid identifier');
                return;
            }

            if (Breinify.plugins._isAdded("trigger") !== true) {
                console.error('the trigger plugin is not available, skipping setup of the web-experience with id "' + id + '"');
                return;
            } else if (Breinify.plugins.api.isModule(id) === true) {
                return;
            } else {
                Breinify.plugins.trigger.init();
            }

            _private.setup(configuration, module);
            Breinify.plugins.api.addModule(id, module);
        },

        style: function (settings, $el, selector) {
            const snippetId = $.isPlainObject(settings?.style) ? Breinify.UTL.isNonEmptyString(settings.style.snippet) : null;
            if (snippetId === null || Breinify.plugins._isAdded("snippetManager") !== true) {
                return;
            }

            const snippet = Breinify.UTL.isNonEmptyString(Breinify.plugins.snippetManager.getSnippet(snippetId));
            if (snippet === null) {
                return;
            }

            try {
                const normalizedSelector = Breinify.UTL.isNonEmptyString(selector);
                if (normalizedSelector === null) {
                    $el.prepend($(snippet));
                } else {
                    $el.find(normalizedSelector).after($(snippet));
                }
            } catch (e) {
                // invalid snippet
            }
        },

        attach: function (webExpSettings, $el, placement) {
            placement = $.extend(true, {
                cardinality: "single"
            }, $.isPlainObject(placement) ? placement : {});

            if (!$el || $el.length === 0) {
                return false;
            }

            const position = $.isPlainObject(webExpSettings?.position) ? webExpSettings.position : null;
            if (position === null) {
                return false;
            }

            const operation = Breinify.UTL.isNonEmptyString(position.operation);
            if (operation === null) {
                return false;
            }

            const normalizedOperation = operation.toLowerCase();
            const cardinality = Breinify.UTL.isNonEmptyString(placement.cardinality) || "single";
            if (cardinality !== "single") {
                return false;
            }

            let $anchor = null;
            const selector = Breinify.UTL.isNonEmptyString(position.selector);
            const snippet = Breinify.UTL.isNonEmptyString(position.snippet);

            if (selector !== null) {
                $anchor = $(selector);
            } else if (snippet !== null) {
                if (Breinify.plugins._isAdded("snippetManager") !== true) {
                    return false;
                }

                const positionFunc = Breinify.plugins.snippetManager.getSnippet(snippet);
                $anchor = $.isFunction(positionFunc) ? $(positionFunc()) : null;
            } else {
                return false;
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

            /*
             * Step 1:
             * If already attached at a valid anchor for the current operation,
             * keep it there and do nothing.
             */
            const currentAnchor = _private._resolveCurrentAnchor(normalizedOperation, $el);
            if (currentAnchor !== null) {
                const isStillValid = $candidates.filter(function () {
                    return this === currentAnchor;
                }).length > 0;

                if (isStillValid === true) {
                    $el.data("br.webexp.attach.operation", normalizedOperation);
                    $el.data("br.webexp.attach.anchor", currentAnchor);
                    return true;
                }
            }

            /*
             * Step 2:
             * If we previously selected an anchor and it is still valid, prefer it.
             * This keeps placement deterministic and avoids unnecessary movement.
             */
            const previousAnchor = $el.data("br.webexp.attach.anchor");
            if (previousAnchor != null) {
                const isPreviousStillValid = $candidates.filter(function () {
                    return this === previousAnchor;
                }).length > 0;

                if (isPreviousStillValid === true) {
                    const attachedToPrevious = Breinify.UTL.dom.attachByOperation(normalizedOperation, $(previousAnchor), $el);
                    if (attachedToPrevious === true) {
                        $el.data("br.webexp.attach.operation", normalizedOperation);
                        $el.data("br.webexp.attach.anchor", previousAnchor);
                        return true;
                    }
                }
            }

            /*
             * Step 3:
             * Otherwise choose the first candidate in DOM order.
             */
            const targetAnchor = $candidates.get(0);
            if (!Breinify.UTL.dom.isNodeType(targetAnchor, 1)) {
                return false;
            }

            const attached = Breinify.UTL.dom.attachByOperation(normalizedOperation, $(targetAnchor), $el);
            if (attached === true) {
                $el.data("br.webexp.attach.operation", normalizedOperation);
                $el.data("br.webexp.attach.anchor", targetAnchor);
                return true;
            }

            return false;
        }
    };

    Breinify.plugins._add("webExperiences", WebExperiences);
})();