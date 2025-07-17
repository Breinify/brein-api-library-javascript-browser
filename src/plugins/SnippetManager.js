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

        register: function (snippetId, snippet) {
            const currentSnippet = this.snippets[snippetId];
            this.snippets[snippetId] = snippet;

            return $.isPlainObject(currentSnippet) ? currentSnippet : null;
        },
        get: function (id) {
            const snippet = this.snippets[id];
            return typeof snippet === 'undefined' ? null : snippet;
        }
    };

    const SnippetManager = {

        registerSnippet: function (snippetId, snippet) {
            _private.register(snippetId, snippet);
        },
        getSnippet: function (snippetId) {
            return _private.get(snippetId);
        }
    };

    // bind the module
    Breinify.plugins._add('snippetManager', SnippetManager);
})();