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

    // creates the actual countdown element
    class UiCountdown {
        constructor(settings) {
            this.settings = $.isPlainObject(settings) ? settings : {};
        }

        render() {
            console.log(this.settings);
        }
    }

    // bind the module
    Breinify.plugins._add('UiCountdown', UiCountdown);
})();