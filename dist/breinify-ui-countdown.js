"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('uiCountdown')) {
        return;
    }

    // get dependencies and some constants for the element (like template)
    const $ = Breinify.UTL._jquery();
    const cssStyle = '' +
        '<style id="br-countdown-default">' +
        ':host { --unit-height: 60px; --color-background: #1d273b; --color-foreground: #f2f2f2; --color-separator: rgba(255, 255, 255, 0.3); }' +
        '.countdown-banner { background-color: var(--color-background); color: var(--color-foreground); text-align: center; padding: 10px 0; }' +
        '.countdown-title { font-size: calc(var(--unit-height) * 0.25); letter-spacing: 1px; margin-bottom: 5px; text-transform: uppercase }' +
        '.countdown-timer { display: flex; justify-content: center; align-items: stretch; gap: 12px; height: var(--unit-height); }' +
        '.time-block { position: relative; flex: 0 0 auto; aspect-ratio: 1.5 / 1; display: flex; flex-direction: column; justify-content: center; align-items: center; background: transparent; }' +
        '.time-value { font-size: calc(var(--unit-height) * 0.6); font-weight: bold; line-height: 1; }' +
        '.time-label { font-size: calc(var(--unit-height) * 0.18); margin-top: 3px; text-transform: uppercase; }' +
        '.separator { width: 1px; background-color: var(--color-separator); height: 70%; align-self: center; }' +
        '.countdown-timer.loading .time-value, .countdown-timer.loading .time-label { opacity: 0; }' +
        '.skeleton { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(180deg, #ffffff22 25%, #ffffff10 50%, #ffffff22 75%); background-size: 100% 200%; animation: shimmer 4s linear infinite; z-index: 1; border-radius: 4px; }\n' +
        '.countdown-timer.loading .skeleton { display: block; }' +
        /* Shimmer for the loading animation */
        '@keyframes shimmer { 0% { background-position: 0 200%; } 100% { background-position: 0 -200%; } }' +
        /* Optional responsiveness */
        '@media (max-width: 500px) { :host { --unit-height: 40px; } }' +
        '</style>';
    const htmlTemplate = '' +
        '<div style="display:none" class="countdown-banner">' +
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
         * This specifies or override the default settings.
         *
         * @param type the type of the countdown to apply and validate the configuration for
         * @param settings the settings to be applied/overridden
         * @param callback a function called when the configuration is successfully loaded or failed
         */
        config(type, settings, callback) {
            const _self = this;

            callback = $.isFunction(callback) ? callback : () => null;

            const checkedType = Breinify.UTL.isNonEmptyString(type);
            if (checkedType === null) {
                callback(new Error('the specified type "' + type + '" is invalid'), null);
                return;
            } else if (!$.isPlainObject(settings)) {
                callback(new Error('settings must be a valid object'), null);
                return;
            }

            // wrap the callback to do some general check on the final results
            const callbackWrapper = function(error) {
                if (error === null) {
                    callback(null, _self.settings);
                } else {
                    callback(error, null);
                }
            };

            if (checkedType === 'CAMPAIGN_BASED') {
                this.applyCampaignBasedSettings(settings, callbackWrapper);
            } else if (checkedType === 'ONE_TIME') {
                this.applyOneTimeSettings(settings, callbackWrapper);
            } else {
                this.applyUnknownSettings(settings, callbackWrapper);
            }
        }

        applyCampaignBasedSettings(settings, callback) {
            const _self = this;

            /*
             * For a campaign based counter, we need msid in the params to fire the request,
             * otherwise we just consider that the hit is not from a campaign and can stop.
             */
            const brMsId = Breinify.UTL.loc.param('br-msid');
            if (brMsId === null) {
                return;
            }

            this.settings = $.extend(true, {
                experience: {},
                type: 'CAMPAIGN_BASED'
            }, settings);

            // check if we have a token (otherwise we do nothing and just return)
            const accessToken = Breinify.UTL.isNonEmptyString(this.settings.experience.accessToken);
            if (accessToken === null) {
                callback(new Error('the needed accessToken is missing'), null);
                return;
            }

            // utilize the token to resolve the information attached
            Breinify.UTL.internal.token(accessToken, {
                msid: brMsId
            }, function (error, response) {
                if (error == null) {
                    console.log('token-response: ', response);
                    callback(null, _self.settings);
                } else {
                    callback(error, false);
                }
            }, 30000);
        }

        applyOneTimeSettings(settings, callback) {
            this.settings = $.extend(true, {
                experience: {},
                type: 'ONE_TIME'
            }, settings);

            callback(null, this.settings);
        }

        applyUnknownSettings(settings, callback) {
            this.settings = $.extend(true, {
                experience: {},
                type: 'UNKNOWN'
            }, settings);

            callback(null, this.settings);
        }

        render() {
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

            // check the type of the countdown to decide next steps
            if (this.settings.type === 'CAMPAIGN_BASED') {
                this.handleCampaignBased();
            } else if (this.settings.type === 'ONE_TIME') {
                this.handleOneTime();
            } else {
                this.handleUnknown();
            }
        }

        handleCampaignBased() {
            const _self = this;

            setTimeout(() => {
                _self.startCounter();
            }, 2000);
        }

        handleOneTime() {
            this.startCounter();
        }

        handleUnknown() {
            this.$shadowRoot.find('.countdown-banner').hide();
        }

        startCounter() {
            const _self = this;

            /*
             * If the update returns false, it means nothing needs to be updated anymore,
             * so let's just return (the countdown is not visible at this point).
             *
             * If the update was successful
             */
            if (this.updateCountdown()) {
                this.hideLoading();
            } else {
                return;
            }

            // start the interval to keep the countdown updating
            this.interval = setInterval(() => {
                if (!_self.updateCountdown()) {
                    clearInterval(_self.interval);
                    _self.$shadowRoot.find('.countdown-banner').fadeOut();
                }
            }, 1000);
        }

        showLoading() {
            this.$shadowRoot.find('.countdown-timer').addClass('loading');
        }

        hideLoading() {
            this.$shadowRoot.find('.countdown-timer').removeClass('loading');
        }

        updateCountdown() {
            const $countdownBanner = this.$shadowRoot.find('.countdown-banner');

            const now = this.now();
            const startTime = this.getStartTime();
            if (startTime === null || startTime > now) {
                $countdownBanner.hide();
                return true;
            }

            let diff = Math.max(0, this.settings.experience.endTime - now);

            const seconds = Math.floor(diff) % 60;
            const minutes = Math.floor(diff / 60) % 60;
            const hours = Math.floor(diff / (60 * 60)) % 24;
            const days = Math.floor(diff / (60 * 60 * 24));

            this.$shadowRoot.find('.time-days').text(this.pad(days));
            this.$shadowRoot.find('.time-hours').text(this.pad(hours));
            this.$shadowRoot.find('.time-minutes').text(this.pad(minutes));
            this.$shadowRoot.find('.time-seconds').text(this.pad(seconds));

            if (seconds > 0 || minutes > 0 || hours > 0 || days > 0) {
                if (!$countdownBanner.is(':visible')) {
                    $countdownBanner.fadeIn();
                }
                return true;
            } else {
                return false;
            }
        }

        pad(num) {
            return String(num).padStart(2, '0');
        }

        getStartTime() {
            return Breinify.UTL.toInteger(this.settings.experience.startTime);
        }

        getEndTime() {
            return Breinify.UTL.toInteger(this.settings.experience.endTime);
        }

        now() {
            return Math.floor(Date.now() / 1000);
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