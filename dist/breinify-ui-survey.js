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

            this.$shadowRoot.append($(`<style id="${styleId}">
                :host {
                    display: block;
                    box-sizing: border-box;
                    font-family: inherit;
                    color: inherit;
                }
            
                *, *::before, *::after { box-sizing: border-box; }
            
                .br-ui-survey-root { width: 100%; }
                .br-ui-survey-container { width: 100%; }
                .br-ui-survey-hidden { display: none !important; }
            
                /* -------------------------------------------------- */
                /* Trigger banner styling (desktop + mobile)          */
                /* -------------------------------------------------- */
                .br-ui-survey-trigger {
                    display: inline-block;
                    cursor: pointer;
                    width: 100%;
                }
            
                .br-ui-survey-trigger-image { width: 100%; height: auto; border: 0; }
                .br-ui-survey-trigger-image.br-ui-survey-desktop { display: block; }
                .br-ui-survey-trigger-image.br-ui-survey-mobile { display: none; }
            
                @media (max-width: 600px) {
                    .br-ui-survey-trigger-image.br-ui-survey-desktop { display: none; }
                    .br-ui-survey-trigger-image.br-ui-survey-mobile { display: block; }
                }
            </style>`));
        }

        /**
         * Creates the clickable trigger banner (desktop + mobile).
         */
        _createTrigger() {
            const triggerCfg = (this.settings && this.settings.trigger) || {};

            const desktopUrl = triggerCfg.bannerUrl;
            const mobileUrl = triggerCfg.mobileBannerUrl || desktopUrl;

            const $trigger = $('<div/>', {
                class: 'br-ui-survey-trigger',
                role: 'button',
                tabindex: 0,
                'aria-label': 'Start survey'
            });

            // Desktop image (required)
            if (desktopUrl) {
                $trigger.append($('<img src="' + desktopUrl + '" class="br-ui-survey-trigger-image" alt="Start survey"/>')
                    .addClass('br-ui-survey-desktop'));
            }

            // Mobile image (optional, fallback to desktop)
            if (mobileUrl) {
                $trigger.append($('<img src="' + mobileUrl + '" class="br-ui-survey-trigger-image" alt="Start survey"/>')
                    .addClass('br-ui-survey-mobile'));
            }

            // TODO: need to add activity renderElement

            $trigger.on('click', (evt) => {

                // TODO: need to add activity clickedElement

                evt.preventDefault();
                this._openSurvey();
            });
            return $trigger;
        }

        /**
         * Opens the survey (placeholder for now).
         */
        _openSurvey() {
            console.log('Survey trigger clicked:', this.uuid);
        }

        render(webExId, settings) {
            this.settings = settings;
            this.uuid = webExId;
            this.$shadowRoot.empty();

            // first add the base style
            this._ensureBaseStyle();

            // second let's add the style snippet - if any
            Breinify.plugins.webExperiences.style(this.settings, this.$shadowRoot);

            // wrapper root
            const $root = $('<div class="br-ui-survey-root"></div>');

            // add trigger banner
            const $trigger = this._createTrigger();
            $root.append($trigger);

            this.$shadowRoot.append($root);

            // TODO: debug for now, remove when done
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
