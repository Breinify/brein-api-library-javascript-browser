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

    /**
     * When using this plugin it adds a wrapper method as plugin, which adds the possibility to
     * register the custom HTML element. This method can be called multiple times without issues
     * (so whenever the plugin is retrieved).
     */
    class UiCountdown extends HTMLElement {

        constructor() {
            super();

            // initialize default settings and attach a shadow DOM for style encapsulation
            this.settings = {};
            this.attachShadow({mode: 'open'});
        }

        /**
         * This is the entry point, called when element is added to the DOM, this should trigger
         * the actual rendering process.
         */
        connectedCallback() {
            // currently we do nothing and wait for the render method to be called explicitly
            console.log('connectedCallback');
        }

        /**
         * This specifies or override the default settings.
         *
         * @param type the type of the countdown to apply and validate the configuration for
         * @param settings the settings to be applied/overridden
         * @param callback a function called when the configuration is successfully loaded or failed
         */
        config(type, settings, callback) {
            let error = null;

            const checkedType = Breinify.UTL.isNonEmptyString(type);
            if (checkedType === null) {
                error = 'the specified type "' + type + "' is invalid";
            } else if (!$.isPlainObject(settings)) {
                error = 'settings must be a valid object';
            }

            if (error === null) {
                this.settings = $.extend({
                    type: checkedType
                }, settings);
            } else {
                error = new Error(error);
            }

            if ($.isFunction(callback)) {
                callback(error, this.settings);
            }
        }

        render() {
            this.shadowRoot.innerHTML = `<pre>${JSON.stringify(this.settings, null, 2)}</pre>`;
        }
    }

    // bind the module
    Breinify.plugins._add('uiCountdown', {
        register: function () {
            if (!window.customElements.get('br-ui-countdown')) {
                window.customElements.define('br-ui-countdown', UiCountdown);
            }
        }
    });
})();