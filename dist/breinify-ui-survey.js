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

            // check if we already have the element (just defensive)
            const id = 'br-survey-' + webExId;
            if ($('#' + id).length > 0) {
                return;
            }

            // otherwise we add the element and attach it, if successful we continue
            const $survey = $('<' + elementName + '/>').attr('id', id);
            if (Breinify.plugins.webExperiences.attach(config, $survey) === false) {
                return;
            }

            console.log(module);
            console.log(webExId);
            console.log(config);
        }
    });
})();