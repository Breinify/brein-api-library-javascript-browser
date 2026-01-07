"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('uiCustomElements')) {
        return;
    }

    class BrConfigurable extends HTMLElement {
        _config = {};
        _observer = null;
        _initialized = false;

        connectedCallback() {
            if (this._initialized === true) {
                return;
            }

            this._config = this._loadConfig();
            this._render();

            if (this.shouldObserveConfigChanges()) {
                this._observeConfigChanges();
            }

            this._initialized = true;
        }

        disconnectedCallback() {
            if (this._observer !== null) {
                this._observer.disconnect();
                this._observer = null;
            }
        }

        /**
         * Hook: subclasses can override to disable observing.
         */
        shouldObserveConfigChanges() {
            return true;
        }

        _observeConfigChanges() {
            if (this._observer !== null) {
                this._observer.disconnect();
                this._observer = null;
            }

            this._observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.type === "childList") {
                        if (this.querySelector('script[type="application/json"]')) {
                            this._config = this._loadConfig();
                            this._render();
                        }
                        break;
                    }
                }
            });

            this._observer.observe(this, { childList: true, subtree: false });
        }

        _loadConfig() {
            const script = this.querySelector('script[type="application/json"]');

            if (!script) {
                return {};
            }

            try {
                const json = script.textContent.trim();
                return json ? JSON.parse(json) : {};
            } catch (e) {
                console.error(`[${name}] Invalid JSON in config script`, e);
                return {};
            }
        }

        /**
         * Internal: ensure we have a shadow root and return it.
         */
        _ensureShadowRoot() {
            if (!this.shadowRoot) {
                this.attachShadow({ mode: "open" });
            }
            return this.shadowRoot;
        }

        /**
         * Internal: template method that uses the `render` hook.
         */
        _render() {
            const shadow = this._ensureShadowRoot();
            this.render(shadow);
        }

        /**
         * Hook: subclasses override this to render their own UI.
         * Default: show config as pretty-printed JSON.
         */
        render(shadowRoot) {
            shadowRoot.innerHTML = `
                <style>
                  .br-default-product {
                    font-family: sans-serif;
                  }
                </style>
        
                <div class="br-product br-default-product">
                  <pre>${JSON.stringify(this._config, null, 2)}</pre>
                </div>
            `;
        }
    }

    const UiCustomElements = {
        _classes: {},

        init: function () {
            this.addClass('BrConfigurable', BrConfigurable);
        },

        addClass: function(name, cls) {
            this._classes[name] = cls;
        },

        defineElement: function(name, element) {
            if (window.customElements && !window.customElements.get(name)) {
                window.customElements.define(name, element);
            }
        }
    };

    // add the plugin and use the bound version to be initialized once Breinify is ready
    const BoundUiCustomElements = Breinify.plugins._add('uiCustomElements', UiCustomElements);
    BoundUiCustomElements.init();
})();