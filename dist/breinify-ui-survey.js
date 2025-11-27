"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('uiSurvey')) {
        return;
    }

    const elementName = 'br-ui-survey';
    const $ = Breinify.UTL._jquery();

    class UiSurvey extends HTMLElement {
        $shadowRoot = null
        settings = null
        uuid = null

        constructor() {
            super();

            this.uuid = Breinify.UTL.uuid();
            this.$shadowRoot = $(this.shadowRoot);
            this.settings = {};

            this.attachShadow({mode: 'open'});
        }
    }

    Breinify.plugins._add('uiSurvey', {
        register: function (module, webExId, config) {

            if (!window.customElements.get(elementName)) {
                window.customElements.define(elementName, UiSurvey);
            }

            Breinify.plugins.webExperiences.attach(config, $('body'));

            console.log(module);
            console.log(webExId);
            console.log(config);
        }
    });
})();