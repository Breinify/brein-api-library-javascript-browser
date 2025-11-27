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
    const elementName = 'br-ui-countdown';
    const $ = Breinify.UTL._jquery();
    const cssStyle = '' +
        '<style id="br-style-countdown-default">' +
        ':host { --unit-height: 60px; --color-background: #1d273b; --color-foreground: #f2f2f2; --color-separator: rgba(255, 255, 255, 0.3); }' +
        '.countdown-banner { display: none; text-decoration: none; user-select: none; background-color: var(--color-background); color: var(--color-foreground); text-align: center; padding: 10px 0; }' +
        '.countdown-title { font-size: calc(var(--unit-height) * 0.25); letter-spacing: 1px; margin-bottom: 5px; text-transform: uppercase }' +
        '.countdown-timer { display: flex; justify-content: center; align-items: stretch; gap: 12px; height: var(--unit-height); }' +
        '.countdown-disclaimer { padding: calc(var(--unit-height) * 0.1) 0 0 0; font-size: calc(var(--unit-height) * 0.18); }' +
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

                // we still need to update the settings (the fading logic may change)
                current.settings = settings;
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
                noShow: [],
                weighted: {}
            };
            for (const entry of Object.values(this.countdownById)) {
                entry.el.evaluateResolutionStrategy(overallInfo, evaluationContext, entry.settings);
            }

            // if we have more than one to show, we just show (weighted are ignored)
            const uuidsToShow = this._evaluateContext(evaluationContext);

            /*
             * Iterate over each element we have and apply the result,
             * any fading will be collected to be synchronized (first
             * fadeOut, then fadeIn).
             */
            const fadeIns = [];
            const fadeOuts = [];
            for (const [id, entry] of Object.entries(this.countdownById)) {
                if (entry.status !== 'rendering') {
                    // do nothing, we don't want to show or work with this element
                    continue;
                }

                const $el = entry.el.$shadowRoot.find('.countdown-banner');
                if ($.inArray(id, uuidsToShow) > -1) {
                    if (entry.settings.fadeIn === true) {
                        fadeIns.push(() => $el
                            .stop(true, true)
                            .css('display', 'block')
                            .fadeIn()
                            .promise().then(() => {
                                entry.el._sendActivity('renderedElement');
                            }));
                    } else {
                        $el.stop(true, true).css('display', 'block').show();
                        entry.el._sendActivity('renderedElement');
                    }
                } else {
                    if (entry.settings.fadeOut === true) {
                        fadeOuts.push(() => $el.stop(true, true).fadeOut().promise());
                    } else {
                        $el.stop(true, true).hide();
                    }
                }
            }

            // synchronize the fadeIn and fadeOut, wait for fadeOuts then run fadeIns
            $.when(...fadeOuts.map(fn => fn())).then(() => $.when(...fadeIns.map(fn => fn())));
        },

        _evaluateContext: function (context) {
            if (context.show.length > 0) {
                return context.show;
            } else if (Object.values(context.weighted).length > 0) {
                return this._evaluateWeightedContext(context.weighted);
            } else {
                return [];
            }
        },

        _evaluateWeightedContext: function (weighted) {

            // step 1: convert object to array of entries
            const weights = Object.entries(weighted);

            // step 2: find the highest weight
            const minWeight = Math.min(...weights.map(([_, weight]) => weight));

            // step 3: filter entries with min weight
            const minWeightedEntries = weights.filter(([_, weight]) => weight === minWeight);

            // step 4: sort by id and find the one to render
            minWeightedEntries.sort(([uuid1], [uuid2]) => uuid1.localeCompare(uuid2));

            // select the one uuid we will show form the weighted once
            const [minUuid] = minWeightedEntries[0];

            // we are done, return the result as an array
            return [minUuid];
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
         * @param settings the settings to be applied/overridden
         * @param callback a function called when the configuration is successfully loaded or failed
         */
        config(settings, callback) {
            const _self = this;

            callback = $.isFunction(callback) ? callback : () => null;

            if (!$.isPlainObject(settings)) {
                callback(new Error('settings must be a valid object'), null);
                return;
            }

            const checkedType = Breinify.UTL.isNonEmptyString(settings.type);
            if (checkedType === null) {
                callback(new Error('the specified type "' + settings.type + '" is invalid'), null);
                return;
            }

            // wrap the callback to do some general check on the final results
            const callbackWrapper = function (error) {

                /*
                 * Run this function always in `window.queueMicrotask`, so that all other
                 * configuration calls will be handled first, i.e., if there are three
                 * countdowns on the highest level all three will register themselves
                 * (via status) first.
                 */
                const finalizeCallback = () => {
                    if (error === null) {
                        callback(null, _self.settings);
                    } else {
                        _self._updateStatus('failed', 'configuration');
                        callback(error, null);
                    }
                };

                /*
                 * Check if we have a split-test and run it if there, otherwise proceed
                 * as usual.
                 */
                const splitTest = _self.settings.splitTest;
                const splitTestToken = $.isPlainObject(splitTest) ? Breinify.UTL.isNonEmptyString(splitTest.token) : null;
                const splitTestName = $.isPlainObject(splitTest) ? Breinify.UTL.isNonEmptyString(splitTest.splitTestName) : null;

                if (splitTestToken !== null && splitTestName !== null) {
                    const user = Breinify.UTL.user;
                    const splitTestStorage = 'br-ctd-' + splitTestName;

                    Breinify.plugins.splitTests.retrieveSplitTest(splitTestName, splitTestToken, {
                        sessionId: user.getSessionId(),
                        browserId: user.getBrowserId(),
                        splitTestName: splitTestName
                    }, splitTestStorage, function (error, data) {
                        if (error !== null || !$.isPlainObject(data)) {
                            _self._updateStatus('failed', 'split-test');
                            return;
                        }

                        const group = Breinify.UTL.isNonEmptyString(data.group);
                        if (group === null) {
                            _self._updateStatus('ignored', 'no-group');
                            return;
                        }

                        const splitTestData = $.isPlainObject(data.splitTestData) ? data.splitTestData : {};
                        if (splitTestData.isControlGroup === true) {
                            _self._updateStatus('ignored', 'control-group');
                        } else {
                            _self.settings.splitTestData = splitTestData;
                            window.queueMicrotask(finalizeCallback);
                        }
                    });
                } else {
                    window.queueMicrotask(finalizeCallback);
                }
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
         *     <li><code>FIRST_EXPIRING_ONLY</code></li>
         * </ul>
         *
         * Some strategies need to know the "decisions" of all the currently available counter.
         * Thus, the function is executed on any decision change in regard to visibility.
         *
         * @param overallInfo the overall information determined by the wrapping framework,
         * containing the uuids of rendered (visible) countdowns
         * @param evaluationContext the evaluation context, which allows to assign an <code>uuid</code> to the
         * <code>show</code> array, the <code>>weighted</code> object (<code>uuid</code> assigned a
         * <code>weight</code>), or <code>noShow</code> array
         */
        evaluateResolutionStrategy(overallInfo, evaluationContext) {

            // first check the general overall status of this
            if ($.inArray(this.uuid, overallInfo.renderVisible) === -1) {
                return;
            }

            // next we need to check if there are even multiple elements to show, otherwise just show
            const nrOfVisibleCountdowns = overallInfo.renderVisible.length;
            if (nrOfVisibleCountdowns <= 1) {
                evaluationContext.show.push(this.uuid);
                return;
            }

            let strategy = $.isPlainObject(this.settings) && $.isPlainObject(this.settings.experience) ? Breinify.UTL.isNonEmptyString(this.settings.experience.resolutionStrategyMultiple) : null;
            if (strategy === 'DO_NOT_SHOW') {
                /*
                 * This settings means to not show, if there are multiple countdowns. If all counters
                 * have this value set, none is shown in that case (as configured). If one has any other
                 * rule defined, it will show.
                 */
                evaluationContext.noShow.push(this.uuid);
            } else if (strategy === 'FIRST_EXPIRING_ONLY') {
                /*
                 * We have a weight assigned (everyone will have the weight 0 having this rule),
                 * the evaluation of the weight happens afterward.
                 */
                let endTime = this.getEndTime();
                endTime = endTime <= this.now() ? null : endTime;
                if (endTime === null) {
                    evaluationContext.noShow.push(this.uuid);
                } else {
                    evaluationContext.weighted[this.uuid] = endTime;
                }
            } else { // if (strategy === 'ALWAYS_SHOW') {
                /*
                 * The strategy says to always show this one, so that is applied - the countdown
                 * will always be shown.
                 */
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
             * so let's just return (the countdown it is not visible at this point, we still
             * call hide to trigger an update if needed, i.e., from configured -> rendered).
             */
            if (this._updateCountdown(true) === false) {
                _self._hideCountdown(false);
                return;
            }

            // start the interval to keep the countdown updating
            this.interval = new AccurateInterval(() => {
                if (!_self._updateCountdown(false)) {
                    _self.interval.stop();
                    _self._hideCountdown(true);
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

        _hideCountdown(fadeOut) {
            this._updateStatus('rendering', 'hidden', {
                fadeOut: fadeOut === true
            });
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
            let additionalStyle = Breinify.UTL.isNonEmptyString(selectors
                .filter(entry => $.isPlainObject(entry))
                .map(entry => Object.entries(entry)
                    .map(([key, value]) => `${key} { ${value} }`)
                    .join('')
                )
                .join(''));

            let snippetSelector = '#br-style-countdown-default';
            if (additionalStyle !== null) {
                this.$shadowRoot.find('#br-style-countdown-default')
                    .after('<style id="br-style-countdown-configured">' + additionalStyle + '</style>');
                snippetSelector = '#br-style-countdown-configured';
            }

            // check for snippets
            Breinify.plugins.webExperiences.style(this.settings, this.$shadowRoot, snippetSelector);
        }

        _applyHtml() {
            this.$shadowRoot.find('.countdown-banner').remove();

            const url = Breinify.UTL.isNonEmptyString(this.settings.experience.url);
            const containerType = url === null ? 'div' : 'a';
            const finalHtmlTemplate = htmlTemplate.replaceAll('a-or-div', containerType)
            this.$shadowRoot.append(finalHtmlTemplate);

            if (url !== null) {
                const $countdownBanner = this.$shadowRoot.find('.countdown-banner');
                $countdownBanner.attr('href', url);

                const usedHref = Breinify.UTL.isNonEmptyString($countdownBanner.attr('href'));
                const usedUrl = usedHref === null ? null : new URL(usedHref, window.location.href);
                const isDifferentDomain = usedHref !== null && usedUrl.hostname !== window.location.hostname;

                const isInIframe = window.self !== window.top;

                if (isDifferentDomain || isInIframe) {
                    $countdownBanner.attr('target', '_blank');
                }

                $countdownBanner.click(event => this._sendActivity('clickedElement', event));
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

            // make sure we have an experience information
            this.settings = $.extend(true, {
                experience: {}
            }, settings);

            /*
             * For a campaign based counter, we need msid in the params to fire the request,
             * otherwise we just consider that the hit is not from a campaign and can stop.
             */
            const brMsId = Breinify.UTL.loc.param('br-msid');
            if (brMsId === null) {
                if (this._retrieveCampaignBasedSettings(callback) === false) {
                    this._updateStatus('ignored', 'missing-msid');
                }

                return;
            }

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
                } else if (_self._retrieveCampaignBasedSettings(callback) === true) {
                    // done the callback is called within the retrieval if true is returned
                } else {
                    _self._updateStatus('ignored', 'invalid-msid');
                }
            }, 30000);
        }

        _retrieveCampaignBasedSettings(callback) {
            const storageKey = this._getStorageKey();
            try {
                let data = null;

                // we check the different possible storage
                const sessionSettings = Breinify.UTL.isNonEmptyString(window.sessionStorage.getItem(storageKey));
                if (sessionSettings !== null) {
                    data = JSON.parse(sessionSettings);
                }

                const localSettings = Breinify.UTL.isNonEmptyString(window.localStorage.getItem(storageKey));
                if (localSettings !== null) {
                    data = JSON.parse(localSettings);
                    data = $.isPlainObject(data) ? data : {};

                    if (data.time + data.ttl < Date.now()) {

                        // the information is expired, remove it
                        window.localStorage.removeItem(storageKey);
                        data = null;
                    } else if (data.renew === true) {

                        // the information is valid and should be "renewed"
                        window.localStorage.setItem(storageKey, JSON.stringify({
                            time: Date.now(),
                            ttl: data.ttl,
                            renew: true,
                            response: data.response
                        }));

                        data = data.response;
                    } else {

                        // we have valid information, which will expire after the ttl
                        data = data.response;
                    }
                }

                // utilize the check to ensure the data is valid and should be used
                if (this._checkCampaignBasedResponse(data)) {
                    callback(null, this.settings);
                    return true;
                } else {
                    return false;
                }
            } catch (error) {
                return false;
            }
        }

        _storeCampaignBasedSettings(response) {
            const storageKey = this._getStorageKey();

            let type = Breinify.UTL.isNonEmptyString(this.settings.experience.displayWindowDuration);
            if (type === 'ONE_TIME_VISIBILITY') {
                window.sessionStorage.removeItem(storageKey);
                window.localStorage.removeItem(storageKey);
            } else if (type === 'TIME_LIMITED_VISIBILITY') {
                const durationInSec = Breinify.UTL.toInteger(this.settings.experience.displayWindowValue);
                window.localStorage.setItem(storageKey, JSON.stringify({
                    time: Date.now(),
                    ttl: durationInSec * 1000,
                    renew: false,
                    response: response
                }));
                window.sessionStorage.removeItem(storageKey);
            } else if (type === 'PER_TAB_SESSION_VISIBILITY') {
                // store in sessionStorage
                window.sessionStorage.setItem(storageKey, JSON.stringify(response));
                window.localStorage.removeItem(storageKey);
            }
            // default: ACTIVE_BROWSING_SESSION_VISIBILITY
            else {

                // store in localStorage, update on each retrieval and remove if older than 30min
                window.localStorage.setItem(storageKey, JSON.stringify({
                    time: Date.now(),
                    ttl: 30 * 60 * 1000,
                    renew: false,
                    response: response
                }));
                window.sessionStorage.removeItem(storageKey);
            }
        }

        _getStorageKey() {
            return 'br-wed-' + this.settings.webExId;
        }

        _applyOneTimeSettings(settings, callback) {
            this.settings = $.extend(true, {
                experience: {}
            }, settings);

            callback(null, this.settings);
        }

        _applyUnknownSettings(settings, callback) {
            this.settings = $.extend(true, {
                experience: {}
            }, settings, {
                type: 'UNKNOWN'
            });

            callback(null, this.settings);
        }

        _pad(num) {
            return String(num).padStart(2, '0');
        }

        _ensureConnected() {
            if (this.isConnected === true) {
                return true;
            }

            return Breinify.plugins.webExperiences.attach(this.settings, $(this));
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
            let webExperienceData = response['com.brein.common.microservice.data.WebExperienceData'];
            webExperienceData = $.isArray(webExperienceData) && webExperienceData.length > 0 ? webExperienceData[0] : {};
            if (!$.isPlainObject(campaignData) || !$.isPlainObject(promotionsData)) {
                return false;
            }

            // check if the campaign-type is valid
            const campaignType = Breinify.UTL.isNonEmptyString(campaignData.campaignType);
            const validCampaignTypes = $.isArray(this.settings.experience.campaignTypes) ? this.settings.experience.campaignTypes : null;
            if (validCampaignTypes !== null && $.inArray(campaignType, validCampaignTypes) === -1) {
                return false;
            }

            // check the web-experience's identifier to match this one (if any is selected/defined)
            const expectedWebExperienceId = Breinify.UTL.isNonEmptyString(webExperienceData.webExperienceId);
            if (expectedWebExperienceId !== null && this.settings.webExId !== expectedWebExperienceId) {
                return false;
            }

            // combine the experience information, everything can be overridden/extended there
            this.settings.experience = $.extend(true, {}, this.settings.experience, promotionsData, webExperienceData.experience);

            // let's check any defined widgetIds
            // if ($.isArray(this.settings.experience.widgetIds) && $.inArray(this.settings.experience.widgetIds)) {
            // }

            // style is a little bit more complex to extend, so we do that now
            const settingsHaveSelectors = $.isPlainObject(this.settings.style) && $.isArray(this.settings.style.selectors);
            const wedHaveSelectors = $.isPlainObject(webExperienceData.style) && $.isArray(webExperienceData.style.selectors);

            if (settingsHaveSelectors && wedHaveSelectors) {
                this.settings.style.selectors = this.settings.style.selectors.concat(webExperienceData.style.selectors);
            } else if (wedHaveSelectors) {

                // make sure we have the style object and remove any selectors
                if ($.isPlainObject(this.settings.style)) {
                    delete this.settings.style.selectors;
                } else {
                    this.settings.style = {};
                }

                this.settings.style = $.extend(true, {}, this.settings.style, webExperienceData.style);
            } else if (settingsHaveSelectors) {
                // do nothing
            } else {
                this.settings.style = null;
            }

            // apply any DisplayDuration if any is set
            this._storeCampaignBasedSettings(response);

            return true;
        }

        _sendActivity(type, event) {
            const tags = {};

            // set the default information for the widget and action
            tags.widgetType = 'countdown';
            tags.widget = Breinify.UTL.isNonEmptyString(this.settings.campaignName);

            let scheduleActivity;
            if (type === 'clickedElement') {
                tags.actionType = 'link';
                tags.action = 'open url';

                // add some infos about the actual used link (href)
                const $anchor = this.$shadowRoot.find('a');
                tags.elementType = elementName + ' (a)';
                tags.description = Breinify.UTL.isNonEmptyString($anchor.attr('href'));

                const target = Breinify.UTL.isNonEmptyString($anchor.attr('target'));
                const opensInNewTab = target === '_blank' || target === 'new';

                scheduleActivity = !opensInNewTab && !(event.metaKey || event.ctrlKey || event.which === 2);
            } else if (type === 'renderedElement') {
                tags.actionType = 'rendered';
                tags.action = 'show countdown';

                tags.elementType = elementName;

                scheduleActivity = false;
            }

            // set some campaign information
            tags.campaignWebExId = Breinify.UTL.isNonEmptyString(this.settings.webExVersionId);

            // some experience specific information (could also be retrieved via the webExId)
            tags.message = Breinify.UTL.isNonEmptyString(this.settings.experience.message);

            // add the split-test info if any split-test
            if ($.isPlainObject(this.settings.splitTestData)) {
                tags.groupType = this.settings.splitTestData.isControl === true ? 'control' : 'test';
                tags.group = Breinify.UTL.isNonEmptyString(this.settings.splitTestData.groupDecision);

                const test = Breinify.UTL.isNonEmptyString(this.settings.splitTestData.testName);
                const instance = Breinify.UTL.isNonEmptyString(this.settings.splitTestData.selectedInstance);
                tags.splitTest = test === null ? null : test + (instance === null ? '' : ' (' + instance + ')');
            }

            if (scheduleActivity === true) {
                Breinify.plugins.activities.scheduleDelayedActivity({}, type, tags, 60000);
            } else {
                Breinify.plugins.activities.generic(type, {}, tags);
            }
        }
    }

    // bind the module
    Breinify.plugins._add('uiCountdown', {
        register: function () {
            if (!window.customElements.get(elementName)) {
                window.customElements.define(elementName, UiCountdown);
            }
        }
    });
})();