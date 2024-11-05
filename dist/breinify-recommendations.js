"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('recommendations')) {
        return;
    }

    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var Recommendations = {

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

        _retrieveRecommendations: function (payloads, callback) {
            var _self = this;

            // use the default endpoint
            Breinify.recommendation({}, payloads, function (data, errorText) {
                console.log(data);

                if (typeof errorText === 'string') {
                    callback(new Error(errorText));
                } else if (!$.isArray(data.results)) {
                    callback(new Error('Invalid response received.'));
                } else {
                    var result = _self._mapResults(payloads, data.results);
                    callback(null, result);
                }
            });
        },

        _mapResults: function (payloads, results) {
            var allRecommendationResults = {};

            // let's map the responses to a more readable way
            for (var i = 0; i < results.length; i++) {
                var payload = i < payloads.length && $.isPlainObject(payloads[i]) ? payloads[i] : {};
                var result = results[i];

                var recommendationResult = {};
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
                var name;
                if ($.isArray(payload.namedRecommendations) && payload.namedRecommendations.length === 1) {
                    name = payload.namedRecommendations[0];
                } else {
                    name = 'response[' + i + ']';
                }

                var numRecommendations;
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

            var type = 'com.brein.common.dto.CustomerProductDto';
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

            var mappedProducts = [];
            for (var i = 0; i < recommendationResponse.result.length; i++) {
                var product = recommendationResponse.result[i];
                var mappedProduct = this._mapProduct(product);

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
            var price = this._getValue(product, 'inventory::productPrice');
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

            var mappedResults = [];
            for (var i = 0; i < recommendationResponse.result.length; i++) {
                var result = recommendationResponse.result[i];
                var mappedResult = {
                    '_recommenderWeight': result.weight,
                    'id': result.dataIdExternal,
                    'additionalData': result.additionalData
                };

                mappedResults.push(mappedResult);
            }

            return mappedResults;
        },

        _getValue: function (product, name) {
            var value = product.additionalData[name];
            return typeof value === 'undefined' || value === null ? null : value;
        }
    };

    // bind the module
    Breinify.plugins._add('recommendations', Recommendations);
})();