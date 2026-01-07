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

        /**
         * Hook: subclasses can override to disable shadow DOM usage.
         * For components like <br-simple-slider> that need light DOM,
         * return false.
         */
        usesShadowRoot() {
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
                        // Look for JSON config scripts. We intentionally use `type$="application/json"`
                        // instead of an exact match, because libraries like jQuery may rewrite script
                        // tags while inserting HTML (e.g. `application/json` → `true/application/json`).
                        if (this.querySelector('script[type$="application/json"]')) {
                            this._config = this._loadConfig();
                            this._render();
                        }
                        break;
                    }
                }
            });

            this._observer.observe(this, {childList: true, subtree: false});
        }

        _loadConfig() {
            const script = this.querySelector('script[type$="application/json"]');

            if (!script) {
                return {};
            }

            try {
                const json = script.textContent.trim();
                const parsed = json ? JSON.parse(json) : {};

                // remove the element and return
                script.remove();
                return parsed;
            } catch (e) {
                const tag = this.tagName ? this.tagName.toLowerCase() : "unknown-element";
                console.error(`[${tag}] Invalid JSON in config script`, e);
                return {};
            }
        }

        _ensureShadowRoot() {
            if (!this.shadowRoot) {
                this.attachShadow({mode: "open"});
            }
            return this.shadowRoot;
        }

        /**
         * Internal: template method that uses the `render` hook.
         */
        _render() {
            const root = this.usesShadowRoot() ? this._ensureShadowRoot() : this;
            this.render(root);
        }

        /**
         * Hook: subclasses override this to render their own UI.
         * Default: show config as pretty-printed JSON.
         */
        render(root) {
            root.innerHTML = `
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

    class BrSimpleSlider extends BrConfigurable {
        static STYLE_ELEMENT_ID = "br-simple-slider-style";

        static DEFAULT_CONFIG = {
            minItemWidth: 200,
            maxItemWidth: 280,
            showArrows: true,
            phonePeek: true
        };

        static STYLE_CONTENT =
            "br-simple-slider.br-simple-slider {" +
            "  display: flex;" +
            "  align-items: center;" +
            "  position: relative;" +
            "}" +

            ".br-simple-slider__track {" +
            "  display: flex;" +
            "  flex: 1 1 auto;" +
            "  min-width: 0;" +
            "  overflow-x: auto;" +
            "  scroll-snap-type: x mandatory;" +
            "  scroll-behavior: smooth;" +
            "  gap: 12px;" +
            "  padding: 0;" +
            "  cursor: grab;" +
            "  -ms-overflow-style: none;" +
            "  scrollbar-width: none;" +
            "  overscroll-behavior-x: contain;" +
            "}" +

            ".br-simple-slider__track::-webkit-scrollbar {" +
            "  display: none;" +
            "}" +

            ".br-simple-slider__track.is-dragging {" +
            "  cursor: grabbing;" +
            "}" +

            ".br-simple-slider__item {" +
            "  flex: 0 0 auto;" +
            "  scroll-snap-align: start;" +
            "  box-sizing: border-box;" +
            "  min-width: 0;" +
            "  overflow: hidden;" +
            "}" +

            ".br-simple-slider__btn {" +
            "  flex: 0 0 auto;" +
            "  border: none;" +
            "  background: transparent;" +
            "  cursor: pointer;" +
            "  font-size: 24px;" +
            "  padding: 0 4px;" +
            "}" +

            ".br-simple-slider__btn[disabled] {" +
            "  opacity: 0.3;" +
            "  cursor: default;" +
            "}";

        static ensureStylesAdded(hostElement) {
            if (document.getElementById(BrSimpleSlider.STYLE_ELEMENT_ID)) {
                return;
            }

            const styleEl = document.createElement("style");
            styleEl.id = BrSimpleSlider.STYLE_ELEMENT_ID;
            styleEl.type = "text/css";
            styleEl.textContent = BrSimpleSlider.STYLE_CONTENT;

            if (hostElement.firstChild) {
                hostElement.insertBefore(styleEl, hostElement.firstChild);
            } else {
                hostElement.appendChild(styleEl);
            }
        }

        static getGapPx(track) {
            if (!track || typeof window === "undefined" || !window.getComputedStyle) {
                return 0;
            }

            const style = window.getComputedStyle(track);
            const rawGap = style.columnGap || style.gap;
            const value = parseFloat(rawGap);

            return Number.isNaN(value) ? 0 : value;
        }

        static smoothScrollBy(track, delta) {
            if (!track) return;

            try {
                if (typeof track.scrollBy === "function") {
                    track.scrollBy({left: delta, behavior: "smooth"});
                    return;
                }
            } catch (_e) {
            }

            track.scrollLeft = track.scrollLeft + delta;
        }

        /**
         * @param {number} trackWidth
         * @param {number} gap
         * @param {number} minW
         * @param {number} maxW
         * @param {boolean} phonePeek
         */
        static determineItemsPerView(trackWidth, gap, minW, maxW, phonePeek) {
            const viewport = window.innerWidth || document.documentElement.clientWidth || 0;
            const isPhone = viewport <= 600;

            let minN = Math.ceil((trackWidth + gap) / (maxW + gap));
            let maxN = Math.floor((trackWidth + gap) / (minW + gap));

            if (minN < 1) minN = 1;
            if (maxN < 1) maxN = 1;

            let nBase = maxN;
            if (nBase < 1) nBase = 1;

            if (isPhone && phonePeek) {
                const candidate = 1.5;
                const totalGapCandidate = gap * Math.max(0, candidate - 1);
                const itemWidthCandidate = (trackWidth - totalGapCandidate) / candidate;

                if (itemWidthCandidate >= minW && itemWidthCandidate <= maxW) {
                    return candidate;
                }

                return nBase;
            }

            return nBase;
        }

        /**
         * Slider needs light DOM, not shadow.
         */
        usesShadowRoot() {
            return false;
        }

        /**
         * We still want to observe config script changes (default true is fine),
         * so no need to override shouldObserveConfigChanges().
         */

        /**
         * Called by BrConfigurable._render(), with `root` = this (because usesShadowRoot() === false).
         * We ignore `root` and work on the light DOM.
         */
        render(_root) {
            this.classList.add("br-simple-slider");
            BrSimpleSlider.ensureStylesAdded(this);

            // merge defaults with loaded config
            const base = BrSimpleSlider.DEFAULT_CONFIG;
            const rawCfg = this._config || {};
            this._config = {
                minItemWidth: typeof rawCfg.minItemWidth === "number" && rawCfg.minItemWidth > 0
                    ? rawCfg.minItemWidth : base.minItemWidth,
                maxItemWidth: typeof rawCfg.maxItemWidth === "number" && rawCfg.maxItemWidth > 0
                    ? rawCfg.maxItemWidth : base.maxItemWidth,
                showArrows: typeof rawCfg.showArrows === "boolean"
                    ? rawCfg.showArrows : base.showArrows,
                phonePeek: typeof rawCfg.phonePeek === "boolean"
                    ? rawCfg.phonePeek : base.phonePeek
            };

            if (!this._initialized) {
                this._setupStructure();
                this._setupButtons();
                this._setupDragToScroll();
                this._setupItemMutationObserver();
                this._setupResizeHandler();
            }

            this._applyLayout();
        }

        disconnectedCallback() {
            super.disconnectedCallback();

            if (this._itemObserver) {
                this._itemObserver.disconnect();
                this._itemObserver = null;
            }
            if (this._resizeHandler) {
                window.removeEventListener("resize", this._resizeHandler);
                this._resizeHandler = null;
            }
        }

        _setupStructure() {
            const existingChildren = Array.prototype.slice.call(this.children);
            const track = document.createElement("div");
            track.className = "br-simple-slider__track";
            this.appendChild(track);

            existingChildren.forEach((child) => {
                if (!(child instanceof HTMLElement)) return;
                if (child.id === BrSimpleSlider.STYLE_ELEMENT_ID ||
                    child.classList.contains("br-simple-slider__btn")) {
                    return;
                }
                if (child.tagName &&
                    child.tagName.toLowerCase() === "script" &&
                    child.getAttribute("type") &&
                    child.getAttribute("type").endsWith("application/json")) {
                    return;
                }

                track.appendChild(child);
                child.classList.add("br-simple-slider__item");
            });

            this._track = track;
        }

        _setupButtons() {
            const track = this._track;
            const cfg = this._config || BrSimpleSlider.DEFAULT_CONFIG;

            if (!cfg.showArrows) {
                this._prevBtn = null;
                this._nextBtn = null;
                this._updateButtons = null;
                return;
            }

            const prev = document.createElement("button");
            prev.type = "button";
            prev.className = "br-simple-slider__btn br-simple-slider__btn--prev";
            prev.innerHTML = "&#8249;";

            const next = document.createElement("button");
            next.type = "button";
            next.className = "br-simple-slider__btn br-simple-slider__btn--next";
            next.innerHTML = "&#8250;";

            this.insertBefore(prev, track);
            this.appendChild(next);

            const getStep = () => {
                const firstItem = track.querySelector(".br-simple-slider__item");
                if (!firstItem) return 0;
                const rect = firstItem.getBoundingClientRect();
                const gap = BrSimpleSlider.getGapPx(track);
                return rect.width + gap;
            };

            prev.addEventListener("click", () => {
                const step = getStep();
                if (step > 0) BrSimpleSlider.smoothScrollBy(track, -step);
            });

            next.addEventListener("click", () => {
                const step = getStep();
                if (step > 0) BrSimpleSlider.smoothScrollBy(track, step);
            });

            this._prevBtn = prev;
            this._nextBtn = next;

            const updateButtons = () => {
                const maxScroll = track.scrollWidth - track.clientWidth;
                const current = track.scrollLeft;

                if (maxScroll <= 0) {
                    prev.disabled = true;
                    next.disabled = true;
                } else {
                    prev.disabled = current <= 0;
                    next.disabled = current >= maxScroll - 1;
                }
            };

            track.addEventListener("scroll", updateButtons);
            this._updateButtons = updateButtons;
        }

        _setupDragToScroll() {
            const track = this._track;
            if (!track) return;

            let isDown = false;
            let startX = 0;
            let scrollLeft = 0;

            track.addEventListener("mousedown", (e) => {
                isDown = true;
                track.classList.add("is-dragging");
                startX = e.pageX - track.getBoundingClientRect().left;
                scrollLeft = track.scrollLeft;
            });

            track.addEventListener("mouseleave", () => {
                if (!isDown) return;
                isDown = false;
                track.classList.remove("is-dragging");
            });

            window.addEventListener("mouseup", () => {
                if (!isDown) return;
                isDown = false;
                track.classList.remove("is-dragging");
            });

            track.addEventListener("mousemove", (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - track.getBoundingClientRect().left;
                const walk = x - startX;
                track.scrollLeft = scrollLeft - walk;
            });
        }

        _setupItemMutationObserver() {
            if (typeof MutationObserver === "undefined") return;

            const track = this._track;
            const self = this;

            const observer = new MutationObserver(function (mutations) {
                let requiresLayout = false;

                mutations.forEach(function (mutation) {
                    if (mutation.type !== "childList") return;

                    if (mutation.target === self) {
                        Array.prototype.forEach.call(mutation.addedNodes, function (node) {
                            if (!(node instanceof HTMLElement)) return;

                            if (node === track ||
                                node.id === BrSimpleSlider.STYLE_ELEMENT_ID ||
                                node.classList.contains("br-simple-slider__btn")) {
                                return;
                            }
                            if (node.tagName &&
                                node.tagName.toLowerCase() === "script" &&
                                node.getAttribute("type") &&
                                node.getAttribute("type").endsWith("application/json")) {
                                return;
                            }

                            track.appendChild(node);
                            node.classList.add("br-simple-slider__item");
                            requiresLayout = true;
                        });
                    }

                    if (mutation.target === track) {
                        Array.prototype.forEach.call(mutation.addedNodes, function (node) {
                            if (node instanceof HTMLElement) {
                                node.classList.add("br-simple-slider__item");
                                requiresLayout = true;
                            }
                        });
                    }
                });

                if (requiresLayout) self._applyLayout();
            });

            observer.observe(this, {childList: true});
            observer.observe(track, {childList: true});

            this._itemObserver = observer;
        }

        _setupResizeHandler() {
            let resizeTimeout = null;

            this._resizeHandler = () => {
                if (resizeTimeout !== null) {
                    window.clearTimeout(resizeTimeout);
                }

                resizeTimeout = window.setTimeout(() => {
                    resizeTimeout = null;
                    this._applyLayout();
                }, 100);
            };

            window.addEventListener("resize", this._resizeHandler);
        }

        _applyLayout() {
            const track = this._track;
            if (!track) return;

            const items = track.querySelectorAll(".br-simple-slider__item");
            if (!items.length) return;

            const trackWidth = track.clientWidth;
            if (!trackWidth) return;

            const cfg = this._config || BrSimpleSlider.DEFAULT_CONFIG;
            const minW = cfg.minItemWidth;
            const maxW = cfg.maxItemWidth;
            const phonePeek = cfg.phonePeek !== false;

            const gap = BrSimpleSlider.getGapPx(track);
            const perView = BrSimpleSlider.determineItemsPerView(trackWidth, gap, minW, maxW, phonePeek);
            const totalGap = gap * Math.max(0, perView - 1);
            const itemWidth = (trackWidth - totalGap) / perView;

            items.forEach((item) => {
                const px = itemWidth + "px";

                item.style.flex = "0 0 " + px;
                item.style.width = px;
                item.style.minWidth = px;
                item.style.maxWidth = px;
            });

            if (this._updateButtons) this._updateButtons();
        }
    }

    const UiCustomElements = {
        _classes: {},

        init: function () {
            this.addClass('BrConfigurable', BrConfigurable);
            this.defineElement('br-simple-slider', BrSimpleSlider)
        },

        addClass: function (name, cls) {
            this._classes[name] = cls;
        },

        getClass: function (name) {
            const cls = this._classes[name];

            if (cls) {
                return cls;
            } else {
                throw new Error(`UiCustomElements: Class "${name}" is not registered. Ensure UiCustomElements.init() or addClass("${name}", ...) ?`);
            }
        },

        defineElement: function (name, element) {
            if (window.customElements && !window.customElements.get(name)) {
                window.customElements.define(name, element);
            }
        }
    };

    // add the plugin and use the bound version to be initialized once Breinify is ready
    const BoundUiCustomElements = Breinify.plugins._add('uiCustomElements', UiCustomElements);
    BoundUiCustomElements.init();
})();