"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('uiCountdown')) {
        return;
    }

    // get dependencies
    const $ = Breinify.UTL._jquery();

    // create the actual element
    const UiCountdown = {

    };

    // bind the module
    Breinify.plugins._add('uiCountdown', UiCountdown);
})();