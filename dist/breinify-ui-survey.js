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

            this.attachShadow({mode: 'open'});

            this.uuid = null;
            this.$shadowRoot = $(this.shadowRoot);
            this.settings = {};
        }

        /**
         * Inject minimal default styles into the shadow root.
         * These are intentionally neutral so the component works
         * on any site without clashing with page styles.
         */
        _ensureBaseStyle() {
            const styleId = 'br-ui-survey-style';
            if (this.$shadowRoot.find("#" + styleId).length > 0) {
                return;
            }

            this.$shadowRoot.append($(`<style id="' + styleId + '">
                :host {
                    display: block;
                    box-sizing: border-box;
                    font-family: inherit;
                    color: inherit;
                }

                *, *::before, *::after { box-sizing: border-box; }

                .br-ui-survey-root { width: 100%; }
                .br-ui-survey-container {  width: 100%; }
                .br-ui-survey-hidden { display: none !important; }
            </style>`));
        }

        render(webExId, settings) {
            this.settings = settings;
            this.uuid = webExId;
            this.$shadowRoot.empty();

            // first add the base style
            this._ensureBaseStyle();

            // second let's add the style snippet - if any
            Breinify.plugins.webExperiences.style(this.settings, this.$shadowRoot);

            // next we need to create pages

            console.log(webExId);
            console.log(this.settings);
            console.log(JSON.stringify(this.settings));
        }
    }

    Breinify.plugins._add('uiSurvey', {
        register: function (module, webExId, config) {

            if (!window.customElements.get(elementName)) {
                window.customElements.define(elementName, UiSurvey);
            }

            // check if we already have the element (just defensive)
            const id = 'br-survey-' + webExId;
            let $survey = $('#' + id);
            if ($survey.length === 0) {

                // otherwise we add the element and attach it, if successful we continue
                $survey = $('<' + elementName + '/>').attr('id', id);
                if (Breinify.plugins.webExperiences.attach(config, $survey) === false) {
                    return;
                }
            }

            // get the actual DOM element
            const survey = $survey.get(0);
            survey.render(webExId, config);
        }
    });
})();