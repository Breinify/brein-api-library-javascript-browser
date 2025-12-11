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