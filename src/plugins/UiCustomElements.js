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

        constructor() {
            super();

            // Safari 12/13: no class fields
            this._config = {};
            this._observer = null;
            this._initialized = false;
        }

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

        constructor() {
            super();

            // Safari 12/13: no class fields
            this._sliderInitialized = false;

            this._layout = null;
            this._header = null;
            this._headerLeft = null;
            this._headerTitle = null;
            this._headerSubtitle = null;
            this._headerCta = null;

            this._track = null;
            this._prevBtn = null;
            this._nextBtn = null;

            this._updateButtons = null;
            this._itemObserver = null;
            this._resizeHandler = null;

            this._activeIndex = 0;
            this._keyboardHandler = null;

            this._carouselDesc = null;
        }

        // Safari 12/13 compatible (static getter is OK)
        static get observedAttributes() {
            return [
                "data-title",
                "data-subtitle",
                "data-hide-header",
                "data-title-position",
                "data-cta-label",
                "data-cta-url",
                "data-cta-color",
                "data-cta-background"
            ];
        }

        usesShadowRoot() {
            return false;
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
            if (this._keyboardHandler && this._track) {
                this._track.removeEventListener("keydown", this._keyboardHandler, true);
                this._keyboardHandler = null;
            }
        }

        // ---------- statics (methods only; "constants" assigned after the class) ----------

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
            if (!track) {
                return;
            }

            try {
                if (typeof track.scrollBy === "function") {
                    track.scrollBy({left: delta, behavior: "smooth"});
                    return;
                }
            } catch (_e) {
            }

            track.scrollLeft = track.scrollLeft + delta;
        }

        static resolveConfigForWidth(baseConfig, trackWidth) {
            const cfg = {
                minItemWidth: baseConfig.minItemWidth,
                maxItemWidth: baseConfig.maxItemWidth,
                showArrows: baseConfig.showArrows,
                phonePeek: baseConfig.phonePeek
            };

            const bps = Array.isArray(baseConfig.breakpoints) ? baseConfig.breakpoints : [];

            for (let i = 0; i < bps.length; i += 1) {
                const bp = bps[i];
                if (!bp || typeof bp.maxWidth !== "number") {
                    continue;
                }
                if (trackWidth <= bp.maxWidth) {
                    const s = bp.settings || {};
                    if (typeof s.minItemWidth === "number" && s.minItemWidth > 0) cfg.minItemWidth = s.minItemWidth;
                    if (typeof s.maxItemWidth === "number" && s.maxItemWidth > 0) cfg.maxItemWidth = s.maxItemWidth;
                    if (typeof s.showArrows === "boolean") cfg.showArrows = s.showArrows;
                    if (typeof s.phonePeek === "boolean") cfg.phonePeek = s.phonePeek;
                    break;
                }
            }

            return cfg;
        }

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
            }

            return nBase;
        }

        // ---------- render / init ----------

        render(_root) {
            this.classList.add("br-simple-slider");
            BrSimpleSlider.ensureStylesAdded(this);

            const base = BrSimpleSlider.DEFAULT_CONFIG;
            const rawCfg = this._config || {};

            let breakpoints = [];
            if (Array.isArray(rawCfg.breakpoints)) {
                breakpoints = rawCfg.breakpoints
                    .filter((bp) => bp && typeof bp === "object")
                    .map((bp) => {
                        const maxWidth = (typeof bp.maxWidth === "number" && bp.maxWidth > 0) ? bp.maxWidth : null;
                        const settings = (bp.settings && typeof bp.settings === "object") ? bp.settings : {};
                        return {maxWidth, settings};
                    })
                    .filter((bp) => bp.maxWidth !== null)
                    .sort((a, b) => a.maxWidth - b.maxWidth);
            }

            // Merge slider config (unchanged behavior)
            this._config = {
                minItemWidth: (typeof rawCfg.minItemWidth === "number" && rawCfg.minItemWidth > 0) ? rawCfg.minItemWidth : base.minItemWidth,
                maxItemWidth: (typeof rawCfg.maxItemWidth === "number" && rawCfg.maxItemWidth > 0) ? rawCfg.maxItemWidth : base.maxItemWidth,
                showArrows: (typeof rawCfg.showArrows === "boolean") ? rawCfg.showArrows : base.showArrows,
                phonePeek: (typeof rawCfg.phonePeek === "boolean") ? rawCfg.phonePeek : base.phonePeek,
                breakpoints: breakpoints,

                // header config defaults
                title: (typeof rawCfg.title === "string") ? rawCfg.title : base.title,
                subtitle: (typeof rawCfg.subtitle === "string") ? rawCfg.subtitle : base.subtitle,
                hideHeader: (typeof rawCfg.hideHeader === "boolean") ? rawCfg.hideHeader : base.hideHeader,
                titlePosition: (typeof rawCfg.titlePosition === "string") ? rawCfg.titlePosition : base.titlePosition,

                ctaLabel: (typeof rawCfg.ctaLabel === "string") ? rawCfg.ctaLabel : base.ctaLabel,
                ctaUrl: (typeof rawCfg.ctaUrl === "string") ? rawCfg.ctaUrl : base.ctaUrl,
                ctaColor: (typeof rawCfg.ctaColor === "string") ? rawCfg.ctaColor : base.ctaColor,
                ctaBackground: (typeof rawCfg.ctaBackground === "string") ? rawCfg.ctaBackground : base.ctaBackground
            };

            if (!this._sliderInitialized) {
                this._setupStructure();
                this._setupButtons();
                this._setupDragToScroll();
                this._setupPreventHistorySwipe();
                this._setupItemMutationObserver();
                this._setupResizeHandler();
                this._setupKeyboardNavigation();
                this._sliderInitialized = true;
            }

            this._applyHeader();
            this._applyLayout();
        }

        // ---------- structure ----------

        _setupStructure() {
            const existingChildren = Array.prototype.slice.call(this.children);

            // layout wrapper: grid columns [prev][track-col][next], rows [header][slider]
            const layout = document.createElement("div");
            layout.className = "br-simple-slider__layout";
            this.appendChild(layout);
            this._layout = layout;

            // header: aligns with track column (col 2), above it (row 1)
            const header = document.createElement("div");
            header.className = "br-simple-slider__header";
            header.style.display = "none";

            const headerLeft = document.createElement("div");
            headerLeft.className = "br-simple-slider__header-left";

            const title = document.createElement("div");
            title.className = "br-simple-slider__header-title";
            title.style.display = "none";
            title.id = "br-simple-slider-title-" + Breinify.UTL.uuid();

            const subtitle = document.createElement("div");
            subtitle.className = "br-simple-slider__header-subtitle";
            subtitle.style.display = "none";

            headerLeft.appendChild(title);
            headerLeft.appendChild(subtitle);

            const cta = document.createElement("a");
            cta.className = "br-simple-slider__header-cta";
            cta.style.display = "none";
            cta.setAttribute("rel", "noopener noreferrer");

            header.appendChild(headerLeft);
            header.appendChild(cta);

            layout.appendChild(header);

            this._header = header;
            this._headerLeft = headerLeft;
            this._headerTitle = title;
            this._headerSubtitle = subtitle;
            this._headerCta = cta;

            // track: aligns with track column (col 2), row 2
            const track = document.createElement("div");
            track.className = "br-simple-slider__track";
            track.setAttribute("tabindex", "-1");
            track.setAttribute("role", "region");
            track.setAttribute("aria-label", "Item carousel");
            track.setAttribute("aria-roledescription", "carousel");

            if (!track.id) {
                track.id = "br-simple-slider-track-" + Breinify.UTL.uuid();
            }

            layout.appendChild(track);
            this._track = track;

            // add a description for ADA compliance
            const desc = document.createElement("span");
            desc.id = "br-simple-slider-desc-" + Breinify.UTL.uuid();
            desc.className = "br-visually-hidden";
            desc.textContent = "Item carousel";

            this.appendChild(desc);
            this._carouselDesc = desc;

            // move existing children into track
            existingChildren.forEach((child) => {
                if (!(child instanceof HTMLElement)) {
                    return;
                }

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

                if (child === layout) {
                    return;
                }

                this._addItem(child, false);
            });

            this._updateItemPositions();
            this._setActiveIndex(this._activeIndex, false);
            this._applyTrackLabel();
        }

        _applyTrackLabel() {
            if (!this._track) {
                return;
            }

            const titleEl = this._headerTitle;
            const titleVisible = !!(titleEl && titleEl.style.display !== "none");
            const titleText = titleEl ? String(titleEl.textContent || "").trim() : "";

            // Track label: prefer title element id
            if (titleVisible && titleText.length > 0 && titleEl.id) {
                this._track.setAttribute("aria-labelledby", titleEl.id);
                this._track.removeAttribute("aria-label");
            } else {
                this._track.removeAttribute("aria-labelledby");
                this._track.setAttribute("aria-label", "Item carousel");
            }

            // Shared description for slides (aria-describedby target)
            if (this._carouselDesc) {
                this._carouselDesc.textContent = titleVisible && titleText.length > 0 ? titleText + " carousel" : "Item carousel";
            }
        }

        // ---------- keyboard support (ADA) ----------
        _setupKeyboardNavigation() {
            const track = this._track;
            if (!track) {
                return;
            }

            // remove previous handler if re-init happens
            if (this._keyboardHandler) {
                track.removeEventListener("keydown", this._keyboardHandler, true);
                this._keyboardHandler = null;
            }

            this._keyboardHandler = (e) => {
                // never interfere with modifiers (browser/AT shortcuts)
                if (e.altKey || e.ctrlKey || e.metaKey) {
                    return;
                }

                // never trap Tab
                if (e.key === "Tab") {
                    return;
                }

                if (e.key === "ArrowRight") {
                    e.preventDefault();
                    this._setActiveIndex(this._activeIndex + 1, true);
                } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    this._setActiveIndex(this._activeIndex - 1, true);
                } else if (e.key === "Home") {
                    e.preventDefault();
                    this._setActiveIndex(0, true);
                } else if (e.key === "End") {
                    e.preventDefault();
                    const items = this._getItems();
                    this._setActiveIndex(items.length - 1, true);
                } else if (e.key === "Enter" || e.key === " ") {
                    // Prevent page scroll on Space
                    e.preventDefault();
                    this._activateFocusedItem();
                }
            };

            track.addEventListener("keydown", this._keyboardHandler, true);
        }

        _findPrimaryAction(item) {
            if (!item) return null;

            // explicit marker wins (supports host marker too)
            let el = this._queryDeep(item, "[data-br-primary-action]");
            if (el instanceof HTMLElement) return el;

            el = this._queryDeep(item, "a[href]");
            if (el instanceof HTMLElement) return el;

            el = this._queryDeep(item, "button");
            if (el instanceof HTMLElement) return el;

            el = this._queryDeep(item, '[role="button"], [tabindex="0"]');
            if (el instanceof HTMLElement) return el;

            return null;
        }

        // ---------- items ----------

        _activateFocusedItem() {
            const items = this._getItems();
            const active = items[this._activeIndex];
            if (!active) {
                return;
            }

            // If focus is already on an interactive element inside the slide,
            // don’t hijack (let it behave naturally).
            const ae = document.activeElement;
            if (ae && active.contains(ae) && ae !== active) {
                return;
            }

            const target = this._findPrimaryAction(active);
            if (!target) {
                return;
            }

            // 1) Explicit activation hook (for custom elements)
            if (typeof target.activate === "function") {
                target.activate();
                return;
            }

            // 2) Native click (fires jQuery + DOM handlers)
            if (typeof target.click === "function") {
                target.click();
                return;
            }
        }

        _getItems() {
            if (!this._track) {
                return [];
            }

            return Array.prototype.slice.call(this._track.querySelectorAll(".br-simple-slider__item"));
        }

        _setActiveIndex(nextIndex, focus) {
            const items = this._getItems();
            const size = items.length;

            if (size === 0) {
                this._activeIndex = 0;
                return;
            }

            let idx = nextIndex;
            if (idx < 0) idx = 0;
            if (idx >= size) idx = size - 1;

            this._activeIndex = idx;

            for (let i = 0; i < size; i += 1) {
                const item = items[i];
                if (!item || !item.setAttribute) continue;

                item.setAttribute("tabindex", (i === idx) ? "0" : "-1");

                // only the active item references the carousel description
                if (this._carouselDesc && this._carouselDesc.id) {
                    if (i === idx) {
                        item.setAttribute("aria-describedby", this._carouselDesc.id);
                    } else {
                        item.removeAttribute("aria-describedby");
                    }
                }
            }

            const active = items[idx];
            if (active && focus === true) {
                // keep the item visible
                try {
                    active.scrollIntoView({block: "nearest", inline: "nearest"});
                } catch (_e) {
                    // ignore
                }

                try {
                    active.focus({preventScroll: true});
                } catch (_e2) {
                    active.focus();
                }
            }
        }

        _addItem(node, updateItemPositions) {
            if (!(node instanceof HTMLElement) || !this._track) {
                return false;
            }

            // Ignore internal nodes we never want to treat as items
            if (node === this._track ||
                node.id === BrSimpleSlider.STYLE_ELEMENT_ID ||
                node.classList.contains("br-simple-slider__btn")) {
                return false;
            }

            // Ignore JSON config scripts
            if (node.tagName &&
                node.tagName.toLowerCase() === "script" &&
                node.getAttribute("type") &&
                node.getAttribute("type").endsWith("application/json")) {
                return false;
            }

            // Ensure it's in the track
            if (node.parentNode !== this._track) {
                this._track.appendChild(node);
            }

            // Mark item
            node.classList.add("br-simple-slider__item");

            // A11y: slide semantics (attributes only; no UX change)
            node.setAttribute("role", "group");
            node.setAttribute("aria-roledescription", "slide");

            if (updateItemPositions !== false) {
                this._updateItemPositions();
            }
            return true;
        }

        _updateItemPositions() {
            if (!this._track) {
                return;
            }

            const items = this._track.querySelectorAll(".br-simple-slider__item");
            const size = items.length;

            for (let i = 0; i < size; i += 1) {
                const item = items[i];
                if (!(item instanceof HTMLElement)) {
                    continue;
                }

                // A11y: slide position context
                item.setAttribute("aria-setsize", String(size));
                item.setAttribute("aria-posinset", String(i + 1));
            }
        }

        // ---------- buttons ----------

        _setupButtons() {
            const track = this._track;
            const layout = this._layout;

            if (!track || !layout) {
                return;
            }

            const prev = document.createElement("button");
            prev.type = "button";
            prev.className = "br-simple-slider__btn br-simple-slider__btn--prev";
            prev.innerHTML = "&#8249;";
            prev.setAttribute("aria-label", "Previous items");
            prev.setAttribute("title", "Previous");

            const next = document.createElement("button");
            next.type = "button";
            next.className = "br-simple-slider__btn br-simple-slider__btn--next";
            next.innerHTML = "&#8250;";
            next.setAttribute("aria-label", "Next items");
            next.setAttribute("title", "Next");

            // link buttons as controls for the track
            if (track && track.id) {
                prev.setAttribute("aria-controls", track.id);
                next.setAttribute("aria-controls", track.id);
            }

            // Place into grid; CSS assigns them to col 1 / col 3 row 2
            layout.appendChild(prev);
            layout.appendChild(next);

            const getStep = () => {
                const firstItem = track.querySelector(".br-simple-slider__item");
                if (!firstItem) {
                    return 0;
                }
                const rect = firstItem.getBoundingClientRect();
                const gap = BrSimpleSlider.getGapPx(track);
                return rect.width + gap;
            };

            prev.addEventListener("click", () => {
                const step = getStep();
                if (step > 0) {
                    BrSimpleSlider.smoothScrollBy(track, -step);
                }
            });

            next.addEventListener("click", () => {
                const step = getStep();
                if (step > 0) {
                    BrSimpleSlider.smoothScrollBy(track, step);
                }
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

        // ---------- drag ----------

        _setupDragToScroll() {
            const track = this._track;
            if (!track) {
                return;
            }

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
                if (!isDown) {
                    return;
                }
                isDown = false;
                track.classList.remove("is-dragging");
            });

            window.addEventListener("mouseup", () => {
                if (!isDown) {
                    return;
                }
                isDown = false;
                track.classList.remove("is-dragging");
            });

            track.addEventListener("mousemove", (e) => {
                if (!isDown) {
                    return;
                }
                e.preventDefault();
                const x = e.pageX - track.getBoundingClientRect().left;
                const walk = x - startX;
                track.scrollLeft = scrollLeft - walk;
            });
        }

        _setupPreventHistorySwipe() {
            const track = this._track;
            if (!track) {
                return;
            }

            const isHorizontalIntent = (e) => {
                const dx = e.deltaX || 0;
                const dy = e.deltaY || 0;
                // horizontal intent if dx dominates
                return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 0;
            };

            const getMaxScrollLeft = () => {
                const max = track.scrollWidth - track.clientWidth;
                return max > 0 ? max : 0;
            };

            // Capture phase so we intercept before Safari converts it into history navigation
            track.addEventListener("wheel", (e) => {
                if (!isHorizontalIntent(e)) {
                    return;
                }

                const dx = e.deltaX || 0;
                const max = getMaxScrollLeft();
                const cur = track.scrollLeft;

                // If layout isn’t ready yet (max==0), Safari may treat the swipe as history nav.
                // Prevent that initial "back/forward" gesture; once layout is ready, normal scroll works.
                if (max === 0) {
                    e.preventDefault();
                    return;
                }

                const atLeft = cur <= 0;
                const atRight = cur >= max - 1;

                // Only block when user pushes beyond edges (this is when history swipe happens)
                if ((atLeft && dx < 0) || (atRight && dx > 0)) {
                    e.preventDefault();
                }
            }, {passive: false, capture: true});
        }

        // ---------- observers / resize ----------

        _setupItemMutationObserver() {
            if (typeof MutationObserver === "undefined") {
                return;
            }

            const track = this._track;
            const self = this;

            const observer = new MutationObserver(function (mutations) {
                let requiresLayout = false;

                mutations.forEach(function (mutation) {
                    if (mutation.type !== "childList") {
                        return;
                    }

                    if (mutation.target === self) {
                        Array.prototype.forEach.call(mutation.addedNodes, function (node) {
                            if (!(node instanceof HTMLElement)) {
                                return;
                            }

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

                            requiresLayout = self._addItem(node) || requiresLayout;
                        });
                    }

                    if (mutation.target === track) {
                        Array.prototype.forEach.call(mutation.addedNodes, function (node) {
                            if (node instanceof HTMLElement) {
                                requiresLayout = self._addItem(node) || requiresLayout;
                            }
                        });
                    }
                });

                if (requiresLayout) {
                    self._applyLayout();
                }
            });

            observer.observe(this, {childList: true, subtree: false});
            observer.observe(track, {childList: true, subtree: false});

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

        // ---------- header logic ----------

        _readTrimmedAttr(name) {
            const raw = this.getAttribute(name);
            if (raw === null) {
                return null;
            }
            return String(raw).trim();
        }

        _readAttrNonEmpty(name) {
            const v = this._readTrimmedAttr(name);
            if (v === null) {
                return null;
            }
            return v.length > 0 ? v : null;
        }

        _parseHideHeaderAttr() {
            const v = this._readTrimmedAttr("data-hide-header");
            if (v === null) {
                return null; // not set
            }
            const lc = v.toLowerCase();
            return (lc === "true" || lc === "yes" || lc === "y");
        }

        _resolveTitlePosition() {
            const attrPos = this._readAttrNonEmpty("data-title-position");
            const cfgPos = (this._config && typeof this._config.titlePosition === "string") ? this._config.titlePosition : "left";

            const val = (attrPos !== null) ? attrPos : cfgPos;
            const lc = String(val || "").toLowerCase();

            return (lc === "center") ? "center" : "left";
        }

        _applyHeader() {
            if (!this._header || !this._headerTitle || !this._headerSubtitle || !this._headerCta) {
                return;
            }

            const cfg = this._config || BrSimpleSlider.DEFAULT_CONFIG;

            // Priority:
            //  - attribute (exists + non-empty trimmed) wins
            //  - else config
            const titleAttr = this._readAttrNonEmpty("data-title");
            const subtitleAttr = this._readAttrNonEmpty("data-subtitle");

            const title = (titleAttr !== null) ? titleAttr : String(cfg.title || "").trim();
            const subtitle = (subtitleAttr !== null) ? subtitleAttr : String(cfg.subtitle || "").trim();

            const hasTitle = title.length > 0;
            const hasSubtitle = subtitle.length > 0;

            // CTA values (attribute non-empty wins, else config)
            const ctaLabelAttr = this._readAttrNonEmpty("data-cta-label");
            const ctaUrlAttr = this._readAttrNonEmpty("data-cta-url");
            const ctaColorAttr = this._readAttrNonEmpty("data-cta-color");
            const ctaBgAttr = this._readAttrNonEmpty("data-cta-background");

            const ctaLabel = (ctaLabelAttr !== null) ? ctaLabelAttr : String(cfg.ctaLabel || "").trim();
            const ctaUrl = (ctaUrlAttr !== null) ? ctaUrlAttr : String(cfg.ctaUrl || "").trim();
            const ctaColor = (ctaColorAttr !== null) ? ctaColorAttr : String(cfg.ctaColor || "").trim();
            const ctaBg = (ctaBgAttr !== null) ? ctaBgAttr : String(cfg.ctaBackground || "").trim();

            const hasCta = (ctaLabel.length > 0) && (ctaUrl.length > 0);

            // hide-header:
            // - active only when attribute is true/yes/y (any case)
            // - else fall back to config.hideHeader
            const hideAttr = this._parseHideHeaderAttr();
            const hideCfg = (typeof cfg.hideHeader === "boolean") ? cfg.hideHeader : false;
            const explicitlyHidden = (hideAttr === true) || (hideAttr === null && hideCfg === true);

            // implicit hide: if both title+subtitle empty AND no CTA
            const implicitlyHidden = (!hasTitle && !hasSubtitle && !hasCta);

            if (explicitlyHidden || implicitlyHidden) {
                this._header.style.display = "none";
                this._applyTrackLabel();
                return;
            }

            // show header
            this._header.style.display = "";

            // titlePosition
            const pos = this._resolveTitlePosition();
            this._header.setAttribute("data-title-position", pos);

            // title
            if (hasTitle) {
                this._headerTitle.textContent = title;
                this._headerTitle.style.display = "";
            } else {
                this._headerTitle.textContent = "";
                this._headerTitle.style.display = "none";
            }

            // subtitle
            if (hasSubtitle) {
                this._headerSubtitle.textContent = subtitle;
                this._headerSubtitle.style.display = "";
            } else {
                this._headerSubtitle.textContent = "";
                this._headerSubtitle.style.display = "none";
            }

            // cta
            if (hasCta) {
                this._headerCta.textContent = ctaLabel;
                this._headerCta.setAttribute("href", ctaUrl);
                this._headerCta.setAttribute("target", "_blank");
                this._headerCta.style.display = "";

                // reset then apply optional styles
                this._headerCta.style.color = "";
                this._headerCta.style.background = "";
                if (ctaColor.length > 0) {
                    this._headerCta.style.color = ctaColor;
                }
                if (ctaBg.length > 0) {
                    this._headerCta.style.background = ctaBg;
                }
            } else {
                this._headerCta.textContent = "";
                this._headerCta.removeAttribute("href");
                this._headerCta.removeAttribute("target");
                this._headerCta.style.display = "none";
                this._headerCta.style.color = "";
                this._headerCta.style.background = "";
            }

            // adapt the label of the whole track based on the title
            this._applyTrackLabel();
        }

        // ---------- layout sizing (unchanged) ----------

        _applyLayout() {
            const track = this._track;
            if (!track) {
                return;
            }

            const items = track.querySelectorAll(".br-simple-slider__item");
            if (!items.length) {
                return;
            }

            const trackWidth = track.clientWidth;
            if (!trackWidth) {
                return;
            }

            const baseCfg = this._config || BrSimpleSlider.DEFAULT_CONFIG;
            const gap = BrSimpleSlider.getGapPx(track);

            const effectiveCfg = BrSimpleSlider.resolveConfigForWidth(baseCfg, trackWidth);
            const minW = effectiveCfg.minItemWidth;
            const maxW = effectiveCfg.maxItemWidth;
            const phonePeek = effectiveCfg.phonePeek !== false;

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

            if (this._prevBtn && this._nextBtn) {
                const showArrows = effectiveCfg.showArrows !== false;
                this._prevBtn.style.display = showArrows ? "" : "none";
                this._nextBtn.style.display = showArrows ? "" : "none";
            }

            if (this._updateButtons) {
                this._updateButtons();
            }

            this._setActiveIndex(this._activeIndex, false);
        }

        // ---------- utility ----------

        _queryDeep(root, selector) {
            if (!root) {
                return null;
            }

            // 1) Light DOM query on this root (Element or ShadowRoot)
            if (typeof root.querySelector === "function") {
                const hit = root.querySelector(selector);
                if (hit) {
                    return hit;
                }
            }

            // 2) If this root is an Element with an OPEN shadow root, search it too
            if (root instanceof Element && root.shadowRoot) {
                const inside = this._queryDeep(root.shadowRoot, selector);
                if (inside) {
                    return inside;
                }
            }

            // 3) Traverse descendants and enter their open shadow roots
            if (typeof root.querySelectorAll !== "function") {
                return null;
            }

            const tree = root.querySelectorAll("*");
            for (let i = 0; i < tree.length; i += 1) {
                const el = tree[i];
                if (el && el.shadowRoot) {
                    const inside = this._queryDeep(el.shadowRoot, selector);
                    if (inside) {
                        return inside;
                    }
                }
            }

            return null;
        }
    }

    /* Safari 12/13 compatible "static constants" */
    BrSimpleSlider.STYLE_ELEMENT_ID = "br-simple-slider-style";

    BrSimpleSlider.DEFAULT_CONFIG = {
        minItemWidth: 200,
        maxItemWidth: 280,
        showArrows: true,
        phonePeek: true,
        breakpoints: [],

        // header defaults
        title: "",
        subtitle: "",
        hideHeader: false,
        titlePosition: "left",

        ctaLabel: "",
        ctaUrl: "",
        ctaColor: "",
        ctaBackground: ""
    };

    BrSimpleSlider.STYLE_CONTENT =
        /* host: keep simple, layout wrapper handles structure */
        "br-simple-slider.br-simple-slider {" +
        "  display: block;" +
        "  position: relative;" +
        "}" +

        // visually hidden elements (only needed for ADA)
        ".br-visually-hidden{" +
        "  position:absolute!important;" +
        "  width:1px!important;" +
        "  height:1px!important;" +
        "  margin:-1px!important;" +
        "  border:0!important;" +
        "  padding:0!important;" +
        "  overflow:hidden!important;" +
        "  clip:rect(0 0 0 0)!important;" +
        "  clip-path:inset(50%)!important;" +
        "  white-space:nowrap!important;" +
        "}" +

        /* layout grid: [prev][track-col][next], rows [header][slider] */
        ".br-simple-slider__layout {" +
        "  display: grid;" +
        "  grid-template-columns: auto minmax(0, 1fr) auto;" +
        "  grid-template-rows: auto auto;" +
        "  align-items: center;" +
        "  width: 100%;" +
        "}" +

        /* header aligned with track column */
        ".br-simple-slider__header {" +
        "  grid-column: 2;" +
        "  grid-row: 1;" +
        "  display: grid;" +
        "  grid-template-columns: minmax(0, 1fr) auto;" +
        "  align-items: center;" +
        "  margin: 0 0 10px 0;" +
        "}" +

        ".br-simple-slider__header-left {" +
        "  min-width: 0;" +
        "}" +

        ".br-simple-slider__header[data-title-position='left'] .br-simple-slider__header-left {" +
        "  text-align: left;" +
        "}" +
        ".br-simple-slider__header[data-title-position='center'] .br-simple-slider__header-left {" +
        "  text-align: center;" +
        "}" +

        ".br-simple-slider__header-title {" +
        "  font-weight: 600;" +
        "  line-height: 1.2;" +
        "  font-size: 1.2rem;" +
        "  padding-bottom: .15rem;" +
        "}" +
        ".br-simple-slider__header-subtitle {" +
        "  opacity: 0.75;" +
        "  line-height: 1.2;" +
        "  margin-top: 2px;" +
        "  font-size: .8rem;" +
        "}" +

        ".br-simple-slider__header-cta {" +
        "  justify-self: end;" +
        "  display: inline-block;" +
        "  text-decoration: none;" +
        "  padding: 6px 10px;" +
        "  border-radius: 6px;" +
        "  line-height: 1;" +
        "  cursor: pointer;" +
        "  user-select: none;" +
        "}" +

        /* track: SAME behavior, just placed in grid col 2 row 2 */
        ".br-simple-slider__track {" +
        "  grid-column: 2;" +
        "  grid-row: 2;" +
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
        // ensure last pixel is shown (round issues on Safari)
        "  padding-bottom: 2px;" +
        "}" +

        /* buttons placed into grid, row 2, col 1/3 */
        ".br-simple-slider__btn {" +
        "  border: none;" +
        "  background: transparent;" +
        "  cursor: pointer;" +
        "  font-size: 24px;" +
        "  padding: 0 4px;" +
        "}" +
        ".br-simple-slider__btn--prev {" +
        "  grid-column: 1;" +
        "  grid-row: 2;" +
        "}" +
        ".br-simple-slider__btn--next {" +
        "  grid-column: 3;" +
        "  grid-row: 2;" +
        "}" +
        ".br-simple-slider__btn[disabled] {" +
        "  opacity: 0.3;" +
        "  cursor: default;" +
        "}";

    const UiCustomElements = {
        _classes: {},

        init: function () {
            this.addClass('BrConfigurable', BrConfigurable);
            this.defineElement('br-simple-slider', BrSimpleSlider);
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
