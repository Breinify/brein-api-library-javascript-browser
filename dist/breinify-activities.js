"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }

    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var prefixValidation = Breinify.UTL.constants.errors.prefix.validation;

    // create the AlertMe module
    var Activities = {

        pageVisit: function () {
            var type = 'pageVisit';

            var _self = this;
            overload.overload({
                '': function () {
                    _self._send(type, {}, {pageId: window.location.pathname}, null);
                },
                'Function': function (cb) {
                    _self._send(type, {}, {pageId: window.location.pathname}, cb);
                },
                'String,Function': function (pageId, cb) {
                    _self._send(type, {}, {pageId: pageId}, cb);
                },
                'String': function (pageId) {
                    _self._send(type, {}, {pageId: pageId}, null);
                },
                'String,Object,Function': function (pageId, user, cb) {
                    _self._send(type, user, {pageId: pageId}, cb);
                },
                'String,Object': function (pageId, user) {
                    _self._send(type, user, {pageId: pageId}, null);
                },
                'Object,Function': function (tags, cb) {
                    _self._send(type, {}, tags, cb);
                },
                'Object': function (tags) {
                    _self._send(type, {}, tags, null);
                },
                'Object,Object,Function': function (user, tags, cb) {
                    _self._send(type, user, tags, cb);
                },
                'Object,Object': function (user, tags) {
                    _self._send(type, user, tags, null);
                }
            }, arguments, this);
        },

        identify: function () {
            var type = 'identify';

            var _self = this;
            overload.overload({
                'Object,Function': function (user, cb) {
                    _self._send(type, user, {}, cb);
                },
                'Object,Object,Function': function (user, tags, cb) {
                    _self._send(type, user, tags, cb);
                },
                'Object': function (user) {
                    _self._send(type, user, {}, null);
                },
                'Object,Object': function (user, tags) {
                    _self._send(type, user, tags, null);
                }
            }, arguments, this);
        },

        viewedProduct: function () {
            overload.overload(this._productMethods('viewedProduct'), arguments, this);
        },

        addToCart: function () {
            overload.overload(this._productMethods('addToCart'), arguments, this);
        },

        removeFromCart: function () {
            overload.overload(this._productMethods('removeFromCart'), arguments, this);
        },

        checkOut: function () {
            var type = 'checkOut';

            var _self = this;
            overload.overload({
                'String,Array,Object,Object,Array,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,Array,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,Array,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Object,String,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,String,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,String,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Array,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Array,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,String,Object,Array,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Array,Object,Object,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Object,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,String,Object,Object,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Array,Object,Object,String,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Object,String,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,String,Object,Object,String,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Array,Object,Object,Array,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,Array,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,Array,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Object,String,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,String,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,String,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Array,Object': function (transactionId, products, receipt, promotions, user) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Array,Object': function (transactionId, products, receipt, promotions, user) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,String,Object,Array,Object': function (transactionId, products, receipt, promotions, user) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,Array,Object,Object,Object': function (transactionId, products, receipt, promotions, user) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Object,Object': function (transactionId, products, receipt, promotions, user) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,String,Object,Object,Object': function (transactionId, products, receipt, promotions, user) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,Array,Object,Object,String': function (transactionId, products, receipt, promotions, user) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Object,String': function (transactionId, products, receipt, promotions, user) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,String,Object,Object,String': function (transactionId, products, receipt, promotions, user) {
                    var tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                }
            }, arguments, this);
        },

        _productMethods: function (type) {
            var _self = this;
            return {
                'Array,Function': function (products, cb) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, cb);
                },
                'Object,Function': function (products, cb) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, cb);
                },
                'String,Function': function (products, cb) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, cb);
                },
                'String': function (products) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, null);
                },
                'Array': function (products) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, null);
                },
                'Object': function (products) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, null);
                },
                'String,Object,Function': function (products, user, cb) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, cb);
                },
                'Array,Object,Function': function (products, user, cb) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, cb);
                },
                'Object,Object,Function': function (products, user, cb) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, cb);
                },
                'String,Object': function (products, user) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, null);
                },
                'Array,Object': function (products, user) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, null);
                },
                'Object,Object': function (products, user) {
                    var tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, null);
                },
                'String,Object,Object,Function': function (products, user, tags, cb) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, cb);
                },
                'Array,Object,Object,Function': function (products, user, tags, cb) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, cb);
                },
                'Object,Object,Object,Function': function (products, user, tags, cb) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object': function (products, user, tags) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, null);
                },
                'Array,Object,Object': function (products, user, tags) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, null);
                },
                'Object,Object,Object': function (products, user, tags) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, null);
                }
            };
        },

        _mapCheckOutToTags: function (transactionId, products, receipt, promotions, tags) {

            // add the products to the tags
            tags = this._mapProductsToTags(products, tags);

            // add the promotions
            tags = this._mapPromotionsToTags(promotions, tags);

            // add the receipt
            if ($.isPlainObject(receipt)) {
                tags.transactionPriceTotal = typeof receipt.priceTotal === 'number' ? receipt.priceTotal : 0.0;
                tags.transactionTaxTotal = typeof receipt.taxTotal === 'number' ? receipt.taxTotal : 0.0;
                tags.transactionDiscountTotal = typeof receipt.discountTotal === 'number' ? receipt.discountTotal : 0.0;
                tags.transactionMiscTotal = typeof receipt.miscTotal === 'number' ? receipt.miscTotal : 0.0;
                tags.transactionTotal = typeof receipt.total === 'number' ? receipt.total :
                    (tags.transactionPriceTotal + tags.transactionTaxTotal + tags.transactionMiscTotal - tags.transactionDiscountTotal);
            }

            // set the transactionId
            tags.transactionId = transactionId;

            return tags
        },

        _mapProductsToTags: function (products, tags) {

            if ($.isPlainObject(products)) {
                return this._mapProductsToTags([products], tags);
            } else if (typeof products === 'string') {
                return this._mapProductsToTags([{id: products}], tags);
            } else if (typeof products === 'undefined' || products === null) {
                return tags;
            } else if (!$.isArray(products)) {
                throw new Error(prefixValidation + 'The defined `products` are invalid: ' + JSON.stringify(products));
            }

            var len = products.length;
            var hasQuantities = len > 0;
            var hasPrices = len > 0;
            var hasIds = len > 0;
            var hasCategories = len > 0;
            var productQuantities = [];
            var productPrices = [];
            var productIds = [];
            var productCategories = [];

            // iterate over the defined products
            for (var i = 0; i < len; i++) {
                var product = products[i];

                var productId = null;
                var productQuantity = null;
                var productPrice = null;
                var productCategory = null;

                if (typeof product === 'string') {
                    productId = product;
                } else if ($.isPlainObject(product)) {
                    productId = typeof product.id === 'string' ? product.id.trim() : null;
                    productQuantity = typeof product.quantity === 'number' ? product.quantity : null;
                    productPrice = typeof product.price === 'number' ? product.price : null;
                    productCategory = typeof product.category === 'string' ? product.category.trim() : null;
                }

                hasIds = hasIds && !Breinify.UTL.isEmpty(productId);
                hasQuantities = hasQuantities && !Breinify.UTL.isEmpty(productQuantity);
                hasPrices = hasPrices && !Breinify.UTL.isEmpty(productPrice);
                hasCategories = hasCategories && !Breinify.UTL.isEmpty(productCategory);

                productIds.push(productId);
                productPrices.push(productPrice);
                productQuantities.push(productQuantity);
                productCategories.push(productCategory);
            }

            if (hasIds) {
                return $.extend(true, {}, tags, {
                    'productQuantity': hasQuantities ? productQuantities : null,
                    'productPrices': hasPrices ? productPrices : null,
                    'productIds': hasIds ? productIds : null,
                    'productCategories': hasCategories ? productCategories : null
                });
            } else {
                throw new Error('Products must have an identifier: ' + JSON.stringify(products));
            }
        },

        _mapPromotionsToTags: function (promotions, tags) {

            if ($.isPlainObject(promotions)) {
                return this._mapPromotionsToTags([promotions], tags);
            } else if (typeof promotions === 'string') {
                return this._mapPromotionsToTags([{id: promotions}], tags);
            } else if (typeof promotions === 'undefined' || promotions === null) {
                return tags;
            } else if (!$.isArray(promotions)) {
                throw new Error(prefixValidation + 'The defined `promotions` are invalid: ' + JSON.stringify(promotions));
            }

            var len = promotions.length;
            var hasIds = len > 0;
            var promotionAmounts = [];
            var promotionIds = [];

            // iterate over the defined promotions
            for (var i = 0; i < len; i++) {
                var promotion = promotions[i];

                var promotionId = null;
                var promotionAmount = null;

                if (typeof promotion === 'string') {
                    promotionId = promotion;
                } else if ($.isPlainObject(promotion)) {
                    promotionId = typeof promotion.id === 'string' ? promotion.id.trim() : null;
                    promotionAmount = typeof promotion.amount === 'number' ? promotion.amount : null;
                }

                hasIds = hasIds && !Breinify.UTL.isEmpty(promotionId);

                promotionIds.push(promotionId);
                promotionAmounts.push(promotionAmount);
            }

            if (hasIds) {
                return $.extend(true, {}, tags, {
                    'promotionIds': hasIds ? promotionIds : null,
                    'promotionAmounts': hasIds ? promotionAmounts : null
                });
            } else {
                throw new Error('Promotions must have an identifier: ' + JSON.stringify(promotions));
            }
        },

        _send: function (type, user, tags, callback) {
            user = Breinify.UTL.user.create(user);
            tags = $.isPlainObject(tags) ? tags : {};

            Breinify.activity(user, type, null, null, tags, function (data, error) {

                if (typeof callback !== 'function') {
                    // nothing to do
                } else if (typeof error === 'string') {
                    callback(new Error(prefixApi + error));
                } else {
                    callback(null, {
                        user: user,
                        tags: tags
                    });
                }
            });
        }
    };

    // bind the module
    Breinify.plugins.activities = Activities;
})();