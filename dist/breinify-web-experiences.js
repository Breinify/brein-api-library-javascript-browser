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
        setup: function(configuration, module) {
            console.log('using configuration', configuration);

            // ensure that we utilize the onChange method over the ready method
            if ($.isFunction(module.ready) && !$.isFunction(module.onChange)) {
                module.onChange = module.ready;
                module.ready = null;
            }

            // next check if we have limitations on the path and set up the isValidPage
            let currentIsValidPage = null;
            if ($.isFunction(module.isValidPage)) {
                currentIsValidPage = module.isValidPage;
            }

            module.isValidPage = null;
            module.findRequirements = null;
        }
    };

    const WebExperiences = {
        setup: function (id, configuration, module) {

            // the module must be a valid object
            if (typeof module !== 'object') {
                console.error('the module with id "' + id + '" is not a valid module and cannot be setup');
                return;
            }

            // check if we have the trigger plugin
            if (Breinify.plugins._isAdded('trigger') === true) {

                // if we have the trigger plugin ensure that we initialize it before we set up the module
                Breinify.plugins.trigger.init();
                _private.setup(configuration, module);
            } else {
                console.error('the trigger plugin is not available, ' +
                    'skipping setup of the web-experiences with id "' + id + '"');
                return;
            }

            Breinify.plugins.api.addModule(id, module);
        }
    };

    // bind the module
    Breinify.plugins._add('webExperiences', WebExperiences);
})();