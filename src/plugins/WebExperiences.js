"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('webExperiences')) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    const _private = {

    };

    const WebExperiences = {

    };


    // bind the module
    Breinify.plugins._add('webExperiences', WebExperiences);
})();