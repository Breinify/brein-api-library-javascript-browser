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
    const $ = Breinify.UTL._jquery();

    const storageKey = 'br::journey';
    const maxSize = 20;
    const _private = {
        currentJourney: [],

        init: function () {
            let storedValue = window.sessionStorage.getItem(storageKey);
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

        handleClick: function ($el, utilizeDataTags) {

            let group = utilizeDataTags ? $el.attr('data-journey-group') : undefined;
            let item = utilizeDataTags ? $el.attr('data-journey-item') : undefined;

            let entry = {
                path: window.location.pathname,
                group: typeof group === 'string' && group.trim() !== '' ? group : undefined,
                item: typeof item === 'string' && item.trim() !== '' ? item : undefined
            };

            this.appendEntry(entry);
        },

        registerTracker: function (trackJourney, trackAnchors) {
            const _self = this;

            if (trackJourney === true) {
                Breinify.UTL.dom.addModification('journey::dataTagTracker', {
                    selector: '[data-journey-group][data-journey-item][data-journey-set!="true"]',
                    modifier: function ($els) {
                        $els.each(function () {

                            // get the values from the element
                            let $el = $(this);
                            $el.attr('data-journey-set', 'true').click(function () {
                                _self.handleClick($(this), true);
                            });
                        });
                    }
                });
            }

            if (trackAnchors === true) {
                Breinify.UTL.dom.addModification('journey::anchorTracker', {
                    selector: 'a[data-journey-set!="true"]:not([data-journey-group][data-journey-item])',
                    modifier: function ($els) {
                        $els.each(function () {

                            // get the values from the element
                            let $el = $(this);
                            $el.attr('data-journey-set', 'true').click(function () {
                                _self.handleClick($(this), false);
                            });
                        });
                    }
                });
            }
        },

        is: function (entry, matchByPath, matchByDataTag) {
            let length = this.currentJourney.length;

            if (length === 0) {
                return false;
            } else if (entry === null) {
                return false;
            }

            if ($.isArray(entry)) {
                // nothing to do
            } else if (typeof entry === 'string' && entry.trim() !== '') {
                entry = [entry];
            } else {
                return false
            }

            let lastEntry = this.currentJourney[length - 1];
            return (matchByPath && $.inArray(lastEntry.path, entry) > -1) ||
                (matchByDataTag && $.inArray(lastEntry.group + '::' + lastEntry.item, entry) > -1);
        }
    };

    // initialize the journey
    _private.init();

    const Journey = {

        observeJourneyElements: function (options) {
            options = $.extend({
                trackJourney: this.getConfig('trackJourney', false),
                trackAnchors: this.getConfig('trackAnchors', false),
            }, options);

            _private.registerTracker(options.trackJourney === true, options.trackAnchors === true);
        },

        is: function (journey) {
            return _private.is(journey, true, true);
        },

        get: function() {

            // let's return a copy so that the result cannot be changed
            return _private.currentJourney.slice(0, _private.currentJourney.length);
        }
    };

    // bind the module
    const BoundJourney = Breinify.plugins._add('journey', Journey);

    // bind the observation if configured and Breinify is ready
    Breinify.onReady(function () {
        BoundJourney.observeJourneyElements();
    });
})();