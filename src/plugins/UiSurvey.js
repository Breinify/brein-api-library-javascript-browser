"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('uiSurvey')) {
        return;
    }

    const generalSurveyElementName = 'br-ui-survey';
    const popupElementName = 'br-ui-survey-popup';
    const $ = Breinify.UTL._jquery();

    class UiSurveyPopup extends HTMLElement {

        constructor() {
            super();

            this.attachShadow({mode: 'open'});

            // Initial static structure for the popup
            this._renderBase();
        }

        _renderBase() {
            // Only render once
            if (this.shadowRoot.childNodes.length > 0) {
                return;
            }

            this.shadowRoot.innerHTML = `
                <style>
                    :host {
                        display: none;
                        position: fixed;
                        inset: 0;
                        z-index: 2147483647; /* very high to be above most things */
                        font-family: inherit;
                    }

                    :host([open]) { display: block; }

                    .br-ui-survey-popup__backdrop {
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.45);
                    }

                    .br-ui-survey-popup__outer {
                        position: fixed;
                        inset: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        pointer-events: none;
                    }

                    .br-ui-survey-popup__dialog {
                        pointer-events: auto;
                        max-width: 520px;
                        width: calc(100% - 2rem);
                        max-height: calc(100% - 4rem);
                        background: #fff;
                        border-radius: 12px;
                        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.25);
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }

                    .br-ui-survey-popup__header {
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        padding: 0.5rem 0.75rem;
                        border-bottom: 1px solid #eee;
                    }

                    .br-ui-survey-popup__close-btn {
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        font-size: 1.25rem;
                        line-height: 1;
                        padding: 0.25rem 0.5rem;
                    }

                    .br-ui-survey-popup__body { padding: 1rem 1.25rem 1.25rem; overflow: auto; }

                    .br-ui-survey-popup__placeholder {
                        font-size: 0.95rem;
                        color: #666;
                        text-align: center;
                    }
                </style>

                <div class="br-ui-survey-popup__backdrop" part="backdrop"></div>
                <div class="br-ui-survey-popup__outer">
                    <div class="br-ui-survey-popup__dialog" role="dialog" aria-modal="true">
                        <div class="br-ui-survey-popup__header">
                            <button type="button" class="br-ui-survey-popup__close-btn" aria-label="Close survey">
                                &times;
                            </button>
                        </div>
                        <div class="br-ui-survey-popup__body">
                            <div class="br-ui-survey-popup__placeholder">
                                Survey content will appear here…
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this._bindBaseEvents();
        }

        _bindBaseEvents() {
            const backdrop = this.shadowRoot.querySelector('.br-ui-survey-popup__backdrop');
            const closeBtn = this.shadowRoot.querySelector('.br-ui-survey-popup__close-btn');

            if (backdrop) {
                backdrop.addEventListener('click', () => this.close());
            }
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }
        }

        open() {
            if (!this.hasAttribute('open')) {
                this.setAttribute('open', '');
            }

            // Focus the dialog for accessibility
            const dialog = this.shadowRoot.querySelector('.br-ui-survey-popup__dialog');
            if (dialog && typeof dialog.focus === 'function') {
                dialog.setAttribute('tabindex', '-1');
                dialog.focus();
            }
        }

        close() {
            if (this.hasAttribute('open')) {
                this.removeAttribute('open');
            }

            this.dispatchEvent(new CustomEvent('br-ui-survey:popup-closed', {
                bubbles: true,
                cancelable: false
            }));
        }
    }

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

            // get or create a singleton popup element on <body>
            let popup = document.querySelector(popupElementName);

            if (!popup) {
                popup = document.createElement(popupElementName);
                document.body.appendChild(popup);
            }

            // for now just open the blank popup
            popup.open();

            // debug for now
            // eslint-disable-next-line no-console
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

            if (!window.customElements.get(popupElementName)) {
                window.customElements.define(popupElementName, UiSurveyPopup);
            }

            if (!window.customElements.get(generalSurveyElementName)) {
                window.customElements.define(generalSurveyElementName, UiSurvey);
            }

            // check if we already have the element (just defensive)
            const id = 'br-survey-' + webExId;
            let $survey = $('#' + id);
            if ($survey.length === 0) {

                // otherwise we add the element and attach it, if successful we continue
                $survey = $('<' + generalSurveyElementName + '/>').attr('id', id);
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
