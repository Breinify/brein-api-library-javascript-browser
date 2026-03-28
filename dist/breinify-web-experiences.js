"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    } else if (Breinify.plugins._isAdded('webExperiences')) {
        return;
    }

    const $ = Breinify.UTL._jquery();

    const _private = {
        idPrefix: 'web-experience-',

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

            module._webExpDynamicRequirementsWrapped = true;
            module.renderingBehavior = 'onChange';

            module.findRequirements = function ($el, data) {

                // 🔴 FAST EXIT
                if (data?.type === 'removed-element') {
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

        /*
         * --------------------------------------------------
         * UNIFIED TARGET RESOLVER
         * --------------------------------------------------
         */
        resolveTargets: function (configuration, module, $el, data) {

            const type = data?.type;

            // 🔴 FAST EXIT
            if (type === 'attribute-change' && data?.attribute !== 'data-br-webexpid') {
                return null;
            }

            const root = $el && $el.length > 0 ? $el[0] : null;

            const result = {
                positions: []
            };

            /*
             * ATTRIBUTE TARGETS
             */
            if (this.hasAttributeActivation(configuration)) {

                let found = [];

                if (root && Breinify.UTL.dom.isNodeType(root, 1)) {

                    if (this._isMatchingWebExpDiv(module, root)) {
                        found.push(root);
                    }

                    else if (type === 'added-element' && $.isFunction(root.querySelectorAll)) {
                        const nodes = root.querySelectorAll('div[data-br-webexpid]');
                        for (let i = 0; i < nodes.length; i++) {
                            if (this._isMatchingWebExpDiv(module, nodes[i])) {
                                found.push(nodes[i]);
                            }
                        }
                    }
                }

                if (found.length === 0) {
                    return null;
                }

                result.positions = found;
                return result;
            }

            /*
             * POSITION TARGETS
             */
            const position = $.isPlainObject(configuration?.position) ? configuration.position : null;

            if (position) {

                const selector = Breinify.UTL.isNonEmptyString(position.selector);
                const snippet = Breinify.UTL.isNonEmptyString(position.snippet);

                if (selector !== null) {

                    if (!root || !Breinify.UTL.dom.isNodeType(root, 1)) {
                        const $matches = $(selector);
                        if ($matches.length === 0) {
                            return null;
                        }

                        result.positions = $matches.toArray();
                        return result;
                    }

                    if (root.matches?.(selector)) {
                        result.positions.push(root);
                    }

                    const matches = root.querySelectorAll?.(selector);
                    if (matches && matches.length > 0) {
                        result.positions = result.positions.concat(Array.from(matches));
                    }

                    if (result.positions.length === 0) {
                        return null;
                    }

                    return result;
                }

                else if (snippet !== null) {

                    const fn = Breinify.plugins._isAdded('snippetManager')
                        ? Breinify.plugins.snippetManager.getSnippet(snippet)
                        : null;

                    if (!$.isFunction(fn)) {
                        return null;
                    }

                    try {
                        const $anchor = $(fn());
                        if ($anchor.length === 0) {
                            return null;
                        }

                        result.positions = $anchor.toArray();
                        return result;
                    } catch (e) {
                        return null;
                    }
                }
            }

            return null;
        },

        _isMatchingWebExpDiv: function (module, el) {

            if (!el || !Breinify.UTL.dom.isNodeType(el, 1) || el.tagName !== 'DIV') {
                return false;
            }

            const id = Breinify.UTL.isNonEmptyString(el.getAttribute('data-br-webexpid'));
            const expected = Breinify.UTL.isNonEmptyString(module?.webExId);

            return id !== null && expected !== null && id === expected;
        },

        hasAttributeActivation: function (configuration) {
            const paths = $.isArray(configuration?.activationLogic?.paths)
                ? configuration.activationLogic.paths : [];

            return paths.some(p => Breinify.UTL.isNonEmptyString(p?.type) === 'ATTRIBUTE');
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

                if (type === 'ATTRIBUTE') {
                    hasAttribute = true;
                    continue;
                } else if (type === 'ALL_PATHS') {
                    isValidPage = true;
                } else if (type === 'STATIC_PATHS' && value === window.location.pathname) {
                    isValidPage = true;
                } else if (type === 'REGEX') {
                    try {
                        if (new RegExp(value).test(window.location.pathname)) {
                            isValidPage = true;
                        }
                    } catch (e) {}
                }

                if (isValidPage && $.isArray(path.searchParameters)) {
                    for (let j = 0; j < path.searchParameters.length && isValidPage; j++) {
                        isValidPage = this.checkSearchParams(path.searchParameters[j]);
                    }
                }
            }

            if (!isValidPage && hasAttribute) {
                isValidPage = true;
            }

            return isValidPage ? this._checkActivationSnippet(logic.snippet) : false;
        },

        checkSearchParams: function (condition) {
            if (!condition || !condition.param || !condition.operator) {
                return false;
            }

            const params = new URLSearchParams(window.location.search);
            const name = condition.param.toLowerCase();
            const values = [];

            for (const [k, v] of params.entries()) {
                if (k.toLowerCase() === name) {
                    values.push(v);
                }
            }

            if (!values.length) return false;

            const expected = condition.value ?? '';

            const map = {
                equals: v => v === expected,
                contains: v => v.includes(expected),
                startsWith: v => v.startsWith(expected),
                endsWith: v => v.endsWith(expected),
                regex: v => {
                    try { return new RegExp(expected).test(v); } catch { return false; }
                }
            };

            const matcher = map[condition.operator];
            return matcher ? values.some(matcher) : false;
        },

        _checkActivationSnippet: function (snippetId) {
            const id = Breinify.UTL.isNonEmptyString(snippetId);
            if (!id) return true;

            const fn = Breinify.plugins._isAdded('snippetManager')
                ? Breinify.plugins.snippetManager.getSnippet(id)
                : null;

            try {
                return $.isFunction(fn) && fn() === true;
            } catch {
                return false;
            }
        },

        determineId: function (id) {
            const norm = Breinify.UTL.isNonEmptyString(id);
            return norm ? (norm.startsWith(this.idPrefix) ? norm : this.idPrefix + norm) : null;
        }
    };

    const WebExperiences = {

        isBootstrapped: function (id) {
            const norm = _private.determineId(id);
            return norm && Breinify.plugins.api.isModule(norm) === true;
        },

        bootstrap: function (id, configuration, module) {

            if (typeof module !== 'object') return;

            id = _private.determineId(id);
            if (!id) return;

            if (!Breinify.plugins._isAdded('trigger')) return;
            if (Breinify.plugins.api.isModule(id)) return;

            Breinify.plugins.trigger.init();

            _private.setup(configuration, module);
            Breinify.plugins.api.addModule(id, module);
        },

        attach: function (webExpSettings, $el, placement, module) {

            placement = $.extend(true, { cardinality: 'single' }, placement);

            if (!$el || !$el.length) return false;

            const pos = webExpSettings?.position;
            if (!$.isPlainObject(pos)) return false;

            const op = Breinify.UTL.isNonEmptyString(pos.operation)?.toLowerCase();
            if (!op) return false;

            const targets = module?._lastResolvedTargets?.positions;

            if (!targets || targets.length === 0) {
                return false;
            }

            // 🔴 SINGLE
            if (placement.cardinality === 'single') {
                const target = targets[0];

                if (!Breinify.UTL.dom.isNodeType(target, 1)) {
                    return false;
                }

                return Breinify.UTL.dom.attachByOperation(op, $(target), $el) === true;
            }

            // 🔴 MULTI
            if (placement.cardinality === 'multi') {

                module._attachInstances = module._attachInstances || new Map();

                // cleanup
                module._attachInstances.forEach((instance, target) => {
                    if (!targets.includes(target)) {
                        instance.remove();
                        module._attachInstances.delete(target);
                    }
                });

                targets.forEach(target => {

                    if (!Breinify.UTL.dom.isNodeType(target, 1)) {
                        return;
                    }

                    let $instance = module._attachInstances.get(target);

                    if (!$instance) {
                        $instance = $el.clone(true, true);
                        module._attachInstances.set(target, $instance);
                    }

                    Breinify.UTL.dom.attachByOperation(op, $(target), $instance);
                });

                return true;
            }

            return false;
        }
    };

    Breinify.plugins._add('webExperiences', WebExperiences);
})();