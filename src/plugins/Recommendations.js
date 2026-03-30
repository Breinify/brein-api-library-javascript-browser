"use strict";

/**
 * This implementation allows the usage of simplified recommendations calls with
 * rendering options. It utilizes the internal recommendation call of the Breinify
 * Utility library (part of the core package) and enhances the possibilities
 * to render and track the activities associated to the rendered activity (ex.
 * clickedRecommendation).
 */
(function () {
    if (typeof Breinify !== "object") {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded("recommendations")) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    const overload = Breinify.plugins._overload();

    const Renderer = {
        marker: {
            parentContainer: "brrc-pcont",
            container: "brrc-cont",
            item: "brrc-item",
            data: "recommendation",

            refreshing: "brrc-refreshing",
            refreshModePrefix: "brrc-refresh-mode-",
            refreshData: "brrc-refreshing",
            refreshModeData: "brrc-refresh-mode"
        },
        splitTest: {
            defaultGroup: "Breinify",
            defaultTestGroup: "Breinify",
            defaultControlGroup: "Control",
            defaultGroupType: "none",
            testGroupType: "test",
            controlGroupType: "control"
        },
        refreshOptions: null,

        _process: function (func, ...args) {
            if ($.isFunction(func)) {
                func(...args);
                return true;
            } else {
                return false;
            }
        },

        _resolveRefreshMode: function (option) {
            const configuredMode = Breinify.UTL.isNonEmptyString(option?.render?.refreshBehavior?.mode);
            if (configuredMode === null) {
                return "keep";
            }

            const mode = configuredMode.toLowerCase();
            if (mode === "keep" || mode === "loading" || mode === "loading-if-empty") {
                return mode;
            } else {
                return "keep";
            }
        },

        _createRefreshContext: function (option, $parent, $itemContainer) {
            const mode = this._resolveRefreshMode(option);

            return {
                mode: mode,
                previousParent: $parent,
                previousItemContainer: $itemContainer,
                hadItems: $itemContainer.find("." + this.marker.item).length > 0
            };
        },

        _setRefreshState: function ($container, option, state, context) {
            if (!$container || !$container.jquery || $container.length !== 1) {
                return;
            }

            const mode = Breinify.UTL.isNonEmptyString(context?.mode) || this._resolveRefreshMode(option);

            $container
                .attr("data-" + this.marker.refreshData, state === "refreshing" ? "true" : "false")
                .attr("data-" + this.marker.refreshModeData, mode);

            $container
                .toggleClass(this.marker.refreshing, state === "refreshing")
                .removeClass(
                    this.marker.refreshModePrefix + "keep",
                    this.marker.refreshModePrefix + "loading",
                    this.marker.refreshModePrefix + "loading-if-empty"
                );

            if (state === "refreshing") {
                $container.addClass(this.marker.refreshModePrefix + mode);
            }

            this._process(option?.process?.refreshStateChange, $container, state, {
                mode: mode,
                option: option,
                context: context || {}
            });
        },

        _prepareRefreshState: function (option, $parent, $itemContainer) {
            const refreshContext = option?.render?.refreshContext;
            if (!$.isPlainObject(refreshContext)) {
                return;
            }

            const mode = this._resolveRefreshMode(option);
            refreshContext.mode = mode;

            if (mode === "keep") {
                return;
            }

            if (mode === "loading-if-empty" && refreshContext.hadItems === true) {
                return;
            }

            this._setRefreshState($parent, option, "refreshing", refreshContext);
        },

        _finalizeRefreshState: function (option, state, $newContainer) {
            const refreshContext = option?.render?.refreshContext;
            if (!$.isPlainObject(refreshContext)) {
                return;
            }

            const $previousParent = refreshContext.previousParent;
            const $effectiveContainer = $newContainer && $newContainer.jquery && $newContainer.length === 1
                ? $newContainer
                : $previousParent;

            /*
             * If we refreshed successfully and got a new container, the old one is usually already replaced.
             * We still notify the outer usage against the effective/new container.
             */
            if (state === "refreshed") {
                this._process(option?.process?.refreshStateChange, $effectiveContainer, "refreshed", {
                    mode: refreshContext.mode,
                    option: option,
                    context: refreshContext
                });
                return;
            }

            /*
             * For errors or cancelations we still have the old container in place and need to
             * remove the visual refresh markers from it.
             */
            if ($previousParent && $previousParent.jquery && $previousParent.length === 1) {
                $previousParent
                    .attr("data-" + this.marker.refreshData, "false")
                    .removeClass(
                        this.marker.refreshing,
                        this.marker.refreshModePrefix + "keep",
                        this.marker.refreshModePrefix + "loading",
                        this.marker.refreshModePrefix + "loading-if-empty"
                    );

                this._process(option?.process?.refreshStateChange, $previousParent, state, {
                    mode: refreshContext.mode,
                    option: option,
                    context: refreshContext
                });
            }
        },

        _refresh: function (refreshOptions) {
            const _self = this;

            let optionsVersion = null;
            if ($.isPlainObject(refreshOptions)) {
                optionsVersion = new Date().getTime();
                this.refreshOptions = $.extend(true, {}, refreshOptions, {
                    optionsVersion: optionsVersion
                });
            } else if ($.isPlainObject(this.refreshOptions)) {
                optionsVersion = this.refreshOptions.optionsVersion;
            } else {

                // we have no information about refreshing, so just ignore the call
                return;
            }

            const $parents = $("." + this.marker.parentContainer);
            if ($parents.length === 0) {
                return;
            }

            let noGroupCount = 0;
            const settings = {};
            $parents.each(function () {
                const $parent = $(this);
                const $itemContainer = $parent.hasClass(_self.marker.container) ? $parent : $parent.find("." + _self.marker.container);
                if ($itemContainer.length === 0) {
                    return;
                }

                // read the data from the containers and combine it by group
                const data = $itemContainer.data(_self.marker.data);
                if (!$.isPlainObject(data) ||
                    !$.isPlainObject(data.option) ||
                    !$.isPlainObject(data.data)) {
                    return;
                }

                const option = data.option;

                // we updated the this.refreshOptions before, so that ensure we get a modified payload here
                const recPayload = _self._createPayload(option);

                // determine the group to use, if we have to group the information
                let recGroup = Breinify.UTL.isNonEmptyString(recPayload.recommendationGroup);
                if (recGroup === null) {
                    recGroup = "no-group-" + (noGroupCount++);
                    settings[recGroup] = [];
                } else if (!$.isArray(settings[recGroup])) {
                    settings[recGroup] = [];
                }

                const cpyOption = $.extend(true, {}, option);
                cpyOption.meta = {
                    processId: null,
                    optionsVersion: optionsVersion
                };
                cpyOption.position = {
                    replace: function () {
                        return $parent;
                    }
                };
                if (!$.isPlainObject(cpyOption.recommender)) {
                    cpyOption.recommender = {};
                }
                cpyOption.recommender.payload = recPayload;

                if (!$.isPlainObject(cpyOption.render)) {
                    cpyOption.render = {};
                }
                cpyOption.render.refreshContext = _self._createRefreshContext(option, $parent, $itemContainer);

                _self._prepareRefreshState(cpyOption, $parent, $itemContainer);
                settings[recGroup].push(cpyOption);
            });

            // fire a rerender for each of the groups
            Object.values(settings).forEach(function (setting) {
                Breinify.plugins.recommendations.render(setting);
            });
        },

        _determineSelector: function (value) {
            if ($.isFunction(value)) {
                const params = Array.prototype.slice.call(arguments, 1);
                value = value.apply(null, params);
            }

            if (value === null) {
                return null;
            } else if (typeof value === "string") {
                return $(value);
            } else if (value instanceof $) {
                return value;
            } else {
                return null;
            }
        },

        _appendContainer: function (option, data, cb) {
            const _self = this;

            // no position defined to append
            if (!$.isPlainObject(option) || !$.isPlainObject(option.position)) {
                cb(null, {
                    error: true,
                    errorDescription: "missing position",
                    externalRendering: false
                });
                return;
            }

            let method = null;
            let selector = null;
            if (option.position.before !== null) {
                selector = option.position.before;
                method = "before";
            } else if (option.position.after !== null) {
                selector = option.position.after;
                method = "after";
            } else if (option.position.append !== null) {
                selector = option.position.append;
                method = "append";
            } else if (option.position.prepend !== null) {
                selector = option.position.prepend;
                method = "prepend";
            } else if (option.position.replace !== null) {
                selector = option.position.replace;
                method = "replaceWith";
            } else if (option.position.externalRender !== null) {
                this._applyExternalRender(option, data, function ($target, settings) {
                    cb($target, $.extend(true, {
                        error: false,
                        externalRendering: true,
                        itemSelection: null
                    }, settings));
                });
                return;
            } else {
                cb(null, {
                    error: true,
                    errorDescription: "missing position operation",
                    externalRendering: false
                });
                return;
            }

            /*
             * The arguments for the methods align with the UI Recommendations check for requirements, i.e.,
             * if the recommender is configured to render on DOM tree changes, the same method is called with
             * 1. recommenderName
             * 2. modified element
             * 3. data defining the reasoning/type of the call (i.e., added-element (dom-tree change), or
             *    determine-container)
             */
            const recommenderName = this._recommenderName(option && option.recommender && option.recommender.payload);
            const $anchor = this._determineSelector(selector, recommenderName, null, {
                type: "determine-container",
                option: option,
                data: data
            });
            if ($anchor === null || $anchor.length === 0) {
                cb(null, {
                    error: true,
                    errorDescription: "unable to find anchor",
                    externalRendering: false
                });
                return;
            }

            const $resolvedAnchor = $anchor.length === 1 ? $anchor : $anchor.eq(0);
            const $container = this._determineSelector(option.templates.container);
            if ($container === null || $container.length === 0) {
                cb(null, {
                    error: true,
                    errorDescription: "unable to find container",
                    externalRendering: false
                });
                return;
            }

            // replace values within the container before appending it
            _self._replacePlaceholders($container, data, option);

            /*
             * Execute the method on the $anchor, for some reason the assignment to a variable of
             * $anchor[method] causes issues, thus we do it "twice".
             */
            if ($.isFunction($resolvedAnchor[method])) {
                $resolvedAnchor[method]($container);

                $container.addClass(this.marker.parentContainer);
                cb($container, {
                    error: false,
                    externalRendering: false
                });
            } else {
                cb(null, {
                    error: true,
                    errorDescription: "unable to apply method to anchor",
                    externalRendering: false
                });
            }
        },

        _createPayload: function (option, def) {

            // check for any refresh-options we may have right now
            const refreshOptions = $.isPlainObject(this.refreshOptions) ? this.refreshOptions : {};
            const optionsVersion = typeof refreshOptions.optionsVersion === "number" ? refreshOptions.optionsVersion : null;
            const overridePayload = $.isPlainObject(refreshOptions.payload) ? refreshOptions.payload : {};

            if ($.isPlainObject(option) &&
                $.isPlainObject(option.recommender) &&
                $.isPlainObject(option.recommender.payload)) {
                return $.extend(true, {}, option.recommender.payload, overridePayload, {
                    optionsVersion: optionsVersion
                });
            } else if ($.isPlainObject(def)) {
                return $.extend(true, {}, def, overridePayload, {
                    optionsVersion: optionsVersion
                });
            } else {
                return {
                    optionsVersion: optionsVersion
                };
            }
        },

        _recommenderName: function (payload) {
            if ($.isPlainObject(payload) &&
                $.isArray(payload.namedRecommendations) &&
                payload.namedRecommendations.length === 1) {
                return Breinify.UTL.isNonEmptyString(payload.namedRecommendations[0]);
            } else {
                return null;
            }
        },

        _applyExternalRender: function (option, data, cb) {
            if ($.isFunction(option.position.externalRender)) {
                option.position.externalRender(data, cb);
            } else {
                cb(null);
            }
        },

        _appendItems: function ($container, result, option) {
            const _self = this;

            let $item = this._determineSelector(option.templates.item, $container);
            if ($item === null) {
                return null;
            }

            $.each(result.recommendations, function (idx, recommendation) {
                let $recItem = _self._replacePlaceholders($item.clone(false), recommendation, option);
                _self._setupItemData($recItem, idx, recommendation);

                $container.append($recItem);
                _self._process(option.process.attachedItem, $container, $recItem, recommendation, option);
            });
        },

        _isItem: function ($item) {
            return $item.closest("[data-" + this.marker.container + "=\"true\"]").length === 1;
        },

        _setupItemData: function ($recItem, idx, data) {
            const normIdx = typeof idx === "number" ? idx < 0 ? idx : idx + 1 : null;

            $recItem.addClass(this.marker.item)
                .attr("data-" + this.marker.item, "true")
                .data(this.marker.data, $.extend(true, {
                    widgetPosition: normIdx
                }, data));
        },

        /**
         * Replaces all placeholders in text and attributes, the returned element is the same as
         * passed in under `$entry`.
         *
         * @param {jQuery} $entry
         * the element to check for replacements
         *
         * @param {Object} replacements
         * the replacements to apply
         *
         * @param {Object} option
         * the defined options
         *
         * @returns {jQuery}
         * the `$entry`, just for chaining purposes
         *
         * @private
         */
        _replacePlaceholders: function ($entry, replacements, option) {
            const _self = this;

            // check the text
            $entry.contents().filter(function () {
                return Breinify.UTL.dom.isNodeType(this, 3);
            }).each(function () {
                const $el = $(this);
                const replaced = _self._replace($el.text(), replacements, option);

                if (replaced !== null) {
                    $el.replaceWith(replaced);
                }
            });

            // check the attributes
            let attributes = $entry.get(0).attributes;
            const renaming = {};
            for (let i = 0; i < attributes.length; i++) {
                const attribute = attributes[i];
                const replaced = _self._replace(attribute.value, replacements, option);

                if (replaced === null) {
                    // do nothing
                } else if (attribute.name.startsWith("data-rename-")) {

                    // we cannot modify the attributes here, otherwise the attribute array we iterate over gets modified
                    renaming[attribute.name] = {
                        name: attribute.name.replace("data-rename-", ""),
                        value: replaced
                    };
                } else {
                    $entry.attr(attribute.name, replaced);
                }
            }

            $.each(renaming, function (attrName, settings) {
                $entry.removeAttr(attrName);
                $entry.attr(settings.name, settings.value);
            });

            // check also each child
            $entry.children().each(function () {
                _self._replacePlaceholders($(this), replacements, option);
            });

            return $entry;
        },

        /**
         * Replaces any occurrences of %%...%% with the appropriate placeholder and returns
         * the modified text, will return `null` if no replacement took place.
         *
         * @param {string} value
         * the value to replace
         *
         * @param {Object} data
         * the data to replace values from
         *
         * @param {Object} option
         * options to modify the behavior
         *
         * @returns {string|null}
         * the replaced value or `null` if no replacement took place
         *
         * @private
         */
        _replace: function (value, data, option) {
            const _self = this;

            if (typeof value !== "string" || value.trim() === "") {
                return null;
            }

            const replacements = {
                _counter: 0
            };
            const regex = /%%([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z](?:(?:::)?[a-zA-Z0-9_])*)*|[a-zA-Z][a-zA-Z0-9_-]*(?:::[a-zA-Z][a-zA-Z0-9_-]*)?)%%/g;
            const result = value.replace(regex, function (match, name) {
                let placeholderOption = option.placeholders[name];
                let hasPlaceholderOption = $.isFunction(placeholderOption) || typeof placeholderOption === "string";
                let recValue = _self._readPath(name, data);
                let hasRecValue = typeof recValue !== "undefined";

                // if we do not have any value
                let replacement;
                if (hasPlaceholderOption) {
                    if (typeof placeholderOption === "string") {
                        replacement = placeholderOption;
                    } else if ($.isFunction(placeholderOption)) {
                        replacement = placeholderOption.call(option.placeholders, data, hasRecValue ? recValue : null);
                    } else {
                        replacement = null;
                    }
                } else if (hasRecValue) {
                    replacement = recValue;
                } else {
                    replacement = null;
                }

                // check if we should replace with an empty value or not
                if (replacement === null && $.isFunction(option.placeholderSettings.replaceWith)) {
                    replacement = option.placeholderSettings.replaceWith(name);
                }

                // resolve the placeholders value for the name
                if (replacement === null) {
                    return match;
                } else {
                    replacements._counter++;
                    return replacement;
                }
            });

            return replacements._counter > 0 ? result : null;
        },

        _readPath: function (name, data) {
            const paths = name.split(".");
            if (paths.length === 1) {
                return data[name];
            }

            // read the value by following the path
            let value = data;
            for (let i = 0; i < paths.length; i++) {

                // at this point we always need to have an object, since we have a path to read
                if (!$.isPlainObject(value)) {
                    return null;
                }

                let path = paths[i];
                value = value[path];
            }

            return value;
        }
    };

    const canceledRequests = {
        _status: {
            canceled: "canceled"
        }
    };

    const defaultRenderOption = {
        meta: {
            // should never be set outside, will be sent when rendering is started
            processId: null
        },

        recommender: null,

        activity: {
            renderType: "renderedRecommendation",
            clickedType: "clickedRecommendation"
        },

        bindings: {
            selector: "a,.br-rec-click",
            specificSelectors: {}
        },

        splitTests: {
            control: {
                containerSelector: null
            }
        },

        position: {
            before: null,
            after: null,
            prepend: null,
            append: null,
            replace: null,

            /**
             * If used, it must be a function taking in data and a callback, i.e.:
             * `function(data, callback) { ... }`, whereby the callback has to be triggered with
             * resulting $target instance (i.e., the container).
             *
             * The callback takes optionally settings to override the external rendering settings, i.e.,
             * `callback($itemContainer, { ... })`.
             *
             * The settings are currently:
             * {
             *   error: false,
             *   externalRendering: true,
             *   itemSelection: null
             * }
             */
            externalRender: null
        },

        /**
         * Rendering and refresh visualization settings.
         *
         * IMPORTANT:
         * The plugin manages the refresh state markers only.
         * The actual visualization of loading, skeletons, overlays, spinners, etc. must be implemented
         * by the outer usage through CSS and/or the `process.refreshStateChange(...)` callback.
         */
        render: {
            refreshBehavior: {
                /*
                 * Defines how refreshes should be visualized while updated recommendations are loaded.
                 *
                 * Possible values:
                 *   - "keep":
                 *       Keep the current rendered content unchanged while the refresh is in-flight.
                 *
                 *   - "loading":
                 *       Mark the currently rendered container as refreshing immediately.
                 *       The outer usage can use the refresh markers to show a skeleton, overlay, spinner, etc.
                 *
                 *   - "loading-if-empty":
                 *       Only mark the container as refreshing when no recommendation items are currently rendered.
                 */
                mode: "keep"
            }
        },

        placeholderSettings: {
            /**
             * Method to determine what to replace the placeholder with if nothing was resolved, i.e.,
             * if anything else did not resolve to a value.
             *
             * @param {string} placeholder
             * the placeholder that could not be resolved
             *
             * @returns {null|string}
             * `null` if the placeholder should not be replaced, otherwise a string (can be empty)
             */
            replaceWith: function (placeholder) {
                return "";
            }
        },

        placeholders: {
            "random::uuid": function () {
                return Breinify.UTL.uuid();
            },
            "marker::container": Renderer.marker.container,
            "marker::item": Renderer.marker.item,
            "marker::recommender": function (data) {
                return Breinify.UTL.isNonEmptyString(data && data.payload && data.payload.recommenderName);
            },
            "data::json": function (data) {
                return JSON.stringify(data);
            }
        },

        /*
         * Defines HTML templates or jQuery instances that define how a container or item of the rendered recommender
         * should look like. In the case a binding is utilized (instead of rendering) these templates are considered
         * selectors, which return a selector to select the container and the items in a rendered recommendation.
         */
        templates: {
            container: null,
            item: null
        },

        process: {
            /**
             * Called when a click was handled and the caller explicitly requested that propagation should stop.
             *
             * @param {Event} event
             * the click event
             *
             * @param {jQuery} $itemEl
             * the effective clicked element
             *
             * @param {jQuery} $container
             * the resolved recommendation container
             *
             * @param {Object} recommendationData
             * the mapped recommendation response attached to the container
             *
             * @param {Object} additionalEventData
             * additional click metadata
             *
             * @param {Object} option
             * the resolved render option
             */
            stoppedPropagation: function (event, $itemEl, $container, recommendationData, additionalEventData, option) {
                // by default, nothing to do when propagation was stopped
            },

            /**
             * Called whenever an error occurred during retrieval, mapping, modification, or rendering.
             *
             * @param {Object|Error} error
             * the error object or mapped error information
             */
            error: function (error) {
                // by default, ignored
            },

            /**
             * Called when a render process was canceled before completion.
             *
             * @param {Object} option
             * the resolved render option
             *
             * @param {Object} result
             * the mapped recommendation result that was available at cancel time
             */
            canceled: function (option, result) {
                // by default, ignored
            },

            /**
             * Called once after the final render option has been resolved and before retrieval starts.
             *
             * @param {Object} option
             * the fully resolved render option for this render cycle
             */
            init: function (option) {
                // by default, nothing to initialize
            },

            /**
             * Called right before the recommendation is rendered.
             *
             * @param {Object} data
             * the mapped recommendation response used for rendering
             *
             * @param {Object} option
             * the fully resolved render option
             */
            pre: function (data, option) {
                // by default, nothing to execute before rendering starts
            },

            /**
             * Called after the outer recommendation container was attached to the DOM and after the
             * effective item container was resolved.
             *
             * @param {jQuery} $container
             * the top-level rendered container that was attached to the anchor
             *
             * @param {jQuery} $itemContainer
             * the effective container holding the recommendation items; this may be the same instance
             * as `$container` if no nested item container exists
             *
             * @param {Object} data
             * the mapped recommendation response used for rendering
             *
             * @param {Object} option
             * the fully resolved render option used for this render cycle
             */
            attachedContainer: function ($container, $itemContainer, data, option) {
                // by default, nothing to do when the recommendation container is attached
            },

            /**
             * Called after one individual recommendation item was attached and bound.
             *
             * @param {jQuery} $itemContainer
             * the effective container holding the recommendation items
             *
             * @param {jQuery} $item
             * the newly attached recommendation item
             *
             * @param {Object} data
             * the mapped recommendation data of the attached item
             *
             * @param {Object} option
             * the fully resolved render option
             */
            attachedItem: function ($itemContainer, $item, data, option) {
                // by default, nothing to execute after attachment of an item
            },

            /**
             * Called after all recommendation items were attached.
             *
             * @param {jQuery} $container
             * the top-level rendered container
             *
             * @param {jQuery} $itemContainer
             * the effective item container
             *
             * @param {Object} data
             * the mapped recommendation response
             *
             * @param {Object} option
             * the fully resolved render option
             */
            attached: function ($container, $itemContainer, data, option) {
                // by default, nothing to do after all items were attached
            },

            /**
             * Called after rendering completed successfully for this recommendation.
             *
             * @param {jQuery} $container
             * the top-level rendered container
             *
             * @param {jQuery} $itemContainer
             * the effective item container
             *
             * @param {Object} data
             * the mapped recommendation response
             *
             * @param {Object} option
             * the fully resolved render option
             */
            post: function ($container, $itemContainer, data, option) {
                // by default, nothing to execute after recommendation rendering is complete
            },

            /**
             * Called after the process finished, regardless of control/test rendering branch.
             *
             * @param {Object} option
             * the fully resolved render option
             *
             * @param {Object} result
             * the mapped recommendation result
             *
             * @param {jQuery|null} $container
             * the rendered container if one exists, otherwise `null`
             */
            finalize: function (option, result, $container) {
                // by default, nothing to execute after the process finished
            },

            /**
             * Called when a recommendation or control item was clicked and resolved successfully.
             *
             * @param {Event} event
             * the click event
             *
             * @param {Object} settings
             * the click handling settings object
             */
            clickedItem: function (event, settings) {
                // by default, nothing to execute after an item is clicked
            },

            /**
             * Called right before an activity is sent or scheduled.
             *
             * The outer usage can enrich `settings.activityTags`, `settings.activityUser`, or control
             * `settings.additionalEventData.sendActivities` / `settings.additionalEventData.scheduleActivities`.
             *
             * @param {Event} event
             * the activity-related event
             *
             * @param {Object} settings
             * the activity settings object that will be used for sending the activity
             */
            createActivity: function (event, settings) {
                // by default, nothing to do when an activity is created and ready to send
            },

            /**
             * Called when a refresh state changes.
             *
             * IMPORTANT:
             * This is the intended extension point to add or remove skeletons, loading overlays,
             * dimming states, or other refresh-related visuals.
             *
             * The plugin only manages state markers:
             *   - class "brrc-refreshing"
             *   - class "brrc-refresh-mode-<mode>"
             *   - data-brrc-refreshing="true|false"
             *   - data-brrc-refresh-mode="<mode>"
             *
             * State values:
             *   - "refreshing"
             *   - "refreshed"
             *   - "refresh-error"
             *   - "refresh-canceled"
             *
             * @param {jQuery} $container
             * the container relevant for the current state transition
             *
             * @param {string} state
             * the refresh state
             *
             * @param {Object} details
             * additional details containing:
             *   - mode
             *   - option
             *   - context
             */
            refreshStateChange: function ($container, state, details) {
                // by default, nothing to do when refresh state changes
            }
        },

        data: {
            /**
             * Allows changing the mapped recommendation response before it is rendered.
             *
             * Supported return values:
             *   - `null`:
             *       keep original `result` and `option`
             *
             *   - `{ result: ..., option: ... }`:
             *       replace the result/option pair
             *
             *   - `[{ result: ..., option: ... }, ...]`:
             *       split the recommendation into multiple render operations
             *
             * @param {Object} result
             * the mapped recommendation result
             *
             * @param {Object} option
             * the fully resolved render option
             *
             * @returns {null|Object|Object[]|Promise}
             * the modification result or a promise resolving to one
             */
            modify: function (result, option) {
                return null;
            }
        }
    };

    const Recommendations = {
        marker: $.extend(true, {}, Renderer.marker),

        refresh: function (options) {
            Renderer._refresh(options);
        },

        /**
         * <p>The bind method is used to bind the functionality provided by this library to given or otherwise loaded.
         * Use-cases for the usage of the bind (instead of render) method could be:
         * <ul>
         *     <li>3rd-party rendering (ex. via backend), but handling of activities (ex. clickedRecommendation)</li>
         *     <li>using of split-testing within third party rendering</li>
         * </ul></p>
         * <p>The method uses the same (but limited or less applied) options as the rendering method</p>
         */
        bind: function () {
            const _self = this;

            /*
             * Generate a unique identifier which allows to cancel the rendering in between recommendation
             * retrieval, and actual rendering.
             */
            const processId = Breinify.UTL.uuid();

            overload.overload({
                "Object": function (renderOption) {
                    let option = $.extend(true, {}, defaultRenderOption, renderOption);
                    option.meta.processId = processId;
                    _self._bindContainer(option);
                },
                "Object,Object": function (splitTestSettings, renderOption) {
                    let option = $.extend(true, {}, defaultRenderOption, renderOption);
                    option.meta.processId = processId;

                    _self._loadSplitTestSeparately(splitTestSettings, function (error, data) {

                        // we need to "fake" the recommendation payload
                        const recPayload = Renderer._createPayload(option);

                        if (error === null) {
                            let statusCode = 200;
                            if ($.isArray(splitTestSettings.controlGroups) &&
                                $.isPlainObject(data.splitTestData) &&
                                $.inArray(data.splitTestData.groupDecision, splitTestSettings.controlGroups) > -1) {
                                statusCode = 7120;
                            }

                            _self._bindContainer(option, _self._mapResult(recPayload, {
                                additionalData: {
                                    splitTestData: data.splitTestData
                                },
                                statusCode: statusCode
                            }));
                        } else {
                            const errorData = _self._mapResult(recPayload, {
                                statusCode: 400,
                                message: error instanceof Error ? error.message : null
                            });

                            Renderer._process(option.process.error, $.extend({
                                name: splitTestSettings.name,
                                result: errorData
                            }, errorData.status));
                        }
                    });
                }
            }, arguments, this);
        },

        cancel: function (processId) {
            canceledRequests[processId] = {
                cancellationTime: new Date().getTime(),
                status: canceledRequests._status.canceled,
                processId: processId
            };
        },

        /**
         * The render method is used to render the configured recommendations within the given user-interface.
         */
        render: function () {
            const _self = this;

            /*
             * Generate a unique identifier which allows to cancel the rendering in between recommendation
             * retrieval, and actual rendering.
             */
            const processId = Breinify.UTL.uuid();

            overload.overload({
                "Array": function (renderOptions) {

                    let namedRenderOptions = {};
                    let recommenderPayload = [];
                    for (let i = 0; i < renderOptions.length; i++) {
                        let options = this._preRenderRecommendations(processId, {
                            temporary: renderOptions[i]
                        });
                        let recommenderOptions = options.temporary.recommender;

                        if (!$.isPlainObject(recommenderOptions) ||
                            !$.isPlainObject(recommenderOptions.payload) ||
                            !$.isArray(recommenderOptions.payload.namedRecommendations)) {

                            Renderer._process(options.temporary.process.error, {
                                code: -1,
                                error: true,
                                message: "invalid payload for recommender defined for rendering process",
                                options: options
                            });
                            return;
                        }

                        let name = this._determineName(recommenderOptions.payload, i, renderOptions);
                        namedRenderOptions[name] = options.temporary;

                        recommenderPayload.push(recommenderOptions.payload);
                    }

                    this._retrieveRecommendations(recommenderPayload, function (error, data) {
                        _self._renderRecommendations(namedRenderOptions, error, data);
                    });
                },
                "Object": function (renderOptions) {
                    _self.render([renderOptions]);
                },
                "Object,Object": function (payload, renderOptions) {
                    let options = this._preRenderRecommendations(processId, renderOptions);
                    this._retrieveRecommendations([payload], function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                },
                "Array,Object": function (payloads, renderOptions) {
                    let options = this._preRenderRecommendations(processId, renderOptions);
                    this._retrieveRecommendations(payloads, function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                },
                "String,Object": function (recommendationId, renderOptions) {
                    let options = this._preRenderRecommendations(processId, renderOptions);
                    this._retrieveRecommendations([{
                        namedRecommendations: [recommendationId]
                    }], function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                },
                "String,Object,Object": function (recommendationId, payload, renderOptions) {
                    let options = this._preRenderRecommendations(processId, renderOptions);
                    this._retrieveRecommendations([$.extend({
                        namedRecommendations: [recommendationId]
                    }, payload)], function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                }
            }, arguments, this);

            return processId;
        },

        get: function () {
            overload.overload({
                "Object,Function": function (payload, callback) {
                    this._retrieveRecommendations([payload], callback);
                },
                "Array,Function": function (payloads, callback) {
                    this._retrieveRecommendations(payloads, callback);
                },
                "String,Function": function (recommendationId, callback) {
                    this._retrieveRecommendations([{
                        namedRecommendations: [recommendationId]
                    }], callback);
                },
                "String,Object,Function": function (recommendationId, payload, callback) {
                    this._retrieveRecommendations([$.extend({
                        namedRecommendations: [recommendationId]
                    }, payload)], callback);
                }
            }, arguments, this);
        },

        setRecommendationData: function ($el, idx, data) {
            if (Renderer._isItem($el)) {
                Renderer._setupItemData($el, idx, data);
                return true;
            } else {
                return false;
            }
        },

        createRecommendationTags: function (recommendationData, recommendation, additionalEventData) {
            const activityTags = this._createDefaultTags(recommendationData, additionalEventData);
            this._applyBreinifyTags(activityTags, recommendationData, recommendation, additionalEventData);

            return activityTags;
        },

        createRenderedRecommendationTags: function ($container, result) {
            const activityTags = this.createRecommendationTags(result, {}, {});

            activityTags.containerAvailable = $container === null ? null : $container.length > 0;
            activityTags.status = Breinify.UTL.toInteger(result.status.code);

            activityTags.expectedNrOfRecs = $.isPlainObject(result.payload) ? Breinify.UTL.toInteger(result.payload.expectedNumberOfRecommendations) : null;
            activityTags.retrievedNrOfRecs = $.isArray(result.recommendations) ? result.recommendations.length : 0;
            activityTags.rendered = activityTags.status === 200 &&
                activityTags.retrievedNrOfRecs > 0 &&
                (activityTags.containerAvailable === null || activityTags.containerAvailable === true);

            return activityTags;
        },

        createClickedRecommendationTags: function (recommendationData, recommendation, additionalEventData) {
            return this.createRecommendationTags(recommendationData, recommendation, additionalEventData);
        },

        _isCanceled: function (processId) {
            const now = new Date().getTime();

            const expiredProcesses = [];
            $.each(canceledRequests, function (processId, canceledRequest) {
                if (now - canceledRequest.cancellationTime > 60 * 1000) {
                    expiredProcesses.push(processId);
                }
            });

            for (let i = 0; i < expiredProcesses.length; i++) {
                const expiredProcessId = expiredProcesses[i];
                delete canceledRequests[expiredProcessId];
            }

            const canceledRequest = canceledRequests[processId];
            if (!$.isPlainObject(canceledRequest)) {
                return false;
            }

            return canceledRequest.status === canceledRequests._status.canceled;
        },

        _loadSplitTestSeparately: function (splitTestSettings, cb) {

            if (Breinify.plugins._isAdded("splitTests") === false) {
                cb(new Error("please ensure that the split-tests plugin is available when using this feature."));
                return;
            }

            const splitTestName = splitTestSettings.name;
            const splitTestTokens = Breinify.UTL.isNonEmptyString(splitTestSettings.token) === null ? splitTestSettings.tokens : splitTestSettings.token;
            const splitTestStorage = Breinify.UTL.isNonEmptyString(splitTestSettings.storageKey) === null ? splitTestSettings.storageKeys : splitTestSettings.storageKey;
            const splitTestPayload = $.extend(true, {
                splitTestName: splitTestSettings.name
            }, splitTestSettings.payload);

            Breinify.plugins.splitTests.retrieveSplitTest(splitTestName, splitTestTokens,
                splitTestPayload, splitTestStorage, function (error, data) {
                    cb(error, data);
                });
        },

        _bindContainer: function (option, recData) {
            const _self = this;
            const data = $.isPlainObject(recData) ? recData : {};

            let $container = Renderer._determineSelector(option.templates.container);
            if ($container === null || $container.length === 0) {
                return;
            }

            this._setupContainer($container, option, data);
            this._applyBindings(option, $container);

            let $items = Renderer._determineSelector(option.templates.item, $container);
            if ($items !== null) {
                $items.each(function (idx) {
                    _self.setRecommendationData($(this), idx, {});
                });
            }
        },

        _preRenderRecommendations: function (processId, renderOptions) {
            const options = {};
            $.each(renderOptions, function (name, renderOption) {
                let option = $.extend(true, {}, defaultRenderOption, renderOption);
                option.meta.processId = processId;

                Renderer._process(option.process.init, option);
                options[name] = option;
            });

            return options;
        },

        _renderRecommendations: function (options, error, data) {
            const _self = this;

            if (error !== null) {
                $.each(options, function (name, option) {
                    Renderer._process(option.process.error, error);

                    const errorResponse = _self._mapError(data, error);
                    _self._handleRender(errorResponse, option, null);
                    Renderer._finalizeRefreshState(option, "refresh-error", null);
                });

                return;
            }

            let recStatus = "undefined";
            $.each(options, function (name, option) {
                let result = data[name];

                if (_self._isCanceled(option.meta.processId)) {
                    Renderer._process(option.process.canceled, option, result);
                    Renderer._finalizeRefreshState(option, "refresh-canceled", null);
                } else if (!$.isPlainObject(result) || !$.isPlainObject(result.status)) {
                    Renderer._process(option.process.error, {
                        code: -1,
                        error: true,
                        message: "unexpected result-type received",
                        name: name,
                        result: result
                    });

                    _self._handleRender({
                        status: {
                            code: 500,
                            message: "unexpected result-type received",
                            error: true
                        }
                    }, option, null);
                    Renderer._finalizeRefreshState(option, "refresh-error", null);
                } else if (result.status.error === true) {
                    Renderer._process(option.process.error, $.extend({
                        name: name,
                        result: result
                    }, result.status));

                    _self._handleRender(result, option, null);
                    Renderer._finalizeRefreshState(option, "refresh-error", null);
                } else if ($.isFunction(option.data.modify)) {

                    const handleModifyResult = function (modifyResults) {
                        if ($.isArray(modifyResults)) {
                            // nothing to change
                        } else if ($.isPlainObject(modifyResults) &&
                            $.isPlainObject(modifyResults.result) &&
                            $.isPlainObject(modifyResults.option)) {
                            modifyResults = [modifyResults];
                        } else {
                            modifyResults = [{ result: result, option: option }];
                        }

                        for (let i = 0; i < modifyResults.length; i++) {
                            const modifyResult = modifyResults[i];
                            recStatus = _self._applyRecommendation(modifyResult.result, modifyResult.option);
                        }
                    };

                    let modifyResponse = option.data.modify(result, option);
                    if ($.isFunction(option.data.modify.constructor) &&
                        option.data.modify.constructor.name === "AsyncFunction" &&
                        window.Promise && modifyResponse instanceof window.Promise) {
                        modifyResponse
                            .then(function (result) {
                                handleModifyResult(result);
                            })
                            .catch(function (error) {
                                Renderer._process(option.process.error, {
                                    code: -1,
                                    error: true,
                                    message: error.message,
                                    name: error.name,
                                    result: error
                                });
                                Renderer._finalizeRefreshState(option, "refresh-error", null);
                            });
                    } else {
                        handleModifyResult(modifyResponse);
                    }
                } else {
                    recStatus = _self._applyRecommendation(result, option);
                }
            });

            if (recStatus === "out-of-date") {
                Renderer._refresh();
            }
        },

        _mapError: function (data, error) {
            const errorMsg = Breinify.UTL.out.normalizeErrorMessage(error);

            if (!$.isPlainObject(data) || typeof data.httpStatus !== "number") {
                return {
                    status: {
                        code: 500,
                        message: errorMsg,
                        error: true
                    }
                };
            } else if (data.httpStatus === 200) {
                return {
                    status: {
                        code: 500,
                        message: "received status-code 200 as error: " + errorMsg,
                        error: true
                    }
                };
            } else {
                return {
                    status: {
                        code: data.httpStatus,
                        message: data.responseText,
                        error: true
                    }
                };
            }
        },

        _handleRender: function (result, option, $container) {

            if ($.isPlainObject(result) && $.isPlainObject(result.status) && result.status.code === 403) {
                return;
            }

            const renderOption = $.extend(true, {
                activity: {
                    type: defaultRenderOption.activity.renderType
                }
            }, defaultRenderOption, option);

            const settings = {
                isControl: $.isPlainObject(result) && $.isPlainObject(result.splitTestData) && result.splitTestData.isControl === true,
                $recContainer: $container,
                additionalEventData: {},
                recommendationData: result,
                option: renderOption
            };

            let event = {
                bubbles: true,
                cancelable: false,
                detail: {}
            };
            if (typeof window.CustomEvent === "function") {
                event = new window.CustomEvent("renderedRecommendation", event);
            }

            settings.activityTags = this.createRenderedRecommendationTags($container, result);
            this._sendActivity(renderOption, event, settings);
            this._triggerEvent("renderedRecommendation", settings);
        },

        _triggerEvent: function (eventName, data) {
            $(document).trigger(eventName, data);
            if (typeof window.$ === "function" && typeof window.$.fn === "function" && $ !== window.$) {
                window.$(document).trigger(eventName, data);
            }
        },

        _applyRecommendation: function (result, option) {
            const _self = this;

            if (result.splitTestData.isControl === true) {
                const $container = _self._setupControlContainer(option, result);
                if ($container !== null) {
                    this._applyBindings(option, $container);
                }

                this._handleRender(result, option, $container);
                Renderer._process(option.process.finalize, option, result, $container);
                Renderer._finalizeRefreshState(option, "refreshed", $container);

                return "not-rendered-control";
            } else if (Renderer.refreshOptions !== null &&
                option.meta.optionsVersion !== Renderer.refreshOptions.optionsVersion) {

                Renderer._appendContainer(option, result, function ($container) {
                    if ($container === null) {
                        Renderer._finalizeRefreshState(option, "refresh-error", null);
                        return;
                    }

                    let $itemContainer = $container.find("." + Renderer.marker.container);
                    if ($itemContainer.length === 0) {
                        $itemContainer = $container;
                    }

                    _self._setupContainer($itemContainer, option, result);
                });

                return "out-of-date";
            } else if (result.status.code === 7120) {
                this._handleRender(result, option, null);
                Renderer._process(option.process.finalize, option, result, null);
                Renderer._finalizeRefreshState(option, "refreshed", null);

                return "not-rendered-ignored";
            } else {
                this._renderRecommendation(option, result, function ($container, settings) {
                    if ($container === null) {
                        Renderer._finalizeRefreshState(option, "refresh-error", null);
                        return;
                    }

                    _self._applyBindings(option, $container);
                    _self._handleRender(result, option, $container);
                    Renderer._process(option.process.finalize, option, result, $container);
                    Renderer._finalizeRefreshState(option, "refreshed", $container);
                });

                return "rendered";
            }
        },

        _handleClick: function (option, $el, event, additionalEventData) {
            let $container = $el.closest("." + Renderer.marker.container);
            $container = $container.length === 1 ? $container : $el.closest("[data-" + Renderer.marker.container + "=\"true\"]");

            const actualTarget = additionalEventData && additionalEventData.actualTarget;
            const $clickedEl = Breinify.UTL.dom.isNodeType(actualTarget, 1) ? $(actualTarget) : null;

            if ($container.length !== 1) {
                if ($clickedEl === null) {
                    return;
                }

                $container = $clickedEl.closest("." + Renderer.marker.container);
                $container = $container.length === 1 ? $container : $clickedEl.closest("[data-" + Renderer.marker.container + "=\"true\"]");
                if ($container.length !== 1) {
                    return;
                }
            }

            const containerData = $container.data(Renderer.marker.data);
            if (!$.isPlainObject(containerData) ||
                !$.isPlainObject(containerData.option) ||
                !$.isPlainObject(containerData.data)) {
                return;
            }

            const enhancedAdditionalEventData = $.extend(true, {}, additionalEventData, {
                semanticTarget: $el && $el.length === 1 ? $el.get(0) : null
            });
            const $itemEl = $clickedEl === null ? $el : $clickedEl;

            if (containerData.data.splitTestData.isControl === true) {
                this._handleControlClick(event, $itemEl, $container, containerData.data, enhancedAdditionalEventData, containerData.option);
            } else {
                this._handleRecommendationClick(event, $itemEl, $container, containerData.data, enhancedAdditionalEventData, containerData.option);
            }

            if (enhancedAdditionalEventData.stopPropagation === true) {
                event.stopPropagation();
                Renderer._process(option.process.stoppedPropagation, event, $itemEl, $container,
                    containerData.data, enhancedAdditionalEventData, containerData.option);
            }
        },

        _handleRecommendationClick: function (event, $el, $recContainer, recommendationData, additionalEventData, option) {
            let $recItem = $el.closest("." + Renderer.marker.item);
            if ($recItem.length !== 1) {
                const semanticTarget = additionalEventData && additionalEventData.semanticTarget;
                if (Breinify.UTL.dom.isNodeType(semanticTarget, 1)) {
                    const $semantic = $(semanticTarget);

                    $recItem = $semantic.closest("." + Renderer.marker.item);
                    if ($recItem.length !== 1 && $semantic.is("." + Renderer.marker.item)) {
                        $recItem = $semantic;
                    }
                }
            }

            if ($recItem.length !== 1) {
                return;
            }

            const recommendation = $recItem.data(Renderer.marker.data);
            if (!$.isPlainObject(recommendation)) {
                return;
            }

            const settings = {
                isControl: false,
                $recItem: $recItem,
                $recContainer: $recContainer,
                additionalEventData: additionalEventData,
                recommendationData: recommendationData,
                recommendation: recommendation,
                option: option
            };
            Renderer._process(option.process.clickedItem, event, settings);

            settings.activityTags = this.createClickedRecommendationTags(recommendationData, recommendation, additionalEventData);
            this._sendActivity(option, event, settings);
        },

        _handleControlClick: function (event, $el, $controlContainer, recommendationData, additionalEventData, option) {
            const settings = {
                isControl: true,
                $controlItem: $el,
                $controlContainer: $controlContainer,
                additionalEventData: additionalEventData,
                recommendationData: recommendationData,
                option: option
            };
            Renderer._process(option.process.clickedItem, event, settings);

            settings.activityTags = this._createDefaultTags(recommendationData, additionalEventData);

            const $recItem = $el.closest("." + Renderer.marker.item);
            const recommendation = $recItem.length === 1 ? $recItem.data(Renderer.marker.data) : null;
            if ($.isPlainObject(recommendation)) {
                this._applyBreinifyTags(settings.activityTags, recommendationData, recommendation, additionalEventData);
            }

            this._sendActivity(option, event, settings);
        },

        _applyBreinifyTags: function (activityTags, recommendationData, recommendation, additionalEventData) {
            if (typeof recommendation?.widgetPosition === "number") {
                activityTags.widgetPosition = recommendation.widgetPosition;

                if (typeof activityTags.widgetType === "string") {
                    activityTags.widgetId = activityTags.widgetType + "-" + activityTags.widgetPosition;
                }
            }

            const type = Breinify.UTL.isNonEmptyString(recommendationData?.meta?.type);
            activityTags.recType = type;

            const id = Breinify.UTL.isNonEmptyString(recommendation?.id);
            if (id === null) {
                // nothing more to do
            } else if (type === "com.brein.common.dto.CustomerAssetsDto") {
                activityTags.assetIds = [id];
                activityTags.assetNames = [
                    Breinify.UTL.isNonEmptyString(recommendation?.additionalData?.["assets::assetTitle"] ?? null)
                ];
            } else if (type === "com.brein.common.dto.CustomerProductDto") {
                activityTags.productIds = [id];
                activityTags.productNames = [
                    Breinify.UTL.isNonEmptyString(recommendation?.additionalData?.["product::productName"] ?? null)
                ];
            } else {
                activityTags.productIds = [id];
            }
        },

        _createDefaultTags: function (recommendationData, additionalEventData) {
            const defaultTags = {};

            const splitTestData = $.isPlainObject(recommendationData.splitTestData) ? recommendationData.splitTestData : {
                active: false
            };

            let groupType, group;
            if (splitTestData.active === false) {
                groupType = Renderer.splitTest.defaultGroupType;
                group = Renderer.splitTest.defaultGroup;
            } else if (splitTestData.isControl === true) {
                groupType = Renderer.splitTest.controlGroupType;
                group = typeof splitTestData.groupDecision === "string" && splitTestData.groupDecision.trim() !== "" ? splitTestData.groupDecision : Renderer.splitTest.defaultControlGroup;
            } else {
                groupType = Renderer.splitTest.testGroupType;
                group = typeof splitTestData.groupDecision === "string" && splitTestData.groupDecision.trim() !== "" ? splitTestData.groupDecision : Renderer.splitTest.defaultTestGroup;
            }

            const test = typeof splitTestData.testName === "string" && splitTestData.testName.trim() !== "" ? splitTestData.testName : null;
            const instance = typeof splitTestData.selectedInstance === "string" && splitTestData.selectedInstance.trim() !== "" ? splitTestData.selectedInstance : null;

            defaultTags.group = group;
            defaultTags.groupType = groupType;
            defaultTags.splitTest = test === null ? null : test + (instance === null ? "" : " (" + instance + ")");

            const recommendationPayload = $.isPlainObject(recommendationData.payload) ? recommendationData.payload : {};

            const queryName = typeof recommendationPayload.queryName === "string" && recommendationPayload.queryName.trim() !== "" ? recommendationPayload.queryName : null;
            const recommenderName = typeof recommendationPayload.recommenderName === "string" && recommendationPayload.recommenderName.trim() !== "" ? recommendationPayload.recommenderName : null;

            defaultTags.widgetType = recommenderName;
            defaultTags.widgetLabel = queryName === null ? recommenderName : queryName;

            if ($.isPlainObject(additionalEventData) && !$.isEmptyObject(additionalEventData)) {
                if (typeof additionalEventData.widgetPosition === "number" && additionalEventData.widgetPosition > 0) {
                    defaultTags.widgetPosition = additionalEventData.widgetPosition;
                }
                if (Array.isArray(additionalEventData.productIds) && additionalEventData.productIds.length > 0) {
                    defaultTags.productIds = additionalEventData.productIds;
                }
                if (Array.isArray(additionalEventData.productNames) && additionalEventData.productNames.length > 0) {
                    defaultTags.productNames = additionalEventData.productNames;
                }
                const recType = Breinify.UTL.isNonEmptyString(additionalEventData?.recType);
                if (recType !== null) {
                    defaultTags.recType = recType;
                }
            }

            return defaultTags;
        },

        _sendActivity: function (option, event, settings) {
            const actualTarget = event.data?.actualTarget ?? event.target;

            const anchor = actualTarget instanceof HTMLAnchorElement ? actualTarget :
                actualTarget instanceof Element ? actualTarget.closest("a") : null;

            const openInNewTabByUser = event.metaKey === true ||
                event.ctrlKey === true ||
                event.shiftKey === true ||
                event.altKey === true ||
                event.which === 2 ||
                event.button === 1;

            const rawTarget = anchor instanceof HTMLAnchorElement ? anchor.getAttribute("target") : null;
            const normalizedTarget = typeof rawTarget === "string" ? rawTarget.trim().toLowerCase() : "";

            const openInNewTabByTarget = normalizedTarget !== "" &&
                normalizedTarget !== "_self" &&
                normalizedTarget !== "_top" &&
                normalizedTarget !== "_parent";

            const openInNewTab = openInNewTabByUser || openInNewTabByTarget;

            const rawHref = anchor instanceof HTMLAnchorElement ? anchor.getAttribute("href") : null;
            const href = typeof rawHref === "string" ? rawHref.trim() : "";
            const normalizedHref = href.toLowerCase();

            const hasDownloadAttribute = anchor instanceof HTMLAnchorElement && anchor.hasAttribute("download");
            const isJavaScriptHref = normalizedHref.indexOf("javascript:") === 0;
            const isEmptyHref = href === "";
            const isOnlyHash = href === "#";
            const isHashNavigation = href.charAt(0) === "#" && href.length > 1;

            let isSamePageHashNavigation = false;
            if (anchor instanceof HTMLAnchorElement && isHashNavigation) {
                const currentUrlWithoutHash = window.location.href.split("#")[0];
                const anchorUrlWithoutHash = anchor.href.split("#")[0];
                isSamePageHashNavigation = currentUrlWithoutHash === anchorUrlWithoutHash;
            }

            let willReloadPage = false;
            if (anchor instanceof HTMLAnchorElement) {
                if (openInNewTab === true) {
                    willReloadPage = false;
                } else if (hasDownloadAttribute) {
                    willReloadPage = false;
                } else if (isEmptyHref || isOnlyHash || isJavaScriptHref) {
                    willReloadPage = false;
                } else if (isSamePageHashNavigation) {
                    willReloadPage = false;
                } else {
                    willReloadPage = true;
                }
            }

            let activityType = Breinify.UTL.isNonEmptyString(option.activity.type);
            activityType = activityType === null ? option.activity.clickedType : activityType;

            settings = $.extend(true, {
                additionalEventData: {
                    meta: {
                        openInNewTab: openInNewTab,
                        willReloadPage: willReloadPage
                    },
                    sendActivities: true,
                    scheduleActivities: null
                },
                activityType: activityType,
                activityTags: {},
                activityUser: {}
            }, settings);

            Renderer._process(option.process.createActivity, event, settings);

            if (settings.additionalEventData.sendActivities === false) {
                return;
            }

            if (typeof settings.activityTags.widgetPosition === "number" &&
                typeof settings.activityTags.widgetType === "string" &&
                typeof settings.activityTags.widgetId !== "string") {
                settings.activityTags.widgetId = settings.activityTags.widgetType + "-" + settings.activityTags.widgetPosition;
            }

            let scheduleActivity = null;
            if (settings.additionalEventData.scheduleActivities === null) {
                scheduleActivity = willReloadPage === true;
            } else if (typeof settings.additionalEventData.scheduleActivities === "boolean") {
                scheduleActivity = settings.additionalEventData.scheduleActivities;
            }

            if (!$.isPlainObject(Breinify.plugins.activities)) {
                // activities plugin is not available
            } else if (scheduleActivity === true) {
                Breinify.plugins.activities.scheduleDelayedActivity(settings.activityUser, settings.activityType, settings.activityTags, 60000);
            } else {
                Breinify.plugins.activities.generic(settings.activityType, settings.activityUser, settings.activityTags);
            }
        },

        _applyBindings: function (option, $container) {
            const _self = this;

            if (!$container || !$container.jquery || $container.length === 0) {
                return;
            }

            Breinify.UTL.dom.addClickObserver(option.bindings.selector, "clickedRecommendations", function (event, additionalEventData) {
                let $el = $(this);

                const nativeEvent = event.originalEvent || event;
                const target = nativeEvent.composedPath ? nativeEvent.composedPath()[0] : nativeEvent.target;
                if (target && typeof target.getRootNode === "function") {
                    const root = target.getRootNode();
                    if (root && root.host) {
                        $el = $(root.host);
                    }
                }

                additionalEventData = additionalEventData || {};
                additionalEventData.actualTarget = Breinify.UTL.dom.isNodeType(target, 1) ? target :
                    (target && target.parentElement ? target.parentElement : null);

                _self._handleClick(option, $el, event, additionalEventData);
            });

            const specificSelectors = option.bindings.specificSelectors;
            if ($.isPlainObject(specificSelectors)) {
                const keys = Object.keys(specificSelectors);
                for (let i = 0; i < keys.length; i++) {
                    const selector = keys[i];
                    const specificSelector = specificSelectors[selector];
                    const additionalEventData = $.isPlainObject(specificSelector) ? specificSelector : {};

                    $container.find(selector).on("click", function (event) {
                        _self._handleClick(option, $(this), event, additionalEventData);
                    });
                }
            }
        },

        _setupControlContainer: function (option, data) {
            const $controlContainer = Renderer._determineSelector(option.splitTests.control.containerSelector);
            if ($controlContainer === null || $controlContainer.length === 0) {
                return null;
            }

            return this._setupContainer($controlContainer.eq(0), option, data);
        },

        _setupContainer: function ($container, option, data) {
            if (!$container || !$container.jquery || $container.length === 0) {
                return null;
            }

            const $resolvedContainer = $container.length === 1 ? $container : $container.eq(0);

            if (!$resolvedContainer.hasClass(Renderer.marker.container)) {
                $resolvedContainer.addClass(Renderer.marker.container);
            }

            return $resolvedContainer
                .attr("data-" + Renderer.marker.container, "true")
                .data(Renderer.marker.data, {
                    option: option,
                    data: data
                });
        },

        _renderRecommendation: function (option, data, cb) {
            const _self = this;

            Renderer._process(option.process.pre, data, option);

            Renderer._appendContainer(option, data, function ($container, settings) {
                if ($container === null || settings.error === true) {
                    cb(null, settings);
                    return;
                }

                let $itemContainer = $container.find("." + Renderer.marker.container);
                if ($itemContainer.length === 0) {
                    $itemContainer = $container;
                }

                $itemContainer = _self._setupContainer($itemContainer, option, data);
                Renderer._process(option.process.attachedContainer, $container, $itemContainer, data, option);

                if (settings.externalRendering === true) {
                    const itemSelection = $.isFunction(settings.itemSelection) ? settings.itemSelection : function ($itemContainer, idx) {
                        return $itemContainer.children().eq(idx);
                    };

                    $.each(data.recommendations, function (idx, recommendation) {
                        let $recItem = itemSelection($itemContainer, idx, recommendation);
                        if ($recItem instanceof $ && $recItem.length === 1) {
                            Renderer._setupItemData($recItem, idx, recommendation);
                        }
                    });
                } else {
                    Renderer._appendItems($itemContainer, data, option);
                    Renderer._process(option.process.attached, $container, $itemContainer, data, option);
                }

                const $controlContainer = Renderer._determineSelector(option.splitTests.control.containerSelector);

                if ($controlContainer !== null &&
                    $controlContainer.length === 1 &&
                    $controlContainer.get(0) !== $container.get(0) &&
                    $controlContainer.find("." + Renderer.marker.item).length === 0) {
                    $controlContainer.hide();
                }

                Renderer._process(option.process.post, $container, $itemContainer, data, option);
                cb($container, settings);
            });
        },

        _retrieveRecommendations: function (payloads, callback) {
            const _self = this;

            if ($.isArray(payloads)) {
                const recommendationGroup = Breinify.UTL.uuid();
                for (let i = 0; i < payloads.length; i++) {
                    payloads[i].recommendationPlugin = true;
                    payloads[i].recommendationGroup = recommendationGroup;
                }
            }

            Breinify.recommendation({}, payloads, function (data, errorText) {
                if (typeof errorText === "string") {
                    callback(new Error(errorText), data);
                } else if (!$.isPlainObject(data) || !$.isArray(data.results)) {
                    callback(new Error("Invalid response received."), data);
                } else {
                    let result = _self._mapResults(payloads, data.results);
                    callback(null, result);
                }
            });
        },

        _mapResult: function (payload, result) {
            let recommendationResult = {};

            this._determineSplitTestData(result, recommendationResult);
            if (!this._determineErrorResponse(result, recommendationResult)) {
                this._determineRecommendationData(result, recommendationResult);
            }

            this._determineAdditionalData(result, recommendationResult);
            this._determineMetaData(result, recommendationResult);

            let numRecommendations = null;
            if (typeof payload.numRecommendations === "number" && payload.numRecommendations > 0) {
                numRecommendations = payload.numRecommendations;
            }

            let queryName = null;
            if (typeof payload.recommendationQueryName === "string" && payload.recommendationQueryName.trim() !== "") {
                queryName = payload.recommendationQueryName;
            }

            const recommenderName = Renderer._recommenderName(payload);
            const isForItems = $.isArray(payload.recommendationForItems) && payload.recommendationForItems.length > 0;

            recommendationResult.payload = {
                recommenderName: recommenderName,
                queryName: queryName,
                isForItems: isForItems,
                expectedNumberOfRecommendations: numRecommendations
            };

            return recommendationResult;
        },

        _mapResults: function (payloads, results) {
            let allRecommendationResults = {};

            for (let i = 0; i < results.length; i++) {
                const payload = i < payloads.length && $.isPlainObject(payloads[i]) ? payloads[i] : {};
                const result = results[i];
                const recommendationResult = this._mapResult(payload, result);

                if (!$.isPlainObject(recommendationResult.payload)) {
                    recommendationResult.payload = {};
                }

                const name = this._determineName(payload, i, payloads);
                recommendationResult.payload.name = name;
                allRecommendationResults[name] = recommendationResult;
            }

            return allRecommendationResults;
        },

        _determineErrorResponse: function (recommendationResponse, result) {
            if (!$.isPlainObject(recommendationResponse)) {
                result.status = {
                    error: true,
                    code: 500,
                    message: "invalid result type received"
                };

                return true;
            } else if (recommendationResponse.statusCode === 200 || recommendationResponse.statusCode === 7120) {
                result.status = {
                    code: recommendationResponse.statusCode,
                    message: recommendationResponse.message,
                    error: false
                };
            } else {
                result.status = {
                    error: true,
                    code: recommendationResponse.statusCode,
                    message: recommendationResponse.message
                };
            }

            return result.status.error;
        },

        _determineRecommendationType: function (recommendationResponse) {
            let type = "com.brein.common.dto.CustomerProductDto";
            if ($.isPlainObject(recommendationResponse) &&
                $.isPlainObject(recommendationResponse.additionalData) &&
                $.isPlainObject(recommendationResponse.additionalData._breinMetaData) &&
                typeof recommendationResponse.additionalData._breinMetaData.dataType === "string" &&
                recommendationResponse.additionalData._breinMetaData.dataType.trim() !== "") {
                type = recommendationResponse.additionalData._breinMetaData.dataType.trim();
            }

            return type;
        },

        _determineRecommendationData: function (recommendationResponse, result) {
            const type = this._determineRecommendationType(recommendationResponse);

            if (type === "com.brein.common.dto.CustomerProductDto") {
                result.recommendations = this._mapProducts(recommendationResponse);
            } else if (type === "com.brein.common.dto.CustomerAssetsDto") {
                result.recommendations = this._mapAssets(recommendationResponse);
            } else {
                result.recommendations = this._mapAny(recommendationResponse);
            }
        },

        _determineAdditionalData: function (recommendationResponse, result) {
            if ($.isPlainObject(recommendationResponse) &&
                $.isPlainObject(recommendationResponse.additionalData)) {

                result.additionalData = {};
                $.each(recommendationResponse.additionalData, function (name, val) {
                    if (name === "_breinMetaData" || name === "splitTestData") {
                        return;
                    }

                    result.additionalData[name] = val;
                });
            }
        },

        _determineName: function (payload, idx, payloads) {
            const candidate = this._extractCandidateNameFromPayload(payload);
            if (candidate === null) {
                return "response[" + idx + "]";
            }

            const candidates = this._extractCandidateNamesFromPayloads(payloads);
            const candidateUsage = candidates[candidate];

            if (typeof candidateUsage === "number" && candidateUsage > 1) {
                return candidate + "[" + idx + "]";
            }

            return candidate;
        },

        _extractCandidateNamesFromPayloads: function (payloads) {
            const candidates = {};

            if (!$.isArray(payloads)) {
                return candidates;
            }

            for (let i = 0; i < payloads.length; i++) {
                let p = Renderer._createPayload(payloads[i], payloads[i]);

                const candidate = this._extractCandidateNameFromPayload(p);
                if (candidate !== null) {
                    candidates[candidate] = typeof candidates[candidate] === "number" ? candidates[candidate] + 1 : 1;
                }
            }

            return candidates;
        },

        _extractCandidateNameFromPayload: function (payload) {
            return $.isPlainObject(payload) &&
            $.isArray(payload.namedRecommendations) &&
            payload.namedRecommendations.length === 1 ? payload.namedRecommendations[0] : null;
        },

        _determineMetaData: function (recommendationResponse, result) {
            result.meta = {};
            result.meta.type = this._determineRecommendationType(recommendationResponse);
        },

        _determineSplitTestData: function (recommendationResponse, result) {
            if ($.isPlainObject(recommendationResponse) &&
                $.isPlainObject(recommendationResponse.additionalData) &&
                $.isPlainObject(recommendationResponse.additionalData.splitTestData)) {

                result.splitTestData = $.extend({
                    active: true,
                    isTest: recommendationResponse.statusCode === 200,
                    isControl: recommendationResponse.statusCode === 7120
                }, recommendationResponse.additionalData.splitTestData);
            } else if ($.isPlainObject(recommendationResponse) && recommendationResponse.statusCode === 7120) {
                result.splitTestData = {
                    active: false,
                    isTest: false,
                    isControl: false
                };
            } else {
                result.splitTestData = {
                    active: false,
                    isTest: false,
                    isControl: false
                };
            }

            return result.splitTestData.active;
        },

        _mapAssets: function (recommendationResponse) {
            if (!$.isArray(recommendationResponse.result)) {
                return [];
            }

            let mappedAssets = [];
            for (let i = 0; i < recommendationResponse.result.length; i++) {
                let asset = recommendationResponse.result[i];
                let mappedAsset = this._mapAsset(asset);
                if ($.isPlainObject(mappedAsset)) {
                    mappedAssets.push(mappedAsset);
                }
            }

            return mappedAssets;
        },

        _mapAsset: function (asset) {
            if (!$.isPlainObject(asset) || typeof asset.dataIdExternal !== "string") {
                return null;
            } else if (!$.isPlainObject(asset.additionalData)) {
                return null;
            }

            return {
                _recommenderWeight: asset.weight,
                id: asset.dataIdExternal,
                type: this._getValue(asset, "assets::assetType"),
                url: this._getValue(asset, "assets::assetUrl"),
                image: this._getValue(asset, "assets::assetImageUrl"),
                categories: this._getValue(asset, "assets::assetCategories"),
                description: this._getValue(asset, "assets::assetDescription"),
                additionalData: asset.additionalData
            };
        },

        _mapProducts: function (recommendationResponse) {
            if (!$.isArray(recommendationResponse.result)) {
                return [];
            }

            let mappedProducts = [];
            for (let i = 0; i < recommendationResponse.result.length; i++) {
                let product = recommendationResponse.result[i];
                let mappedProduct = this._mapProduct(product);
                if ($.isPlainObject(mappedProduct)) {
                    mappedProducts.push(mappedProduct);
                }
            }

            return mappedProducts;
        },

        _mapProduct: function (product) {
            if (!$.isPlainObject(product) || typeof product.dataIdExternal !== "string") {
                return null;
            } else if (!$.isPlainObject(product.additionalData)) {
                return null;
            }

            let price = this._getValue(product, "inventory::productPrice");
            price = price === null ? this._getValue(product, "product::productPrice") : price;

            return {
                _recommenderWeight: product.weight,
                id: product.dataIdExternal,
                inventory: this._getValue(product, "inventory::inventoryQuantity"),
                name: this._getValue(product, "product::productName"),
                url: this._getValue(product, "product::productUrl"),
                image: this._getValue(product, "product::productImageUrl"),
                categories: this._getValue(product, "product::productCategories"),
                description: this._getValue(product, "product::productDescription"),
                price: price,
                additionalData: product.additionalData
            };
        },

        _mapAny: function (recommendationResponse) {
            if (!$.isArray(recommendationResponse.result)) {
                return [];
            }

            let mappedResults = [];
            for (let i = 0; i < recommendationResponse.result.length; i++) {
                let result = recommendationResponse.result[i];
                if (!$.isPlainObject(result)) {
                    continue;
                }

                mappedResults.push({
                    _recommenderWeight: result.weight,
                    id: result.dataIdExternal,
                    additionalData: result.additionalData
                });
            }

            return mappedResults;
        },

        _getValue: function (entity, name) {
            if (!$.isPlainObject(entity) || !$.isPlainObject(entity.additionalData)) {
                return null;
            }

            let value = entity.additionalData[name];
            return typeof value === "undefined" || value === null ? null : value;
        }
    };

    // bind the module
    Breinify.plugins._add("recommendations", Recommendations);
})();