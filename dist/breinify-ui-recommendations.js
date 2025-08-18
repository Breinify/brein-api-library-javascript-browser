"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('uiRecommendations')) {
        return;
    }

    // bind the module
    Breinify.plugins._add('uiRecommendations', {
        register: function () {
            console.log('ui-recommendations added as plugin');
            // add whatever is needed in the future
        }
    });
})();