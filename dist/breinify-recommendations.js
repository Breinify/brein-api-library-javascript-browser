"use strict";

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

    const defaultRenderOption = {
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
        defaults: {},
        templates: {
            container: null,
            item: null
        },
        process: {
            error: function (error) {
                // ignore
            },
            init: function (payload) {
                // nothing to initialize
            },
            pre: function (data) {
                // nothing to execute on pre
            },
            attached: function (data, $container) {
                // nothing to execute after attachment
            },
            post: function (data) {
                // nothing to execute after rendering is complete
            }
        }
    };

    const Renderer = {
        _process: function (func, ...args) {
            if ($.isFunction(func)) {
                func(args);
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

        _appendContainer: function (options) {

            // no position defined to append
            if (!$.isPlainObject(options) || !$.isPlainObject(options.position)) {
                return null;
            }

            let method = null;
            let selector = null;
            if (options.position.before !== null) {
                selector = options.position.before;
                method = 'before';
            } else if (options.position.after !== null) {
                selector = options.position.after;
                method = 'after';
            } else if (options.position.append !== null) {
                selector = options.position.append;
                method = 'append';
            } else if (options.position.prepend !== null) {
                selector = options.position.prepend;
                method = 'prepend';
            } else if (options.position.replace !== null) {
                selector = options.position.replace;
                method = 'replace';
            }

            selector = this._determineSelector(selector);
            if (selector === null) {
                return null;
            }

            let container = this._determineSelector(options.templates.container);
            if (container === null) {
                return null;
            }

            if ($.isFunction(selector[method])) {
                selector[method](container);
            }

            return container;
        },

        _appendItems: function ($container, result, options) {

            let $item = this._determineSelector(options.templates.item);
            if ($item === null) {
                return null;
            }


            $item.clone();
        }
    };

    const Recommendations = {

        render: function () {
            const _self = this;

            overload.overload({
                'Object,Object': function (payload, renderOptions) {
                    renderOptions = this._preRenderRecommendations(renderOptions);
                    this._retrieveRecommendations([payload], function (error, data) {
                        _self._renderRecommendations(renderOptions, error, data);
                    });
                },
                'Array,Object': function (payloads, renderOptions) {
                    renderOptions = this._preRenderRecommendations(renderOptions);
                    this._retrieveRecommendations(null, payloads, function (error, data) {
                        _self._renderRecommendations(renderOptions, error, data);
                    });
                },
                'String,Object': function (recommendationId, renderOptions) {
                    renderOptions = this._preRenderRecommendations(renderOptions);
                    this._retrieveRecommendations([{
                        namedRecommendations: [recommendationId]
                    }], function (error, data) {
                        _self._renderRecommendations(renderOptions, error, data);
                    });
                },
                'String,Object,Object': function (recommendationId, payload, renderOptions) {
                    renderOptions = this._preRenderRecommendations(renderOptions);
                    this._retrieveRecommendations([$.extend({
                        namedRecommendations: [recommendationId]
                    }, payload)], function (error, data) {
                        _self._renderRecommendations(renderOptions, error, data);
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
                Renderer._process(option.process.init);

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
                    Renderer._process(option.process.error, error);
                });

                return;
            }

            // fire each named recommendation, with the option
            $.each(options, function (name, option) {
                let result = data[name];
                _self._renderRecommendation(option, result);
            });
        },

        _renderRecommendation: function (option, data) {

            Renderer._process(option.process.pre, data);

            // append the container element
            let $container = Renderer._appendContainer(option);

            // and append the children for each result
            Renderer._appendItems($container, data, option);

            Renderer._process(option.process.attached, data);

            Renderer._process(option.process.post, data);
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
            for (var i = 0; i < results.length; i++) {
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

                // determine the name
                let name;
                if ($.isArray(payload.namedRecommendations) && payload.namedRecommendations.length === 1) {
                    name = payload.namedRecommendations[0];
                } else {
                    name = 'response[' + i + ']';
                }

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