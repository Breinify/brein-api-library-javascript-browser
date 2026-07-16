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

    const renderedElementStatusCodes = Object.freeze({
        RENDERED: 200,
        NOT_RENDERED: 13000,
        SUPPRESSED: 13001,
        NOT_ACTIVE_YET: 13002,
        NO_LONGER_ACTIVE: 13003,
        CONTAINER_UNAVAILABLE: 13100,
        INVALID_CONFIGURATION: 13200,
        RENDERING_FAILED: 500
    });

    const cssStyle = '' +
        '<style id="br-style-countdown-default">' +
        ':host { --unit-height: 60px; --color-background: #1d273b; --color-foreground: #f2f2f2; --color-separator: rgba(255, 255, 255, 0.3); }' +
        '.countdown-banner { display: block; text-decoration: none; user-select: none; background-color: var(--color-background); color: var(--color-foreground); text-align: center; padding: 10px 0; }' +
        '.countdown-banner[hidden] { display: none !important; }' +
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
        '<a-or-div hidden aria-hidden="true" class="countdown-banner">' +
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

            // normalize the supplied settings
            settings = $.isPlainObject(settings) ? settings : {};

            // current settings
            let current = this.countdownById[el.uuid];
            current = $.isPlainObject(current) ? current : {};
            const currentSettings = $.isPlainObject(current.settings) ? current.settings : {};

            /*
             * Check whether the internal state and the externally reported rendering
             * result are unchanged. Fade settings may still be updated without causing
             * another evaluation.
             */
            if (current.status === status &&
                current.value === value &&
                currentSettings.containerAvailable === settings.containerAvailable &&
                currentSettings.renderedElementStatus === settings.renderedElementStatus) {
                current.settings = settings;
                return;
            }

            // update the settings
            this.countdownById[el.uuid] = {
                el: el,
                status: status,
                value: value,
                settings: settings
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
                const entrySettings = $.isPlainObject(entry.settings) ? entry.settings : {};

                /*
                 * Failed and ignored countdowns never enter the regular rendering flow,
                 * but they still need to report their rendering result.
                 */
                if (entry.status !== 'rendering') {
                    const renderedElementStatus = Number.isInteger(entrySettings.renderedElementStatus) ?
                        entrySettings.renderedElementStatus :
                        entry.status === 'failed' ?
                            renderedElementStatusCodes.RENDERING_FAILED :
                            renderedElementStatusCodes.NOT_RENDERED;

                    const containerAvailable = typeof entrySettings.containerAvailable === 'boolean' ? entrySettings.containerAvailable : null;
                    entry.el._sendRenderedElementActivity(containerAvailable, false, renderedElementStatus);
                    continue;
                }

                const $el = entry.el.$shadowRoot.find('.countdown-banner');
                const isHidden = entry.el._isCountdownHidden($el);
                const shouldShow = $.inArray(id, uuidsToShow) > -1;

                if (shouldShow) {
                    const sendRenderedActivity = () => {
                        entry.el._sendRenderedElementActivity(true, true, renderedElementStatusCodes.RENDERED);
                    };

                    /*
                     * The countdown is already visible. No animation is needed, but the
                     * activity helper will send the result if it has not been reported yet.
                     */
                    if (isHidden === false) {
                        sendRenderedActivity();
                        continue;
                    }

                    if (entrySettings.fadeIn === true) {
                        fadeIns.push(() => {
                            entry.el._setCountdownHidden($el, false);

                            return $el
                                .stop(true, true)
                                .css('opacity', 0)
                                .animate({
                                    opacity: 1
                                })
                                .promise()
                                .then(() => {
                                    $el.css('opacity', '');
                                    sendRenderedActivity();
                                });
                        });
                    } else {
                        $el.stop(true, true).css('opacity', '');
                        entry.el._setCountdownHidden($el, false);
                        sendRenderedActivity();
                    }
                } else {
                    /*
                     * A countdown that requested visibility but was not selected was
                     * suppressed by the resolution strategy. A countdown that already
                     * requested a hidden state retains its specific status.
                     */
                    const renderedElementStatus = entry.value === 'visible' ?
                        renderedElementStatusCodes.SUPPRESSED :
                        Number.isInteger(entrySettings.renderedElementStatus) ?
                            entrySettings.renderedElementStatus :
                            renderedElementStatusCodes.NOT_RENDERED;

                    const containerAvailable = typeof entrySettings.containerAvailable === 'boolean' ?
                        entrySettings.containerAvailable :
                        true;

                    const sendNotRenderedActivity = () => {
                        entry.el._sendRenderedElementActivity(containerAvailable, false, renderedElementStatus);
                    };

                    /*
                     * Even when the countdown is already hidden, its non-rendering result
                     * still needs to be reported.
                     */
                    if (isHidden === true) {
                        sendNotRenderedActivity();
                        continue;
                    }

                    if (entrySettings.fadeOut === true) {
                        fadeOuts.push(() => $el
                            .stop(true, true)
                            .animate({
                                opacity: 0
                            })
                            .promise()
                            .then(() => {
                                entry.el._setCountdownHidden($el, true);
                                $el.css('opacity', '');
                                sendNotRenderedActivity();
                            }));
                    } else {
                        $el.stop(true, true).css('opacity', '');
                        entry.el._setCountdownHidden($el, true);
                        sendNotRenderedActivity();
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

    class UiCountdown extends HTMLElement {
        $shadowRoot = null
        settings = null
        uuid = null
        interval = null
        isRendered = false
        lastRenderedElementActivity = null

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
                this._updateStatus('failed', 'configuration', {
                    containerAvailable: null,
                    renderedElementStatus: renderedElementStatusCodes.RENDERING_FAILED
                });

                callback(new Error('settings must be a valid object'), null);
                return;
            }

            const checkedType = Breinify.UTL.isNonEmptyString(settings.type);
            if (checkedType === null) {
                this._updateStatus('failed', 'configuration', {
                    containerAvailable: null,
                    renderedElementStatus: renderedElementStatusCodes.INVALID_CONFIGURATION
                });

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
                        _self._updateStatus('failed', 'configuration', {
                            containerAvailable: null,
                            renderedElementStatus: renderedElementStatusCodes.RENDERING_FAILED
                        });
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
                            _self._updateStatus('failed', 'split-test', {
                                containerAvailable: null,
                                renderedElementStatus: renderedElementStatusCodes.RENDERING_FAILED
                            });
                            return;
                        }

                        const group = Breinify.UTL.isNonEmptyString(data.group);
                        if (group === null) {
                            _self._updateStatus('ignored', 'no-group', {
                                containerAvailable: null,
                                renderedElementStatus: renderedElementStatusCodes.NOT_RENDERED
                            });
                            return;
                        }

                        const splitTestData = $.isPlainObject(data.splitTestData) ? data.splitTestData : {};
                        if (Breinify.UTL.isNonEmptyString(splitTestData.groupDecision) === null) {
                            splitTestData.groupDecision = group;
                        }

                        _self.settings.splitTestData = splitTestData;
                        if (splitTestData.isControlGroup === true) {
                            _self._updateStatus('ignored', 'control-group', {
                                containerAvailable: null,
                                renderedElementStatus: renderedElementStatusCodes.NOT_RENDERED
                            });
                        } else {
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

        _isCountdownHidden($countdownBanner) {
            const countdownBanner = $countdownBanner.get(0);
            return countdownBanner === undefined || countdownBanner.hidden === true;
        }

        _setCountdownHidden($countdownBanner, hidden) {
            const countdownBanner = $countdownBanner.get(0);
            if (countdownBanner === undefined) {
                return;
            }

            if (hidden === true) {
                countdownBanner.hidden = true;
                countdownBanner.setAttribute('aria-hidden', 'true');

                /*
                 * The configured CSS may contain something such as:
                 *
                 *     display: flex !important;
                 *
                 * The countdown owns the hidden state, so use an inline important
                 * value while hidden. It is removed again when the countdown shows.
                 */
                countdownBanner.style.setProperty('display', 'none', 'important');
            } else {
                countdownBanner.hidden = false;
                countdownBanner.setAttribute('aria-hidden', 'false');
                countdownBanner.style.removeProperty('display');
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
                this._stopRefreshLoop();
                this._hideCountdown(false, renderedElementStatusCodes.CONTAINER_UNAVAILABLE, false);
                return;
            }

            /*
             * The configuration is static for the lifetime of the element on the page.
             * Thus, style/html/content are created once and then retained even if the
             * element is later detached and re-attached somewhere else.
             */
            if (this.isRendered !== true) {
                this._applyStyle();
                this._applyHtml();
                this._applyContent();
                this._validateCountdownVisibility();
                this.isRendered = true;
            }

            // apply type specific settings to the countdown
            if (this.settings.type === 'CAMPAIGN_BASED' || this.settings.type === 'ONE_TIME') {
                const needsUpdates = this._updateCountdown(true);
                if (needsUpdates === false) {
                    this._stopRefreshLoop();
                } else {
                    this._ensureRefreshLoop();
                }
            } else {
                this._hideCountdown(false, renderedElementStatusCodes.INVALID_CONFIGURATION, true);
                this._stopRefreshLoop();
            }
        }

        _ensureRefreshLoop() {
            const _self = this;

            if (this.interval != null) {
                return;
            }

            this.interval = new AccurateInterval(() => {

                /*
                 * Stop the loop if we are no longer attached. Re-attachment will
                 * happen through a later render/onChange call if needed.
                 */
                if (_self.isConnected !== true) {
                    _self._stopRefreshLoop();
                    return;
                }

                if (_self._updateCountdown(false) === false) {
                    _self._stopRefreshLoop();
                }
            }).start();
        }

        _stopRefreshLoop() {
            if (this.interval != null) {
                this.interval.stop();
                this.interval = null;
            }
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
                fadeIn: fadeIn === true,
                containerAvailable: true,
                renderedElementStatus: renderedElementStatusCodes.RENDERED
            });
        }

        _hideCountdown(fadeOut, renderedElementStatus, containerAvailable) {
            this._updateStatus('rendering', 'hidden', {
                fadeOut: fadeOut === true,
                containerAvailable: typeof containerAvailable === 'boolean' ? containerAvailable : this.isConnected === true,
                renderedElementStatus: Number.isInteger(renderedElementStatus) ? renderedElementStatus : renderedElementStatusCodes.NOT_RENDERED
            });
        }

        _validateCountdownVisibility() {
            const countdownBanner = this.$shadowRoot.find('.countdown-banner').get(0);
            if (countdownBanner === undefined || countdownBanner.hidden !== true) {
                return;
            }

            if (window.getComputedStyle(countdownBanner).display !== 'none') {
                console.warn(
                    'The configured countdown CSS overrides the component hidden state.',
                    countdownBanner
                );
            }
        }

        _updateCountdown(firstCheck) {
            const now = this.now();
            const startTime = this.getStartTime();
            const endTime = this.getEndTime();

            /*
             * Invalid countdown configuration cannot become valid later,
             * so hide the countdown and stop the refresh loop.
             */
            if (startTime === null ||
                endTime === null ||
                endTime <= startTime) {
                this._hideCountdown(false, renderedElementStatusCodes.INVALID_CONFIGURATION, true);
                return false;
            }

            /*
             * The countdown has not started yet. Keep the refresh loop
             * active so it can become visible when startTime is reached.
             */
            if (startTime > now) {
                this._hideCountdown(false, renderedElementStatusCodes.NOT_ACTIVE_YET, true);
                return true;
            }

            /*
             * Check expiration before rendering the values. This prevents
             * a final visible 00 00 00 00 state.
             */
            if (endTime <= now) {
                this._hideCountdown(firstCheck !== true, renderedElementStatusCodes.NO_LONGER_ACTIVE, true);
                return false;
            }

            const diff = endTime - now;

            const seconds = Math.floor(diff) % 60;
            const minutes = Math.floor(diff / 60) % 60;
            const hours = Math.floor(diff / (60 * 60)) % 24;
            const days = Math.floor(diff / (60 * 60 * 24));

            this.$shadowRoot.find('.time-days').text(this._pad(days));
            this.$shadowRoot.find('.time-hours').text(this._pad(hours));
            this.$shadowRoot.find('.time-minutes').text(this._pad(minutes));
            this.$shadowRoot.find('.time-seconds').text(this._pad(seconds));

            this._showCountdown(firstCheck !== true);
            return true;
        }

        _applyStyle() {

            // add the default style
            if (this.$shadowRoot.find('#br-style-countdown-default').length === 0) {
                this.$shadowRoot.prepend(cssStyle);
            }

            const selectors = $.isPlainObject(this.settings.style) && $.isArray(this.settings.style.selectors) ? this.settings.style.selectors : [];
            const additionalStyle = Breinify.UTL.isNonEmptyString(selectors
                .filter(entry => $.isPlainObject(entry))
                .map(entry => Object.entries(entry)
                    .map(([key, value]) => `${key} { ${value} }`)
                    .join(''))
                .join(''));

            if (additionalStyle !== null) {
                this.$shadowRoot.find('#br-style-countdown-default')
                    .after('<style id="br-style-countdown-configured">' + additionalStyle + '</style>');
            }

            const snippetSelector = additionalStyle === null ? '#br-style-countdown-default' : '#br-style-countdown-configured';

            // check for snippets
            Breinify.plugins.webExperiences.style(this.settings, this.$shadowRoot, snippetSelector);
        }

        _applyHtml() {
            const url = Breinify.UTL.isNonEmptyString(this.settings.experience.url);
            const containerType = url === null ? 'div' : 'a';

            const finalHtmlTemplate = htmlTemplate.replaceAll('a-or-div', containerType);
            this.$shadowRoot.append(finalHtmlTemplate);

            const $countdownBanner = this.$shadowRoot.find('.countdown-banner');

            if (url !== null) {
                $countdownBanner.attr('href', url);

                const usedHref = Breinify.UTL.isNonEmptyString($countdownBanner.attr('href'));
                const usedUrl = usedHref === null ? null : new URL(usedHref, window.location.href);
                const isDifferentDomain = usedHref !== null && usedUrl.hostname !== window.location.hostname;

                const isInIframe = window.self !== window.top;

                if (isDifferentDomain || isInIframe) {
                    $countdownBanner.attr('target', '_blank');
                }

                $countdownBanner.on('click.brUiCountdown', event => this._sendActivity('clickedElement', event));
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
                    this._updateStatus('ignored', 'missing-msid', {
                        containerAvailable: null,
                        renderedElementStatus: renderedElementStatusCodes.NOT_RENDERED
                    });
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
                    _self._updateStatus('ignored', 'invalid-msid', {
                        containerAvailable: null,
                        renderedElementStatus: renderedElementStatusCodes.NOT_RENDERED
                    });
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
            return 'br-wed-' + this.settings.webExVersionId;
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
            } else {
                return Breinify.plugins.webExperiences.attach(this.settings, $(this), {
                    cardinality: 'single'
                });
            }
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
            } else {
                this.settings.experience.campaignData = $.extend(true, {}, this.settings.experience.campaignData, campaignData);
            }

            // check the web-experience's identifier to match this one (if any is selected/defined)
            const expectedWebExpId = Breinify.UTL.isNonEmptyString(webExperienceData.webExperienceId);
            if (expectedWebExpId !== null && this.settings.webExId !== expectedWebExpId) {
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

        _sendActivity(type, event, additional) {
            const tags = {};
            const settings = $.isPlainObject(this.settings) ? this.settings : {};
            const experience = $.isPlainObject(settings.experience) ? settings.experience : {};

            // set the default information for the widget and action
            tags.widgetType = 'countdown';
            tags.widget = Breinify.UTL.isNonEmptyString(settings.campaignName);

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
                additional = $.isPlainObject(additional) ? additional : {};

                tags.actionType = 'rendered';
                tags.action = additional.rendered === true ?
                    'show countdown' :
                    'do not show countdown';

                tags.elementType = elementName;

                tags.containerAvailable = typeof additional.containerAvailable === 'boolean' ? additional.containerAvailable : null;
                tags.rendered = additional.rendered === true;
                tags.status = Number.isInteger(additional.status) ? additional.status : null;

                scheduleActivity = false;
            }

            // set some campaign information
            tags.campaignWebExId = Breinify.UTL.isNonEmptyString(settings.webExVersionId);

            // some experience specific information (could also be retrieved via the webExVersionId)
            tags.message = Breinify.UTL.isNonEmptyString(experience.message);

            if ($.isPlainObject(experience.campaignData)) {
                tags.refCampaignType = experience.campaignData.campaignType;
                tags.refCampaignId = experience.campaignData.campaignId;
                tags.refCampaignExId = experience.campaignData.campaignExecutionId;
            }

            // add the split-test info if any split-test
            if ($.isPlainObject(settings.splitTestData)) {
                tags.groupType = settings.splitTestData.isControlGroup === true ? 'control' : 'test';
                tags.group = Breinify.UTL.isNonEmptyString(settings.splitTestData.groupDecision);

                const test = Breinify.UTL.isNonEmptyString(settings.splitTestData.testName);
                const instance = Breinify.UTL.isNonEmptyString(settings.splitTestData.selectedInstance);
                tags.splitTest = test === null ? null : test + (instance === null ? '' : ' (' + instance + ')');
            }

            if (scheduleActivity === true) {
                Breinify.plugins.activities.scheduleDelayedActivity({}, type, tags, 60000);
            } else {
                Breinify.plugins.activities.generic(type, {}, tags);
            }
        }

        _sendRenderedElementActivity(containerAvailable, rendered, status) {
            containerAvailable = typeof containerAvailable === 'boolean' ?
                containerAvailable :
                null;

            rendered = rendered === true;
            status = Number.isInteger(status) ? status : null;

            /*
             * The status manager may evaluate the same result repeatedly, especially
             * while a countdown refresh loop is active. Only report an activity when
             * the externally visible rendering result changes.
             */
            const signature = [
                containerAvailable,
                rendered,
                status
            ].join('|');

            if (this.lastRenderedElementActivity === signature) {
                return;
            }

            this.lastRenderedElementActivity = signature;

            this._sendActivity('renderedElement', null, {
                containerAvailable: containerAvailable,
                rendered: rendered,
                status: status
            });
        }
    }

    const countdownsById = {};

    // bind the module
    Breinify.plugins._add('uiCountdown', {

        render: function (module, config) {

            if (!window.customElements.get(elementName)) {
                window.customElements.define(elementName, UiCountdown);
            }

            const countdownId = 'br-ui-countdown-' + module.webExVersionId;

            /*
             * First check the in-memory registry. This catches the race where the
             * countdown was already created, but has not yet been configured or attached.
             */
            let entry = countdownsById[countdownId];
            if ($.isPlainObject(entry) && entry.countdown instanceof UiCountdown) {
                if (entry.configured === true) {
                    entry.countdown.render();
                } else {
                    entry.renderRequested = true;
                }

                return;
            }

            /*
             * Then check the DOM. This catches countdowns that already exist on the page.
             */
            const $existingCountdown = $('br-ui-countdown#' + countdownId);
            if ($existingCountdown.length > 0) {
                const countdown = $existingCountdown.get(0);

                countdownsById[countdownId] = {
                    countdown: countdown,
                    configured: true,
                    renderRequested: false
                };

                countdown.render();
                return;
            }

            /*
             * Create a new countdown and immediately put it into the registry before
             * config(...) is called. Do not render yet, because configuration is not done.
             */
            const $countdown = $('<br-ui-countdown id="' + countdownId + '"></br-ui-countdown>');
            const countdown = $countdown.get(0);

            entry = {
                countdown: countdown,
                configured: false,
                renderRequested: true
            };

            countdownsById[countdownId] = entry;

            countdown.config($.extend(true, {
                type: module.type,
                campaignName: Breinify.UTL.isNonEmptyString(module.campaignName),
                webExVersionId: module.webExVersionId,
                webExId: module.webExId
            }, config), function (error) {
                if (error === null) {
                    entry.configured = true;

                    if (entry.renderRequested === true) {
                        entry.renderRequested = false;
                        countdown.render();
                    }
                } else {
                    delete countdownsById[countdownId];
                }
            });
        }
    });
})();