"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('shopify')) {
        return;
    }

    const $ = Breinify.UTL._jquery();

    const shopifyCart = {
        isSetup: false,
        loadedToken: null,
        lookUpToken: null,
        currentCart: null,
        originalFetch: null,
        additionalData: [],
        additionalItemData: [],
        cartObservers: [],
        beforeCartObservers: [],
        afterCartObservers: [],

        setup: function (config) {

            // make sure we do not set up the plugin twice
            if (this.isSetup === true) {
                return;
            }

            const _self = this;

            // add the observers for changes
            if ($.isArray(config.beforeCartObservers)) {
                for (let i = 0; i < config.beforeCartObservers.length; i++) {
                    this.addBeforeCartObserver(config.beforeCartObservers[i]);
                }
            }
            if ($.isArray(config.cartObservers)) {
                for (let i = 0; i < config.cartObservers.length; i++) {
                    this.addCartObserver(config.cartObservers[i]);
                }
            }
            if ($.isArray(config.afterCartObservers)) {
                for (let i = 0; i < config.afterCartObservers.length; i++) {
                    this.addAfterCartObserver(config.afterCartObservers[i]);
                }
            }

            if (config.enableCartRequests === true) {

                // trigger cart updates now...
                _self._loadCart();

                // ... and set up the interval
                if (typeof config.refreshRateInMs === 'number' && config.refreshRateInMs >= 10) {
                    window.setInterval(function () {
                        _self._loadCart();
                    }, config.refreshRateInMs);
                }
            }

            if (config.captureCartFetchEvents === true) {
                this._bindFetch();
                this._bindJQuery();
            }

            if ($.isArray(config.additionalData)) {
                this.additionalData = config.additionalData;
            }
            if ($.isArray(config.additionalItemData)) {
                this.additionalItemData = config.additionalItemData;
            }

            this.isSetup = true;
        },

        _bindJQuery: function(callback, waited) {
            const _self = this;

            if (!$.isFunction(window.jQuery) || !$.isFunction(window.jQuery.ajax)) {
                waited = waited || 0;
                setTimeout(function() {
                    _self._bindJQuery(callback, waited + 50);
                }, 50);

                return;
            }

            this.originalAjax = window.jQuery.ajax;
            window.jQuery.ajax = function (settings) {

                // settings can be a string (url) or an object
                const url = typeof settings === 'string' ? settings : settings.url;

                if (typeof url !== 'string' || !url.startsWith('/cart/')) {
                    return _self.originalAjax.apply(this, arguments);
                }

                // Call original ajax, then trigger your cart update logic on success
                _self.beforeCartRequest(url);
                return _self.originalAjax.call(this, settings).done(function () {
                    const maybePromise = _self._loadCart();
                    if (maybePromise && typeof maybePromise.then === 'function') {
                        maybePromise.then((cart) => {
                            _self.afterCartRequest(url, null, cart);
                        }).catch((err) => {
                            _self.afterCartRequest(url, err, null);
                        });
                    } else {
                        _self.afterCartRequest(url, null, maybePromise);
                    }
                });
            };
        },

        _bindFetch: function() {
            const _self = this;

            this.originalFetch = window.fetch;
            window.fetch = function () {
                const args = arguments;
                const url = args[0];

                if (typeof url !== 'string' || !url.startsWith('/cart/')) {
                    return _self.originalFetch.apply(this, args);
                }

                _self.beforeCartRequest(url);
                return _self.originalFetch.apply(this, args).then(response => {
                    _self._loadCart().then(cart => {
                        _self.afterCartRequest(url, null, cart);
                    }).catch(err => {
                        _self.afterCartRequest(url, err, null);
                    });

                    return response;
                });
            };
        },

        getToken: function () {
            let token = $.isFunction(this.lookUpToken) ? this.lookUpToken() : null;
            if (typeof token !== 'string' || token.trim() === '') {
                token = this.loadedToken;
            }

            return token;
        },

        parseToken: function (token) {
            if (typeof token === 'string' && token.trim() !== '') {
                return 'shopify::cart::' + token.replace(/\?key=[a-z\d]+$/, '');
            } else {
                return null;
            }
        },

        addCartObserver: function (observer) {
            if ($.isFunction(observer)) {
                this.cartObservers.push(observer);
            }
        },

        addBeforeCartObserver: function (observer) {
            if ($.isFunction(observer)) {
                this.beforeCartObservers.push(observer);
            }
        },

        addAfterCartObserver: function (observer) {
            if ($.isFunction(observer)) {
                this.afterCartObservers.push(observer);
            }
        },

        beforeCartRequest: function(url) {
            for (let i = 0; i < this.beforeCartObservers.length; i++) {
                const observer = this.beforeCartObservers[i];
                observer(url);
            }
        },

        afterCartRequest: function(url) {
            for (let i = 0; i < this.afterCartObservers.length; i++) {
                const observer = this.afterCartObservers[i];
                observer(url);
            }
        },

        _loadCart: function () {
            const _self = this;

            // determine the root
            const root = $.isPlainObject(window.Shopify) &&
            $.isPlainObject(window.Shopify.routes) &&
            typeof window.Shopify.routes.root === 'string' ? window.Shopify.routes.root : '/';

            return $.getJSON(root + 'cart.js', function (cart) {

                // parse the retrieved token and keep it
                _self.loadedToken = _self.parseToken(cart.token);

                // determine any changes and inform notifiers
                _self._checkCartChanges(cart);
            });
        },

        _checkCartChanges: function (data) {
            const oldCart = this.currentCart;
            const newCart = this._updateCart(data);

            // we cannot determine any changes on the first update, so we ignore it
            if (oldCart === null) {
                return;
            }
            // check if we have a valid change
            else if (newCart === null) {
                return;
            }

            // determine changes, first are they both empty, nothing to do
            if (oldCart.isEmpty && newCart.isEmpty) {
                return;
            }

            const oldIds = Object.keys(oldCart.items);
            const newIds = Object.keys(newCart.items);
            const allIds = [...new Set([...oldIds, ...newIds])];

            const removedItems = [];
            const addedItems = [];
            for (let i = 0; i < allIds.length; i++) {
                const id = allIds[i];

                const cartOldItem = oldCart.items[id];
                const cartNewItem = newCart.items[id];

                if ($.isPlainObject(cartOldItem) && $.isPlainObject(cartNewItem)) {

                    // check any difference in quantity, old > new means removed, old < new added
                    if (cartOldItem.quantity > cartNewItem.quantity) {

                        const {keys: k1, ...oldItem} = cartOldItem;
                        removedItems.push($.extend(true, {}, oldItem, {
                            quantity: oldItem.quantity - cartNewItem.quantity
                        }));
                    } else if (cartOldItem.quantity < cartNewItem.quantity) {

                        const {keys: k2, ...newItem} = cartNewItem;
                        addedItems.push($.extend(true, {}, newItem, {
                            quantity: newItem.quantity - cartOldItem.quantity
                        }));
                    }
                } else if ($.isPlainObject(cartOldItem)) {

                    // in the new cart, the item does not exist anymore
                    const {keys: k1, ...oldItem} = cartOldItem;
                    removedItems.push(oldItem);
                } else {

                    // the item was added, it's not in the old one
                    const {keys: k2, ...newItem} = cartNewItem;
                    addedItems.push(newItem);
                }
            }

            // notify observers about the changes (if any)
            if (removedItems.length > 0 || addedItems.length > 0) {

                for (let i = 0; i < this.cartObservers.length; i++) {
                    const observer = this.cartObservers[i];
                    observer(addedItems, removedItems, newCart);
                }
            }
        },

        _updateCart: function (data) {
            if (!$.isPlainObject(data)) {
                return this.currentCart;
            }

            const itemCount = data.item_count;
            if (typeof itemCount !== 'number') {
                // nothing to update, this is an invalid result
            } else if (itemCount === 0) {
                this.currentCart = {
                    isEmpty: true,
                    size: 0,
                    quantity: 0,
                    subTotal: 0,
                    items: {},
                    additionalData: {}
                };
            } else if ($.isArray(data.items)) {
                this.currentCart = {
                    isEmpty: true,
                    size: 0,
                    quantity: 0,
                    subTotal: 0,
                    items: {},
                    additionalData: {}
                };

                for (let i = 0; i < data.items.length; i++) {
                    const item = data.items[i];

                    let id = Breinify.UTL.toInteger(item.id);
                    id = id === null ? null : '' + id;
                    if (id === null) {
                        continue;
                    }

                    const quantity = Breinify.UTL.toInteger(item.quantity);

                    this.currentCart.isEmpty = false;
                    this.currentCart.size++;
                    this.currentCart.quantity += (quantity === null ? 0 : quantity);

                    let currentCartItem = this.currentCart.items[id];
                    if (!$.isPlainObject(currentCartItem)) {
                        currentCartItem = {
                            additionalData: {},
                            quantity: 0,
                            keys: []
                        };
                        this.currentCart.items[id] = currentCartItem;
                    }

                    currentCartItem.id = id;
                    currentCartItem.name = Breinify.UTL.isNonEmptyString(item.product_title);
                    currentCartItem.quantity += quantity;
                    currentCartItem.keys.push(item.key);

                    // add any additional information of the item
                    for (let j = 0; j < this.additionalItemData.length; j++) {
                        const itemAttr = this.additionalItemData[j];
                        currentCartItem.additionalData[itemAttr] = item[itemAttr];
                    }
                }
            } else {
                // nothing to update, this is an invalid result
            }

            // add any requested additional data from the cart instance
            for (let i = 0; i < this.additionalData.length; i++) {
                const cartAttr = this.additionalData[i];
                this.currentCart.additionalData[cartAttr] = data[cartAttr];
            }

            // add the information about pricing
            const subTotalCents = Number(data?.items_subtotal_price);
            this.currentCart.subTotal = Number.isFinite(subTotalCents) ? Math.round(subTotalCents) / 100 : 0;

            return this.currentCart;
        }
    };

    const Shopify = {

        setup: function () {
            let cartEnableRequest = this.getConfig('cart::enableRequests', null);
            cartEnableRequest = typeof cartEnableRequest === 'boolean' ? cartEnableRequest : true;

            let captureCartFetchEvents = this.getConfig('cart::captureCartFetchEvents', null);
            captureCartFetchEvents = typeof captureCartFetchEvents === 'boolean' ? captureCartFetchEvents : true;

            let cartRefreshRateInMs = this.getConfig('cart::refreshRateInMs', null);
            cartRefreshRateInMs = typeof cartRefreshRateInMs === 'number' ? cartRefreshRateInMs : 2500;

            let cartObservers = this.getConfig('cart::observers', null);
            cartObservers = $.isFunction(cartObservers) ? [cartObservers] : cartObservers;
            cartObservers = $.isArray(cartObservers) ? cartObservers : null;

            let additionalData = this.getConfig('cart::additionalData', null);
            additionalData = $.isArray(additionalData) ? additionalData : [];

            let additionalItemData = this.getConfig('cart::additionalItemData', null);
            additionalItemData = $.isArray(additionalItemData) ? additionalItemData : [];

            shopifyCart.setup({
                enableCartRequests: cartEnableRequest,
                captureCartFetchEvents: captureCartFetchEvents,
                refreshRateInMs: cartRefreshRateInMs,
                additionalData: additionalData,
                additionalItemData: additionalItemData,
                cartObservers: cartObservers
            });
        },

        cart: {
            onCartChange: function (observer) {
                shopifyCart.addCartObserver(observer);
            },

            beforeCartRequest: function (observer) {
                shopifyCart.addBeforeCartObserver(observer);
            },

            afterCartRequest: function (observer) {
                shopifyCart.addAfterCartObserver(observer);
            },

            bindLookUpToken: function (lookUp) {
                shopifyCart.lookUpToken = $.isFunction(lookUp) ? function () {
                    return shopifyCart.parseToken(lookUp());
                } : null;
            },

            getToken: function () {
                return shopifyCart.getToken();
            },

            getCurrentCart: function() {
                return $.extend(true, {}, shopifyCart.currentCart);
            }
        }
    };


    // bind the module
    Breinify.plugins._add('shopify', Shopify);
})();