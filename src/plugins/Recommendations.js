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

                // determine the name
                var name;
                if ($.isArray(payload.namedRecommendations) && payload.namedRecommendations.length === 1) {
                    name = payload.namedRecommendations[0];
                } else {
                    name = 'response[' + i + ']';
                }

                this._determineMetaData(result, recommendationResult);
                allRecommendationResults[name] = recommendationResult;
            }

            return allRecommendationResults;
        },

        _determineErrorResponse: function (recommendationResponse, result) {

            if (!$.isPlainObject(result)) {
                result.status = {
                    error: true,
                    code: 500,
                    description: 'invalid result type received'
                };

                return true;
            } else if (result.statusCode === 200 || result.statusCode === 7120) {
                result.status = {
                    code: result.statusCode,
                    error: false
                };
            } else {
                result.status = {
                    error: true,
                    code: result.statusCode
                };
            }

            return result.status.error;
        },

        _determineRecommendationData: function (recommendationResponse, result) {

        },

        _determineMetaData: function (recommendationResponse, result) {

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

        _mapProduct: function (product, payloadId, additionalData) {
            if (!$.isPlainObject(product) || typeof product.dataIdExternal !== 'string') {
                return null;
            } else if (!$.isPlainObject(product.additionalData)) {
                return null;
            }

            var mapProduct = this.getConfig('mapProduct', function (product, additionalData) {
                return {
                    'dataIdExternal': product.dataIdExternal,
                    'sku': product.dataIdExternal,
                    'inventory': product.additionalData['inventory::inventoryQuantity'],
                    'price': product.additionalData['inventory::productPrice'],
                    'name': product.additionalData['product::productName'],
                    'url': product.additionalData['product::productUrl'],
                    'image': product.additionalData['product::productImageUrl'],
                    'description': product.additionalData['product::productDescription'],
                    'additionalData': additionalData
                };
            });

            return mapProduct(product, payloadId, additionalData);
        }
    };

    // bind the module
    Breinify.plugins._add('recommendations', Recommendations);
})();