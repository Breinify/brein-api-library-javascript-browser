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

    /**
     * Metadata describing one feature change.
     *
     * @typedef {Object} FeatureMeta
     * @property {*} oldValue
     * @property {*} newValue
     * @property {Object} additional
     * @property {number} changedAt
     */

    const _private = {
        featureChangeTimer: null,
        currentFeatures: {},
        currentFeatureMeta: {},
        pendingFeatureChanges: {},
        listeners: [],
        featureListeners: [],

        featureDefinitions: {},

        elementWatchers: {},
        watcherStates: {},

        domObserver: null,
        domObserverInstalled: false,
        domObserverPendingInstall: false,

        requestSources: {},
        originalFetch: null,
        fetchHookInstalled: false,

        persistence: {
            storagePrefix: 'breinify::featureStorage::feature::',
            cleanupKey: 'breinify::featureStorage::cleanupAt',
            cleanupIntervalInMs: 6 * 60 * 60 * 1000,   // 6h
            defaultTtlInMs: 24 * 60 * 60 * 1000        // 24h
        },

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
                .filter((name, idx, arr) => name !== '' && arr.indexOf(name) === idx)
                .sort();

            return normalized;
        },

        normalizeFeatureListenerOptions: function (options) {
            const normalizedOptions = this.isPlainObject(options) ? this.cloneObject(options) : {};
            const mode = normalizedOptions.mode === 'single' ? 'single' : 'batch';

            return {
                mode: mode
            };
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

        cloneFeatureDefinition: function (value) {
            if (!this.isPlainObject(value)) {
                return null;
            }

            return {
                persistence: this.cloneObject(value.persistence)
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

        createFilteredChangePayload: function (payload, featureNames) {
            const self = this;
            const filteredChanged = {};
            const filteredFeatureMeta = {};

            featureNames.forEach(function (featureName) {
                if (Object.prototype.hasOwnProperty.call(payload.changed, featureName)) {
                    filteredChanged[featureName] = self.cloneFeatureMeta(payload.changed[featureName]);
                }

                if (Object.prototype.hasOwnProperty.call(payload.featureMeta, featureName)) {
                    filteredFeatureMeta[featureName] = self.cloneFeatureMeta(payload.featureMeta[featureName]);
                }
            });

            return {
                features: payload.features,
                changed: filteredChanged,
                featureMeta: filteredFeatureMeta
            };
        },

        /**
         * Notifies feature-specific listeners about changes.
         *
         * SINGLE MODE:
         *   Listener is called once per changed feature:
         *   {
         *     name: string,
         *     value: any,
         *     meta: FeatureMeta|null,
         *     change: FeatureMeta|null,
         *     features: { ... },
         *     changed: { ... },
         *     featureMeta: { ... }
         *   }
         *
         * BATCH MODE:
         *   Listener is called once per flush:
         *   {
         *     names: string[],
         *     matchedNames: string[],
         *     mode: 'batch',
         *     features: { ... },
         *     changed: { [name]: FeatureMeta },
         *     featureMeta: { ... }
         *   }
         */
        notifyFeatureListeners: function (payload) {
            const self = this;
            const changedNames = Object.keys(payload.changed || {});

            if (changedNames.length === 0) {
                return;
            }

            this.featureListeners.slice().forEach(function (entry) {
                if (!self.isPlainObject(entry) || !$.isFunction(entry.listener)) {
                    return;
                }

                const matchingNames = entry.names.filter(function (name) {
                    return Object.prototype.hasOwnProperty.call(payload.changed, name);
                });

                if (matchingNames.length === 0) {
                    return;
                }

                if (entry.options.mode === 'single') {
                    matchingNames.forEach(function (featureName) {
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

                        try {
                            entry.listener(featurePayload);
                        } catch (e) {
                            self.debugError('feature listener failed', {
                                feature: featureName,
                                mode: 'single',
                                error: e
                            });
                        }
                    });
                } else {
                    const filteredPayload = self.createFilteredChangePayload(payload, entry.names);

                    try {
                        entry.listener({
                            names: entry.names.slice(),
                            matchedNames: matchingNames.slice(),
                            mode: 'batch',
                            features: filteredPayload.features,
                            changed: filteredPayload.changed,
                            featureMeta: filteredPayload.featureMeta
                        });
                    } catch (e) {
                        self.debugError('feature listener failed', {
                            features: matchingNames,
                            mode: 'batch',
                            error: e
                        });
                    }
                }
            });
        },

        getDefaultFeatureDefinition: function () {
            return {
                persistence: {
                    enabled: true,
                    type: 'localStorage',
                    ttlInMs: this.persistence.defaultTtlInMs
                }
            };
        },

        normalizeFeatureDefinition: function (definition) {
            const defaults = this.getDefaultFeatureDefinition();
            const normalizedInput = this.isPlainObject(definition) ? definition : {};
            const inputPersistence = this.isPlainObject(normalizedInput.persistence)
                ? normalizedInput.persistence
                : {};

            let ttlInMs = inputPersistence.ttlInMs;
            ttlInMs = typeof ttlInMs === 'number' && isFinite(ttlInMs) && ttlInMs > 0
                ? Math.round(ttlInMs)
                : defaults.persistence.ttlInMs;

            let enabled = inputPersistence.enabled;
            enabled = typeof enabled === 'boolean'
                ? enabled
                : defaults.persistence.enabled;

            let type = inputPersistence.type;
            type = type === 'localStorage'
                ? type
                : defaults.persistence.type;

            return {
                persistence: {
                    enabled: enabled,
                    type: type,
                    ttlInMs: ttlInMs
                }
            };
        },

        extractInlineFeatureDefinition: function (additional) {
            const inlineDefinition = {};

            if (this.isPlainObject(additional) && this.isPlainObject(additional.featureDefinition)) {
                inlineDefinition.persistence = this.isPlainObject(additional.featureDefinition.persistence)
                    ? this.cloneObject(additional.featureDefinition.persistence)
                    : undefined;
            }

            if (this.isPlainObject(additional) && this.isPlainObject(additional.persistence)) {
                inlineDefinition.persistence = this.cloneObject(additional.persistence);
            }

            return this.isPlainObject(inlineDefinition.persistence) ? inlineDefinition : null;
        },

        resolveFeatureDefinition: function (name, additional) {
            const normalizedName = this.normalizeName(name);
            const baseDefinition = Object.prototype.hasOwnProperty.call(this.featureDefinitions, normalizedName)
                ? this.featureDefinitions[normalizedName]
                : this.getDefaultFeatureDefinition();
            const inlineDefinition = this.extractInlineFeatureDefinition(additional);

            if (!this.isPlainObject(inlineDefinition)) {
                return this.normalizeFeatureDefinition(baseDefinition);
            }

            const merged = this.cloneFeatureDefinition(baseDefinition) || this.getDefaultFeatureDefinition();
            merged.persistence = this.cloneObject(merged.persistence);
            Object.assign(merged.persistence, inlineDefinition.persistence);

            return this.normalizeFeatureDefinition(merged);
        },

        rememberInlineFeatureDefinition: function (name, additional) {
            const normalizedName = this.normalizeName(name);
            const inlineDefinition = this.extractInlineFeatureDefinition(additional);

            if (normalizedName === '' || !this.isPlainObject(inlineDefinition)) {
                return;
            }

            const resolvedDefinition = this.resolveFeatureDefinition(normalizedName, additional);
            this.featureDefinitions[normalizedName] = resolvedDefinition;
        },

        getPersistenceStorage: function (definition) {
            if (!this.isPlainObject(definition) || !this.isPlainObject(definition.persistence)) {
                return null;
            }

            if (definition.persistence.enabled !== true || definition.persistence.type !== 'localStorage') {
                return null;
            }

            try {
                return window.localStorage;
            } catch (e) {
                return null;
            }
        },

        getPersistenceKey: function (name) {
            return this.persistence.storagePrefix + name;
        },

        buildPersistedFeatureEntry: function (name, definition) {
            const normalizedName = this.normalizeName(name);
            const now = Date.now();

            return {
                value: Object.prototype.hasOwnProperty.call(this.currentFeatures, normalizedName)
                    ? this.currentFeatures[normalizedName]
                    : null,
                meta: Object.prototype.hasOwnProperty.call(this.currentFeatureMeta, normalizedName)
                    ? this.cloneFeatureMeta(this.currentFeatureMeta[normalizedName])
                    : null,
                definition: this.cloneFeatureDefinition(definition),
                persistedAt: now,
                expiresAt: now + definition.persistence.ttlInMs
            };
        },

        persistFeature: function (name, additional) {
            const normalizedName = this.normalizeName(name);
            if (normalizedName === '') {
                return false;
            }

            this.rememberInlineFeatureDefinition(normalizedName, additional);

            const definition = this.resolveFeatureDefinition(normalizedName, additional);
            const storage = this.getPersistenceStorage(definition);
            if (storage === null) {
                return false;
            }

            if (definition.persistence.enabled !== true) {
                this.removePersistedFeature(normalizedName, definition);
                return false;
            }

            try {
                storage.setItem(
                    this.getPersistenceKey(normalizedName),
                    JSON.stringify(this.buildPersistedFeatureEntry(normalizedName, definition))
                );

                this.runPersistenceCleanupIfNeeded(false);
                return true;
            } catch (e) {
                this.debugError('failed to persist feature', {
                    feature: normalizedName,
                    error: e
                });
                return false;
            }
        },

        touchPersistedFeature: function (name, additional) {
            const normalizedName = this.normalizeName(name);
            if (normalizedName === '') {
                return false;
            }

            const definition = this.resolveFeatureDefinition(normalizedName, additional);
            const storage = this.getPersistenceStorage(definition);
            if (storage === null || definition.persistence.enabled !== true) {
                return false;
            }

            try {
                const key = this.getPersistenceKey(normalizedName);
                const raw = storage.getItem(key);
                if (typeof raw !== 'string' || raw.trim() === '') {
                    return false;
                }

                const parsed = JSON.parse(raw);
                if (!this.isPlainObject(parsed)) {
                    storage.removeItem(key);
                    return false;
                }

                parsed.persistedAt = Date.now();
                parsed.expiresAt = parsed.persistedAt + definition.persistence.ttlInMs;
                parsed.definition = this.cloneFeatureDefinition(definition);

                storage.setItem(key, JSON.stringify(parsed));
                this.runPersistenceCleanupIfNeeded(false);
                return true;
            } catch (e) {
                this.debugError('failed to touch persisted feature', {
                    feature: normalizedName,
                    error: e
                });
                return false;
            }
        },

        removePersistedFeature: function (name, definition) {
            const normalizedName = this.normalizeName(name);
            if (normalizedName === '') {
                return false;
            }

            const resolvedDefinition = this.isPlainObject(definition)
                ? definition
                : this.resolveFeatureDefinition(normalizedName, null);
            const storage = this.getPersistenceStorage(resolvedDefinition);
            if (storage === null) {
                return false;
            }

            try {
                storage.removeItem(this.getPersistenceKey(normalizedName));
                return true;
            } catch (e) {
                this.debugError('failed to remove persisted feature', {
                    feature: normalizedName,
                    error: e
                });
                return false;
            }
        },

        parsePersistedFeatureEntry: function (rawValue) {
            if (typeof rawValue !== 'string' || rawValue.trim() === '') {
                return null;
            }

            try {
                const parsed = JSON.parse(rawValue);
                return this.isPlainObject(parsed) ? parsed : null;
            } catch (e) {
                return null;
            }
        },

        isExpiredPersistedFeatureEntry: function (entry) {
            return typeof entry.expiresAt === 'number' && entry.expiresAt <= Date.now();
        },

        restorePersistedFeatures: function () {
            let storage = null;
            try {
                storage = window.localStorage;
            } catch (e) {
                return;
            }

            if (storage === null) {
                return;
            }

            const self = this;
            const keysToRemove = [];

            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (typeof key !== 'string' || key.indexOf(this.persistence.storagePrefix) !== 0) {
                    continue;
                }

                const featureName = key.substring(this.persistence.storagePrefix.length);
                const parsed = this.parsePersistedFeatureEntry(storage.getItem(key));

                if (!this.isPlainObject(parsed)) {
                    keysToRemove.push(key);
                    continue;
                }

                if (this.isExpiredPersistedFeatureEntry(parsed)) {
                    keysToRemove.push(key);
                    continue;
                }

                const definition = this.normalizeFeatureDefinition(parsed.definition);
                if (definition.persistence.enabled !== true) {
                    keysToRemove.push(key);
                    continue;
                }

                if (this.isPlainObject(parsed.meta)) {
                    self.currentFeatureMeta[featureName] = self.cloneFeatureMeta(parsed.meta);
                } else {
                    self.currentFeatureMeta[featureName] = {
                        oldValue: null,
                        newValue: parsed.value,
                        additional: {},
                        changedAt: typeof parsed.persistedAt === 'number' ? parsed.persistedAt : Date.now()
                    };
                }

                self.currentFeatures[featureName] = parsed.value;
                self.featureDefinitions[featureName] = definition;
                self.touchPersistedFeature(featureName, {
                    featureDefinition: definition
                });
            }

            keysToRemove.forEach(function (key) {
                try {
                    storage.removeItem(key);
                } catch (e) {
                    // ignore removal failure
                }
            });

            this.runPersistenceCleanupIfNeeded(true);
        },

        runPersistenceCleanupIfNeeded: function (force) {
            let storage = null;
            try {
                storage = window.localStorage;
            } catch (e) {
                return;
            }

            if (storage === null) {
                return;
            }

            const now = Date.now();
            if (force !== true) {
                const lastCleanupRaw = storage.getItem(this.persistence.cleanupKey);
                const lastCleanup = Number(lastCleanupRaw);
                if (Number.isFinite(lastCleanup) && now - lastCleanup < this.persistence.cleanupIntervalInMs) {
                    return;
                }
            }

            const keysToRemove = [];
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (typeof key !== 'string' || key.indexOf(this.persistence.storagePrefix) !== 0) {
                    continue;
                }

                const parsed = this.parsePersistedFeatureEntry(storage.getItem(key));
                if (!this.isPlainObject(parsed) || this.isExpiredPersistedFeatureEntry(parsed)) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(function (key) {
                try {
                    storage.removeItem(key);
                } catch (e) {
                    // ignore removal failure
                }
            });

            try {
                storage.setItem(this.persistence.cleanupKey, String(now));
            } catch (e) {
                // ignore write failure
            }
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

        /**
         * Flushes pending feature changes (debounced).
         *
         * This method:
         * 1) Builds a normalized payload of all feature changes
         * 2) Clears pending changes
         * 3) Notifies:
         *    - global listeners (onChange)
         *    - feature-specific listeners (onFeatureChange)
         *
         * Triggered automatically via debounce when features change.
         */
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
                this.persistFeature(normalizedName, additional);
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

            this.persistFeature(normalizedName, additional);
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

            const changed = this.applyFeatureChange(normalizedName, oldValue, null, $.extend({}, additional, {
                removed: true
            }));

            delete this.currentFeatures[normalizedName];
            delete this.currentFeatureMeta[normalizedName];
            delete this.pendingFeatureChanges[normalizedName];
            this.removePersistedFeature(normalizedName);
            return changed;
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

        /**
         * Adds an element watcher.
         *
         * The watcher observes the first matching DOM element and maps attribute
         * changes to one or more feature changes via `mapChange(ctx)`.
         *
         * Expected watcher shape:
         * {
         *   name: string,
         *   targetSelector: string,
         *   rootSelector?: string|null,
         *   attributes: string[],
         *   emitInitial?: boolean,
         *   mapChange?: function(ctx): Array<{
         *     name: string,
         *     oldValue?: *,
         *     newValue: *,
         *     additional?: Object
         *   }>
         * }
         *
         * The `ctx` passed to `mapChange` contains:
         * {
         *   watcher,
         *   element,
         *   attribute,
         *   oldValue,
         *   newValue,
         *   initial: boolean,
         *   removed: boolean,
         *   details: Object
         * }
         *
         * @param {Object} watcher
         * @returns {boolean} true if the watcher was accepted
         */
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

        /**
         * Removes a previously registered element watcher by name.
         *
         * @param {string} name
         * @returns {boolean} true if the name was valid
         */
        removeElementWatcher: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return false;
            }

            _private.removeWatcherState(normalizedName);
            delete _private.elementWatchers[normalizedName];
            return true;
        },

        /**
         * Returns one registered element watcher by name.
         *
         * @param {string} name
         * @returns {Object|null}
         */
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

        /**
         * Returns all registered element watchers.
         *
         * @returns {Object[]}
         */
        getElementWatchers: function () {
            const self = this;
            return Object.keys(_private.elementWatchers).map(function (name) {
                return self.getElementWatcher(name);
            });
        },

        /**
         * Removes all registered element watchers.
         *
         * @returns {Object} FeatureStorage
         */
        clearElementWatchers: function () {
            Object.keys(_private.elementWatchers).forEach(function (name) {
                _private.removeWatcherState(name);
            });

            _private.elementWatchers = {};
            return this;
        },

        /**
         * Adds a request source.
         *
         * A request source can inspect outgoing fetch requests and map them
         * to feature changes.
         *
         * Expected source shape:
         * {
         *   name: string,
         *   match?: function(ctx): boolean,
         *   extract: function(ctx): Array<{
         *     name: string,
         *     oldValue?: *,
         *     newValue: *,
         *     additional?: Object
         *   }>
         * }
         *
         * The `ctx` passed to match/extract contains:
         * {
         *   url: string|null,
         *   input: *,
         *   init: Object|null
         * }
         *
         * @param {Object} source
         * @returns {boolean} true if the source was accepted
         */
        addRequestSource: function (source) {
            const normalizedSource = _private.normalizeRequestSource(source);
            if (normalizedSource === null) {
                return false;
            }

            _private.requestSources[normalizedSource.name] = normalizedSource;
            _private.ensureFetchHook();
            return true;
        },

        /**
         * Removes a request source by name.
         *
         * @param {string} name
         * @returns {boolean} true if the name was valid
         */
        removeRequestSource: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return false;
            }

            delete _private.requestSources[normalizedName];
            return true;
        },

        /**
         * Returns one registered request source by name.
         *
         * @param {string} name
         * @returns {Object|null}
         */
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

        /**
         * Returns all registered request sources.
         *
         * @returns {Object[]}
         */
        getRequestSources: function () {
            const self = this;
            return Object.keys(_private.requestSources).map(function (name) {
                return self.getRequestSource(name);
            });
        },

        /**
         * Removes all request sources.
         *
         * @returns {Object} FeatureStorage
         */
        clearRequestSources: function () {
            _private.requestSources = {};
            return this;
        },

        /**
         * Defines or updates one feature definition.
         *
         * Definition shape:
         * {
         *   persistence?: {
         *     enabled?: boolean,      // default true
         *     type?: 'localStorage',  // currently only localStorage is supported
         *     ttlInMs?: number        // default 24h
         *   }
         * }
         *
         * If omitted, defaults are used.
         *
         * @param {string} name
         * @param {Object=} definition
         * @returns {Object} FeatureStorage
         */
        defineFeature: function (name, definition) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return this;
            }

            _private.featureDefinitions[normalizedName] = _private.normalizeFeatureDefinition(definition);
            return this;
        },

        /**
         * Returns the normalized definition for one feature.
         *
         * If the feature was not explicitly defined, the default definition is returned.
         *
         * @param {string} name
         * @returns {Object|null}
         */
        getFeatureDefinition: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return null;
            }

            return _private.cloneFeatureDefinition(
                Object.prototype.hasOwnProperty.call(_private.featureDefinitions, normalizedName)
                    ? _private.featureDefinitions[normalizedName]
                    : _private.getDefaultFeatureDefinition()
            );
        },

        /**
         * Removes one explicit feature definition.
         *
         * The feature itself is not removed. Future operations fall back to defaults.
         *
         * @param {string} name
         * @returns {Object} FeatureStorage
         */
        removeFeatureDefinition: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return this;
            }

            delete _private.featureDefinitions[normalizedName];
            return this;
        },

        /**
         * Sets a feature value.
         *
         * If the value is unchanged, no change event is emitted.
         * Changes are debounced and flushed later.
         *
         * Persistence:
         * - persistence is enabled by default
         * - persisted values are restored silently on initialization
         * - persisted entries use a default TTL of 24h
         * - TTL is refreshed when the same value is observed again
         *
         * Optional inline definition/override can be passed through `additional`:
         * {
         *   ...,
         *   persistence?: {
         *     enabled?: boolean,
         *     type?: 'localStorage',
         *     ttlInMs?: number
         *   },
         *   featureDefinition?: {
         *     persistence?: {
         *       enabled?: boolean,
         *       type?: 'localStorage',
         *       ttlInMs?: number
         *     }
         *   }
         * }
         *
         * @param {string} name
         * @param {*} value
         * @param {Object=} additional optional metadata attached to the change
         * @returns {Object} FeatureStorage
         */
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

        /**
         * Gets the current value of one feature.
         *
         * If the feature is persisted, reading it refreshes its TTL.
         *
         * @param {string} name
         * @returns {*|null}
         */
        get: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return null;
            }

            const value = Object.prototype.hasOwnProperty.call(_private.currentFeatures, normalizedName)
                ? _private.currentFeatures[normalizedName]
                : null;

            if (Object.prototype.hasOwnProperty.call(_private.currentFeatures, normalizedName)) {
                _private.touchPersistedFeature(normalizedName, null);
            }

            return value;
        },

        /**
         * Removes a feature value by setting it to null and marking the change as removed.
         *
         * Persisted state is removed as well.
         *
         * @param {string} name
         * @param {Object=} additional optional metadata attached to the removal
         * @returns {Object} FeatureStorage
         */
        remove: function (name, additional) {
            _private.removeFeatureValue(name, additional);
            return this;
        },

        /**
         * Returns a shallow copy of all current feature values.
         *
         * @returns {Object.<string, *>}
         */
        all: function () {
            return _private.cloneObject(_private.currentFeatures);
        },

        /**
         * Returns metadata for one feature.
         *
         * Metadata shape:
         * {
         *   oldValue: *,
         *   newValue: *,
         *   additional: Object,
         *   changedAt: number
         * }
         *
         * @param {string} name
         * @returns {Object|null}
         */
        meta: function (name) {
            const normalizedName = _private.normalizeName(name);
            if (normalizedName === '') {
                return null;
            }

            return Object.prototype.hasOwnProperty.call(_private.currentFeatureMeta, normalizedName)
                ? _private.cloneFeatureMeta(_private.currentFeatureMeta[normalizedName])
                : null;
        },

        /**
         * Clears all current feature values, metadata and pending changes.
         *
         * Listener registrations and feature definitions are kept.
         * Persisted state is also removed.
         *
         * @returns {Object} FeatureStorage
         */
        clear: function () {
            if (_private.featureChangeTimer !== null) {
                clearTimeout(_private.featureChangeTimer);
                _private.featureChangeTimer = null;
            }

            Object.keys(_private.currentFeatures).forEach(function (name) {
                _private.removePersistedFeature(name);
            });

            _private.currentFeatures = {};
            _private.currentFeatureMeta = {};
            _private.pendingFeatureChanges = {};
            return this;
        },

        /**
         * Registers a global change listener.
         *
         * Called once per flush with payload:
         * {
         *   features: { [name]: any },
         *   changed: { [name]: { oldValue, newValue, additional, changedAt } },
         *   featureMeta: { [name]: { oldValue, newValue, additional, changedAt } }
         * }
         *
         * @param {Function} listener
         * @returns {Object} FeatureStorage
         */
        onChange: function (listener) {
            if (!$.isFunction(listener)) {
                return this;
            }

            if (_private.listeners.indexOf(listener) === -1) {
                _private.listeners.push(listener);
            }

            return this;
        },

        /**
         * Registers a listener for specific feature changes.
         *
         * @param {string|string[]} names feature name or list of feature names
         * @param {Function} listener
         * @param {Object=} options
         * @param {'batch'|'single'} [options.mode='batch']
         * @returns {Object} FeatureStorage
         *
         * batch mode (default):
         * - listener is called once per flush
         * - only if at least one of the registered features changed
         * - payload:
         *   {
         *     names: string[],
         *     matchedNames: string[],
         *     mode: 'batch',
         *     features: { [name]: any },
         *     changed: { [name]: { oldValue, newValue, additional, changedAt } },
         *     featureMeta: { [name]: { oldValue, newValue, additional, changedAt } }
         *   }
         *
         * single mode:
         * - listener is called once per changed feature
         * - payload:
         *   {
         *     name: string,
         *     value: *,
         *     meta: { oldValue, newValue, additional, changedAt }|null,
         *     change: { oldValue, newValue, additional, changedAt }|null,
         *     features: { [name]: any },
         *     changed: { [name]: { oldValue, newValue, additional, changedAt } },
         *     featureMeta: { [name]: { oldValue, newValue, additional, changedAt } }
         *   }
         */
        onFeatureChange: function (names, listener, options) {
            if (!$.isFunction(listener)) {
                return this;
            }

            const normalizedNames = _private.normalizeNames(names);
            if (normalizedNames.length === 0) {
                return this;
            }

            const normalizedOptions = _private.normalizeFeatureListenerOptions(options);
            const existingEntry = _private.featureListeners.find(function (entry) {
                return entry.listener === listener
                    && entry.options.mode === normalizedOptions.mode
                    && entry.names.length === normalizedNames.length
                    && entry.names.every(function (name, idx) {
                        return name === normalizedNames[idx];
                    });
            });

            if (!existingEntry) {
                _private.featureListeners.push({
                    names: normalizedNames,
                    listener: listener,
                    options: normalizedOptions
                });
            }

            return this;
        },

        /**
         * Removes a global change listener.
         *
         * @param {Function} listener
         * @returns {Object} FeatureStorage
         */
        offChange: function (listener) {
            _private.listeners = _private.listeners.filter(function (entry) {
                return entry !== listener;
            });
            return this;
        },

        /**
         * Removes feature-specific listeners.
         *
         * Behavior:
         * - if both `names` and `listener` are provided, removes the matching registration
         * - if only `names` are provided, removes all registrations for exactly those names
         * - if only `listener` is provided, removes all registrations for that listener
         *
         * @param {string|string[]=} names
         * @param {Function=} listener
         * @returns {Object} FeatureStorage
         */
        offFeatureChange: function (names, listener) {
            const normalizedNames = _private.normalizeNames(names);

            _private.featureListeners = _private.featureListeners.filter(function (entry) {
                if (!_private.isPlainObject(entry)) {
                    return false;
                }

                const listenerMatches = $.isFunction(listener) ? entry.listener === listener : true;
                const namesMatch = normalizedNames.length > 0
                    ? entry.names.length === normalizedNames.length &&
                    entry.names.every(function (name, idx) {
                        return name === normalizedNames[idx];
                    })
                    : true;

                return !(listenerMatches && namesMatch);
            });

            return this;
        },

        /**
         * Immediately flushes pending feature changes.
         *
         * @returns {Object} FeatureStorage
         */
        flush: function () {
            _private.flushFeatureChanges();
            return this;
        },

        /**
         * Reconciles all element watchers against the current DOM.
         *
         * @returns {Object} FeatureStorage
         */
        reconcile: function () {
            _private.ensureDomObserver();
            _private.reconcileAllWatchers();
            return this;
        }
    };

    // bind the module
    _plugin = Breinify.plugins._add('featureStorage', FeatureStorage);

    // restore persisted state silently after plugin registration
    _private.restorePersistedFeatures();
})();