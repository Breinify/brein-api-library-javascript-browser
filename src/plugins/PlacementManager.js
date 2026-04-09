"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("placementManager")) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    const api = Breinify?.plugins?.api;
    const placementManagerModuleName = "placementManagerModule-" + Breinify.UTL.uuid();

    const placementManagerModule = {
        _initialized: false,

        /*
         * Internal marker attributes used for idempotency and ownership.
         */
        _markerOwner: "data-br-plmt-owner",
        _markerKey: "data-br-plmt-key",

        /*
         * Cached page state.
         */
        _pageCache: {
            href: null,
            url: null,
            activeRules: []
        },

        /*
         * All registered placement rules.
         */
        _rules: [],

        /*
         * Tracks inserted DOM elements owned by this shared module.
         *
         * Each entry contains:
         * - key
         * - type
         * - selector
         * - position
         * - ruleId
         * - element
         */
        _trackedInsertions: [],

        /*
         * Debounced reconcile timer used to recover from SPA rerender timing.
         */
        _reconcileTimer: null,

        /**
         * Initializes the shared placement module.
         */
        initialize: function () {
            if (this._initialized === true) {
                return;
            }

            this._initialized = true;
        },

        /**
         * Adds rules.
         *
         * Supported action types:
         * - attribute
         *   Applies or updates an attribute on the matched target element.
         *
         * - insert-webexperience
         *   Inserts a managed Breinify web-experience container relative to
         *   the matched target element.
         *
         * - insert-html
         *   Inserts one managed HTML root element relative to the matched
         *   target element.
         *
         * - custom
         *   Executes caller-provided custom logic.
         *
         *   Custom action characteristics:
         *   - does not require a selector
         *   - requires code(ctx)
         *   - may optionally define shouldRun(ctx)
         *   - generates a stable action key for managed marker usage
         *
         *   Custom action hooks:
         *   - shouldRun(ctx): optional synchronous predicate to determine whether
         *     the action needs to run
         *   - code(ctx): required action implementation, may return a Promise
         *
         * Supported observe types:
         * - exists
         * - attribute
         *
         * Observe semantics:
         * - all observe entries of a rule must match on the full document
         * - local DOM mutations use OR semantics only to determine whether a
         *   rule should be re-evaluated
         *
         * Rule evaluation model:
         * - observe determines whether the rule is relevant to the current page
         *   state or DOM mutation
         * - condition determines whether the rule is allowed to apply
         * - shouldRun(ctx) determines whether a custom action actually needs work
         * - code(ctx) performs the custom action
         *
         * @param {Array} rules rules to add
         * @returns {number} number of rules newly added
         */
        addRules: function (rules) {
            const _self = this;
            let addedCount = 0;

            if (!$.isArray(rules) || rules.length === 0) {
                return 0;
            }

            $.each(rules, function (idx, rule) {
                let normalizedRule;

                if (!$.isPlainObject(rule)) {
                    return true;
                }

                normalizedRule = $.extend(true, {}, rule);
                _self._normalizeRule(normalizedRule);

                if (normalizedRule._hasObserve !== true || normalizedRule._hasActions !== true) {
                    return true;
                }

                if (_self.hasRule(normalizedRule.id) === true) {
                    return true;
                }

                _self._rules.push(normalizedRule);
                addedCount++;

                return true;
            });

            if (addedCount > 0) {
                _self._pageCache.href = null;
            }

            return addedCount;
        },

        /**
         * Checks if a rule with the provided id is already registered.
         *
         * @param {string} ruleId rule id
         * @returns {boolean} true if the rule exists
         */
        hasRule: function (ruleId) {
            let i;

            if (!Breinify.UTL.isNonEmptyString(ruleId)) {
                return false;
            }

            for (i = 0; i < this._rules.length; i++) {
                if (this._rules[i] && this._rules[i].id === ruleId) {
                    return true;
                }
            }

            return false;
        },

        /**
         * Always returns true.
         *
         * Trigger.js handles page-change timing. Actual page relevance is
         * evaluated by the normalized rules.
         *
         * @returns {boolean} always true
         */
        isValidPage: function () {
            return true;
        },

        /**
         * Determines whether actions must be applied for the current event.
         *
         * Supported data.type values:
         * - full-scan
         * - added-element
         * - attribute-change
         * - removed-element
         *
         * @param {jQuery} $el changed element
         * @param {Object} data trigger metadata
         * @returns {false|Object} false if no work is needed; otherwise payload
         */
        findRequirements: function ($el, data) {
            const normalizedData = $.isPlainObject(data) ? data : {};
            const type = typeof normalizedData.type === "string" ? normalizedData.type : "undefined";
            const attribute = typeof normalizedData.attribute === "string" ? normalizedData.attribute : null;
            const activeRules = this._getActiveRules();
            const actions = [];
            const evaluationCache = {
                documentMatches: {},
                conditionMatches: {}
            };
            let cleanup = [];
            let reconcile = false;

            if (activeRules.length === 0) {
                if (type === "full-scan") {
                    cleanup = this._collectTrackedCleanup(activeRules);
                    return this._createPayload(actions, cleanup, false);
                }

                return false;
            } else if (type === "removed-element") {
                if (this._containsManagedPlacement($el) !== true) {
                    return false;
                }

                cleanup = this._collectTrackedCleanup(activeRules);
                this._collectDocumentActions(activeRules, actions, evaluationCache);
                reconcile = true;

                return this._createPayload(actions, cleanup, reconcile);
            } else if (type === "full-scan") {
                cleanup = this._collectTrackedCleanup(activeRules);
                this._collectDocumentActions(activeRules, actions, evaluationCache);

                return this._createPayload(actions, cleanup, false);
            } else if (!$el || $el.length === 0) {
                return false;
            } else if (type === "added-element") {
                this._collectElementActions($el, activeRules, actions, evaluationCache);
                return this._createPayload(actions, cleanup, false);
            } else if (type === "attribute-change") {
                this._collectAttributeActions($el, attribute, activeRules, actions, evaluationCache);
                return this._createPayload(actions, cleanup, false);
            }

            return false;
        },

        /**
         * Creates a normalized payload or false if there is no work to do.
         *
         * @param {Array} actions actions to apply
         * @param {Array} cleanup tracked entries to cleanup
         * @param {boolean} reconcile whether to schedule a deferred reconcile
         * @returns {false|Object} normalized payload or false
         * @private
         */
        _createPayload: function (actions, cleanup, reconcile) {
            const normalizedActions = $.isArray(actions) ? actions : [];
            const normalizedCleanup = $.isArray(cleanup) ? cleanup : [];

            if (normalizedActions.length === 0 && normalizedCleanup.length === 0 && reconcile !== true) {
                return false;
            }

            return {
                actions: normalizedActions,
                cleanup: normalizedCleanup,
                reconcile: reconcile === true
            };
        },

        /**
         * Checks whether the removed element is, or contains, a placement-manager-owned
         * node. This is used to selectively react to removals that affect our own
         * rendered placements.
         *
         * @param {jQuery} $el removed element
         * @returns {boolean} true if the removed subtree affects a managed placement
         * @private
         */
        _containsManagedPlacement: function ($el) {
            if (!$el || $el.length === 0) {
                return false;
            }

            return $el.is("[" + this._markerOwner + "=\"placementManager\"]") ||
                $el.find("[" + this._markerOwner + "=\"placementManager\"]").length > 0;
        },

        /**
         * Schedules a debounced full reconcile.
         *
         * This is intentionally used only for recovery scenarios such as managed
         * placement removal during SPA rerendering. It is not part of the hot path.
         *
         * @private
         */
        _reconcileSoon: function () {
            const _self = this;

            if (this._reconcileTimer !== null) {
                return;
            }

            this._reconcileTimer = window.setTimeout(function () {
                let requirements;

                _self._reconcileTimer = null;
                requirements = _self.findRequirements($("body"), {
                    type: "full-scan"
                });

                if ($.isPlainObject(requirements)) {
                    _self.onChange(requirements);
                } else if (requirements === true) {
                    _self.onChange({});
                }
            }, 0);
        },

        /**
         * Applies cleanup and actions.
         *
         * @param {Object} data payload from findRequirements
         */
        onChange: function (data) {
            const _self = this;
            let hadCleanup = false;

            if (!$.isPlainObject(data)) {
                return;
            }

            if ($.isArray(data.cleanup) && data.cleanup.length > 0) {
                hadCleanup = true;

                $.each(data.cleanup, function (idx, trackedEntry) {
                    _self._removeTrackedInsertion(trackedEntry);
                    return true;
                });
            }

            if ($.isArray(data.actions) && data.actions.length > 0) {
                $.each(data.actions, function (idx, action) {
                    if (!action) {
                        return true;
                    } else if (action.type === "custom") {
                        const result = _self._applyCustomAction(action);
                        if (result && $.isFunction(result.then)) {
                            result.catch(function (e) {
                                console.error("[placementManager] async custom action failed:", e);
                            });
                        }
                        return true;
                    }

                    if (!action || !action.$target || action.$target.length === 0) {
                        return true;
                    } else if (action.type === "attribute") {
                        _self._applyAttributeAction(action);
                    } else if (action.type === "insert-webexperience") {
                        _self._applyInsertWebExperienceAction(action);
                    } else if (action.type === "insert-html") {
                        _self._applyInsertHtmlAction(action);
                    }

                    return true;
                });
            }

            if (data.reconcile === true || hadCleanup === true) {
                this._reconcileSoon();
            }
        },

        /**
         * Normalizes one rule.
         *
         * @param {Object} rule rule to normalize
         * @private
         */
        _normalizeRule: function (rule) {
            let normalizedObserve = [];
            let normalizedActions = [];
            let observeSelectors = {};
            let attributeTriggerMap = {};
            let hasAttributeTriggers = false;

            if (!$.isPlainObject(rule)) {
                return;
            } else if (!Breinify.UTL.isNonEmptyString(rule.id)) {
                rule.id = "placement-rule-" + Breinify.UTL.uuid();
            }

            if (!$.isFunction(rule.condition)) {
                rule.condition = null;
            }
            if (!$.isArray(rule.observe)) {
                rule.observe = [];
            }
            if (!$.isArray(rule.actions)) {
                rule.actions = [];
            }

            $.each(rule.observe, function (idx, observe) {
                const normalizedObserveEntry = PlacementManager._normalizeObserve(observe);

                if (normalizedObserveEntry !== null) {
                    normalizedObserve.push(normalizedObserveEntry);
                    observeSelectors[normalizedObserveEntry.selector] = true;

                    if (normalizedObserveEntry.type === "attribute" && normalizedObserveEntry.attribute) {
                        attributeTriggerMap[normalizedObserveEntry.attribute] = true;
                        hasAttributeTriggers = true;
                    }
                }

                return true;
            });

            $.each(rule.actions, function (idx, action) {
                const normalizedAction = PlacementManager._normalizeAction(rule, action);

                if (normalizedAction !== null) {
                    normalizedActions.push(normalizedAction);

                    if (normalizedObserve.length === 0 && normalizedAction.selector) {
                        observeSelectors[normalizedAction.selector] = true;
                    }
                }

                return true;
            });

            if (normalizedObserve.length === 0) {
                $.each(observeSelectors, function (selector) {
                    normalizedObserve.push({
                        type: "exists",
                        selector: selector
                    });
                    return true;
                });
            }

            rule.observe = normalizedObserve;
            rule.actions = normalizedActions;
            rule._hasObserve = rule.observe.length > 0;
            rule._hasActions = rule.actions.length > 0;
            rule._attributeTriggerMap = attributeTriggerMap;
            rule._hasAttributeTriggers = hasAttributeTriggers;
        },

        /**
         * Evaluates an optional dynamic condition for a rule.
         *
         * @param {Object} rule normalized rule
         * @returns {boolean} true if condition passes or is not defined
         * @private
         */
        _ruleMatchesCondition: function (rule) {
            if (!rule || $.isFunction(rule.condition) !== true) {
                return true;
            }

            try {
                return rule.condition() === true;
            } catch (e) {
                return false;
            }
        },

        /**
         * Returns a stable cache key for a rule during one evaluation cycle.
         *
         * @param {Object} rule normalized rule
         * @returns {string} cache key
         * @private
         */
        _getRuleCacheKey: function (rule) {
            if (rule && typeof rule.id === "string" && rule.id !== "") {
                return rule.id;
            }

            return String(rule);
        },

        /**
         * Returns cached full-document match state for a rule.
         *
         * @param {Object} rule normalized rule
         * @param {Object} evaluationCache per-cycle cache
         * @returns {boolean} true if the rule matches the document
         * @private
         */
        _getCachedRuleMatchesDocument: function (rule, evaluationCache) {
            const cache = evaluationCache && $.isPlainObject(evaluationCache.documentMatches)
                ? evaluationCache.documentMatches
                : null;
            const key = this._getRuleCacheKey(rule);

            if (cache && typeof cache[key] !== "undefined") {
                return cache[key] === true;
            }

            const result = this._ruleMatchesDocument(rule) === true;

            if (cache) {
                cache[key] = result;
            }

            return result;
        },

        /**
         * Returns cached dynamic condition state for a rule.
         *
         * @param {Object} rule normalized rule
         * @param {Object} evaluationCache per-cycle cache
         * @returns {boolean} true if the rule condition passes
         * @private
         */
        _getCachedRuleMatchesCondition: function (rule, evaluationCache) {
            const cache = evaluationCache && $.isPlainObject(evaluationCache.conditionMatches)
                ? evaluationCache.conditionMatches
                : null;
            const key = this._getRuleCacheKey(rule);

            if (cache && typeof cache[key] !== "undefined") {
                return cache[key] === true;
            }

            const result = this._ruleMatchesCondition(rule) === true;

            if (cache) {
                cache[key] = result;
            }

            return result;
        },

        /**
         * Refreshes cached page information if href changed.
         *
         * @private
         */
        _refreshPageCache: function () {
            const href = String(window.location.href || "");
            const activeRules = [];
            let url;

            if (this._pageCache.href === href) {
                return;
            }

            try {
                url = new URL(href);
            } catch (e) {
                url = {
                    href: href,
                    pathname: String(window.location.pathname || ""),
                    search: String(window.location.search || "")
                };
            }

            $.each(this._rules, function (idx, rule) {
                try {
                    if (rule._hasObserve === true &&
                        rule._hasActions === true &&
                        $.isFunction(rule.isValidPage) &&
                        rule.isValidPage(url) === true) {
                        activeRules.push(rule);
                    }
                } catch (e) {
                    /* ignore invalid rule */
                }

                return true;
            });

            this._pageCache.href = href;
            this._pageCache.url = url;
            this._pageCache.activeRules = activeRules;
        },

        /**
         * Returns cached active rules for the current page.
         *
         * @returns {Array} active rules
         * @private
         */
        _getActiveRules: function () {
            this._refreshPageCache();
            return this._pageCache.activeRules;
        },

        /**
         * Collects actions for a full document scan.
         *
         * @param {Array} activeRules active rules
         * @param {Array} actions target action list
         * @param {Object} evaluationCache per-cycle cache
         * @private
         */
        _collectDocumentActions: function (activeRules, actions, evaluationCache) {
            const _self = this;

            $.each(activeRules, function (idx, rule) {
                if (_self._getCachedRuleMatchesDocument(rule, evaluationCache) !== true) {
                    return true;
                } else if (_self._getCachedRuleMatchesCondition(rule, evaluationCache) !== true) {
                    return true;
                }

                _self._collectRuleActionsFromDocument(rule, actions);
                return true;
            });
        },

        /**
         * Collects actions for an added-element event using only local checks.
         *
         * @param {jQuery} $el changed element
         * @param {Array} activeRules active rules
         * @param {Array} actions target action list
         * @param {Object} evaluationCache per-cycle cache
         * @private
         */
        _collectElementActions: function ($el, activeRules, actions, evaluationCache) {
            const _self = this;

            $.each(activeRules, function (idx, rule) {
                if (_self._ruleMatchesElement(rule, $el, null, false) !== true) {
                    return true;
                } else if (_self._getCachedRuleMatchesDocument(rule, evaluationCache) !== true) {
                    return true;
                } else if (_self._getCachedRuleMatchesCondition(rule, evaluationCache) !== true) {
                    return true;
                }

                _self._collectRuleActionsFromDocument(rule, actions);
                return true;
            });
        },

        /**
         * Collects actions for an attribute-change event.
         *
         * @param {jQuery} $el changed element
         * @param {string|null} attribute changed attribute
         * @param {Array} activeRules active rules
         * @param {Array} actions target action list
         * @param {Object} evaluationCache per-cycle cache
         * @private
         */
        _collectAttributeActions: function ($el, attribute, activeRules, actions, evaluationCache) {
            const _self = this;

            if (typeof attribute !== "string" || attribute === "") {
                return;
            }

            $.each(activeRules, function (idx, rule) {
                if (rule._hasAttributeTriggers !== true || rule._attributeTriggerMap[attribute] !== true) {
                    return true;
                } else if (_self._ruleMatchesElement(rule, $el, attribute, true) !== true) {
                    return true;
                } else if (_self._getCachedRuleMatchesDocument(rule, evaluationCache) !== true) {
                    return true;
                } else if (_self._getCachedRuleMatchesCondition(rule, evaluationCache) !== true) {
                    return true;
                }

                _self._collectRuleActionsFromDocument(rule, actions);
                return true;
            });
        },

        /**
         * Evaluates whether a rule matches the full document.
         *
         * Full-document semantics remain strict AND across observe entries.
         *
         * @param {Object} rule normalized rule
         * @returns {boolean} true if the rule currently matches the document
         * @private
         */
        _ruleMatchesDocument: function (rule) {
            let i;
            let observe;

            for (i = 0; i < rule.observe.length; i++) {
                observe = rule.observe[i];

                if (observe.type === "exists") {
                    if ($(observe.selector).length === 0) {
                        return false;
                    }
                } else if (observe.type === "attribute") {
                    if ($(observe.selector).length === 0) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            return true;
        },

        /**
         * Evaluates whether a rule is relevant for the current local mutation.
         *
         * Local mutation relevance uses OR semantics:
         * - if the changed element is locally related to any observed selector,
         *   the rule is relevant enough to re-evaluate actions
         *
         * This is the correct behavior for SPA rerenders where one mutation usually
         * touches only one of several observed subtrees.
         *
         * @param {Object} rule normalized rule
         * @param {jQuery} $el changed element
         * @param {string|null} attribute changed attribute
         * @param {boolean} isAttributeEvent true if attribute-change event
         * @returns {boolean} true if the rule should be evaluated
         * @private
         */
        _ruleMatchesElement: function (rule, $el, attribute, isAttributeEvent) {
            let i;
            let observe;
            let matched = false;

            for (i = 0; i < rule.observe.length; i++) {
                observe = rule.observe[i];

                if (observe.type === "exists") {
                    if (this._matchesSelectorLocally($el, observe.selector) === true) {
                        matched = true;
                    }
                } else if (observe.type === "attribute") {
                    if (isAttributeEvent === true &&
                        observe.attribute === attribute &&
                        this._matchesSelectorLocally($el, observe.selector) === true) {
                        matched = true;
                    }
                }
            }

            return matched;
        },

        /**
         * Collects all missing actions for a rule using full document selectors.
         *
         * @param {Object} rule normalized rule
         * @param {Array} actions target action list
         * @private
         */
        _collectRuleActionsFromDocument: function (rule, actions) {
            let i;
            let action;
            let $targets;

            for (i = 0; i < rule.actions.length; i++) {
                action = rule.actions[i];

                if (action.type === "custom") {
                    actions.push(action);
                    continue;
                }

                $targets = $(action.selector);
                if ($targets.length === 0) {
                    continue;
                }

                if (action.singleTarget === true && $targets.length > 1) {
                    $targets = $targets.first();
                }

                this._collectActionTargets(actions, $targets, action, rule);
            }
        },

        /**
         * Collects still-missing action executions for the provided targets.
         *
         * @param {Array} actions target action list
         * @param {jQuery} $targets matching targets
         * @param {Object} action normalized action definition
         * @param {Object} rule owning rule
         * @private
         */
        _collectActionTargets: function (actions, $targets, action, rule) {
            const _self = this;

            if (!$targets || $targets.length === 0) {
                return;
            } else if (action.singleTarget === true) {
                this._collectSingleTargetAction(actions, $targets.first(), action, rule);
                return;
            }

            $targets.each(function () {
                _self._collectSingleTargetAction(actions, $(this), action, rule);
            });
        },

        /**
         * Collects one missing action for one target if not already fulfilled.
         *
         * @param {Array} actions target action list
         * @param {jQuery} $target action target
         * @param {Object} action normalized action definition
         * @param {Object} rule owning rule
         * @private
         */
        _collectSingleTargetAction: function (actions, $target, action, rule) {
            if (action.type === "attribute") {
                if ($target.attr(action.name) !== action.value) {
                    actions.push({
                        type: "attribute",
                        $target: $target,
                        key: action.key,
                        name: action.name,
                        value: action.value
                    });
                }
            } else if (action.type === "insert-webexperience") {
                if (this._isInsertFulfilled($target, action) !== true) {
                    actions.push({
                        type: "insert-webexperience",
                        $target: $target,
                        key: action.key,
                        selector: action.selector,
                        position: action.position,
                        webExpId: action.webExpId,
                        positionId: action.positionId,
                        ruleId: rule.id || null
                    });
                }
            } else if (action.type === "insert-html") {
                if (this._isInsertFulfilled($target, action) !== true) {
                    actions.push({
                        type: "insert-html",
                        $target: $target,
                        key: action.key,
                        selector: action.selector,
                        position: action.position,
                        html: action.html,
                        ruleId: rule.id || null
                    });
                }
            }
        },

        /**
         * Applies one custom action.
         *
         * Execution flow:
         * - builds a shared execution context
         * - assigns a run id for stale-run detection
         * - evaluates optional shouldRun(ctx)
         * - executes code(ctx) if needed
         *
         * Notes:
         * - shouldRun(ctx) is expected to be synchronous and cheap
         * - code(ctx) may be synchronous or return a Promise
         * - async actions can use ctx.isLatestRun() to avoid applying stale work
         * - shouldRun(ctx) MUST NOT perform DOM writes
         *
         * @param {Object} action prepared custom action
         * @returns {*} return value of code(ctx), possibly a Promise, or null
         * @private
         */
        _applyCustomAction: function (action) {
            const _self = this;

            if (!action || $.isFunction(action.code) !== true) {
                return null;
            }

            const runId = Breinify.UTL.uuid();
            action._lastRunId = runId;
            const ctx = {
                $: $,
                manager: _self,
                action: action,
                Breinify: Breinify,
                window: window,
                document: document,
                isLatestRun: function () {
                    return action._lastRunId === runId;
                },
                findManaged: function (selector) {
                    if (typeof selector !== "string" || selector === "") {
                        return $();
                    }

                    return $(selector + "[" + _self._markerOwner + '="placementManager"]');
                },
                markManaged: function ($node) {
                    _self._markPlacedNode($node, action.key);
                    return $node;
                },
                findManagedWebExperience: function (webExpId, positionId) {
                    if (typeof webExpId !== "string" || webExpId === "") {
                        return $();
                    }

                    let selector = '[data-br-webexpid="' + webExpId + '"]';
                    if (typeof positionId === "string" && positionId !== "") {
                        selector += '[data-br-webexppos="' + positionId + '"]';
                    }

                    return this.findManaged(selector);
                },
                createManagedWebExperience: function (webExpId, positionId) {
                    return _self._createManagedWebExperienceNode(webExpId, positionId, action.key);
                },
                ensureWebExperiencePlacement: function (config) {
                    if (!$.isPlainObject(config)) {
                        return $();
                    }

                    const webExpId = Breinify.UTL.isNonEmptyString(config.webExpId);
                    if (webExpId === null) {
                        return $();
                    }

                    const positionId = Breinify.UTL.isNonEmptyString(config.positionId);
                    let $nodes = this.findManagedWebExperience(webExpId, positionId);
                    let $node = $nodes.first();

                    const $target = config.target;
                    const position = Breinify.UTL.isNonEmptyString(config.position);
                    if (!$target || $target.length === 0 || position === null) {
                        $nodes.remove();
                        return $();
                    }

                    if ($nodes.length > 1) {
                        $nodes.slice(1).remove();
                        $nodes = this.findManagedWebExperience(webExpId, positionId);
                        $node = $nodes.first();
                    }

                    const placementAction = {
                        key: action.key,
                        position: position
                    };

                    if ($node.length === 0 || _self._isInsertFulfilled($target, placementAction) !== true) {
                        if ($node.length === 0) {
                            $node = _self._createManagedWebExperienceNode(webExpId, positionId, action.key);
                            if ($node === null) {
                                return $();
                            }
                        }

                        _self._insertNodeAtPosition($target, $node, position);
                    }

                    return $node;
                }
            };

            try {
                if ($.isFunction(action.shouldRun) && action.shouldRun(ctx) !== true) {
                    return null;
                }

                return action.code(ctx);
            } catch (e) {
                console.error("[placementManager] custom action failed:", e);
                return null;
            }
        },

        _createManagedWebExperienceNode: function (webExpId, positionId, key) {
            if (Breinify.UTL.isNonEmptyString(webExpId) === null) {
                return null;
            }

            const $node = $("<div></div>");
            $node.attr("data-br-webexpid", webExpId);

            if (Breinify.UTL.isNonEmptyString(positionId) !== null) {
                $node.attr("data-br-webexppos", positionId);
            }

            this._markPlacedNode($node, key);
            return $node;
        },

        /**
         * Applies one attribute action.
         *
         * @param {Object} action prepared attribute action
         * @private
         */
        _applyAttributeAction: function (action) {
            if (action.$target.attr(action.name) !== action.value) {
                action.$target.attr(action.name, action.value);
            }
        },

        /**
         * Applies one insert-webexperience action.
         *
         * @param {Object} action prepared insert-webexperience action
         * @private
         */
        _applyInsertWebExperienceAction: function (action) {
            if (this._isInsertFulfilled(action.$target, action) === true) {
                return;
            }

            const $node = this._createManagedWebExperienceNode(action.webExpId, action.positionId, action.key);
            if ($node === null) {
                return;
            }

            this._insertNodeAtPosition(action.$target, $node, action.position);
            this._trackInsertedNode({
                key: action.key,
                type: action.type,
                selector: action.selector,
                position: action.position,
                ruleId: action.ruleId || null,
                element: $node[0]
            });
        },

        /**
         * Applies one insert-html action.
         *
         * @param {Object} action prepared insert-html action
         * @private
         */
        _applyInsertHtmlAction: function (action) {
            if (this._isInsertFulfilled(action.$target, action) === true) {
                return;
            }

            const $node = this._createMarkedNodeFromHtml(action.html, action.key);
            if ($node === null) {
                return;
            }

            this._insertNodeAtPosition(action.$target, $node, action.position);

            this._trackInsertedNode({
                key: action.key,
                type: action.type,
                selector: action.selector,
                position: action.position,
                ruleId: action.ruleId || null,
                element: $node[0]
            });
        },

        /**
         * Tracks one inserted DOM element for later page-change validation.
         *
         * Tracking is used only for cleanup/bookkeeping. It is intentionally not
         * part of fulfillment truth. The DOM remains the source of truth.
         *
         * @param {Object} trackedEntry tracked insertion entry
         * @private
         */
        _trackInsertedNode: function (trackedEntry) {
            if (!$.isPlainObject(trackedEntry) || !trackedEntry.element) {
                return;
            }

            for (let i = 0; i < this._trackedInsertions.length; i++) {
                if (this._trackedInsertions[i].element === trackedEntry.element) {
                    return;
                }
            }

            this._trackedInsertions.push(trackedEntry);
        },

        /**
         * Collects tracked insertions that should be removed on the current page.
         *
         * @param {Array} activeRules current active rules
         * @returns {Array} tracked entries to remove
         * @private
         */
        _collectTrackedCleanup: function (activeRules) {
            const activeRuleIds = {};
            const toRemove = [];

            $.each(activeRules, function (idx, rule) {
                if (rule && typeof rule.id === "string" && rule.id !== "") {
                    activeRuleIds[rule.id] = true;
                }

                return true;
            });

            for (let i = 0; i < this._trackedInsertions.length; i++) {
                const entry = this._trackedInsertions[i];
                if (!entry || !entry.element) {
                    toRemove.push(entry);
                    continue;
                }

                if (entry.element.isConnected !== true) {
                    toRemove.push(entry);
                    continue;
                }

                if (entry.ruleId && activeRuleIds[entry.ruleId] !== true) {
                    toRemove.push(entry);
                    continue;
                }

                if (this._isTrackedInsertionValid(entry) !== true) {
                    toRemove.push(entry);
                }
            }

            return toRemove;
        },

        /**
         * Removes one tracked insertion entry and its DOM element if still connected.
         *
         * @param {Object} trackedEntry tracked insertion entry
         * @private
         */
        _removeTrackedInsertion: function (trackedEntry) {
            if ($.isPlainObject(trackedEntry) && trackedEntry.element && trackedEntry.element.isConnected === true) {
                $(trackedEntry.element).remove();
            }

            let remaining = [];
            for (let i = 0; i < this._trackedInsertions.length; i++) {
                if (this._trackedInsertions[i] !== trackedEntry) {
                    remaining.push(this._trackedInsertions[i]);
                }
            }

            this._trackedInsertions = remaining;
        },

        /**
         * Validates whether a tracked insertion is still correctly placed.
         *
         * @param {Object} trackedEntry tracked insertion entry
         * @returns {boolean} true if still valid
         * @private
         */
        _isTrackedInsertionValid: function (trackedEntry) {

            const node = trackedEntry && trackedEntry.element ? trackedEntry.element : null;
            if (!node || node.nodeType !== 1 || node.isConnected !== true) {
                return false;
            }

            let relatedNode = null;
            if (trackedEntry.position === "before") {
                relatedNode = node.nextElementSibling;
                return !!relatedNode &&
                    $.isFunction(relatedNode.matches) &&
                    relatedNode.matches(trackedEntry.selector);
            } else if (trackedEntry.position === "after") {
                relatedNode = node.previousElementSibling;
                return !!relatedNode &&
                    $.isFunction(relatedNode.matches) &&
                    relatedNode.matches(trackedEntry.selector);
            } else if (trackedEntry.position === "prepend") {
                relatedNode = node.parentElement;
                return !!relatedNode &&
                    $.isFunction(relatedNode.matches) &&
                    relatedNode.matches(trackedEntry.selector) &&
                    relatedNode.firstElementChild === node;
            } else if (trackedEntry.position === "append") {
                relatedNode = node.parentElement;
                return !!relatedNode &&
                    $.isFunction(relatedNode.matches) &&
                    relatedNode.matches(trackedEntry.selector) &&
                    relatedNode.lastElementChild === node;
            }

            return false;
        },

        /**
         * Adds internal marker attributes to the root inserted element.
         *
         * @param {jQuery} $node root node to mark
         * @param {string} key unique placement key
         * @private
         */
        _markPlacedNode: function ($node, key) {
            if ($node && $node.length > 0) {
                $node.attr(this._markerOwner, "placementManager");
                $node.attr(this._markerKey, key);
            }
        },

        /**
         * Creates a single marked root element from HTML.
         *
         * @param {string} html HTML string
         * @param {string} key unique placement key
         * @returns {jQuery|null} created marked node or null
         * @private
         */
        _createMarkedNodeFromHtml: function (html, key) {
            if (typeof html !== "string" || html.trim() === "") {
                return null;
            }

            const $nodes = $(html);
            const elementNodes = $nodes.filter(function () {
                return this && this.nodeType === 1;
            });

            if (elementNodes.length !== 1) {
                return null;
            }

            this._markPlacedNode(elementNodes.first(), key);
            return elementNodes.first();
        },

        /**
         * Inserts a node relative to the target using the normalized position.
         *
         * @param {jQuery} $target action target
         * @param {jQuery} $node node to insert
         * @param {string} position normalized insert position
         * @private
         */
        _insertNodeAtPosition: function ($target, $node, position) {
            if (!$target || $target.length === 0 || !$node || $node.length === 0) {
                // nothing to do
            } else if (position === "before") {
                $target.before($node);
            } else if (position === "after") {
                $target.after($node);
            } else if (position === "prepend") {
                $target.prepend($node);
            } else if (position === "append") {
                $target.append($node);
            }
        },

        /**
         * Determines whether the changed element is relevant to a selector using
         * local-only checks.
         *
         * @param {jQuery} $el changed element
         * @param {string} selector selector to match
         * @returns {boolean} true if the selector matches locally
         * @private
         */
        _matchesSelectorLocally: function ($el, selector) {
            if (!$el || $el.length === 0 || typeof selector !== "string" || selector === "") {
                return false;
            } else {
                return $el.is(selector) || $el.find(selector).length > 0 || $el.closest(selector).length > 0;
            }
        },

        /**
         * Checks whether an insert action is already fulfilled.
         *
         * The DOM is the source of truth here. Tracking is intentionally not used
         * for fulfillment, only for cleanup/bookkeeping.
         *
         * @param {jQuery} $target action target
         * @param {Object} action normalized insert action
         * @returns {boolean} true if the insert already exists
         * @private
         */
        _isInsertFulfilled: function ($target, action) {

            const target = $target && $target.length > 0 ? $target[0] : null;
            if (!target || target.nodeType !== 1) {
                return false;
            }

            let candidate = null;
            if (action.position === "before") {
                candidate = target.previousElementSibling;
            } else if (action.position === "after") {
                candidate = target.nextElementSibling;
            } else if (action.position === "prepend") {
                candidate = target.firstElementChild;
            } else if (action.position === "append") {
                candidate = target.lastElementChild;
            }

            return candidate !== null &&
                candidate.getAttribute(this._markerKey) === action.key &&
                candidate.getAttribute(this._markerOwner) === "placementManager";
        }
    };

    const PlacementManager = {
        _initialized: false,

        isInitialized: function () {
            return this._initialized === true;
        },

        hasRule: function (ruleId) {
            return placementManagerModule.hasRule(ruleId);
        },

        /**
         * Initializes the placementManager plugin.
         *
         * This registers the one shared internal module exactly once.
         *
         * @returns {boolean} true if initialization succeeded
         */
        initialize: function () {
            if (this._initialized === true) {
                return true;
            } else if (!api) {
                console.error("[placementManager] unable to initialize: missing Breinify.plugins.api");
                return false;
            } else if (!Breinify?.plugins?._isAdded?.("trigger")) {
                console.error("[placementManager] unable to initialize: missing trigger plugin");
                return false;
            } else if (api.addModule(placementManagerModuleName, placementManagerModule) !== true) {
                console.error("[placementManager] unable to register shared module:", placementManagerModuleName);
                return false;
            } else {
                placementManagerModule.initialize();
                this._initialized = true;
                return true;
            }
        },

        /**
         * Adds one or more placement rules to the shared module.
         *
         * Supported definitions:
         * - { rules: [...] }
         * - single rule object
         *
         * @param {Object} definition definition containing rules or a single rule
         * @returns {boolean} true if rules were added
         */
        add: function (definition) {
            if (this.initialize() !== true) {
                return false;
            }

            let rules;
            if ($.isPlainObject(definition) && $.isArray(definition.rules)) {
                rules = definition.rules;
            } else if ($.isPlainObject(definition)) {
                rules = [definition];
            } else {
                console.error("[placementManager] unable to add rules: invalid definition");
                return false;
            }

            const addedCount = placementManagerModule.addRules(rules);
            if (addedCount === 0) {
                return true;
            }

            const initialRequirements = placementManagerModule.findRequirements($("body"), {
                type: "full-scan"
            });

            if ($.isPlainObject(initialRequirements)) {
                placementManagerModule.onChange(initialRequirements);
            } else if (initialRequirements === true) {
                placementManagerModule.onChange({});
            }

            return true;
        },

        /**
         * Normalizes one observe definition.
         *
         * @param {Object} observe raw observe definition
         * @returns {Object|null} normalized observe definition or null
         * @private
         */
        _normalizeObserve: function (observe) {
            if (!$.isPlainObject(observe) || typeof observe.type !== "string") {
                return null;
            } else if (typeof observe.selector !== "string" || observe.selector === "") {
                return null;
            }

            if (observe.type === "exists") {
                return {
                    type: "exists",
                    selector: observe.selector
                };
            } else if (observe.type === "attribute") {
                if (typeof observe.attribute !== "string" || observe.attribute === "") {
                    return null;
                }

                return {
                    type: "attribute",
                    selector: observe.selector,
                    attribute: observe.attribute
                };
            }

            return null;
        },

        /**
         * Normalizes one action and precomputes metadata.
         *
         * @param {Object} rule owning rule
         * @param {Object} action raw action definition
         * @returns {Object|null} normalized action or null
         * @private
         */
        _normalizeAction: function (rule, action) {

            // make sure we have a valid action and a type defined
            if (!$.isPlainObject(action) || Breinify.UTL.isNonEmptyString(action.type) === null) {
                return null;
            }

            /*
             * Custom action normalization:
             * - does not require a selector
             * - requires code(ctx)
             * - optionally accepts shouldRun(ctx)
             * - generates a stable action key for managed marker usage
             */
            if (action.type === "custom") {
                if (!$.isFunction(action.code)) {
                    return null;
                }

                const normalizedAction = {
                    type: "custom",
                    singleTarget: action.singleTarget === true,
                    code: action.code,
                    shouldRun: $.isFunction(action.shouldRun) ? action.shouldRun : null,
                    async: action.async === true
                };

                normalizedAction.key = [
                    rule.id || "",
                    normalizedAction.type,
                    "custom",
                    rule.actions ? rule.actions.length : 0
                ].join("::");

                return normalizedAction;
            }

            // all other actions need a selector, so let's ensure this here right now
            if (Breinify.UTL.isNonEmptyString(action.selector) === null) {
                return null;
            } else if (action.type === "attribute") {
                if (typeof action.name !== "string" || action.name === "") {
                    return null;
                }

                const normalizedAction = {
                    type: "attribute",
                    selector: action.selector,
                    singleTarget: action.singleTarget === true,
                    name: action.name,
                    value: typeof action.value === "undefined" || action.value === null ? "" : String(action.value)
                };

                normalizedAction.key = [
                    rule.id || "",
                    normalizedAction.type,
                    normalizedAction.selector,
                    normalizedAction.name,
                    normalizedAction.value
                ].join("::");

                return normalizedAction;
            } else if (action.type === "insert-webexperience") {
                const position = this._normalizeInsertPosition(action.position, action.where);
                if (position === null ||
                    typeof action.webExpId !== "string" ||
                    action.webExpId === "") {
                    return null;
                }

                const normalizedAction = {
                    type: "insert-webexperience",
                    selector: action.selector,
                    singleTarget: action.singleTarget === true,
                    position: position,
                    webExpId: action.webExpId,
                    positionId: typeof action.positionId === "string" && action.positionId !== "" ? action.positionId : null
                };

                normalizedAction.key = [
                    rule.id || "",
                    normalizedAction.type,
                    normalizedAction.selector,
                    normalizedAction.position,
                    normalizedAction.webExpId,
                    normalizedAction.positionId || ""
                ].join("::");

                return normalizedAction;
            } else if (action.type === "insert-html") {
                const position = this._normalizeInsertPosition(action.position, action.where);
                if (position === null ||
                    typeof action.html !== "string" ||
                    action.html.trim() === "") {
                    return null;
                }

                const normalizedAction = {
                    type: "insert-html",
                    selector: action.selector,
                    singleTarget: action.singleTarget === true,
                    position: position,
                    html: action.html
                };

                normalizedAction.key = [
                    rule.id || "",
                    normalizedAction.type,
                    normalizedAction.selector,
                    normalizedAction.position,
                    normalizedAction.html
                ].join("::");

                return normalizedAction;
            } else {
                return null;
            }
        },

        /**
         * Normalizes the insert position.
         *
         * Allowed values:
         * - before
         * - after
         * - prepend
         * - append
         *
         * @param {string} position preferred position property
         * @param {string} where legacy alias
         * @returns {string|null} normalized position or null
         * @private
         */
        _normalizeInsertPosition: function (position, where) {
            const value = Breinify.UTL.isNonEmptyString(position) === null ? where : position;
            if (value === "before" || value === "after" || value === "prepend" || value === "append") {
                return value;
            }

            return null;
        }
    };

    Breinify.plugins._add("placementManager", PlacementManager);
})();