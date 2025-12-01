"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded("uiSurvey")) {
        return;
    }

    const generalSurveyElementName = "br-ui-survey";
    const popupElementName = "br-ui-survey-popup";
    const $ = Breinify.UTL._jquery();

    class UiSurveyPopup extends HTMLElement {

        constructor() {
            super();

            this.attachShadow({mode: "open"});

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
                    /* -------------------------------------------------- */
                    /* Popup chrome (backdrop, dialog)                    */
                    /* -------------------------------------------------- */
                    :host {
                        display: none;
                        position: fixed;
                        inset: 0;
                        z-index: 2147483647; /* very high to be above most things */
                        font-family: inherit;
                    }

                    :host([open]) { display: block; }

                    .br-popup-backdrop {
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.45);
                    }

                    .br-popup-outer {
                        position: fixed;
                        inset: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        pointer-events: none;
                    }

                    .br-popup-dialog {
                        position: relative;
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

                    .br-popup-close {
                        position: absolute;
                        top: 0.5rem;
                        right: 0.5rem;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        font-size: 1.25rem;
                        line-height: 1;
                        padding: 0.25rem 0.5rem;
                    }

                    .br-popup-body {
                        padding: 1rem 1.25rem 1.25rem;
                        overflow: auto;
                    }

                    .br-popup-placeholder {
                        font-size: 0.95rem;
                        color: #666;
                        text-align: center;
                    }

                    .br-popup-footer {
                        padding: 0.75rem 1rem;
                        border-top: 1px solid #eee;
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        gap: 0.5rem;
                    }
                    
                    @media (max-width: 640px) {
                        .br-popup-outer { align-items: stretch; }
                    
                        .br-popup-dialog {
                            width: 100%;
                            max-width: 100%;
                            height: 100%;
                            max-height: 100%;
                            border-radius: 0;
                            box-shadow: none;
                        }
                    
                        .br-popup-body { flex: 1 1 auto; overflow: auto; }
                    }

                    ${this._ensurePageStyle()}
                </style>

                <div class="br-popup-backdrop" part="backdrop"></div>
                <div class="br-popup-outer">
                    <div class="br-popup-dialog" role="dialog" aria-modal="true">
                        <button type="button" class="br-popup-close" aria-label="Close survey">
                            &times;
                        </button>
                        <div class="br-popup-body">
                            <div class="br-popup-placeholder">
                                Survey content will appear here…
                            </div>
                        </div>
                        <div class="br-popup-footer">
                            <!-- Navigation and CTA controls will go here -->
                        </div>
                    </div>
                </div>
            `;

            this._bindBaseEvents();
        }

        /**
         * Styles for the survey pages rendered inside the popup body.
         * Any future page-related styling should go here.
         */
        _ensurePageStyle() {
            return `
                :host { --br-survey-answer-aspect-ratio: 1 / 1; }

                /* -------------------------------------------------- */
                /* Question page + answers                            */
                /* -------------------------------------------------- */
                .br-survey-page--question {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .br-survey-question-title {
                    font-size: 1.15rem;
                    font-weight: 600;
                    margin: .75rem 0 0.5rem;
                }

                .br-survey-answers {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-top: 0.25rem;
                }

                .br-survey-answer {
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

                .br-survey-answer:hover {
                    border-color: #d0d0d0;
                    background: #fdfdfd;
                    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.06);
                    transform: translateY(-1px);
                }

                .br-survey-answer--selected,
                .br-survey-answer--selected:hover {
                    border-color: #333;
                    background: #f5f5f5;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }

                .br-survey-answer:focus-visible {
                    outline: 2px solid #333;
                    outline-offset: 2px;
                }

                .br-survey-answer__title {
                    font-weight: 600;
                    font-size: 1rem;
                    margin: 0;
                    line-height: 1.25;
                }

                /* add spacing only when a description exists */
                .br-survey-answer--has-description .br-survey-answer__title {
                    margin-bottom: 0.2rem;
                }

                .br-survey-answer__description {
                    font-size: 0.85em;
                    color: #666;
                }

                .br-survey-answer__media {
                    flex: 0 0 80px;
                    max-width: 80px;
                    border-radius: 0.7rem;
                    overflow: hidden;
                    background: #f0f0f0;
                    aspect-ratio: var(--br-survey-answer-aspect-ratio, 1 / 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .br-survey-answer__media img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .br-survey-answer__content {
                    flex: 1 1 auto;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                /* title-only answers (no image, no description) */
                .br-survey-answer--simple {
                    align-items: center;
                    min-height: 56px;
                    padding-top: 0.7rem;
                    padding-bottom: 0.7rem;
                }
            `;
        }

        _bindBaseEvents() {
            const backdrop = this.shadowRoot.querySelector(".br-popup-backdrop");
            const closeBtn = this.shadowRoot.querySelector(".br-popup-close");

            if (backdrop) {
                backdrop.addEventListener("click", () => this.close());
            }
            if (closeBtn) {
                closeBtn.addEventListener("click", () => this.close());
            }
        }

        open() {
            if (!this.hasAttribute("open")) {
                this.setAttribute("open", "");
            }

            // Focus the dialog for accessibility
            const dialog = this.shadowRoot.querySelector(".br-popup-dialog");
            if (dialog && typeof dialog.focus === "function") {
                dialog.setAttribute("tabindex", "-1");
                dialog.focus();
            }
        }

        close() {
            if (this.hasAttribute("open")) {
                this.removeAttribute("open");
            }

            this.dispatchEvent(new CustomEvent("br-ui-survey:popup-closed", {
                bubbles: true,
                cancelable: false
            }));
        }

        /**
         * Replace the popup body with arbitrary content.
         */
        setBodyContent(contentNode) {
            const body = this.shadowRoot.querySelector(".br-popup-body");
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
            const footer = this.shadowRoot.querySelector(".br-popup-footer");
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
        $shadowRoot = null;
        settings = null;
        uuid = null;

        constructor() {
            super();

            this.attachShadow({mode: "open"});

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
            const styleId = "br-ui-survey-style";
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

                .br-survey-root { width: 100%; }
                .br-survey-container { width: 100%; }
                .br-survey-hidden { display: none !important; }

                /* -------------------------------------------------- */
                /* Trigger banner styling (desktop + mobile)          */
                /* -------------------------------------------------- */
                .br-survey-trigger {
                    display: inline-block;
                    cursor: pointer;
                    width: 100%;
                }

                .br-survey-trigger-image { width: 100%; height: auto; border: 0; }
                .br-survey-trigger-image.br-survey-trigger-desktop { display: block; }
                .br-survey-trigger-image.br-survey-trigger-mobile { display: none; }

                @media (max-width: 600px) {
                    .br-survey-trigger-image.br-survey-trigger-desktop { display: none; }
                    .br-survey-trigger-image.br-survey-trigger-mobile { display: block; }
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

            const $trigger = $("<div/>", {
                class: "br-survey-trigger",
                role: "button",
                tabindex: 0,
                "aria-label": "Start survey"
            });

            // Desktop image (required)
            if (desktopUrl) {
                $trigger.append($(`<img src="${desktopUrl}" class="br-survey-trigger-image br-survey-trigger-desktop" alt="Start survey"/>`));
            }

            // Mobile image (optional, fallback to desktop)
            if (mobileUrl) {
                $trigger.append($(`<img src="${mobileUrl}" class="br-survey-trigger-image br-survey-trigger-mobile" alt="Start survey"/>`));
            }

            // TODO: need to add activity renderElement

            $trigger.on("click", (evt) => {

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
            console.log("Survey trigger clicked:", this.uuid, "currentNodeId:", this._currentNodeId);
        }

        _renderCurrentPage(popup) {
            if (!popup || typeof popup.setBodyContent !== "function") {
                return;
            }

            const nodeId = Breinify.UTL.isNonEmptyString(this._currentNodeId);
            const node = nodeId !== null && this._nodesById ? this._nodesById[nodeId] : null;

            let contentNode;

            if (!$.isPlainObject(node)) {
                const fallback = document.createElement("div");
                fallback.className = "br-survey-page br-survey-page--error";
                fallback.textContent = "The survey is not correctly configured.";
                contentNode = fallback;
            } else if (node.type === "question") {
                contentNode = this._createQuestionPage(node);
            } else {
                const placeholder = document.createElement("div");
                placeholder.className = "br-survey-page br-survey-page--unsupported";
                placeholder.textContent = "This step type is not yet supported.";
                contentNode = placeholder;
            }

            popup.setBodyContent(contentNode);

            if (typeof popup.setFooterContent === "function") {
                // footer will stay empty for now – navigation comes later
                popup.setFooterContent(null);
            }
        }

        _createQuestionPage(node) {
            const data = $.isPlainObject(node.data) ? node.data : {};
            const questionText = Breinify.UTL.isNonEmptyString(data.question) || "";
            const answers = Array.isArray(data.answers) ? data.answers : [];

            const nodeId = Breinify.UTL.isNonEmptyString(node.id);
            const selectedAnswerId = nodeId !== null && this._selectedAnswers
                ? this._selectedAnswers[nodeId]
                : null;

            const container = document.createElement("div");
            container.className = "br-survey-page br-survey-page--question";

            const titleEl = document.createElement("h2");
            titleEl.className = "br-survey-question-title";
            titleEl.textContent = questionText;
            container.appendChild(titleEl);

            if (answers.length > 0) {
                const listEl = document.createElement("div");
                listEl.className = "br-survey-answers";

                answers.forEach((answer) => {
                    if (!$.isPlainObject(answer)) {
                        return;
                    }

                    const answerId = Breinify.UTL.isNonEmptyString(answer._id);
                    const title = Breinify.UTL.isNonEmptyString(answer.title) || "";
                    const desc = Breinify.UTL.isNonEmptyString(answer.description);
                    const imageUrl = Breinify.UTL.isNonEmptyString(answer.resourceUrl);

                    const hasImage = imageUrl !== null;
                    const hasDescription = desc !== null;

                    const itemEl = document.createElement("button");
                    itemEl.type = "button";
                    itemEl.className = "br-survey-answer";

                    if (!hasImage && !hasDescription) {
                        // special styling for title-only answers
                        itemEl.classList.add("br-survey-answer--simple");
                    }

                    if (hasDescription) {
                        itemEl.classList.add("br-survey-answer--has-description");
                    }

                    if (answerId !== null && selectedAnswerId !== null && answerId === selectedAnswerId) {
                        itemEl.classList.add("br-survey-answer--selected");
                    }

                    // optional media (image) on the left
                    if (hasImage) {
                        const mediaEl = document.createElement("div");
                        mediaEl.className = "br-survey-answer__media";

                        const imgEl = document.createElement("img");
                        imgEl.src = imageUrl;
                        imgEl.alt = title || "";
                        mediaEl.appendChild(imgEl);

                        itemEl.appendChild(mediaEl);
                    }

                    // content (title + description) on the right
                    const contentEl = document.createElement("div");
                    contentEl.className = "br-survey-answer__content";

                    const labelEl = document.createElement("div");
                    labelEl.className = "br-survey-answer__title";
                    labelEl.textContent = title;
                    contentEl.appendChild(labelEl);

                    if (hasDescription) {
                        const descEl = document.createElement("div");
                        descEl.className = "br-survey-answer__description";
                        descEl.textContent = desc;
                        contentEl.appendChild(descEl);
                    }

                    itemEl.appendChild(contentEl);

                    // selection handling
                    itemEl.addEventListener("click", () => {
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

            const buttons = container.querySelectorAll(".br-survey-answer");
            buttons.forEach((btn) => {
                if (btn === clickedButton) {
                    btn.classList.add("br-survey-answer--selected");
                } else {
                    btn.classList.remove("br-survey-answer--selected");
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
            const startNode = nodes.find((n) => $.isPlainObject(n) && n.type === "start");
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
            const $root = $('<div class="br-survey-root"></div>');

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

    Breinify.plugins._add("uiSurvey", {
        register: function (module, webExId, config) {

            if (!window.customElements.get(popupElementName)) {
                window.customElements.define(popupElementName, UiSurveyPopup);
            }

            if (!window.customElements.get(generalSurveyElementName)) {
                window.customElements.define(generalSurveyElementName, UiSurvey);
            }

            // check if we already have the element (just defensive)
            const id = "br-survey-" + webExId;
            let $survey = $("#" + id);
            if ($survey.length === 0) {

                // otherwise we add the element and attach it, if successful we continue
                $survey = $("<" + generalSurveyElementName + "/>").attr("id", id);
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
