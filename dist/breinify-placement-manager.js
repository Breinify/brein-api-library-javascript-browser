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
         * Adds rules to the shared registry.
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
                this._collectDocumentActions(activeRules, actions);
                reconcile = true;

                return this._createPayload(actions, cleanup, reconcile);
            } else if (type === "full-scan") {
                cleanup = this._collectTrackedCleanup(activeRules);
                this._collectDocumentActions(activeRules, actions);

                return this._createPayload(actions, cleanup, false);
            } else if (!$el || $el.length === 0) {
                return false;
            } else if (type === "added-element") {
                this._collectElementActions($el, activeRules, actions);
                return this._createPayload(actions, cleanup, false);
            } else if (type === "attribute-change") {
                this._collectAttributeActions($el, attribute, activeRules, actions);
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
                    if (!action || !action.$target || action.$target.length === 0) {
                        return true;
                    }

                    if (action.type === "attribute") {
                        _self._applyAttributeAction(action);
                    } else if (action.type === "insert-webexperience") {
                        _self._applyInsertWebExperienceAction(action);
                    } else if (action.type === "insert-html") {
                        _self._applyInsertHtmlAction(action);
                    } else if (action.type === "replace-html") {
                        _self._applyReplaceHtmlAction(action);
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
         * @private
         */
        _collectDocumentActions: function (activeRules, actions) {
            const _self = this;

            $.each(activeRules, function (idx, rule) {
                if (_self._ruleMatchesDocument(rule) === true) {
                    _self._collectRuleActionsFromDocument(rule, actions);
                }

                return true;
            });
        },

        /**
         * Collects actions for an added-element event using only local checks.
         *
         * @param {jQuery} $el changed element
         * @param {Array} activeRules active rules
         * @param {Array} actions target action list
         * @private
         */
        _collectElementActions: function ($el, activeRules, actions) {
            const _self = this;

            $.each(activeRules, function (idx, rule) {
                if (_self._ruleMatchesElement(rule, $el, null, false) === true) {
                    _self._collectRuleActionsFromElement(rule, $el, actions);
                }

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
         * @private
         */
        _collectAttributeActions: function ($el, attribute, activeRules, actions) {
            const _self = this;

            if (typeof attribute !== "string" || attribute === "") {
                return;
            }

            $.each(activeRules, function (idx, rule) {
                if (rule._hasAttributeTriggers !== true || rule._attributeTriggerMap[attribute] !== true) {
                    return true;
                }

                if (_self._ruleMatchesElement(rule, $el, attribute, true) === true) {
                    _self._collectRuleActionsFromElement(rule, $el, actions);
                }

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
         * Collects all missing actions for a rule using local element checks only.
         *
         * @param {Object} rule normalized rule
         * @param {jQuery} $el changed element
         * @param {Array} actions target action list
         * @private
         */
        _collectRuleActionsFromElement: function (rule, $el, actions) {
            let i;
            let action;
            let $targets;

            for (i = 0; i < rule.actions.length; i++) {
                action = rule.actions[i];
                $targets = this._findTargetsLocally($el, action.selector);

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
            } else if (action.type === "replace-html") {
                actions.push({
                    type: "replace-html",
                    $target: $target,
                    key: action.key,
                    html: action.html
                });
            }
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
            let $node;

            if (this._isInsertFulfilled(action.$target, action) === true) {
                return;
            }

            $node = $("<div></div>");
            $node.attr("data-br-webexpid", action.webExpId);

            if (action.positionId) {
                $node.attr("data-br-webexppos", action.positionId);
            }

            this._markPlacedNode($node, action.key);
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
            let $node;

            if (this._isInsertFulfilled(action.$target, action) === true) {
                return;
            }

            $node = this._createMarkedNodeFromHtml(action.html, action.key);
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
         * Applies one replace-html action.
         *
         * @param {Object} action prepared replace-html action
         * @private
         */
        _applyReplaceHtmlAction: function (action) {
            let $node;

            if (!action.$target || action.$target.length === 0) {
                return;
            }

            $node = this._createMarkedNodeFromHtml(action.html, action.key);
            if ($node === null) {
                return;
            }

            action.$target.replaceWith($node);
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
            let i;

            if (!$.isPlainObject(trackedEntry) || !trackedEntry.element) {
                return;
            }

            for (i = 0; i < this._trackedInsertions.length; i++) {
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
            let i;
            let entry;

            $.each(activeRules, function (idx, rule) {
                if (rule && typeof rule.id === "string" && rule.id !== "") {
                    activeRuleIds[rule.id] = true;
                }

                return true;
            });

            for (i = 0; i < this._trackedInsertions.length; i++) {
                entry = this._trackedInsertions[i];

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
            let remaining = [];
            let i;

            if ($.isPlainObject(trackedEntry) && trackedEntry.element && trackedEntry.element.isConnected === true) {
                $(trackedEntry.element).remove();
            }

            for (i = 0; i < this._trackedInsertions.length; i++) {
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
            let relatedNode = null;

            if (!node || node.nodeType !== 1 || node.isConnected !== true) {
                return false;
            }

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
            if (!$node || $node.length === 0) {
                return;
            }

            $node.attr(this._markerOwner, "placementManager");
            $node.attr(this._markerKey, key);
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
            let $nodes;
            let elementNodes;

            if (typeof html !== "string" || html.trim() === "") {
                return null;
            }

            $nodes = $(html);
            elementNodes = $nodes.filter(function () {
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
                return;
            }

            if (position === "before") {
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
            }

            return $el.is(selector) ||
                $el.find(selector).length > 0 ||
                $el.closest(selector).length > 0;
        },

        /**
         * Finds matching targets locally using:
         * - the element itself
         * - descendants
         * - closest ancestor
         *
         * @param {jQuery} $el changed element
         * @param {string} selector selector to find
         * @returns {jQuery} matched targets
         * @private
         */
        _findTargetsLocally: function ($el, selector) {
            let $targets = $();

            if (!$el || $el.length === 0 || typeof selector !== "string" || selector === "") {
                return $targets;
            }

            if ($el.is(selector)) {
                $targets = $el;
            } else {
                $targets = $el.find(selector);

                if ($targets.length === 0) {
                    $targets = $el.closest(selector);
                }
            }

            return $targets;
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
            let candidate = null;

            if (!target || target.nodeType !== 1) {
                return false;
            }

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
            let rules;
            let initialRequirements;
            let addedCount;

            if (this.initialize() !== true) {
                return false;
            }

            if ($.isPlainObject(definition) && $.isArray(definition.rules)) {
                rules = definition.rules;
            } else if ($.isPlainObject(definition)) {
                rules = [definition];
            } else {
                console.error("[placementManager] unable to add rules: invalid definition");
                return false;
            }

            addedCount = placementManagerModule.addRules(rules);
            if (addedCount === 0) {
                return true;
            }

            initialRequirements = placementManagerModule.findRequirements($("body"), {
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
            let normalizedAction;
            let position;

            if (!$.isPlainObject(action) || typeof action.type !== "string") {
                return null;
            } else if (typeof action.selector !== "string" || action.selector === "") {
                return null;
            }

            if (action.type === "attribute") {
                if (typeof action.name !== "string" || action.name === "") {
                    return null;
                }

                normalizedAction = {
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
                position = this._normalizeInsertPosition(action.position, action.where);
                if (position === null ||
                    typeof action.webExpId !== "string" ||
                    action.webExpId === "") {
                    return null;
                }

                normalizedAction = {
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
                position = this._normalizeInsertPosition(action.position, action.where);
                if (position === null ||
                    typeof action.html !== "string" ||
                    action.html.trim() === "") {
                    return null;
                }

                normalizedAction = {
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
            } else if (action.type === "replace-html") {
                if (typeof action.html !== "string" || action.html.trim() === "") {
                    return null;
                }

                normalizedAction = {
                    type: "replace-html",
                    selector: action.selector,
                    singleTarget: action.singleTarget === true,
                    html: action.html
                };

                normalizedAction.key = [
                    rule.id || "",
                    normalizedAction.type,
                    normalizedAction.selector,
                    normalizedAction.html
                ].join("::");

                return normalizedAction;
            }

            return null;
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
            const value = typeof position === "string" && position !== "" ? position : where;

            if (value === "before" || value === "after" || value === "prepend" || value === "append") {
                return value;
            }

            return null;
        }
    };

    Breinify.plugins._add("placementManager", PlacementManager);
})();