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
        '<style id="br-style-countdown-default">' +
        ':host { --unit-height: 60px; --color-background: #1d273b; --color-foreground: #f2f2f2; --color-separator: rgba(255, 255, 255, 0.3); }' +
        '.countdown-banner { display: none; text-decoration: none; user-select: none; background-color: var(--color-background); color: var(--color-foreground); text-align: center; padding: 10px 0; }' +
        '.countdown-title { font-size: calc(var(--unit-height) * 0.25); letter-spacing: 1px; margin-bottom: 5px; text-transform: uppercase }' +
        '.countdown-timer { display: flex; justify-content: center; align-items: stretch; gap: 12px; height: var(--unit-height); }' +
        '.countdown-disclaimer { padding: calc(var(--unit-height) * 0.1) 0; font-size: calc(var(--unit-height) * 0.18); }' +
        '.time-block { position: relative; flex: 0 0 auto; aspect-ratio: 1.5 / 1; display: flex; flex-direction: column; justify-content: center; align-items: center; background: transparent; }' +
        '.time-value { font-size: calc(var(--unit-height) * 0.6); font-weight: bold; line-height: 1; }' +
        '.time-label { font-size: calc(var(--unit-height) * 0.18); margin-top: 3px; text-transform: uppercase; }' +
        '.separator { width: 1px; background-color: var(--color-separator); height: 70%; align-self: center; }' +
        /* Responsiveness: For 500px there is not enough space for any more than 40px */
        '@media (max-width: 500px) { :host { --unit-height: 40px !important; } }' +
        '</style>';
    const htmlTemplate = '' +
        '<a-or-div style="display:none" class="countdown-banner">' +
        '  <div class="countdown-title"></div>' +
        '  <div class="countdown-timer">' +
        '    <div class="time-block">' +
        '      <div class="time-value time-days">00</div><div class="time-label">Days</div>' +
        '    </div>' +
        '    <div class="separator"></div>' +
        '    <div class="time-block">' +
        '      <div class="time-value time-hours">00</div><div class="time-label">Hours</div>' +
        '    </div>' +
        '    <div class="separator"></div>' +
        '    <div class="time-block">' +
        '      <div class="time-value time-minutes">00</div><div class="time-label">Minutes</div>' +
        '    </div>' +
        '    <div class="separator"></div>' +
        '    <div class="time-block">' +
        '      <div class="time-value time-seconds">00</div><div class="time-label">Seconds</div>' +
        '    </div>' +
        '  </div>' +
        '  <div class="countdown-disclaimer"></div>' +
        '</a-or-div>';

    const allCountdownStatus = {
        countdownById: {},

        update: function (el, status, value, settings) {
            if (Breinify.UTL.isNonEmptyString(el.uuid) === null) {
                return;
            }

            // current settings
            let current = this.countdownById[el.uuid];
            current = $.isPlainObject(current) ? current : {};

            // check if there is an actual change
            if (current.status === status && current.value === value) {
                return;
            }

            // update the settings
            this.countdownById[el.uuid] = {
                el: el,
                status: status,
                value: value,
                settings: $.isPlainObject(settings) ? settings : {}
            };

            // determine if all are finished, and determine resolution strategy
            const overallInfo = {
                noShow: [],
                renderVisible: [],
                renderHidden: []
            };
            for (const cd of Object.values(this.countdownById)) {

                // the status 'failed', 'ignored', and 'rendering' is considered final
                if (cd.status === 'initializing') {
                    return;
                } else if (cd.status !== 'rendering') {
                    overallInfo.noShow.push(cd.el.uuid);
                } else if (cd.value === 'visible') {
                    overallInfo.renderVisible.push(cd.el.uuid);
                } else if (cd.value === 'hidden') {
                    overallInfo.renderHidden.push(cd.el.uuid);
                } else {
                    overallInfo.noShow.push(cd.el.uuid);
                }
            }

            // if we made it so far, all countdowns are in final state, so run resolution strategy
            const evaluationContext = {
                show: [],
                weighted: {}
            };
            for (const entry of Object.values(this.countdownById)) {
                entry.el.evaluateResolutionStrategy(overallInfo, evaluationContext, entry.settings);
            }

            // if we have more than one to show, we just show (weighted are ignored)
            if (evaluationContext.show.length > 0) {
                for (const entry of Object.values(this.countdownById)) {
                    if ($.inArray(entry.uuid, evaluationContext.show) > -1) {
                        entry.el.$shadowRoot.find('.countdown-banner').show();
                    }
                }
            } else if (evaluationContext.weighted.length > 0) {

                // step 1: convert object to array of entries
                const weights = Object.entries(evaluationContext.weighted);

                // step 2: find the highest weight
                const maxWeight = Math.max(...weights.map(([_, weight]) => weight));

                // step 3: filter entries with max weight
                const maxWeightedEntries = evaluationContext.weighted.filter(entry => entry.weight === maxWeight);

                // step 4: sort by id and take the first one
                maxWeightedEntries.sort(([uuid1], [uuid2]) => uuid1.localeCompare(uuid2));
            }
        }
    };

    class AccurateInterval {

        constructor(callback) {
            this.callback = $.isFunction(callback) ? callback : () => null;
            this.timerId = null;
            this.stopped = true;
        }

        start() {
            if (this.stopped === false) {
                return this;
            } else {
                this.stopped = false;
            }

            const tick = () => {
                if (this.stopped === true) {
                    return;
                }

                // execute with the exact delay to the next second
                this.timerId = window.setTimeout(() => {
                    if (this.stopped === true) {
                        return;
                    }

                    // fire the callback exactly on full second and run the next tick
                    this.callback();
                    tick();
                }, 1000 - (Date.now() % 1000));
            };

            tick();
            return this;
        }

        stop() {
            this.stopped = true;

            if (this.timerId !== null) {
                window.clearTimeout(this.timerId);
                this.timerId = null;
            }
        }
    }

    /**
     * When using this plugin it adds a wrapper method as plugin, which adds the possibility to
     * register the custom HTML element. This method can be called multiple times without issues
     * (so whenever the plugin is retrieved).
     */
    class UiCountdown extends HTMLElement {
        $shadowRoot = null
        settings = null
        uuid = null

        constructor() {
            super();

            this.uuid = Breinify.UTL.uuid();

            // initialize default settings and attach a shadow DOM for style encapsulation
            this.attachShadow({mode: 'open'});

            this.$shadowRoot = $(this.shadowRoot);
            this.settings = {};

            this._updateStatus('initializing', 'constructed');
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
            const callbackWrapper = function (error) {

                /*
                 * Apply a timeout here, so that all other configuration calls will be
                 * handled first, i.e., if there are three countdowns on the highest level
                 * all three will register themselves (via status) first.
                 */
                window.queueMicrotask(() => {
                    if (error === null) {
                        callback(null, _self.settings);
                    } else {
                        _self._updateStatus('failed', 'configuration');
                        callback(error, null);
                    }
                });
            };

            this._updateStatus('initializing', 'configuration');
            if (checkedType === 'CAMPAIGN_BASED') {
                this._applyCampaignBasedSettings(settings, callbackWrapper);
            } else if (checkedType === 'ONE_TIME') {
                this._applyOneTimeSettings(settings, callbackWrapper);
            } else {
                this._applyUnknownSettings(settings, callbackWrapper);
            }
        }

        _updateStatus(status, value, settings) {
            allCountdownStatus.update(this, status, value, settings);
        }

        /**
         * Currently we support three strategies:
         * <ul>
         *     <li><code>DO_NOT_SHOW</code></li>
         *     <li><code>ALWAYS_SHOW</code></li>
         *     <li><code>FIRST_COME_FIRST_SERVE</code></li>
         * </ul>
         *
         * Some strategies need to know the "decisions" of all the currently available counter.
         * Thus, the function is executed on any decision change in regard to visibility.
         */
        evaluateResolutionStrategy(overallInfo, evaluationContext, statusSettings) {

            // first check the general overall status of this
            if ($.inArray(this.uuid, overallInfo.renderVisible) !== -1) {
                return;
            }

            // next we need to check if there are even multiple elements to show, otherwise just show
            const nrOfVisibleCountdowns = overallInfo.renderVisible.length;
            if (nrOfVisibleCountdowns <= 1) {
                evaluationContext.show.push(this.uuid);
                return;
            }

            console.log('settings', this.settings);
            console.log('status-overall-info', overallInfo);
            console.log('status-settings', statusSettings);
            console.log('context', evaluationContext);

            let strategy = $.isPlainObject(this.settings) && $.isPlainObject(this.settings.experience) ? Breinify.UTL.isNonEmptyString(this.settings.experience.resolutionStrategyMultiple) : null;
            if (strategy === 'DO_NOT_SHOW') {
                evaluationContext.weighted[this.uuid] = 0
            } else if (strategy === 'FIRST_COME_FIRST_SERVE') {
                evaluationContext.weighted[this.uuid] = .5;
            } else { // if (strategy === 'ALWAYS_SHOW') {
                evaluationContext.show.push(this.uuid);
            }
        }

        render() {

            // if this is not connected we utilize the position information and attach it
            if (this._ensureConnected() === false) {
                return;
            }

            // add any additional styles
            this._applyStyle();

            // modify the template based on the settings and add the content
            this._applyHtml();
            this._applyContent();

            // apply type specific settings to the countdown
            if (this.settings.type === 'CAMPAIGN_BASED') {
                this.startCounter();
            } else if (this.settings.type === 'ONE_TIME') {
                this.startCounter();
            } else {
                this._hideCountdown();
            }
        }

        startCounter() {
            const _self = this;

            /*
             * If the update returns false, it means nothing needs to be updated anymore,
             * so let's just return (the countdown it is not visible at this point).
             */
            if (this._updateCountdown(true) === false) {
                return;
            }

            // start the interval to keep the countdown updating
            this.interval = new AccurateInterval(() => {
                if (!_self._updateCountdown(false)) {
                    _self.interval.stop();
                    _self.$shadowRoot.find('.countdown-banner').fadeOut();
                }
            }).start();
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

        _showCountdown(fadeIn) {
            this._updateStatus('rendering', 'visible', {
                fadeIn: fadeIn === true
            });
        }

        _hideCountdown() {
            this._updateStatus('rendering', 'hidden');
        }

        _updateCountdown(firstCheck) {
            const $countdownBanner = this.$shadowRoot.find('.countdown-banner');

            const now = this.now();
            const startTime = this.getStartTime();
            if (startTime === null || startTime > now) {
                this._hideCountdown();
                return true;
            }

            let diff = Math.max(0, this.settings.experience.endTime - now);

            const seconds = Math.floor(diff) % 60;
            const minutes = Math.floor(diff / 60) % 60;
            const hours = Math.floor(diff / (60 * 60)) % 24;
            const days = Math.floor(diff / (60 * 60 * 24));

            this.$shadowRoot.find('.time-days').text(this._pad(days));
            this.$shadowRoot.find('.time-hours').text(this._pad(hours));
            this.$shadowRoot.find('.time-minutes').text(this._pad(minutes));
            this.$shadowRoot.find('.time-seconds').text(this._pad(seconds));

            if (seconds <= 0 && minutes <= 0 && hours <= 0 && days <= 0) {
                return false;
            } else if ($countdownBanner.is(':visible')) {
                // nothing to do, it's already there
            } else if (firstCheck === true) {
                this._showCountdown(false);
            } else {
                this._showCountdown(true);
            }

            return true;
        }

        _applyStyle() {

            // add the default style and ensure there is nothing configured right now
            if (this.$shadowRoot.find('#br-style-countdown-default').length === 0) {
                this.$shadowRoot.prepend(cssStyle);
            }
            this.$shadowRoot.find('#br-style-countdown-configured').remove();

            const selectors = $.isPlainObject(this.settings.style) && $.isArray(this.settings.style.selectors) ? this.settings.style.selectors : [];
            const additionalStyle = Breinify.UTL.isNonEmptyString(selectors
                .filter(entry => $.isPlainObject(entry))
                .map(entry => Object.entries(entry)
                    .map(([key, value]) => `${key} { ${value} }`)
                    .join('')
                )
                .join(''));

            if (additionalStyle !== null) {
                this.$shadowRoot.find('#br-style-countdown-default')
                    .after('<style id="br-style-countdown-configured">' + additionalStyle + '</style>');
            }
        }

        _applyHtml() {
            this.$shadowRoot.find('.countdown-banner').remove();

            const url = Breinify.UTL.isNonEmptyString(this.settings.experience.url);
            const containerType = url === null ? 'div' : 'a';
            const finalHtmlTemplate = htmlTemplate.replaceAll('a-or-div', containerType)
            this.$shadowRoot.append(finalHtmlTemplate);

            if (url !== null) {
                this.$shadowRoot.find('.countdown-banner').attr('href', url);
            }
        }

        _applyContent() {
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
        }

        _applyCampaignBasedSettings(settings, callback) {
            const _self = this;

            /*
             * For a campaign based counter, we need msid in the params to fire the request,
             * otherwise we just consider that the hit is not from a campaign and can stop.
             */
            const brMsId = Breinify.UTL.loc.param('br-msid');
            if (brMsId === null) {
                this._updateStatus('ignored', 'missing-msid');
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
                if (error !== null) {
                    callback(error, false);
                } else if (_self._checkCampaignBasedResponse(response)) {
                    callback(null, _self.settings);
                } else {
                    _self._updateStatus('ignored', 'invalid-msid');
                }
            }, 30000);
        }

        _applyOneTimeSettings(settings, callback) {
            this.settings = $.extend(true, {
                experience: {},
                type: 'ONE_TIME'
            }, settings);

            callback(null, this.settings);
        }

        _applyUnknownSettings(settings, callback) {
            this.settings = $.extend(true, {
                experience: {},
                type: 'UNKNOWN'
            }, settings);

            callback(null, this.settings);
        }

        _pad(num) {
            return String(num).padStart(2, '0');
        }

        _ensureConnected() {
            if (this.isConnected === true) {
                return true;
            }

            const position = $.isPlainObject(this.settings.position) ? this.settings.position : null;
            if (position == null) {
                return false;
            }

            // determine the operation to utilize, it is needed
            const operation = Breinify.UTL.isNonEmptyString(position.operation);
            if (operation === null) {
                return false;
            }

            // determine the anchor, it is needed but evaluated within the utility method
            let $anchor;
            const selector = Breinify.UTL.isNonEmptyString(position.selector);
            const snippet = Breinify.UTL.isNonEmptyString(position.snippet);
            if (snippet === null && selector === null) {
                $anchor = null;
            } else if (selector !== null) {
                $anchor = $(selector);
            } else if (snippet !== null) {
                $anchor = null
            }

            // now attach the element and if successful move on (otherwise return)
            return Breinify.UTL.dom.attachByOperation(operation, $anchor, $(this));
        }

        _checkCampaignBasedResponse(response) {
            if (!$.isPlainObject(response)) {
                return false;
            }

            // check that we have valid data in the response
            let campaignData = response['com.brein.common.microservice.data.CampaignData'];
            campaignData = $.isArray(campaignData) && campaignData.length > 0 ? campaignData[0] : null;
            let promotionsData = response['com.brein.common.microservice.data.PromotionsData'];
            promotionsData = $.isArray(promotionsData) && promotionsData.length > 0 ? promotionsData[0] : null;
            if (!$.isPlainObject(campaignData) || !$.isPlainObject(promotionsData)) {
                return false;
            }

            // check if the campaign-type is valid
            const campaignType = Breinify.UTL.isNonEmptyString(campaignData.campaignType);
            const validCampaignTypes = $.isArray(this.settings.experience.campaignTypes) ? this.settings.experience.campaignTypes : null;
            if (validCampaignTypes !== null && $.inArray(campaignType, validCampaignTypes) === -1) {
                return false;
            }

            this.settings.experience = $.extend(true, {}, this.settings.experience, promotionsData);
            return true;
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