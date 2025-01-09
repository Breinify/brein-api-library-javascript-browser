"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('slick')) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    const _private = {
        defMaxWaitTimeInMs: 2500,

        apply: function (settings) {
            const _self = this;

            const startTimeInMs = new Date().getTime();
            const checkForSlick = this._determineCheckForSlick(settings);
            const maxWaitTimeInMs = this._determineMaxWaitTimeInMs(settings);

            // otherwise, we first wait for jQuery to see if it's there
            this._waitFor(maxWaitTimeInMs, function () {
                return _self._hasWndJQuery();
            }, function (status) {

                // if we do not have jQuery we just load it and utilize our jQuery
                if (status === false) {
                    _self._load(settings);
                }
                // if we know there is no slick, and we should load it do it now
                else if (checkForSlick === false) {
                    _self._load(settings);
                }
                // otherwise we wait for a potential slick and only load after
                else {
                    const remainingTimeInMs = new Date().getTime() - startTimeInMs;
                    _self._waitFor(remainingTimeInMs, function () {
                        return _self._hasWndSlick();
                    }, function (status) {
                        if (status === false) {
                            _self._load(settings);
                        }
                    });
                }
            });
        },

        _determineMaxWaitTimeInMs: function (settings) {
            return $.isPlainObject(settings) && typeof settings.maxWaitTimeInMs === 'number' ? settings.maxWaitTimeInMs : this.defMaxWaitTimeInMs;
        },

        _determineCheckForSlick: function (settings) {
            return $.isPlainObject(settings) && typeof settings.checkForSlick === 'boolean' ? settings.checkForSlick : false;
        },

        _hasWndSlick: function () {
            return typeof window.$ === 'function' &&
                $.isPlainObject(window.$.fn) &&
                $.isFunction(window.$.fn.slick);
        },

        _hasWndJQuery: function () {
            return typeof window.$ === 'function' &&
                $.isPlainObject(window.$.fn) &&
                typeof window.$.fn.jquery === 'string'
        },

        _waitFor: function (maxWaitTimeInMs, checker, callback, waitedInMs) {
            const _self = this;

            // check if we have jQuery and if so fire the callback
            if (checker() === true) {
                if ($.isFunction(callback)) {
                    callback(true);
                }
                return;
            }

            // the value of waitTimeInMs can be negative or zero, in any case we would directly return with false
            waitedInMs = typeof waitedInMs === 'number' ? waitedInMs : 0;
            if (waitedInMs >= maxWaitTimeInMs) {
                if ($.isFunction(callback)) {
                    callback(false);
                }
            } else {

                setTimeout(function () {
                    _self._waitFor(maxWaitTimeInMs, checker, callback, waitedInMs + 100);
                }, 50);
            }
        },

        _load: function (settings) {
            const _self = this;

            // if it's already loaded there is nothing to do
            if (this._hasWndSlick()) {
                if ($.isFunction(settings.onLoad)) {
                    settings.onLoad(window.$);
                }
                return;
            }
            // we need to make sure we have a jquery instance on window, if not we utilize ours
            else if (!this._hasWndJQuery()) {
                window.$ = $;
            }

            // load the slick CSS and JavaScript
            const slickCss = document.createElement("link");
            slickCss.type = "text/css";
            slickCss.rel = "stylesheet";
            slickCss.href = "https://cdn.jsdelivr.net/npm/slick-carousel@1.8.1/slick/slick.css";

            const slickJs = document.createElement("script");
            slickJs.type = "text/javascript";
            slickJs.src = "https://cdn.jsdelivr.net/npm/slick-carousel@1.8.1/slick/slick.min.js";

            document.head.appendChild(slickCss);
            document.body.appendChild(slickJs);

            // next we wait for slick to be available and call the callback, if there is one
            if (!$.isFunction(settings.onLoad)) {
                return;
            }

            this._waitFor(15000, function () {
                return _self._hasWndSlick();
            }, function (status) {
                if (status === true) {
                    settings.onLoad(window.$);
                }
            });
        }


    };

    const Slick = {

        setup: function () {

            let maxWaitTimeInMs = this.getConfig('maxWaitTimeInMs', null);
            maxWaitTimeInMs = typeof maxWaitTimeInMs === 'number' && maxWaitTimeInMs < 30000 ? Math.max(-1, maxWaitTimeInMs) : _private.defMaxWaitTimeInMs;

            let checkForSlick = this.getConfig('checkForSlick', null);
            checkForSlick = typeof checkForSlick === 'boolean' ? checkForSlick : false;

            _private.apply({
                checkForSlick: checkForSlick,
                maxWaitTimeInMs: maxWaitTimeInMs
            });
        }
    };


    // bind the module
    Breinify.plugins._add('slick', Slick);
})();