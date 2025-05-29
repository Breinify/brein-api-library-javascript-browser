"use strict";

(function () {

    const DevStudio = {

        init: function () {
            if (Breinify.UTL.internal.isDevMode() !== true) {
                return;
            }

            console.log('DevStudio is being loaded');
        }
    }

    // bind the module
    const BoundDevStudio = Breinify.plugins._add('devStudio', DevStudio);

    Breinify.onReady(function () {
        BoundDevStudio.init();
    });
})();