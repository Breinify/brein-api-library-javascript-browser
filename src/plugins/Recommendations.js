// noinspection JSUnresolvedReference

"use strict";

/**
 * This implementation allows the usage of simplified recommendations calls with
 * rendering options. It utilizes the internal recommendation call of the Breinify
 * Utility library (part of the core package) and enhances the possibilities
 * to render and track the activities associated to the rendered activity (ex.
 * clickedRecommendation).
 */
(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('recommendations')) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    const overload = Breinify.plugins._overload();

    const Renderer = {
        marker: {
            container: 'brrc-cont',
            item: 'brrc-item',
            data: 'recommendation'
        },
        splitTest: {
            defaultGroup: 'breinify',
            defaultGroupType: 'none',
            defaultTestGroup: 'breinify',
            defaultControlGroup: 'control',
            testGroupType: 'test',
            controlGroupType: 'control'
        },

        _process: function (func, ...args) {
            if ($.isFunction(func)) {
                func(...args);
                return true;
            } else {
                return false;
            }
        },

        _determineSelector: function (value) {
            if ($.isFunction(value)) {
                value = value();
            }

            if (typeof value === 'string') {
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
                    errorDescription: 'missing position',
                    externalRendering: false
                });
                return;
            }

            let method = null;
            let selector = null;
            if (option.position.before !== null) {
                selector = option.position.before;
                method = 'before';
            } else if (option.position.after !== null) {
                selector = option.position.after;
                method = 'after';
            } else if (option.position.append !== null) {
                selector = option.position.append;
                method = 'append';
            } else if (option.position.prepend !== null) {
                selector = option.position.prepend;
                method = 'prepend';
            } else if (option.position.replace !== null) {
                selector = option.position.replace;
                method = 'replaceWith';
            } else if (option.position.externalRender !== null) {
                this._applyExternalRender(option, data, function ($target) {
                    cb($target, {
                        error: false,
                        externalRendering: true
                    });
                });
                return;
            }

            const $anchor = this._determineSelector(selector);
            if ($anchor === null) {
                cb(null, {
                    error: true,
                    errorDescription: 'unable to find anchor',
                    externalRendering: false
                });
                return;
            }

            const $container = this._determineSelector(option.templates.container);
            if ($container === null) {
                cb(null, {
                    error: true,
                    errorDescription: 'unable to find container',
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
            if ($.isFunction($anchor[method])) {
                $anchor[method]($container);
                cb($container, {
                    error: false,
                    externalRendering: false
                });
            } else {
                cb(null, {
                    error: true,
                    errorDescription: 'unable to apply method to anchor',
                    externalRendering: false
                });
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

            let $item = this._determineSelector(option.templates.item);
            if ($item === null) {
                return null;
            }

            $.each(result.recommendations, function (idx, recommendation) {
                let $recItem = _self._replacePlaceholders($item.clone(false), recommendation, option);
                _self._setupItemData($recItem, idx, $.extend(true, {
                    widgetPosition: idx < 0 ? idx : idx + 1
                }, recommendation));

                $container.append($recItem);
                Renderer._process(option.process.attachedItem, $container, $recItem, recommendation, option);
            });
        },

        _isItem: function ($item) {
            return $item.closest('[data-' + Renderer.marker.container + '="true"]').length !== 1;
        },

        _setupItemData: function ($recItem, idx, data) {
            $recItem.addClass(this.marker.item)
                .attr('data-' + this.marker.item, 'true')
                .data(this.marker.data, data);
        },

        /**
         * Replaces all placeholders in text and attributes, the returned element is the same as
         * passed in under {@code $entry}.
         *
         * @param $entry the element to check for replacements
         * @param replacements the replacements to apply
         * @param option the defined options
         * @returns {*} the {@code $entry}, just for chaining purposes
         * @private
         */
        _replacePlaceholders: function ($entry, replacements, option) {
            const _self = this;

            // check the text
            $entry.contents().filter(function () {
                return this.nodeType === 3; // Node.TEXT_NODE
            }).each(function () {
                const $el = $(this);
                const replaced = _self._replace($el.text(), replacements, option);

                if (replaced !== null) {
                    $el.replaceWith(replaced);
                }
            });

            // check the attributes
            let attributes = $entry.get(0).attributes;
            $.each(attributes, function (idx, attribute) {
                const replaced = _self._replace(attribute.value, replacements, option);
                if (replaced === null) {
                    // do nothing
                } else if (attribute.name.startsWith('data-rename-')) {
                    $entry.removeAttr(attribute.name);
                    $entry.attr(attribute.name.replace('data-rename-', ''), replaced);
                } else {
                    $entry.attr(attribute.name, replaced);
                }
            });

            // check also each child
            $entry.children().each(function () {
                _self._replacePlaceholders($(this), replacements, option);
            });

            return $entry;
        },

        /**
         * Replaces any occurrences of %%...%% with the appropriate placeholder and returns
         * the modified text, will return {@code null} if no replacement took place.
         * @param value the value to replace
         * @param data the data to replace values from
         * @param option options to modify the behavior
         * @returns {string|null} the replaced value or {@code null} if no replacement took place
         * @private
         */
        _replace: function (value, data, option) {
            var _self = this;

            if (typeof value !== 'string' || value.trim() === '') {
                return null;
            }

            const replacements = {
                _counter: 0
            };
            const regex = /%%([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z](?:(?:::)?[a-zA-Z0-9_])*)*|[a-zA-Z][a-zA-Z0-9_-]*(?:::[a-zA-Z][a-zA-Z0-9_-]*)?)%%/g;
            const result = value.replace(regex, function (match, name) {
                let placeholderOption = option.placeholders[name];
                let hasPlaceholderOption = $.isFunction(placeholderOption) || typeof placeholderOption === 'string';
                let recValue = _self._readPath(name, data);
                let hasRecValue = typeof recValue !== 'undefined';

                // if we do not have any value
                let replacement;
                if (hasPlaceholderOption) {
                    if (typeof placeholderOption === 'string') {
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
            const paths = name.split('.');
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

    const defaultRenderOption = {
        recommender: null,
        activity: {
            type: 'clickedRecommendation'
        },
        bindings: {
            selector: 'a',
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
             * If used, it must be a function taking in
             */
            externalRender: null
        },
        placeholderSettings: {
            /**
             * Method to determine what to replace the placeholder with if nothing was resolved, i.e.,
             * if anything else did not resolve to a value.
             * @param placeholder the placeholder that could not be resolved
             * @returns {null|string} {@code null} if the placeholder should not be replaced,
             * otherwise a string (can be empty)
             */
            replaceWith: function (placeholder) {
                return '';
            }
        },
        placeholders: {
            'random::uuid': function () {
                return Breinify.UTL.uuid();
            },
            'marker::container': Renderer.marker.container,
            'marker::item': Renderer.marker.item
        },
        templates: {
            container: null,
            item: null
        },
        process: {
            stoppedPropagation: function (event) {
                // nothing to do by default when an event gets cancelled
            },
            error: function (error) {
                // ignore
            },
            init: function (option) {
                // nothing to initialize
            },
            pre: function (data, option) {
                // nothing to execute on pre
            },
            attachedContainer: function ($container, $itemContainer, data, option) {
                // nothing to do
            },
            attachedItem: function ($itemContainer, $item, data, option) {
                // nothing to execute after attachment
            },
            attached: function ($container, $itemContainer, data, option) {
                // nothing to execute after attachment
            },
            post: function ($container, $itemContainer, data, option) {
                // nothing to execute after rendering is complete
            },
            clickedItem: function (event, settings) {
                // nothing to execute after rendering is complete
            },
            createActivity: function (event, settings) {
                // nothing to do, the settings are good as they are
            }
        },
        data: {
            modify: function (result, option) {
                /*
                 * Nothing to do, by default we keep the result and option untouched.
                 * The method can be used to:
                 *  - split: return [{result: result, option: option}]
                 *  - change: return {result: modResult, option: option}
                 *  - do nothing: return null
                 */
                return null;
            }
        }
    };

    const Recommendations = {
        marker: $.extend(true, {}, Renderer.marker),

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

            overload.overload({
                'Object': function (renderOption) {
                    let option = $.extend(true, {}, defaultRenderOption, renderOption);

                    let $container = this._determineSelector(option.templates.container);
                    _self._setupContainer($container, option, {});
                    _self._applyBindings(option, $container);
                },
                'Object,Object': function (splitTestSettings, renderOption) {
                    let option = $.extend(true, {}, defaultRenderOption, renderOption);

                    _self._loadSplitTestSeparately(splitTestSettings, function (error, data) {

                        let recData;
                        if (error === null) {
                            recData = _self._mapResult({
                                additionalData: {
                                    splitTestData: data
                                },
                                statusCode: 200
                            });
                        } else {
                            const message = error instanceof Error ? error.message : null;
                            recData = _self._mapResult({
                                statusCode: 400,
                                message: error.message
                            });
                        }

                        let $container = _self._determineSelector(option.templates.container);
                        _self._setupContainer($container, option, recData);
                        _self._applyBindings(option, $container);
                    });
                }
            }, arguments, this);
        },

        /**
         * The render method is used to render the configured recommendations within the given user-interface.
         */
        render: function () {
            const _self = this;

            overload.overload({
                'Array': function (renderOptions) {

                    let namedRenderOptions = {};
                    let recommenderPayload = [];
                    for (let i = 0; i < renderOptions.length; i++) {
                        let options = this._preRenderRecommendations({
                            'temporary': renderOptions[i]
                        });
                        let recommenderOptions = options.temporary.recommender;

                        if (!$.isPlainObject(recommenderOptions) ||
                            !$.isPlainObject(recommenderOptions.payload) ||
                            !$.isArray(recommenderOptions.payload.namedRecommendations)) {

                            Renderer._process(options.process.error, {
                                code: -1,
                                error: true,
                                message: 'invalid payload for recommender defined for rendering process',
                                options: options
                            });
                            return;
                        }

                        let name = this._determineName(recommenderOptions.payload, i);
                        namedRenderOptions[name] = options.temporary;

                        recommenderPayload.push(recommenderOptions.payload);
                    }

                    this._retrieveRecommendations(recommenderPayload, function (error, data) {
                        _self._renderRecommendations(namedRenderOptions, error, data);
                    });
                },
                'Object': function (renderOptions) {
                    _self.render([renderOptions]);
                },
                'Object,Object': function (payload, renderOptions) {
                    let options = this._preRenderRecommendations(renderOptions);
                    this._retrieveRecommendations([payload], function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                },
                'Array,Object': function (payloads, renderOptions) {
                    let options = this._preRenderRecommendations(renderOptions);
                    this._retrieveRecommendations(null, payloads, function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                },
                'String,Object': function (recommendationId, renderOptions) {
                    let options = this._preRenderRecommendations(renderOptions);
                    this._retrieveRecommendations([{
                        namedRecommendations: [recommendationId]
                    }], function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                },
                'String,Object,Object': function (recommendationId, payload, renderOptions) {
                    let options = this._preRenderRecommendations(renderOptions);
                    this._retrieveRecommendations([$.extend({
                        namedRecommendations: [recommendationId]
                    }, payload)], function (error, data) {
                        _self._renderRecommendations(options, error, data);
                    });
                }
            }, arguments, this);
        },

        get: function () {
            overload.overload({
                'Object,Function': function (payload, callback) {
                    this._retrieveRecommendations([payload], callback);
                },
                'Array,Function': function (payloads, callback) {
                    this._retrieveRecommendations(payloads, callback);
                },
                'String,Function': function (recommendationId, callback) {
                    this._retrieveRecommendations([{
                        namedRecommendations: [recommendationId]
                    }], callback);
                },
                'String,Object,Function': function (recommendationId, payload, callback) {
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

        _loadSplitTestSeparately: function (splitTestSettings, cb) {

            // name, tokens, payload, storageKeys, cb, timing
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

        _preRenderRecommendations: function (renderOptions) {
            const options = {};
            $.each(renderOptions, function (name, renderOption) {
                let option = $.extend(true, {}, defaultRenderOption, renderOption);
                Renderer._process(option.process.init, option);

                options[name] = option;
            });

            return options;
        },

        _renderRecommendations: function (options, error, data) {
            const _self = this;

            // first check if we had any errors and if so, run the process and finalize
            if (error !== null) {

                // we fire each error method
                $.each(options, function (name, option) {

                    // TODO: maybe better error handling and into object
                    Renderer._process(option.process.error, error);
                });

                return;
            }

            // fire each named recommendation, with the option
            $.each(options, function (name, option) {
                let result = data[name];

                if (!$.isPlainObject(result) || !$.isPlainObject(result.status)) {
                    Renderer._process(option.process.error, {
                        code: -1,
                        error: true,
                        message: 'unexpected result-type received',
                        name: name,
                        result: result
                    });
                } else if (result.status.error === true) {
                    Renderer._process(option.process.error, $.extend({
                        name: name,
                        result: result
                    }, result.status));
                } else if ($.isFunction(option.data.modify)) {

                    // the method used in any case to handle the modified responses
                    const handleModifyResult = function (modifyResults) {
                        if ($.isArray(modifyResults)) {
                            // nothing to change
                        } else if ($.isPlainObject(modifyResults) &&
                            $.isPlainObject(modifyResults.result) &&
                            $.isPlainObject(modifyResults.option)) {
                            modifyResults = [modifyResults];
                        } else {
                            modifyResults = [{result: result, option: option}]
                        }

                        for (let i = 0; i < modifyResults.length; i++) {
                            const modifyResult = modifyResults[i];
                            _self._applyRecommendation(modifyResult.result, modifyResult.option);
                        }
                    }

                    // the result will be a promise
                    let modifyResponse = option.data.modify(result, option);
                    if ($.isFunction(option.data.modify.constructor) &&
                        option.data.modify.constructor.name === 'AsyncFunction' &&
                        window.Promise && modifyResponse instanceof window.Promise) {
                        modifyResponse
                            .then(result => handleModifyResult(result))
                            .catch(error => Renderer._process(option.process.error, {
                                code: -1,
                                error: true,
                                message: error.message,
                                name: error.name,
                                result: error
                            }));
                    } else {
                        handleModifyResult(modifyResponse);
                    }
                } else {
                    _self._applyRecommendation(result, option);
                }
            });
        },

        _applyRecommendation: function (result, option) {
            const _self = this;

            if (result.splitTestData.isControl === true) {
                const $container = _self._setupControlContainer(option, result);
                this._applyBindings(option, $container);
            } else if (result.status.code === 7120) {
                // the recommendation is supposed to be ignored, but there is no split-test
            } else {

                // we have a normal recommendation call
                this._renderRecommendation(option, result, function ($container) {
                    _self._applyBindings(option, $container);
                });
            }
        },

        _handleClick: function (option, $el, event, additionalEventData) {

            // search for the container
            const $container = $el.closest('.' + Renderer.marker.container);
            if ($container.length !== 1) {
                return;
            }

            const containerData = $container.data(Renderer.marker.data);
            if (!$.isPlainObject(containerData) ||
                !$.isPlainObject(containerData.option) ||
                !$.isPlainObject(containerData.data)) {
                return;
            }

            if (containerData.data.splitTestData.isControl === true) {
                this._handleControlClick(event, $el, $container, containerData.data, additionalEventData, containerData.option);
            } else {
                this._handleRecommendationClick(event, $el, $container, containerData.data, additionalEventData, containerData.option);
            }

            /*
             * It may be needed that the further propagation (especially for specific listeners)
             * should be stopped.
             */
            if (additionalEventData.stopPropagation === true) {
                event.stopPropagation();
                Renderer._process(option.process.stoppedPropagation, event, $el, $container,
                    containerData.data, additionalEventData, containerData.option);
            }
        },

        _handleRecommendationClick: function (event, $el, $recContainer, recommendationData, additionalEventData, option) {

            // search for any item-element that would identify a recommendation click
            const $recItem = $el.closest('.' + Renderer.marker.item);
            if ($recItem.length !== 1) {
                return;
            }

            const recommendation = $recItem.data(Renderer.marker.data);
            if (!$.isPlainObject(recommendation)) {
                return;
            }

            // Code to execute when any element is clicked
            const settings = {
                isControl: false,
                $recItem: $recItem,
                $recContainer: $recContainer,
                additionalEventData: additionalEventData,
                recommendationData: recommendationData,
                recommendation: recommendation
            };
            Renderer._process(option.process.clickedItem, event, settings);

            /*
             * Determine the default knowledge for the activity-tags at this point,
             * for Breinify a lot of knowledge can be applied already, additional
             * knowledge may be applied within the createActivity process.
             */
            const activityTags = this._createDefaultTags(recommendationData, additionalEventData);
            this._applyBreinifyTags(activityTags, recommendationData, recommendation, additionalEventData);

            settings.activityTags = activityTags;
            this._sendActivity(option, event, settings);
        },

        _handleControlClick: function (event, $el, $controlContainer, recommendationData, additionalEventData, option) {

            const settings = {
                isControl: true,
                $controlItem: $el,
                $controlContainer: $controlContainer,
                additionalEventData: additionalEventData,
                recommendationData: recommendationData
            };
            Renderer._process(option.process.clickedItem, event, settings);

            /*
             * Determine the default knowledge for the activity-tags at this point,
             * for control knowledge outside the framework must be applied via the
             * createActivity process.
             */
            settings.activityTags = this._createDefaultTags(recommendationData, additionalEventData);
            this._sendActivity(option, event, settings);
        },

        _applyBreinifyTags: function (activityTags, recommendationData, recommendation, additionalEventData) {

            // set the widgetPosition and the type (if possible)
            if (typeof recommendation.widgetPosition === 'number') {
                activityTags.widgetPosition = recommendation.widgetPosition;

                if (typeof activityTags.widgetType === 'string') {
                    activityTags.widgetId = activityTags.widgetType + '-' + activityTags.widgetPosition;
                }
            }

            activityTags.productIds = [];
            if (typeof recommendation.id === 'string') {
                activityTags.productIds.push(recommendation.id);
            }
        },

        _createDefaultTags: function (recommendationData, additionalEventData) {
            const defaultTags = {};

            // get the data for the split-test (should always be there), but just in case
            const splitTestData = $.isPlainObject(recommendationData.splitTestData) ? recommendationData.splitTestData : {
                active: false
            };

            /*
             * Determine the group from the split-test, if there is no active split-test,
             * i.e., there was no split-test information passed, we always name the group
             * breinify (for simplicity reason).
             */
            let groupType, group;
            if (splitTestData.active === false) {
                groupType = Renderer.splitTest.defaultGroupType;
                group = Renderer.splitTest.defaultGroup;
            } else if (splitTestData.isControl === true) {
                groupType = Renderer.splitTest.controlGroupType;
                group = typeof splitTestData.groupDecision === 'string' && splitTestData.groupDecision.trim() !== '' ? splitTestData.groupDecision : Renderer.splitTest.defaultControlGroup;
            } else {
                groupType = Renderer.splitTest.testGroupType;
                group = typeof splitTestData.groupDecision === 'string' && splitTestData.groupDecision.trim() !== '' ? splitTestData.groupDecision : Renderer.splitTest.defaultTestGroup;
            }

            const test = typeof splitTestData.testName === 'string' && splitTestData.testName.trim() !== '' ? splitTestData.testName : null;
            const instance = typeof splitTestData.selectedInstance === 'string' && splitTestData.selectedInstance.trim() !== '' ? splitTestData.selectedInstance : null;

            defaultTags.group = group;
            defaultTags.groupType = groupType;
            defaultTags.splitTest = test === null ? null : test + (instance === null ? '' : ' (' + instance + ')');

            // add some information of the recommender that was used
            const recommendationPayload = $.isPlainObject(recommendationData.payload) ? recommendationData.payload : {};

            const queryName = typeof recommendationPayload.queryName === 'string' && recommendationPayload.queryName.trim() !== '' ? recommendationPayload.queryName : null;
            const recommenderName = typeof recommendationPayload.recommenderName === 'string' && recommendationPayload.recommenderName.trim() !== '' ? recommendationPayload.recommenderName : null;

            /*
             * We set the widget information we have at this point, widget position
             * and id must be determined separately from the clicked item.
             */
            defaultTags.widgetType = recommenderName;
            defaultTags.widgetLabel = queryName === null ? recommenderName : queryName;

            return defaultTags;
        },

        _sendActivity: function (option, event, settings) {

            /*
               * Determine if the event had some key held to open in a new tab, if so we can
               * sent the activity directly from the current tab. If not we need to schedule
               * the activity sent.
               */
            const openInNewTab = event.metaKey || event.ctrlKey || event.which === 2;
            const willReloadPage = event.target instanceof HTMLAnchorElement;
            const activityType = option.activity.type;

            settings = $.extend(true, {
                additionalEventData: {
                    meta: {
                        openInNewTab: openInNewTab,
                        willReloadPage: willReloadPage,
                    },
                    sendActivities: true,
                    scheduleActivities: null
                },
                activityType: activityType,
                activityTags: {},
                activityUser: {}
            }, settings);

            // trigger the creation activity process to ensure that we can modify the activity to be  sent
            Renderer._process(option.process.createActivity, event, settings);

            /*
             * Check if the activity is still supposed to be sent out, this would mean something "incorrect"
             * was handled, and we just stop the sending completely.
             */
            if (settings.additionalEventData.sendActivities === false) {
                return;
            }

            /*
             * After this step we may have some new information set (via the createActivity listener), so
             * let's reevaluate if we have the widgetPosition, but not a widgetId
             */
            if (typeof settings.activityTags.widgetPosition === 'number' &&
                typeof settings.activityTags.widgetType === 'string' &&
                typeof settings.activityTags.widgetId !== 'string') {
                settings.activityTags.widgetId = settings.activityTags.widgetType + '-' + settings.activityTags.widgetPosition;
            }

            // decide to schedule or not
            let scheduleActivity = null;
            if (settings.additionalEventData.scheduleActivities === null) {
                if (willReloadPage === false) {
                    scheduleActivity = false;
                } else {
                    scheduleActivity = openInNewTab !== true;
                }
            } else if (typeof settings.additionalEventData.scheduleActivities === 'boolean') {
                scheduleActivity = settings.additionalEventData.scheduleActivities;
            }

            if (!$.isPlainObject(Breinify.plugins.activities)) {
                // activities is not available
            } else if (scheduleActivity === true) {
                Breinify.plugins.activities.scheduleDelayedActivity(settings.activityUser, settings.activityType, settings.activityTags, 60000);
            } else if (scheduleActivity === false) {
                Breinify.plugins.activities.generic(settings.activityType, settings.activityUser, settings.activityTags);
            }
        },

        _applyBindings: function (option, $container) {
            const _self = this;

            /*
             * We register one general click handler, which will trigger on the defined selectors for this
             * recommendation settings (option).
             *
             * The system allows multiple handlers, but only one handler with the specified name. Thus, we
             * need to ensure that the name is unique for this specific recommender and allows to retrieve
             * the needed information.
             */
            Breinify.UTL.dom.addClickObserver(option.bindings.selector, 'clickedRecommendations', function (event, additionalEventData) {
                _self._handleClick(option, $(this), event, additionalEventData);
            });

            /*
             * We allow more strict observers (on specific elements as well). This should be only a last resort,
             * but is sometimes needed.
             */
            const specificSelectors = option.bindings.specificSelectors;
            if ($.isPlainObject(specificSelectors) && $container !== null) {
                const keys = Object.keys(specificSelectors);
                for (let i = 0; i < keys.length; i++) {
                    const selector = keys[i];
                    const specificSelector = specificSelectors[selector];
                    const additionalEventData = $.isPlainObject(specificSelector) ? specificSelector : {};

                    $container.find(selector).on('click', function (event) {
                        _self._handleClick(option, $(this), event, additionalEventData);
                    });
                }
            }
        },

        _setupControlContainer: function (option, data) {
            const $controlContainer = Renderer._determineSelector(option.splitTests.control.containerSelector);
            if ($controlContainer === null) {
                return null;
            }

            // attach the data of the recommendation response to the container
            return this._setupContainer($controlContainer, option, data);
        },

        _setupContainer: function ($container, option, data) {

            // check if the container is already marker
            if (!$container.hasClass(Renderer.marker.container)) {
                $container.addClass(Renderer.marker.container);
            }

            // add the additional data to the container
            return $container
                .attr('data-' + Renderer.marker.container, 'true')
                .data(Renderer.marker.data, {
                    option: option,
                    data: data
                });
        },

        _renderRecommendation: function (option, data, cb) {
            const _self = this;

            Renderer._process(option.process.pre, data, option);

            // append the container element
            Renderer._appendContainer(option, data, function ($container, settings) {

                if ($container === null || settings.error === true) {
                    cb(null, settings);
                    return;
                }

                let $itemContainer = $container.find('.' + Renderer.marker.container);
                if ($itemContainer.length === 0) {
                    $itemContainer = $container;

                    // add the class (it was obviously not there yet)
                    $itemContainer.addClass(Renderer.marker.container);
                }

                // store the info needed for clicks on the item's container
                $itemContainer = _self._setupContainer($itemContainer, option, data);
                Renderer._process(option.process.attachedContainer, $container, $itemContainer, data, option)

                // if a third party is rendering, apply the data to the rendered elements
                if (settings.externalRendering === true) {

                    $.each(data.recommendations, function (idx, recommendation) {
                        let $recItem = $itemContainer.children().eq(idx);
                        Renderer._setupItemData($recItem, idx, $.extend(true, {
                            widgetPosition: idx < 0 ? idx : idx + 1
                        }, recommendation));
                    });
                }
                // if we are rendering append the children for each result
                else {
                    Renderer._appendItems($itemContainer, data, option);
                    Renderer._process(option.process.attached, $container, $itemContainer, data, option);
                }

                // next we need to determine if we have to hide a control-group
                const $controlContainer = Renderer._determineSelector(option.splitTests.control.containerSelector);

                // we only hide if the control-container is not the same as the container (avoid a misconfiguration)
                if ($controlContainer !== null &&
                    $controlContainer.length === 1 &&
                    $controlContainer.get(0) !== $container.get(0) &&
                    $controlContainer.find('.brrc-item').length === 0) {
                    $controlContainer.hide();
                }

                Renderer._process(option.process.post, $container, $itemContainer, data, option);
                cb($container, settings);
            });
        },

        _retrieveRecommendations: function (payloads, callback) {
            const _self = this;

            // use the default endpoint
            Breinify.recommendation({}, payloads, function (data, errorText) {
                if (typeof errorText === 'string') {
                    callback(new Error(errorText));
                } else if (!$.isArray(data.results)) {
                    callback(new Error('Invalid response received.'));
                } else {
                    let result = _self._mapResults(payloads, data.results);
                    callback(null, result);
                }
            });
        },

        _mapResult: function (result) {
            let recommendationResult = {};

            if (this._determineErrorResponse(result, recommendationResult)) {
                // nothing to do, the error-data was written
            } else if (this._determineSplitTestData(result, recommendationResult)) {
                // nothing to do, the split-test-data was written
            } else {
                this._determineRecommendationData(result, recommendationResult);
            }

            this._determineAdditionalData(result, recommendationResult);
            this._determineMetaData(result, recommendationResult);

            return recommendationResult;
        },

        _mapResults: function (payloads, results) {
            let allRecommendationResults = {};

            // let's map the responses to a more readable way
            for (let i = 0; i < results.length; i++) {
                const payload = i < payloads.length && $.isPlainObject(payloads[i]) ? payloads[i] : {};
                const result = results[i];
                const recommendationResult = this._mapResult(result);

                // determine the name, we need the position of the payload as fallback
                const name = this._determineName(payload, i);

                let numRecommendations = null;
                if (typeof payload.numRecommendations === 'number' && payload.numRecommendations > 0) {
                    numRecommendations = payload.numRecommendations;
                }

                let queryName = null;
                if (typeof payload.recommendationQueryName === 'string' && payload.recommendationQueryName.trim() !== '') {
                    queryName = payload.recommendationQueryName;
                }

                let recommenderName = null;
                if ($.isPlainObject(payload) &&
                    $.isArray(payload.namedRecommendations) &&
                    payload.namedRecommendations.length === 1) {
                    recommenderName = payload.namedRecommendations[0];
                }

                const isForItems = $.isArray(payload.recommendationForItems) && payload.recommendationForItems.length > 0;

                // add some general information
                recommendationResult.payload = {
                    name: name,
                    recommenderName: recommenderName,
                    queryName: queryName,
                    isForItems: isForItems,
                    expectedNumberOfRecommendations: numRecommendations
                };
                allRecommendationResults[name] = recommendationResult;
            }

            return allRecommendationResults;
        },

        _determineErrorResponse: function (recommendationResponse, result) {

            if (!$.isPlainObject(recommendationResponse)) {
                result.status = {
                    error: true,
                    code: 500,
                    message: 'invalid result type received'
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
            let type = 'com.brein.common.dto.CustomerProductDto';
            if ($.isPlainObject(recommendationResponse) &&
                $.isPlainObject(recommendationResponse._breinMetaData) &&
                typeof recommendationResponse._breinMetaData.dataType === 'string' && recommendationResponse._breinMetaData.dataType.trim() !== '') {
                type = recommendationResponse._breinMetaData.dataType.trim();
            }

            return type;
        },

        _determineRecommendationData: function (recommendationResponse, result) {
            const type = this._determineRecommendationType(recommendationResponse);

            if (type === 'com.brein.common.dto.CustomerProductDto') {
                result.recommendations = this._mapProducts(recommendationResponse);
            } else {
                result.recommendations = this._mapAny(recommendationResponse);
            }
        },

        _determineAdditionalData: function (recommendationResponse, result) {

            /*
             * Data may be provided under recommendationResponse.additionalData
             * excluding known attributes like (_breinMetaData, splitTestData)..
             */
            if ($.isPlainObject(recommendationResponse) &&
                $.isPlainObject(recommendationResponse.additionalData)) {

                result.additionalData = {};
                $.each(recommendationResponse.additionalData, function (name, val) {
                    if (name === '_breinMetaData' || name === 'splitTestData') {
                        return;
                    }

                    result.additionalData[name] = val;
                });
            }
        },

        _determineName: function (payload, idx) {
            if ($.isPlainObject(payload) &&
                $.isArray(payload.namedRecommendations) &&
                payload.namedRecommendations.length === 1) {
                return payload.namedRecommendations[0];
            } else {
                return 'response[' + idx + ']';
            }
        },

        _determineMetaData: function (recommendationResponse, result) {

            // data may be provided under recommendationResponse.additionalData._breinMetaData
            result.meta = {};

            // we keep the type for further processing (ex. activity mapping)
            result.meta.type = this._determineRecommendationType(recommendationResponse);
        },

        _determineSplitTestData: function (recommendationResponse, result) {

            // first read if we have split-test data
            if ($.isPlainObject(recommendationResponse) &&
                $.isPlainObject(recommendationResponse.additionalData) &&
                $.isPlainObject(recommendationResponse.additionalData.splitTestData)) {

                result.splitTestData = $.extend({
                    active: true,
                    isTest: recommendationResponse.statusCode === 200,
                    isControl: recommendationResponse.statusCode === 7120
                }, recommendationResponse.additionalData.splitTestData);
            } else if (recommendationResponse.statusCode === 7120) {

                // we are in the control group, but do not have any split-test data
                result.splitTestData = {
                    active: true,
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

            return result.active;
        },

        _mapProducts: function (recommendationResponse) {
            if (!$.isArray(recommendationResponse.result)) {
                return [];
            }

            let mappedProducts = [];
            for (var i = 0; i < recommendationResponse.result.length; i++) {
                let product = recommendationResponse.result[i];
                let mappedProduct = this._mapProduct(product);

                mappedProducts.push(mappedProduct);
            }

            return mappedProducts;
        },

        _mapProduct: function (product) {
            if (!$.isPlainObject(product) || typeof product.dataIdExternal !== 'string') {
                return null;
            } else if (!$.isPlainObject(product.additionalData)) {
                return null;
            }

            // price can be in inventory or product
            let price = this._getValue(product, 'inventory::productPrice');
            price = price === null ? this._getValue(product, 'product::productPrice') : price;

            return {
                '_recommenderWeight': product.weight,
                'id': product.dataIdExternal,
                'inventory': this._getValue(product, 'inventory::inventoryQuantity'),
                'name': this._getValue(product, 'product::productName'),
                'url': this._getValue(product, 'product::productUrl'),
                'image': this._getValue(product, 'product::productImageUrl'),
                'categories': this._getValue(product, 'product::productCategories'),
                'description': this._getValue(product, 'product::productDescription'),
                'price': price,
                'additionalData': product.additionalData
            };
        },

        _mapAny: function (recommendationResponse) {
            if (!$.isArray(recommendationResponse.result)) {
                return [];
            }

            let mappedResults = [];
            for (var i = 0; i < recommendationResponse.result.length; i++) {
                let result = recommendationResponse.result[i];
                let mappedResult = {
                    '_recommenderWeight': result.weight,
                    'id': result.dataIdExternal,
                    'additionalData': result.additionalData
                };

                mappedResults.push(mappedResult);
            }

            return mappedResults;
        },

        _getValue: function (product, name) {
            let value = product.additionalData[name];
            return typeof value === 'undefined' || value === null ? null : value;
        }
    };

    // bind the module
    Breinify.plugins._add('recommendations', Recommendations);
})();