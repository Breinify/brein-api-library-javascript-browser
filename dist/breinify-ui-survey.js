"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("uiSurvey")) {
        return;
    }

    const generalSurveyElementName = "br-ui-survey";
    const popupElementName = "br-ui-survey-popup";
    const $ = Breinify.UTL._jquery();

    const selectedAnswersCss = `
        .br-survey-selected-answers {
            container: br-survey-selected-answers / inline-size;
            margin: 0 0 0.75em;
            padding: 0.75em;
            border: 1px solid #e1e1e1;
            border-radius: 0.9em;
            background: #fff;
            font-size: 0.65em;
            line-height: var(--br-survey-line-height-base, 1.4);
            text-align: left;
        }

        .br-survey-selected-answers__title {
            margin: 0;
            font: inherit;
            font-weight: 600;
            color: #666;
        }

        .br-survey-selected-answers__title:not(:empty) {
            margin-bottom: 0.6em;
        }

        .br-survey-selected-answers__list {
            display: grid;
            gap: 0.6em;
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .br-survey-selected-answer {
            display: grid;
            grid-template-columns: minmax(0, 1fr) fit-content(40%);
            align-items: center;
            gap: 0.35em 0.75em;
            min-width: 0;
            max-width: 100%;
            overflow-wrap: anywhere;
        }

        .br-survey-selected-answer + .br-survey-selected-answer {
            padding-top: 0.6em;
            border-top: 1px solid #eee;
        }

        .br-survey-selected-answer__question {
            display: block;
            min-width: 0;
            margin: 0;
            font-size: inherit;
            color: #666;
        }

        .br-survey-selected-answer__answer {
            display: block;
            justify-self: end;
            min-width: 0;
            max-width: 100%;
            box-sizing: border-box;
            padding: 0.25em 0.65em;
            border: 1px solid #e1e1e1;
            border-radius: 0.65em;
            background: #f5f5f5;
            font-size: inherit;
            font-weight: 600;
        }

        @container br-survey-selected-answers (max-width: 360px) {
            .br-survey-selected-answer {
                grid-template-columns: minmax(0, 1fr);
            }

            .br-survey-selected-answer__answer {
                justify-self: start;
            }
        }

        @media (max-width: 480px) {
            .br-survey-selected-answer {
                grid-template-columns: minmax(0, 1fr);
            }

            .br-survey-selected-answer__answer {
                justify-self: start;
            }
        }
    `;

    class UiSurveyPopup extends HTMLElement {

        constructor() {
            super();

            this.attachShadow({mode: "open"});

            this.closeOnBackgroundClick = false;
            this.resetOnClose = true;
            this.meta = {};
        }

        render(settings) {
            if (this.shadowRoot.childNodes.length > 0) {
                return;
            }

            const popupBaseStyleId = "br-survey-popup-style";
            this.shadowRoot.innerHTML = `
                <style id="${popupBaseStyleId}">
                    :host {
                        display: none;
                        position: fixed;
                        inset: 0;
                        z-index: 2147483647;
                        font-family: inherit;
                        --br-ui-base-font-size: 20px;
                        font-size: var(--br-ui-base-font-size);
                    }

                    :host([open]) {
                        display: block;
                    }

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
                        .br-popup-outer {
                            align-items: stretch;
                        }

                        .br-popup-dialog {
                            width: 100%;
                            max-width: 100%;
                            height: 100%;
                            max-height: 100%;
                            border-radius: 0;
                            box-shadow: none;
                        }

                        .br-popup-body {
                            flex: 1 1 auto;
                            overflow: auto;
                        }
                    }

                    ${this._ensurePageStyle()}
                </style>

                <div class="br-popup-backdrop" part="backdrop"></div>
                <div class="br-popup-outer">
                    <div class="br-popup-dialog" role="dialog" aria-modal="true">
                        <button type="button" class="br-popup-close" aria-label="Close survey">&times;</button>
                        <div class="br-popup-body">
                            <div class="br-popup-placeholder">Survey content will appear here…</div>
                        </div>
                        <div class="br-popup-footer"></div>
                    </div>
                </div>
            `;

            Breinify.plugins.webExperiences.style(settings, $(this.shadowRoot), "#" + popupBaseStyleId);
            this._bindBaseEvents();
        }

        _ensurePageStyle() {
            return `
                :host {
                    --br-survey-answer-aspect-ratio: 1 / 1;
                    --br-survey-line-height-base: 1.4;
                    --br-survey-line-height-tight: 1.2;
                }

                .br-survey-page--question {
                    display: flex;
                    flex-direction: column;
                    gap: 1em;
                    line-height: var(--br-survey-line-height-base);
                }

                .br-survey-page-title {
                    font-size: 1.15em;
                    font-weight: 600;
                    margin: 0.75em 0 0.5em;
                    line-height: var(--br-survey-line-height-tight);
                }

                .br-survey-page-error {
                    color: #a40000;
                    font-size: 0.8em;
                    margin: 0.75em 0;
                }

                .br-survey-question-explanation {
                    margin: -0.5em 0 0;
                    font-size: 0.7em;
                    color: #666;
                    line-height: var(--br-survey-line-height-base);
                    white-space: pre-line;
                    overflow-wrap: anywhere;
                }

                ${selectedAnswersCss}

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
                    font-size: 0.9em;
                    margin: 0;
                    line-height: var(--br-survey-line-height-tight);
                }

                .br-survey-answer--has-description .br-survey-answer__title {
                    margin-bottom: 0.2em;
                }

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

                .br-survey-answer--simple {
                    align-items: center;
                    min-height: 2.8em;
                    padding-top: 0.7em;
                    padding-bottom: 0.7em;
                }

                .br-survey-page--recommendation {
                    display: flex;
                    flex-direction: column;
                    line-height: var(--br-survey-line-height-base);
                }

                .br-survey-reco-subtitle {
                    font-size: 0.7em;
                    color: #777;
                    margin: 0 0 0.75em;
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

                .br-survey-skeleton-line--short { width: 60%; }
                .br-survey-skeleton-line--medium { width: 80%; }

                @keyframes br-survey-skeleton-pulse {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
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

                .br-survey-footer-controls {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 0.5em;
                    width: 100%;
                }

                .br-survey-footer-controls--with-hint {
                    justify-content: flex-end;
                }

                .br-survey-footer-controls--with-hint .br-survey-hint {
                    margin-right: auto;
                }

                .br-survey-hint {
                    font-size: 0.55em;
                    color: #999;
                    line-height: var(--br-survey-line-height-tight);
                    max-width: 60%;
                    white-space: normal;
                    text-align: left;
                    min-height: 2.4em;
                }

                .br-survey-hint-title {
                    font-weight: 600;
                    margin: 0 0 0.15em;
                }

                .br-survey-hint-list {
                    margin: 0;
                    padding: 0 0 0 1.1em;
                    list-style: disc;
                }

                .br-survey-hint-list li {
                    margin: 0.1em 0;
                    padding: 0;
                    text-indent: 0;
                    white-space: normal;
                    line-height: var(--br-survey-line-height-tight);
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

                .br-survey-btn--primary {
                    background: #333;
                    color: #fff;
                    border-color: #333;
                }

                .br-survey-btn--primary:hover {
                    background: #000;
                    border-color: #000;
                }

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

                .br-survey-btn--back:not(.br-survey-btn--primary) {
                    background: transparent;
                    border-color: #bbb;
                }

                .br-survey-btn--back:not(.br-survey-btn--primary):hover {
                    background: #eee;
                }

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
                    if (window.innerWidth && window.innerWidth <= 640) {
                        return;
                    }

                    if (this._shouldCloseOnBackgroundClick()) {
                        this.close("backdrop");
                    }
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener("click", () => this.close("close-button"));
            }
        }

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

        close(reason, meta) {
            if (this.hasAttribute("open")) {
                this.removeAttribute("open");
            }

            document.body.classList.remove("br-survey-scroll-lock");

            const detail = Object.assign(
                {},
                $.isPlainObject(this.meta) ? this.meta : {},
                $.isPlainObject(meta) ? meta : {},
                {
                    reason: Breinify.UTL.isNonEmptyString(reason) || "unspecified"
                }
            );

            this.dispatchEvent(new CustomEvent("br-ui-survey:popup-closed", {
                bubbles: true,
                composed: true,
                cancelable: false,
                detail: detail
            }));
        }

        setBodyContent(contentNode) {
            const body = this.shadowRoot.querySelector(".br-popup-body");
            if (!body) {
                return;
            }

            while (body.firstChild) {
                body.removeChild(body.firstChild);
            }

            if (contentNode) {
                body.appendChild(contentNode);
            }
        }

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

    class UiSurveyTrigger extends HTMLElement {
        $shadowRoot = null;
        settings = null;
        webExVersionId = null;
        openHandler = null;
        isRendered = false;

        constructor() {
            super();
            this.attachShadow({mode: "open"});
            this.$shadowRoot = $(this.shadowRoot);
            this.settings = {};
            this.webExVersionId = null;
            this.openHandler = null;
        }

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
                    --br-ui-base-font-size: 20px;
                    font-size: var(--br-ui-base-font-size);
                }

                *, *::before, *::after { box-sizing: border-box; }

                .br-survey-root { width: 100%; }
                .br-survey-hidden { display: none !important; }

                .br-survey-trigger {
                    display: inline-block;
                    cursor: pointer;
                    width: 100%;
                }

                .br-survey-trigger-image {
                    width: 100%;
                    height: auto;
                    border: 0;
                    display: block;
                }

                .br-survey-trigger-image.br-survey-trigger-desktop { display: block; }
                .br-survey-trigger-image.br-survey-trigger-mobile { display: none; }

                @media (max-width: 600px) {
                    .br-survey-trigger-image.br-survey-trigger-desktop { display: none; }
                    .br-survey-trigger-image.br-survey-trigger-mobile { display: block; }
                }
            </style>`));
        }

        _createTrigger() {
            const triggerCfg = $.isPlainObject(this.settings) && $.isPlainObject(this.settings.trigger)
                ? this.settings.trigger
                : {};

            const desktopUrl = Breinify.UTL.isNonEmptyString(triggerCfg.bannerUrl);
            const mobileUrl = Breinify.UTL.isNonEmptyString(triggerCfg.mobileBannerUrl) || desktopUrl;

            const $root = $('<div class="br-survey-root"></div>');
            const $trigger = $("<div/>", {
                class: "br-survey-trigger",
                role: "button",
                tabindex: 0,
                "aria-label": "Start survey"
            });

            if (desktopUrl !== null) {
                $trigger.append($('<img class="br-survey-trigger-image br-survey-trigger-desktop" alt="Start survey"/>').attr("src", desktopUrl));
            }

            if (mobileUrl !== null) {
                $trigger.append($('<img class="br-survey-trigger-image br-survey-trigger-mobile" alt="Start survey"/>').attr("src", mobileUrl));
            }

            const openSurvey = (evt) => {
                if (evt) {
                    evt.preventDefault();
                }

                if ($.isFunction(this.openHandler)) {
                    this.openHandler(this);
                }
            };

            $trigger.on("click", openSurvey);
            $trigger.on("keydown", (evt) => {
                if (evt.key === "Enter" || evt.key === " ") {
                    openSurvey(evt);
                }
            });

            $root.append($trigger);
            this.$shadowRoot.append($root);
        }

        render(webExVersionId, settings, openHandler) {
            this.webExVersionId = webExVersionId;
            this.settings = $.isPlainObject(settings) ? settings : {};
            this.openHandler = $.isFunction(openHandler) ? openHandler : null;

            if (this.isRendered === true) {
                return;
            }

            this._ensureBaseStyle();
            Breinify.plugins.webExperiences.style(this.settings, this.$shadowRoot);
            this._createTrigger();
            this.isRendered = true;

            this.dispatchEvent(new CustomEvent("br-ui-survey:rendered", {
                bubbles: true,
                cancelable: false,
                detail: {
                    webExVersionId: this.webExVersionId
                }
            }));
        }
    }

    const _private = {
        runtimeByWebExVersionId: {},
        _selectedAnswersCss: selectedAnswersCss,

        getRuntime: function (module, settings) {
            const webExVersionId = Breinify.UTL.isNonEmptyString(module && module.webExVersionId);
            if (webExVersionId === null) {
                return null;
            }

            let runtime = this.runtimeByWebExVersionId[webExVersionId];
            if ($.isPlainObject(runtime)) {
                runtime.module = module;
                runtime.settings = $.isPlainObject(settings) ? settings : {};
                return runtime;
            }

            runtime = {
                module: module,
                settings: $.isPlainObject(settings) ? settings : {},
                webExVersionId: webExVersionId,
                triggers: [],
                _activePage: null,
                _pageStates: Object.create(null),
                _browserIndex: 0,
                _selectedAnswers: {},
                _nodesById: {},
                _edges: [],
                _currentNodeId: null,
                _history: [],
                _resetOnClose: true,
                _historyIntegrationAttached: false,
                _boundPopStateHandler: null,
                _sessionId: null,
                _multiAttached: false
            };

            this._loadStructureFromSettings(runtime);
            this.runtimeByWebExVersionId[webExVersionId] = runtime;
            return runtime;
        },

        cleanupTriggers: function (runtime) {
            runtime.triggers = (runtime.triggers || []).filter(function (trigger) {
                return trigger && trigger.isConnected === true;
            });
        },

        registerTrigger: function (runtime, trigger) {
            this.cleanupTriggers(runtime);

            if (!trigger) {
                return;
            }

            if (runtime.triggers.indexOf(trigger) === -1) {
                runtime.triggers.push(trigger);
            }
        },

        dispatchToTriggers: function (runtime, eventType, detail) {
            this.cleanupTriggers(runtime);

            const normalizedDetail = $.extend(true, {
                webExVersionId: runtime.webExVersionId,
                sessionId: runtime._sessionId || null
            }, $.isPlainObject(detail) ? detail : {});

            runtime.triggers.forEach(function (trigger) {
                trigger.dispatchEvent(new CustomEvent(eventType, {
                    bubbles: true,
                    cancelable: false,
                    detail: normalizedDetail
                }));
            });
        },

        getPopup: function (runtime) {
            let popup = document.querySelector(popupElementName);
            if (!popup) {
                popup = document.createElement(popupElementName);
                document.body.appendChild(popup);
                popup.render(runtime.settings);
            }

            popup.closeOnBackgroundClick = this._getCloseOnBackgroundClickSetting(runtime);
            runtime._resetOnClose = this._getResetOnCloseSetting(runtime);

            return popup;
        },

        _getCloseOnBackgroundClickSetting: function (runtime) {
            if ($.isPlainObject(runtime.settings) &&
                $.isPlainObject(runtime.settings.popup) &&
                typeof runtime.settings.popup.closeOnBackgroundClick === "boolean") {
                return runtime.settings.popup.closeOnBackgroundClick;
            }

            return false;
        },

        _getResetOnCloseSetting: function (runtime) {
            if ($.isPlainObject(runtime.settings) &&
                $.isPlainObject(runtime.settings.popup) &&
                typeof runtime.settings.popup.resetOnClose === "boolean") {
                return runtime.settings.popup.resetOnClose;
            }

            return true;
        },

        _resetSurveyState: function (runtime) {
            this._disposePage(runtime);
            this._settleBack(runtime, false);
            runtime._pageStates = Object.create(null);
            runtime._historyReturn = null;
            runtime._browserIndex = 0;
            runtime._currentNodeId = null;
            runtime._selectedAnswers = {};
            runtime._history = [];
            runtime._sessionId = null;
        },

        _ensureHistoryIntegration: function (runtime) {
            if (runtime._historyIntegrationAttached === true) {
                return;
            }

            runtime._historyIntegrationAttached = true;
            runtime._boundPopStateHandler = (event) => this._onPopState(runtime, event);
            window.addEventListener("popstate", runtime._boundPopStateHandler);
        },

        _ensureSessionId: function (runtime) {
            if (runtime._sessionId) {
                return;
            }

            runtime._sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 5);
        },

        _updateHistoryStateForCurrentPage: function (runtime, replace) {
            if (typeof window === "undefined" || !window.history) {
                return;
            }

            const nodeId = Breinify.UTL.isNonEmptyString(runtime._currentNodeId);
            const index = (runtime._browserIndex || 0) + (replace === true ? 0 : 1);
            const state = {
                index: index,
                brUiSurvey: true,
                webExVersionId: runtime.webExVersionId,
                nodeId: nodeId,
                sessionId: runtime._sessionId
            };

            try {
                if (replace === true) {
                    window.history.replaceState(state, "", window.location.href);
                } else {
                    window.history.pushState(state, "", window.location.href);
                }
                runtime._browserIndex = index;
            } catch (e) {
                console.warn("Unable to update history for survey navigation:", e);
            }
        },

        _onPopState: function (runtime, event) {
            const popup = document.querySelector(popupElementName);
            const state = event.state;
            const previousNodeId = runtime._currentNodeId;
            if (state && state.brUiSurvey && state.webExVersionId !== runtime.webExVersionId) {
                return;
            }
            if (!state || state.brUiSurvey !== true || !runtime._sessionId || state.sessionId !== runtime._sessionId) {
                if (popup && popup.hasAttribute("open") && popup.meta.webExVersionId === runtime.webExVersionId) {
                    popup.close("history");
                }
                this._resetSurveyState(runtime);
                return;
            }
            if (runtime._historyReturn) {
                const returning = runtime._historyReturn;
                runtime._historyReturn = null;
                if (state.index === runtime._browserIndex && state.nodeId === previousNodeId) {
                    // replay one forward transition through the same guard used by buttons and snippets
                    const page = runtime._activePage;
                    if (returning.advance && page && page.controller.getNextNodeId() === returning.nodeId) {
                        this._goForward(runtime, previousNodeId, null, true);
                    }
                    return;
                }
            }
            if (state.index > runtime._browserIndex) {
                const delta = state.index - runtime._browserIndex;
                runtime._historyReturn = {nodeId: state.nodeId, advance: delta === 1};
                window.history.go(-delta);
                return;
            }
            if (!runtime._nodesById[state.nodeId]) {
                this._settleBack(runtime, false);
                return;
            }
            runtime._browserIndex = state.index;
            if (state.nodeId === previousNodeId) {
                this._settleBack(runtime, false);
                return;
            }
            const historyIndex = runtime._history.indexOf(state.nodeId);
            if (historyIndex < 0) {
                this._settleBack(runtime, false);
                return;
            }
            const fromStepNumber = this._getStepNumber(runtime);
            this._disposePage(runtime);
            runtime._history = runtime._history.slice(0, historyIndex);
            runtime._currentNodeId = state.nodeId;
            this._pruneSelectedAnswersToActivePath(runtime);
            if (popup) {
                this._renderCurrentPage(runtime, popup, "back");
                if (!popup.hasAttribute("open")) {
                    popup.open();
                }
            }
            this._fireNavigatedEvent(runtime, previousNodeId, state.nodeId, "back", fromStepNumber,
                this._getStepNumber(runtime));
            this._settleBack(runtime, true);
        },

        _getPageNodes: function (runtime) {
            if (!$.isPlainObject(runtime.settings) ||
                !$.isPlainObject(runtime.settings.survey) ||
                !Array.isArray(runtime.settings.survey.nodes)) {
                return [];
            }

            return runtime.settings.survey.nodes.filter(function (n) {
                return $.isPlainObject(n) && (n.type === "question" || n.type === "multi-select-question");
            });
        },

        _getTotalPageCount: function (runtime) {
            return this._getPageNodes(runtime).length;
        },

        _getPageIndex: function (runtime, nodeId) {
            if (!nodeId) {
                return -1;
            }

            const nodes = this._getPageNodes(runtime);
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if ($.isPlainObject(n) && n.id === nodeId) {
                    return i;
                }
            }

            return -1;
        },

        _getAnswerFromNode: function (node, answerId) {
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
        },

        _getPageContext: function (runtime, nodeId, prefix) {
            const resolvedNodeId = Breinify.UTL.isNonEmptyString(nodeId);
            const node = resolvedNodeId !== null && runtime._nodesById ? runtime._nodesById[resolvedNodeId] : null;

            const ctx = {
                nodeId: resolvedNodeId,
                pageType: node && node.type ? node.type : null,
                pageIndex: this._getPageIndex(runtime, resolvedNodeId),
                totalPages: this._getTotalPageCount(runtime)
            };

            const p = Breinify.UTL.isNonEmptyString(prefix);
            if (p === null) {
                return ctx;
            }

            const out = {};
            out[p + "NodeId"] = ctx.nodeId;
            out[p + "PageType"] = ctx.pageType;
            out[p + "PageIndex"] = ctx.pageIndex;
            out.totalPages = ctx.totalPages;

            return out;
        },

        _getStepNumber: function (runtime) {
            return (Array.isArray(runtime._history) ? runtime._history.length : 0) + 1;
        },

        _hasOutgoingEdges: function (runtime, nodeId) {
            const nid = Breinify.UTL.isNonEmptyString(nodeId);
            if (nid === null || !Array.isArray(runtime._edges)) {
                return false;
            }

            return runtime._edges.some((e) => $.isPlainObject(e) && e.source === nid);
        },

        _getEdgeFromAnswer: function (runtime, nodeId, answerId) {
            if (!nodeId || !answerId || !Array.isArray(runtime._edges)) {
                return null;
            }

            const edge = runtime._edges.find((e) => {
                if (!$.isPlainObject(e) || e.source !== nodeId) {
                    return false;
                }

                if (e.answer === answerId || e.answerId === answerId || e.sourceHandle === answerId) {
                    return true;
                }

                if ($.isPlainObject(e.data)) {
                    if (e.data.answerId === answerId || e.data.sourceAnswerId === answerId) {
                        return true;
                    }
                }

                return false;
            });

            return $.isPlainObject(edge) ? edge : null;
        },

        _getNextNodeIdFromAnswer: function (runtime, nodeId, answerId) {
            let edge = this._getEdgeFromAnswer(runtime, nodeId, answerId);
            if (!$.isPlainObject(edge) && Array.isArray(runtime._edges)) {
                edge = runtime._edges.find((e) => $.isPlainObject(e) && e.source === nodeId);
            }

            return $.isPlainObject(edge) ? Breinify.UTL.isNonEmptyString(edge.target) : null;
        },

        _isFinalStep: function (runtime, nodeId) {
            const nid = Breinify.UTL.isNonEmptyString(nodeId);
            if (nid === null) {
                return true;
            }

            const node = runtime._nodesById && runtime._nodesById[nid] ? runtime._nodesById[nid] : null;
            if ($.isPlainObject(node) && node.type === "question") {
                const selectedAnswerId = $.isPlainObject(runtime._selectedAnswers)
                    ? Breinify.UTL.isNonEmptyString(runtime._selectedAnswers[nid])
                    : null;

                if (selectedAnswerId === null) {
                    return true;
                }

                const nextNodeId = this._getNextNodeIdFromAnswer(runtime, nid, selectedAnswerId);
                return nextNodeId === null;
            }

            return !this._hasOutgoingEdges(runtime, nid);
        },

        _getStepContext: function (runtime, nodeId, stepNumber) {
            const sn = typeof stepNumber === "number" ? stepNumber : this._getStepNumber(runtime);

            return {
                stepNumber: sn,
                canGoBack: Array.isArray(runtime._history) && runtime._history.length > 0,
                isFirstStep: sn === 1,
                isFinalStep: this._isFinalStep(runtime, nodeId)
            };
        },

        _buildEventDetail: function (runtime, opts) {
            const o = $.isPlainObject(opts) ? opts : {};

            const nodeId = Breinify.UTL.isNonEmptyString(o.nodeId);
            const fromNodeId = Breinify.UTL.isNonEmptyString(o.fromNodeId);
            const toNodeId = Breinify.UTL.isNonEmptyString(o.toNodeId);

            return Object.assign({},
                nodeId !== null ? this._getPageContext(runtime, nodeId, null) : {},
                fromNodeId !== null ? this._getPageContext(runtime, fromNodeId, "from") : {},
                toNodeId !== null ? this._getPageContext(runtime, toNodeId, "to") : {},

                nodeId !== null ? this._getStepContext(runtime, nodeId, o.stepNumber) : {},
                toNodeId !== null ? this._getStepContext(runtime, toNodeId, o.toStepNumber) : {},
                fromNodeId !== null ? {fromStepNumber: o.fromStepNumber ?? null} : {},
                toNodeId !== null ? {toStepNumber: o.toStepNumber ?? null} : {},

                $.isPlainObject(o.extra) ? o.extra : {}
            );
        },

        _fireOpenedEvent: function (runtime) {
            this.dispatchToTriggers(runtime, "br-ui-survey:opened", this._buildEventDetail(runtime, {
                nodeId: runtime._currentNodeId
            }));
        },

        _fireAnswerClickedEvent: function (runtime, nodeId, answerId) {
            this._fireAnswerEvent(runtime, "br-ui-survey:answer-clicked", nodeId, answerId);
        },

        _fireAnswerSelectedEvent: function (runtime, nodeId, answerId) {
            this._fireAnswerEvent(runtime, "br-ui-survey:answer-selected", nodeId, answerId);
        },

        _fireAnswerEvent: function (runtime, eventType, nodeId, answerId) {
            const resolvedNodeId = Breinify.UTL.isNonEmptyString(nodeId);
            const resolvedAnswerId = Breinify.UTL.isNonEmptyString(answerId);
            const node = resolvedNodeId !== null && runtime._nodesById ? runtime._nodesById[resolvedNodeId] : null;
            const answer = this._getAnswerFromNode(node, resolvedAnswerId);
            const multi = node && node.type === "multi-select-question";
            const edge = multi
                ? runtime._edges.find(edge => edge.source === resolvedNodeId && edge.sourceHandle == null)
                : resolvedNodeId !== null && resolvedAnswerId !== null
                ? this._getEdgeFromAnswer(runtime, resolvedNodeId, resolvedAnswerId)
                : null;
            const edgeId = $.isPlainObject(edge) ? Breinify.UTL.isNonEmptyString(edge.id) : null;

            const questionLabel = node && node.data && typeof node.data.question === "string" ? node.data.question : null;
            const answerLabel = answer && typeof answer.title === "string" ? answer.title : null;

            this.dispatchToTriggers(runtime, eventType, this._buildEventDetail(runtime, {
                nodeId: resolvedNodeId,
                extra: {
                    edgeId: edgeId,
                    answerId: resolvedAnswerId,
                    answer: answer || null,
                    answerLabel: answerLabel,
                    questionLabel: questionLabel,
                    ...(multi ? {selectedAnswerIds: this._selectedAnswerIds(runtime, resolvedNodeId).slice(),
                        selected: this._selectedAnswerIds(runtime, resolvedNodeId).includes(resolvedAnswerId)} : {})
                }
            }));
        },

        _fireNavigatedEvent: function (runtime, fromNodeId, toNodeId, reason, fromStepNumber, toStepNumber) {
            this.dispatchToTriggers(runtime, "br-ui-survey:navigated", this._buildEventDetail(runtime, {
                fromNodeId: fromNodeId,
                toNodeId: toNodeId,
                fromStepNumber: typeof fromStepNumber === "number" ? fromStepNumber : null,
                toStepNumber: typeof toStepNumber === "number" ? toStepNumber : null,
                extra: {
                    reason: Breinify.UTL.isNonEmptyString(reason) || "unspecified"
                }
            }));
        },

        _findFirstNodeId: function (runtime) {
            if (!$.isPlainObject(runtime.settings) ||
                !$.isPlainObject(runtime.settings.survey) ||
                !Array.isArray(runtime.settings.survey.nodes) ||
                !Array.isArray(runtime._edges)) {
                return null;
            }

            const nodes = runtime.settings.survey.nodes;
            const startNode = nodes.find((n) => $.isPlainObject(n) && n.type === "start");
            if (!$.isPlainObject(startNode)) {
                return null;
            }

            const startNodeId = Breinify.UTL.isNonEmptyString(startNode.id);
            if (startNodeId === null) {
                return null;
            }

            const edge = runtime._edges.find((e) => $.isPlainObject(e) && e.source === startNodeId);
            return $.isPlainObject(edge) ? Breinify.UTL.isNonEmptyString(edge.target) : null;
        },

        _loadStructureFromSettings: function (runtime) {
            runtime._nodesById = {};
            runtime._edges = [];
            runtime._currentNodeId = null;
            runtime._selectedAnswers = {};
            runtime._history = [];

            if (!$.isPlainObject(runtime.settings) || !$.isPlainObject(runtime.settings.survey)) {
                return;
            }

            if (Array.isArray(runtime.settings.survey.nodes)) {
                runtime.settings.survey.nodes.forEach((node) => {
                    if (node && node.id) {
                        runtime._nodesById[node.id] = node;
                    }
                });
            }

            if (Array.isArray(runtime.settings.survey.edges)) {
                runtime._edges = runtime.settings.survey.edges.slice();
            }
        },

        _selectedAnswerIds: function (runtime, nodeId) {
            const selected = (runtime._selectedAnswers || {})[nodeId];
            return Array.isArray(selected) ? selected : (typeof selected === "string" ? [selected] : []);
        },

        _isMissingAnswerValue: function (value) {
            return value == null || value === "" || (Array.isArray(value) && value.length === 0) ||
                ($.isPlainObject(value) && Object.keys(value).length === 0);
        },

        _multiSelectLimits: function (node) {
            const data = node.data || {};
            const settings = data.settings || {};
            return {
                min: settings.minSelections == null ? 1 : settings.minSelections,
                max: settings.maxSelections == null ? (data.answers || []).length : settings.maxSelections
            };
        },

        _resolveSelectedAnswers: function (runtime) {
            const nodes = (((runtime.settings || {}).survey || {}).nodes) || [];
            const nodeById = Object.create(null);

            for (const n of nodes) {
                if (n && typeof n.id === "string") {
                    nodeById[n.id] = n;
                }
            }

            const byQuestionId = Object.create(null);
            const missingQuestions = [];
            const missingAnswers = [];

            // path order also keeps later-page precedence correct for numeric-looking node IDs
            const questionIds = [...new Set([...(runtime._history || []), runtime._currentNodeId])]
                .filter(id => id != null && Object.prototype.hasOwnProperty.call(runtime._selectedAnswers || {}, id));
            for (const questionId of questionIds) {
                const node = nodeById[questionId] || null;
                if (!node) {
                    missingQuestions.push(questionId);
                    continue;
                }
                const question = node.data ? node.data.question : null;
                const answers = Array.isArray(node.data && node.data.answers) ? node.data.answers : [];
                const selections = [];
                for (const answerId of this._selectedAnswerIds(runtime, questionId)) {
                    const answer = answers.find(a => a && a._id === answerId) || null;
                    if (!answer) {
                        missingAnswers.push({questionId: questionId, answerId: answerId});
                        continue;
                    }
                    selections.push({
                        questionId: questionId, question: question, answerId: answerId,
                        title: answer.title || null, values: answer.values || [], answer: answer, node: node
                    });
                }
                if (node.type === "multi-select-question") {
                    const attributes = Object.create(null);
                    const keys = (node.data.settings || {}).answerKeys || [];
                    for (const selected of selections) {
                        for (const entry of selected.values) {
                            if (!entry || !keys.includes(entry.key) || this._isMissingAnswerValue(entry.value)) {
                                continue;
                            }
                            if (!Object.prototype.hasOwnProperty.call(attributes, entry.key)) {
                                attributes[entry.key] = [];
                            }
                            attributes[entry.key].push(entry.value);
                        }
                    }
                    byQuestionId[questionId] = {
                        questionId: questionId, question: question, node: node, selections: selections,
                        values: Object.keys(attributes).map(key => ({key: key, value: attributes[key]}))
                    };
                } else if (selections.length) {
                    byQuestionId[questionId] = Object.assign({}, selections[0], {selections: selections});
                }
            }

            return {
                byQuestionId: byQuestionId,
                questionIds: questionIds,
                missingQuestions: missingQuestions,
                missingAnswers: missingAnswers
            };
        },

        _buildAnswerAttributes: function (runtime) {
            const resolved = this._resolveSelectedAnswers(runtime);
            const attributes = Object.create(null);

            for (const questionId of resolved.questionIds) {
                const r = resolved.byQuestionId[questionId];
                if (!r) {
                    continue;
                }
                const vals = Array.isArray(r.values) ? r.values : [];
                for (const kv of vals) {
                    if (!kv || typeof kv.key !== "string") {
                        continue;
                    }

                    attributes[kv.key] = kv.value;
                }
            }

            return {
                resolved: resolved,
                attributes: attributes
            };
        },

        _pruneSelectedAnswersToActivePath: function (runtime) {
            if (!$.isPlainObject(runtime._selectedAnswers)) {
                return;
            }

            const allowed = Object.create(null);

            if (Array.isArray(runtime._history)) {
                runtime._history.forEach((id) => {
                    const nid = Breinify.UTL.isNonEmptyString(id);
                    if (nid !== null) {
                        allowed[nid] = true;
                    }
                });
            }

            const current = Breinify.UTL.isNonEmptyString(runtime._currentNodeId);
            if (current !== null) {
                allowed[current] = true;
            }

            Object.keys(runtime._pageStates || {}).forEach(id => {
                if (allowed[id] !== true) {
                    delete runtime._pageStates[id];
                }
            });
            Object.keys(runtime._selectedAnswers).forEach((qid) => {
                if (allowed[qid] !== true) {
                    delete runtime._selectedAnswers[qid];
                }
            });
        },

        _createPlaceholders: function (runtime, node) {
            if (!$.isPlainObject(node) ||
                !$.isPlainObject(node.data) ||
                !$.isPlainObject(node.data.placeholdersSnippets)) {
                return {};
            }

            return Object.fromEntries(
                Object.entries(node.data.placeholdersSnippets).flatMap(([key, snippetId]) => {
                    const func = Breinify.plugins.snippetManager.getSnippet(snippetId);
                    return func == null ? [] : [[key, func]];
                })
            );
        },

        _getButtonLabel: function (runtime, node, setting, fallback) {
            const survey = $.isPlainObject(runtime.settings.survey) ? runtime.settings.survey : {};
            const settings = $.isPlainObject(survey.settings) ? survey.settings : {};
            const data = $.isPlainObject(node.data) ? node.data : {};
            const pageSettings = $.isPlainObject(data.settings) ? data.settings : {};
            for (const label of [pageSettings[setting], settings[setting]]) {
                if (typeof label === "string" && label.trim() !== "") {
                    return label;
                }
            }
            return fallback;
        },

        _appendSelectedAnswers: function (runtime, node, container, force) {
            const data = $.isPlainObject(node.data) ? node.data : {};
            const settings = $.isPlainObject(data.settings) ? data.settings : {};
            if (force !== true && settings.showSelectedAnswers !== true) {
                return;
            }

            const resolved = this._resolveSelectedAnswers(runtime);
            const history = Array.isArray(runtime._history) ? runtime._history : [];
            const seen = new Set();
            const list = document.createElement("ul");
            list.className = "br-survey-selected-answers__list";
            history.forEach((questionId) => {
                const selected = resolved.byQuestionId[questionId];
                if (seen.has(questionId) || questionId === node.id || !selected ||
                    !selected.node || !selected.selections) {
                    return;
                }
                seen.add(questionId);

                selected.selections.forEach(selected => {
                    const question = Breinify.UTL.isNonEmptyString(selected.question);
                    const answer = Breinify.UTL.isNonEmptyString(selected.title);
                    if (answer === null) {
                        return;
                    }

                    const item = document.createElement("li");
                    item.className = "br-survey-selected-answer";
                    item.setAttribute("data-br-survey-question-id", questionId);
                    item.setAttribute("data-br-survey-answer-id", selected.answerId);
                    item.setAttribute("data-br-survey-question", question || "");
                    item.setAttribute("data-br-survey-answer", answer);

                    if (question !== null) {
                        const label = document.createElement("span");
                        label.className = "br-survey-selected-answer__question";
                        label.textContent = question;
                        item.appendChild(label);
                    }
                    const value = document.createElement("span");
                    value.className = "br-survey-selected-answer__answer";
                    value.textContent = answer;
                    item.appendChild(value);
                    list.appendChild(item);
                });
            });

            if (list.childNodes.length === 0) {
                return;
            }
            const summary = document.createElement("section");
            summary.className = "br-survey-selected-answers";
            const title = document.createElement("h3");
            title.className = "br-survey-selected-answers__title";
            // keep an empty title hook for customer CSS without reserving heading space
            summary.setAttribute("aria-label", "Selected answers");
            summary.appendChild(title);
            summary.appendChild(list);
            container.appendChild(summary);
        },

        _createQuestionPage: function (runtime, node) {
            const data = $.isPlainObject(node.data) ? node.data : {};
            const questionText = Breinify.UTL.isNonEmptyString(data.question) || "";
            const answers = Array.isArray(data.answers) ? data.answers : [];

            const nodeId = Breinify.UTL.isNonEmptyString(node.id);
            const selectedIds = this._selectedAnswerIds(runtime, nodeId);
            const multi = node.type === "multi-select-question";

            const container = document.createElement("div");
            container.className = "br-survey-page br-survey-page--question";
            if (multi) {
                container.classList.add("br-survey-page--multi-select-question");
            }

            const titleEl = document.createElement("h2");
            titleEl.classList.add("br-survey-page-title");
            titleEl.classList.add("br-survey-question-title");
            titleEl.textContent = questionText;
            container.appendChild(titleEl);

            if (typeof data.explanation === "string" && data.explanation.trim() !== "") {
                const explanation = document.createElement("p");
                explanation.className = "br-survey-question-explanation";
                explanation.textContent = data.explanation;
                container.appendChild(explanation);
            }
            this._appendSelectedAnswers(runtime, node, container);

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

                    itemEl.setAttribute("data-br-survey-answer-id", answerId || "");
                    if (multi) {
                        itemEl.setAttribute("aria-pressed", String(selectedIds.includes(answerId)));
                    }
                    if (answerId !== null && selectedIds.includes(answerId)) {
                        itemEl.classList.add("br-survey-answer--selected");
                    }

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

                    itemEl.addEventListener("click", evt => {
                        if (multi) {
                            // the second click belongs to dblclick; it must not toggle the answer again
                            if (evt.detail !== 2) {
                                this._handleMultiSelectClick(runtime, nodeId, answerId, container, false);
                            }
                        } else {
                            this._handleAnswerClick(runtime, nodeId, answerId, container, itemEl);
                        }
                    });

                    itemEl.addEventListener("dblclick", (evt) => {
                        evt.preventDefault();
                        if (multi) {
                            if (this._handleMultiSelectClick(runtime, nodeId, answerId, container, true)) {
                                this._goForward(runtime, nodeId, null);
                            }
                        } else {
                            this._handleAnswerDoubleClick(runtime, nodeId, answerId);
                        }
                    });

                    listEl.appendChild(itemEl);
                });

                container.appendChild(listEl);
            }

            return container;
        },

        _createRecommendationPage: function (runtime, node) {
            const data = $.isPlainObject(node.data) ? node.data : {};
            const titleText = Breinify.UTL.isNonEmptyString(data.searchTitle) || "Unlocking your personalized picks…";
            const subtitleText = Breinify.UTL.isNonEmptyString(data.searchSubtitle) || "We are analyzing your vibes… Almost there!";

            const container = document.createElement("div");
            container.className = "br-survey-page br-survey-page--recommendation";

            const titleEl = document.createElement("h2");
            titleEl.classList.add("br-survey-page-title");
            titleEl.classList.add("br-survey-reco-title");
            titleEl.textContent = titleText;
            container.appendChild(titleEl);

            const subtitleEl = document.createElement("div");
            subtitleEl.className = "br-survey-reco-subtitle";
            subtitleEl.textContent = subtitleText;
            container.appendChild(subtitleEl);
            this._appendSelectedAnswers(runtime, node, container);

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
        },

        _requestRecommendations: function (runtime, popup, container, node, page) {
            const data = $.isPlainObject(node.data) ? node.data : {};

            const active = () => !page || this._isActivePage(runtime, page);
            const $container = $(container);
            const $grid = $container.find(".br-survey-reco-grid");

            const itemSnippetId = Breinify.UTL.isNonEmptyString(data.renderResultSnippet);
            const preconfig = Breinify.UTL.isNonEmptyString(data.preconfiguredRecommendation);
            const queryLabel = Breinify.UTL.isNonEmptyString(data.queryLabel) || preconfig;
            const buildAttributes = this._buildAnswerAttributes(runtime);
            const additionalOtherParameters = buildAttributes.attributes;

            const recPayload = {
                recommendationQueryName: queryLabel,
                namedRecommendations: [
                    preconfig
                ],
                recommendationAdditionalParameters: {
                    additionalOtherParameters: additionalOtherParameters
                }
            };

            let snippet = Breinify.plugins.snippetManager.getSnippet(itemSnippetId);
            if (snippet === null) {
                snippet = function () {
                    return '' +
                        '<div class="br-survey-reco-card">' +
                        '  <div class="br-survey-reco-card-thumb">' +
                        '    <div class="br-survey-reco-card-thumb-inner"><img src="%%image%%" alt="%%name%%"/></div>' +
                        '  </div>' +
                        '  <div class="br-survey-reco-card-title">%%name%%</div>' +
                        '</div>';
                };
            }

            const defaultResultTitle = Breinify.UTL.isNonEmptyString(data.title) || "Your Recommendations";
            const defaultResultSubtitle = Breinify.UTL.isNonEmptyString(data.subtitle) || "Vibes that gets you";

            Breinify.plugins.recommendations.render({
                position: {
                    append: function () {
                        return active() ? $container : $();
                    }
                },
                placeholders: this._createPlaceholders(runtime, node),
                templates: {
                    container: function () {
                        return active() ? $grid : $();
                    },
                    item: snippet
                },
                recommender: {
                    payload: recPayload
                },
                process: {
                    pre: function (recData, option) {
                        if (!active()) {
                            return;
                        }
                        $grid.find(".br-survey-skeleton-card").remove();
                    },

                    attached: function ($attachedContainer, $itemContainer, recData, option) {
                        if (!active()) {
                            return;
                        }
                        const additional = recData && $.isPlainObject(recData.additionalData) ? recData.additionalData : {};

                        const resolvedTitle = Breinify.UTL.isNonEmptyString(additional.title) || defaultResultTitle;
                        const resolvedSubtitle = Breinify.UTL.isNonEmptyString(additional.subtitle) || defaultResultSubtitle;

                        const $titleEl = $container.find(".br-survey-page-title.br-survey-reco-title");
                        if ($titleEl.length) {
                            $titleEl.text(resolvedTitle);
                        }

                        const $subtitleEl = $container.find(".br-survey-reco-subtitle");
                        if ($subtitleEl.length) {
                            if (resolvedSubtitle === null) {
                                $subtitleEl.text("").hide();
                            } else {
                                $subtitleEl.text(resolvedSubtitle).show();
                            }
                        }

                        $grid.find(".br-survey-skeleton-card").remove();
                    },

                    error: function (error) {
                        if (!active()) {
                            return;
                        }
                        $grid.find(".br-survey-skeleton-card").remove();
                    },

                    createActivity: function (event, settings) {
                        settings.activityTags.campaignWebExId = Breinify.UTL.isNonEmptyString(runtime.webExVersionId);
                    }
                }
            });
        },

        _createFooterControls: function (runtime, node) {
            const wrapper = document.createElement("div");
            wrapper.className = "br-survey-footer-controls";

            if (!$.isPlainObject(node)) {
                return wrapper;
            }

            const page = runtime._activePage;
            const settings = this._effectivePageSettings(runtime, node);
            const nodeId = Breinify.UTL.isNonEmptyString(node.id);
            const nodeType = Breinify.UTL.isNonEmptyString(node.type) || node.type || null;
            const selectedAnswerId = nodeId !== null && runtime._selectedAnswers
                ? Breinify.UTL.isNonEmptyString(runtime._selectedAnswers[nodeId])
                : null;

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

            if (nodeType === "question" || nodeType === "multi-select-question") {
                li1.textContent = nodeType === "multi-select-question"
                    ? "single tap to select or deselect" : "single tap to select";
                li2.textContent = "double tap to select & answer";
                wrapper.classList.add("br-survey-footer-controls--with-hint");
                wrapper.appendChild(hintEl);
            }

            let primaryButton = null;

            if (Array.isArray(runtime._history) && runtime._history.length > 0 && settings.showBackButton) {
                const btnBack = document.createElement("button");
                btnBack.type = "button";
                btnBack.className = "br-survey-btn br-survey-btn--back";
                btnBack.textContent = this._getButtonLabel(runtime, node, "backButtonLabel", "Back");

                btnBack.addEventListener("click", () => {
                    this._goBack(runtime);
                });

                wrapper.appendChild(btnBack);
                primaryButton = btnBack;
            }

            if (settings.showRestartOverButton) {
                const btnRestart = document.createElement("button");
                btnRestart.type = "button";
                btnRestart.className = "br-survey-btn br-survey-btn--restart";
                btnRestart.textContent = settings.restartButtonLabel;
                btnRestart.addEventListener("click", () => this._restartSurvey(runtime));
                wrapper.appendChild(btnRestart);
                primaryButton = btnRestart;
            }

            if (settings.showNextButton && (nodeType === "question" || nodeType === "multi-select-question" || nodeType === "custom")) {
                const btnNext = document.createElement("button");
                btnNext.type = "button";
                btnNext.className = "br-survey-btn br-survey-btn--next";
                btnNext.textContent = this._getButtonLabel(runtime, node, "nextButtonLabel", "Next");
                btnNext.disabled = page ? !this._canAdvance(runtime, page) : selectedAnswerId === null;

                btnNext.addEventListener("click", () => {
                    this._goForward(runtime, nodeId, selectedAnswerId);
                });

                wrapper.appendChild(btnNext);
                primaryButton = btnNext;
            }

            // the rightmost visible action is primary, even when Next is temporarily disabled
            if (primaryButton) {
                primaryButton.classList.add("br-survey-btn--primary");
            }
            return wrapper;
        },

        // controllers own page content; the runtime owns transitions, history, and mount lifetime
        _createPageController: function (runtime, node, page) {
            if (node.type === "question") {
                return {
                    render: () => this._createQuestionPage(runtime, node),
                    getNextNodeId: () => {
                        const answer = runtime._selectedAnswers[node.id];
                        return answer ? this._getNextNodeIdFromAnswer(runtime, node.id, answer) : null;
                    }
                };
            } else if (node.type === "multi-select-question") {
                return {
                    render: () => this._createQuestionPage(runtime, node),
                    getNextNodeId: () => {
                        const count = this._selectedAnswerIds(runtime, node.id).length;
                        const limits = this._multiSelectLimits(node);
                        if (count < limits.min || count > limits.max) {
                            return null;
                        }
                        const edges = runtime._edges.filter(edge => edge.source === node.id);
                        return edges.length === 1 && edges[0].sourceHandle == null ? edges[0].target : null;
                    }
                };
            } else if (node.type === "recommendation") {
                return {
                    render: () => this._createRecommendationPage(runtime, node),
                    mount: (popup, content) => this._requestRecommendations(runtime, popup, content, node, page),
                    getNextNodeId: () => null
                };
            } else if (node.type === "custom") {
                return {
                    render: () => this._createCustomPage(runtime, node, page),
                    mount: () => this._mountCustomPage(runtime, node, page),
                    validate: () => typeof page.hooks.validate === "function" ? page.hooks.validate() : true,
                    destroy: () => this._destroyCustomHooks(page),
                    getNextNodeId: () => {
                        if (page.settings.isTerminal) {
                            return null;
                        }
                        const edges = runtime._edges.filter(edge => edge.source === node.id);
                        return edges.length === 1 && edges[0].sourceHandle == null ? edges[0].target : null;
                    }
                };
            }
            return {
                render: () => {
                    const content = document.createElement("div");
                    content.className = "br-survey-page br-survey-page--error";
                    content.textContent = "The survey is not correctly configured.";
                    return content;
                },
                getNextNodeId: () => null
            };
        },

        _effectivePageSettings: function (runtime, node) {
            const data = node.data || {};
            const settings = data.settings || {};
            const general = (runtime.settings.survey || {}).settings || {};
            const terminal = node.type === "recommendation" || (node.type === "custom" && settings.isTerminal === true);
            return Object.freeze({
                isTerminal: terminal,
                showBackButton: node.type !== "custom" || settings.showBackButton !== false,
                showNextButton: !terminal && (node.type !== "custom" || settings.showNextButton !== false),
                showRestartOverButton: typeof settings.showRestartOverButton === "boolean"
                    ? settings.showRestartOverButton : general.showRestartOverButton === true,
                backButtonLabel: this._getButtonLabel(runtime, node, "backButtonLabel", "Back"),
                nextButtonLabel: this._getButtonLabel(runtime, node, "nextButtonLabel", "Next"),
                restartButtonLabel: this._getButtonLabel(runtime, node, "restartButtonLabel", "Start over")
            });
        },

        _isActivePage: function (runtime, page) {
            return runtime._activePage === page && !page.abort.signal.aborted;
        },

        _disposePage: function (runtime) {
            const page = runtime._activePage;
            if (!page) {
                return;
            }
            runtime._activePage = null;
            clearTimeout(page.skipTimer);
            page.abort.abort();
            try {
                if (typeof page.controller.destroy === "function") {
                    page.controller.destroy();
                }
            } catch (error) {
                console.warn("Unable to clean up survey page:", error);
            }
        },

        _destroyCustomHooks: function (page) {
            if (page.hooksDestroyed || !page.hooks) {
                return;
            }
            page.hooksDestroyed = true;
            if (typeof page.hooks.destroy === "function") {
                page.hooks.destroy();
            }
        },

        _updatePageControls: function (runtime) {
            const page = runtime._activePage;
            const popup = document.querySelector(popupElementName);
            if (page && popup && typeof popup.setFooterContent === "function") {
                popup.setFooterContent(this._createFooterControls(runtime, page.node));
            }
        },

        _canAdvance: function (runtime, page, skip) {
            const skipping = skip === true && page && page.node.type === "custom";
            return !!page && this._isActivePage(runtime, page) && page.ready && (page.enabled || skipping) &&
                !page.pending && !runtime._backRequest && !runtime._historyReturn && !page.settings.isTerminal && !!page.controller.getNextNodeId();
        },

        _requestCustomSkip: function (runtime, page) {
            if (!this._isActivePage(runtime, page) || page.node.type !== "custom" || page.settings.isTerminal ||
                page.pending || page.skipRequested) {
                return;
            }
            page.skipRequested = true;
            this._scheduleCustomSkip(runtime, page);
        },

        _scheduleCustomSkip: function (runtime, page) {
            if (!this._isActivePage(runtime, page) || !page.ready || !page.skipRequested || page.skipTimer != null) {
                return;
            }
            // let mount completion and the current browser-history transition finish first
            page.skipTimer = setTimeout(async () => {
                page.skipTimer = null;
                if (!this._isActivePage(runtime, page)) {
                    return;
                }
                let moved = false;
                try {
                    moved = page.direction === "back"
                        ? await this._goBack(runtime)
                        : await this._goForward(runtime, page.node.id, null, false, true);
                } catch (error) {
                    console.warn("Unable to skip survey page:", error);
                } finally {
                    if (!moved && this._isActivePage(runtime, page)) {
                        page.skipRequested = false;
                        this._showPageError(page, "This page could not be skipped. Please try again.");
                    }
                }
            }, 0);
        },

        _showPageError: function (page, message) {
            if (!page.error) {
                return;
            }
            page.error.textContent = message || "";
            page.error.hidden = !message;
        },

        _resolveCustomSource: function (runtime, source, type, required) {
            if (source === undefined || source === null) {
                if (required) {
                    throw new Error("Missing custom page " + type + " source.");
                }
                return null;
            }
            if (!$.isPlainObject(source) || (source.snippet != null) === (source.snippetId != null)) {
                throw new Error("A custom page source needs exactly one snippet or snippetId.");
            }
            let value = source.snippet;
            if (source.snippetId != null) {
                const id = source.snippetId;
                if (typeof id !== "string" || id.trim() === "") {
                    throw new Error("Invalid custom page snippetId.");
                }
                if (id.indexOf("web-experience:") === 0) {
                    const local = runtime.module && runtime.module.webExperienceSnippets;
                    const entry = local && Object.prototype.hasOwnProperty.call(local, id) ? local[id] : null;
                    if (!entry || entry.type !== (type === "js" ? "javascript" : type)) {
                        throw new Error("Missing or incompatible local custom page snippet.");
                    }
                    value = entry.value;
                } else {
                    const manager = Breinify.plugins.snippetManager;
                    value = manager && manager.get(id);
                }
            }
            const expected = type === "js" ? "function" : "string";
            if (typeof value !== expected || (expected === "string" && value.trim() === "")) {
                throw new Error("Missing or incompatible custom page " + type + " snippet.");
            }
            return value;
        },

        _createCustomPage: function (runtime, node, page) {
            const content = document.createElement("div");
            content.className = "br-survey-page br-survey-page--custom";
            const host = document.createElement("div");
            host.className = "br-survey-custom-content";
            page.root = host.attachShadow({mode: "open"});
            content.appendChild(host);
            page.error = document.createElement("p");
            page.error.className = "br-survey-page-error";
            page.error.setAttribute("role", "alert");
            page.error.hidden = true;
            content.appendChild(page.error);
            page.ready = false;
            return content;
        },

        _answerSnapshot: function (runtime, node) {
            const resolved = this._resolveSelectedAnswers(runtime).byQuestionId;
            const answers = [...new Set(runtime._history || [])].flatMap(id => {
                const selected = resolved[id];
                if (id === node.id || !selected || !selected.selections) {
                    return [];
                }
                return selected.selections.map(answer => ({
                    questionId: id, questionLabel: answer.question || "", answerId: answer.answerId,
                    answerLabel: answer.title || "", values: answer.answer.values || []
                }));
            });
            const snapshot = JSON.parse(JSON.stringify(answers));
            const freeze = value => {
                if (value && typeof value === "object") {
                    Object.keys(value).forEach(key => freeze(value[key]));
                    Object.freeze(value);
                }
                return value;
            };
            return freeze(snapshot);
        },

        _mountCustomPage: function (runtime, node, page) {
            const data = node.data || {};
            const html = this._resolveCustomSource(runtime, data.html, "html", true);
            let css = this._resolveCustomSource(runtime, data.css, "css", false);
            if (css && /^\s*<style[\s>]/i.test(css)) {
                // global CSS snippets use the existing Script Creator style-element wrapper
                const styles = document.createElement("template");
                styles.innerHTML = css;
                css = Array.from(styles.content.querySelectorAll("style")).map(style => style.textContent).join("\n");
            }
            const initialize = this._resolveCustomSource(runtime, data.js, "js", false);
            const template = document.createElement("template");
            template.innerHTML = html;
            // HTML scripts are inert; page lifecycle code belongs in the JavaScript source
            template.content.querySelectorAll("script").forEach(script => script.remove());
            page.root.appendChild(template.content.cloneNode(true));
            const style = document.createElement("style");
            style.textContent = this._selectedAnswersCss + "\n" + (css || "");
            page.root.prepend(style);
            page.root.querySelectorAll("[data-br-survey-selected-answers]").forEach(placeholder => {
                placeholder.textContent = "";
                this._appendSelectedAnswers(runtime, node, placeholder, true);
                placeholder.hidden = placeholder.childNodes.length === 0;
            });
            if (!runtime._pageStates) {
                runtime._pageStates = Object.create(null);
            }
            if (!Object.prototype.hasOwnProperty.call(runtime._pageStates, node.id)) {
                runtime._pageStates[node.id] = {};
            }
            const context = Object.freeze({
                root: page.root,
                webExVersionId: runtime.webExVersionId,
                sessionId: runtime._sessionId,
                nodeId: node.id,
                settings: page.settings,
                answers: this._answerSnapshot(runtime, node),
                state: runtime._pageStates[node.id],
                signal: page.abort.signal,
                setNextEnabled: enabled => {
                    if (!this._isActivePage(runtime, page)) {
                        return;
                    }
                    if (typeof enabled !== "boolean") {
                        throw new TypeError("setNextEnabled requires a boolean.");
                    }
                    page.enabled = enabled;
                    this._updatePageControls(runtime);
                },
                next: () => this._isActivePage(runtime, page)
                    ? this._goForward(runtime, node.id) : Promise.resolve(false),
                back: () => this._isActivePage(runtime, page)
                    ? this._goBack(runtime) : Promise.resolve(false),
                skip: () => this._requestCustomSkip(runtime, page)
            });
            return Promise.resolve(initialize === null ? undefined : initialize(context)).then(hooks => {
                page.hooks = hooks;
                if (!this._isActivePage(runtime, page)) {
                    this._destroyCustomHooks(page);
                    return;
                }
                if (hooks !== undefined && (!$.isPlainObject(hooks) ||
                    ["validate", "destroy"].some(key => hooks[key] !== undefined && typeof hooks[key] !== "function"))) {
                    throw new Error("Invalid custom page controller.");
                }
                page.hooks = hooks || {};
            });
        },

        _ensurePageCloseHandler: function (runtime, popup) {
            if (runtime._closeHandler) {
                return;
            }
            const handleClosed = event => {
                const detail = event && event.detail;
                if (detail && detail.webExVersionId && detail.webExVersionId !== runtime.webExVersionId) {
                    return;
                }
                this._disposePage(runtime);
                this._settleBack(runtime, false);
                if (runtime._resetOnClose) {
                    this._resetSurveyState(runtime);
                }
                popup.removeEventListener("br-ui-survey:popup-closed", handleClosed);
                runtime._closeHandler = null;
            };
            runtime._closeHandler = handleClosed;
            popup.addEventListener("br-ui-survey:popup-closed", handleClosed);
        },

        _renderCurrentPage: function (runtime, popup, direction) {
            if (!popup || typeof popup.setBodyContent !== "function") {
                return;
            }
            if (popup._surveyRuntime && popup._surveyRuntime !== runtime) {
                const previous = popup._surveyRuntime;
                this._disposePage(previous);
                popup.removeEventListener("br-ui-survey:popup-closed", previous._closeHandler);
                previous._closeHandler = null;
            }
            popup._surveyRuntime = runtime;
            this._ensurePageCloseHandler(runtime, popup);
            this._disposePage(runtime);
            const node = runtime._nodesById[runtime._currentNodeId] || {};
            const page = {
                node: node, settings: this._effectivePageSettings(runtime, node), abort: new AbortController(),
                ready: true, enabled: true, pending: false, hooks: null, hooksDestroyed: false,
                direction: direction === "back" ? "back" : "forward", skipRequested: false, skipTimer: null
            };
            runtime._activePage = page;
            page.controller = this._createPageController(runtime, node, page);
            const fail = error => {
                if (this._isActivePage(runtime, page)) {
                    page.ready = false;
                    this._showPageError(page, "This page could not be loaded. Please try again.");
                    this._updatePageControls(runtime);
                }
                console.warn("Unable to initialize survey page:", error);
            };
            try {
                const content = page.controller.render();
                popup.setBodyContent(content);
                const mounted = typeof page.controller.mount === "function" ? page.controller.mount(popup, content) : null;
                if (mounted && typeof mounted.then === "function") {
                    page.ready = false;
                    Promise.resolve(mounted).then(() => {
                        if (this._isActivePage(runtime, page)) {
                            page.ready = true;
                            this._updatePageControls(runtime);
                            this._scheduleCustomSkip(runtime, page);
                        }
                    }).catch(fail);
                }
            } catch (error) {
                fail(error);
            }
            this._updatePageControls(runtime);
        },

        _handleMultiSelectClick: function (runtime, nodeId, answerId, container, selectOnly) {
            const page = runtime._activePage;
            if (!page || page.node.id !== nodeId || runtime._currentNodeId !== nodeId ||
                !this._isActivePage(runtime, page) || page.pending || runtime._backRequest || runtime._historyReturn ||
                !this._getAnswerFromNode(page.node, answerId)) {
                return false;
            }
            const selected = this._selectedAnswerIds(runtime, nodeId).slice();
            const index = selected.indexOf(answerId);
            const limits = this._multiSelectLimits(page.node);
            if (index < 0 && selected.length >= limits.max) {
                return false;
            } else if (index < 0) {
                selected.push(answerId);
            } else if (!selectOnly) {
                selected.splice(index, 1);
            }
            runtime._selectedAnswers[nodeId] = selected;
            if (index < 0 || !selectOnly) {
                this._fireAnswerClickedEvent(runtime, nodeId, answerId);
            }
            if (container) {
                container.querySelectorAll(".br-survey-answer").forEach(button => {
                    const pressed = selected.includes(button.getAttribute("data-br-survey-answer-id"));
                    button.classList.toggle("br-survey-answer--selected", pressed);
                    button.setAttribute("aria-pressed", String(pressed));
                });
            }
            this._updatePageControls(runtime);
            return true;
        },

        _handleAnswerClick: function (runtime, nodeId, answerId, container, clickedButton) {
            if (nodeId === null || answerId === null || runtime._currentNodeId !== nodeId) {
                return;
            }

            if (!$.isPlainObject(runtime._selectedAnswers)) {
                runtime._selectedAnswers = {};
            }

            runtime._selectedAnswers[nodeId] = answerId;
            this._fireAnswerClickedEvent(runtime, nodeId, answerId);

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

            const popup = document.querySelector(popupElementName);
            if (popup && typeof popup.setFooterContent === "function") {
                const node = runtime._nodesById[nodeId];
                popup.setFooterContent(this._createFooterControls(runtime, node));
            }
        },

        _handleAnswerDoubleClick: function (runtime, nodeId, answerId) {
            if (nodeId === null || answerId === null || runtime._currentNodeId !== nodeId) {
                return;
            }

            this._goForward(runtime, nodeId, answerId);
        },

        _awaitPage: function (page, result) {
            return new Promise((resolve, reject) => {
                const cancel = () => resolve(false);
                page.abort.signal.addEventListener("abort", cancel, {once: true});
                Promise.resolve(result).then(resolve, reject).finally(() => {
                    page.abort.signal.removeEventListener("abort", cancel);
                });
                if (page.abort.signal.aborted) {
                    cancel();
                }
            });
        },

        _goForward: async function (runtime, nodeId, answerId, fromHistory, skip) {
            const page = runtime._activePage;
            const skipping = skip === true && page && page.node.type === "custom";
            if (!page || page.node.id !== nodeId || !this._canAdvance(runtime, page, skipping)) {
                return false;
            }
            page.pending = true;
            this._showPageError(page, null);
            this._updatePageControls(runtime);
            try {
                let result = !skipping && typeof page.controller.validate === "function"
                    ? page.controller.validate() : true;
                if (result && typeof result.then === "function") {
                    result = await this._awaitPage(page, result);
                }
                if (!this._isActivePage(runtime, page) || (!page.enabled && !skipping) ||
                    runtime._backRequest || runtime._historyReturn) {
                    return false;
                }
                let valid;
                let message = null;
                if (typeof result === "boolean") {
                    valid = result;
                } else if ($.isPlainObject(result) && typeof result.valid === "boolean" &&
                    (result.message == null || typeof result.message === "string")) {
                    valid = result.valid;
                    message = result.message;
                } else {
                    throw new Error("Invalid survey validation result.");
                }
                if (!valid) {
                    this._showPageError(page, message && message.trim() ? message : "Please complete this page to continue.");
                    return false;
                }
                const nextNodeId = page.controller.getNextNodeId();
                if (!nextNodeId || !runtime._nodesById[nextNodeId]) {
                    return false;
                }
                if ((page.node.type === "question" || page.node.type === "multi-select-question") &&
                    fromHistory !== true) {
                    for (const selectedId of this._selectedAnswerIds(runtime, nodeId)) {
                        this._fireAnswerSelectedEvent(runtime, nodeId, selectedId);
                    }
                }
                const fromStepNumber = this._getStepNumber(runtime);
                runtime._history.push(nodeId);
                runtime._currentNodeId = nextNodeId;
                const popup = document.querySelector(popupElementName);
                this._renderCurrentPage(runtime, popup);
                this._updateHistoryStateForCurrentPage(runtime);
                this._fireNavigatedEvent(runtime, nodeId, nextNodeId, "forward", fromStepNumber, fromStepNumber + 1);
                return true;
            } catch (error) {
                if (this._isActivePage(runtime, page)) {
                    this._showPageError(page, "This page could not be validated. Please try again.");
                }
                console.warn("Unable to validate survey page:", error);
                return false;
            } finally {
                page.pending = false;
                if (this._isActivePage(runtime, page)) {
                    this._updatePageControls(runtime);
                }
            }
        },

        _settleBack: function (runtime, moved) {
            if (runtime._backRequest) {
                const request = runtime._backRequest;
                runtime._backRequest = null;
                clearTimeout(request.timer);
                request.resolve(moved);
                this._updatePageControls(runtime);
            }
        },

        _goBack: function (runtime) {
            if (!runtime || !runtime._history.length || runtime._backRequest ||
                typeof window === "undefined" || !window.history) {
                return Promise.resolve(false);
            }
            return new Promise(resolve => {
                runtime._backRequest = {resolve: resolve, timer: setTimeout(() => this._settleBack(runtime, false), 1000)};
                window.history.back();
            });
        },

        _restartSurvey: function (runtime) {
            const popup = document.querySelector(popupElementName);
            if (!popup || !popup.hasAttribute("open") || popup.meta.webExVersionId !== runtime.webExVersionId) {
                return;
            }

            const previousNodeId = runtime._currentNodeId;
            const fromStepNumber = this._getStepNumber(runtime);
            this._resetSurveyState(runtime);
            runtime._currentNodeId = this._findFirstNodeId(runtime);
            this._ensureSessionId(runtime);
            popup.meta = {
                webExVersionId: runtime.webExVersionId,
                sessionId: runtime._sessionId
            };
            this._renderCurrentPage(runtime, popup);

            // old history entries belong to the discarded session and cannot restore its answers
            this._updateHistoryStateForCurrentPage(runtime, true);
            const body = popup.shadowRoot.querySelector(".br-popup-body");
            if (body) {
                body.scrollTop = 0;
            }
            const title = popup.shadowRoot.querySelector(".br-survey-page-title");
            if (title) {
                title.setAttribute("tabindex", "-1");
                title.focus();
            }
            this._fireNavigatedEvent(runtime, previousNodeId, runtime._currentNodeId, "restart", fromStepNumber, 1);
        },

        openSurvey: function (webExVersionId) {
            const runtime = this.runtimeByWebExVersionId[webExVersionId];
            if (!$.isPlainObject(runtime)) {
                return;
            }

            const popup = this.getPopup(runtime);

            if (runtime._currentNodeId === null) {
                runtime._currentNodeId = this._findFirstNodeId(runtime);
            }

            this._ensureSessionId(runtime);

            popup.meta = {
                webExVersionId: runtime.webExVersionId,
                sessionId: runtime._sessionId
            };

            this._renderCurrentPage(runtime, popup);
            this._ensureHistoryIntegration(runtime);
            this._updateHistoryStateForCurrentPage(runtime);
            popup.open();

            this._fireOpenedEvent(runtime);
        },

        createTriggerElement: function (runtime) {
            const trigger = document.createElement(generalSurveyElementName);
            trigger.setAttribute("data-br-survey-webexversionid", runtime.webExVersionId);
            return $(trigger);
        },

        ensureTriggers: function (runtime) {
            this.cleanupTriggers(runtime);

            const supplier = () => {
                const $trigger = this.createTriggerElement(runtime);
                const trigger = $trigger.get(0);

                this.registerTrigger(runtime, trigger);

                Breinify.plugins.uiSurvey.attachEventListeners(
                    trigger,
                    runtime.webExVersionId,
                    (eventName, detail) => {
                        const metadata = {
                            version: runtime.module.version,
                            created: runtime.module.created,
                            campaignName: Breinify.UTL.isNonEmptyString(runtime.module.campaignName)
                        };
                        eventHandler.sendActivity(metadata, eventName, detail);
                    }
                );

                trigger.render(runtime.webExVersionId, runtime.settings, () => {
                    this.openSurvey(runtime.webExVersionId);
                });

                return $trigger;
            };

            Breinify.plugins.webExperiences.attach(runtime.settings, supplier, {
                cardinality: "multi",
                key: runtime.webExVersionId
            });
        }
    };

    const eventHandler = {
        _determineEventType: function (eventName, metadata, detail) {
            switch (eventName) {
                case "rendered":
                    return "renderedElement";
                case "opened":
                case "popup-closed":
                case "answer-selected":
                    return "clickedElement";
                default:
                    return null;
            }
        },

        _determineTags: function (eventName, metadata, detail) {
            switch (eventName) {
                case "rendered":
                    return {
                        actionType: "rendered",
                        action: "render banner/button/text",
                        elementType: "br-survey-root"
                    };
                case "opened":
                    return {
                        actionType: "trigger",
                        action: "open survey",
                        elementType: "br-survey-root"
                    };
                case "popup-closed":
                    return {
                        actionType: "trigger",
                        action: "closed survey",
                        elementType: Breinify.UTL.isNonEmptyString(detail && detail.reason) ? detail.reason : "unspecified"
                    };
                case "answer-selected":
                    return {
                        actionType: "click",
                        action: "selected answer",
                        elementType: "br-survey-answer",
                        stepNumber: typeof (detail && detail.stepNumber) === "number" ? detail.stepNumber : null,
                        nodeId: Breinify.UTL.isNonEmptyString(detail && detail.nodeId),
                        edgeId: Breinify.UTL.isNonEmptyString(detail && detail.edgeId),
                        answerId: Breinify.UTL.isNonEmptyString(detail && detail.answerId),
                        answer: Breinify.UTL.isNonEmptyString(detail && detail.answerLabel),
                        question: Breinify.UTL.isNonEmptyString(detail && detail.questionLabel)
                    };
                default:
                    return {};
            }
        },

        sendActivity: function (metadata, eventName, detail) {
            if (Breinify.UTL.isNonEmptyString(eventName) === null ||
                Breinify.UTL.isNonEmptyString(detail && detail.webExVersionId) === null) {
                return;
            }

            const type = this._determineEventType(eventName, metadata, detail);
            if (type == null) {
                return;
            }

            const user = {};
            const tags = $.extend(true, {
                campaignWebExId: detail.webExVersionId,
                widget: metadata.campaignName,
                widgetType: "survey"
            }, this._determineTags(eventName, metadata, detail));

            Breinify.plugins.activities.generic(type, user, tags);
        }
    };

    Breinify.plugins._add("uiSurvey", {
        attachEventListeners: function (surveyEl, webExVersionId, callback, selection) {
            if (!surveyEl) {
                return;
            }

            const markerKey = "__brUiSurveyListeners::" + webExVersionId;
            if (surveyEl[markerKey] === true) {
                return;
            }
            surveyEl[markerKey] = true;

            const handler = typeof callback === "function" ? callback : function () {
            };

            let allowed = null;
            if (Array.isArray(selection)) {
                allowed = Object.create(null);
                selection.forEach(function (name) {
                    if (typeof name === "string" && name.length > 0) {
                        allowed[name] = true;
                    }
                });
            } else if (selection && typeof selection === "object") {
                allowed = selection;
            }

            const isAllowed = function (name) {
                return allowed === null || allowed[name] === true;
            };

            const wrap = function (name) {
                return function (evt) {
                    if (!isAllowed(name)) {
                        return;
                    }

                    handler(name, evt && evt.detail ? evt.detail : null);
                };
            };

            if (isAllowed("rendered")) {
                surveyEl.addEventListener("br-ui-survey:rendered", wrap("rendered"));
            }
            if (isAllowed("opened")) {
                surveyEl.addEventListener("br-ui-survey:opened", wrap("opened"));
            }
            if (isAllowed("navigated")) {
                surveyEl.addEventListener("br-ui-survey:navigated", wrap("navigated"));
            }
            if (isAllowed("answer-clicked")) {
                surveyEl.addEventListener("br-ui-survey:answer-clicked", wrap("answer-clicked"));
            }
            if (isAllowed("answer-selected")) {
                surveyEl.addEventListener("br-ui-survey:answer-selected", wrap("answer-selected"));
            }

            if (isAllowed("popup-closed")) {
                document.addEventListener("br-ui-survey:popup-closed", function (evt) {
                    const d = evt && evt.detail ? evt.detail : null;
                    if (d && d.webExVersionId && d.webExVersionId !== webExVersionId) {
                        return;
                    }

                    handler("popup-closed", d);
                });
            }
        },

        render: function (module, config) {
            if (!window.customElements.get(generalSurveyElementName)) {
                window.customElements.define(generalSurveyElementName, UiSurveyTrigger);
            }

            if (!window.customElements.get(popupElementName)) {
                window.customElements.define(popupElementName, UiSurveyPopup);
            }

            const globalStyleId = "br-survey-global-style";
            if ($("#" + globalStyleId).length === 0) {
                $("body").prepend(`
                    <style id="${globalStyleId}">
                        .br-survey-scroll-lock {
                            overflow: hidden !important;
                            touch-action: none !important;
                            overscroll-behavior: none !important;
                        }
                    </style>
                `);
            }

            const runtime = _private.getRuntime(module, config);
            if (!$.isPlainObject(runtime)) {
                return;
            }

            _private.ensureTriggers(runtime);
        },

        open: function (webExVersionId) {
            _private.openSurvey(webExVersionId);
        }
    });
})();
