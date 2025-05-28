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
        observers: [],

        setup: function (config) {

            // make sure we do not set up the plugin twice
            if (this.isSetup === true) {
                return;
            }

            const _self = this;

            // add the observers for changes
            if ($.isArray(config.observers)) {
                for (let i = 0; i < config.observers.length; i++) {
                    this.addObserver(config.observers[i]);
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
                this.originalFetch = window.fetch;

                window.fetch = function () {
                    const args = arguments;
                    const url = args[0];

                    if (typeof url !== 'string' || !url.startsWith('/cart/')) {
                        return _self.originalFetch.apply(this, args);
                    }

                    return _self.originalFetch.apply(this, args).then(response => {
                        // response.clone().json().then(data => _self._loadCart());

                        _self._loadCart();
                        return response;
                    });
                };
            }

            this.isSetup = true;
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

        addObserver: function (observer) {
            if ($.isFunction(observer)) {
                this.observers.push(observer);
            }
        },

        _loadCart: function () {
            const _self = this;

            // determine the root
            const root = $.isPlainObject(window.Shopify) &&
            $.isPlainObject(window.Shopify.routes) &&
            typeof window.Shopify.routes.root === 'string' ? window.Shopify.routes.root : '/';

            $.getJSON(root + 'cart.js', function (cart) {

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

                const oldItem = oldCart.items[id];
                const newItem = newCart.items[id];

                if ($.isPlainObject(oldItem) && $.isPlainObject(newItem)) {

                    // check any difference in quantity, old > new means removed, old < new added
                    if (oldItem.quantity > newItem.quantity) {
                        removedItems.push($.extend(true, {}, oldItem, {
                            quantity: oldItem.quantity - newItem.quantity
                        }));
                    } else if (oldItem.quantity < newItem.quantity) {
                        addedItems.push($.extend(true, {}, newItem, {
                            quantity: newItem.quantity - oldItem.quantity
                        }));
                    }
                } else if ($.isPlainObject(oldItem)) {

                    // in the new cart, the item does not exist anymore
                    removedItems.push(oldItem);
                } else {

                    // the item was added, it's no in the old one
                    addedItems.push(newItem);
                }
            }

            // notify observers about the changes (if any)
            if (removedItems.length > 0 || addedItems.length > 0) {

                for (let i = 0; i < this.observers.length; i++) {
                    const observer = this.observers[i];

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
                    items: {}
                };
            } else if ($.isArray(data.items)) {
                this.currentCart = {
                    isEmpty: true,
                    size: 0,
                    quantity: 0,
                    items: {}
                };

                for (let i = 0; i < data.items.length; i++) {
                    const item = data.items[i];

                    let id = Breinify.UTL.toInteger(item.id);
                    id = id === null ? null : '' + id;
                    if (id === null) {
                        continue;
                    }
                    // do not include this Jewelry Polishing Cloth Tarnish Removing (free item)
                    else if (id === '40255563595860') {
                        continue;
                    }

                    const quantity = Breinify.UTL.toInteger(item.quantity);

                    this.currentCart.isEmpty = false;
                    this.currentCart.size++;
                    this.currentCart.quantity += (quantity === null ? 0 : quantity);

                    let currentCartItem = this.currentCart.items[id];
                    if (!$.isPlainObject(currentCartItem)) {
                        currentCartItem = {
                            quantity: 0
                        };
                        this.currentCart.items[id] = currentCartItem;
                    }

                    currentCartItem.id = id;
                    currentCartItem.name = Breinify.UTL.isNonEmptyString(item.product_title);
                    currentCartItem.quantity += quantity;
                }
            } else {
                // nothing to update, this is an invalid result
            }

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

            shopifyCart.setup({
                enableCartRequests: cartEnableRequest,
                captureCartFetchEvents: captureCartFetchEvents,
                refreshRateInMs: cartRefreshRateInMs,
                observers: cartObservers
            });
        },

        cart: {
            onCartChange: function (observer) {
                shopifyCart.addObserver(observer);
            },

            bindLookUpToken: function (lookUp) {
                shopifyCart.lookUpToken = $.isFunction(lookUp) ? function () {
                    return shopifyCart.parseToken(lookUp());
                } : null;
            },

            getToken: function () {
                return shopifyCart.getToken();
            }
        }
    };


    // bind the module
    Breinify.plugins._add('shopify', Shopify);
})();