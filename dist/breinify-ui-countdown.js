"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('uiCountdown')) {
        return;
    }

    // get dependencies
    const $ = Breinify.UTL._jquery();
    const cssStyle = '' +
        '<style id="br-countdown-default">' +
        ':host { --unit-height: 60px; --color-background: #1d273b; --color-foreground: #f2f2f2 }' +
        '.countdown-banner { background-color: var(--color-background); color: var(--color-foreground); text-align: center; padding: 10px 0; }' +
        '.countdown-title { font-size: calc(var(--unit-height) * 0.25); letter-spacing: 1px; margin-bottom: 5px; text-transform: uppercase }' +
        '.countdown-timer { display: flex; justify-content: center; align-items: stretch; gap: 12px; height: var(--unit-height); }' +
        '.time-block { position: relative; flex: 0 0 auto; aspect-ratio: 1.5 / 1; display: flex; flex-direction: column; justify-content: center; align-items: center; background: transparent; }' +
        '.time-value { font-size: calc(var(--unit-height) * 0.6); font-weight: bold; line-height: 1; }' +
        '.time-label { font-size: calc(var(--unit-height) * 0.18); margin-top: 3px; text-transform: uppercase; }' +
        '.separator { width: 1px; background-color: rgba(255, 255, 255, 0.3); height: 70%; align-self: center; }' +
        '.countdown-timer.loading .time-value, .countdown-timer.loading .time-label { opacity: 0; }' +
        '.skeleton { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(180deg, #ffffff22 25%, #ffffff10 50%, #ffffff22 75%); background-size: 100% 200%; animation: shimmer 4s linear infinite; z-index: 1; border-radius: 4px; }\n' +
        '.countdown-timer.loading .skeleton { display: block; }' +
        /* Shimmer for the loading animation */
        '@keyframes shimmer { ' +
        '  0% { background-position: 0 200%; }' +
        '  100% { background-position: 0 -200%; }' +
        '}' +
        /* Optional responsiveness */
        '@media (max-width: 500px) { ' +
        '  :root { --unit-height: 40px; } ' +
        '}' +
        '</style>';
    const htmlTemplate = '' +
        '<div class="countdown-banner">' +
        '  <div class="countdown-title"></div>' +
        '  <div class="countdown-timer loading">' +
        '    <div class="time-block">' +
        '      <div class="skeleton"></div><div class="time-value time-days">00</div><div class="time-label">Days</div>' +
        '    </div>' +
        '    <div class="separator"></div>' +
        '    <div class="time-block">' +
        '      <div class="skeleton"></div><div class="time-value time-hours">00</div><div class="time-label">Hours</div>' +
        '    </div>' +
        '    <div class="separator"></div>' +
        '    <div class="time-block">' +
        '      <div class="skeleton"></div><div class="time-value time-minutes">00</div><div class="time-label">Minutes</div>' +
        '    </div>' +
        '    <div class="separator"></div>' +
        '    <div class="time-block">' +
        '      <div class="skeleton"></div><div class="time-value time-seconds">00</div><div class="time-label">Seconds</div>' +
        '    </div>' +
        '  </div>' +
        '  <div class="countdown-disclaimer"></div>' +
        '</div>';

    /**
     * When using this plugin it adds a wrapper method as plugin, which adds the possibility to
     * register the custom HTML element. This method can be called multiple times without issues
     * (so whenever the plugin is retrieved).
     */
    class UiCountdown extends HTMLElement {
        $shadowRoot = null
        settings = null

        constructor() {
            super();

            // initialize default settings and attach a shadow DOM for style encapsulation
            this.attachShadow({mode: 'open'});

            this.$shadowRoot = $(this.shadowRoot);
            this.settings = {};
        }

        /**
         * This is the entry point, called when element is added to the DOM, this should trigger
         * the actual rendering process.
         */
        connectedCallback() {
            // currently we do nothing and wait for the render method to be called explicitly
            console.log('connectedCallback');
        }

        /**
         * This specifies or override the default settings.
         *
         * @param type the type of the countdown to apply and validate the configuration for
         * @param settings the settings to be applied/overridden
         * @param callback a function called when the configuration is successfully loaded or failed
         */
        config(type, settings, callback) {
            let error = null;

            const checkedType = Breinify.UTL.isNonEmptyString(type);
            if (checkedType === null) {
                error = 'the specified type "' + type + "' is invalid";
            } else if (!$.isPlainObject(settings)) {
                error = 'settings must be a valid object';
            }

            if (error === null) {
                this.settings = $.extend(true, {
                    type: checkedType,
                    experience: {
                        endTime: Math.floor(new Date().getTime() / 1000) + (5 * 60)
                    }
                }, settings);
            } else {
                error = new Error(error);
            }

            if ($.isFunction(callback)) {
                callback(error, this.settings);
            }
        }

        render() {
            const _self = this;

            this.$shadowRoot.prepend(cssStyle);
            this.$shadowRoot.append(htmlTemplate);

            const title = Breinify.UTL.isNonEmptyString(this.settings.experience.message);
            const $title = this.$shadowRoot.find('.countdown-title');
            if (title === null) {
                $title.hide();
            } else {
                $title.text(title).show();
            }

            const disclaimer = Breinify.UTL.isNonEmptyString(this.settings.experience.disclaimer);
            const $disclaimer = this.$shadowRoot.find('.countdown-disclaimer');
            if (disclaimer == null) {
                $disclaimer.hide();
            } else {
                $disclaimer.text(disclaimer).show();
            }

            setTimeout(() => {
                _self.startCounter();
            }, 2000);
        }

        startCounter() {
            const _self = this;

            this.updateCountdown();
            this.hideLoading();

            // start the interval to keep the countdown updating
            this.interval = setInterval(() => {
                if (!_self.updateCountdown()) {
                    clearInterval(_self.interval);
                }
            }, 1000);
        }

        showLoading() {
            this.$shadowRoot.find('.countdown-timer').addClass('loading');
        }

        hideLoading() {
            this.$shadowRoot.find('.countdown-timer').removeClass('loading');
        }

        pad(num) {
            return String(num).padStart(2, '0');
        }

        updateCountdown() {
            const now = Math.floor(Date.now() / 1000);
            let diff = Math.max(0, this.settings.experience.endTime - now);

            const seconds = Math.floor(diff) % 60;
            const minutes = Math.floor(diff / 60) % 60;
            const hours = Math.floor(diff / (60 * 60)) % 24;
            const days = Math.floor(diff / (60 * 60 * 24));

            this.$shadowRoot.find('.time-days').text(this.pad(days));
            this.$shadowRoot.find('.time-hours').text(this.pad(hours));
            this.$shadowRoot.find('.time-minutes').text(this.pad(minutes));
            this.$shadowRoot.find('.time-seconds').text(this.pad(seconds));

            return seconds > 0 || minutes > 0 || hours > 0 || days > 0;
        }
    }

    // bind the module
    Breinify.plugins._add('uiCountdown', {
        register: function () {
            if (!window.customElements.get('br-ui-countdown')) {
                window.customElements.define('br-ui-countdown', UiCountdown);
            }
        }
    });
})();