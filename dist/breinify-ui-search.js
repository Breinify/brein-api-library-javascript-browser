"use strict";

(function () {
    if (typeof Breinify !== "object") {
        return;
    } else if (Breinify.plugins._isAdded("uiSearch")) {
        return;
    }

    const searchElementName = "br-ui-search";
    const resultsElementName = "br-ui-search-results";
    const defaultResultElementName = "br-ui-search-result";
    const $ = Breinify.UTL._jquery();
    const uiCustomElements = Breinify.plugins.uiCustomElements;
    const BrConfigurable = uiCustomElements.getClass("BrConfigurable");

    const defaultSearchTemplate = `
        <style>
            :host {
                display: block;
                width: 100%;
                font-family: var(--br-search-font-family, inherit);
                color: var(--br-search-color, inherit);
            }
            * { box-sizing: border-box; }
            form {
                display: flex;
                align-items: stretch;
                gap: var(--br-search-gap, 0.5rem);
                margin: 0;
            }
            input {
                flex: 1 1 auto;
                min-width: 0;
                padding: var(--br-search-input-padding, 0.625rem 0.75rem);
                border: var(--br-search-input-border, 1px solid #b8b8b8);
                border-radius: var(--br-search-border-radius, 0.25rem);
                background: var(--br-search-input-background, #fff);
                color: inherit;
                font: inherit;
            }
            button {
                padding: var(--br-search-button-padding, 0.625rem 0.875rem);
                border: var(--br-search-button-border, 1px solid #777);
                border-radius: var(--br-search-border-radius, 0.25rem);
                background: var(--br-search-button-background, #fff);
                color: var(--br-search-button-color, inherit);
                font: inherit;
                cursor: pointer;
            }
            button[hidden] { display: none; }
            button:disabled { cursor: default; opacity: 0.55; }
        </style>
        <form part="form" role="search" data-br-search-form novalidate>
            <input part="input" data-br-search-input type="search" enterkeyhint="search" />
            <button part="clear" data-br-search-clear type="button" hidden></button>
            <button part="submit" data-br-search-submit type="submit">
                <span data-br-search-submit-label></span>
            </button>
        </form>
    `;

    const defaultResultsTemplate = `
        <style>
            :host {
                display: block;
                width: 100%;
                font-family: var(--br-search-results-font-family, inherit);
                color: var(--br-search-results-color, inherit);
            }
            [data-br-search-results] {
                display: var(--br-search-results-display, grid);
                grid-template-columns: var(--br-search-results-columns, repeat(auto-fill, minmax(12rem, 1fr)));
                gap: var(--br-search-results-gap, 1rem);
            }
            [data-br-search-status] {
                padding: var(--br-search-status-padding, 1rem 0);
            }
            [data-br-search-status][hidden] { display: none; }
        </style>
        <div part="status" data-br-search-status role="status" aria-live="polite" hidden></div>
        <div part="results" data-br-search-results></div>
    `;

    const _helpers = {
        toBoolean: function (value) {
            return value === true || value === "" || value === "true" || value === "1";
        },

        toNonNegativeInteger: function (value) {
            const parsed = parseInt(value, 10);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        },

        string: function (value, fallback) {
            return typeof value === "string" ? value : fallback;
        },

        snippet: function (snippetId) {
            const normalizedId = Breinify.UTL.isNonEmptyString(snippetId);
            if (normalizedId === null || Breinify.plugins._isAdded("snippetManager") !== true) {
                return null;
            }

            return Breinify.UTL.isNonEmptyString(
                Breinify.plugins.snippetManager.getSnippet(normalizedId)
            );
        },

        observeSnippet: function (element, snippetId, callback) {
            const normalizedId = Breinify.UTL.isNonEmptyString(snippetId);
            if (normalizedId === null ||
                Breinify.plugins._isAdded("snippetManager") !== true ||
                !$.isFunction(callback)) {
                return;
            }

            element._observedSnippetIds = $.isPlainObject(element._observedSnippetIds)
                ? element._observedSnippetIds
                : {};

            if (element._observedSnippetIds[normalizedId] === true) {
                return;
            }

            element._observedSnippetIds[normalizedId] = true;
            Breinify.plugins.snippetManager.onSnippetRegistered(normalizedId, function () {
                if (element.isConnected === true) {
                    callback.call(element);
                }
            });
        },

        addConfigScript: function (element, config) {
            const script = document.createElement("script");
            script.type = "application/json";
            script.textContent = JSON.stringify($.isPlainObject(config) ? config : {});
            element.appendChild(script);
        },

        validCustomElementName: function (name) {
            const normalizedName = Breinify.UTL.isNonEmptyString(name);
            return normalizedName !== null && /^[a-z][a-z0-9._-]*-[a-z0-9._-]+$/.test(normalizedName)
                ? normalizedName
                : null;
        }
    };

    class UiSearch extends BrConfigurable {
        constructor() {
            super();

            // Safari 12/13: no class fields
            this._form = null;
            this._input = null;
            this._clearButton = null;
            this._submitButton = null;
            this._value = "";
            this._valueWasSet = false;
            this._inputTimer = null;
            this._observedSnippetIds = {};
            this._jsonConfig = {};
        }

        disconnectedCallback() {
            super.disconnectedCallback();

            if (this._inputTimer !== null) {
                window.clearTimeout(this._inputTimer);
                this._inputTimer = null;
            }
        }

        getConfigAttributeMap() {
            return {
                query: "query",
                placeholder: "placeholder",
                submitLabel: "submit-label",
                clearLabel: "clear-label",
                inputLabel: "input-label",
                template: "template",
                minQueryLength: {
                    attribute: "min-query-length",
                    transform: _helpers.toNonNegativeInteger
                },
                debounce: {
                    attribute: "debounce",
                    transform: _helpers.toNonNegativeInteger
                },
                searchOnInput: {
                    attribute: "search-on-input",
                    transform: _helpers.toBoolean
                },
                disabled: {
                    attribute: "disabled",
                    transform: _helpers.toBoolean
                }
            };
        }

        _loadConfig() {
            const hasConfigScript = Array.prototype.some.call(this.children, (child) => {
                return this._isConfigScriptNode(child);
            });
            const jsonConfig = super._loadConfig();

            if (hasConfigScript) {
                this._jsonConfig = $.isPlainObject(jsonConfig) ? $.extend(true, {}, jsonConfig) : {};
            }
            return jsonConfig;
        }

        _mergeConfig(_jsonConfig, attributeConfig) {
            return $.extend(true, {},
                this._jsonConfig,
                $.isPlainObject(attributeConfig) ? attributeConfig : {}
            );
        }

        get value() {
            return this._input === null ? this._value : this._input.value;
        }

        set value(value) {
            this._value = value == null ? "" : String(value);
            this._valueWasSet = true;

            if (this._input !== null) {
                this._input.value = this._value;
                this._syncControls();
            }
        }

        configure(settings) {
            this._jsonConfig = $.isPlainObject(settings) ? $.extend(true, {}, settings) : {};
            this._config = $.extend(true, {}, this._jsonConfig, this._loadAttributeConfig());
            this._render();
        }

        focus() {
            if (this._input !== null) {
                this._input.focus();
            }
        }

        clear() {
            const previousQuery = this.value;
            this.value = "";

            this.dispatchEvent(new CustomEvent("br-ui-search:clear", {
                bubbles: true,
                composed: true,
                detail: {query: "", previousQuery: previousQuery}
            }));

            this._dispatchInput("clear");
        }

        render(root) {
            const previousValue = this.value;
            const templateId = this._config.template;
            const template = _helpers.snippet(templateId);

            root.innerHTML = template === null ? defaultSearchTemplate : template;

            this._form = root.querySelector("[data-br-search-form]") || root.querySelector("form");
            this._input = root.querySelector("[data-br-search-input]") || root.querySelector('input[type="search"]');
            this._clearButton = root.querySelector("[data-br-search-clear]");
            this._submitButton = root.querySelector("[data-br-search-submit]");

            if (!(this._form instanceof HTMLElement) || !(this._input instanceof HTMLInputElement)) {
                root.innerHTML = defaultSearchTemplate;
                this._form = root.querySelector("[data-br-search-form]");
                this._input = root.querySelector("[data-br-search-input]");
                this._clearButton = root.querySelector("[data-br-search-clear]");
                this._submitButton = root.querySelector("[data-br-search-submit]");
            }

            if (template === null && Breinify.UTL.isNonEmptyString(templateId) !== null) {
                _helpers.observeSnippet(this, templateId, this._render);
            }

            const configuredQuery = _helpers.string(this._config.query, "");
            const nextValue = this._initialized === true || this._valueWasSet === true
                ? previousValue
                : configuredQuery;

            this._value = nextValue;
            this._input.value = nextValue;
            this._input.placeholder = _helpers.string(this._config.placeholder, "Search");
            this._input.setAttribute(
                "aria-label",
                _helpers.string(this._config.inputLabel, this._input.placeholder || "Search")
            );
            this._input.autocomplete = _helpers.string(this._config.autocomplete, "off");
            this._input.name = _helpers.string(this._config.name, "query");
            this._input.disabled = this._config.disabled === true;

            if (this._clearButton !== null) {
                this._clearButton.setAttribute(
                    "aria-label",
                    _helpers.string(this._config.clearLabel, "Clear search")
                );
                this._clearButton.textContent = _helpers.string(this._config.clearText, "Clear");
                this._clearButton.disabled = this._config.disabled === true;
            }

            if (this._submitButton !== null) {
                const submitLabel = _helpers.string(this._config.submitLabel, "Search");
                const label = this._submitButton.querySelector("[data-br-search-submit-label]");
                if (label === null) {
                    this._submitButton.textContent = submitLabel;
                } else {
                    label.textContent = submitLabel;
                }
                this._submitButton.disabled = this._config.disabled === true;
            }

            this._bindEvents();
            this._syncControls();
        }

        _bindEvents() {
            this._input.addEventListener("input", () => {
                this._value = this._input.value;
                this._valueWasSet = true;
                this._syncControls();
                this._dispatchInput("input");
            });

            if (this._clearButton !== null) {
                this._clearButton.addEventListener("click", () => {
                    this.clear();
                    this.focus();
                });
            }

            this._form.addEventListener("submit", (event) => {
                event.preventDefault();
                this._dispatchSearch("submit");
            });
        }

        _syncControls() {
            const hasValue = this.value.length > 0;
            const canSubmit = this._isValidQuery(this._query());

            if (this._clearButton !== null) {
                this._clearButton.hidden = !hasValue;
            }
            if (this._submitButton !== null) {
                this._submitButton.disabled = this._config.disabled === true || !canSubmit;
            }
        }

        _query() {
            return this.value.trim();
        }

        _minimumQueryLength() {
            return Number.isInteger(this._config.minQueryLength) && this._config.minQueryLength >= 0
                ? this._config.minQueryLength
                : 1;
        }

        _isValidQuery(query) {
            return this._config.disabled !== true && query.length >= this._minimumQueryLength();
        }

        _dispatchInput(source) {
            const query = this._query();

            this.dispatchEvent(new CustomEvent("br-ui-search:input", {
                bubbles: true,
                composed: true,
                detail: {query: query, value: this.value, source: source}
            }));

            if (this._config.searchOnInput !== true) {
                return;
            }

            if (this._inputTimer !== null) {
                window.clearTimeout(this._inputTimer);
                this._inputTimer = null;
            }

            const debounce = Number.isInteger(this._config.debounce) && this._config.debounce >= 0
                ? this._config.debounce
                : 0;

            this._inputTimer = window.setTimeout(() => {
                this._inputTimer = null;
                this._dispatchSearch(source);
            }, debounce);
        }

        _dispatchSearch(source) {
            const query = this._query();
            if (!this._isValidQuery(query)) {
                return false;
            }

            this.dispatchEvent(new CustomEvent("br-ui-search:submit", {
                bubbles: true,
                composed: true,
                detail: {query: query, value: this.value, source: source}
            }));
            return true;
        }
    }

    class UiSearchResults extends BrConfigurable {
        constructor() {
            super();

            // Safari 12/13: no class fields
            this._results = [];
            this._resultsWereSet = false;
            this._loading = false;
            this._error = null;
            this._resultsContainer = null;
            this._status = null;
            this._observedSnippetIds = {};
            this._jsonConfig = {};
        }

        getConfigAttributeMap() {
            return {
                query: "query",
                template: "template",
                resultTemplate: "result-template",
                resultElement: "result-element",
                emptyMessage: "empty-message",
                loadingMessage: "loading-message"
            };
        }

        _loadConfig() {
            const hasConfigScript = Array.prototype.some.call(this.children, (child) => {
                return this._isConfigScriptNode(child);
            });
            const jsonConfig = super._loadConfig();

            if (hasConfigScript) {
                this._jsonConfig = $.isPlainObject(jsonConfig) ? $.extend(true, {}, jsonConfig) : {};
            }
            return jsonConfig;
        }

        _mergeConfig(_jsonConfig, attributeConfig) {
            return $.extend(true, {},
                this._jsonConfig,
                $.isPlainObject(attributeConfig) ? attributeConfig : {}
            );
        }

        get results() {
            return this._results.slice();
        }

        set results(results) {
            this._results = $.isArray(results) ? results.slice() : [];
            this._resultsWereSet = true;
            this._loading = false;
            this._error = null;
            this._update();
        }

        get loading() {
            return this._loading;
        }

        set loading(loading) {
            this._loading = loading === true;
            if (this._loading === true) {
                this._error = null;
            }
            this._update();
        }

        get error() {
            return this._error;
        }

        set error(error) {
            this._error = error == null ? null : error;
            this._loading = false;
            this._update();
        }

        configure(settings) {
            this._jsonConfig = $.isPlainObject(settings) ? $.extend(true, {}, settings) : {};
            this._config = $.extend(true, {}, this._jsonConfig, this._loadAttributeConfig());
            this._render();
        }

        render(root) {
            const templateId = this._config.template;
            const template = _helpers.snippet(templateId);

            root.innerHTML = template === null ? defaultResultsTemplate : template;
            this._resultsContainer = root.querySelector("[data-br-search-results]");
            this._status = root.querySelector("[data-br-search-status]");

            if (!(this._resultsContainer instanceof HTMLElement) || !(this._status instanceof HTMLElement)) {
                root.innerHTML = defaultResultsTemplate;
                this._resultsContainer = root.querySelector("[data-br-search-results]");
                this._status = root.querySelector("[data-br-search-status]");
            }

            if (template === null && Breinify.UTL.isNonEmptyString(templateId) !== null) {
                _helpers.observeSnippet(this, templateId, this._render);
            }

            if (this._resultsWereSet !== true && $.isArray(this._config.items)) {
                this._results = this._config.items.slice();
            }
            if (this._initialized !== true && this._config.loading === true) {
                this._loading = true;
            }

            this._update();
        }

        _update() {
            if (this._resultsContainer === null || this._status === null) {
                return;
            }

            this._resultsContainer.textContent = "";

            if (this._loading === true) {
                this._showStatus(_helpers.string(this._config.loadingMessage, "Loading results…"));
                this.setAttribute("aria-busy", "true");
                this._dispatchRendered();
                return;
            }

            this.removeAttribute("aria-busy");

            if (this._error !== null) {
                const defaultMessage = this._error instanceof Error
                    ? this._error.message
                    : String(this._error);
                this._showStatus(_helpers.string(this._config.errorMessage, defaultMessage || "Unable to load results."));
                this._dispatchRendered();
                return;
            }

            if (this._results.length === 0) {
                const query = _helpers.string(this._config.query, "");
                const message = _helpers.string(this._config.emptyMessage, "No results.")
                    .replace(/\{query\}/g, query);
                this._showStatus(message);
                this._dispatchRendered();
                return;
            }

            this._status.hidden = true;
            this._status.textContent = "";

            const fragment = document.createDocumentFragment();
            for (let i = 0; i < this._results.length; i += 1) {
                fragment.appendChild(this._createResultElement(this._results[i], i));
            }
            this._resultsContainer.appendChild(fragment);
            this._dispatchRendered();
        }

        _showStatus(message) {
            this._status.textContent = message;
            this._status.hidden = false;
        }

        _createResultElement(result, index) {
            const resultTemplateId = this._config.resultTemplate;
            const resultTemplate = _helpers.snippet(resultTemplateId);
            let resultElement = null;

            if (resultTemplate !== null) {
                const template = document.createElement("template");
                template.innerHTML = resultTemplate;
                resultElement = template.content.firstElementChild;
            } else if (Breinify.UTL.isNonEmptyString(resultTemplateId) !== null) {
                _helpers.observeSnippet(this, resultTemplateId, this._update);
            }

            if (!(resultElement instanceof HTMLElement)) {
                const configuredName = _helpers.validCustomElementName(this._config.resultElement);
                resultElement = document.createElement(configuredName || defaultResultElementName);
            }

            resultElement.setAttribute("data-br-search-result-index", String(index));
            if (!resultElement.hasAttribute("part")) {
                resultElement.setAttribute("part", "result");
            }

            const resultConfig = document.createElement("script");
            resultConfig.type = "application/json";
            resultConfig.textContent = JSON.stringify(typeof result === "undefined" ? null : result);

            // BrConfigurable only reads direct child configuration scripts.
            resultElement.insertBefore(resultConfig, resultElement.firstChild);
            return resultElement;
        }

        _dispatchRendered() {
            this.dispatchEvent(new CustomEvent("br-ui-search-results:rendered", {
                bubbles: true,
                composed: true,
                detail: {
                    count: this._loading === true || this._error !== null ? 0 : this._results.length,
                    loading: this._loading,
                    error: this._error
                }
            }));
        }
    }

    // Generic fallback until a customer-specific BrConfigurable result element is supplied.
    class UiSearchResult extends BrConfigurable {}

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
                    elements: null
                };
                this.runtimes[webExVersionId] = runtime;
            }

            runtime.module = module;
            runtime.settings = $.extend(true, {
                type: module.type,
                campaignName: Breinify.UTL.isNonEmptyString(module.campaignName),
                webExVersionId: module.webExVersionId,
                webExId: module.webExId
            }, $.isPlainObject(settings) ? settings : {});
            return runtime;
        },

        createElements: function (runtime) {
            const containerId = "br-ui-search-" + runtime.webExVersionId;
            let container = document.getElementById(containerId);

            if (!(container instanceof HTMLElement) || container.getAttribute("data-br-ui-search") !== "") {
                container = document.createElement("div");
                container.id = containerId;
                container.setAttribute("data-br-ui-search", "");
            }

            let search = container.querySelector(searchElementName);
            if (!(search instanceof UiSearch)) {
                search = document.createElement(searchElementName);
                _helpers.addConfigScript(search, this.searchSettings(runtime.settings));
                container.appendChild(search);
            } else {
                search.configure(this.searchSettings(runtime.settings));
            }

            let results = container.querySelector(resultsElementName);
            if (!(results instanceof UiSearchResults)) {
                results = document.createElement(resultsElementName);
                _helpers.addConfigScript(results, this.resultsSettings(runtime.settings));
                container.appendChild(results);
            } else {
                results.configure(this.resultsSettings(runtime.settings));
            }

            if (container._brUiSearchBound !== true) {
                container._brUiSearchBound = true;
                search.addEventListener("br-ui-search:submit", function (event) {
                    results.setAttribute("query", event.detail.query);
                });
            }

            runtime.elements = {
                container: container,
                search: search,
                results: results
            };
            return runtime.elements;
        },

        searchSettings: function (settings) {
            return $.isPlainObject(settings.search) ? settings.search : settings;
        },

        resultsSettings: function (settings) {
            return $.isPlainObject(settings.results) ? settings.results : {};
        }
    };

    Breinify.plugins._add("uiSearch", {
        init: function () {
            uiCustomElements.defineElement(searchElementName, UiSearch);
            uiCustomElements.defineElement(resultsElementName, UiSearchResults);
            uiCustomElements.defineElement(defaultResultElementName, UiSearchResult);
        },

        createSearch: function (settings) {
            this.init();
            const search = document.createElement(searchElementName);
            _helpers.addConfigScript(search, settings);
            return search;
        },

        createSearchResults: function (settings) {
            this.init();
            const results = document.createElement(resultsElementName);
            _helpers.addConfigScript(results, settings);
            return results;
        },

        /**
         * Creates a search and results pair and delegates placement to the shared
         * web-experience attachment logic. Query fulfillment stays event-driven.
         *
         * @param {Object} module web-experience module metadata
         * @param {Object} config user-provided experience settings
         * @return {boolean} true when the experience is attached
         */
        render: function (module, config) {
            this.init();

            const runtime = _private.getRuntime(module, config);
            if (runtime === null) {
                return false;
            }

            const elements = _private.createElements(runtime);
            const attached = Breinify.plugins.webExperiences.attach(
                runtime.settings,
                $(elements.container),
                {cardinality: "single"}
            );

            if (attached === true) {
                Breinify.plugins.webExperiences.style(runtime.settings, $(elements.container));
            }

            return attached;
        }
    });
})();
