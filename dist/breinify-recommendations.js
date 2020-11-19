"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }

    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var prefixValidation = Breinify.UTL.constants.errors.prefix.validation;
    var prefixApi = Breinify.UTL.constants.errors.prefix.api;

    var Recommendations = {

        get: function () {
            var _self = this;

            overload.overload({
                'String,Number,Function': function (recommendationId, amount, callback) {
                    this._retrieveRecommendations([recommendationId], {}, amount, {}, callback);
                },
                'Array,Number,Function': function (recommendationIds, amount, callback) {
                    this._retrieveRecommendations(recommendationIds, {}, amount, {}, callback);
                },
                'String,Number,Object,Function': function (recommendationId, amount, tags, callback) {
                    this._retrieveRecommendations([recommendationId], {}, amount, tags, callback);
                },
                'Array,Number,Object,Function': function (recommendationIds, amount, tags, callback) {
                    this._retrieveRecommendations(recommendationIds, {}, amount, tags, callback);
                },
                'String,Object,Number,Function': function (recommendationId, user, amount, callback) {
                    this._retrieveRecommendations([recommendationId], user, amount, {}, callback);
                },
                'Array,Object,Number,Function': function (recommendationIds, user, amount, callback) {
                    this._retrieveRecommendations(recommendationIds, user, amount, {}, callback);
                },
                'String,Object,Number,Object,Function': function (recommendationId, user, amount, tags, callback) {
                    this._retrieveRecommendations([recommendationId], user, amount, tags, callback);
                },
                'Array,Object,Number,Object,Function': function (recommendationIds, user, amount, tags, callback) {
                    this._retrieveRecommendations(recommendationIds, user, amount, tags, callback);
                }
            }, arguments, this);
        },

        _retrieveRecommendations: function (recommendationIds, user, amount, tags, callback) {
            var _self = this;

            var createUser = this._createUser(user, tags);
            var recommendations = this._createRecommendations(recommendationIds, amount);

            if (!$.isPlainObject(recommendations) || !$.isArray(recommendations.payload) || recommendations.payload.length === 0) {
                callback(null, {});
                return;
            }

            // use the default endpoint
            Breinify.recommendation(createUser, recommendations.payload, function (data, errorText) {
                if (typeof errorText === 'string') {
                    callback(new Error(errorText));
                } else if (!$.isArray(data.results)) {
                    callback(new Error('Invalid response received.'));
                } else {
                    var result = _self._mapResults(recommendations, data.results);
                    result = _self._applyRecommendationSettings(amount, recommendations, result);
                    callback(null, result);
                }
            });
        },

        _getSettings: function (recommendationId) {
            var recommendationSettings = this.getConfig('recommendationSettings', {});
            var recommendationSetting = recommendationSettings[recommendationId];

            return $.isPlainObject(recommendationSetting) ? recommendationSetting : {};
        },

        _getPayload: function (payloadId) {
            var recommendationPayloads = this.getConfig('recommendationPayloads', {});
            var recommendationPayload = recommendationPayloads[payloadId];

            return $.isPlainObject(recommendationPayload) ? recommendationPayload : {};
        },

        _applyRecommendationSettings: function (amount, recommendations, results) {
            var appliedResult = {};
            var usedProducts = [];

            for (var i = 0; i < recommendations.recommendationIds.length; i++) {
                var recommendationId = recommendations.recommendationIds[i];
                var recommendationSetting = this._getSettings(recommendationId);
                var recommendationFilter = recommendationSetting.filter;
                var removeDuplicates = typeof recommendationSetting.removeDuplicates === 'boolean' ? recommendationSetting.removeDuplicates : true;
                var recommendationPayloadIds = $.isArray(recommendationSetting.recommendationPayloadId) ? recommendationSetting.recommendationPayloadId : [recommendationSetting.recommendationPayloadId];

                var nestedUsedProducts = [];
                var result = [];
                for (var j = 0; j < recommendationPayloadIds.length && result.length < amount; j++) {
                    var recResults = results[recommendationPayloadIds[j]];
                    var payloadResult = this._applyRecommendationPayload(recResults, recommendationFilter, nestedUsedProducts);

                    // remove the generally used products (if duplicates should be removed
                    if (removeDuplicates) {
                        payloadResult = this._removeUsedProducts(usedProducts, payloadResult);
                    }

                    result = result
                        .concat(payloadResult)
                        .slice(0, amount);
                }

                // add the products to the once used
                for (var k = 0; k < result.length; k++) {
                    usedProducts.push(result[k].dataIdExternal);
                }

                appliedResult[recommendationId] = result;
            }

            return appliedResult;
        },

        _applyRecommendationPayload: function (result, recFilter, usedProducts) {
            if (!$.isArray(result)) {
                return [];
            }

            // remove duplicates
            result = this._removeUsedProducts(usedProducts, result);

            // apply the filter and amount
            if ($.isFunction(recFilter)) {
                result = recFilter(result);
            }

            // add the used products
            for (var k = 0; k < result.length; k++) {
                usedProducts.push(result[k].dataIdExternal);
            }

            return result;
        },

        _removeUsedProducts: function (usedProducts, products) {
            if (!$.isArray(products)) {
                return [];
            }

            var filteredProducts = [];
            for (var i = 0; i < products.length; i++) {
                var product = products[i];
                if ($.inArray(product.dataIdExternal, usedProducts) === -1) {
                    filteredProducts.push(product);
                }
            }

            return filteredProducts;
        },

        _createRecommendations: function (recommendationIds, amount) {
            var response = {
                'payload': [],
                'recommendationsPayloadIds': [],
                'payloadIdToRecommendationIds': {},
                'recommendationIds': {}
            };

            if (!$.isArray(recommendationIds)) {
                return response;
            }

            // let's find the recommendations that have to be fired
            var neededRecommendationPayloadIds = [];

            // iterate over the requested recommendations and see which calls are needed
            var payloadIdToRecommendationIds = {};
            var finalRecommendationIds = [];
            for (var i = 0; i < recommendationIds.length; i++) {
                var recommendationId = recommendationIds[i];
                var recommendationSetting = this._getSettings(recommendationId);
                if (!$.isPlainObject(recommendationSetting)) {
                    continue;
                }

                // check the needed payload and add it if we don't have it yet
                var recommendationPayloadIds = $.isArray(recommendationSetting.recommendationPayloadId) ? recommendationSetting.recommendationPayloadId : [recommendationSetting.recommendationPayloadId];

                for (var j = 0; j < recommendationPayloadIds.length; j++) {
                    var recommendationPayloadId = recommendationPayloadIds[j];

                    if ($.inArray(recommendationPayloadId, neededRecommendationPayloadIds) === -1) {
                        neededRecommendationPayloadIds.push(recommendationPayloadId);
                    }

                    var currentPayloadIdMapping = payloadIdToRecommendationIds[recommendationPayloadId];
                    if (!$.isArray(currentPayloadIdMapping)) {
                        currentPayloadIdMapping = [];
                        payloadIdToRecommendationIds[recommendationPayloadId] = currentPayloadIdMapping;
                    }

                    if ($.inArray(recommendationId, currentPayloadIdMapping) === -1) {
                        currentPayloadIdMapping.push(recommendationId);
                    }

                    if ($.inArray(recommendationId, finalRecommendationIds) === -1) {
                        finalRecommendationIds.push(recommendationId);
                    }
                }
            }

            // check if there are any neededRecommendationPayloadIds
            if (neededRecommendationPayloadIds.length === 0) {
                return response;
            }

            // resolve the neededRecommendationPayloadIds
            for (var k = 0; k < neededRecommendationPayloadIds.length; k++) {
                var neededRecommendationPayloadId = neededRecommendationPayloadIds[k];
                var payload = this._getPayload(neededRecommendationPayloadId);
                if (!$.isPlainObject(payload)) {
                    continue;
                }

                payload = $.extend({}, payload);
                var multiplier = payload.multiplier;
                multiplier = typeof multiplier === 'number' ? Math.max(multiplier, 1) : 1;
                payload.numRecommendations = multiplier * amount;

                response.recommendationsPayloadIds.push(neededRecommendationPayloadId);
                response.payload.push(payload);
            }

            response.payloadIdToRecommendationIds = payloadIdToRecommendationIds;
            response.recommendationIds = finalRecommendationIds;

            return response;
        },

        _createUser: function (user, tags) {
            var createdUser = {
                additional: {}
            };

            if ($.isPlainObject(user)) {
                createdUser.userId = typeof user.userId === 'string' && user.userId.trim() !== '' ? user.userId : null;
                createdUser.email = typeof user.email === 'string' && user.email.trim() !== '' ? user.email.toLowerCase() : null;
            }

            if ($.isPlainObject(tags)) {
                createdUser.additional.location = {
                    storeId: typeof tags.storeId === 'string' && tags.storeId.trim() !== '' ? tags.storeId : null
                }
            }

            return createdUser;
        },

        _mapResults: function (recommendations, results) {
            var allRecommendationResults = {};

            // let's map the responses to a more readable way
            for (var i = 0; i < results.length; i++) {
                var result = results[i].result;
                var additionalData = $.isPlainObject(results[i].additionalData) ? results[i].additionalData : {};

                var recommendationResult = [];
                if ($.isArray(result)) {
                    for (var k = 0; k < result.length; k++) {
                        var product = this._mapProduct(result[k], additionalData);
                        if ($.isPlainObject(product)) {
                            recommendationResult.push(product);
                        }
                    }
                }

                var payloadId = recommendations.recommendationsPayloadIds[i];
                allRecommendationResults[payloadId] = recommendationResult;
            }

            return allRecommendationResults;
        },

        _mapProduct: function (product, additionalData) {
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

            return mapProduct(product, additionalData);
        }
    };

    // bind the module
    Breinify.plugins._add('recommendations', Recommendations);
})();