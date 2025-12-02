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

            // configuration flags (set from UiSurvey via settings.popup)
            this.closeOnBackgroundClick = false; // default behavior: don't close on background
            this.resetOnClose = true;           // informational; actual reset is handled in UiSurvey

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
                        /* base font-size for everything inside the popup */
                        --br-ui-base-font-size: 20px;
                        font-size: var(--br-ui-base-font-size);
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
                        top: 0;
                        right: 0;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        font-size: 1.25em;
                        line-height: 1;
                        padding: 0.25em 0.5em;
                    }

                    .br-popup-body {
                        padding: 1em 1.25em 1.25em;
                        overflow: auto;
                    }

                    .br-popup-placeholder {
                        font-size: 0.95em;
                        color: #666;
                        text-align: center;
                    }

                    .br-popup-footer {
                        padding: 0.5em 1em;
                        border-top: 1px solid #eee;
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        gap: 0.5em;
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
                :host {
                    --br-survey-answer-aspect-ratio: 1 / 1;
                    --br-survey-line-height-base: 1.4;
                    --br-survey-line-height-tight: 1.2;
                }

                /* -------------------------------------------------- */
                /* Question page + answers                            */
                /* -------------------------------------------------- */
                .br-survey-page--question {
                    display: flex;
                    flex-direction: column;
                    gap: 1em;
                    line-height: var(--br-survey-line-height-base);
                }

                .br-survey-question-title {
                    font-size: 1.15em;
                    font-weight: 600;
                    margin: 0.75em 0 0.5em;
                    line-height: var(--br-survey-line-height-tight);
                }

                .br-survey-answers {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75em;
                    margin-top: 0.25em;
                }

                .br-survey-answer {
                    text-align: left;
                    width: 100%;
                    border-radius: 0.9em;
                    border: 1px solid #e1e1e1;
                    padding: 0.85em 1em;
                    background: #ffffff;
                    cursor: pointer;
                    font: inherit;
                    display: flex;
                    align-items: center;
                    gap: 1em;
                    min-height: 4em;
                    appearance: none;
                    -webkit-appearance: none;
                    line-height: var(--br-survey-line-height-base);
                    transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
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
                    font-size: .9em;
                    margin: 0;
                    line-height: var(--br-survey-line-height-tight);
                }

                /* add spacing only when a description exists */
                .br-survey-answer--has-description .br-survey-answer__title {
                    margin-bottom: 0.2em;
                }
                
                /* reduce padding if an image exists */
                .br-survey-answer--has-image {
                    padding: 0.5em 1em 0.5em 0.5em;
                }

                .br-survey-answer__description {
                    font-size: 0.7em;
                    color: #666;
                    line-height: var(--br-survey-line-height-base);
                }

                .br-survey-answer__media {
                    flex: 0 0 4em;
                    max-width: 4em;
                    border-radius: 0.7em;
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
                    min-height: 2.8em;
                    padding-top: 0.7em;
                    padding-bottom: 0.7em;
                }

                /* -------------------------------------------------- */
                /* Recommendation page + skeleton                     */
                /* -------------------------------------------------- */
                .br-survey-page--recommendation {
                    display: flex;
                    flex-direction: column;
                    gap: 1em;
                    line-height: var(--br-survey-line-height-base);
                }

                .br-survey-reco-title {
                    font-size: 1.05em;
                    font-weight: 600;
                    margin: 0.75em 0 0.4em;
                    line-height: var(--br-survey-line-height-tight);
                }

                .br-survey-reco-subtitle {
                    font-size: 0.7em;
                    color: #777;
                    margin: 0 0 0.5em;
                }

                .br-survey-reco-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(8em, 1fr));
                    gap: 0.75em;
                }

                .br-survey-skeleton-card {
                    border-radius: 0.75em;
                    border: 1px solid #eee;
                    padding: 0.6em;
                    background: #f9f9f9;
                    overflow: hidden;
                }

                .br-survey-skeleton-thumb {
                    width: 100%;
                    aspect-ratio: 1 / 1;
                    border-radius: 0.6em;
                    background: linear-gradient(90deg, #f0f0f0 0%, #e6e6e6 50%, #f0f0f0 100%);
                    background-size: 200% 100%;
                    animation: br-survey-skeleton-pulse 1.4s ease-in-out infinite;
                    margin-bottom: 0.5em;
                }

                .br-survey-skeleton-line {
                    height: 0.55em;
                    border-radius: 0.4em;
                    background: linear-gradient(90deg, #f0f0f0 0%, #e6e6e6 50%, #f0f0f0 100%);
                    background-size: 200% 100%;
                    animation: br-survey-skeleton-pulse 1.4s ease-in-out infinite;
                    margin-bottom: 0.35em;
                }

                .br-survey-skeleton-line--short {
                    width: 60%;
                }

                .br-survey-skeleton-line--medium {
                    width: 80%;
                }

                @keyframes br-survey-skeleton-pulse {
                    0% {
                        background-position: 200% 0;
                    }
                    100% {
                        background-position: -200% 0;
                    }
                }

                .br-survey-reco-card {
                    border-radius: 0.75em;
                    border: 1px solid #eee;
                    padding: 0.6em;
                    background: #fff;
                    display: flex;
                    flex-direction: column;
                    gap: 0.4em;
                }

                .br-survey-reco-card-thumb {
                    width: 100%;
                    aspect-ratio: 1 / 1;
                    border-radius: 0.6em;
                    background: #f2f2f2;
                    overflow: hidden;
                }

                .br-survey-reco-card-thumb-inner {
                    width: 100%;
                    height: 100%;
                    background: #ddd;
                }
                
                .br-survey-reco-card-thumb-inner img {
                    width: 100%;
                }

                .br-survey-reco-card-title {
                    font-size: 0.8em;
                    font-weight: 600;
                    margin: 0;
                }

                .br-survey-reco-card-meta {
                    font-size: 0.7em;
                    color: #777;
                }

                /* -------------------------------------------------- */
                /* Footer controls                                    */
                /* -------------------------------------------------- */
                .br-survey-footer-controls {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 0.5em;
                    width: 100%;
                }

                .br-survey-footer-controls--with-hint {
                    justify-content: flex-end;
                }

                .br-survey-footer-controls--with-hint .br-survey-hint {
                    margin-right: auto; /* push buttons to the right, keep their own gap */
                }

                .br-survey-hint {
                    font-size: 0.55em;
                    color: #999;
                    line-height: var(--br-survey-line-height-tight);
                    max-width: 60%;
                    white-space: normal;
                    text-align: left;
                    /* reserve enough height so footer doesn't jump */
                    min-height: 2.4em; /* tweak as needed for two lines */
                }
                
                .br-survey-hint-title {
                    font-weight: 600;
                    margin: 0 0 0.15em;
                }
                
                .br-survey-hint-list {
                    margin: 0;
                    padding: 0 0 0 1.1em; /* indent bullets only */
                    list-style: disc;
                }
                
                .br-survey-hint-list li {
                    margin: 0.1em 0;
                    padding: 0;
                    text-indent: 0;
                    white-space: normal;
                    line-height: var(--br-survey-line-height-tight);
                }
                
                /* invisible, but preserves layout/height */
                .br-survey-hint--hidden {
                    visibility: hidden;
                }

                .br-survey-btn {
                    padding: 0.45em 1em;
                    border-radius: 0.45em;
                    border: 1px solid #ccc;
                    background: #f7f7f7;
                    cursor: pointer;
                    font: inherit;
                    font-size: 0.75em;
                    line-height: var(--br-survey-line-height-tight);
                    transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
                }

                .br-survey-btn:hover {
                    background: #ffffff;
                    border-color: #999;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
                    transform: translateY(-0.5px);
                }

                .br-survey-btn:focus-visible {
                    outline: 2px solid #333;
                    outline-offset: 2px;
                }

                .br-survey-btn--next {
                    background: #333;
                    color: #fff;
                    border-color: #333;
                }

                .br-survey-btn--next:hover {
                    background: #000;
                    border-color: #000;
                }

                /* disabled state: softer color, no hover, not-allowed cursor */
                .br-survey-btn--next:disabled,
                .br-survey-btn--next[disabled] {
                    background: #ddd;
                    border-color: #ddd;
                    color: #999;
                    cursor: not-allowed;
                    box-shadow: none;
                    transform: none;
                }

                .br-survey-btn--next:disabled:hover,
                .br-survey-btn--next[disabled]:hover {
                    background: #ddd;
                    border-color: #ddd;
                    box-shadow: none;
                    transform: none;
                }

                .br-survey-btn--back {
                    background: transparent;
                    border-color: #bbb;
                }

                .br-survey-btn--back:hover {
                    background: #eee;
                }
                
                /* ensure popup body scrolls smoothly */
                .br-popup-body {
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                }
            `;
        }

        _bindBaseEvents() {
            const backdrop = this.shadowRoot.querySelector(".br-popup-backdrop");
            const closeBtn = this.shadowRoot.querySelector(".br-popup-close");

            if (backdrop) {
                backdrop.addEventListener("click", () => {
                    // desktop-only behavior for background-close
                    if (window.innerWidth && window.innerWidth <= 640) {
                        return;
                    }
                    if (this._shouldCloseOnBackgroundClick()) {
                        this.close();
                    }
                });
            }
            if (closeBtn) {
                closeBtn.addEventListener("click", () => this.close());
            }
        }

        /**
         * Decide if backdrop click should close the popup.
         * Defaults to false unless explicitly overridden.
         */
        _shouldCloseOnBackgroundClick() {
            if (typeof this.closeOnBackgroundClick === "boolean") {
                return this.closeOnBackgroundClick;
            }
            return false;
        }

        open() {
            if (!this.hasAttribute("open")) {
                this.setAttribute("open", "");
            }

            document.body.classList.add("br-survey-scroll-lock");

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

            document.body.classList.remove("br-survey-scroll-lock");

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
            this._history = [];

            this._resetOnClose = true;

            // history integration
            this._historyIntegrationAttached = false;
            this._boundPopStateHandler = null;
            this._sessionId = null;
        }

        disconnectedCallback() {
            if (this._boundPopStateHandler) {
                window.removeEventListener("popstate", this._boundPopStateHandler);
                this._boundPopStateHandler = null;
            }
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
                    /* allow integrator to override if needed */
                    --br-ui-base-font-size: 20px;
                    font-size: var(--br-ui-base-font-size);
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
         * Helper to read popup.closeOnBackgroundClick from config.
         * default: false
         */
        _getCloseOnBackgroundClickSetting() {
            if ($.isPlainObject(this.settings) &&
                $.isPlainObject(this.settings.popup) &&
                typeof this.settings.popup.closeOnBackgroundClick === "boolean") {
                return this.settings.popup.closeOnBackgroundClick;
            }
            return false;
        }

        /**
         * Helper to read popup.resetOnClose from config.
         * default: true
         */
        _getResetOnCloseSetting() {
            if ($.isPlainObject(this.settings) &&
                $.isPlainObject(this.settings.popup) &&
                typeof this.settings.popup.resetOnClose === "boolean") {
                return this.settings.popup.resetOnClose;
            }
            return true;
        }

        /**
         * Reset dynamic survey state for a new session.
         * Keeps nodes/edges, resets position + selections.
         */
        _resetSurveyState() {
            this._currentNodeId = null;
            this._selectedAnswers = {};
            this._history = [];
            this._sessionId = null;
        }

        /**
         * Ensure we are listening to popstate exactly once.
         */
        _ensureHistoryIntegration() {
            if (this._historyIntegrationAttached) {
                return;
            }

            this._historyIntegrationAttached = true;
            this._boundPopStateHandler = (event) => this._onPopState(event);
            window.addEventListener("popstate", this._boundPopStateHandler);
        }

        /**
         * Start a new survey session id, if none exists yet.
         */
        _ensureSessionId() {
            if (this._sessionId) {
                return;
            }
            this._sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 5);
        }

        /**
         * Push a history entry for the current node.
         */
        _pushHistoryStateForCurrentPage() {
            if (typeof window === "undefined" || !window.history) {
                return;
            }

            const nodeId = Breinify.UTL.isNonEmptyString(this._currentNodeId);
            const state = {
                brUiSurvey: true,
                webExId: this.uuid,
                nodeId: nodeId,
                sessionId: this._sessionId
            };

            try {
                window.history.pushState(state, "", window.location.href);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn("Unable to pushState for survey navigation:", e);
            }
        }

        /**
         * Handle browser Back/Forward.
         */
        _onPopState(event) {
            const popup = document.querySelector(popupElementName);
            const state = event.state;

            // Case 1: This popstate belongs to some survey state
            if (state && state.brUiSurvey === true) {
                // If it belongs to another survey instance, ignore it
                if (state.webExId !== this.uuid) {
                    return;
                }

                // If it is from an "old" session, ignore and make sure we're reset
                if (!this._sessionId || !state.sessionId || state.sessionId !== this._sessionId) {
                    if (popup && popup.hasAttribute("open")) {
                        popup.close();
                    }
                    this._resetSurveyState();
                    return;
                }

                const nodeId = Breinify.UTL.isNonEmptyString(state.nodeId);
                if (!nodeId || !this._nodesById || !this._nodesById[nodeId]) {
                    return;
                }

                // no-op if we're already on that page
                if (this._currentNodeId === nodeId) {
                    return;
                }

                if (Array.isArray(this._history) &&
                    this._history.length > 0 &&
                    this._history[this._history.length - 1] === nodeId) {
                    // BACK: step back in our intra-survey history
                    this._currentNodeId = this._history.pop();
                } else if (this._currentNodeId) {
                    // FORWARD: move forward from the current node
                    this._history.push(this._currentNodeId);
                    this._currentNodeId = nodeId;
                } else {
                    // Initial survey state for this instance (e.g., entering via Forward)
                    this._currentNodeId = nodeId;
                }

                if (popup) {
                    this._renderCurrentPage(popup);
                    if (!popup.hasAttribute("open")) {
                        popup.open();
                    }
                }

                return;
            }

            // Case 2: We left survey history (state is null or not brUiSurvey)
            if (popup && popup.hasAttribute("open")) {
                popup.close();
            }
            this._resetSurveyState();
        }

        /**
         * Return an array of "page nodes" (currently just question nodes).
         */
        _getPageNodes() {
            if (!$.isPlainObject(this.settings) ||
                !$.isPlainObject(this.settings.survey) ||
                !Array.isArray(this.settings.survey.nodes)) {
                return [];
            }

            // for now we treat "question" as a page; can be extended later
            return this.settings.survey.nodes.filter(function (n) {
                return $.isPlainObject(n) && n.type === "question";
            });
        }

        _getTotalPageCount() {
            return this._getPageNodes().length;
        }

        _getPageIndex(nodeId) {
            if (!nodeId) {
                return -1;
            }
            const nodes = this._getPageNodes();
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if ($.isPlainObject(n) && n.id === nodeId) {
                    return i;
                }
            }
            return -1;
        }

        _getAnswerFromNode(node, answerId) {
            if (!$.isPlainObject(node) ||
                !$.isPlainObject(node.data) ||
                !Array.isArray(node.data.answers) ||
                !answerId) {
                return null;
            }

            const answers = node.data.answers;
            for (let i = 0; i < answers.length; i++) {
                const a = answers[i];
                if ($.isPlainObject(a) && a._id === answerId) {
                    return a;
                }
            }
            return null;
        }

        _fireRenderedEvent() {
            this.dispatchEvent(new CustomEvent("br-ui-survey:rendered", {
                bubbles: true,
                cancelable: false,
                detail: {
                    webExId: this.uuid
                }
            }));
        }

        _fireOpenedEvent() {
            const nodeId = Breinify.UTL.isNonEmptyString(this._currentNodeId);
            const node = nodeId !== null && this._nodesById ? this._nodesById[nodeId] : null;

            this.dispatchEvent(new CustomEvent("br-ui-survey:opened", {
                bubbles: true,
                cancelable: false,
                detail: {
                    webExId: this.uuid,
                    nodeId: nodeId,
                    pageType: node && node.type ? node.type : null,
                    pageIndex: this._getPageIndex(nodeId),
                    totalPages: this._getTotalPageCount()
                }
            }));
        }

        _fireAnswerSelectedEvent(nodeId, answerId) {
            const resolvedNodeId = Breinify.UTL.isNonEmptyString(nodeId);
            const node = resolvedNodeId !== null && this._nodesById ? this._nodesById[resolvedNodeId] : null;
            const answer = this._getAnswerFromNode(node, answerId);

            this.dispatchEvent(new CustomEvent("br-ui-survey:answer-selected", {
                bubbles: true,
                cancelable: false,
                detail: {
                    webExId: this.uuid,
                    nodeId: resolvedNodeId,
                    pageType: node && node.type ? node.type : null,
                    pageIndex: this._getPageIndex(resolvedNodeId),
                    totalPages: this._getTotalPageCount(),
                    answerId: answerId,
                    answer: answer || null
                }
            }));
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

            // configure popup behavior from settings
            popup.closeOnBackgroundClick = this._getCloseOnBackgroundClickSetting();
            this._resetOnClose = this._getResetOnCloseSetting();

            // listen for popup close to optionally reset state
            const handleClosed = () => {
                if (this._resetOnClose) {
                    this._resetSurveyState();
                }
                popup.removeEventListener("br-ui-survey:popup-closed", handleClosed);
            };
            popup.addEventListener("br-ui-survey:popup-closed", handleClosed);

            // determine current node if not yet set
            if (this._currentNodeId === null) {
                this._currentNodeId = this._findFirstNodeId();
            }

            // start a new session if needed
            this._ensureSessionId();

            // render whatever we have as current node (or an error if missing)
            this._renderCurrentPage(popup);

            // history integration
            this._ensureHistoryIntegration();
            this._pushHistoryStateForCurrentPage();

            // open the popup
            popup.open();

            // fire opened-event once popup and first page are visible
            this._fireOpenedEvent();

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

            if (!$.isPlainObject(node)) {
                const fallback = document.createElement("div");
                fallback.className = "br-survey-page br-survey-page--error";
                fallback.textContent = "The survey is not correctly configured.";
                popup.setBodyContent(fallback);
            } else if (node.type === "question") {
                const questionPage = this._createQuestionPage(node);
                popup.setBodyContent(questionPage);
            } else if (node.type === "recommendation") {
                const recLoadingPage = this._createRecommendationPage(node);
                this._requestRecommendations(popup, recLoadingPage, node);
            } else {
                const placeholder = document.createElement("div");
                placeholder.className = "br-survey-page br-survey-page--unsupported";
                placeholder.textContent = "This step type is not yet supported.";
                popup.setBodyContent(placeholder);
            }

            if (typeof popup.setFooterContent === "function") {
                const footerNode = this._createFooterControls(node);
                popup.setFooterContent(footerNode);
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
                        itemEl.classList.add("br-survey-answer--has-image");

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

                    // selection handling on single tap/click
                    itemEl.addEventListener("click", () => {
                        this._handleAnswerClick(nodeId, answerId, container, itemEl);
                    });

                    // double-tap / double-click to go forward immediately
                    itemEl.addEventListener("dblclick", (evt) => {
                        evt.preventDefault();
                        this._handleAnswerDoubleClick(nodeId, answerId);
                    });

                    listEl.appendChild(itemEl);
                });

                container.appendChild(listEl);
            }

            return container;
        }

        /**
         * Create a recommendation page.
         * Step 1: show skeleton
         * Step 2 (fake async): replace with placeholder "results"
         */
        _createRecommendationPage(node) {
            const data = $.isPlainObject(node.data) ? node.data : {};
            const titleText = Breinify.UTL.isNonEmptyString(data.title)
                || "Finding recommendations for you…";
            const subtitleText = Breinify.UTL.isNonEmptyString(data.subtitle)
                || "We are matching your answers with the best products.";

            const container = document.createElement("div");
            container.className = "br-survey-page br-survey-page--recommendation";

            const titleEl = document.createElement("h2");
            titleEl.className = "br-survey-reco-title";
            titleEl.textContent = titleText;
            container.appendChild(titleEl);

            const subtitleEl = document.createElement("div");
            subtitleEl.className = "br-survey-reco-subtitle";
            subtitleEl.textContent = subtitleText;
            container.appendChild(subtitleEl);

            // skeleton grid
            const grid = document.createElement("div");
            grid.className = "br-survey-reco-grid";

            const skeletonCardCount = 3;
            for (let i = 0; i < skeletonCardCount; i++) {
                const card = document.createElement("div");
                card.className = "br-survey-skeleton-card";

                const thumb = document.createElement("div");
                thumb.className = "br-survey-skeleton-thumb";
                card.appendChild(thumb);

                const line1 = document.createElement("div");
                line1.className = "br-survey-skeleton-line br-survey-skeleton-line--medium";
                card.appendChild(line1);

                const line2 = document.createElement("div");
                line2.className = "br-survey-skeleton-line br-survey-skeleton-line--short";
                card.appendChild(line2);

                grid.appendChild(card);
            }

            container.appendChild(grid);

            return container;
        }

        _requestRecommendations(popup, container, node) {

            // get the data to be used for the page
            const data = $.isPlainObject(node.data) ? node.data : {};

            // attach the container
            popup.setBodyContent(container);
            const $container = $(container);
            const $grid = $container.find('.br-survey-reco-grid');

            // create the payload for the recommender
            const itemSnippetId = Breinify.UTL.isNonEmptyString(data.renderResultSnippet);
            const preconfig = Breinify.UTL.isNonEmptyString(data.preconfiguredRecommendation);
            const queryLabel = Breinify.UTL.isNonEmptyString(data.queryLabel) || preconfig;
            const recPayload = {
                recommendationQueryName: queryLabel,
                namedRecommendations: [
                    preconfig
                ]
            };

            // determine the product snippet to use
            let snippet = Breinify.plugins.snippetManager.getSnippet(itemSnippetId);
            if (snippet === null) {
                snippet = function() {
                    return '' +
                        '<div class="br-survey-reco-card">' +
                        '  <div class="br-survey-reco-card-thumb">' +
                        '    <div class="br-survey-reco-card-thumb-inner"><img src="%%image%%" alt="%%name%%"/></div>' +
                        '  </div>' +
                        '  <div class="br-survey-reco-card-title">%%name%%</div>' +
                        '  <div class="br-survey-reco-card-meta">Placeholder result from "General: Most Popular"</div>' +
                        '</div>';
                }
            }

            // fire it and handle the result
            Breinify.plugins.recommendations.render({
                position: {
                    append: function() {
                        return $container;
                    }
                },
                templates: {
                    container: function() {
                        return $grid;
                    },
                    item: snippet
                },
                recommender: {
                    payload: recPayload
                },
                process: {
                    attachedContainer: function() {
                        $grid.empty();
                    }
                }
            });
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

            // update only the footer (to show Next + hint) without re-rendering the body
            const popup = document.querySelector(popupElementName);
            if (popup && typeof popup.setFooterContent === "function") {
                const node = this._nodesById[nodeId];
                const footerNode = this._createFooterControls(node);
                popup.setFooterContent(footerNode);
            }
        }

        /**
         * Double-tap handler: move to next step using the selected answer.
         */
        _handleAnswerDoubleClick(nodeId, answerId) {
            if (nodeId === null || answerId === null) {
                return;
            }

            // go forward directly, same as pressing "Next" for this answer
            this._goForward(nodeId, answerId);
        }

        /**
         * Create footer controls (Back / Next) based on current node + state.
         * Also shows a small hint when an answer is selected.
         */
        _createFooterControls(node) {
            const wrapper = document.createElement("div");
            wrapper.className = "br-survey-footer-controls";

            if (!$.isPlainObject(node)) {
                return wrapper;
            }

            const nodeId = Breinify.UTL.isNonEmptyString(node.id);
            const nodeType = Breinify.UTL.isNonEmptyString(node.type) || node.type || null;
            const selectedAnswerId = nodeId !== null && this._selectedAnswers
                ? Breinify.UTL.isNonEmptyString(this._selectedAnswers[nodeId])
                : null;

            // ------------------------------------------------------------
            // Hint block: always present to keep footer height stable
            // - visible with content on question pages
            // - invisible (but space reserved) on other pages
            // ------------------------------------------------------------
            const hintEl = document.createElement("div");
            hintEl.className = "br-survey-hint";

            const titleEl = document.createElement("div");
            titleEl.className = "br-survey-hint-title";
            titleEl.textContent = "Tips:";

            const list = document.createElement("ul");
            list.className = "br-survey-hint-list";

            const li1 = document.createElement("li");
            const li2 = document.createElement("li");

            list.appendChild(li1);
            list.appendChild(li2);

            hintEl.appendChild(titleEl);
            hintEl.appendChild(list);

            if (nodeType === "question") {
                li1.textContent = "single tap to select";
                li2.textContent = "double tap to select & answer";

                wrapper.classList.add("br-survey-footer-controls--with-hint");
            } else {
                li1.textContent = "...";
                li2.textContent = "...";

                // keep same footprint but hide visually
                hintEl.classList.add("br-survey-hint--hidden");
            }

            wrapper.appendChild(hintEl);

            // ------------------------------------------------------------
            // Back button when we have history
            // ------------------------------------------------------------
            if (Array.isArray(this._history) && this._history.length > 0) {
                const btnBack = document.createElement("button");
                btnBack.type = "button";
                btnBack.className = "br-survey-btn br-survey-btn--back";
                btnBack.textContent = "Back";

                btnBack.addEventListener("click", () => {
                    this._goBack();
                });

                wrapper.appendChild(btnBack);
            }

            // ------------------------------------------------------------
            // Next button only when an answer is selected (for questions)
            // ------------------------------------------------------------
            if (nodeType === "question") {
                const btnNext = document.createElement("button");
                btnNext.type = "button";
                btnNext.className = "br-survey-btn br-survey-btn--next";
                btnNext.textContent = "Next";
                btnNext.disabled = selectedAnswerId === null;

                btnNext.addEventListener("click", () => {
                    this._goForward(nodeId, selectedAnswerId);
                });

                wrapper.appendChild(btnNext);
            }

            return wrapper;
        }

        _goForward(nodeId, answerId) {
            if (!nodeId || !answerId) {
                return;
            }

            // fire "answer-selected" event tied to this page transition
            this._fireAnswerSelectedEvent(nodeId, answerId);

            const nextNodeId = this._getNextNodeIdFromAnswer(nodeId, answerId);

            if (nextNodeId !== null) {
                // remember where we came from (intra-survey history)
                if (!Array.isArray(this._history)) {
                    this._history = [];
                }
                this._history.push(nodeId);
                this._currentNodeId = nextNodeId;

                const popup = document.querySelector(popupElementName);
                if (popup) {
                    this._renderCurrentPage(popup);
                }

                // push new history entry so browser Back goes to previous page
                this._pushHistoryStateForCurrentPage();
            } else {
                // TODO: later this is a good place to fire "finalized survey" when end state is well-defined
                // eslint-disable-next-line no-console
                console.warn("No next edge found for", nodeId, answerId);
            }
        }

        _goBack() {
            if (typeof window !== "undefined" &&
                window.history &&
                typeof window.history.back === "function") {
                window.history.back();
            }
        }

        /**
         * Try to resolve next node id from edges + answer.
         * Supports common edge shapes and falls back
         * to "first edge from node" if nothing matches.
         */
        _getNextNodeIdFromAnswer(nodeId, answerId) {
            if (!nodeId || !answerId || !Array.isArray(this._edges)) {
                return null;
            }

            // Match any edge that:
            // - comes from the current node AND
            // - references this answer in one of the known fields
            let edge = this._edges.find((e) => {
                if (!$.isPlainObject(e) || e.source !== nodeId) {
                    return false;
                }

                if (e.answer === answerId) {
                    return true;
                }
                if (e.answerId === answerId) {
                    return true;
                }
                if (e.sourceHandle === answerId) {
                    return true;
                }

                if ($.isPlainObject(e.data)) {
                    if (e.data.answerId === answerId) {
                        return true;
                    }
                    if (e.data.sourceAnswerId === answerId) {
                        return true;
                    }
                }

                return false;
            });

            // Fallback: any outgoing edge from this node
            if (!edge) {
                edge = this._edges.find((e) =>
                    $.isPlainObject(e) &&
                    e.source === nodeId
                );
            }

            return $.isPlainObject(edge)
                ? Breinify.UTL.isNonEmptyString(edge.target)
                : null;
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
            this._history = [];
            // do not touch _sessionId here: it is per "render config" not per structure

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

            // fire "rendered" once banner is actually in the DOM
            this._fireRenderedEvent();

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
            const webExElId = "br-survey-" + webExId;
            const globalStyleId = "br-survey-global-style";
            if ($('#' + globalStyleId).length === 0) {
                $('body').prepend(`
                  <style id="${globalStyleId}">
                    .br-survey-scroll-lock { overflow: hidden !important; touch-action: none !important; overscroll-behavior: none !important; }
                  </style>
                `);
            }

            let $survey = $("#" + webExElId);
            if ($survey.length === 0) {

                // otherwise we add the element and attach it, if successful we continue
                $survey = $("<" + generalSurveyElementName + "/>").attr("id", webExElId);
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
