"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('journey')) {
        return;
    }

    // bind the jQuery default object $
    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var _private = {
        currentJourney: null,

        registerTracker: function () {

        }
    };

    var Journey = {

        observeJourneyElements: function (options) {
            options = $.extend({
                trackJourney: this.getConfig('trackJourney', false)
            }, options);

            if (options.trackJourney === true) {
                _private.registerTracker();
            }
        },

        is: function (journey) {
            return journey === null || _private.currentJourney === journey;
        }
    };

    // bind the module
    var BoundJourney = Breinify.plugins._add('journey', Journey);

    // bind the observation if configured and Breinify is ready
    Breinify.onReady(function () {
        BoundJourney.observeJourneyElements();
    });
})();