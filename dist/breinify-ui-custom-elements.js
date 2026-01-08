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
            this._track = null;
            this._prevBtn = null;
            this._nextBtn = null;
            this._updateButtons = null;
            this._itemObserver = null;
            this._resizeHandler = null;

            // header refs
            this._headerEl = null;
            this._headerTitleWrapEl = null;
            this._headerTitleEl = null;
            this._headerSubtitleEl = null;
            this._headerCtaEl = null;
        }

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

        attributeChangedCallback(_name, _oldValue, _newValue) {
            // Only react after init; config changes already go through render()
            if (this._sliderInitialized) {
                this._applyHeader();
            }
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
        }

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

            // keep existing slider config normalization + extend with header fields
            this._config = {
                minItemWidth: (typeof rawCfg.minItemWidth === "number" && rawCfg.minItemWidth > 0) ? rawCfg.minItemWidth : base.minItemWidth,
                maxItemWidth: (typeof rawCfg.maxItemWidth === "number" && rawCfg.maxItemWidth > 0) ? rawCfg.maxItemWidth : base.maxItemWidth,
                showArrows: (typeof rawCfg.showArrows === "boolean") ? rawCfg.showArrows : base.showArrows,
                phonePeek: (typeof rawCfg.phonePeek === "boolean") ? rawCfg.phonePeek : base.phonePeek,
                breakpoints: breakpoints,

                // header config (all optional)
                title: (typeof rawCfg.title === "string") ? rawCfg.title : "",
                subtitle: (typeof rawCfg.subtitle === "string") ? rawCfg.subtitle : "",
                hideHeader: (typeof rawCfg.hideHeader === "boolean") ? rawCfg.hideHeader : false,
                titlePosition: (typeof rawCfg.titlePosition === "string") ? rawCfg.titlePosition : "left",

                ctaLabel: (typeof rawCfg.ctaLabel === "string") ? rawCfg.ctaLabel : "",
                ctaUrl: (typeof rawCfg.ctaUrl === "string") ? rawCfg.ctaUrl : "",
                ctaColor: (typeof rawCfg.ctaColor === "string") ? rawCfg.ctaColor : "",
                ctaBackground: (typeof rawCfg.ctaBackground === "string") ? rawCfg.ctaBackground : ""
            };

            if (!this._sliderInitialized) {
                this._setupStructure();
                this._setupButtons();
                this._setupDragToScroll();
                this._setupItemMutationObserver();
                this._setupResizeHandler();
                this._sliderInitialized = true;
            }

            this._applyHeader();
            this._applyLayout();
        }

        _setupStructure() {
            const existingChildren = Array.prototype.slice.call(this.children);

            // header (inserted before track/buttons layout)
            const header = document.createElement("div");
            header.className = "br-simple-slider__header";
            header.style.display = "none";

            const titleWrap = document.createElement("div");
            titleWrap.className = "br-simple-slider__header-titlewrap";

            const title = document.createElement("div");
            title.className = "br-simple-slider__header-title";
            title.style.display = "none";

            const subtitle = document.createElement("div");
            subtitle.className = "br-simple-slider__header-subtitle";
            subtitle.style.display = "none";

            titleWrap.appendChild(title);
            titleWrap.appendChild(subtitle);

            const cta = document.createElement("a");
            cta.className = "br-simple-slider__header-cta";
            cta.style.display = "none";
            cta.setAttribute("rel", "noopener noreferrer");

            header.appendChild(titleWrap);
            header.appendChild(cta);

            this.appendChild(header);

            this._headerEl = header;
            this._headerTitleWrapEl = titleWrap;
            this._headerTitleEl = title;
            this._headerSubtitleEl = subtitle;
            this._headerCtaEl = cta;

            // row wrapper (for header and track)
            const row = document.createElement("div");
            row.className = "br-simple-slider__row";
            this.appendChild(row);
            this._row = row;

            // track
            const track = document.createElement("div");
            track.className = "br-simple-slider__track";
            row.appendChild(track);
            this._track = track;

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

                // do not re-move the header we just inserted (it wasn't in existingChildren,
                // but keep this as a safety net)
                if (child === header) {
                    return;
                }

                track.appendChild(child);
                child.classList.add("br-simple-slider__item");
            });

            this._track = track;
        }

        _setupButtons() {
            const track = this._track;
            if (!track) {
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

            this._row.insertBefore(prev, track);
            this._row.appendChild(next);

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
        }

        _readNonEmptyAttr(name) {
            const raw = this.getAttribute(name);
            if (raw === null) {
                return null;
            }
            const trimmed = String(raw).trim();
            return trimmed.length > 0 ? trimmed : null;
        }

        _readAttrValue(name) {
            const raw = this.getAttribute(name);
            if (raw === null) {
                return null;
            }
            const trimmed = String(raw).trim();
            return trimmed;
        }

        _isHideHeaderActive() {
            // only active if value is true/yes/y (any case)
            const raw = this._readAttrValue("data-hide-header");
            if (raw === null) {
                return null; // "not set" -> fall back to config
            }

            const v = raw.toLowerCase();
            if (v === "true" || v === "yes" || v === "y") {
                return true;
            }

            // any other value -> do not utilize hide-header
            return null;
        }

        _resolveTitlePosition() {
            const attrPos = this._readNonEmptyAttr("data-title-position");
            const cfgPos = this._config && typeof this._config.titlePosition === "string" ? this._config.titlePosition : "left";

            const value = (attrPos !== null ? attrPos : cfgPos);
            const normalized = String(value || "").toLowerCase();

            return normalized === "center" ? "center" : "left";
        }

        _applyHeader() {
            if (!this._headerEl || !this._headerTitleEl || !this._headerSubtitleEl || !this._headerCtaEl || !this._headerTitleWrapEl) {
                return;
            }

            const cfg = this._config || {};

            // title/subtitle: attr has priority only if non-empty trimmed; else fall back to config
            const attrTitle = this._readNonEmptyAttr("data-title");
            const attrSubtitle = this._readNonEmptyAttr("data-subtitle");

            const title = (attrTitle !== null) ? attrTitle : (typeof cfg.title === "string" ? cfg.title.trim() : "");
            const subtitle = (attrSubtitle !== null) ? attrSubtitle : (typeof cfg.subtitle === "string" ? cfg.subtitle.trim() : "");

            const hasTitle = typeof title === "string" && title.trim().length > 0;
            const hasSubtitle = typeof subtitle === "string" && subtitle.trim().length > 0;

            // CTA: attr priority only if non-empty trimmed; else fall back to config
            const attrCtaLabel = this._readNonEmptyAttr("data-cta-label");
            const attrCtaUrl = this._readNonEmptyAttr("data-cta-url");
            const attrCtaColor = this._readNonEmptyAttr("data-cta-color");
            const attrCtaBackground = this._readNonEmptyAttr("data-cta-background");

            const ctaLabel = (attrCtaLabel !== null) ? attrCtaLabel : (typeof cfg.ctaLabel === "string" ? cfg.ctaLabel.trim() : "");
            const ctaUrl = (attrCtaUrl !== null) ? attrCtaUrl : (typeof cfg.ctaUrl === "string" ? cfg.ctaUrl.trim() : "");
            const ctaColor = (attrCtaColor !== null) ? attrCtaColor : (typeof cfg.ctaColor === "string" ? cfg.ctaColor.trim() : "");
            const ctaBackground = (attrCtaBackground !== null) ? attrCtaBackground : (typeof cfg.ctaBackground === "string" ? cfg.ctaBackground.trim() : "");

            const hasCta = (typeof ctaLabel === "string" && ctaLabel.trim().length > 0) &&
                (typeof ctaUrl === "string" && ctaUrl.trim().length > 0);

            // hide-header logic:
            // - data-hide-header only applies if its value is true/yes/y (any case)
            // - otherwise fall back to cfg.hideHeader boolean
            const hideAttr = this._isHideHeaderActive(); // true or null
            const hideCfg = (typeof cfg.hideHeader === "boolean") ? cfg.hideHeader : false;
            const explicitlyHidden = (hideAttr === true) || (hideAttr === null && hideCfg === true);

            // implicit hide: if both title+subtitle empty AND no CTA, hide regardless of hideHeader=false
            const implicitHide = (!hasTitle && !hasSubtitle && !hasCta);

            if (explicitlyHidden || implicitHide) {
                this._headerEl.style.display = "none";
                return;
            }

            // show header container
            this._headerEl.style.display = "";

            // apply title position
            const pos = this._resolveTitlePosition();
            this._headerEl.setAttribute("data-title-position", pos);

            // title
            if (hasTitle) {
                this._headerTitleEl.textContent = title;
                this._headerTitleEl.style.display = "";
            } else {
                this._headerTitleEl.textContent = "";
                this._headerTitleEl.style.display = "none";
            }

            // subtitle
            if (hasSubtitle) {
                this._headerSubtitleEl.textContent = subtitle;
                this._headerSubtitleEl.style.display = "";
            } else {
                this._headerSubtitleEl.textContent = "";
                this._headerSubtitleEl.style.display = "none";
            }

            // CTA
            if (hasCta) {
                this._headerCtaEl.textContent = ctaLabel;
                this._headerCtaEl.setAttribute("href", ctaUrl);
                this._headerCtaEl.setAttribute("target", "_blank");
                this._headerCtaEl.style.display = "";

                // reset styles first (avoid old inline values sticking)
                this._headerCtaEl.style.color = "";
                this._headerCtaEl.style.background = "";

                if (ctaColor) {
                    this._headerCtaEl.style.color = ctaColor;
                }
                if (ctaBackground) {
                    this._headerCtaEl.style.background = ctaBackground;
                }
            } else {
                this._headerCtaEl.textContent = "";
                this._headerCtaEl.removeAttribute("href");
                this._headerCtaEl.style.display = "none";

                this._headerCtaEl.style.color = "";
                this._headerCtaEl.style.background = "";
            }
        }
    }

    /*
     * Safari 12/13: replace static class fields with post-class assignments
     * (keep your existing assignments and just ensure STYLE_CONTENT includes the header CSS below)
     */
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

        // CTA defaults
        ctaLabel: "",
        ctaUrl: "",
        ctaColor: "",
        ctaBackground: ""
    };

    BrSimpleSlider.STYLE_CONTENT =
        "br-simple-slider.br-simple-slider {" +
        "  display: flex;" +
        "  flex-direction: column;" +
        "  align-items: stretch;" +
        "  position: relative;" +
        "}" +

        /* ROW: container HEADER, TRACK */
        ".br-simple-slider__row {" +
        "  display: flex;" +
        "  align-items: center;" +
        "  width: 100%;" +
        "}" +

        /* HEADER */
        ".br-simple-slider__header {" +
        "  display: grid;" +
        "  grid-template-columns: 1fr auto 1fr;" +
        "  align-items: center;" +
        "  width: 100%;" +
        "  margin: 0 0 10px 0;" +
        "}" +
        ".br-simple-slider__header-titlewrap {" +
        "  display: flex;" +
        "  flex-direction: column;" +
        "  min-width: 0;" +
        "}" +
        ".br-simple-slider__header[data-title-position='left'] .br-simple-slider__header-titlewrap {" +
        "  grid-column: 1;" +
        "  justify-self: start;" +
        "  text-align: left;" +
        "}" +
        ".br-simple-slider__header[data-title-position='center'] .br-simple-slider__header-titlewrap {" +
        "  grid-column: 2;" +
        "  justify-self: center;" +
        "  text-align: center;" +
        "}" +
        ".br-simple-slider__header-title {" +
        "  font-weight: 600;" +
        "  line-height: 1.2;" +
        "}" +
        ".br-simple-slider__header-subtitle {" +
        "  opacity: 0.75;" +
        "  line-height: 1.2;" +
        "  margin-top: 2px;" +
        "}" +
        ".br-simple-slider__header-cta {" +
        "  grid-column: 3;" +
        "  justify-self: end;" +
        "  display: inline-block;" +
        "  text-decoration: none;" +
        "  padding: 6px 10px;" +
        "  border-radius: 6px;" +
        "  line-height: 1;" +
        "  cursor: pointer;" +
        "  user-select: none;" +
        "}" +

        /* TRACK */
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

        /* ITEMS */
        ".br-simple-slider__item {" +
        "  flex: 0 0 auto;" +
        "  scroll-snap-align: start;" +
        "  box-sizing: border-box;" +
        "  min-width: 0;" +
        "  overflow: hidden;" +
        "}" +

        /* BUTTONS */
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
