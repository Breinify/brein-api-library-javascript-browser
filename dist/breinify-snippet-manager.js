"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('snippetManager')) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    const _private = {
        snippets: {},
        observers: {},

        register: function (snippetId, snippet) {
            const currentSnippet = this.snippets[snippetId];
            this.snippets[snippetId] = snippet;

            // notify observers waiting for this snippet
            this._notify(snippetId, snippet);

            return $.isPlainObject(currentSnippet) ? currentSnippet : null;
        },

        get: function (id) {
            const snippet = this.snippets[id];

            if (typeof snippet === 'string') {
                // previously: returned Breinify.UTL.isNonEmptyString(snippet)
                return Breinify.UTL.isNonEmptyString(snippet) ? snippet : null;
            } else if ($.isFunction(snippet)) {
                return snippet;
            } else {
                return null;
            }
        },

        /**
         * Register an observer that is called once the snippet with the given ID
         * has been registered.
         *
         * If the snippet is already registered, the observer is called
         * asynchronously on the next tick.
         */
        observe: function (snippetId, callback) {
            if (!Breinify.UTL.isNonEmptyString(snippetId) || !$.isFunction(callback)) {
                return;
            }

            const existing = this.snippets[snippetId];

            // If the snippet is already registered, fire immediately (async)
            if (typeof existing !== 'undefined') {
                setTimeout(function () {
                    callback(snippetId, existing);
                }, 0);
                return;
            }

            // Otherwise store the observer for later notification
            if (!$.isArray(this.observers[snippetId])) {
                this.observers[snippetId] = [];
            }

            this.observers[snippetId].push(callback);
        },

        /**
         * Injects a snippet (string representing a DOM node) into the target.
         * If the snippet is a function (JS snippet), it is ignored.
         *
         * @param {string} snippetId
         * @param {*} target jQuery|Element|string|null
         * @param {string} position 'prepend'|'append' (default: 'prepend')
         */
        inject: function (snippetId, target, position) {
            const code = this.get(snippetId);

            // For injection we only accept non-empty strings (DOM-like snippets)
            if (!Breinify.UTL.isNonEmptyString(code) || $.isFunction(code)) {
                return;
            }

            const $el = $(code);
            if ($el.length === 0) {
                return;
            }

            // Determine / enforce id for de-dupe
            let id = Breinify.UTL.isNonEmptyString($el.attr('id'));
            if (id === null) {
                id = 'br-' + snippetId;
                $el.attr('id', id);
            }

            // Global de-dupe: if an element with that id exists anywhere, do nothing
            if (document.getElementById(id)) {
                return;
            }

            const pos = position === 'append' ? 'append' : 'prepend';
            this._waitForTarget(target, function ($target) {
                // Re-check after waiting (someone else may have inserted it)
                if (document.getElementById(id)) {
                    return;
                }

                $target[pos]($el);
            }, 5000);
        },

        /**
         * Wait until a target exists, then call callback($target).
         * Accepts jQuery object, DOM element, selector string, or null (=> body).
         *
         * If the target does not become available within the timeout, nothing happens.
         * In debug mode a warning is logged.
         *
         * @param {*} target
         * @param {function} callback function($target) { ... }
         * @param {number} timeoutMs default 5000
         */
        _waitForTarget: function (target, callback, timeoutMs) {
            if (!$.isFunction(callback)) {
                return;
            }

            const maxMs = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 5000;
            const start = Date.now();
            let done = false;

            const tryResolve = function () {
                // default / explicit body
                if (!target || target === 'body' || target === 'BODY') {
                    return document.body ? $('body') : null;
                }

                // explicit head target
                if (target === 'head' || target === 'HEAD') {
                    return document.head ? $('head') : null;
                }

                // jQuery object handling
                if (target && target.jquery) {
                    if (target.length > 0) {
                        return target;
                    }

                    // heuristic: re-query if selector exists
                    if (Breinify.UTL.isNonEmptyString(target.selector)) {
                        const $re = $(target.selector);
                        return $re.length > 0 ? $re : null;
                    }

                    return null;
                }

                // selector / element fallback
                const $t = _private._resolveTarget(target);
                return $t && $t.length > 0 ? $t : null;
            };

            const resolved = tryResolve();
            if (resolved) {
                callback(resolved);
                return;
            }

            const logTimeout = function () {
                try {
                    if (Breinify && Breinify.config && Breinify.config.debug === true
                        && window.console && console.warn) {

                        console.warn('snippetManager: target not found within timeout',
                            { target: target, timeoutMs: maxMs });
                    }
                } catch (e) {
                    // ignore
                }
            };

            const observer = new MutationObserver(function () {
                if (done) {
                    return;
                }

                const resolvedNow = tryResolve();
                if (resolvedNow) {
                    done = true;
                    observer.disconnect();
                    callback(resolvedNow);
                    return;
                }

                if (Date.now() - start >= maxMs) {
                    done = true;
                    observer.disconnect();
                    logTimeout();
                }
            });

            observer.observe(document.documentElement, { childList: true, subtree: true });

            // hard timeout safeguard (covers cases where no more mutations happen)
            setTimeout(function () {
                if (done) {
                    return;
                }

                done = true;
                try {
                    observer.disconnect();
                } catch (e) {
                    // ignore
                }

                logTimeout();
            }, maxMs + 50);
        },

        /**
         * Resolves a target into a jQuery object.
         * Accepts jQuery object, DOM element, selector string, or null (=> body).
         *
         * @param {*} target
         * @returns {jQuery}
         */
        _resolveTarget: function (target) {
            if (target && target.jquery) {
                return target;
            } else if (Breinify.UTL.dom.isNodeType(target, 1)) {
                return $(target);
            } else if (Breinify.UTL.isNonEmptyString(target)) {
                return $(target);
            } else {
                return $('body');
            }
        },

        _notify: function (snippetId, snippet) {
            const callbacks = this.observers[snippetId];

            if (!$.isArray(callbacks) || callbacks.length === 0) {
                return;
            }

            // One-shot: clear observers for this snippetId
            delete this.observers[snippetId];

            for (let i = 0; i < callbacks.length; i++) {
                const cb = callbacks[i];
                try {
                    cb(snippetId, snippet);
                } catch (e) {
                    if (window.console && console.error) {
                        console.error('snippetManager observer error for', snippetId, e);
                    }
                }
            }
        }
    };

    const SnippetManager = {

        registerSnippet: function (snippetId, snippet) {
            _private.register(snippetId, snippet);
        },

        getSnippet: function (snippetId) {
            return _private.get(snippetId);
        },

        /**
         * Inject a snippet once it is registered (or next tick if already present).
         *
         * IMPORTANT:
         * - If you want the injection to wait for the target to appear, prefer passing
         *   a selector string (e.g. '#MainContent') or a DOM element.
         * - Passing an empty jQuery object will only work if it was created from a
         *   selector and the selector is available; otherwise it cannot be re-resolved.
         *
         * @param {string} snippetId
         * @param {*} target jQuery|Element|string|null (default: 'body')
         * @param {string} position 'prepend'|'append' (default: 'prepend')
         */
        injectSnippet: function (snippetId, target, position) {
            this.onSnippetRegistered(snippetId, function () {
                _private.inject(snippetId, target, position);
            });
        },

        /**
         * Register a callback that will be fired once the given snippetId
         * is registered. If the snippet already exists, the callback will
         * run on the next tick.
         *
         * @param {string} snippetId
         * @param {function} callback function(snippetId, snippet) { ... }
         */
        onSnippetRegistered: function (snippetId, callback) {
            _private.observe(snippetId, callback);
        }
    };

    // bind the module
    Breinify.plugins._add('snippetManager', SnippetManager);
})();
