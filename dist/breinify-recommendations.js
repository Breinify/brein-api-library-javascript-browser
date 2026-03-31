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
            data: "recommendation"
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
            }

            return false;
        },

        _setRefreshState: function ($container, option, state, details) {
            if (!$container?.jquery || $container.length !== 1) {
                return;
            }

            $container
                .attr("data-brrc-refresh-state", state)
                .removeClass("brrc-is-refreshing brrc-refresh-error brrc-refresh-canceled");

            if (state === "refreshing") {
                $container.addClass("brrc-is-refreshing");
            } else if (state === "refresh-error") {
                $container.addClass("brrc-refresh-error");
            } else if (state === "refresh-canceled") {
                $container.addClass("brrc-refresh-canceled");
            }

            const refreshStateChange = option?.process?.refreshStateChange;
            if ($.isFunction(refreshStateChange)) {
                refreshStateChange($container, state, details || {}, option);
            }
        },

        _clearRefreshState: function ($container, option, details) {
            if (!$container?.jquery || $container.length !== 1) {
                return;
            }

            $container
                .removeAttr("data-brrc-refresh-state")
                .removeClass("brrc-is-refreshing brrc-refresh-error brrc-refresh-canceled");

            const refreshStateChange = option?.process?.refreshStateChange;
            if ($.isFunction(refreshStateChange)) {
                refreshStateChange($container, "idle", details || {}, option);
            }
        },

        _refresh: function (refreshOptions) {
            const _self = this;

            let optionsVersion = null;
            if ($.isPlainObject(refreshOptions)) {
                optionsVersion = Date.now();
                this.refreshOptions = $.extend(true, {}, refreshOptions, {
                    optionsVersion: optionsVersion
                });
            } else if ($.isPlainObject(this.refreshOptions)) {
                optionsVersion = this.refreshOptions.optionsVersion;
            } else {
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
                let $itemContainer = $parent.hasClass(_self.marker.container)
                    ? $parent
                    : $parent.find("." + _self.marker.container);

                if ($itemContainer.length === 0) {
                    return;
                }

                const data = $itemContainer.data(_self.marker.data);
                if (!$.isPlainObject(data?.option) || !$.isPlainObject(data?.data)) {
                    return;
                }

                const option = data.option;

                _self._setRefreshState($parent, option, "refreshing", {
                    refreshOptions: _self.refreshOptions,
                    previousData: data.data
                });

                const recPayload = _self._createPayload(option);

                let recGroup = Breinify.UTL.isNonEmptyString(recPayload.recommendationGroup);
                if (recGroup === null) {
                    recGroup = "no-group-" + (noGroupCount++);
                }

                if (!$.isArray(settings[recGroup])) {
                    settings[recGroup] = [];
                }

                const cpyOption = $.extend(true, {}, option);
                cpyOption.meta = $.extend(true, {}, option?.meta, {
                    processId: null,
                    optionsVersion: optionsVersion,
                    refreshParent: $parent
                });
                cpyOption.position = {
                    replace: function () {
                        return $parent;
                    }
                };
                cpyOption.recommender.payload = recPayload;

                settings[recGroup].push(cpyOption);
            });

            Object.values(settings).forEach(function (setting) {
                Breinify.plugins.recommendations.render(setting);
            });
        },

        _determineSelector: function (value) {
            if ($.isFunction(value)) {
                const params = Array.prototype.slice.call(arguments, 1);
                value = value.apply(null, params);
            }

            if (value == null) {
                return null;
            } else if (typeof value === "string") {
                return $(value);
            } else if (value?.jquery) {
                return value;
            }

            return null;
        },

        /**
         * Normalizes the optional render identity configured on a render option.
         *
         * The method reads `option.meta.renderIdentity` and returns a sanitized object
         * containing only normalized non-empty string values. If the identity is missing
         * or all values are empty, `null` is returned.
         *
         * This normalization keeps the stamping path small and predictable and ensures
         * that empty values do not end up as DOM attributes.
         *
         * @param {Object} option
         * the render option that may contain `meta.renderIdentity`
         *
         * @returns {{
         *   webExId: String|null,
         *   positionId: String|null,
         *   recommenderName: String|null
         * }|null}
         * normalized render identity or `null` if no meaningful identity is available
         */
        _readRenderIdentity: function (option) {
            const identity = $.isPlainObject(option?.meta?.renderIdentity)
                ? option.meta.renderIdentity
                : null;

            if (!$.isPlainObject(identity)) {
                return null;
            }

            const webExId = Breinify.UTL.isNonEmptyString(identity.webExId);
            const positionId = Breinify.UTL.isNonEmptyString(identity.positionId);
            const recommenderName = Breinify.UTL.isNonEmptyString(identity.recommenderName);

            if (webExId === null && positionId === null && recommenderName === null) {
                return null;
            }

            return {
                webExId: webExId,
                positionId: positionId,
                recommenderName: recommenderName
            };
        },

        /**
         * Applies the normalized render identity to the outer rendered container.
         *
         * If a valid render identity is available, the method writes the corresponding
         * `data-br-rec-*` attributes to the container. If no valid identity exists,
         * any previously present identity attributes are removed.
         *
         * This helper centralizes identity stamping so that all rendering paths
         * (normal rendering, binding, and external rendering) use the same logic.
         *
         * @param {jQuery} $container
         * the outer rendered recommendation container
         *
         * @param {Object} option
         * the render option that may contain `meta.renderIdentity`
         */
        _stampRenderIdentity: function ($container, option) {
            if (!$container?.jquery || $container.length !== 1) {
                return;
            }

            const identity = this._readRenderIdentity(option);
            if (identity === null) {
                $container
                    .removeAttr("data-br-rec-webexpid")
                    .removeAttr("data-br-rec-positionid")
                    .removeAttr("data-br-rec-name");
                return;
            }

            if (identity.webExId !== null) {
                $container.attr("data-br-rec-webexpid", identity.webExId);
            } else {
                $container.removeAttr("data-br-rec-webexpid");
            }

            if (identity.positionId !== null) {
                $container.attr("data-br-rec-positionid", identity.positionId);
            } else {
                $container.removeAttr("data-br-rec-positionid");
            }

            if (identity.recommenderName !== null) {
                $container.attr("data-br-rec-name", identity.recommenderName);
            } else {
                $container.removeAttr("data-br-rec-name");
            }
        },

        _appendContainer: function (option, data, cb) {
            const _self = this;

            if (!$.isPlainObject(option?.position)) {
                cb(null, {
                    error: true,
                    errorDescription: "missing position",
                    externalRendering: false
                });
                return;
            }

            let method = null;
            let selector = null;

            if (option.position.before != null) {
                selector = option.position.before;
                method = "before";
            } else if (option.position.after != null) {
                selector = option.position.after;
                method = "after";
            } else if (option.position.append != null) {
                selector = option.position.append;
                method = "append";
            } else if (option.position.prepend != null) {
                selector = option.position.prepend;
                method = "prepend";
            } else if (option.position.replace != null) {
                selector = option.position.replace;
                method = "replaceWith";
            } else if (option.position.externalRender != null) {
                this._applyExternalRender(option, data, function ($target, settings) {
                    if ($target?.jquery && $target.length === 1) {
                        $target.addClass(_self.marker.parentContainer);
                        _self._stampRenderIdentity($target, option);
                    }

                    cb($target, $.extend(true, {
                        error: false,
                        externalRendering: true,
                        itemSelection: null
                    }, settings));
                });
                return;
            }

            const recommenderName = this._recommenderName(option?.recommender?.payload);
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

            const $container = this._determineSelector(option?.templates?.container);
            if ($container === null || $container.length === 0) {
                cb(null, {
                    error: true,
                    errorDescription: "unable to find container",
                    externalRendering: false
                });
                return;
            }

            _self._replacePlaceholders($container, data, option);

            if ($.isFunction($anchor[method])) {
                $anchor[method]($container);

                $container.addClass(this.marker.parentContainer);
                this._stampRenderIdentity($container, option);

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
            const refreshOptions = $.isPlainObject(this.refreshOptions) ? this.refreshOptions : {};
            const optionsVersion = typeof refreshOptions.optionsVersion === "number"
                ? refreshOptions.optionsVersion
                : null;
            const overridePayload = $.isPlainObject(refreshOptions.payload)
                ? refreshOptions.payload
                : {};

            if ($.isPlainObject(option?.recommender?.payload)) {
                return $.extend(true, {}, option.recommender.payload, overridePayload, {
                    optionsVersion: optionsVersion
                });
            } else if ($.isPlainObject(def)) {
                return $.extend(true, {}, def, overridePayload, {
                    optionsVersion: optionsVersion
                });
            }

            return {
                optionsVersion: $.isPlainObject(Renderer.refreshOptions)
                    ? Renderer.refreshOptions.optionsVersion
                    : null
            };
        },

        _recommenderName: function (payload) {
            if ($.isPlainObject(payload) &&
                $.isArray(payload.namedRecommendations) &&
                payload.namedRecommendations.length === 1) {
                return Breinify.UTL.isNonEmptyString(payload.namedRecommendations[0]);
            }

            return null;
        },

        _applyExternalRender: function (option, data, cb) {
            if ($.isFunction(option?.position?.externalRender)) {
                option.position.externalRender(data, cb);
            } else {
                cb(null);
            }
        },

        _appendItems: function ($container, result, option) {
            const _self = this;

            const $item = this._determineSelector(option?.templates?.item, $container);
            if ($item === null) {
                return null;
            }

            $.each(result.recommendations, function (idx, recommendation) {
                const $recItem = _self._replacePlaceholders($item.clone(false), recommendation, option);
                _self._setupItemData($recItem, idx, recommendation);

                $container.append($recItem);
                _self._process(option?.process?.attachedItem, $container, $recItem, recommendation, option);
            });

            return $container;
        },

        _isItem: function ($item) {
            return $item.closest("[data-" + this.marker.container + "=\"true\"]").length === 1;
        },

        _setupItemData: function ($recItem, idx, data) {
            const normIdx = typeof idx === "number" ? (idx < 0 ? idx : idx + 1) : null;

            $recItem
                .addClass(this.marker.item)
                .attr("data-" + this.marker.item, "true")
                .data(this.marker.data, $.extend(true, {
                    widgetPosition: normIdx
                }, data));
        },

        /**
         * Replaces all placeholders in text and attributes, the returned element is the same as
         * passed in under `$entry`.
         *
         * @param $entry the element to check for replacements
         * @param replacements the replacements to apply
         * @param option the defined options
         * @returns {*} the `$entry`, just for chaining purposes
         * @private
         */
        _replacePlaceholders: function ($entry, replacements, option) {
            const _self = this;

            if (!$entry || $entry.length === 0) {
                return $entry;
            }

            $entry.contents().filter(function () {
                return Breinify.UTL.dom.isNodeType(this, 3);
            }).each(function () {
                const $el = $(this);
                const replaced = _self._replace($el.text(), replacements, option);

                if (replaced !== null) {
                    $el.replaceWith(replaced);
                }
            });

            const entryEl = $entry.get(0);
            if (!entryEl?.attributes) {
                return $entry;
            }

            const attributes = entryEl.attributes;
            const renaming = {};

            for (let i = 0; i < attributes.length; i++) {
                const attribute = attributes[i];
                const replaced = _self._replace(attribute.value, replacements, option);

                if (replaced === null) {
                    continue;
                } else if (attribute.name.startsWith("data-rename-")) {
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

            $entry.children().each(function () {
                _self._replacePlaceholders($(this), replacements, option);
            });

            return $entry;
        },

        /**
         * Replaces any occurrences of %%...%% with the appropriate placeholder and returns
         * the modified text, will return `null` if no replacement took place.
         *
         * @param value the value to replace
         * @param data the data to replace values from
         * @param option options to modify the behavior
         * @returns {string|null} the replaced value or `null` if no replacement took place
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
                const placeholderOption = option?.placeholders?.[name];
                const hasPlaceholderOption = $.isFunction(placeholderOption) || typeof placeholderOption === "string";
                const recValue = _self._readPath(name, data);
                const hasRecValue = typeof recValue !== "undefined";

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

                if (replacement === null && $.isFunction(option?.placeholderSettings?.replaceWith)) {
                    replacement = option.placeholderSettings.replaceWith(name);
                }

                if (replacement === null) {
                    return match;
                }

                replacements._counter++;
                return replacement;
            });

            return replacements._counter > 0 ? result : null;
        },

        _readPath: function (name, data) {
            const paths = name.split(".");
            if (paths.length === 1) {
                return data?.[name];
            }

            let value = data;
            for (let i = 0; i < paths.length; i++) {
                if (!$.isPlainObject(value)) {
                    return null;
                }

                value = value[paths[i]];
            }

            return value;
        }
    };

    const canceledRequests = {
        _status: {
            canceled: "canceled"
        }
    };

    /**
     * Default rendering configuration used by the recommendations plugin.
     *
     * The object is deep-cloned and merged with user-provided render settings before
     * a rendering process starts. All properties documented here represent the
     * supported shape of a render option.
     *
     * High-level structure:
     * - `meta`: internal runtime metadata for a render process
     * - `recommender`: payload/settings used to retrieve recommendations
     * - `activity`: activity names used for rendered/clicked tracking
     * - `bindings`: click bindings applied to rendered recommendations
     * - `splitTests`: optional control-group integration settings
     * - `position`: placement definition describing where/how to attach the container
     * - `placeholderSettings`: fallback behavior for unresolved placeholders
     * - `placeholders`: placeholder resolvers used while rendering templates
     * - `templates`: container and item templates/selectors
     * - `process`: lifecycle hooks around retrieval, rendering, refresh, and click handling
     * - `data`: optional response transformation hooks
     */
    const defaultRenderOption = {
        meta: {
            /**
             * Unique identifier of the current rendering process.
             *
             * This value is assigned internally when rendering starts and is used to
             * support cancellation and stale-process detection.
             *
             * @type {String|null}
             */
            processId: null,

            /**
             * Optional rendering identity used to stamp the outer rendered container
             * with stable DOM metadata.
             *
             * This identity is primarily used by higher-level integrations such as
             * `uiRecommendations` to associate a rendered recommendation block with:
             * - the owning web-experience
             * - an optional attribute-position anchor
             * - an optional recommender name
             *
             * When present, the renderer writes the following attributes onto the
             * outer parent container:
             * - `data-br-rec-webexpid`
             * - `data-br-rec-positionid`
             * - `data-br-rec-name`
             *
             * This metadata is not required for normal recommendation rendering.
             * It exists to support integration-level reconciliation, deduplication,
             * refresh handling, and DOM inspection/debugging for dynamic placements.
             *
             * Expected shape:
             * {
             *   webExId: "...",
             *   positionId: "...",
             *   recommenderName: "..."
             * }
             *
             * Notes:
             * - all properties are optional, but at least one meaningful value should exist
             * - when `null`, no render identity metadata is written
             * - callers should treat this as descriptive container identity, not as a
             *   general-purpose data channel
             *
             * @type {{
             *   webExId: String|null,
             *   positionId: String|null,
             *   recommenderName: String|null
             * }|null}
             */
            renderIdentity: null
        },

        /**
         * Recommender settings used to retrieve recommendations.
         *
         * Expected shape:
         * {
         *   payload: {
         *     namedRecommendations: ["..."],
         *     recommendationQueryName: "...",
         *     ...
         *   }
         * }
         *
         * @type {Object|null}
         */
        recommender: null,

        activity: {
            /**
             * Activity type used when a recommendation was rendered.
             *
             * @type {String}
             */
            renderType: "renderedRecommendation",

            /**
             * Activity type used when a recommendation item was clicked.
             *
             * @type {String}
             */
            clickedType: "clickedRecommendation"
        },

        bindings: {
            /**
             * Global selector used for delegated click detection.
             *
             * Any matching click inside a rendered recommendation may be interpreted
             * as a recommendation interaction, depending on container/item resolution.
             *
             * @type {String}
             */
            selector: "a,.br-rec-click",

            /**
             * Optional map of stricter click bindings applied directly to elements
             * inside the rendered container.
             *
             * Structure:
             * {
             *   ".selector": {
             *     ...additionalEventData
             *   }
             * }
             *
             * The mapped object value is passed through as `additionalEventData`
             * into the click handling flow.
             *
             * @type {Object<String, Object>}
             */
            specificSelectors: {}
        },

        splitTests: {
            control: {
                /**
                 * Selector definition resolving the control-group container.
                 *
                 * Supported values:
                 * - CSS selector string
                 * - jQuery instance
                 * - function
                 *
                 * Function signature:
                 * function () { ... }
                 *
                 * Function return value:
                 * - CSS selector string
                 * - jQuery instance
                 * - null
                 *
                 * @type {String|jQuery|Function|null}
                 */
                containerSelector: null
            }
        },

        position: {
            /**
             * Anchor used for jQuery `before(...)`.
             *
             * Supported values:
             * - CSS selector string
             * - jQuery instance
             * - function
             *
             * Function signature:
             * function (recommenderName, $changedContainer, meta) { ... }
             *
             * Parameters:
             * @param {String|null} recommenderName
             * the resolved recommender name
             * @param {jQuery|null} $changedContainer
             * changed element container for dynamic/onChange resolution,
             * `null` during normal rendering
             * @param {Object} meta
             * metadata describing the resolution context
             *
             * Meta shape:
             * {
             *   type: "added-element" | "determine-container" | ...,
             *   option: <render option, if available>,
             *   data: <recommendation result or mutation metadata, if available>
             * }
             *
             * Function return value:
             * - CSS selector string
             * - jQuery instance
             * - null
             *
             * @type {String|jQuery|Function|null}
             */
            before: null,

            /**
             * Anchor used for jQuery `after(...)`.
             *
             * Supported values:
             * - CSS selector string
             * - jQuery instance
             * - function
             *
             * Function signature:
             * function (recommenderName, $changedContainer, meta) { ... }
             *
             * Parameters:
             * @param {String|null} recommenderName
             * the resolved recommender name
             * @param {jQuery|null} $changedContainer
             * changed element container for dynamic/onChange resolution,
             * `null` during normal rendering
             * @param {Object} meta
             * metadata describing the resolution context
             *
             * Meta shape:
             * {
             *   type: "added-element" | "determine-container" | ...,
             *   option: <render option, if available>,
             *   data: <recommendation result or mutation metadata, if available>
             * }
             *
             * Function return value:
             * - CSS selector string
             * - jQuery instance
             * - null
             *
             * @type {String|jQuery|Function|null}
             */
            after: null,

            /**
             * Anchor used for jQuery `prepend(...)`.
             *
             * Supported values:
             * - CSS selector string
             * - jQuery instance
             * - function
             *
             * Function signature:
             * function (recommenderName, $changedContainer, meta) { ... }
             *
             * Parameters:
             * @param {String|null} recommenderName
             * the resolved recommender name
             * @param {jQuery|null} $changedContainer
             * changed element container for dynamic/onChange resolution,
             * `null` during normal rendering
             * @param {Object} meta
             * metadata describing the resolution context
             *
             * Meta shape:
             * {
             *   type: "added-element" | "determine-container" | ...,
             *   option: <render option, if available>,
             *   data: <recommendation result or mutation metadata, if available>
             * }
             *
             * Function return value:
             * - CSS selector string
             * - jQuery instance
             * - null
             *
             * @type {String|jQuery|Function|null}
             */
            prepend: null,

            /**
             * Anchor used for jQuery `append(...)`.
             *
             * Supported values:
             * - CSS selector string
             * - jQuery instance
             * - function
             *
             * Function signature:
             * function (recommenderName, $changedContainer, meta) { ... }
             *
             * Parameters:
             * @param {String|null} recommenderName
             * the resolved recommender name
             * @param {jQuery|null} $changedContainer
             * changed element container for dynamic/onChange resolution,
             * `null` during normal rendering
             * @param {Object} meta
             * metadata describing the resolution context
             *
             * Meta shape:
             * {
             *   type: "added-element" | "determine-container" | ...,
             *   option: <render option, if available>,
             *   data: <recommendation result or mutation metadata, if available>
             * }
             *
             * Function return value:
             * - CSS selector string
             * - jQuery instance
             * - null
             *
             * @type {String|jQuery|Function|null}
             */
            append: null,

            /**
             * Anchor used for jQuery `replaceWith(...)`.
             *
             * Supported values:
             * - CSS selector string
             * - jQuery instance
             * - function
             *
             * Function signature:
             * function (recommenderName, $changedContainer, meta) { ... }
             *
             * Parameters:
             * @param {String|null} recommenderName
             * the resolved recommender name
             * @param {jQuery|null} $changedContainer
             * changed element container for dynamic/onChange resolution,
             * `null` during normal rendering
             * @param {Object} meta
             * metadata describing the resolution context
             *
             * Meta shape:
             * {
             *   type: "added-element" | "determine-container" | ...,
             *   option: <render option, if available>,
             *   data: <recommendation result or mutation metadata, if available>
             * }
             *
             * Function return value:
             * - CSS selector string
             * - jQuery instance
             * - null
             *
             * @type {String|jQuery|Function|null}
             */
            replace: null,

            /**
             * Optional third-party rendering hook.
             *
             * If used, rendering of the recommendation DOM is delegated to the caller.
             * The function must call the provided callback with the resolved item container.
             *
             * Function signature:
             * function (data, callback) { ... }
             *
             * Parameters:
             * @param {Object} data
             * mapped recommendation result
             * @param {Function} callback
             * callback used to hand the externally rendered container back into the framework
             *
             * Callback signature:
             * callback($itemContainer, settings)
             *
             * Callback parameters:
             * @param {jQuery|null} $itemContainer
             * rendered item container
             * @param {Object} [settings]
             * optional settings overriding external rendering behavior
             *
             * Supported callback settings:
             * {
             *   error: false,
             *   externalRendering: true,
             *   itemSelection: null
             * }
             *
             * `itemSelection`, if provided, must use:
             * function ($itemContainer, idx, recommendation) { ... }
             *
             * Return value:
             * - ignored by the framework
             *
             * @type {Function|null}
             */
            externalRender: null
        },

        placeholderSettings: {
            /**
             * Fallback resolver for placeholders that could not be resolved otherwise.
             *
             * This is called only when:
             * - no explicit placeholder resolver matched
             * - no value could be read from recommendation data
             *
             * Return:
             * - `null` to keep the original placeholder unchanged
             * - a string (including empty string) to replace it
             *
             * @param {String} placeholder
             * the unresolved placeholder name
             *
             * @returns {String|null}
             * replacement value or `null` to leave the placeholder untouched
             */
            replaceWith: function () {
                return "";
            }
        },

        placeholders: {
            /**
             * Built-in random UUID placeholder.
             *
             * Function signature:
             * function () { ... }
             *
             * @returns {String}
             */
            "random::uuid": function () {
                return Breinify.UTL.uuid();
            },

            /**
             * Built-in placeholder resolving the recommendation container marker class.
             *
             * @type {String}
             */
            "marker::container": Renderer.marker.container,

            /**
             * Built-in placeholder resolving the recommendation item marker class.
             *
             * @type {String}
             */
            "marker::item": Renderer.marker.item,

            /**
             * Built-in placeholder resolving the recommender name from the payload.
             *
             * Function signature:
             * function (data, resolvedValue) { ... }
             *
             * Parameters:
             * @param {Object} data
             * current replacement data object
             * @param {*} resolvedValue
             * value resolved from the placeholder path, if any
             *
             * @returns {String|null}
             */
            "marker::recommender": function (data) {
                return Breinify.UTL.isNonEmptyString(data?.payload?.recommenderName);
            },

            /**
             * Built-in placeholder returning the entire data object as JSON.
             *
             * Function signature:
             * function (data, resolvedValue) { ... }
             *
             * Parameters:
             * @param {Object} data
             * current replacement data object
             * @param {*} resolvedValue
             * value resolved from the placeholder path, if any
             *
             * @returns {String}
             */
            "data::json": function (data) {
                return JSON.stringify(data);
            }
        },

        /**
         * Defines HTML templates, selectors, jQuery instances, or functions used
         * to resolve the outer container and item template/selection.
         *
         * In normal rendering mode these are typically template sources.
         * In binding-only or externally-rendered scenarios these may also behave as
         * selectors resolving already existing DOM.
         */
        templates: {
            /**
             * Template or selector used for the outer recommendation container.
             *
             * Supported values:
             * - HTML string
             * - CSS selector string
             * - jQuery instance
             * - function
             *
             * Function signature:
             * function ($context) { ... }
             *
             * Parameters:
             * @param {jQuery} [$context]
             * optional context container provided by the caller
             *
             * Function return value:
             * - HTML string
             * - CSS selector string
             * - jQuery instance
             * - null
             *
             * @type {String|jQuery|Function|null}
             */
            container: null,

            /**
             * Template or selector used for a single rendered item.
             *
             * Supported values:
             * - HTML string
             * - CSS selector string
             * - jQuery instance
             * - function
             *
             * Function signature:
             * function ($context) { ... }
             *
             * Parameters:
             * @param {jQuery} [$context]
             * current item/container context
             *
             * Function return value:
             * - HTML string
             * - CSS selector string
             * - jQuery instance
             * - null
             *
             * @type {String|jQuery|Function|null}
             */
            item: null
        },

        process: {
            stoppedPropagation: function () {
            },

            error: function () {
            },

            canceled: function () {
            },

            init: function () {
            },

            pre: function () {
            },

            attachedContainer: function () {
            },

            attachedItem: function () {
            },

            attached: function () {
            },

            post: function () {
            },

            finalize: function () {
            },

            clickedItem: function () {
            },

            createActivity: function () {
            },

            refreshStateChange: function () {
            }
        },

        data: {
            /**
             * Optional hook to transform, split, or replace a retrieved recommendation result
             * before it is rendered.
             *
             * Supported return values:
             * - `null`
             *   -> keep original `{result, option}`
             * - `{ result: ..., option: ... }`
             *   -> replace with one modified pair
             * - `[{ result: ..., option: ... }, ...]`
             *   -> split into multiple render operations
             *
             * Async functions are supported as well.
             *
             * Returned `option` values are expected to be full render options usable by
             * the rendering pipeline, not partial patches.
             *
             * @param {Object} result
             * the mapped recommendation result
             * @param {Object} option
             * the render option
             *
             * @returns {null|Object|Object[]|Promise<null|Object|Object[]>}
             */
            modify: function () {
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
            const processId = Breinify.UTL.uuid();

            overload.overload({
                "Object": function (renderOption) {
                    const option = $.extend(true, {}, defaultRenderOption, renderOption);
                    option.meta.processId = processId;
                    _self._bindContainer(option);
                },

                "Object,Object": function (splitTestSettings, renderOption) {
                    const option = $.extend(true, {}, defaultRenderOption, renderOption);
                    option.meta.processId = processId;

                    _self._loadSplitTestSeparately(splitTestSettings, function (error, data) {
                        const recPayload = Renderer._createPayload(option);

                        if (error === null) {
                            let statusCode = 200;
                            if ($.isArray(splitTestSettings?.controlGroups) &&
                                $.isPlainObject(data?.splitTestData) &&
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

                            Renderer._process(option?.process?.error, $.extend({
                                name: splitTestSettings?.name,
                                result: errorData
                            }, errorData.status));
                        }
                    });
                }
            }, arguments, this);
        },

        cancel: function (processId) {
            canceledRequests[processId] = {
                cancellationTime: Date.now(),
                status: canceledRequests._status.canceled,
                processId: processId
            };
        },

        /**
         * The render method is used to render the configured recommendations within the given user-interface.
         */
        render: function () {
            const _self = this;
            const processId = Breinify.UTL.uuid();

            overload.overload({
                "Array": function (renderOptions) {
                    const namedRenderOptions = {};
                    const recommenderPayload = [];

                    for (let i = 0; i < renderOptions.length; i++) {
                        const options = this._preRenderRecommendations(processId, {
                            temporary: renderOptions[i]
                        });
                        const recommenderOptions = options.temporary.recommender;

                        if (!$.isPlainObject(recommenderOptions?.payload) ||
                            !$.isArray(recommenderOptions.payload.namedRecommendations)) {
                            Renderer._process(options?.temporary?.process?.error, {
                                code: -1,
                                error: true,
                                message: "invalid payload for recommender defined for rendering process",
                                options: options
                            });
                            return;
                        }

                        const name = this._determineName(recommenderOptions.payload, i, renderOptions);
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
                    const options = this._preRenderRecommendations(processId, renderOptions);
                    this._retrieveRecommendations([payload], function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                },

                "Array,Object": function (payloads, renderOptions) {
                    const options = this._preRenderRecommendations(processId, renderOptions);
                    this._retrieveRecommendations(payloads, function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                },

                "String,Object": function (recommendationId, renderOptions) {
                    const options = this._preRenderRecommendations(processId, renderOptions);
                    this._retrieveRecommendations([{
                        namedRecommendations: [recommendationId]
                    }], function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                },

                "String,Object,Object": function (recommendationId, payload, renderOptions) {
                    const options = this._preRenderRecommendations(processId, renderOptions);
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
            }

            return false;
        },

        /**
         * Determines the default knowledge for the activity-tags at this point,
         * for Breinify a lot of knowledge can be applied already, additional
         * knowledge may be applied within the createActivity process.
         */
        createRecommendationTags: function (recommendationData, recommendation, additionalEventData) {
            const activityTags = this._createDefaultTags(recommendationData, additionalEventData);
            this._applyBreinifyTags(activityTags, recommendationData, recommendation, additionalEventData);
            return activityTags;
        },

        /**
         * Determines the default knowledge for the activity-tags within
         * a rendered recommendation activity.
         */
        createRenderedRecommendationTags: function ($container, result) {
            const activityTags = this.createRecommendationTags(result, {}, {});

            activityTags.containerAvailable = $container === null ? null : $container.length > 0;
            activityTags.status = Breinify.UTL.toInteger(result?.status?.code);
            activityTags.expectedNrOfRecs = $.isPlainObject(result?.payload)
                ? Breinify.UTL.toInteger(result.payload.expectedNumberOfRecommendations)
                : null;
            activityTags.retrievedNrOfRecs = $.isArray(result?.recommendations)
                ? result.recommendations.length
                : 0;
            activityTags.rendered = activityTags.status === 200 &&
                activityTags.retrievedNrOfRecs > 0 &&
                (activityTags.containerAvailable === null || activityTags.containerAvailable === true);

            return activityTags;
        },

        /**
         * Determines the default knowledge for the activity-tags within
         * a clicked recommendation activity.
         */
        createClickedRecommendationTags: function (recommendationData, recommendation, additionalEventData) {
            return this.createRecommendationTags(recommendationData, recommendation, additionalEventData);
        },

        _isCanceled: function (processId) {
            const now = Date.now();
            const expiredProcesses = [];

            $.each(canceledRequests, function (requestProcessId, canceledRequest) {
                if (now - canceledRequest.cancellationTime > 60 * 1000) {
                    expiredProcesses.push(requestProcessId);
                }
            });

            for (let i = 0; i < expiredProcesses.length; i++) {
                delete canceledRequests[expiredProcesses[i]];
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

            const splitTestName = splitTestSettings?.name;
            const splitTestTokens = Breinify.UTL.isNonEmptyString(splitTestSettings?.token) === null
                ? splitTestSettings?.tokens
                : splitTestSettings.token;
            const splitTestStorage = Breinify.UTL.isNonEmptyString(splitTestSettings?.storageKey) === null
                ? splitTestSettings?.storageKeys
                : splitTestSettings.storageKey;
            const splitTestPayload = $.extend(true, {
                splitTestName: splitTestSettings?.name
            }, splitTestSettings?.payload);

            Breinify.plugins.splitTests.retrieveSplitTest(
                splitTestName,
                splitTestTokens,
                splitTestPayload,
                splitTestStorage,
                function (error, data) {
                    cb(error, data);
                }
            );
        },

        _bindContainer: function (option, recData) {
            const _self = this;
            const data = $.isPlainObject(recData) ? recData : {};

            let $container = Renderer._determineSelector(option?.templates?.container);
            if ($container === null || $container.length === 0) {
                return;
            }

            Renderer._stampRenderIdentity($container, option);

            $container = this._setupContainer($container, option, data);
            if ($container === null) {
                return;
            }

            this._applyBindings(option, $container);

            const $items = Renderer._determineSelector(option?.templates?.item, $container);
            if ($items !== null) {
                $items.each(function (idx) {
                    _self.setRecommendationData($(this), idx, {});
                });
            }
        },

        _preRenderRecommendations: function (processId, renderOptions) {
            const options = {};

            $.each(renderOptions, function (name, renderOption) {
                const option = $.extend(true, {}, defaultRenderOption, renderOption);
                option.meta.processId = processId;

                Renderer._process(option?.process?.init, option);
                options[name] = option;
            });

            return options;
        },

        _renderRecommendations: function (options, error, data) {
            const _self = this;

            if (error !== null) {
                $.each(options, function (name, option) {
                    Renderer._process(option?.process?.error, error);

                    if (option?.meta?.refreshParent) {
                        Renderer._setRefreshState(option.meta.refreshParent, option, "refresh-error", {
                            name: name,
                            error: error
                        });
                    }

                    const errorResponse = _self._mapError(data, error);
                    _self._handleRender(errorResponse, option, null);
                    Renderer._process(option?.process?.finalize, option, errorResponse, null);
                });

                return;
            }

            let recStatus = "undefined";

            $.each(options, function (name, option) {
                const result = data?.[name];

                if (_self._isCanceled(option?.meta?.processId)) {
                    if (option?.meta?.refreshParent) {
                        Renderer._setRefreshState(option.meta.refreshParent, option, "refresh-canceled", {
                            name: name,
                            result: result
                        });
                    }

                    Renderer._process(option?.process?.canceled, option, result);
                    Renderer._process(option?.process?.finalize, option, result, null);
                } else if (!$.isPlainObject(result?.status)) {
                    Renderer._process(option?.process?.error, {
                        code: -1,
                        error: true,
                        message: "unexpected result-type received",
                        name: name,
                        result: result
                    });

                    if (option?.meta?.refreshParent) {
                        Renderer._setRefreshState(option.meta.refreshParent, option, "refresh-error", {
                            name: name,
                            result: result
                        });
                    }

                    const errorResult = {
                        status: {
                            code: 500,
                            message: "unexpected result-type received",
                            error: true
                        }
                    };

                    _self._handleRender(errorResult, option, null);
                    Renderer._process(option?.process?.finalize, option, errorResult, null);
                } else if (result.status.error === true) {
                    Renderer._process(option?.process?.error, $.extend({
                        name: name,
                        result: result
                    }, result.status));

                    if (option?.meta?.refreshParent) {
                        Renderer._setRefreshState(option.meta.refreshParent, option, "refresh-error", {
                            name: name,
                            result: result
                        });
                    }

                    _self._handleRender(result, option, null);
                    Renderer._process(option?.process?.finalize, option, result, null);
                } else if ($.isFunction(option?.data?.modify)) {
                    const handleModifyResult = function (modifyResults) {
                        if ($.isArray(modifyResults)) {
                            // keep array
                        } else if ($.isPlainObject(modifyResults?.result) &&
                            $.isPlainObject(modifyResults?.option)) {
                            modifyResults = [modifyResults];
                        } else {
                            modifyResults = [{ result: result, option: option }];
                        }

                        for (let i = 0; i < modifyResults.length; i++) {
                            recStatus = _self._applyRecommendation(
                                modifyResults[i].result,
                                modifyResults[i].option
                            );
                        }
                    };

                    const modifyResponse = option.data.modify(result, option);
                    if ($.isFunction(option?.data?.modify?.constructor) &&
                        option.data.modify.constructor.name === "AsyncFunction" &&
                        window.Promise &&
                        modifyResponse instanceof window.Promise) {
                        modifyResponse
                            .then(handleModifyResult)
                            .catch(function (caughtError) {
                                Renderer._process(option?.process?.error, {
                                    code: -1,
                                    error: true,
                                    message: caughtError.message,
                                    name: caughtError.name,
                                    result: caughtError
                                });

                                if (option?.meta?.refreshParent) {
                                    Renderer._setRefreshState(option.meta.refreshParent, option, "refresh-error", {
                                        name: name,
                                        error: caughtError
                                    });
                                }

                                Renderer._process(option?.process?.finalize, option, result, null);
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
            }

            return {
                status: {
                    code: data.httpStatus,
                    message: data.responseText,
                    error: true
                }
            };
        },

        _handleRender: function (result, option, $container) {
            if ($.isPlainObject(result?.status) && result.status.code === 403) {
                return;
            }

            const renderOption = $.extend(true, {
                activity: {
                    type: defaultRenderOption.activity.renderType
                }
            }, defaultRenderOption, option);

            const settings = {
                isControl: $.isPlainObject(result?.splitTestData) &&
                    result.splitTestData.isControl === true,
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

            if (typeof window.$ === "function" &&
                typeof window.$.fn === "function" &&
                $ !== window.$) {
                window.$(document).trigger(eventName, data);
            }
        },

        _applyRecommendation: function (result, option) {
            const _self = this;

            if (result?.splitTestData?.isControl === true) {
                const $container = _self._setupControlContainer(option, result);

                if ($container !== null) {
                    this._applyBindings(option, $container);
                    Renderer._clearRefreshState($container, option, {
                        result: result,
                        reason: "control"
                    });
                } else if (option?.meta?.refreshParent) {
                    Renderer._clearRefreshState(option.meta.refreshParent, option, {
                        result: result,
                        reason: "control-no-container"
                    });
                }

                this._handleRender(result, option, $container);
                Renderer._process(option?.process?.finalize, option, result, $container);

                return "not-rendered-control";
            } else if (Renderer.refreshOptions !== null &&
                option?.meta?.optionsVersion !== Renderer.refreshOptions.optionsVersion) {
                Renderer._appendContainer(option, result, function ($container) {
                    if ($container === null) {
                        return;
                    }

                    let $itemContainer = $container.find("." + Renderer.marker.container);
                    if ($itemContainer.length === 0) {
                        $itemContainer = $container;
                    }

                    _self._setupContainer($itemContainer, option, result);
                });

                return "out-of-date";
            } else if (result?.status?.code === 7120) {
                if (option?.meta?.refreshParent) {
                    Renderer._clearRefreshState(option.meta.refreshParent, option, {
                        result: result,
                        reason: "ignored"
                    });
                }

                this._handleRender(result, option, null);
                Renderer._process(option?.process?.finalize, option, result, null);

                return "not-rendered-ignored";
            }

            this._renderRecommendation(option, result, function ($container) {
                if ($container === null) {
                    if (option?.meta?.refreshParent) {
                        Renderer._setRefreshState(option.meta.refreshParent, option, "refresh-error", {
                            result: result,
                            reason: "render-failed"
                        });
                    }

                    Renderer._process(option?.process?.finalize, option, result, null);
                    return;
                }

                _self._applyBindings(option, $container);
                Renderer._clearRefreshState($container, option, {
                    result: result,
                    reason: "rendered"
                });

                _self._handleRender(result, option, $container);
                Renderer._process(option?.process?.finalize, option, result, $container);
            });

            return "rendered";
        },

        _handleClick: function (option, $el, event, additionalEventData) {
            let $container = $el.closest("." + Renderer.marker.container);
            $container = $container.length === 1
                ? $container
                : $el.closest("[data-" + Renderer.marker.container + "=\"true\"]");

            const actualTarget = additionalEventData?.actualTarget;
            const $clickedEl = Breinify.UTL.dom.isNodeType(actualTarget, 1)
                ? $(actualTarget)
                : null;

            if ($container.length !== 1) {
                if ($clickedEl === null) {
                    return;
                }

                $container = $clickedEl.closest("." + Renderer.marker.container);
                $container = $container.length === 1
                    ? $container
                    : $clickedEl.closest("[data-" + Renderer.marker.container + "=\"true\"]");

                if ($container.length !== 1) {
                    return;
                }
            }

            const containerData = $container.data(Renderer.marker.data);
            if (!$.isPlainObject(containerData?.option) || !$.isPlainObject(containerData?.data)) {
                return;
            }

            const enhancedAdditionalEventData = $.extend(true, {}, additionalEventData, {
                semanticTarget: $el?.length === 1 ? $el.get(0) : null
            });

            const $itemEl = $clickedEl === null ? $el : $clickedEl;
            if (containerData.data?.splitTestData?.isControl === true) {
                this._handleControlClick(
                    event,
                    $itemEl,
                    $container,
                    containerData.data,
                    enhancedAdditionalEventData,
                    containerData.option
                );
            } else {
                this._handleRecommendationClick(
                    event,
                    $itemEl,
                    $container,
                    containerData.data,
                    enhancedAdditionalEventData,
                    containerData.option
                );
            }

            if (enhancedAdditionalEventData.stopPropagation === true) {
                event.stopPropagation();
                Renderer._process(
                    option?.process?.stoppedPropagation,
                    event,
                    $itemEl,
                    $container,
                    containerData.data,
                    enhancedAdditionalEventData,
                    containerData.option
                );
            }
        },

        _handleRecommendationClick: function (event, $el, $recContainer, recommendationData, additionalEventData, option) {
            let $recItem = $el.closest("." + Renderer.marker.item);

            if ($recItem.length !== 1) {
                const semanticTarget = additionalEventData?.semanticTarget;
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

            Renderer._process(option?.process?.clickedItem, event, settings);

            settings.activityTags = this.createClickedRecommendationTags(
                recommendationData,
                recommendation,
                additionalEventData
            );
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

            Renderer._process(option?.process?.clickedItem, event, settings);

            settings.activityTags = this._createDefaultTags(recommendationData, additionalEventData);

            const $recItem = $el.closest("." + Renderer.marker.item);
            const recommendation = $recItem.length === 1
                ? $recItem.data(Renderer.marker.data)
                : null;

            if ($.isPlainObject(recommendation)) {
                this._applyBreinifyTags(
                    settings.activityTags,
                    recommendationData,
                    recommendation,
                    additionalEventData
                );
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
                return;
            } else if (type === "com.brein.common.dto.CustomerAssetsDto") {
                activityTags.assetIds = [id];

                const name = Breinify.UTL.isNonEmptyString(
                    recommendation?.additionalData?.["assets::assetTitle"]
                );
                activityTags.assetNames = [name];
            } else if (type === "com.brein.common.dto.CustomerProductDto") {
                activityTags.productIds = [id];

                const name = Breinify.UTL.isNonEmptyString(
                    recommendation?.additionalData?.["product::productName"]
                );
                activityTags.productNames = [name];
            } else {
                activityTags.productIds = [id];
            }
        },

        _createDefaultTags: function (recommendationData, additionalEventData) {
            const defaultTags = {};

            const splitTestData = $.isPlainObject(recommendationData?.splitTestData)
                ? recommendationData.splitTestData
                : { active: false };

            let groupType;
            let group;

            if (splitTestData.active === false) {
                groupType = Renderer.splitTest.defaultGroupType;
                group = Renderer.splitTest.defaultGroup;
            } else if (splitTestData.isControl === true) {
                groupType = Renderer.splitTest.controlGroupType;
                group = typeof splitTestData.groupDecision === "string" && splitTestData.groupDecision.trim() !== ""
                    ? splitTestData.groupDecision
                    : Renderer.splitTest.defaultControlGroup;
            } else {
                groupType = Renderer.splitTest.testGroupType;
                group = typeof splitTestData.groupDecision === "string" && splitTestData.groupDecision.trim() !== ""
                    ? splitTestData.groupDecision
                    : Renderer.splitTest.defaultTestGroup;
            }

            const test = typeof splitTestData.testName === "string" && splitTestData.testName.trim() !== ""
                ? splitTestData.testName
                : null;
            const instance = typeof splitTestData.selectedInstance === "string" && splitTestData.selectedInstance.trim() !== ""
                ? splitTestData.selectedInstance
                : null;

            defaultTags.group = group;
            defaultTags.groupType = groupType;
            defaultTags.splitTest = test === null ? null : test + (instance === null ? "" : " (" + instance + ")");

            const recommendationPayload = $.isPlainObject(recommendationData?.payload)
                ? recommendationData.payload
                : {};

            const queryName = typeof recommendationPayload.queryName === "string" && recommendationPayload.queryName.trim() !== ""
                ? recommendationPayload.queryName
                : null;
            const recommenderName = typeof recommendationPayload.recommenderName === "string" && recommendationPayload.recommenderName.trim() !== ""
                ? recommendationPayload.recommenderName
                : null;

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
            const actualTarget = event?.data?.actualTarget ?? event?.target;

            const anchor = actualTarget instanceof HTMLAnchorElement
                ? actualTarget
                : actualTarget instanceof Element
                    ? actualTarget.closest("a")
                    : null;

            const openInNewTabByUser = event.metaKey === true ||
                event.ctrlKey === true ||
                event.shiftKey === true ||
                event.altKey === true ||
                event.which === 2 ||
                event.button === 1;

            const rawTarget = anchor instanceof HTMLAnchorElement
                ? anchor.getAttribute("target")
                : null;
            const normalizedTarget = typeof rawTarget === "string"
                ? rawTarget.trim().toLowerCase()
                : "";

            const openInNewTabByTarget = normalizedTarget !== "" &&
                normalizedTarget !== "_self" &&
                normalizedTarget !== "_top" &&
                normalizedTarget !== "_parent";

            const openInNewTab = openInNewTabByUser || openInNewTabByTarget;

            const rawHref = anchor instanceof HTMLAnchorElement
                ? anchor.getAttribute("href")
                : null;
            const href = typeof rawHref === "string" ? rawHref.trim() : "";
            const normalizedHref = href.toLowerCase();

            const hasDownloadAttribute = anchor instanceof HTMLAnchorElement &&
                anchor.hasAttribute("download");

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

            let activityType = Breinify.UTL.isNonEmptyString(option?.activity?.type);
            activityType = activityType === null ? option?.activity?.clickedType : activityType;

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

            Renderer._process(option?.process?.createActivity, event, settings);

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
                return;
            } else if (scheduleActivity === true) {
                Breinify.plugins.activities.scheduleDelayedActivity(
                    settings.activityUser,
                    settings.activityType,
                    settings.activityTags,
                    60000
                );
            } else {
                Breinify.plugins.activities.generic(
                    settings.activityType,
                    settings.activityUser,
                    settings.activityTags
                );
            }
        },

        _applyBindings: function (option, $container) {
            const _self = this;

            Breinify.UTL.dom.addClickObserver(
                option?.bindings?.selector,
                "clickedRecommendations",
                function (event, additionalEventData) {
                    let $el = $(this);

                    const nativeEvent = event.originalEvent || event;
                    const target = nativeEvent.composedPath
                        ? nativeEvent.composedPath()[0]
                        : nativeEvent.target;

                    if (target && typeof target.getRootNode === "function") {
                        const root = target.getRootNode();
                        if (root?.host) {
                            $el = $(root.host);
                        }
                    }

                    additionalEventData = additionalEventData || {};
                    additionalEventData.actualTarget = Breinify.UTL.dom.isNodeType(target, 1)
                        ? target
                        : (target?.parentElement || null);

                    _self._handleClick(option, $el, event, additionalEventData);
                }
            );

            const specificSelectors = option?.bindings?.specificSelectors;
            if ($.isPlainObject(specificSelectors) && $container !== null) {
                const keys = Object.keys(specificSelectors);

                for (let i = 0; i < keys.length; i++) {
                    const selector = keys[i];
                    const specificSelector = specificSelectors[selector];
                    const additionalEventData = $.isPlainObject(specificSelector)
                        ? specificSelector
                        : {};

                    $container.find(selector).on("click", function (event) {
                        _self._handleClick(option, $(this), event, additionalEventData);
                    });
                }
            }
        },

        _setupControlContainer: function (option, data) {
            const $controlContainer = Renderer._determineSelector(
                option?.splitTests?.control?.containerSelector
            );

            if ($controlContainer === null || $controlContainer.length === 0) {
                return null;
            }

            return this._setupContainer($controlContainer, option, data);
        },

        _setupContainer: function ($container, option, data) {
            if (!$container?.jquery || $container.length !== 1) {
                return null;
            }

            if (!$container.hasClass(Renderer.marker.container)) {
                $container.addClass(Renderer.marker.container);
            }

            return $container
                .attr("data-" + Renderer.marker.container, "true")
                .data(Renderer.marker.data, {
                    option: option,
                    data: data
                });
        },

        _renderRecommendation: function (option, data, cb) {
            const _self = this;

            Renderer._process(option?.process?.pre, data, option);

            Renderer._appendContainer(option, data, function ($container, settings) {
                if ($container === null || settings?.error === true) {
                    cb(null, settings);
                    return;
                }

                let $itemContainer = $container.find("." + Renderer.marker.container);
                if ($itemContainer.length === 0) {
                    $itemContainer = $container;
                }

                $itemContainer = _self._setupContainer($itemContainer, option, data);
                if ($itemContainer === null) {
                    cb(null, settings);
                    return;
                }

                Renderer._process(option?.process?.attachedContainer, $container, $itemContainer, data, option);

                if (settings.externalRendering === true) {
                    const itemSelection = $.isFunction(settings.itemSelection)
                        ? settings.itemSelection
                        : function ($resolvedItemContainer, idx) {
                            return $resolvedItemContainer.children().eq(idx);
                        };

                    $.each(data.recommendations, function (idx, recommendation) {
                        const $recItem = itemSelection($itemContainer, idx, recommendation);
                        if ($recItem?.jquery && $recItem.length === 1) {
                            Renderer._setupItemData($recItem, idx, recommendation);
                        }
                    });
                } else {
                    Renderer._appendItems($itemContainer, data, option);
                    Renderer._process(option?.process?.attached, $container, $itemContainer, data, option);
                }

                const $controlContainer = Renderer._determineSelector(
                    option?.splitTests?.control?.containerSelector
                );

                if ($controlContainer !== null &&
                    $controlContainer.length === 1 &&
                    $controlContainer.get(0) !== $container.get(0) &&
                    $controlContainer.find(".brrc-item").length === 0) {
                    $controlContainer.hide();
                }

                Renderer._process(option?.process?.post, $container, $itemContainer, data, option);
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
                } else if (!data || !$.isArray(data.results)) {
                    callback(new Error("Invalid response received."), data);
                } else {
                    const result = _self._mapResults(payloads, data.results);
                    callback(null, result);
                }
            });
        },

        _mapResult: function (payload, result) {
            const recommendationResult = {};

            this._determineSplitTestData(result, recommendationResult);
            if (!this._determineErrorResponse(result, recommendationResult)) {
                this._determineRecommendationData(result, recommendationResult);
            }

            this._determineAdditionalData(result, recommendationResult);
            this._determineMetaData(result, recommendationResult);

            let numRecommendations = null;
            if (typeof payload?.numRecommendations === "number" && payload.numRecommendations > 0) {
                numRecommendations = payload.numRecommendations;
            }

            let queryName = null;
            if (typeof payload?.recommendationQueryName === "string" &&
                payload.recommendationQueryName.trim() !== "") {
                queryName = payload.recommendationQueryName;
            }

            const recommenderName = Renderer._recommenderName(payload);
            const isForItems = $.isArray(payload?.recommendationForItems) &&
                payload.recommendationForItems.length > 0;

            recommendationResult.payload = {
                recommenderName: recommenderName,
                queryName: queryName,
                isForItems: isForItems,
                expectedNumberOfRecommendations: numRecommendations
            };

            return recommendationResult;
        },

        _mapResults: function (payloads, results) {
            const allRecommendationResults = {};

            for (let i = 0; i < results.length; i++) {
                const payload = i < payloads.length && $.isPlainObject(payloads[i])
                    ? payloads[i]
                    : {};
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

            if ($.isPlainObject(recommendationResponse?.additionalData?._breinMetaData) &&
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
            if ($.isPlainObject(recommendationResponse?.additionalData)) {
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
                const p = Renderer._createPayload(payloads[i], payloads[i]);
                const candidate = this._extractCandidateNameFromPayload(p);

                if (candidate !== null) {
                    candidates[candidate] = typeof candidates[candidate] === "number"
                        ? candidates[candidate] + 1
                        : 1;
                }
            }

            return candidates;
        },

        _extractCandidateNameFromPayload: function (payload) {
            return $.isPlainObject(payload) &&
            $.isArray(payload.namedRecommendations) &&
            payload.namedRecommendations.length === 1
                ? payload.namedRecommendations[0]
                : null;
        },

        _determineMetaData: function (recommendationResponse, result) {
            result.meta = {};
            result.meta.type = this._determineRecommendationType(recommendationResponse);
        },

        _determineSplitTestData: function (recommendationResponse, result) {
            if ($.isPlainObject(recommendationResponse?.additionalData?.splitTestData)) {
                result.splitTestData = $.extend({
                    active: true,
                    isTest: recommendationResponse.statusCode === 200,
                    isControl: recommendationResponse.statusCode === 7120
                }, recommendationResponse.additionalData.splitTestData);
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
            if (!$.isArray(recommendationResponse?.result)) {
                return [];
            }

            const mappedAssets = [];
            for (let i = 0; i < recommendationResponse.result.length; i++) {
                mappedAssets.push(this._mapAsset(recommendationResponse.result[i]));
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
            if (!$.isArray(recommendationResponse?.result)) {
                return [];
            }

            const mappedProducts = [];
            for (let i = 0; i < recommendationResponse.result.length; i++) {
                mappedProducts.push(this._mapProduct(recommendationResponse.result[i]));
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
            if (price === null) {
                price = this._getValue(product, "product::productPrice");
            }

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
            if (!$.isArray(recommendationResponse?.result)) {
                return [];
            }

            const mappedResults = [];
            for (let i = 0; i < recommendationResponse.result.length; i++) {
                const result = recommendationResponse.result[i];
                mappedResults.push({
                    _recommenderWeight: result.weight,
                    id: result.dataIdExternal,
                    additionalData: result.additionalData
                });
            }

            return mappedResults;
        },

        _getValue: function (entity, name) {
            const value = entity?.additionalData?.[name];
            return typeof value === "undefined" || value === null ? null : value;
        }
    };

    Breinify.plugins._add("recommendations", Recommendations);
})();