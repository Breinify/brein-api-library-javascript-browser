"use strict";

(function () {
    const $ = Breinify.UTL._jquery();

    const _private = {
        consoleEvents: {
            entries: [],
            activityTypes: Object.create(null),
            readyObserved: false,

            formatPayload: function (payload) {
                try {
                    const formattedPayload = JSON.stringify(payload, null, 2);
                    return typeof formattedPayload === 'string' ? formattedPayload : String(payload);
                } catch (error) {
                    return 'Unable to format event payload.';
                }
            },

            record: function (type, title, payload) {
                this.entries.unshift({
                    type: type,
                    title: title,
                    timestamp: new Date(),
                    payload: this.formatPayload(payload)
                });

                if (this.entries.length > 100) {
                    this.entries.pop();
                }

                $(document).trigger('breinifyDevStudioConsoleChanged');
            },

            watchActivity: function (activityType) {
                const eventName = 'breinifyActivity[' + activityType + ']';
                if (this.activityTypes[eventName] === true) {
                    return;
                }

                this.activityTypes[eventName] = true;
                $(document).on(eventName, (event, payload) => {
                    this.record('activity', activityType, payload);
                });
            },

            install: function () {
                const originalActivityUser = Breinify.activityUser;
                Breinify.activityUser = function () {
                    const args = Array.prototype.slice.call(arguments);
                    const activityType = args[1] === null || typeof args[1] === 'undefined'
                        ? 'null'
                        : String(args[1]);
                    const onReady = args[6];

                    if ($.isFunction(onReady)) {
                        args[6] = function () {
                            _private.consoleEvents.watchActivity(activityType);
                            return onReady.apply(this, arguments);
                        };
                    }

                    return originalActivityUser.apply(this, args);
                };

                Breinify.onReady(() => {
                    if (this.readyObserved !== true) {
                        this.readyObserved = true;
                        this.record('ready', 'Breinify ready', null);
                    }
                });
            }
        },

        pluginLifecycle: {
            states: Object.create(null),

            get: function (name) {
                if (!Object.prototype.hasOwnProperty.call(this.states, name)) {
                    this.states[name] = {
                        bound: 0,
                        setup: 0,
                        added: 0,
                        error: null,
                        watched: false,
                        inferred: {
                            bound: false,
                            setup: false,
                            added: false
                        },
                        notApplicable: {
                            setup: false
                        }
                    };
                }

                return this.states[name];
            },

            watch: function (name) {
                const state = this.get(name);
                if (state.watched === true) {
                    return;
                }

                state.watched = true;
                $(document).on('breinifyPlugInBound[' + name + ']', () => this.record(name, 'bound'));
                $(document).on('breinifyPlugInSetup[' + name + ']', () => this.record(name, 'setup'));
                $(document).on('breinifyPlugInAdded[' + name + ']', () => this.record(name, 'added'));
            },

            record: function (name, lifecycle) {
                const state = this.get(name);
                state[lifecycle]++;
                $(document).trigger('breinifyDevStudioPluginLifecycleChanged');
            },

            hydrate: function (name, plugin) {
                if (!$.isPlainObject(plugin)) {
                    return;
                }

                const state = this.get(name);
                if (state.bound === 0) {
                    state.bound = 1;
                    state.inferred.bound = true;
                }
                if (state.added === 0) {
                    state.added = 1;
                    state.inferred.added = true;
                }

                if ($.isFunction(plugin.setup)) {
                    if (plugin._setupDone === true && state.setup === 0) {
                        state.setup = 1;
                        state.inferred.setup = true;
                    }
                } else {
                    state.notApplicable.setup = true;
                }
            },

            recordError: function (name, error) {
                const state = this.get(name);
                state.error = error instanceof Error && typeof error.message === 'string'
                    ? error.message
                    : 'Plugin initialization failed.';
                $(document).trigger('breinifyDevStudioPluginLifecycleChanged');
            },

            install: function () {
                Object.keys(Breinify.plugins)
                    .filter(name => name.charAt(0) !== '_' && $.isPlainObject(Breinify.plugins[name]))
                    .forEach(name => {
                        this.watch(name);
                        this.hydrate(name, Breinify.plugins[name]);
                    });

                const originalAdd = Breinify.plugins._add;
                Breinify.plugins._add = function () {
                    const name = arguments[0];
                    if (typeof name === 'string') {
                        _private.pluginLifecycle.watch(name);
                    }

                    try {
                        const plugin = originalAdd.apply(this, arguments);
                        if (typeof name === 'string') {
                            _private.pluginLifecycle.hydrate(name, plugin);
                        }
                        return plugin;
                    } catch (error) {
                        if (typeof name === 'string') {
                            _private.pluginLifecycle.recordError(name, error);
                        }

                        throw error;
                    }
                };
            }
        },

        inspectEvents: {
            renderedRecommendations: new WeakMap(),

            install: function () {
                $(document).on('renderedRecommendation', (event, settings) => {
                    const container = settings?.$recContainer;
                    const element = container?.jquery && container.length > 0 ? container.get(0) : null;
                    if (element === null || element.nodeType !== 1) {
                        return;
                    }

                    this.renderedRecommendations.set(element, {
                        isControl: settings.isControl === true,
                        recommendationData: settings.recommendationData,
                        recommendationResult: settings.recommendationResult,
                        activityTags: settings.activityTags,
                        option: settings.option
                    });
                    $(document).trigger('breinifyDevStudioInspectDataChanged', [element]);
                });
            },

            getRenderedRecommendation: function (nodes) {
                for (let index = 0; index < nodes.length; index++) {
                    const data = this.renderedRecommendations.get(nodes[index]);
                    if (typeof data !== 'undefined') {
                        return data;
                    }
                }

                return null;
            }
        },

        copyText: function (value) {
            try {
                if (navigator.clipboard && $.isFunction(navigator.clipboard.writeText)) {
                    return navigator.clipboard.writeText(value);
                }

                const textarea = document.createElement('textarea');
                textarea.value = value;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();

                const copied = document.execCommand('copy');
                document.body.removeChild(textarea);

                return copied === true
                    ? Promise.resolve()
                    : Promise.reject(new Error('Unable to copy the value.'));
            } catch (error) {
                return Promise.reject(error);
            }
        },

        resizable: function ($shadowRoot) {
            const $body = $('body');

            const $resizeHandle = $shadowRoot.find('#resize-handle').data('isResizing', false);
            $resizeHandle.mousedown(e => {
                $resizeHandle.data({
                    isResizing: true,
                    startX: e.clientX,
                    startWidth: $resizeHandle.parent()[0].getBoundingClientRect().width
                });

                $body.css('user-select', 'none');
                e.preventDefault();
            });
            $(document).on('mouseup blur', () => {
                if ($resizeHandle.data('isResizing') === true) {
                    $resizeHandle.data('isResizing', false);
                    $body.css('user-select', '');
                }
            });
            $(document).mousemove(e => {
                if (!$resizeHandle.data('isResizing') === true) {
                    return;
                }

                const startWidth = $resizeHandle.data('startWidth');
                const dx = $resizeHandle.data('startX') - e.clientX;
                const newWidth = Math.min(Math.max(startWidth + dx, 200), 1000);

                $resizeHandle.parent().css('width', newWidth + 'px');
            });
        }
    };

    _private.consoleEvents.install();
    _private.pluginLifecycle.install();
    _private.inspectEvents.install();

    class BreinifyDevConsole extends HTMLElement {
        $shadowRoot = null;
        $toggleButton = null;
        $panel = null;
        $closeBtn = null;
        $tabs = null;

        $logContainer = null;
        $infoContainer = null;
        $userContainer = null;
        $splitTestsContainer = null;
        $inspectContainer = null;
        $payloadModal = null;
        $payloadModalTitle = null;
        $payloadModalContent = null;

        userLastFetched = null;
        splitTestsLastFetched = null;
        activeTab = 'console';
        inspectActive = false;
        inspectHoverElement = null;
        inspectPinnedElement = null;
        inspectPointerMoveHandler = null;

        constructor() {
            super();

            this.attachShadow({mode: 'open'});

            // SVG brein icon (16x16)
            this.isVisible = true;

            this.render();
            this.toggleDevStudio();
        }

        render() {
            this.shadowRoot.innerHTML = `
            <style>
                :host { all: initial; }
                div.title { display: flex; flex-flow: row; font-weight: bold; font-size: 14px; line-height: 14px; padding: 6px 10px; }
                button.close-btn { background: transparent; border: none; color: #ccc; font-size: 18px; cursor: pointer; padding: 0 6px; user-select: none; }
                button.close-btn:hover { color: white; }
                #panel { position: fixed; bottom: 0; right: 0; width: 400px; height: 80vh; max-height: 1000px; font-family: monospace; font-size: 12px; color: #fff; background: #1e1e1e; box-shadow: 0 0 10px rgba(0,0,0,0.5); border-top-left-radius: 6px; display: flex; flex-direction: column; z-index: 9999998; transition: transform 0.2s ease-out, opacity 0.2s ease-out; overflow: hidden; }
                #resize-handle { position: absolute; left: 0; top: 0; width: 6px; height: 100%; cursor: ew-resize; z-index: 9999999; }
                #resize-handle:hover { background: rgba(255, 255, 255, 0.1); }
                header { background: #111; padding: 6px 10px; display: flex; align-items: center; user-select: none; border-top-left-radius: 6px; color: #eee; }
                header > .tabs { display: flex; gap: 5px; flex-grow: 1; overflow-x: auto; }
                header button.tab { background: transparent; border: none; color: #ccc; cursor: pointer; flex: 0 0 auto; padding: 4px 6px; font-size: 12px; border-bottom: 2px solid transparent; transition: border-color 0.15s ease; white-space: nowrap; }
                header button.tab.active { border-bottom-color: #fff; color: white; }
                header button.tab:hover:not(.active) { color: #fff; }
                div.container { display: none; flex-grow: 1; background: #1e1e1e; padding: 10px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; color: white; }
                div.container.active { display: block; }
                div.user-header { align-items: center; display: flex; justify-content: space-between; margin-bottom: 16px; }
                div.user-last-fetched { color: #bbbbbb; font-size: 11px; }
                button.refresh-btn, button.copy-btn { background: #2a2a2a; border: 1px solid #4fc3f7; border-radius: 4px; color: #4fc3f7; cursor: pointer; font-family: inherit; }
                button.refresh-btn { padding: 5px 8px; }
                button.copy-btn { font-size: 14px; line-height: 18px; margin-left: 8px; min-width: 28px; padding: 1px 5px; }
                button.refresh-btn:hover, button.copy-btn:hover { background: #333; color: #fff; }
                button.refresh-btn:disabled, button.copy-btn:disabled { cursor: default; opacity: 0.65; }
                div.user-field { background: linear-gradient(to bottom, #2a2a2a, #1f1f1f); border: 1px solid #333; border-left: 4px solid #4fc3f7; border-radius: 4px; margin-bottom: 8px; padding: 8px 10px; }
                div.user-field-label { color: #bbbbbb; font-size: 11px; font-weight: bold; letter-spacing: 0.04em; margin-bottom: 4px; text-transform: uppercase; }
                div.user-field-value { align-items: center; color: #fff; display: flex; justify-content: space-between; }
                div.user-field-value span { flex-grow: 1; min-width: 0; }
                div.user-empty { color: #bbbbbb; font-style: italic; }
                div.split-tests-section { margin-top: 16px; }
                div.split-tests-title { color: #bbbbbb; font-size: 11px; font-weight: bold; letter-spacing: 0.04em; margin-bottom: 6px; text-transform: uppercase; }
                div.split-test { background: linear-gradient(to bottom, #2a2a2a, #1f1f1f); border: 1px solid #333; border-left: 4px solid #ffb74d; border-radius: 4px; margin-bottom: 6px; padding: 8px 10px; }
                div.split-test-name { color: #ffcc80; font-weight: bold; margin-bottom: 5px; }
                div.split-test-details { color: #ddd; display: flex; flex-wrap: wrap; gap: 5px 10px; }
                span.split-test-detail-label { color: #bbbbbb; }
                div.console-empty { color: #bbbbbb; font-style: italic; }
                div.console-entry { background: linear-gradient(to bottom, #2a2a2a, #1f1f1f); border: 1px solid #333; border-left: 4px solid #4fc3f7; border-radius: 4px; margin-bottom: 8px; padding: 8px 10px; }
                div.console-entry.ready { border-left-color: #ab47bc; }
                div.console-entry-header { align-items: center; display: flex; gap: 7px; }
                span.console-event-icon { background: #0277bd; border-radius: 50%; display: inline-block; flex: 0 0 auto; height: 8px; width: 8px; }
                div.console-entry.ready span.console-event-icon { background: #ab47bc; }
                span.console-title { color: #fff; flex-grow: 1; font-weight: bold; }
                span.console-timestamp { color: #bbbbbb; font-size: 11px; }
                div.console-toolbar { display: flex; gap: 6px; margin-top: 7px; }
                button.console-action-btn { background: transparent; border: 1px solid #4fc3f7; border-radius: 3px; color: #4fc3f7; cursor: pointer; font-family: inherit; font-size: 11px; padding: 3px 6px; }
                button.console-action-btn:hover { background: #333; color: #fff; }
                div.console-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
                span.console-tag { background: #172f3b; border: 1px solid #285269; border-radius: 3px; color: #d7effa; font-size: 11px; max-width: 100%; overflow: hidden; padding: 3px 5px; text-overflow: ellipsis; white-space: nowrap; }
                span.console-tag-key { color: #8ed1ed; }
                div.inspect-header { align-items: center; display: flex; gap: 8px; margin-bottom: 10px; }
                div.inspect-mode { color: #bbbbbb; flex-grow: 1; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                button.inspect-pin-btn { background: transparent; border: 1px solid #ffb74d; border-radius: 3px; color: #ffcc80; cursor: pointer; flex: 0 0 auto; font-family: inherit; font-size: 11px; padding: 3px 6px; }
                button.inspect-pin-btn:hover { background: #333; color: #fff; }
                div.inspect-status { background: #2a2a2a; border: 1px solid #444; border-left: 4px solid #777; border-radius: 4px; color: #ddd; margin-bottom: 10px; padding: 8px 10px; }
                div.inspect-status.breinify { border-left-color: #43a047; color: #d8f4db; }
                div.inspect-status.error { border-left-color: #ef5350; color: #ffcdd2; }
                div.inspect-target { color: #bbbbbb; font-size: 11px; margin-bottom: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                div.inspect-component { background: linear-gradient(to bottom, #2a2a2a, #1f1f1f); border: 1px solid #333; border-left: 4px solid #66bb6a; border-radius: 4px; margin-bottom: 8px; padding: 8px 10px; }
                div.inspect-component-name { color: #fff; font-weight: bold; margin-bottom: 5px; }
                div.inspect-component-detail { color: #ddd; margin-top: 3px; }
                span.inspect-component-label { color: #bbbbbb; }
                button.inspect-data-btn { background: transparent; border: 1px solid #66bb6a; border-radius: 3px; color: #a5d6a7; cursor: pointer; font-family: inherit; font-size: 11px; margin-top: 8px; padding: 3px 6px; }
                button.inspect-data-btn:hover { background: #333; color: #fff; }
                #payload-modal { align-items: center; background: rgba(0, 0, 0, 0.68); color: #fff; display: none; font-family: monospace; font-size: 12px; inset: 0; justify-content: center; padding: 24px; position: fixed; z-index: 10000000; }
                #payload-modal.visible { display: flex; }
                div.payload-dialog { background: #202020; border: 1px solid #4a4a4a; border-radius: 7px; box-shadow: 0 8px 30px rgba(0,0,0,0.65); display: flex; flex-direction: column; height: min(720px, calc(100vh - 48px)); max-width: 900px; width: min(900px, calc(100vw - 48px)); }
                div.payload-dialog-header { align-items: center; border-bottom: 1px solid #3b3b3b; display: flex; gap: 8px; padding: 10px 12px; }
                div.payload-dialog-title { color: #fff; flex-grow: 1; font-size: 13px; font-weight: bold; }
                button.payload-close-btn { background: transparent; border: none; color: #ccc; cursor: pointer; font-size: 19px; line-height: 18px; padding: 0 4px; }
                button.payload-close-btn:hover { color: #fff; }
                div.payload-dialog-content { overflow: auto; padding: 12px; }
                div.payload-dialog-content pre { background: #151515; border-radius: 4px; color: #ddd; margin: 0; min-height: calc(100% - 24px); padding: 12px; white-space: pre-wrap; word-break: break-word; }
                div.info-section { margin-bottom: 16px; }
                div.info-label { color: #bbbbbb; font-size: 11px; font-weight: bold; letter-spacing: 0.04em; margin-bottom: 5px; text-transform: uppercase; }
                div.info-value { color: #4fc3f7; font-size: 14px; }
                ul.plugin-list { list-style: none; margin: 0; padding: 0; }
                ul.plugin-list li { background: linear-gradient(to bottom, #2a2a2a, #1f1f1f); border: 1px solid #333; border-left: 4px solid #4fc3f7; border-radius: 4px; color: #fff; margin-bottom: 6px; padding: 8px 10px; }
                div.plugin-header { align-items: center; display: flex; gap: 10px; }
                div.plugin-name { flex-grow: 1; font-weight: bold; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                div.plugin-lifecycle { display: flex; flex: 0 0 auto; gap: 5px; margin-left: auto; }
                span.lifecycle-marker { align-items: center; background: #555; border-radius: 50%; color: #ddd; cursor: help; display: inline-flex; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; height: 18px; justify-content: center; width: 18px; }
                span.lifecycle-marker:hover { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25); }
                span.lifecycle-marker.observed { background: #2e7d32; color: #fff; }
                span.lifecycle-marker.error { background: #c62828; color: #fff; }
                span.plugin-error { color: #ff8a80; display: inline-block; margin-top: 6px; }
                #toggle-button { position: fixed; bottom: 10px; right: 10px; width: 32px; height: 32px; background: #333; border-radius: 50%; align-items: center; justify-content: center; cursor: pointer; z-index: 9999998; box-shadow: 0 0 5px rgba(0,0,0,0.3); transition: opacity 0.2s ease-out; display: none; }
                #toggle-button:hover svg path { fill: #ccc; }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-thumb { background: #888; border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: #555; }
            </style>
            <div id="panel">
                <div id="resize-handle"></div>
                <div class="title">
                    <div style="flex-grow: 1; align-content: center;">Breinify DevStudio</div>
                    <button class="close-btn" title="Hide Breinify DevStudio">&#x2715;</button>
                </div>
                <header>
                    <div class="tabs">
                        <button class="tab active" data-tab="console">Console</button>
                        <button class="tab" data-tab="info">Info</button>
                        <button class="tab" data-tab="user">User</button>
                        <button class="tab" data-tab="split-tests">Split Tests</button>
                        <button class="tab" data-tab="inspect">Inspect</button>
                    </div>
                </header>
                <div id="log-container" class="container active"></div>
                <div id="info-container" class="container"></div>
                <div id="user-container" class="container"></div>
                <div id="split-tests-container" class="container"></div>
                <div id="inspect-container" class="container"></div>
            </div>
            <div id="payload-modal" role="presentation" aria-hidden="true">
                <div class="payload-dialog" role="dialog" aria-modal="true" aria-labelledby="payload-modal-title">
                    <div class="payload-dialog-header">
                        <div id="payload-modal-title" class="payload-dialog-title">Event payload</div>
                        <button class="copy-btn payload-copy-btn" type="button" title="Copy payload" aria-label="Copy payload">&#10697;</button>
                        <button class="payload-close-btn" type="button" title="Close payload" aria-label="Close payload">&#x2715;</button>
                    </div>
                    <div class="payload-dialog-content"><pre></pre></div>
                </div>
            </div>
            <div id="toggle-button" title="Show Breinify DevStudio" role="button" tabindex="0"><svg xmlns="http://www.w3.org/2000/svg" fill="white" width="16" height="16" viewBox="0 0 24 24"><path d="M12 2C8.1 2 6 4.4 6 7v5c0 .5-.2.9-.5 1.3-.3.4-.5.9-.5 1.4v.3c.1.6.5 1.1 1 1.5.5.4.8 1 .8 1.6 0 .6.2 1.1.5 1.5s.7.7 1.2.9V21c0 .6.4 1 1 1s1-.4 1-1v-1h2v1c0 .6.4 1 1 1s1-.4 1-1v-1.5c.5-.2.9-.5 1.2-.9s.5-.9.5-1.5c0-.6.3-1.2.8-1.6.5-.4.9-.9 1-1.5v-.3c0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.3V7c0-2.6-2.1-5-6-5z"/></svg></div>`;

            this.$shadowRoot = $(this.shadowRoot);
            this.$toggleButton = this.$shadowRoot.find('#toggle-button');
            this.$panel = this.$shadowRoot.find('#panel');
            this.$closeBtn = this.$shadowRoot.find('button.close-btn');
            this.$tabs = this.$shadowRoot.find('button.tab');

            this.$logContainer = this.$shadowRoot.find('#log-container');
            this.$infoContainer = this.$shadowRoot.find('#info-container');
            this.$userContainer = this.$shadowRoot.find('#user-container');
            this.$splitTestsContainer = this.$shadowRoot.find('#split-tests-container');
            this.$inspectContainer = this.$shadowRoot.find('#inspect-container');
            this.$payloadModal = this.$shadowRoot.find('#payload-modal');
            this.$payloadModalTitle = this.$shadowRoot.find('#payload-modal-title');
            this.$payloadModalContent = this.$shadowRoot.find('.payload-dialog-content pre');

            this.$closeBtn.click(() => this.toggleDevStudio());
            this.$toggleButton.click(() => this.toggleDevStudio());
            this.$shadowRoot.find('button.payload-close-btn').click(() => this._closePayloadModal());
            this.$payloadModal.click(event => {
                if (event.target === this.$payloadModal[0]) {
                    this._closePayloadModal();
                }
            });

            this.$tabs.click(e => this._switchTab(e));
            $(document).on('breinifyDevStudioPluginLifecycleChanged', () => {
                if (this.$infoContainer.hasClass('active')) {
                    this._refreshInfo();
                }
            });
            $(document).on('breinifyDevStudioConsoleChanged', () => {
                if (this.$logContainer.hasClass('active')) {
                    this._renderConsole();
                }
            });
            $(document).on('breinifyDevStudioInspectDataChanged', (event, container) => {
                const inspectionElement = this.inspectPinnedElement || this.inspectHoverElement;
                if (this.inspectActive === true &&
                    inspectionElement !== null &&
                    container !== null &&
                    container.contains(inspectionElement)) {
                    this._renderInspect(inspectionElement);
                }
            });

            this._renderConsole();
            _private.resizable(this.$shadowRoot);
        }

        toggleDevStudio() {
            this.isVisible = !this.isVisible;

            if (this.isVisible) {
                this.$panel.css('transform', 'translateY(0)');
                this.$panel.css('opacity', '1');
                this.$toggleButton.css('display', 'none');
                if (this.activeTab === 'inspect') {
                    this._startInspecting();
                }
            } else {
                this.$panel.css('transform', 'translateY(100%)');
                this.$panel.css('opacity', '0');
                this.$toggleButton.css('display', 'flex');
                this._stopInspecting();
            }
        }

        _formatConsoleTimestamp(timestamp) {
            return timestamp.toLocaleTimeString();
        }

        _getConsoleActivityTags(entry) {
            if (entry.type !== 'activity') {
                return null;
            }

            try {
                const payload = JSON.parse(entry.payload);
                const tags = payload !== null && $.isPlainObject(payload.activity) && $.isPlainObject(payload.activity.tags)
                    ? payload.activity.tags
                    : null;

                return tags === null ? null : tags;
            } catch (error) {
                return null;
            }
        }

        _formatConsoleTagValue(value) {
            if ($.isPlainObject(value) || $.isArray(value)) {
                return JSON.stringify(value);
            }

            return String(value);
        }

        _openPayloadModal(entry) {
            this._openJsonModal(
                entry.type === 'activity' ? entry.title + ' payload' : 'Breinify ready payload',
                entry.payload
            );
        }

        _openJsonModal(title, data) {
            const formattedData = typeof data === 'string'
                ? data
                : _private.consoleEvents.formatPayload(data);
            this.$payloadModalTitle.text(title);
            this.$payloadModalContent.text(formattedData);
            this.$payloadModal.find('button.payload-copy-btn').off('click').click(() => {
                this._copyValue(formattedData, 'payload', this.$payloadModal.find('button.payload-copy-btn'));
            });
            this.$payloadModal.addClass('visible').attr('aria-hidden', 'false');
        }

        _closePayloadModal() {
            this.$payloadModal.removeClass('visible').attr('aria-hidden', 'true');
        }

        _renderConsole() {
            this.$logContainer.empty();

            if (_private.consoleEvents.entries.length === 0) {
                this.$logContainer.append($('<div class="console-empty">No SDK events observed yet.</div>'));
                return;
            }

            _private.consoleEvents.entries.forEach(entry => {
                const $entry = $('<div class="console-entry"></div>').addClass(entry.type);
                const $header = $('<div class="console-entry-header"></div>');
                const tags = this._getConsoleActivityTags(entry);

                $header.append($('<span class="console-event-icon"></span>').attr('title', entry.type === 'activity' ? 'Activity event' : 'Breinify ready'));
                $header.append($('<span class="console-title"></span>').text(entry.title));
                $header.append($('<span class="console-timestamp"></span>').text(this._formatConsoleTimestamp(entry.timestamp)));
                $entry.append($header);

                if (entry.type === 'activity') {
                    const $toolbar = $('<div class="console-toolbar"></div>');
                    let $tags = null;
                    let tagCount = 0;

                    if (tags !== null) {
                        $tags = $('<div class="console-tags"></div>').hide();
                        Object.keys(tags).forEach(key => {
                            if (tags[key] === null || typeof tags[key] === 'undefined') {
                                return;
                            }

                            const value = this._formatConsoleTagValue(tags[key]);
                            const text = key + ': ' + value;
                            $tags.append($('<span class="console-tag"></span>')
                                .attr('title', text)
                                .append($('<span class="console-tag-key"></span>').text(key + ': '))
                                .append(document.createTextNode(value)));
                            tagCount++;
                        });
                    }

                    if (tagCount > 0) {
                        const $tagsButton = $('<button class="console-action-btn" type="button"></button>').text('Show tags (' + tagCount + ')');
                        $tagsButton.click(() => {
                            const areTagsVisible = $tags.is(':visible');
                            $tags.toggle(!areTagsVisible);
                            $tagsButton.text(areTagsVisible ? 'Show tags (' + tagCount + ')' : 'Hide tags');
                        });
                        $toolbar.append($tagsButton);
                    }

                    const $payloadButton = $('<button class="console-action-btn" type="button">View payload</button>');
                    $payloadButton.click(() => this._openPayloadModal(entry));
                    $toolbar.append($payloadButton);
                    $entry.append($toolbar);

                    if ($tags !== null && tagCount > 0) {
                        $entry.append($tags);
                    }
                }
                this.$logContainer.append($entry);
            });
        }

        _startInspecting() {
            if (this.inspectActive === true) {
                return;
            }

            this.inspectActive = true;
            this.inspectHoverElement = null;
            this.inspectPinnedElement = null;
            this._renderInspect(null);
            this.inspectPointerMoveHandler = event => {
                try {
                    if (this.inspectPinnedElement !== null) {
                        return;
                    }

                    const element = this._getInspectHoverElement(event);
                    if (typeof element === 'undefined') {
                        return;
                    }
                    if (element === this.inspectHoverElement) {
                        return;
                    }

                    this.inspectHoverElement = element;
                    this._renderInspect(element);
                } catch (error) {
                    this._renderInspectError(error);
                }
            };
            document.addEventListener('pointermove', this.inspectPointerMoveHandler, true);
            document.addEventListener('mousemove', this.inspectPointerMoveHandler, true);
            document.addEventListener('mouseover', this.inspectPointerMoveHandler, true);
        }

        _stopInspecting() {
            if (this.inspectActive !== true) {
                return;
            }

            document.removeEventListener('pointermove', this.inspectPointerMoveHandler, true);
            document.removeEventListener('mousemove', this.inspectPointerMoveHandler, true);
            document.removeEventListener('mouseover', this.inspectPointerMoveHandler, true);
            this.inspectActive = false;
            this.inspectHoverElement = null;
            this.inspectPinnedElement = null;
            this.inspectPointerMoveHandler = null;
        }

        _getInspectHoverElement(event) {
            const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
            if (eventPath.indexOf(this) !== -1) {
                return undefined;
            }

            const elementAtPointer = typeof event.clientX === 'number' && typeof event.clientY === 'number' &&
            typeof document.elementFromPoint === 'function'
                ? document.elementFromPoint(event.clientX, event.clientY)
                : null;
            if (elementAtPointer !== null) {
                const root = typeof elementAtPointer.getRootNode === 'function'
                    ? elementAtPointer.getRootNode()
                    : null;
                if (elementAtPointer === this || this.contains(elementAtPointer) || root?.host === this) {
                    return undefined;
                }
                return elementAtPointer;
            }

            if (event.target !== null && event.target.nodeType === 1) {
                return event.target;
            } else if (event.target !== null && event.target.parentElement !== null) {
                return event.target.parentElement;
            }

            return null;
        }

        _getInspectNodes(element) {
            const nodes = [];
            let current = element;

            while (current !== null && current.nodeType === 1) {
                nodes.push(current);
                if (current.parentElement !== null) {
                    current = current.parentElement;
                    continue;
                }

                const root = current.getRootNode();
                const host = root !== null && typeof root.host !== 'undefined' ? root.host : null;
                current = host !== null && host.nodeType === 1 ? host : null;
            }

            return nodes;
        }

        _getInspectElementDescription(element) {
            const tagName = element.tagName.toLowerCase();
            const identifier = typeof element.id === 'string' && element.id !== '' ? '#' + element.id : '';
            const classes = element.classList.length === 0
                ? ''
                : '.' + Array.prototype.slice.call(element.classList, 0, 3).join('.');
            return '<' + tagName + identifier + classes + '>';
        }

        _readInspectDataPath(data, path) {
            if (typeof path !== 'string' || path === '') {
                return data;
            }

            return path.split('.').reduce((current, key) => {
                if (current === null || typeof current === 'undefined') {
                    return null;
                }

                return Object.prototype.hasOwnProperty.call(current, key) ? current[key] : null;
            }, data);
        }

        _getInspectComponent(node, marker, nodes) {
            const details = {};
            const attributes = $.isArray(marker.attributes) ? marker.attributes : [];
            const dataConfig = $.isPlainObject(marker.data) ? marker.data : null;
            let data = null;

            attributes.forEach(attribute => {
                if (!$.isPlainObject(attribute) || typeof attribute.name !== 'string' || node.hasAttribute(attribute.name) === false) {
                    return;
                }

                details[attribute.label || attribute.name] = node.getAttribute(attribute.name);
            });

            if (dataConfig !== null && typeof dataConfig.jqueryKey === 'string') {
                data = this._readInspectDataPath($(node).data(dataConfig.jqueryKey), dataConfig.path);
                data = typeof data === 'undefined' ? null : data;
                const fields = $.isArray(dataConfig.fields) ? dataConfig.fields : [];
                fields.forEach(field => {
                    if (!$.isPlainObject(field) || typeof field.path !== 'string') {
                        return;
                    }

                    const value = this._readInspectDataPath(data, field.path);
                    if (value !== null && typeof value !== 'undefined' && typeof value !== 'object') {
                        details[field.label || field.path] = value;
                    }
                });
            }

            if (marker.type === 'carousel') {
                details.Items = node.querySelectorAll('.br-simple-slider__item').length;
            } else if (marker.type === 'carouselItem') {
                const carousel = typeof marker.parentSelector === 'string'
                    ? nodes.find(parent => parent.matches(marker.parentSelector))
                    : undefined;
                const items = carousel === undefined ? [] : carousel.querySelectorAll('.br-simple-slider__item');
                const index = Array.prototype.indexOf.call(items, node);
                if (index !== -1) {
                    details.Slide = (index + 1) + ' of ' + items.length;
                }
            }

            return {
                name: marker.name,
                details: details,
                data: data,
                dataTitle: dataConfig !== null && typeof dataConfig.viewTitle === 'string'
                    ? dataConfig.viewTitle
                    : null
            };
        }

        _getInspectEventComponent(nodes) {
            const config = $.isPlainObject(DevStudio.inspectConfig?.events?.renderedRecommendation)
                ? DevStudio.inspectConfig.events.renderedRecommendation
                : null;
            const eventData = _private.inspectEvents.getRenderedRecommendation(nodes);
            if (config === null || eventData === null) {
                return null;
            }

            const details = {};
            const fields = $.isArray(config.fields) ? config.fields : [];
            fields.forEach(field => {
                if (!$.isPlainObject(field) || typeof field.path !== 'string') {
                    return;
                }

                const value = this._readInspectDataPath(eventData, field.path);
                if (value !== null && typeof value !== 'undefined' && typeof value !== 'object') {
                    details[field.label || field.path] = value;
                }
            });

            return {
                name: eventData.isControl === true && typeof config.controlName === 'string'
                    ? config.controlName
                    : config.name,
                details: details,
                data: this._readInspectDataPath(eventData, config.viewPath),
                dataTitle: typeof config.viewTitle === 'string' ? config.viewTitle : null
            };
        }

        _getInspectComponents(element) {
            const nodes = this._getInspectNodes(element);
            const markers = $.isArray(DevStudio.inspectConfig?.markers) ? DevStudio.inspectConfig.markers : [];
            const components = [];

            nodes.forEach(node => {
                markers.forEach(marker => {
                    if ($.isPlainObject(marker) && typeof marker.selector === 'string' && node.matches(marker.selector)) {
                        components.push(this._getInspectComponent(node, marker, nodes));
                    }
                });
            });

            const eventComponent = this._getInspectEventComponent(nodes);
            if (eventComponent !== null) {
                components.unshift(eventComponent);
            }

            return components;
        }

        _summarizeInspectComponents(components) {
            const item = components.find(component => component.name === 'Breinify recommendation item');
            if (typeof item === 'undefined') {
                return components;
            }

            const summary = {
                name: 'Breinify recommendation item',
                details: {},
                data: item.data,
                dataTitle: item.dataTitle
            };
            const addDetails = (details, prefix) => {
                Object.keys(details).forEach(label => {
                    const summaryLabel = prefix === null ? label : prefix + ' ' + label.toLowerCase();
                    if (typeof summary.details[summaryLabel] === 'undefined') {
                        summary.details[summaryLabel] = details[label];
                    }
                });
            };

            components.forEach(component => {
                if (component === item) {
                    addDetails(component.details, null);
                } else if (component.name === 'Breinify carousel item') {
                    addDetails(component.details, 'Carousel');
                } else if (component.name === 'Breinify carousel') {
                    addDetails(component.details, 'Carousel');
                } else if (component.name === 'Breinify recommendation render') {
                    addDetails(component.details, null);
                } else if (component.name.indexOf('Observed Breinify recommendation') === 0) {
                    addDetails(component.details, 'Render');
                } else if (component.name === 'Breinify recommendation control group') {
                    addDetails(component.details, 'Control');
                }
            });

            return [summary];
        }

        _renderInspectHeader(element) {
            const $header = $('<div class="inspect-header"></div>');
            const isPinned = this.inspectPinnedElement !== null;
            const message = isPinned
                ? 'Inspect mode is pinned.'
                : 'Inspect mode is on. Move over page content to inspect it.';

            $header.append($('<div class="inspect-mode"></div>').text(message));
            if (element !== null) {
                const $pinButton = $('<button class="inspect-pin-btn" type="button"></button>')
                    .text(isPinned ? 'Unpin' : 'Pin current');
                $pinButton.click(() => this._toggleInspectPin());
                $header.append($pinButton);
            }

            this.$inspectContainer.append($header);
        }

        _toggleInspectPin() {
            if (this.inspectPinnedElement !== null) {
                this.inspectPinnedElement = null;
                this._renderInspect(this.inspectHoverElement);
            } else if (this.inspectHoverElement !== null) {
                this.inspectPinnedElement = this.inspectHoverElement;
                this._renderInspect(this.inspectPinnedElement);
            }
        }

        _renderInspect(element) {
            this.$inspectContainer.empty();
            this._renderInspectHeader(element);

            if (element === null) {
                this.$inspectContainer.append($('<div class="inspect-status">Hover an element outside Dev Studio.</div>'));
                return;
            }

            const components = this._summarizeInspectComponents(this._getInspectComponents(element));
            this.$inspectContainer.append($('<div class="inspect-target"></div>').text('Hovered: ' + this._getInspectElementDescription(element)));
            if (components.length === 0) {
                this.$inspectContainer.append($('<div class="inspect-status">This is not a recognized Breinify UI element.</div>'));
                return;
            }

            this.$inspectContainer.append($('<div class="inspect-status breinify">Breinify-generated UI detected.</div>'));
            components.forEach(component => {
                const $component = $('<div class="inspect-component"></div>');
                $component.append($('<div class="inspect-component-name"></div>').text(component.name));
                Object.keys(component.details).forEach(label => {
                    const $detail = $('<div class="inspect-component-detail"></div>');
                    $detail.append($('<span class="inspect-component-label"></span>').text(label + ': '));
                    $detail.append(document.createTextNode(String(component.details[label])));
                    $component.append($detail);
                });
                if (component.data !== null && component.dataTitle !== null) {
                    const $dataButton = $('<button class="inspect-data-btn" type="button">View data</button>');
                    $dataButton.click(() => this._openJsonModal(component.dataTitle, component.data));
                    $component.append($dataButton);
                }
                this.$inspectContainer.append($component);
            });
        }

        _renderInspectError(error) {
            const message = error instanceof Error && typeof error.message === 'string' && error.message !== ''
                ? error.message
                : 'An unknown error occurred while inspecting this element.';
            this.$inspectContainer.empty();
            this._renderInspectHeader(this.inspectPinnedElement || this.inspectHoverElement);
            this.$inspectContainer.append($('<div class="inspect-status error"></div>')
                .text('Inspection error: ' + message)
                .attr('title', error instanceof Error && typeof error.stack === 'string' ? error.stack : message));
        }

        _refreshInfo() {
            const version = typeof Breinify.version === 'string' && Breinify.version.trim() !== ''
                ? Breinify.version
                : 'Unknown';
            const pluginNames = Object.keys(Breinify.plugins)
                .filter(name => name.charAt(0) !== '_' && $.isPlainObject(Breinify.plugins[name]))
                .sort();

            pluginNames.forEach(pluginName => {
                _private.pluginLifecycle.watch(pluginName);
                _private.pluginLifecycle.hydrate(pluginName, Breinify.plugins[pluginName]);
            });

            this.$infoContainer.empty();
            this.$infoContainer.append(
                $('<div class="info-section"></div>')
                    .append($('<div class="info-label">Script version</div>'))
                    .append($('<div class="info-value"></div>').text(version))
            );

            const $plugins = $('<div class="info-section"></div>');
            $plugins.append($('<div class="info-label"></div>').text('Loaded plugins (' + pluginNames.length + ')'));

            const $pluginList = $('<ul class="plugin-list"></ul>');
            pluginNames.forEach(pluginName => {
                const lifecycle = _private.pluginLifecycle.get(pluginName);
                const $plugin = $('<li></li>');
                const $lifecycle = $('<div class="plugin-lifecycle"></div>');

                const $pluginHeader = $('<div class="plugin-header"></div>');
                $pluginHeader.append($('<div class="plugin-name"></div>').text(pluginName));
                $lifecycle.append(this._createLifecycleMarker('Bound', lifecycle.bound, lifecycle));
                $lifecycle.append(this._createLifecycleMarker('Setup', lifecycle.setup, lifecycle));
                $lifecycle.append(this._createLifecycleMarker('Added', lifecycle.added, lifecycle));
                $pluginHeader.append($lifecycle);
                $plugin.append($pluginHeader);

                if (lifecycle.error !== null) {
                    $plugin.append($('<span class="plugin-error">! Plugin initialization failed</span>').attr('title', lifecycle.error));
                }

                $pluginList.append($plugin);
            });

            $plugins.append($pluginList);
            this.$infoContainer.append($plugins);
        }

        _createLifecycleMarker(label, count, lifecycle) {
            const icons = {
                Bound: '⚓',
                Setup: '⚙',
                Added: '+'
            };
            const lifecycleName = label.toLowerCase();
            let state = 'unobserved';
            const icon = icons[label];
            let tooltip = label + ' lifecycle event was not observed since DevStudio loaded.';

            if (count === 1) {
                state = 'observed';
                tooltip = {
                    Bound: 'Successfully bound.',
                    Setup: 'Successfully set up.',
                    Added: 'Successfully added.'
                }[label];
                if (lifecycle.inferred[lifecycleName] === true) {
                    tooltip += ' Inferred from the loaded plugin state because DevStudio began observing after it was initialized.';
                }
            } else if (count > 1) {
                state = 'error';
                tooltip = label + ' lifecycle event was called ' + count + ' times. It should only be called once.';
            } else if (lifecycle.notApplicable[lifecycleName] === true) {
                state = 'not-applicable';
                tooltip = 'No ' + lifecycleName + ' lifecycle applies to this plugin.';
            }

            const $marker = $('<span class="lifecycle-marker"></span>');
            $marker.addClass(state);
            $marker.attr('title', tooltip);
            $marker.attr('aria-label', tooltip);
            $marker.text(icon);
            return $marker;
        }

        _formatUserValue(value) {
            if ($.isArray(value)) {
                return value.join('\n');
            } else if ($.isPlainObject(value)) {
                return JSON.stringify(value, null, 2);
            }

            return String(value);
        }

        _addUserField($container, label, value, copyable) {
            if (value === null || typeof value === 'undefined' || value === '' || ($.isArray(value) && value.length === 0)) {
                return false;
            }

            const formattedValue = this._formatUserValue(value);
            const $field = $('<div class="user-field"></div>');
            const $fieldValue = $('<div class="user-field-value"></div>');
            $field.append($('<div class="user-field-label"></div>').text(label));
            $fieldValue.append($('<span></span>').text(formattedValue));

            if (copyable === true) {
                const $copyButton = $('<button class="copy-btn" type="button" title="Copy ' + label + '" aria-label="Copy ' + label + '">&#10697;</button>');
                $copyButton.click(() => this._copyValue(formattedValue, label, $copyButton));
                $fieldValue.append($copyButton);
            }

            $field.append($fieldValue);
            $container.append($field);
            return true;
        }

        _renderSplitTests(splitTests) {
            if (!$.isPlainObject(splitTests)) {
                return null;
            }

            const assignments = Object.keys(splitTests)
                .filter(testName => $.isPlainObject(splitTests[testName]))
                .map(testName => {
                    const assignment = splitTests[testName];
                    return {
                        testName: typeof assignment.testName === 'string' && assignment.testName !== ''
                            ? assignment.testName
                            : testName,
                        groupDecision: assignment.groupDecision,
                        selectedInstance: assignment.selectedInstance,
                        usedEnforcedGroup: assignment.usedEnforcedGroup,
                        lastUpdated: typeof assignment.lastUpdated === 'number' ? assignment.lastUpdated : null
                    };
                })
                .sort((assignment1, assignment2) => {
                    const timestamp1 = assignment1.lastUpdated === null ? 0 : assignment1.lastUpdated;
                    const timestamp2 = assignment2.lastUpdated === null ? 0 : assignment2.lastUpdated;
                    return timestamp2 - timestamp1 || assignment1.testName.localeCompare(assignment2.testName);
                });

            if (assignments.length === 0) {
                return null;
            }

            const $section = $('<div class="split-tests-section"></div>');
            $section.append($('<div class="split-tests-title"></div>').text('Split tests (' + assignments.length + ')'));

            assignments.forEach(assignment => {
                const $assignment = $('<div class="split-test"></div>');
                const $details = $('<div class="split-test-details"></div>');

                $assignment.append($('<div class="split-test-name"></div>').text(assignment.testName));
                if (typeof assignment.groupDecision === 'string' && assignment.groupDecision !== '') {
                    $details.append($('<span></span>').append($('<span class="split-test-detail-label">Group: </span>')).append(document.createTextNode(assignment.groupDecision)));
                }
                if (typeof assignment.selectedInstance === 'string' && assignment.selectedInstance !== '') {
                    $details.append($('<span></span>').append($('<span class="split-test-detail-label">Instance: </span>')).append(document.createTextNode(assignment.selectedInstance)));
                }
                if (typeof assignment.usedEnforcedGroup === 'boolean') {
                    $details.append($('<span></span>').append($('<span class="split-test-detail-label">Enforced: </span>')).append(document.createTextNode(assignment.usedEnforcedGroup ? 'Yes' : 'No')));
                }
                if (assignment.lastUpdated !== null) {
                    $details.append($('<span></span>').append($('<span class="split-test-detail-label">Updated: </span>')).append(document.createTextNode(new Date(assignment.lastUpdated).toLocaleString())));
                }

                $assignment.append($details);
                $section.append($assignment);
            });

            return $section;
        }

        _copyValue(value, label, $copyButton) {
            $copyButton.prop('disabled', true);

            const resetButton = (label, title) => {
                window.setTimeout(() => {
                    $copyButton.text(label);
                    $copyButton.attr('title', title);
                    $copyButton.prop('disabled', false);
                }, 1500);
            };

            _private.copyText(value).then(() => {
                $copyButton.text('✓');
                $copyButton.attr('title', 'Copied');
                resetButton('⧉', 'Copy ' + label);
            }).catch(() => {
                $copyButton.text('!');
                $copyButton.attr('title', 'Unable to copy');
                resetButton('⧉', 'Copy ' + label);
            });
        }

        _createRefreshHeader(lastFetched, isRefreshing, onRefresh) {
            const $header = $('<div class="user-header"></div>');
            const lastFetchedText = lastFetched === null
                ? 'Last fetched: Never'
                : 'Last fetched: ' + lastFetched.toLocaleString();
            const $refreshButton = $('<button class="refresh-btn" type="button">↻ Refresh</button>');

            $refreshButton.prop('disabled', isRefreshing === true);
            $refreshButton.click(onRefresh);
            $header.append($('<div class="user-last-fetched"></div>').text(lastFetchedText));
            $header.append($refreshButton);
            return $header;
        }

        _renderUserLoading() {
            this.$userContainer.empty();
            this.$userContainer.append(this._createRefreshHeader(this.userLastFetched, true, () => this._refreshUserInfo()));
            this.$userContainer.append($('<div class="user-empty">Fetching current user…</div>'));
        }

        _renderUserInfo(userData) {
            userData = $.isPlainObject(userData) ? userData : {};
            const additional = $.isPlainObject(userData.additional) ? userData.additional : {};
            const identifiers = $.isPlainObject(additional.identifiers) ? additional.identifiers : {};
            const userIds = [];

            if (typeof userData.userId === 'string' && userData.userId !== '') {
                userIds.push(userData.userId);
            }
            if ($.isArray(userData.userIds)) {
                userData.userIds.forEach(userId => {
                    if (typeof userId === 'string' && userId !== '') {
                        userIds.push(userId);
                    }
                });
            }

            this.$userContainer.empty();
            this.$userContainer.append(this._createRefreshHeader(this.userLastFetched, false, () => this._refreshUserInfo()));

            const $userFields = $('<div></div>');
            this._addUserField($userFields, 'Session ID', userData.sessionId, true);
            this._addUserField($userFields, 'Browser ID', identifiers.browserId, true);

            this._addUserField($userFields, 'Email', userData.email, false);
            this._addUserField($userFields, 'User IDs', userIds, false);
            this._addUserField($userFields, 'Phone', userData.phone, false);
            this._addUserField($userFields, 'Location', additional.location, false);

            this.$userContainer.append($userFields);
        }

        _renderSplitTestsInfo(splitTests, isRefreshing) {
            this.$splitTestsContainer.empty();
            this.$splitTestsContainer.append(this._createRefreshHeader(this.splitTestsLastFetched, isRefreshing, () => this._refreshSplitTests()));

            if (isRefreshing === true) {
                this.$splitTestsContainer.append($('<div class="user-empty">Fetching split-test assignments…</div>'));
                return;
            }

            const $splitTests = this._renderSplitTests(splitTests);
            if ($splitTests !== null) {
                this.$splitTestsContainer.append($splitTests);
            }
        }

        _refreshSplitTests() {
            this._renderSplitTestsInfo(null, true);

            try {
                const userData = Breinify.UTL.user.create();
                const additional = $.isPlainObject(userData.additional) ? userData.additional : {};
                this.splitTestsLastFetched = new Date();
                this._renderSplitTestsInfo(additional.splitTests, false);
            } catch (error) {
                this.$splitTestsContainer.empty();
                this.$splitTestsContainer.append(this._createRefreshHeader(this.splitTestsLastFetched, false, () => this._refreshSplitTests()));
                this.$splitTestsContainer.append($('<div class="user-empty">Unable to retrieve split-test assignments.</div>'));
            }
        }

        _renderUserError() {
            this.$userContainer.empty();
            this.$userContainer.append(this._createRefreshHeader(this.userLastFetched, false, () => this._refreshUserInfo()));
            this.$userContainer.append($('<div class="user-empty">Unable to retrieve the current user.</div>'));
        }

        _refreshUserInfo() {
            this._renderUserLoading();

            try {
                const userData = Breinify.UTL.user.create();
                this.userLastFetched = new Date();
                this._renderUserInfo(userData);
            } catch (error) {
                this._renderUserError();
            }
        }

        _switchTab(event) {
            const selectedTab = event.target.dataset.tab;
            this.activeTab = selectedTab;
            this.$tabs.each(function () {
                this.classList.toggle('active', this.dataset.tab === selectedTab);
            });

            if (selectedTab === 'console') {
                this._stopInspecting();
                this._renderConsole();
                this.$logContainer.addClass('active');
                this.$infoContainer.removeClass('active');
                this.$userContainer.removeClass('active');
                this.$splitTestsContainer.removeClass('active');
                this.$inspectContainer.removeClass('active');
            } else if (selectedTab === 'info') {
                this._stopInspecting();
                this._refreshInfo();
                this.$logContainer.removeClass('active');
                this.$infoContainer.addClass('active');
                this.$userContainer.removeClass('active');
                this.$splitTestsContainer.removeClass('active');
                this.$inspectContainer.removeClass('active');
            } else if (selectedTab === 'user') {
                this._stopInspecting();
                this._refreshUserInfo();
                this.$logContainer.removeClass('active');
                this.$infoContainer.removeClass('active');
                this.$userContainer.addClass('active');
                this.$splitTestsContainer.removeClass('active');
                this.$inspectContainer.removeClass('active');
            } else if (selectedTab === 'split-tests') {
                this._stopInspecting();
                this._refreshSplitTests();
                this.$logContainer.removeClass('active');
                this.$infoContainer.removeClass('active');
                this.$userContainer.removeClass('active');
                this.$splitTestsContainer.addClass('active');
                this.$inspectContainer.removeClass('active');
            } else if (selectedTab === 'inspect') {
                this.$logContainer.removeClass('active');
                this.$infoContainer.removeClass('active');
                this.$userContainer.removeClass('active');
                this.$splitTestsContainer.removeClass('active');
                this.$inspectContainer.addClass('active');
                this._startInspecting();
            }
        }
    }

    // this is just a wrapper around the custom-element, adding it to the DOM tree if not there yet
    const DevStudio = {
        inspectConfig: {
            events: {
                renderedRecommendation: {
                    name: 'Observed Breinify recommendation render',
                    controlName: 'Observed Breinify recommendation control render',
                    fields: [
                        {label: 'Rendered', path: 'recommendationResult.rendered'},
                        {label: 'Status code', path: 'recommendationResult.statusCode'},
                        {label: 'Recommender', path: 'recommendationResult.labels.recommender'},
                        {label: 'Title', path: 'recommendationResult.labels.title'},
                        {label: 'Control group', path: 'isControl'}
                    ],
                    viewPath: 'recommendationData',
                    viewTitle: 'Observed rendered recommendation data'
                }
            },
            markers: [
                {selector: 'br-ui-countdown', name: 'Breinify countdown'},
                {selector: 'br-ui-search', name: 'Breinify search'},
                {selector: 'br-ui-search-result', name: 'Breinify search result'},
                {selector: 'br-ui-search-results', name: 'Breinify search results'},
                {selector: 'br-ui-survey', name: 'Breinify survey'},
                {selector: 'br-ui-survey-popup', name: 'Breinify survey popup'},
                {
                    selector: '.brrc-item',
                    name: 'Breinify recommendation item',
                    data: {
                        jqueryKey: 'recommendation',
                        fields: [
                            {label: 'Widget position', path: 'widgetPosition'},
                            {label: 'Recommendation ID', path: 'id'},
                            {label: 'Name', path: 'additionalData.product::productName'}
                        ],
                        viewTitle: 'Recommended item data'
                    }
                },
                {
                    selector: '.br-simple-slider__item',
                    name: 'Breinify carousel item',
                    type: 'carouselItem',
                    parentSelector: 'br-simple-slider, .br-simple-slider'
                },
                {
                    selector: 'br-simple-slider, .br-simple-slider',
                    name: 'Breinify carousel',
                    type: 'carousel'
                },
                {
                    selector: '.brrc-cont',
                    name: 'Breinify recommendations container',
                    data: {
                        jqueryKey: 'recommendation',
                        path: 'data',
                        viewTitle: 'Recommendation response data'
                    }
                },
                {selector: '.brrc-pcont', name: 'Breinify recommendations parent container'},
                {
                    selector: '[data-br-rec-webexpid]',
                    name: 'Breinify recommendation render',
                    attributes: [
                        {name: 'data-br-rec-webexpid', label: 'Web experience ID'},
                        {name: 'data-br-rec-positionid', label: 'Position ID'},
                        {name: 'data-br-rec-name', label: 'Recommender'}
                    ]
                },
                {
                    selector: '[data-br-webexppos]',
                    name: 'Breinify web experience anchor',
                    attributes: [
                        {name: 'data-br-webexppos', label: 'Position ID'}
                    ]
                },
                {
                    selector: '[data-br-rec-control-bind-token], [data-brrc-refresh-outcome="control"]',
                    name: 'Breinify recommendation control group',
                    attributes: [
                        {name: 'data-brrc-refresh-outcome', label: 'Render outcome'},
                        {name: 'data-brrc-refresh-code', label: 'Response code'}
                    ],
                    data: {
                        jqueryKey: 'recommendation',
                        path: 'data',
                        fields: [
                            {label: 'Control group', path: 'splitTestData.isControl'},
                            {label: 'Split test', path: 'splitTestData.testName'},
                            {label: 'Group', path: 'splitTestData.groupDecision'},
                            {label: 'Instance', path: 'splitTestData.selectedInstance'}
                        ],
                        viewTitle: 'Control-group recommendation data'
                    }
                }
            ]
        },
        devStudio: null,

        init: function () {
            if (Breinify.UTL.internal.isDevMode() !== true) {
                return;
            } else if (this.devStudio !== null) {
                return;
            }

            const elementName = 'breinify-dev-console';
            customElements.define(elementName, BreinifyDevConsole);

            this.devStudio = document.createElement(elementName);
            document.body.appendChild(this.devStudio);
        }
    }

    // initialize the module once Breinify is ready
    const BoundDevStudio = Breinify.plugins._add('devStudio', DevStudio);
    Breinify.onReady(function () {
        BoundDevStudio.init();
    });
})();
