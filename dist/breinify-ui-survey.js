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
                    
                    .br-ui-survey-popup__footer {
                        padding: 0.75rem 1rem;
                        border-top: 1px solid #eee;
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        gap: 0.5rem;
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
                    
                    @media (max-width: 640px) {
                        .br-ui-survey-popup__outer { align-items: stretch; }
                    
                        .br-ui-survey-popup__dialog {
                            width: 100%;
                            max-width: 100%;
                            height: 100%;
                            max-height: 100%;
                            border-radius: 0;
                            box-shadow: none;
                        }
                    
                        /* overflow: auto -> ensure it scrolls nicely if content is long */
                        .br-ui-survey-popup__body { flex: 1 1 auto; overflow: auto; }
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
                        <div class="br-ui-survey-popup__footer">
                            <!-- Navigation and CTA controls will go here -->
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

        /**
         * Replace the popup body with arbitrary content.
         */
        setBodyContent(contentNode) {
            const body = this.shadowRoot.querySelector('.br-ui-survey-popup__body');
            if (!body) {
                return;
            }

            // Clear current content
            while (body.firstChild) {
                body.removeChild(body.firstChild);
            }

            if (contentNode) {
                body.appendChild(contentNode);
            }
        }

        /**
         * Replace the popup footer with arbitrary content.
         */
        setFooterContent(contentNode) {
            const footer = this.shadowRoot.querySelector('.br-ui-survey-popup__footer');
            if (!footer) {
                return;
            }

            while (footer.firstChild) {
                footer.removeChild(footer.firstChild);
            }

            if (contentNode) {
                footer.appendChild(contentNode);
            }
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
            this._selectedAnswers = {};

            this._nodesById = {};
            this._edges = [];
            this._currentNodeId = null;
        }

        /**
         * Inject minimal default styles into the shadow root.
         * These are intentionally neutral so the component works
         * on any site without clashing with page styles.
         */
        _ensureBaseStyle() {
            const styleId = 'br-ui-survey-style';
            if (this.$shadowRoot.find('#' + styleId).length > 0) {
                return;
            }

            this.$shadowRoot.append($(`<style id="${styleId}">
                :host {
                    display: block;
                    box-sizing: border-box;
                    font-family: inherit;
                    color: inherit;
                    /* can be overridden from outside, e.g. 4 / 3, 16 / 9, 21 / 9 */
                    --br-ui-survey-answer-aspect-ratio: 1 / 1;
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
                
                /* -------------------------------------------------- */
                /* Question page + answers                            */
                /* -------------------------------------------------- */
                .br-ui-survey-page--question { display: flex; flex-direction: column; gap: 1rem; }
                
                .br-ui-survey-question__title {
                    font-size: 1.15rem;
                    font-weight: 600;
                    margin: 0 0 0.5rem;
                }
                
                .br-ui-survey-question__answers {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-top: 0.25rem;
                }
                
                .br-ui-survey-question__answer { 
                    text-align: left; 
                    width: 100%; 
                    border-radius: 0.9rem; 
                    border: 1px solid #e1e1e1; 
                    padding: 0.85rem 1rem; 
                    background: #ffffff; 
                    cursor: pointer; 
                    font: inherit; 
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    min-height: 80px;
                    appearance: none;
                    -webkit-appearance: none;
                    transition:
                        background 0.15s ease,
                        border-color 0.15s ease,
                        box-shadow 0.15s ease,
                        transform 0.15s ease;
                }
                
                .br-ui-survey-question__answer:hover {
                    border-color: #d0d0d0;
                    background: #fdfdfd;
                    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.06);
                    transform: translateY(-1px);
                }
                
                .br-ui-survey-question__answer--selected {
                    border-color: #333;
                    background: #f5f5f5;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }
                
                .br-ui-survey-question__answer:focus-visible {
                    outline: 2px solid #333;
                    outline-offset: 2px;
                }
                
                .br-ui-survey-question__answer-title {
                    font-weight: 600;
                    font-size: 1rem;
                    margin: 0 0 0.2rem;
                }
                
                .br-ui-survey-question__answer-description { font-size: 0.85em; color: #666; }
                
                /* media + content */
                .br-ui-survey-question__answer-media {
                    flex: 0 0 80px;
                    max-width: 80px;
                    border-radius: 0.7rem;
                    overflow: hidden;
                    background: #f0f0f0;
                    aspect-ratio: var(--br-ui-survey-answer-aspect-ratio, 1 / 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .br-ui-survey-question__answer-media img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                
                .br-ui-survey-question__answer-content {
                    flex: 1 1 auto;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                
                /* title-only answers (no image, no description) */
                .br-ui-survey-question__answer--simple {
                    align-items: center;
                    min-height: 56px;
                    padding-top: 0.7rem;
                    padding-bottom: 0.7rem;
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
         * Opens the survey and renders the current page.
         */
        _openSurvey() {

            // get or create a singleton popup element on <body>
            let popup = document.querySelector(popupElementName);

            if (!popup) {
                popup = document.createElement(popupElementName);
                document.body.appendChild(popup);
            }

            // determine current node if not yet set
            if (this._currentNodeId === null) {
                this._currentNodeId = this._findFirstNodeId();
            }

            // render whatever we have as current node (or an error if missing)
            this._renderCurrentPage(popup);

            // open the popup
            popup.open();

            // debug for now
            // eslint-disable-next-line no-console
            console.log('Survey trigger clicked:', this.uuid, 'currentNodeId:', this._currentNodeId);
        }

        _renderCurrentPage(popup) {
            if (!popup || typeof popup.setBodyContent !== 'function') {
                return;
            }

            const nodeId = Breinify.UTL.isNonEmptyString(this._currentNodeId);
            const node = nodeId !== null && this._nodesById ? this._nodesById[nodeId] : null;

            let contentNode;

            if (!$.isPlainObject(node)) {
                const fallback = document.createElement('div');
                fallback.className = 'br-ui-survey-page br-ui-survey-page--error';
                fallback.textContent = 'The survey is not correctly configured.';
                contentNode = fallback;
            } else if (node.type === 'question') {
                contentNode = this._createQuestionPage(node);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'br-ui-survey-page br-ui-survey-page--unsupported';
                placeholder.textContent = 'This step type is not yet supported.';
                contentNode = placeholder;
            }

            popup.setBodyContent(contentNode);

            if (typeof popup.setFooterContent === 'function') {
                // footer will stay empty for now – navigation comes later
                popup.setFooterContent(null);
            }
        }

        _createQuestionPage(node) {
            const data = $.isPlainObject(node.data) ? node.data : {};
            const questionText = Breinify.UTL.isNonEmptyString(data.question) || '';
            const answers = Array.isArray(data.answers) ? data.answers : [];

            const nodeId = Breinify.UTL.isNonEmptyString(node.id);
            const selectedAnswerId = nodeId !== null && this._selectedAnswers
                ? this._selectedAnswers[nodeId]
                : null;

            const container = document.createElement('div');
            container.className = 'br-ui-survey-page br-ui-survey-page--question';

            const titleEl = document.createElement('h2');
            titleEl.className = 'br-ui-survey-question__title';
            titleEl.textContent = questionText;
            container.appendChild(titleEl);

            if (answers.length > 0) {
                const listEl = document.createElement('div');
                listEl.className = 'br-ui-survey-question__answers';

                answers.forEach((answer) => {
                    if (!$.isPlainObject(answer)) {
                        return;
                    }

                    const answerId = Breinify.UTL.isNonEmptyString(answer._id);
                    const title = Breinify.UTL.isNonEmptyString(answer.title) || '';
                    const desc = Breinify.UTL.isNonEmptyString(answer.description);
                    const imageUrl = Breinify.UTL.isNonEmptyString(answer.resourceUrl);

                    const hasImage = imageUrl !== null;
                    const hasDescription = desc !== null;

                    const itemEl = document.createElement('button');
                    itemEl.type = 'button';
                    itemEl.className = 'br-ui-survey-question__answer';

                    if (!hasImage && !hasDescription) {
                        // special styling for title-only answers
                        itemEl.classList.add('br-ui-survey-question__answer--simple');
                    }

                    if (answerId !== null && selectedAnswerId !== null && answerId === selectedAnswerId) {
                        itemEl.classList.add('br-ui-survey-question__answer--selected');
                    }

                    // optional media (image) on the left
                    if (hasImage) {
                        const mediaEl = document.createElement('div');
                        mediaEl.className = 'br-ui-survey-question__answer-media';

                        const imgEl = document.createElement('img');
                        imgEl.src = imageUrl;
                        imgEl.alt = title || '';
                        mediaEl.appendChild(imgEl);

                        itemEl.appendChild(mediaEl);
                    }

                    // content (title + description) on the right
                    const contentEl = document.createElement('div');
                    contentEl.className = 'br-ui-survey-question__answer-content';

                    const labelEl = document.createElement('div');
                    labelEl.className = 'br-ui-survey-question__answer-title';
                    labelEl.textContent = title;
                    contentEl.appendChild(labelEl);

                    if (hasDescription) {
                        const descEl = document.createElement('div');
                        descEl.className = 'br-ui-survey-question__answer-description';
                        descEl.textContent = desc;
                        contentEl.appendChild(descEl);
                    }

                    itemEl.appendChild(contentEl);

                    // selection handling
                    itemEl.addEventListener('click', () => {
                        this._handleAnswerClick(nodeId, answerId, container, itemEl);
                    });

                    listEl.appendChild(itemEl);
                });

                container.appendChild(listEl);
            }

            return container;
        }

        _handleAnswerClick(nodeId, answerId, container, clickedButton) {
            if (nodeId === null || answerId === null) {
                return;
            }

            if (!$.isPlainObject(this._selectedAnswers)) {
                this._selectedAnswers = {};
            }

            this._selectedAnswers[nodeId] = answerId;

            if (!container || !container.querySelectorAll) {
                return;
            }

            const buttons = container.querySelectorAll('.br-ui-survey-question__answer');
            buttons.forEach((btn) => {
                if (btn === clickedButton) {
                    btn.classList.add('br-ui-survey-question__answer--selected');
                } else {
                    btn.classList.remove('br-ui-survey-question__answer--selected');
                }
            });
        }

        _findFirstNodeId() {

            if (!$.isPlainObject(this.settings) || !$.isPlainObject(this.settings.survey) ||
                !Array.isArray(this.settings.survey.nodes) || !Array.isArray(this._edges)) {
                return null;
            }

            const nodes = this.settings.survey.nodes;

            // find the start node in the nodes array
            const startNode = nodes.find((n) => $.isPlainObject(n) && n.type === 'start');
            if (!$.isPlainObject(startNode)) {
                return null;
            }

            // make sure the node has an id
            const startNodeId = Breinify.UTL.isNonEmptyString(startNode.id);
            if (startNodeId === null) {
                return null;
            }

            // find the first edge leaving the start node
            const edge = this._edges.find((e) => $.isPlainObject(e) && e.source === startNodeId);

            return $.isPlainObject(edge) ? Breinify.UTL.isNonEmptyString(edge.target) : null;
        }

        _loadStructureFromSettings() {

            // prepare survey graph structures
            this._nodesById = {};
            this._edges = [];
            this._currentNodeId = null;
            this._selectedAnswers = {};

            if (!$.isPlainObject(this.settings) || !$.isPlainObject(this.settings.survey)) {
                return;
            }

            if (Array.isArray(this.settings.survey.nodes)) {
                this.settings.survey.nodes.forEach((node) => {
                    if (node && node.id) {
                        this._nodesById[node.id] = node;
                    }
                });
            }

            if (Array.isArray(this.settings.survey.edges)) {
                this._edges = this.settings.survey.edges.slice();
            }
        }

        render(webExId, settings) {
            this.settings = settings;
            this.uuid = webExId;
            this.$shadowRoot.empty();

            // first add the base style and load structure
            this._ensureBaseStyle();
            this._loadStructureFromSettings();

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
