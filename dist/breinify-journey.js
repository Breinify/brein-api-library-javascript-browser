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

    var storageKey = '';
    var maxSize = 20;
    var _private = {
        currentJourney: [],

        init: function () {
            var storedValue = window.sessionStorage.getItem(storageKey);
            if (typeof storedValue === 'string') {
                try {
                    this.currentJourney = JSON.parse(storedValue);
                } catch (e) {
                    this.currentJourney = [];
                }
            } else {
                this.currentJourney = [];
            }
        },

        appendEntry: function (entry) {
            this.currentJourney.push(entry);

            if (this.currentJourney.length > maxSize) {
                this.currentJourney.splice(0, this.currentJourney.length - maxSize);
            }

            window.sessionStorage.setItem(storageKey, JSON.stringify(this.currentJourney));
        },

        handleClick: function ($el) {
            var group = $el.attr('data-journey-group');
            var item = $el.attr('data-journey-item');
            var entry = group + '::' + item;

            this.appendEntry(entry);
        },

        registerTracker: function () {
            var _self = this;

            Breinify.UTL.dom.addModification('journey::tracker', {
                selector: '[data-journey-group][data-journey-item][data-journey-set!="true"]',
                modifier: function ($els) {
                    $els.each(function () {

                        // get the values from the element
                        var $el = $(this);
                        $el.attr('data-journey-set', 'true').click(function () {
                            _self.handleClick($(this));
                        });
                    });
                }
            });
        },

        is: function (entry) {
            if (this.currentJourney.length === 0) {
                return false;
            } else if (entry === null) {
                return false;
            } else {
                return this.currentJourney[this.currentJourney.length - 1] === entry;
            }
        }
    };

    // initialize the journey
    _private.init();

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
            return _private.is(journey);
        }
    };

    // bind the module
    var BoundJourney = Breinify.plugins._add('journey', Journey);

    // bind the observation if configured and Breinify is ready
    Breinify.onReady(function () {
        BoundJourney.observeJourneyElements();
    });
})();