// noinspection JSUnusedGlobalSymbols

"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('activities')) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    const overload = Breinify.plugins._overload();

    const prefixValidation = Breinify.UTL.constants.errors.prefix.validation;
    const prefixApi = Breinify.UTL.constants.errors.prefix.api;

    // identifier used within the activities to identify same "script" origin
    const originId = Breinify.UTL.uuid();

    const gaDefaultMapper = function (handler, activity) {
        switch (handler.type) {
            case 'ga':
                return {
                    hitType: 'event',
                    eventCategory: 'breinify',
                    eventAction: activity.type,
                    eventLabel: activity.tags.id,
                    eventValue: 1
                };
            case 'gtag':
            default:
                throw new Error('Using currently unavailable type: ' + handler.type);
        }
    };

    const gaHandler = {
        initialized: false,
        type: null,
        instance: null,
        mapper: null,

        init: function (gaSettings, callback) {
            const _self = this;

            if (this.initialized === true) {
                callback(true);
                return;
            }

            // search for the ga instance
            let gaType = this._determineType(gaSettings.type);
            switch (gaType) {
                case 'ga':
                    this._waitForInstance('ga', function (ignoreGa) {

                        // don't use the parameter, since ga can change
                        ga(function () {
                            _self.type = gaType;
                            _self.instance = _self._determineGaInstance(ga.getAll(), gaSettings.trackerId);
                            _self.mapper = $.isFunction(gaSettings.mapper) ? gaSettings.mapper : gaDefaultMapper;
                            _self.initialized = true;

                            callback(_self.initialized);
                        });
                    });
                    break;
                case 'gtag':
                    _self.type = gaType;

                    _self.initialized = true;
                    callback(_self.initialized);
                    break;
                default:
                    throw new Error('Using currently unavailable type: ' + gaType);
            }
        },

        handle: function (gaSettings, activity) {
            const _self = this;

            this.init(gaSettings, function (status) {
                if (status === false) {
                    return;
                }

                let mappedActivity = _self.mapper(_self, activity);
                if (mappedActivity === null) {
                    return;
                }

                switch (_self.type) {
                    case 'ga':
                        _self.instance.send(mappedActivity);
                        break;
                    default:
                        throw new Error('Using currently unavailable type: ' + gaType);
                }
            });
        },

        _waitForInstance: function (name, callback, waitTime) {

            let instance = window[name];
            let available = typeof instance !== 'undefined' && instance !== null;

            if (available) {
                callback(instance);
            } else if (waitTime >= 5000) {
                console.error(name + ' enabled but not available (waited ' + waitTime + ' [ms]).');
            } else {
                const _self = this;
                setTimeout(function () {
                    _self._waitForInstance(name, callback, (typeof waitTime === 'number' ? waitTime : 0) + 50)
                }, 50);
            }
        },

        _determineGaInstance: function (all, trackerId) {

            let normalizedTrackerId = typeof trackerId === 'string' ? trackerId : null;

            if (!$.isArray(all) || all.length < 0) {
                throw new Error('Unable to determine instance.');
            } else if (all.length === 1 && normalizedTrackerId === null) {
                return all[0];
            } else {

                // find the instance with the identifier
                for (var i = 0; i < all.length; i++) {
                    if (all[i].get('trackingId') === normalizedTrackerId) {
                        return all[i];
                    }
                }

                // if we didn't find it we are done
                if (normalizedTrackerId === null) {
                    throw new Error('Please specify trackingId of trackers to be used, found: ' + all.length);
                } else {
                    throw new Error('Unable to determine instance with trackingId: ' + normalizedTrackerId);
                }
            }
        },

        _determineType: function (type) {
            let normalizedType = typeof type === 'string' ? type.toLowerCase() : null;
            if (normalizedType === 'ga' ||
                normalizedType === 'gtag') {
                return normalizedType;
            }

            if (typeof window.ga === 'function') {
                return 'ga';
            } else if (typeof window.gtag === 'function') {
                return 'gtag';
            } else {
                throw new Error('Unable to determine type, please specify.');
            }
        },

        _applyDefaultMapping: function (activity) {
            return gaDefaultMapper(this, activity);
        }
    };

    const delayedActivitiesStorage = {
        cookieStorage: {
            store: function (id, activityData) {
                let cookieName = Breinify.UTL.cookies.delayedActivities;

                // store the activity in a cookie that will be evaluated each run
                let activitiesData = {};
                if (Breinify.UTL.cookie.check(cookieName)) {
                    activitiesData = Breinify.UTL.cookie.getJson(cookieName);
                }

                // add the new activityData to the list
                let activityDataId = typeof id === 'string' ? id : Breinify.UTL.uuid();
                activitiesData[activityDataId] = activityData;

                // reset the cookie (just session is fine)
                let domain = Breinify.UTL.cookie.domain();
                Breinify.UTL.cookie.setJson(cookieName, activitiesData, null, true, domain);

                return activityDataId;
            },

            getAll: function () {
                let cookieName = Breinify.UTL.cookies.delayedActivities;
                return Breinify.UTL.cookie.getJson(cookieName);
            },

            get: function (id) {
                let activitiesData = this.getAll();

                if (!$.isPlainObject(activitiesData)) {
                    return null;
                } else if ($.isPlainObject(activitiesData[id])) {
                    return activitiesData[id];
                } else {
                    return null;
                }
            },

            remove: function (id) {
                let domain = Breinify.UTL.cookie.domain();
                let cookieName = Breinify.UTL.cookies.delayedActivities;

                let activitiesData = Breinify.UTL.cookie.getJson(cookieName);
                delete activitiesData[id];

                Breinify.UTL.cookie.setJson(cookieName, activitiesData, null, true, domain);
            }
        },
        localStorage: {
            prefix: 'br-scheduled-activity-',

            store: function (id, activityData) {
                window.localStorage.setItem(this.prefix + id, JSON.stringify(activityData))
            },

            getAll: function () {
                let activitiesData = null;

                for (var i = 0, len = window.localStorage.length; i < len; ++i) {
                    let key = window.localStorage.key(i);
                    if (!key.indexOf(this.prefix) === 0) {
                        continue;
                    }

                    let id = key.substring(this.prefix.length);
                    let entry = this.get(id);
                    if (entry === null) {
                        continue;
                    } else if (activitiesData === null) {
                        activitiesData = {};
                    }

                    activitiesData[id] = entry;
                }

                return activitiesData;
            },

            get: function (id) {
                let json = window.localStorage.getItem(this.prefix + id);
                return typeof json === 'string' ? JSON.parse(json) : null;
            },

            remove: function (id) {
                window.localStorage.removeItem(this.prefix + id);
            }
        }
    };

    let usedDelayedActivitiesStorage;
    try {
        window.localStorage.setItem('br-local-storage-test', 'true');
        window.localStorage.removeItem('br-local-storage-test');

        usedDelayedActivitiesStorage = delayedActivitiesStorage.localStorage;
    } catch (e) {
        usedDelayedActivitiesStorage = delayedActivitiesStorage.cookieStorage;
    }

    const defaultAdditionalMutationObserverSettings = {
        settings: {
            onElementSelection: function ($el) {
                return $el;
            }
        }
    };

    const defaultObserverOption = {
        settings: {
            bindDataByTag: false,
            evaluateOnSetup: false,
            onActivation: function (settings, eventData, user, tags) {
            }
        },
        data: {
            tags: {
                pageId: window.location.pathname
            }
        }
    };

    const defaultSubmitObserverOption = {
        observer: 'submit',
        settings: {
            activityType: 'submittedForm',
            scheduleActivities: null,
            onBeforeActivitySent: function (settings, eventData, user, tags) {
            },
            onActivitySent: function (settings, eventData, user, tags) {
            },
            onAfterActivitySent: function (settings, eventData, user, tags) {
            }
        }
    };

    const defaultClickObserverOption = {
        observer: 'click',
        settings: {
            /**
             * The default click event is bound to the <code>clickedElement</code>, which should have
             * the following information:
             * <pre>
             * {
             *   pageId: '/',           // the page-path from window.location.pathname (automatically added)
             *   widget: 'my-widget',   // an identifier which explains which widget was clicked
             * }
             * </pre>
             * Optional the following (known) information can be included:
             * <pre>
             * {
             *   action: 'open',        // a name of the action caused by the click
             *   element: 'img',        // a name to identify the widgets element more specific (ex. the tag type)
             *   widgetType: 'open',    // a generalization for the widget, ex. popup
             * }
             * </pre>
             * If the click includes some split-testing we also add:
             * <pre>
             * {
             *   splitTest: 'myTest',   // the name of the applied splitTest
             *   group: 'ctGroup',      // the name of the selected group
             *   groupType: 'control'   // control or test
             * }
             * </pre>
             * If the click includes some recommender related info we may also add:
             * <pre>
             * {
             *   namedRecommendations: [ 'myRec' ]    // a list of the named recommendations creating this info
             * }
             * </pre>
             * Of course any other additional related information may be added.
             */
            activityType: 'clickedElement',
            /**
             * If set to {@code null}, the system will assume that the click will open a new tab
             * if indicated by the event-data (default). If set to a boolean value, the system will
             * always apply the state indicated by the boolean ({@code true} schedule the activity,
             * otherwise {@code false} will not schedule the activity).
             */
            scheduleActivities: null,
            /**
             * This method triggers before the actual sending happens. The information can be manipulated here
             * to be taken into effect for the actual sending (ex. adding tags).
             *
             * @param settings the settings
             * @param eventData the event's data
             * @param user the user object
             * @param tags the tags
             */
            onBeforeActivitySent: function (settings, eventData, user, tags) {
            },
            /**
             * This method does not wait for the actual activity to be successfully sent, but triggers right
             * after the sending was initiated.
             *
             * @param settings the settings
             * @param eventData the event's data
             * @param user the user object
             * @param tags the tags
             */
            onActivitySent: function (settings, eventData, user, tags) {
            },
            /**
             * This method triggers when the sending was successful.
             *
             * @param settings the settings
             * @param eventData the event's data
             * @param user the user object
             * @param tags the tags
             */
            onAfterActivitySent: function (settings, eventData, user, tags) {
            }
        },
        data: {
            user: {},
            tags: {}
        }
    };

    const activityDomObserver = {
        marker: {
            activate: 'brob-active',
            elementData: 'brob-data'
        },
        actions: {
            removed: 'removed',
            added: 'added',
            changed: 'changed'
        },
        mutationObserver: null,
        additionalSelectors: {},
        additionalObservers: {},
        additionalMutationObservers: null,
        blurElements: [],
        blurListener: null,

        init: function () {
            const _self = this;
            const observerAttribute = 'data-' + this.marker.activate;

            // observe any attribute change to the observed attribute
            this.mutationObserver = new MutationObserver(function (mutations) {
                for (let i = 0; i < mutations.length; i++) {
                    const mutation = mutations[i];
                    const attribute = mutation.attributeName;
                    const addedNodes = mutations[i].addedNodes;
                    const removedNodes = mutations[i].removedNodes;

                    if (typeof attribute === 'string' && attribute === observerAttribute) {
                        _self.determineChangedElement($(mutation.target), _self.actions.changed);
                    }

                    for (let k = 0; k < addedNodes.length; k++) {
                        const addedNode = addedNodes[k];
                        _self.determineChangedElement($(addedNode), _self.actions.added);
                    }

                    for (let k = 0; k < removedNodes.length; k++) {
                        const removedNode = removedNodes[k];
                        _self.determineChangedElement($(removedNode), _self.actions.removed);
                    }
                }
            });
            this.mutationObserver.observe(document, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: [observerAttribute]
            });
        },

        /**
         * Read the data attached to the element (we do not read any activation,
         * calling this method means we want to read it).
         *
         * data is read from the 'brob-data' data (or "data-attribute"), which represents a JSON object
         * having the values settings and data:
         *
         * @param $el the element to set up
         * @param observerType the type to handle, ex. 'click'
         * @param settings settings, depends on <code>observerType</code>, see <code>defaultClickObserverOption</code>
         * @param data data instance, ex. <code>{ user: {}, tags: {} }</code>
         */
        setupObservableDomElement: function ($el, observerType, settings, data) {
            const _self = this;

            // we assign each element individually
            if ($el.length > 1) {
                $el.each(function () {
                    _self.setupObservableDomElement($(this), observerType, settings, data);
                });

                return;
            }
            // do not assign twice to elements that are evaluated already
            else if ($el.attr('data-' + this.marker.activate) === 'evaluated') {
                return;
            }

            const normalizedSettings = activityDomObserver.normalizeSettings(observerType, settings);
            const normalizedData = activityDomObserver.normalizeData(observerType, settings, data);

            let currentData = activityDomObserver.readElementData($el);
            if (!$.isArray(currentData)) {
                currentData = [];
            }

            currentData.push({
                observe: observerType,
                settings: normalizedSettings,
                data: normalizedData
            });

            if (normalizedSettings.bindDataByTag === true) {
                $el.attr('data-' + this.marker.elementData, JSON.stringify(currentData));
            } else {
                $el.data(this.marker.elementData, currentData);
            }

            $el.attr('data-' + this.marker.activate, 'true');

            // evaluate directly (not on bound or observing dom-event) if needed
            if (normalizedSettings.evaluateOnSetup === true) {
                activityDomObserver.evaluate($el);
            }
        },

        /**
         * Registers an additional observer which triggers activities when observed. The "trick" is that these
         * elements, when changes are observed will also trigger the data-brob-active attribute change.
         *
         * @param selectors a single or an array of selectors which select elements affected
         * @param observerType the type to handle, ex. 'click'
         * @param settings settings, depends on <code>observerType</code>, see <code>defaultClickObserverOption</code>
         * @param data data instance, ex. <code>{ user: {}, tags: {} }</code>
         * @param attributes an optional list (array) of attribute changes to observe
         */
        registerAdditionalMutationObserver: function (selectors, observerType, settings, data, attributes) {
            const _self = this;

            let definedSelectors;
            if ($.isArray(selectors)) {
                definedSelectors = selectors;
            } else if (typeof selectors === 'string') {
                definedSelectors = [selectors];
            } else {

                // there is nothing to really register here, so let's just stop
                return;
            }

            for (let i = 0; i < definedSelectors.length; i++) {
                const definedSelector = definedSelectors[i];

                // before binding an observer we select the once that are in the dom-tree and apply them as added
                const $selectedEls = $(definedSelector);
                _self.setupSelectedElement($selectedEls, definedSelector, this.actions.added, observerType, settings, data);

                // next, we create an identifier for the selector
                const definedSelectorId = Breinify.UTL.uuid();

                // and store the selector information under the specified identifier
                this.additionalObservers[definedSelectorId] = {
                    selector: definedSelector,
                    observerType: observerType,
                    settings: settings,
                    data: data
                };

                // last keep the identifier within the lists
                const selectors = $.isArray(this.additionalSelectors[definedSelector]) ? this.additionalSelectors[definedSelector] : [];
                this.additionalSelectors[definedSelector] = selectors;
                selectors.push(definedSelectorId);
            }

            // make sure we have the additionalMutationObservers initialized if needed
            if (this.additionalMutationObservers === null) {

                this.additionalMutationObservers = new MutationObserver(function (mutations) {
                    _self.handleAdditionalMutations(mutations);
                });

                this.additionalMutationObservers.observe(document, {
                    subtree: true,
                    childList: true,
                    attributes: true
                });
            }
        },

        handleAdditionalMutations: function (mutations) {
            const _self = this;

            for (let i = 0; i < mutations.length; i++) {
                const mutation = mutations[i];
                const target = typeof mutation.attributeName === 'string' ? mutation.target : null;
                const addedNodes = mutations[i].addedNodes;
                const removedNodes = mutations[i].removedNodes;

                // we check each additional selector
                const selectors = Object.keys(this.additionalSelectors);
                for (let j = 0; j < selectors.length; j++) {
                    const selector = selectors[j];
                    _self.handleAdditionalMutationObserverChanges(selector, target, addedNodes, removedNodes);
                }
            }
        },

        handleAdditionalMutationObserverChanges: function (selector, target, addedNodes, removedNodes) {
            if (target !== null) {
                const $el = $(target);

                if ($el.is(selector)) {
                    this.applyAdditionalMutationObserverChanges($el, selector, this.actions.changed);
                }
            }

            for (let k = 0; k < addedNodes.length; k++) {
                const $el = $(addedNodes[k]);
                this.applyAdditionalMutationObserverChanges($el, selector, this.actions.added);
            }

            for (let k = 0; k < removedNodes.length; k++) {
                const $el = $(removedNodes[k]);
                this.applyAdditionalMutationObserverChanges($el, selector, this.actions.removed);
            }
        },

        applyAdditionalMutationObserverChanges: function ($el, selector, type) {

            // retrieve all affected selectorIds that are affected by this selector
            let selectorIds = this.additionalSelectors[selector];
            selectorIds = $.isArray(selectorIds) ? selectorIds : [];

            // iterate over the selector identifiers and retrieve the settings
            for (let k = 0; k < selectorIds.length; k++) {
                const id = selectorIds[k];
                const settings = this.additionalObservers[id];
                if (!$.isPlainObject(settings)) {
                    continue;
                }

                // apply the settings by setting up the new or modified element
                this.setupSelectedElement($el, settings.selector, type, settings.observerType, settings.settings, settings.data);
            }
        },

        setupSelectedElement: function ($el, selector, type, observerType, settings, data) {
            const _self = this;

            if ($el.length > 1) {
                $el.each(function () {
                    _self.setupSelectedElement($(this), selector, type, observerType, settings, data);
                });
            } else if ($el.is(selector)) {

                /*
                 * We have a single element which fulfills the selector, next we have to apply
                 * the settings and determine which elements have to be actually observed
                 * within the (container-)element.
                 */
                const additionalMutationObserverSettings = $.extend(true, {}, defaultAdditionalMutationObserverSettings.settings, settings);
                const $selectedEls = $.isFunction(additionalMutationObserverSettings.onElementSelection) ? additionalMutationObserverSettings.onElementSelection($el) : $el;

                $selectedEls.each(function () {
                    const $selectedEl = $(this);
                    const observerActive = $selectedEl.attr('data-' + _self.marker.activate);

                    // check if the element is activated already, if so we do not need to do anything
                    if (typeof observerActive !== 'string' || observerActive.trim() === '') {
                        _self.setupObservableDomElement($selectedEl, observerType, settings, data);
                    }
                });
            } else {
                $el.find(selector).each(function () {
                    _self.setupSelectedElement($(this), selector, type, observerType, settings, data);
                });

                // if the parent contains the selector, the inner nodes (selected for observations) may have changed
                $el.parents(selector).each(function () {
                    _self.setupSelectedElement($(this), selector, type, observerType, settings, data);
                });
            }
        },

        determineChangedElement: function ($el, type) {
            const _self = this;
            const observerSelector = '[data-' + this.marker.activate + ']';

            if ($el.is(observerSelector)) {
                this.handleChangedElement($el, type);
                return;
            }

            const $innerEl = $el.find(observerSelector);
            if ($innerEl.length > 0) {
                $innerEl.each(function () {
                    _self.handleChangedElement($innerEl, type);
                });
            }
        },

        handleChangedElement: function ($el, type) {
            if (this.actions.added === type) {
                this.evaluate($el);
            } else if (this.actions.changed === type) {
                this.evaluate($el);
            } else if (this.actions.removed === type) {
                // for now there isn't anything to do
                // this.evaluate($el);
            } else {
                // ignore
            }
        },

        normalizeSettings: function (observerType, settings) {

            if (observerType === defaultClickObserverOption.observer) {
                return $.extend(true, {}, defaultObserverOption.settings, defaultClickObserverOption.settings, settings);
            } else {
                return $.extend(true, {}, defaultObserverOption.settings, settings);
            }
        },

        normalizeData: function (observerType, settings, data) {

            if (observerType === defaultClickObserverOption.observer) {
                return $.extend(true, {}, defaultObserverOption.data, defaultClickObserverOption.data, data);
            } else {
                return $.extend(true, {}, defaultObserverOption.data, data);
            }
        },

        readElementData: function ($el) {
            let observers;

            const elementData = $el.data(this.marker.elementData);
            if (typeof elementData === 'string' && typeof $el.attr('data-' + this.marker.elementData) === 'string') {
                try {
                    observers = JSON.parse(elementData);
                } catch (e) {
                    // we just can ignore this at this point
                    observers = [];
                }
            } else if ($.isPlainObject(elementData)) {
                observers = [elementData];
            } else if ($.isArray(elementData)) {
                observers = elementData;
            } else {
                observers = [];
            }

            return observers;
        },

        /**
         * Activates or deactivates the observation on the element.
         * @param $el the element to evaluate
         */
        evaluate: function ($el) {
            const _self = this;
            const setting = $el.attr('data-' + activityDomObserver.marker.activate);

            let operation;
            if (setting === 'true') {
                operation = this.activateObserver;
            } else if (setting === 'false') {
                operation = this.deactivateObserver;
            } else {
                return;
            }

            const observers = this.readElementData($el);
            for (let i = 0; i < observers.length; i++) {
                const observer = $.isPlainObject(observers[i]) ? observers[i] : {};
                operation.call(this, $el, observer);
            }

            $el.attr('data-' + activityDomObserver.marker.activate, 'evaluated');

            // check if the element has children that may need evaluate
            const $unevaluatedEls = $el.find('[data-' + activityDomObserver.marker.activate + ']');
            $unevaluatedEls.each(function () {
                _self.evaluate($(this));
            });
        },

        activateObserver: function ($el, observer) {
            const settings = $.isPlainObject(observer.settings) ? $.extend(true, {}, observer.settings) : {};
            const data = $.isPlainObject(observer.data) ? $.extend(true, {}, observer.data) : {};

            if ($.isFunction(settings.onActivation)) {
                const user = data.user;
                const tags = data.tags;

                settings.onActivation(settings, {
                    $el: $el
                }, user, tags);
            }

            if (observer.observe === defaultClickObserverOption.observer) {
                this.activateClickObserver($el, settings, data);
            } else if (observer.observe === defaultSubmitObserverOption.observer) {
                this.activateSubmitObserver($el, settings, data);
            }
        },

        activateSubmitObserver: function ($el, settings, data) {
            const _self = this;

            $el.submit(function (event) {
                _self.handleSubmit(event, $el, settings, data);
            });
        },

        handleSubmit: function (event, $el, settings, data) {
            const activityType = typeof settings.activityType === 'string' && settings.activityType !== '' ? settings.activityType : defaultSubmitObserverOption.settings.activityType;
            const eventData = {
                $el: $el,
                event: event,
                defaultOpenInNewTab: false,
                defaultWillReloadPage: false,
                overriddenScheduleActivities: false
            };

            this.handleEvent(activityType, eventData, $el, settings, data);
        },

        activateClickObserver: function ($el, settings, data) {
            const _self = this;

            if ($el.is('iframe')) {
                if (this.blurListener === null) {
                    this.blurListener = function (event) {

                        for (let i = 0; i < _self.blurElements.length; i++) {
                            const blurElement = _self.blurElements[i];

                            if ($(document.activeElement).is(blurElement.$el)) {
                                _self.handleClick(event, blurElement.$el, blurElement.settings, blurElement.data);
                            }
                        }
                    };

                    window.addEventListener('blur', this.blurListener);
                }

                this.blurElements.push({
                    $el: $el,
                    settings: settings,
                    data: data
                });
            } else {
                $el.click(function (event) {
                    _self.handleClick(event, $el, settings, data);
                });
            }
        },

        handleClick: function (event, $el, settings, data) {
            const openInNewTab = event.metaKey || event.ctrlKey || event.which === 2;
            const willReloadPage = event.target instanceof HTMLAnchorElement;

            const activityType = typeof settings.activityType === 'string' && settings.activityType !== '' ? settings.activityType : defaultClickObserverOption.settings.activityType;
            const eventData = {
                $el: $el,
                event: event,
                defaultOpenInNewTab: openInNewTab,
                defaultWillReloadPage: willReloadPage,
                overriddenScheduleActivities: false
            };

            this.handleEvent(activityType, eventData, $el, settings, data);
        },

        handleEvent: function (activityType, eventData, $el, settings, data) {
            const user = data.user;
            const tags = data.tags;

            let execute = true;
            if ($.isFunction(settings.onBeforeActivitySent)) {
                execute = settings.onBeforeActivitySent(settings, eventData, user, tags);
                execute = typeof execute === 'boolean' ? execute : true;
            }

            // do nothing if the execution was canceled
            if (execute === false) {
                return;
            }

            let scheduleActivity;
            if (settings.scheduleActivities === null) {
                if (eventData.defaultWillReloadPage === false) {
                    scheduleActivity = false;
                } else {
                    scheduleActivity = eventData.defaultOpenInNewTab !== true;
                }
            } else if (typeof settings.scheduleActivities === 'boolean') {
                scheduleActivity = settings.scheduleActivities || eventData.overriddenScheduleActivities;
            }

            // set the info what was decided to the eventData to be usable in the onAfterActivitySent
            eventData.scheduleActivity = scheduleActivity;

            if (scheduleActivity === true) {

                Breinify.plugins.activities.scheduleDelayedActivity(user, activityType, tags, 60000);
                if ($.isFunction(settings.onActivitySent)) {
                    settings.onActivitySent(settings, eventData, user, tags);
                }
                if ($.isFunction(settings.onAfterActivitySent)) {
                    settings.onAfterActivitySent(settings, eventData, user, tags);
                }
            } else if (scheduleActivity === false) {

                Breinify.plugins.activities.generic(activityType, user, tags, function () {
                    if ($.isFunction(settings.onAfterActivitySent)) {
                        settings.onAfterActivitySent(settings, eventData, user, tags);
                    }
                });

                if ($.isFunction(settings.onActivitySent)) {
                    settings.onActivitySent(settings, eventData, user, tags);
                }
            }
        },

        deactivateObserver: function ($el, settings) {
            // nothing done on deactivation yet
        }
    };

    const Activities = {
        domObserverActive: false,

        activateDomObserver: function () {
            if (this.domObserverActive === true) {
                return;
            }

            activityDomObserver.init();
            this.domObserverActive = true;
        },

        /**
         * Registers an additional observer which triggers activities when observed. The "trick" is that these
         * elements, when changes are observed will also trigger the data-brob-active attribute change.
         *
         * @param selector the selector which selects elements to observe
         * @param observerType the type to handle, ex. 'click'
         * @param settings settings, depends on <code>observerType</code>, see <code>defaultClickObserverOption</code>
         * @param data data instance, ex. <code>{ user: {}, tags: {} }</code>
         * @param attributes an optional list (array) of attribute changes to observe
         */
        registerAdditionalMutationObserver: function (selector, observerType, settings, data, attributes) {
            activityDomObserver.registerAdditionalMutationObserver(selector, observerType, settings, data, attributes);

            // just make it chainable
            return this;
        },

        /**
         * Read the data attached to the element (we do not read any activation,
         * calling this method means we want to read it).
         *
         * data is read from the 'brob-data' data (or "data-attribute"), which represents a JSON object
         * having the values settings and data:
         *
         * @param $el the element to set up
         * @param observerType the type to handle, ex. 'click'
         * @param settings settings, depends on <code>observerType</code>, see <code>defaultClickObserverOption</code>
         * @param data data instance, ex. <code>{ user: {}, tags: {} }</code>
         */
        setupObservableDomElement: function ($el, observerType, settings, data) {
            activityDomObserver.setupObservableDomElement($el, observerType, settings, data);

            // just make it chainable
            return this;
        },

        generic: function () {
            const _self = this;

            overload.overload({
                'String,Object': function (type, user) {
                    _self._send(type, user, {}, null);
                },
                'String,Object,Object': function (type, user, tags) {
                    _self._send(type, user, tags, null);
                },
                'String,Object,Object,Function': function (type, user, tags, cb) {
                    _self._send(type, user, tags, cb);
                }
            }, arguments, this);
        },

        pageVisit: function () {
            const type = 'pageVisit';
            const _self = this;

            overload.overload({
                '': function () {
                    _self._send(type, {}, {pageId: window.location.pathname}, null);
                },
                'Function': function (cb) {
                    _self._send(type, {}, {pageId: window.location.pathname}, cb);
                },
                'String,Function': function (pageId, cb) {
                    _self._send(type, {}, {pageId: pageId}, cb);
                },
                'String': function (pageId) {
                    _self._send(type, {}, {pageId: pageId}, null);
                },
                'String,Object,Function': function (pageId, user, cb) {
                    _self._send(type, user, {pageId: pageId}, cb);
                },
                'String,Object': function (pageId, user) {
                    _self._send(type, user, {pageId: pageId}, null);
                },
                'Object,Function': function (tags, cb) {
                    _self._send(type, {}, tags, cb);
                },
                'Object': function (tags) {
                    _self._send(type, {}, tags, null);
                },
                'Object,Object,Function': function (user, tags, cb) {
                    _self._send(type, user, tags, cb);
                },
                'Object,Object': function (user, tags) {
                    _self._send(type, user, tags, null);
                }
            }, arguments, this);
        },

        identify: function () {
            const type = 'identify';
            const _self = this;

            overload.overload({
                'Object,Function': function (user, cb) {
                    _self._send(type, user, {}, cb);
                },
                'Object,Object,Function': function (user, tags, cb) {
                    _self._send(type, user, tags, cb);
                },
                'Object': function (user) {
                    _self._send(type, user, {}, null);
                },
                'Object,Object': function (user, tags) {
                    _self._send(type, user, tags, null);
                }
            }, arguments, this);
        },

        viewedProduct: function () {
            overload.overload(this._productMethods('viewedProduct'), arguments, this);
        },

        addToCart: function () {
            overload.overload(this._productMethods('addToCart'), arguments, this);
        },

        removeFromCart: function () {
            overload.overload(this._productMethods('removeFromCart'), arguments, this);
        },

        checkOut: function () {
            const type = 'checkOut';
            const _self = this;

            overload.overload({
                'String,Array,Object,Object,Array,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,Array,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,Array,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Object,String,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,String,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,String,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Array,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Array,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,String,Object,Array,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Array,Object,Object,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Object,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,String,Object,Object,Object,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Array,Object,Object,String,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Object,String,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,String,Object,Object,String,Object': function (transactionId, products, receipt, promotions, user, tags) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags);
                },
                'String,Array,Object,Object,Array,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,Array,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,Array,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,Object,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Object,String,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Array,Object,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Array,Object,Object,Function': function (transactionId, products, receipt, promotions, user, tags, cb) {
                    tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object,Object,String,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,String,Object,Object,String,Function': function (transactionId, products, receipt, promotions, user, cb) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags, cb);
                },
                'String,Array,Object,Array,Object': function (transactionId, products, receipt, promotions, user) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Array,Object': function (transactionId, products, receipt, promotions, user) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,String,Object,Array,Object': function (transactionId, products, receipt, promotions, user) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,Array,Object,Object,Object': function (transactionId, products, receipt, promotions, user) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Object,Object': function (transactionId, products, receipt, promotions, user) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,String,Object,Object,Object': function (transactionId, products, receipt, promotions, user) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,Array,Object,Object,String': function (transactionId, products, receipt, promotions, user) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,Object,Object,Object,String': function (transactionId, products, receipt, promotions, user) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                },
                'String,String,Object,Object,String': function (transactionId, products, receipt, promotions, user) {
                    let tags = _self._mapCheckOutToTags(transactionId, products, receipt, promotions, {});
                    _self._send(type, user, tags);
                }
            }, arguments, this);
        },

        /**
         * Schedules (or overrides) a delayed activity sending.
         * @param user {object} the user of the activity
         * @param type {string} the type of the activity
         * @param tags {object} the tags of the activity
         * @param maxAgeInMs {number} the max age of the activity to be sent
         * @param filter {string=null} the filter that is executed when the delayed activity is found and in time
         * @param id {string=} the identifier (optional), should be set to override an existing scheduled activity
         * @returns {string} the id assigned to the activity
         */
        scheduleDelayedActivity: function (user, type, tags, maxAgeInMs, filter, id) {

            // get the activity data
            const activityData = {
                user: user,
                tags: tags,
                type: type,
                maxAgeInMs: maxAgeInMs,
                filter: filter,
                timestamp: new Date().getTime()
            };

            // we set the page information right now, so the scheduled information has it
            activityData.tags = this._setPageTags(activityData.tags);

            // return the identifier
            return usedDelayedActivitiesStorage.store(id, activityData);
        },

        readDelayedActivityData: function (id) {
            return usedDelayedActivitiesStorage.get(id);
        },

        hasDelayedActivityData: function (input) {
            let filter;
            if (typeof input === 'string') {
                filter = function (id) {
                    return id === input;
                };
            } else if ($.isFunction(input)) {
                filter = input;
            } else if (input instanceof RegExp) {
                filter = function (id) {
                    return input.test(id);
                };
            } else {
                filter = function () {
                    return false;
                };
            }

            let activitiesData = usedDelayedActivitiesStorage.getAll();
            if (activitiesData === null || !$.isPlainObject(activitiesData)) {
                return false;
            } else {
                return $.grep(activitiesData, filter).length > 0;
            }
        },

        removeDelayedActivityData: function (id) {
            usedDelayedActivitiesStorage.remove(id);
        },

        checkDelayedActivityData: function () {
            const _self = this;

            // check each activity after ready
            let activitiesData = usedDelayedActivitiesStorage.getAll();
            $.each(activitiesData, function (id, activityData) {
                _self._checkDelayedActivityData(id, activityData);
            });
        },

        _checkDelayedActivityData: function (id, activityData) {

            if (typeof activityData.type !== 'string' ||
                !($.isPlainObject(activityData.tags) || typeof activityData.tags === 'undefined' || activityData.tags === null) ||
                !($.isPlainObject(activityData.user) || typeof activityData.user === 'undefined' || activityData.user === null)) {
                return;
            }

            // get the expiration
            let now = new Date().getTime();
            let expires = typeof activityData.maxAgeInMs === 'number' && activityData.maxAgeInMs > 0 ?
                activityData.timestamp + activityData.maxAgeInMs : now;

            // if expired remove directly
            if (expires < now) {
                this.removeDelayedActivityData(id);
                return;
            }

            // otherwise let's see if we can handle the activity and find the function
            let filter = activityData.filter;
            let filterParts = typeof filter === 'string' ? filter.split('::') : [];

            let funcName, instance;
            if (filterParts.length >= 2) {

                // find the instance
                instance = Breinify.plugins[filterParts[0]];
                for (var i = 1; i < filterParts.length - 1; i++) {
                    instance = $.isPlainObject(instance) ? instance[filterParts[i]] : null;
                }

                // set the function-name
                funcName = filterParts[filterParts.length - 1];
            } else if (filterParts.length === 1) {
                instance = window;
                funcName = filterParts[0];
            } else {
                instance = null;
                funcName = null;
            }

            // make sure we have a function and execute it
            if (typeof instance !== 'object' || typeof funcName !== 'string' || instance === null) {
                this._send(activityData.type, activityData.user, activityData.tags);
                this.removeDelayedActivityData(id);
            } else if ($.isFunction(instance[funcName])) {
                const _self = this;
                instance[funcName].apply(instance, [id, activityData, function (id, activityData, sendAndRemoveActivity, removeActivity) {
                    if (sendAndRemoveActivity === true) {
                        _self._send(activityData.type, activityData.user, activityData.tags);
                        _self.removeDelayedActivityData(id);
                    } else if (removeActivity === true) {
                        _self.removeDelayedActivityData(id);
                    }
                }]);
            }
        },

        _productMethods: function (type) {
            const _self = this;

            return {
                'Array,Function': function (products, cb) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, cb);
                },
                'Object,Function': function (products, cb) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, cb);
                },
                'String,Function': function (products, cb) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, cb);
                },
                'String': function (products) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, null);
                },
                'Array': function (products) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, null);
                },
                'Object': function (products) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, {}, tags, null);
                },
                'String,Object,Function': function (products, user, cb) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, cb);
                },
                'Array,Object,Function': function (products, user, cb) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, cb);
                },
                'Object,Object,Function': function (products, user, cb) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, cb);
                },
                'String,Object': function (products, user) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, null);
                },
                'Array,Object': function (products, user) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, null);
                },
                'Object,Object': function (products, user) {
                    let tags = _self._mapProductsToTags(products);
                    _self._send(type, user, tags, null);
                },
                'String,Object,Object,Function': function (products, user, tags, cb) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, cb);
                },
                'Array,Object,Object,Function': function (products, user, tags, cb) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, cb);
                },
                'Object,Object,Object,Function': function (products, user, tags, cb) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, cb);
                },
                'String,Object,Object': function (products, user, tags) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, null);
                },
                'Array,Object,Object': function (products, user, tags) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, null);
                },
                'Object,Object,Object': function (products, user, tags) {
                    tags = _self._mapProductsToTags(products, tags);
                    _self._send(type, user, tags, null);
                }
            };
        },

        _mapCheckOutToTags: function (transactionId, products, receipt, promotions, tags) {

            // add the products to the tags
            tags = this._mapProductsToTags(products, tags);

            // add the promotions
            tags = this._mapPromotionsToTags(promotions, tags);

            // add the receipt
            if ($.isPlainObject(receipt)) {
                const total = Breinify.UTL.toPrice(receipt.total);

                tags.transactionPriceTotal = Breinify.UTL.toPrice(receipt.priceTotal);
                tags.transactionTaxTotal = Breinify.UTL.toPrice(receipt.taxTotal);
                tags.transactionDiscountTotal = Breinify.UTL.toPrice(receipt.discountTotal);
                tags.transactionMiscTotal = Breinify.UTL.toPrice(receipt.miscTotal);
                tags.transactionTotal = total !== null ? total :
                    (tags.transactionPriceTotal + tags.transactionTaxTotal + tags.transactionMiscTotal - tags.transactionDiscountTotal);
            }

            // set the transactionId
            tags.transactionId = transactionId;

            return tags
        },

        _mapProductsToTags: function (products, tags) {

            if ($.isPlainObject(products)) {
                return this._mapProductsToTags([products], tags);
            } else if (typeof products === 'string') {
                return this._mapProductsToTags([{id: products}], tags);
            } else if (typeof products === 'undefined' || products === null) {
                return tags;
            } else if (!$.isArray(products)) {
                throw new Error(prefixValidation + 'The defined `products` are invalid: ' + JSON.stringify(products));
            }

            let len = products.length;
            let hasQuantities = len > 0;
            let hasPrices = len > 0;
            let hasIds = len > 0;
            let hasCategories = len > 0;
            let hasNames = len > 0;
            let productQuantities = [];
            let productPrices = [];
            let productIds = [];
            let productCategories = [];
            let productNames = [];

            // iterate over the defined products
            for (var i = 0; i < len; i++) {
                let product = products[i];

                let productId = null;
                let productQuantity = null;
                let productPrice = null;
                let productCategory = null;
                let productName = null;

                if (typeof product === 'string') {
                    productId = product;
                } else if ($.isPlainObject(product)) {
                    productId = typeof product.id === 'string' ? product.id.trim() : null;
                    productQuantity = typeof product.quantity === 'number' ? product.quantity : null;
                    productPrice = typeof product.price === 'number' ? product.price : null;
                    productCategory = typeof product.category === 'string' ? product.category.trim() : null;
                    productName = typeof product.name === 'string' ? product.name.trim() : null;
                }

                hasIds = hasIds && !Breinify.UTL.isEmpty(productId);
                hasQuantities = hasQuantities && !Breinify.UTL.isEmpty(productQuantity);
                hasPrices = hasPrices && !Breinify.UTL.isEmpty(productPrice);
                hasCategories = hasCategories && !Breinify.UTL.isEmpty(productCategory);
                hasNames = hasNames && !Breinify.UTL.isEmpty(productName);

                productIds.push(productId);
                productPrices.push(productPrice);
                productQuantities.push(productQuantity);
                productCategories.push(productCategory);
                productNames.push(productName);
            }

            if (hasIds) {
                let productTags = {};
                if (hasQuantities) productTags.productQuantities = productQuantities;
                if (hasPrices) productTags.productPrices = productPrices;
                if (hasIds) productTags.productIds = productIds;
                if (hasNames) productTags.productNames = productNames;
                if (hasCategories) productTags.productCategories = productCategories;

                return $.extend(true, {}, tags, productTags);
            } else {
                throw new Error('Products must have an identifier: ' + JSON.stringify(products));
            }
        },

        _mapPromotionsToTags: function (promotions, tags) {

            if ($.isPlainObject(promotions)) {
                return this._mapPromotionsToTags([promotions], tags);
            } else if (typeof promotions === 'string') {
                return this._mapPromotionsToTags([{id: promotions}], tags);
            } else if (typeof promotions === 'undefined' || promotions === null) {
                return tags;
            } else if (!$.isArray(promotions)) {
                throw new Error(prefixValidation + 'The defined `promotions` are invalid: ' + JSON.stringify(promotions));
            }

            // check if we do not have any promotions, in that case we just return the tags
            if (promotions.length === 0) {
                return tags;
            }

            let len = promotions.length;
            let hasIds = len > 0;
            let hasPromotions = len > 0;
            let promotionAmounts = [];
            let promotionIds = [];

            // iterate over the defined promotions
            for (var i = 0; i < len; i++) {
                let promotion = promotions[i];

                let promotionId = null;
                let promotionAmount = null;

                if (typeof promotion === 'string') {
                    promotionId = promotion;
                } else if ($.isPlainObject(promotion)) {
                    promotionId = typeof promotion.id === 'string' ? promotion.id.trim() : null;
                    promotionAmount = typeof promotion.amount === 'number' ? promotion.amount : null;
                }

                hasIds = hasIds && !Breinify.UTL.isEmpty(promotionId);
                hasPromotions = hasPromotions && !Breinify.UTL.isEmpty(promotionAmount);

                promotionIds.push(promotionId);
                promotionAmounts.push(promotionAmount);
            }

            if (hasIds) {
                return $.extend(true, {}, tags, {
                    'promotionIds': hasIds ? promotionIds : null,
                    'promotionAmounts': hasPromotions ? promotionAmounts : null
                });
            } else {
                throw new Error('Promotions must have an identifier: ' + JSON.stringify(promotions));
            }
        },

        _extendTags: function (type, tags) {
            let tagsExtenderPlugIn = this.getConfig('tagsExtender', function () {
                return {};
            });

            // make sure we have valid tags
            if (!$.isPlainObject(tags)) {
                tags = {};
            }

            if (tagsExtenderPlugIn === null || !$.isFunction(tagsExtenderPlugIn)) {
                return $.extend({}, tags);
            } else {
                return $.extend({}, tagsExtenderPlugIn(type), tags);
            }
        },

        _setPageTags: function (tags) {

            tags = $.isPlainObject(tags) ? tags : {};

            /*
             * Also add always some page specific identifiers, these are:
             * - pageId : an identifier (wrapper) for the current page
             * - pageUrl: the URL of the current page
             * - title  : the title of the current page
             */
            tags.pageId = Breinify.UTL.isNonEmptyString(tags.pageId) === null ? window.location.pathname : tags.pageId;
            tags.pageUrl = Breinify.UTL.isNonEmptyString(tags.pageUrl) === null ? window.location.href : tags.pageUrl;
            tags.title = Breinify.UTL.isNonEmptyString(tags.title) === null ? document.title : tags.title;

            return tags;
        },

        _send: function (type, user, tags, callback) {
            user = Breinify.UTL.user.create(user);
            tags = this._extendTags(type, tags);

            // make sure the tags have an identifier set
            tags.id = typeof tags.id === 'string' ? tags.id : Breinify.UTL.uuid();

            /*
             * We also assign an id to all the activities sent by the same "script-loaded"
             * this ensures that activities can be bundles of having the same origin
             */
            tags.originId = originId;

            // set also the page information if it's not available yet
            tags = this._setPageTags(tags);

            // send the activity to Breinify
            Breinify.activity(user, type, null, null, tags, function (data, error) {

                if (typeof callback !== 'function') {
                    // nothing to do
                } else if (typeof error === 'string') {
                    callback(new Error(prefixApi + error));
                } else {
                    callback(null, {
                        user: user,
                        tags: tags
                    });
                }
            });

            // check if ga is activated
            let gaSettings = this.getConfig('googleAnalytics', {enabled: false});
            if ($.isPlainObject(gaSettings) && gaSettings.enabled === true) {
                gaHandler.handle(gaSettings, {
                    user: user,
                    type: type,
                    tags: tags
                });
            }
        }
    };

    // bind the module
    let BoundActivities = Breinify.plugins._add('activities', Activities);

    // finally use the bound activities (since getConfig is available) to retrieve activities
    Breinify.onReady(function () {
        BoundActivities.checkDelayedActivityData();
    });
})();