"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('uiSurvey')) {
        return;
    }

    Breinify.plugins._add('uiSurvey', {
        register: function (module, webExId, config) {

            console.log(module);
            console.log(webExId);
            console.log(config);
        }
    });
})();