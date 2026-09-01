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
                    this.record('activity', 'Activity: ' + activityType, payload);
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
                        watched: false
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
                    .forEach(name => this.watch(name));

                const originalAdd = Breinify.plugins._add;
                Breinify.plugins._add = function () {
                    const name = arguments[0];
                    if (typeof name === 'string') {
                        _private.pluginLifecycle.watch(name);
                    }

                    try {
                        return originalAdd.apply(this, arguments);
                    } catch (error) {
                        if (typeof name === 'string') {
                            _private.pluginLifecycle.recordError(name, error);
                        }

                        throw error;
                    }
                };
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

        userLastFetched = null;
        splitTestsLastFetched = null;

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
                header > .tabs { display: flex; gap: 10px; flex-grow: 1; }
                header button.tab { background: transparent; border: none; color: #ccc; cursor: pointer; padding: 4px 8px; font-size: 12px; border-bottom: 2px solid transparent; transition: border-color 0.15s ease; }
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
                span.console-event-type { border-radius: 3px; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 5px; }
                span.console-event-type.activity { background: #0277bd; }
                span.console-event-type.ready { background: #7b1fa2; }
                span.console-title { color: #fff; flex-grow: 1; font-weight: bold; }
                span.console-timestamp { color: #bbbbbb; font-size: 11px; }
                details.console-payload { margin-top: 7px; }
                details.console-payload summary { color: #4fc3f7; cursor: pointer; }
                details.console-payload pre { background: #151515; border-radius: 3px; color: #ddd; margin: 7px 0 0; overflow-x: auto; padding: 8px; white-space: pre-wrap; }
                div.info-section { margin-bottom: 16px; }
                div.info-label { color: #bbbbbb; font-size: 11px; font-weight: bold; letter-spacing: 0.04em; margin-bottom: 5px; text-transform: uppercase; }
                div.info-value { color: #4fc3f7; font-size: 14px; }
                ul.plugin-list { list-style: none; margin: 0; padding: 0; }
                ul.plugin-list li { background: linear-gradient(to bottom, #2a2a2a, #1f1f1f); border: 1px solid #333; border-left: 4px solid #4fc3f7; border-radius: 4px; color: #fff; margin-bottom: 6px; padding: 8px 10px; }
                div.plugin-name { font-weight: bold; margin-bottom: 6px; }
                div.plugin-lifecycle { display: flex; flex-wrap: wrap; gap: 8px; }
                span.lifecycle-state { align-items: center; color: #bbbbbb; display: inline-flex; gap: 3px; }
                span.lifecycle-marker { align-items: center; background: #555; border-radius: 50%; color: #ddd; display: inline-flex; font-size: 10px; font-weight: bold; height: 15px; justify-content: center; width: 15px; }
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
                    </div>
                </header>
                <div id="log-container" class="container active"></div>
                <div id="info-container" class="container"></div>
                <div id="user-container" class="container"></div>
                <div id="split-tests-container" class="container"></div>
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

            this.$closeBtn.click(() => this.toggleDevStudio());
            this.$toggleButton.click(() => this.toggleDevStudio());

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

            this._renderConsole();
            _private.resizable(this.$shadowRoot);
        }

        toggleDevStudio() {
            this.isVisible = !this.isVisible;

            if (this.isVisible) {
                this.$panel.css('transform', 'translateY(0)');
                this.$panel.css('opacity', '1');
                this.$toggleButton.css('display', 'none');
            } else {
                this.$panel.css('transform', 'translateY(100%)');
                this.$panel.css('opacity', '0');
                this.$toggleButton.css('display', 'flex');
            }
        }

        _formatConsoleTimestamp(timestamp) {
            const milliseconds = timestamp.getMilliseconds().toString().padStart(3, '0');
            return timestamp.toLocaleTimeString() + '.' + milliseconds;
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
                const $payload = $('<details class="console-payload"><summary>Show payload</summary></details>');

                $header.append($('<span class="console-event-type"></span>').addClass(entry.type).text(entry.type.toUpperCase()));
                $header.append($('<span class="console-title"></span>').text(entry.title));
                $header.append($('<span class="console-timestamp"></span>').text(this._formatConsoleTimestamp(entry.timestamp)));
                $payload.append($('<pre></pre>').text(entry.payload));
                $entry.append($header);
                $entry.append($payload);
                this.$logContainer.append($entry);
            });
        }

        _refreshInfo() {
            const version = typeof Breinify.version === 'string' && Breinify.version.trim() !== ''
                ? Breinify.version
                : 'Unknown';
            const pluginNames = Object.keys(Breinify.plugins)
                .filter(name => name.charAt(0) !== '_' && $.isPlainObject(Breinify.plugins[name]))
                .sort();

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

                $plugin.append($('<div class="plugin-name"></div>').text(pluginName));
                $lifecycle.append(this._createLifecycleMarker('Bound', lifecycle.bound));
                $lifecycle.append(this._createLifecycleMarker('Setup', lifecycle.setup));
                $lifecycle.append(this._createLifecycleMarker('Added', lifecycle.added));
                $plugin.append($lifecycle);

                if (lifecycle.error !== null) {
                    $plugin.append($('<span class="plugin-error">! Plugin initialization failed</span>').attr('title', lifecycle.error));
                }

                $pluginList.append($plugin);
            });

            $plugins.append($pluginList);
            this.$infoContainer.append($plugins);
        }

        _createLifecycleMarker(label, count) {
            let state = 'not observed';
            let icon = '○';
            let tooltip = label + ' lifecycle event was not observed since DevStudio loaded.';

            if (count === 1) {
                state = 'observed';
                icon = '✓';
                tooltip = label + ' lifecycle event observed once.';
            } else if (count > 1) {
                state = 'error';
                icon = '!';
                tooltip = label + ' lifecycle event observed ' + count + ' times. A plugin lifecycle event should only occur once.';
            }

            const $state = $('<span class="lifecycle-state"></span>');
            const $marker = $('<span class="lifecycle-marker"></span>');
            $marker.addClass(state);
            $marker.attr('title', tooltip);
            $marker.attr('aria-label', tooltip);
            $marker.text(icon);
            $state.append($marker);
            $state.append($('<span></span>').text(label));
            return $state;
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
                $copyButton.click(() => this._copyUserValue(formattedValue, label, $copyButton));
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

        _copyUserValue(value, label, $copyButton) {
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
            this.$tabs.each(function () {
                this.classList.toggle('active', this.dataset.tab === selectedTab);
            });

            if (selectedTab === 'console') {
                this._renderConsole();
                this.$logContainer.addClass('active');
                this.$infoContainer.removeClass('active');
                this.$userContainer.removeClass('active');
                this.$splitTestsContainer.removeClass('active');
            } else if (selectedTab === 'info') {
                this._refreshInfo();
                this.$logContainer.removeClass('active');
                this.$infoContainer.addClass('active');
                this.$userContainer.removeClass('active');
                this.$splitTestsContainer.removeClass('active');
            } else if (selectedTab === 'user') {
                this._refreshUserInfo();
                this.$logContainer.removeClass('active');
                this.$infoContainer.removeClass('active');
                this.$userContainer.addClass('active');
                this.$splitTestsContainer.removeClass('active');
            } else if (selectedTab === 'split-tests') {
                this._refreshSplitTests();
                this.$logContainer.removeClass('active');
                this.$infoContainer.removeClass('active');
                this.$userContainer.removeClass('active');
                this.$splitTestsContainer.addClass('active');
            }
        }
    }

    // this is just a wrapper around the custom-element, adding it to the DOM tree if not there yet
    const DevStudio = {
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
