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
            item: 'brrc-item'
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

        _appendContainer: function (option, data) {
            var _self = this;

            // no position defined to append
            if (!$.isPlainObject(option) || !$.isPlainObject(option.position)) {
                return null;
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
                method = 'replace';
            }

            let $anchor = this._determineSelector(selector);
            if ($anchor === null) {
                return null;
            }

            let $container = this._determineSelector(option.templates.container);
            if ($container === null) {
                return null;
            }

            // replace values within the container before appending it
            _self._replacePlaceholders($container, data, option);
            $container
                .attr('data-' + this.marker.container, 'true')
                .data('recommendation', data);

            /*
             * Execute the method on the $anchor, for some reason the assignment to a variable of
             * $anchor[method] causes issues, thus we do it "twice".
             */
            if ($.isFunction($anchor[method])) {
                $anchor[method]($container);
            }

            return $container;
        },

        _appendItems: function ($container, result, option) {
            const _self = this;

            let $item = this._determineSelector(option.templates.item);
            if ($item === null) {
                return null;
            }

            $.each(result.recommendations, function (idx, recommendation) {
                let $recItem = _self._replacePlaceholders($item.clone(false), recommendation, option);
                $recItem
                    .addClass(_self.marker.item)
                    .attr('data-' + _self.marker.item, 'true')
                    .data('recommendation', recommendation);

                $container.append($recItem);
                Renderer._process(option.process.attachedItem, $container, $recItem, recommendation, option);
            });
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
            const regex = /%%([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*|[a-zA-Z][a-zA-Z0-9_-]*(?:::[a-zA-Z][a-zA-Z0-9_-]*)?)%%/g;
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
        bindings: {
            selector: 'a'
        },
        splitTests: {
            control: {
                itemSelector: null,
                containerSelector: null
            }
        },
        position: {
            before: null,
            after: null,
            prepend: null,
            append: null,
            replace: null
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
            error: function (error) {
                // ignore
            },
            init: function (option) {
                // nothing to initialize
            },
            pre: function (data, option) {
                // nothing to execute on pre
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
            clickedItem: function() {
                // nothing to execute after rendering is complete
            }
        }
    };

    const Recommendations = {

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
                    this._retrieveRecommendations(null, payloads, callback);
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

                if (!$.isPlainObject(result)) {
                    Renderer._process(option.process.error, {
                        code: -1,
                        error: true,
                        message: 'unexpected result-type received',
                        name: name,
                        result: result
                    });
                } else if (result.error === true) {
                    Renderer._process(option.process.error, $.extend({
                        name: name,
                        result: result
                    }, result.status));
                } else if (result.splitTestData.isControl === true) {
                    _self._applyBindings(option, result);
                } else {
                    _self._renderRecommendation(option, result);
                    _self._applyBindings(option, result);
                }
            });
        },

        _applyBindings: function (option, result) {

            /*
             * We register one general click handler, which will trigger on the defined selectors for this
             * recommendation settings (options).
             *
             * The system allows multiple handlers, but only one handler with the specified name. Thus, we
             * need to ensure that the name is unique for this specific recommender and allows to retrieve
             * the needed information.
             */
            Breinify.UTL.dom.addClickObserver(option.bindings.selector, 'clickedRecommendations', function(event, data) {

                // search for any element that would identify a recommendation click


                // Code to execute when any element is clicked
                console.log("Clicked element:", event.data, event.target, data);
            });

            if (result.splitTestData.isControl === true) {

                // we have a result from the "control" group, let's see what to do
                let itemSelector = option.splitTests.control.itemSelector;
                let containerSelector = option.splitTests.control.containerSelector;

            } else {

                // we have a result
            }
        },

        _renderRecommendation: function (option, data) {

            Renderer._process(option.process.pre, data, option);

            // append the container element
            let $container = Renderer._appendContainer(option, data);
            let $itemContainer = $container.find('.' + Renderer.marker.container);
            if ($itemContainer.length === 0) {
                $itemContainer = $container;
                $itemContainer.addClass(Renderer.marker.container);
            }

            // and append the children for each result
            Renderer._appendItems($itemContainer, data, option);
            Renderer._process(option.process.attached, $container, $itemContainer, data, option);

            // next we need to determine if we have to hide a control-group
            let $controlContainer = Renderer._determineSelector(option.splitTests.control.containerSelector);
            if ($controlContainer !== null) {
                $controlContainer.hide();
            }

            Renderer._process(option.process.post, $container, $itemContainer, data, option);
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

        _mapResults: function (payloads, results) {
            let allRecommendationResults = {};

            // let's map the responses to a more readable way
            for (let i = 0; i < results.length; i++) {
                let payload = i < payloads.length && $.isPlainObject(payloads[i]) ? payloads[i] : {};
                let result = results[i];

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

                // determine the name, we need the position of the payload as fallback
                let name = this._determineName(payload, i);

                let numRecommendations;
                if (typeof payload.numRecommendations === 'number' && payload.numRecommendations > 0) {
                    numRecommendations = payload.numRecommendations;
                } else {
                    numRecommendations = null;
                }

                // add some general information
                recommendationResult.payload = {
                    name: name,
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

        _determineRecommendationData: function (recommendationResponse, result) {

            let type = 'com.brein.common.dto.CustomerProductDto';
            if ($.isPlainObject(recommendationResponse) &&
                $.isPlainObject(recommendationResponse._breinMetaData) &&
                typeof recommendationResponse._breinMetaData.dataType === 'string' && recommendationResponse._breinMetaData.dataType.trim() !== '') {
                type = recommendationResponse._breinMetaData.dataType.trim();
            }

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
            /*
             * Data may be provided under recommendationResponse.additionalData._breinMetaData
             * currently we do not care about this data, other than to decide the mapper.
             */
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
            } else if (result.statusCode === 7120) {

                // we are in the control group, but do not have any split-test data (should not happen)
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