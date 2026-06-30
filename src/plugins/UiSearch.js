"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("uiSearch")) {
        return;
    }

    const searchElementName = "br-ui-search";
    const resultsElementName = "br-ui-search-results";
    const PRODUCT_PREFIX = "product::";
    const $ = Breinify.UTL._jquery();

    class UiSearch extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({mode: "open"});
            this.rendered = false;

            // Safari 12/13: no class fields
            this._form = null;
            this._input = null;
            this._clearBtn = null;
            this._submitBtn = null;
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
            const placeholder = (this.getAttribute("placeholder") || "Search recipes, ingredients…")
                .replace(/"/g, "&quot;");
            const submitLabel = (this.getAttribute("submit-label") || "Search").replace(/"/g, "&quot;");

            this.shadowRoot.innerHTML = `
                <style>
                    :host {
                        display: block;
                        width: 100%;
                        max-width: 520px;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        --br-search-accent: #4f46e5;
                        --br-search-accent-press: #4338ca;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    .field {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        height: 48px;
                        padding: 0 6px 0 16px;
                        margin: 0;
                        background: #fff;
                        border: 1px solid #d4d4d8;
                        border-radius: 12px;
                        transition: border-color .15s ease, box-shadow .15s ease;
                    }
                    .field:focus-within {
                        border-color: var(--br-search-accent);
                        box-shadow: 0 0 0 4px color-mix(in srgb, var(--br-search-accent) 16%, transparent);
                    }
                    .icon {
                        flex: 0 0 auto;
                        width: 18px;
                        height: 18px;
                        color: #a1a1aa;
                    }
                    input {
                        flex: 1 1 auto;
                        min-width: 0;
                        height: 100%;
                        border: none;
                        outline: none;
                        background: transparent;
                        font: inherit;
                        font-size: 15px;
                        color: #18181b;
                    }
                    input::placeholder {
                        color: #a1a1aa;
                    }
                    input::-webkit-search-cancel-button {
                        -webkit-appearance: none;
                    }
                    .clear {
                        flex: 0 0 auto;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        width: 20px;
                        height: 20px;
                        padding: 0;
                        border: none;
                        border-radius: 50%;
                        background: #e4e4e7;
                        color: #52525b;
                        font-size: 13px;
                        line-height: 1;
                        cursor: pointer;
                        transition: background .15s ease;
                    }
                    .clear:hover {
                        background: #d4d4d8;
                    }
                    .clear.is-visible {
                        display: inline-flex;
                    }
                    .submit {
                        flex: 0 0 auto;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        height: 36px;
                        padding: 0 16px;
                        border: none;
                        border-radius: 9px;
                        background: var(--br-search-accent);
                        color: #fff;
                        font: inherit;
                        font-size: 14px;
                        font-weight: 600;
                        line-height: 1;
                        cursor: pointer;
                        transition: background .15s ease, transform .05s ease;
                    }
                    .submit:hover {
                        background: var(--br-search-accent-press);
                    }
                    .submit:active {
                        transform: translateY(1px);
                    }
                    .submit:disabled {
                        background: #d4d4d8;
                        color: #fafafa;
                        cursor: not-allowed;
                    }
                    .submit svg {
                        width: 16px;
                        height: 16px;
                    }
                    .submit .label {
                        white-space: nowrap;
                    }
                    @media (max-width: 420px) {
                        .submit .label {
                            display: none;
                        }
                        .submit {
                            padding: 0 12px;
                        }
                    }
                </style>
                <form class="field" part="field" role="search" novalidate>
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="search" part="input" enterkeyhint="search" autocomplete="off"
                           spellcheck="false" placeholder="${placeholder}" aria-label="${placeholder}"/>
                    <button class="clear" type="button" part="clear" aria-label="Clear search" tabindex="-1">&times;</button>
                    <button class="submit" type="submit" part="submit">
                        <span class="label">${submitLabel}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </button>
                </form>
            `;

            this._form = this.shadowRoot.querySelector("form");
            this._input = this.shadowRoot.querySelector("input");
            this._clearBtn = this.shadowRoot.querySelector(".clear");
            this._submitBtn = this.shadowRoot.querySelector(".submit");

            this._syncControls();
            this._bindEvents();
        }

        get value() {
            return this._input === null ? "" : this._input.value;
        }

        set value(next) {
            if (this._input === null) {
                return;
            }

            this._input.value = next == null ? "" : String(next);
            this._syncControls();
        }

        _syncControls() {
            const hasValue = this.value.trim().length > 0;

            if (this._clearBtn !== null) {
                this._clearBtn.classList.toggle("is-visible", hasValue);
            }
            if (this._submitBtn !== null) {
                this._submitBtn.disabled = !hasValue;
            }
        }

        _bindEvents() {
            this._input.addEventListener("input", () => this._syncControls());

            this._clearBtn.addEventListener("click", () => {
                this.value = "";
                this._input.focus();
            });

            this._form.addEventListener("submit", (event) => {
                event.preventDefault();

                const query = this.value.trim();
                if (query === "") {
                    return;
                }

                this.dispatchEvent(new CustomEvent("br-ui-search:submit", {
                    bubbles: true,
                    composed: true,
                    detail: {query: query}
                }));
            });
        }
    }

    class UiSearchResults extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({mode: "open"});
            this.rendered = false;

            // Safari 12/13: no class fields
            this._results = [];
            this._loading = false;
            this._grid = null;
            this._status = null;
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

        get results() {
            return this._results;
        }

        set results(next) {
            this._results = $.isArray(next) ? next : [];
            this._loading = false;
            this._update();
        }

        get loading() {
            return this._loading;
        }

        set loading(next) {
            this._loading = next === true;
            this._update();
        }

        render() {
            this.shadowRoot.innerHTML = `
                <style>
                    :host {
                        display: block;
                        width: 100%;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        --br-search-accent: #4f46e5;
                        color: #18181b;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    .grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
                        gap: 20px;
                    }
                    .card {
                        display: flex;
                        flex-direction: column;
                        background: #fff;
                        border: 1px solid #e4e4e7;
                        border-radius: 14px;
                        overflow: hidden;
                        text-decoration: none;
                        color: inherit;
                        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
                    }
                    .card:hover {
                        transform: translateY(-3px);
                        border-color: #d4d4d8;
                        box-shadow: 0 12px 28px rgba(24, 24, 27, .10);
                    }
                    .card:focus-visible {
                        outline: none;
                        border-color: var(--br-search-accent);
                        box-shadow: 0 0 0 4px color-mix(in srgb, var(--br-search-accent) 18%, transparent);
                    }
                    .media {
                        position: relative;
                        aspect-ratio: 4 / 3;
                        background: #f4f4f5;
                        overflow: hidden;
                    }
                    .media img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        display: block;
                        transition: transform .3s ease;
                    }
                    .card:hover .media img {
                        transform: scale(1.04);
                    }
                    .rating {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        padding: 4px 8px;
                        background: rgba(24, 24, 27, .72);
                        color: #fff;
                        border-radius: 999px;
                        font-size: 12px;
                        font-weight: 600;
                        line-height: 1;
                    }
                    .rating svg {
                        width: 12px;
                        height: 12px;
                        color: #fbbf24;
                    }
                    .body {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                        padding: 14px 16px 16px;
                    }
                    .name {
                        font-size: 15px;
                        font-weight: 600;
                        line-height: 1.35;
                        margin: 0;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                    }
                    .meta {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 12.5px;
                        color: #71717a;
                    }
                    .meta svg {
                        width: 13px;
                        height: 13px;
                    }
                    .tags {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 6px;
                    }
                    .tag {
                        padding: 3px 9px;
                        background: #f4f4f5;
                        color: #52525b;
                        border-radius: 999px;
                        font-size: 11.5px;
                        font-weight: 500;
                        text-transform: capitalize;
                    }
                    .status {
                        padding: 40px 16px;
                        text-align: center;
                        color: #71717a;
                        font-size: 14px;
                    }
                    .skeleton {
                        border: 1px solid #f4f4f5;
                        border-radius: 14px;
                        overflow: hidden;
                    }
                    .skeleton .media,
                    .skeleton .line {
                        background: linear-gradient(90deg, #f4f4f5 25%, #ececee 37%, #f4f4f5 63%);
                        background-size: 400% 100%;
                        animation: br-shimmer 1.4s ease infinite;
                    }
                    .skeleton .line {
                        height: 12px;
                        border-radius: 6px;
                        margin: 0 16px;
                    }
                    .skeleton .line.first {
                        margin-top: 16px;
                        width: 70%;
                    }
                    .skeleton .line.second {
                        margin-top: 10px;
                        margin-bottom: 16px;
                        width: 45%;
                    }
                    @keyframes br-shimmer {
                        0% { background-position: 100% 0; }
                        100% { background-position: 0 0; }
                    }
                    @keyframes br-card-in {
                        from { opacity: 0; transform: translateY(8px); }
                        to { opacity: 1; transform: none; }
                    }
                    @media (prefers-reduced-motion: no-preference) {
                        .card.is-enter {
                            animation: br-card-in .32s ease both;
                        }
                    }
                </style>
                <div class="status" part="status" hidden></div>
                <div class="grid" part="grid"></div>
            `;

            this._grid = this.shadowRoot.querySelector(".grid");
            this._status = this.shadowRoot.querySelector(".status");
            this._update();
        }

        _update() {
            if (this._grid === null || this._status === null) {
                return;
            }

            this._grid.textContent = "";

            if (this._loading === true) {
                this._status.hidden = true;
                for (let i = 0; i < 6; i++) {
                    this._grid.appendChild(this._renderSkeleton());
                }
                return;
            }

            if (this._results.length === 0) {
                this._status.hidden = false;
                const query = Breinify.UTL.isNonEmptyString(this.getAttribute("query"));
                this._status.textContent = query === null
                    ? "No results to show."
                    : 'No results found for "' + query + '".';
                return;
            }

            this._status.hidden = true;
            for (let i = 0; i < this._results.length; i++) {
                const card = this._renderCard(this._results[i], i);
                if (card !== null) {
                    this._grid.appendChild(card);
                }
            }
        }

        _renderSkeleton() {
            const skeleton = document.createElement("div");
            skeleton.className = "skeleton";
            skeleton.innerHTML = '<div class="media"></div><div class="line first"></div><div class="line second"></div>';
            return skeleton;
        }

        _renderCard(item, index) {
            const data = $.isPlainObject(item) && $.isPlainObject(item.additionalData) ? item.additionalData : null;
            if (data === null) {
                return null;
            }

            const get = (key) => data[PRODUCT_PREFIX + key];

            const name = Breinify.UTL.isNonEmptyString(get("productName"));
            const url = Breinify.UTL.isNonEmptyString(get("productUrl"));
            const imageUrl = Breinify.UTL.isNonEmptyString(get("productImageUrl"));
            const rating = typeof get("avgRating") === "number" ? get("avgRating") : null;
            const prep = typeof get("minPrepTime") === "number" ? get("minPrepTime") : 0;
            const cook = typeof get("minCookTime") === "number" ? get("minCookTime") : 0;
            const totalTime = prep + cook;

            const card = document.createElement(url === null ? "div" : "a");
            card.className = "card is-enter";
            card.style.animationDelay = Math.min(index, 12) * 0.04 + "s";
            if (url !== null) {
                card.href = url;
                card.setAttribute("part", "card");
            }

            const media = document.createElement("div");
            media.className = "media";
            if (imageUrl !== null) {
                const img = document.createElement("img");
                img.src = imageUrl;
                img.alt = name === null ? "" : name;
                img.loading = "lazy";
                media.appendChild(img);
            }
            if (rating !== null) {
                const badge = document.createElement("span");
                badge.className = "rating";
                badge.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
                    + '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'
                    + '</svg>';
                badge.appendChild(document.createTextNode(rating.toFixed(1)));
                media.appendChild(badge);
            }
            card.appendChild(media);

            const body = document.createElement("div");
            body.className = "body";

            const title = document.createElement("p");
            title.className = "name";
            title.textContent = name === null ? "Untitled recipe" : name;
            body.appendChild(title);

            if (totalTime > 0) {
                const meta = document.createElement("div");
                meta.className = "meta";
                meta.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
                    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                    + '<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15.5 14"></polyline></svg>';
                meta.appendChild(document.createTextNode(Math.round(totalTime) + " min"));
                body.appendChild(meta);
            }

            const tagValues = ($.isArray(get("hvrRecipeTypes")) ? get("hvrRecipeTypes") : [])
                .concat($.isArray(get("hvrMainIngredients")) ? get("hvrMainIngredients") : [])
                .map((tag) => Breinify.UTL.isNonEmptyString(tag))
                .filter((tag) => tag !== null)
                .slice(0, 3);

            if (tagValues.length > 0) {
                const tags = document.createElement("div");
                tags.className = "tags";
                tagValues.forEach((value) => {
                    const tag = document.createElement("span");
                    tag.className = "tag";
                    tag.textContent = value;
                    tags.appendChild(tag);
                });
                body.appendChild(tags);
            }

            card.appendChild(body);

            if (url !== null) {
                card.addEventListener("click", () => {
                    this.dispatchEvent(new CustomEvent("br-ui-search:select", {
                        bubbles: true,
                        composed: true,
                        detail: {item: item, dataIdExternal: item.dataIdExternal}
                    }));
                });
            }

            return card;
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
            if (window.customElements) {
                if (!window.customElements.get(searchElementName)) {
                    window.customElements.define(searchElementName, UiSearch);
                }
                if (!window.customElements.get(resultsElementName)) {
                    window.customElements.define(resultsElementName, UiSearchResults);
                }
            }
        },

        render: function (module, config) {
            this.init();

            const runtime = _private.getRuntime(module, config);
        }
    });
})();
