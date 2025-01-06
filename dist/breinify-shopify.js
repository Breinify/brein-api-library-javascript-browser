"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('shopify')) {
        return;
    }

    const shopifyCart = {
        loadedToken: null,
        lookUpToken: null,

        init: function () {
            const _self = this;

            $.getJSON(window.Shopify.routes.root + 'cart.js', function (cart) {
                if (typeof cart.token === 'string' && cart.token.trim() !== '') {
                    _self.loadedToken = _self.parseToken(cart.token);
                }
            });
        },

        getToken: function() {
            let token = $.isFunction(this.lookUpToken) ? this.lookUpToken() : null;
            if (typeof token !== 'string' || token.trim() === '') {
                token = this.lookUpToken;
            }

            return token;
        },

        parseToken: function (token) {
            if (typeof token === 'string' && token.trim() !== '') {
                return 'shopify::cart::' + token.replace(/\?key=[a-z\d]+$/, '');
            } else {
                return null;
            }
        }
    };

    const Shopify = {

        init: function () {
            shopifyCart.init();
        },

        cart: {
            bindLookUpToken: function(lookUp) {
                shopifyCart.lookUpToken = $.isFunction(lookUp) ? function() {
                    return shopifyCart.parseToken(lookUp());
                } : null;
            },

            getToken: function() {
                return shopifyCart.getToken();
            }
        }
    };


    // bind the module
    Breinify.plugins._add('shopify', Shopify);
})();