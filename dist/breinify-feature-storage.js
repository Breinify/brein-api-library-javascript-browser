"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('featureStorage')) {
        return;
    }

    const $ = Breinify.UTL._jquery();
    let _plugin = null;

    const _private = {
        featureChangeTimer: null,
        currentFeatures: {},
        currentFeatureMeta: {},
        pendingFeatureChanges: {},
        listeners: [],
        featureListeners: {},

        elementWatchers: {},
        watcherStates: {},

        domObserver: null,
        domObserverInstalled: false,
        domObserverPendingInstall: false,

        requestSources: {},
        originalFetch: null,
        fetchHookInstalled: false,

        getDebounceMs: function () {
            const value = _plugin.getConfig('featureChangeDebounceMs', 250);
            return typeof value === 'number' && isFinite(value) && value >= 0 ? value : 250;
        },

        debugError: function () {
            if (typeof console === 'undefined' || typeof console.error !== 'function') {
                return;
            }

            const args = Array.prototype.slice.call(arguments);
            args.unshift('[featureStorage]');
            console.error.apply(console, args);
        },

        normalizeName: function (name) {
            return typeof name === 'string' ? name.trim() : '';
        },

        normalizeNames: function (names) {
            let normalized = [];

            if (typeof names === 'string') {
                normalized = [names];
            } else if ($.isArray(names)) {
                normalized = names;
            }

            normalized = normalized
                .map((name) => this.normalizeName(name))
                .filter((name, idx, arr) => name !== '' && arr.indexOf(name) === idx);

            return normalized;
        },

        isPlainObject: function (value) {
            return $.isPlainObject(value);
        },

        cloneObject: function (value) {
            return Object.assign({}, value || {});
        },

        cloneFeatureMeta: function (value) {
            if (!this.isPlainObject(value)) {
                return null;
            }

            return {
                oldValue: Object.prototype.hasOwnProperty.call(value, 'oldValue') ? value.oldValue : null,
                newValue: Object.prototype.hasOwnProperty.call(value, 'newValue') ? value.newValue : null,
                additional: this.isPlainObject(value.additional) ? this.cloneObject(value.additional) : {},
                changedAt: typeof value.changedAt === 'number' ? value.changedAt : 0
            };
        },

        createChangePayload: function () {
            const self = this;
            const featureMeta = {};
            const changed = {};

            Object.keys(this.currentFeatureMeta).forEach(function (name) {
                featureMeta[name] = self.cloneFeatureMeta(self.currentFeatureMeta[name]);
            });

            Object.keys(this.pendingFeatureChanges).forEach(function (name) {
                changed[name] = self.cloneFeatureMeta(self.pendingFeatureChanges[name]);
            });

            return {
                features: this.cloneObject(this.currentFeatures),
                changed: changed,
                featureMeta: featureMeta
            };
        },

        notifyFeatureListeners: function (payload) {
            const self = this;
            const changedNames = Object.keys(payload.changed || {});

            changedNames.forEach(function (featureName) {
                const listeners = $.isArray(self.featureListeners[featureName])
                    ? self.featureListeners[featureName].slice()
                    : [];

                if (listeners.length === 0) {
                    return;
                }

                const featurePayload = {
                    name: featureName,
                    value: Object.prototype.hasOwnProperty.call(payload.features, featureName)
                        ? payload.features[featureName]
                        : null,
                    meta: Object.prototype.hasOwnProperty.call(payload.featureMeta, featureName)
                        ? self.cloneFeatureMeta(payload.featureMeta[featureName])
                        : null,
                    change: Object.prototype.hasOwnProperty.call(payload.changed, featureName)
                        ? self.cloneFeatureMeta(payload.changed[featureName])
                        : null,
                    features: payload.features,
                    changed: payload.changed,
                    featureMeta: payload.featureMeta
                };

                listeners.forEach(function (listener) {
                    try {
                        listener(featurePayload);
                    } catch (e) {
                        self.debugError('feature listener failed', {
                            feature: featureName,
                            error: e
                        });
                    }
                });
            });
        },

        ensureDomObserver: function () {
            if (this.domObserverInstalled === true || typeof MutationObserver !== 'function') {
                return;
            }

            if (!(document.body instanceof Element)) {
                if (this.domObserverPendingInstall === true) {
                    return;
                }

                this.domObserverPendingInstall = true;

                const self = this;
                document.addEventListener('DOMContentLoaded', function onReady() {
                    document.removeEventListener('DOMContentLoaded', onReady);
                    self.domObserverPendingInstall = false;
                    self.ensureDomObserver();
                });

                return;
            }

            const self = this;
            this.domObserver = new MutationObserver(function (mutations) {
                let shouldReconcile = false;

                mutations.forEach(function (mutation) {
                    if (mutation.type !== 'childList') {
                        return;
                    }

                    if ((mutation.addedNodes && mutation.addedNodes.length > 0) ||
                        (mutation.removedNodes && mutation.removedNodes.length > 0)) {
                        shouldReconcile = true;
                    }
                });

                if (shouldReconcile === true) {
                    self.reconcileAllWatchers();
                }
            });

            this.domObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            this.domObserverInstalled = true;
            this.reconcileAllWatchers();
        },

        ensureFetchHook: function () {
            if (this.fetchHookInstalled === true || typeof window.fetch !== 'function') {
                return;
            }

            const self = this;
            this.originalFetch = window.fetch.bind(window);

            window.fetch = function (input, init) {
                const ctx = {
                    url: self.getRequestUrl(input),
                    input: input,
                    init: init || null
                };

                self.processRequestSources(ctx);
                return self.originalFetch(input, init);
            };

            this.fetchHookInstalled = true;
        },

        scheduleFlush: function () {
            const self = this;

            if (this.featureChangeTimer !== null) {
                clearTimeout(this.featureChangeTimer);
            }

            this.featureChangeTimer = window.setTimeout(function () {
                self.featureChangeTimer = null;
                self.flushFeatureChanges();
            }, this.getDebounceMs());
        },

        flushFeatureChanges: function () {
            if ($.isEmptyObject(this.pendingFeatureChanges)) {
                return;
            }

            const payload = this.createChangePayload();
            this.pendingFeatureChanges = {};

            this.listeners.slice().forEach(function (listener) {
                try {
                    listener(payload);
                } catch (e) {
                    _private.debugError('listener failed', e);
                }
            });

            this.notifyFeatureListeners(payload);
        },

        isEqual: function (left, right) {

            if (Object.is(left, right)) {
                return true;
            } else if (left === null || right === null || typeof left !== typeof right) {
                return false;
            } else if ($.isArray(left)) {
                if (!$.isArray(right) || left.length !== right.length) {
                    return false;
                }

                for (let i = 0; i < left.length; i++) {
                    if (!this.isEqual(left[i], right[i])) {
                        return false;
                    }
                }

                return true;
            } else if (this.isPlainObject(left)) {
                if (!this.isPlainObject(right)) {
                    return false;
                }

                const leftKeys = Object.keys(left);
                const rightKeys = Object.keys(right);

                if (leftKeys.length !== rightKeys.length) {
                    return false;
                }

                for (let i = 0; i < leftKeys.length; i++) {
                    const key = leftKeys[i];

                    if (!Object.prototype.hasOwnProperty.call(right, key)) {
                        return false;
                    }

                    if (!this.isEqual(left[key], right[key])) {
                        return false;
                    }
                }

                return true;
            } else {
                return false;
            }
        },

        applyFeatureChange: function (name, oldValue, newValue, additional) {
            const normalizedName = this.normalizeName(name);
            if (normalizedName === '') {
                return false;
            }

            const normalizedOldValue = typeof oldValue === 'undefined' ? null : oldValue;
            const normalizedNewValue = typeof newValue === 'undefined' ? null : newValue;
            if (this.isEqual(normalizedOldValue, normalizedNewValue)) {
                return false;
            }

            const normalizedAdditional = this.isPlainObject(additional) ? this.cloneObject(additional) : {};
            const changedAt = Date.now();

            this.currentFeatures[normalizedName] = normalizedNewValue;
            this.currentFeatureMeta[normalizedName] = {
                oldValue: normalizedOldValue,
                newValue: normalizedNewValue,
                additional: normalizedAdditional,
                changedAt: changedAt
            };

            const existingPending = this.pendingFeatureChanges[normalizedName];
            this.pendingFeatureChanges[normalizedName] = {
                oldValue: existingPending ? existingPending.oldValue : normalizedOldValue,
                newValue: normalizedNewValue,
                additional: normalizedAdditional,
                changedAt: changedAt
            };

            this.scheduleFlush();
            return true;
        },

        removeFeatureValue: function (name, additional) {
            const normalizedName = this.normalizeName(name);
            if (normalizedName === '') {
                return false;
            }

            const oldValue = Object.prototype.hasOwnProperty.call(this.currentFeatures, normalizedName)
                ? this.currentFeatures[normalizedName]
                : null;

            return this.applyFeatureChange(normalizedName, oldValue, null, $.extend({}, additional, {
                removed: true
            }));
        },

        normalizeElementWatcher: function (watcher) {
            if (!this.isPlainObject(watcher)) {
                return null;
            }

            const normalizedName = this.normalizeName(watcher.name);
            const normalizedTargetSelector = typeof watcher.targetSelector === 'string'
                ? watcher.targetSelector.trim()
                : '';
            const normalizedRootSelector = typeof watcher.rootSelector === 'string'
                ? watcher.rootSelector.trim()
                : null;
            const attributes = $.isArray(watcher.attributes)
                ? watcher.attributes
                    .map(function (attributeName) {
                        return typeof attributeName === 'string' ? attributeName.trim() : '';
                    })
                    .filter(function (attributeName, idx, arr) {
                        return attributeName !== '' && arr.indexOf(attributeName) === idx;
                    })
                : [];

            if (normalizedName === '' || normalizedTargetSelector === '' || attributes.length === 0) {
                return null;
            }

            return {
                name: normalizedName,
                targetSelector: normalizedTargetSelector,
                rootSelector: normalizedRootSelector && normalizedRootSelector !== '' ? normalizedRootSelector : null,
                attributes: attributes,
                emitInitial: watcher.emitInitial === true,
                mapChange: $.isFunction(watcher.mapChange) ? watcher.mapChange : null
            };
        },

        normalizeRequestSource: function (source) {
            if (!this.isPlainObject(source)) {
                return null;
            }

            const normalizedName = this.normalizeName(source.name);
            if (normalizedName === '' || !$.isFunction(source.extract)) {
                return null;
            }

            return {
                name: normalizedName,
                match: $.isFunction(source.match) ? source.match : null,
                extract: source.extract
            };
        },

        createEmptyWatcherState: function () {
            return {
                element: null,
                observer: null,
                lastValues: {}
            };
        },

        cloneValues: function (values) {
            return this.cloneObject(values);
        },

        readWatcherAttributeValues: function (element, watcher) {
            const values = {};

            watcher.attributes.forEach(function (attributeName) {
                values[attributeName] = element.getAttribute(attributeName);
            });

            return values;
        },

        matchesWatcherRoot: function (element, watcher) {
            if (!(element instanceof Element)) {
                return false;
            }

            if (watcher.rootSelector === null) {
                return true;
            }

            try {
                return element.closest(watcher.rootSelector) !== null;
            } catch (e) {
                this.debugError('invalid root selector', {
                    watcher: watcher.name,
                    selector: watcher.rootSelector,
                    error: e
                });
                return false;
            }
        },

        findFirstWatcherTarget: function (watcher) {
            let candidates;
            try {
                candidates = document.querySelectorAll(watcher.targetSelector);
            } catch (e) {
                this.debugError('invalid target selector', {
                    watcher: watcher.name,
                    selector: watcher.targetSelector,
                    error: e
                });
                return null;
            }

            for (let i = 0; i < candidates.length; i++) {
                const element = candidates[i];
                if (this.matchesWatcherRoot(element, watcher)) {
                    return element;
                }
            }

            return null;
        },

        createMissingDetails: function (watcher, attributeName) {
            const details = {
                id: null,
                className: null,
                tagName: null,
                text: null,
                attributes: {},
                rootSelector: watcher.rootSelector,
                rootId: null,
                rootClassName: null,
                rootTagName: null
            };

            details.attributes[attributeName] = null;
            return details;
        },

        extractElementDetails: function (element, watcher) {
            const details = {
                id: null,
                className: null,
                tagName: null,
                text: null,
                attributes: {},
                rootSelector: watcher.rootSelector,
                rootId: null,
                rootClassName: null,
                rootTagName: null
            };

            if (!(element instanceof Element)) {
                return details;
            }

            details.id = element.id || null;
            details.className = element.className || null;
            details.tagName = element.tagName || null;
            details.text = (element.textContent || '').trim() || null;

            watcher.attributes.forEach(function (attributeName) {
                details.attributes[attributeName] = element.getAttribute(attributeName);
            });

            if (watcher.rootSelector !== null) {
                try {
                    const root = element.closest(watcher.rootSelector);
                    if (root instanceof Element) {
                        details.rootId = root.id || null;
                        details.rootClassName = root.className || null;
                        details.rootTagName = root.tagName || null;
                    }
                } catch (e) {
                    // ignore invalid root selector here since it was already validated elsewhere
                }
            }

            return details;
        },

        emitMappedChanges: function (watcher, ctx) {
            if (!$.isFunction(watcher.mapChange)) {
                return;
            }

            let changes;
            try {
                changes = watcher.mapChange(ctx);
            } catch (e) {
                this.debugError('watcher mapChange failed', {
                    watcher: watcher.name,
                    error: e
                });
                return;
            }

            if (!$.isArray(changes)) {
                return;
            }

            const self = this;
            changes.forEach(function (change) {
                if (!self.isPlainObject(change)) {
                    return;
                }

                const featureName = self.normalizeName(change.name);
                if (featureName === '') {
                    return;
                }

                const oldValue = Object.prototype.hasOwnProperty.call(change, 'oldValue')
                    ? change.oldValue
                    : (Object.prototype.hasOwnProperty.call(self.currentFeatures, featureName)
                        ? self.currentFeatures[featureName]
                        : null);

                self.applyFeatureChange(featureName, oldValue, change.newValue, change.additional);
            });
        },

        emitWatcherMissing: function (watcher, lastValues) {
            const self = this;

            watcher.attributes.forEach(function (attributeName) {
                const oldValue = lastValues ? lastValues[attributeName] : null;
                if (typeof oldValue === 'undefined' || oldValue === null) {
                    return;
                }

                self.emitMappedChanges(watcher, {
                    watcher: watcher,
                    element: null,
                    attribute: attributeName,
                    oldValue: oldValue,
                    newValue: null,
                    initial: false,
                    removed: true,
                    details: self.createMissingDetails(watcher, attributeName)
                });
            });
        },

        emitWatcherChange: function (watcher, element, attributeName, oldValue, newValue, initial, removed) {
            this.emitMappedChanges(watcher, {
                watcher: watcher,
                element: element,
                attribute: attributeName,
                oldValue: oldValue,
                newValue: newValue,
                initial: initial === true,
                removed: removed === true,
                details: removed === true
                    ? this.createMissingDetails(watcher, attributeName)
                    : this.extractElementDetails(element, watcher)
            });
        },

        createElementObserver: function (element, watcher, state) {
            if (!(element instanceof Element) || watcher.attributes.length === 0) {
                return null;
            }

            const self = this;
            const observer = new MutationObserver(function (mutations) {
                let shouldReconcile = false;

                mutations.forEach(function (mutation) {
                    if (mutation.type !== 'attributes') {
                        return;
                    }

                    const attributeName = mutation.attributeName;
                    if (!attributeName || watcher.attributes.indexOf(attributeName) === -1) {
                        return;
                    }

                    const oldValue = state.lastValues[attributeName];
                    const newValue = element.getAttribute(attributeName);
                    if (oldValue === newValue) {
                        return;
                    }

                    state.lastValues[attributeName] = newValue;
                    shouldReconcile = true;

                    self.emitWatcherChange(
                        watcher,
                        element,
                        attributeName,
                        oldValue,
                        newValue,
                        false,
                        false
                    );
                });

                if (shouldReconcile === true) {
                    self.reconcileWatcherState(watcher);
                }
            });

            observer.observe(element, {
                attributes: true,
                attributeOldValue: true,
                attributeFilter: watcher.attributes
            });

            return observer;
        },

        reconcileWatcherState: function (watcher) {
            if (!this.isPlainObject(watcher) || this.normalizeName(watcher.name) === '') {
                return;
            }

            let state = this.watcherStates[watcher.name];
            if (!this.isPlainObject(state)) {
                state = this.createEmptyWatcherState();
                this.watcherStates[watcher.name] = state;
            }

            const previousElement = state.element;
            const currentElement = this.findFirstWatcherTarget(watcher);

            if (previousElement === currentElement) {
                return;
            }

            if (state.observer) {
                state.observer.disconnect();
                state.observer = null;
            }

            if (previousElement !== null && currentElement === null) {
                this.emitWatcherMissing(watcher, state.lastValues);
                state.element = null;
                state.lastValues = {};
                return;
            }

            if (currentElement === null) {
                state.element = null;
                state.lastValues = {};
                return;
            }

            const oldValues = this.cloneValues(state.lastValues);
            const newValues = this.readWatcherAttributeValues(currentElement, watcher);
            const isReplacement = previousElement !== null && previousElement !== currentElement;

            state.element = currentElement;
            state.lastValues = this.cloneValues(newValues);
            state.observer = this.createElementObserver(currentElement, watcher, state);

            const self = this;
            watcher.attributes.forEach(function (attributeName) {
                const oldValue = isReplacement ? oldValues[attributeName] : null;
                const newValue = newValues[attributeName];

                if (isReplacement) {
                    if (oldValue === newValue) {
                        return;
                    }

                    self.emitWatcherChange(
                        watcher,
                        currentElement,
                        attributeName,
                        oldValue,
                        newValue,
                        false,
                        false
                    );
                    return;
                }

                if (watcher.emitInitial === true) {
                    self.emitWatcherChange(
                        watcher,
                        currentElement,
                        attributeName,
                        null,
                        newValue,
                        true,
                        false
                    );
                }
            });
        },

        reconcileAllWatchers: function () {
            const self = this;

            Object.keys(this.elementWatchers).forEach(function (name) {
                self.reconcileWatcherState(self.elementWatchers[name]);
            });
        },

        removeWatcherState: function (name) {
            const normalizedName = this.normalizeName(name);
            if (normalizedName === '') {
                return;
            }

            const state = this.watcherStates[normalizedName];
            if (this.isPlainObject(state) && state.observer) {
                state.observer.disconnect();
            }

            delete this.watcherStates[normalizedName];
        },

        getRequestUrl: function (input) {
            if (typeof input === 'string') {
                return input;
            }

            if (input && typeof input.url === 'string') {
                return input.url;
            }

            return null;
        },

        processRequestSources: function (ctx) {
            const self = this;

            Object.keys(this.requestSources).forEach(function (name) {
                const source = self.requestSources[name];

                try {
                    if ($.isFunction(source.match) && source.match(ctx) !== true) {
                        return;
                    }

                    const changes = source.extract(ctx);
                    if (!$.isArray(changes)) {
                        return;
                    }

                    changes.forEach(function (change) {
                        if (!self.isPlainObject(change)) {
                            return;
                        }

                        const featureName = self.normalizeName(change.name);
                        if (featureName === '') {
                            return;
                        }

                        const oldValue = Object.prototype.hasOwnProperty.call(change, 'oldValue')
                            ? change.oldValue
                            : (Object.prototype.hasOwnProperty.call(self.currentFeatures, featureName)
                                ? self.currentFeatures[featureName]
                                : null);

                        self.applyFeatureChange(featureName, oldValue, change.newValue, change.additional);
                    });
                } catch (e) {
                    self.debugError('request source failed', {
                        source: name,
                        error: e
                    });
                }
            });
        }
    };

    const FeatureStorage = {
        addElementWatcher: function (watcher) {
            const normalizedWatcher = _private.normalizeElementWatcher(watcher);
            if (normalizedWatcher === null) {
                return false;
            }

            _private.elementWatchers[normalizedWatcher.name] = normalizedWatcher;
            _private.ensureDomObserver();
            _private.reconcileWatcherState(normalizedWatcher);
            return true;
        },

        removeElementWatcher: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return false;
            }

            _private.removeWatcherState(normalizedName);
            delete _private.elementWatchers[normalizedName];
            return true;
        },

        getElementWatcher: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '' || !_private.isPlainObject(_private.elementWatchers[normalizedName])) {
                return null;
            }

            return {
                name: _private.elementWatchers[normalizedName].name,
                targetSelector: _private.elementWatchers[normalizedName].targetSelector,
                rootSelector: _private.elementWatchers[normalizedName].rootSelector,
                attributes: _private.elementWatchers[normalizedName].attributes.slice(),
                emitInitial: _private.elementWatchers[normalizedName].emitInitial === true,
                mapChange: _private.elementWatchers[normalizedName].mapChange
            };
        },

        getElementWatchers: function () {
            const self = this;
            return Object.keys(_private.elementWatchers).map(function (name) {
                return self.getElementWatcher(name);
            });
        },

        clearElementWatchers: function () {
            Object.keys(_private.elementWatchers).forEach(function (name) {
                _private.removeWatcherState(name);
            });

            _private.elementWatchers = {};
            return this;
        },

        addRequestSource: function (source) {
            const normalizedSource = _private.normalizeRequestSource(source);
            if (normalizedSource === null) {
                return false;
            }

            _private.requestSources[normalizedSource.name] = normalizedSource;
            _private.ensureFetchHook();
            return true;
        },

        removeRequestSource: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return false;
            }

            delete _private.requestSources[normalizedName];
            return true;
        },

        getRequestSource: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '' || !_private.isPlainObject(_private.requestSources[normalizedName])) {
                return null;
            }

            return {
                name: _private.requestSources[normalizedName].name,
                match: _private.requestSources[normalizedName].match,
                extract: _private.requestSources[normalizedName].extract
            };
        },

        getRequestSources: function () {
            const self = this;
            return Object.keys(_private.requestSources).map(function (name) {
                return self.getRequestSource(name);
            });
        },

        clearRequestSources: function () {
            _private.requestSources = {};
            return this;
        },

        set: function (name, value, additional) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return this;
            }

            const oldValue = Object.prototype.hasOwnProperty.call(_private.currentFeatures, normalizedName)
                ? _private.currentFeatures[normalizedName]
                : null;

            _private.applyFeatureChange(normalizedName, oldValue, value, additional);
            return this;
        },

        get: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return null;
            }

            return Object.prototype.hasOwnProperty.call(_private.currentFeatures, normalizedName)
                ? _private.currentFeatures[normalizedName]
                : null;
        },

        remove: function (name, additional) {
            _private.removeFeatureValue(name, additional);
            return this;
        },

        all: function () {
            return _private.cloneObject(_private.currentFeatures);
        },

        meta: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return null;
            }

            return Object.prototype.hasOwnProperty.call(_private.currentFeatureMeta, normalizedName)
                ? _private.cloneFeatureMeta(_private.currentFeatureMeta[normalizedName])
                : null;
        },

        clear: function () {
            if (_private.featureChangeTimer !== null) {
                clearTimeout(_private.featureChangeTimer);
                _private.featureChangeTimer = null;
            }

            _private.currentFeatures = {};
            _private.currentFeatureMeta = {};
            _private.pendingFeatureChanges = {};
            return this;
        },

        onChange: function (listener) {
            if (!$.isFunction(listener)) {
                return this;
            }

            if (_private.listeners.indexOf(listener) === -1) {
                _private.listeners.push(listener);
            }

            return this;
        },

        onFeatureChange: function (names, listener) {
            if (!$.isFunction(listener)) {
                return this;
            }

            const normalizedNames = _private.normalizeNames(names);
            if (normalizedNames.length === 0) {
                return this;
            }

            normalizedNames.forEach(function (name) {
                if (!$.isArray(_private.featureListeners[name])) {
                    _private.featureListeners[name] = [];
                }

                if (_private.featureListeners[name].indexOf(listener) === -1) {
                    _private.featureListeners[name].push(listener);
                }
            });

            return this;
        },

        offChange: function (listener) {
            _private.listeners = _private.listeners.filter(function (entry) {
                return entry !== listener;
            });
            return this;
        },

        offFeatureChange: function (names, listener) {
            const normalizedNames = _private.normalizeNames(names);

            if (normalizedNames.length === 0) {
                if (!$.isFunction(listener)) {
                    return this;
                }

                Object.keys(_private.featureListeners).forEach(function (name) {
                    _private.featureListeners[name] = _private.featureListeners[name].filter(function (entry) {
                        return entry !== listener;
                    });

                    if (_private.featureListeners[name].length === 0) {
                        delete _private.featureListeners[name];
                    }
                });

                return this;
            }

            normalizedNames.forEach(function (name) {
                if (!$.isArray(_private.featureListeners[name])) {
                    return;
                }

                if ($.isFunction(listener)) {
                    _private.featureListeners[name] = _private.featureListeners[name].filter(function (entry) {
                        return entry !== listener;
                    });
                } else {
                    delete _private.featureListeners[name];
                    return;
                }

                if (_private.featureListeners[name].length === 0) {
                    delete _private.featureListeners[name];
                }
            });

            return this;
        },

        flush: function () {
            _private.flushFeatureChanges();
            return this;
        },

        reconcile: function () {
            _private.ensureDomObserver();
            _private.reconcileAllWatchers();
            return this;
        }
    };

    // bind the module
    _plugin = Breinify.plugins._add('featureStorage', FeatureStorage);
})();