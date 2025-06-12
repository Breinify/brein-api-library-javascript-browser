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

    };

    const SnippetManager = {

    };

    // bind the module
    Breinify.plugins._add('snippetManager', SnippetManager);
})();