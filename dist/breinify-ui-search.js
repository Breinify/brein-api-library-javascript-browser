"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("uiSearch")) {
        return;
    }

    const searchElementName = "br-ui-search";
    const $ = Breinify.UTL._jquery();

    class UiSearch extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({mode: "open"});
            this.$shadowRoot = $(this.shadowRoot);
            this.rendered = false;

            // Safari 12/13: no class fields
            this._input = null;
            this._clearBtn = null;
        }

        connectedCallback() {
            if (this.rendered) {
                return;
            }

            this.render();
            this.rendered = true;
        }

        disconnectedCallback() {
            this.rendered = false;
        }

        render() {
            const placeholder = (this.getAttribute("placeholder") || "Search").replace(/"/g, "&quot;");

            this.shadowRoot.innerHTML = `
                <style>
                    :host {
                        display: inline-block;
                        width: 100%;
                        max-width: 320px;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        --br-search-accent: #4f46e5;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    .field {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        height: 36px;
                        padding: 0 10px;
                        background: #fff;
                        border: 1px solid #d4d4d8;
                        border-radius: 8px;
                        transition: border-color .15s ease, box-shadow .15s ease;
                    }
                    .field:focus-within {
                        border-color: var(--br-search-accent);
                        box-shadow: 0 0 0 3px color-mix(in srgb, var(--br-search-accent) 18%, transparent);
                    }
                    .icon {
                        flex: 0 0 auto;
                        width: 16px;
                        height: 16px;
                        color: #71717a;
                    }
                    input {
                        flex: 1 1 auto;
                        min-width: 0;
                        border: none;
                        outline: none;
                        background: transparent;
                        font: inherit;
                        font-size: 14px;
                        color: #18181b;
                    }
                    input::placeholder {
                        color: #a1a1aa;
                    }
                    .clear {
                        flex: 0 0 auto;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        width: 18px;
                        height: 18px;
                        padding: 0;
                        border: none;
                        border-radius: 50%;
                        background: #e4e4e7;
                        color: #52525b;
                        font-size: 12px;
                        line-height: 1;
                        cursor: pointer;
                    }
                    .clear:hover {
                        background: #d4d4d8;
                    }
                    .clear.is-visible {
                        display: inline-flex;
                    }
                </style>
                <div class="field" part="field">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="search" part="input" enterkeyhint="search" autocomplete="off"
                           spellcheck="false" placeholder="${placeholder}" aria-label="${placeholder}"/>
                    <button class="clear" type="button" part="clear" aria-label="Clear search" tabindex="-1">&times;</button>
                </div>
            `;
        }
    }

    const _private = {
        runtimes: {},

        getRuntime: function (module, settings) {
            const webExVersionId = Breinify.UTL.isNonEmptyString(module && module.webExVersionId);
            if (webExVersionId === null) {
                return null;
            }

            let runtime = this.runtimes[webExVersionId];
            if (!$.isPlainObject(runtime)) {
                runtime = {
                    webExVersionId: webExVersionId,
                    module: module,
                    settings: {},
                    status: "idle",
                    results: [],
                    error: null,
                    requestId: 0,
                    elements: []
                };

                this.runtimes[webExVersionId] = runtime;
            }

            runtime.module = module;
            runtime.settings = $.isPlainObject(settings) ? settings : {};
            return runtime;
        },
    };

    Breinify.plugins._add("uiSearch", {
        init: function () {
            if (window.customElements && !window.customElements.get(searchElementName)) {
                window.customElements.define(searchElementName, UiSearch);
            }
        },

        render: function (module, config) {
            this.init();

            const runtime = _private.getRuntime(module, config);
        }
    });
})();
