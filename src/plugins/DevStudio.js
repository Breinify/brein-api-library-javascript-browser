"use strict";

(function () {
    const $ = Breinify.UTL._jquery();

    const _private = {
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

    class BreinifyDevConsole extends HTMLElement {
        $shadowRoot = null;
        $toggleButton = null;
        $panel = null;
        $closeBtn = null;
        $tabs = null;

        $logContainer = null;
        $infoContainer = null;
        $userContainer = null;

        userLastFetched = null;
        userFetchId = 0;

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
                div.info-section { margin-bottom: 16px; }
                div.info-label { color: #bbbbbb; font-size: 11px; font-weight: bold; letter-spacing: 0.04em; margin-bottom: 5px; text-transform: uppercase; }
                div.info-value { color: #4fc3f7; font-size: 14px; }
                ul.plugin-list { list-style: none; margin: 0; padding: 0; }
                ul.plugin-list li { background: linear-gradient(to bottom, #2a2a2a, #1f1f1f); border: 1px solid #333; border-left: 4px solid #4fc3f7; border-radius: 4px; color: #fff; margin-bottom: 6px; padding: 8px 10px; }
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
                    </div>
                </header>
                <div id="log-container" class="container active"></div>
                <div id="info-container" class="container"></div>
                <div id="user-container" class="container"></div>
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

            this.$closeBtn.click(() => this.toggleDevStudio());
            this.$toggleButton.click(() => this.toggleDevStudio());

            this.$tabs.click(e => this._switchTab(e));

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
                $pluginList.append($('<li></li>').text(pluginName));
            });

            $plugins.append($pluginList);
            this.$infoContainer.append($plugins);
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

        _createUserHeader(lastFetched, isRefreshing) {
            const $header = $('<div class="user-header"></div>');
            const lastFetchedText = lastFetched === null
                ? 'Last fetched: Never'
                : 'Last fetched: ' + lastFetched.toLocaleString();
            const $refreshButton = $('<button class="refresh-btn" type="button">↻ Refresh</button>');

            $refreshButton.prop('disabled', isRefreshing === true);
            $refreshButton.click(() => this._refreshUserInfo());
            $header.append($('<div class="user-last-fetched"></div>').text(lastFetchedText));
            $header.append($refreshButton);
            return $header;
        }

        _renderUserLoading() {
            this.$userContainer.empty();
            this.$userContainer.append(this._createUserHeader(this.userLastFetched, true));
            this.$userContainer.append($('<div class="user-empty">Fetching current user…</div>'));
        }

        _renderUserInfo(user) {
            const userData = user && $.isFunction(user.all) && $.isPlainObject(user.all()) ? user.all() : {};
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
            this.$userContainer.append(this._createUserHeader(this.userLastFetched, false));

            const $userFields = $('<div></div>');
            this._addUserField($userFields, 'Session ID', userData.sessionId, true);
            this._addUserField($userFields, 'Browser ID', identifiers.browserId, true);

            let hasAttachedUserInformation = false;
            hasAttachedUserInformation = this._addUserField($userFields, 'Email', userData.email, false) || hasAttachedUserInformation;
            hasAttachedUserInformation = this._addUserField($userFields, 'User IDs', userIds, false) || hasAttachedUserInformation;
            hasAttachedUserInformation = this._addUserField($userFields, 'Phone', userData.phone, false) || hasAttachedUserInformation;
            hasAttachedUserInformation = this._addUserField($userFields, 'Location', additional.location, false) || hasAttachedUserInformation;

            this.$userContainer.append($userFields);
            if (hasAttachedUserInformation === false) {
                this.$userContainer.append($('<div class="user-empty">No additional user information is attached.</div>'));
            }
        }

        _renderUserError() {
            this.$userContainer.empty();
            this.$userContainer.append(this._createUserHeader(this.userLastFetched, false));
            this.$userContainer.append($('<div class="user-empty">Unable to retrieve the current user.</div>'));
        }

        _refreshUserInfo() {
            const fetchId = ++this.userFetchId;
            this._renderUserLoading();

            try {
                Breinify.createUser({}, user => {
                    if (fetchId !== this.userFetchId) {
                        return;
                    }

                    try {
                        this.userLastFetched = new Date();
                        this._renderUserInfo(user);
                    } catch (error) {
                        this._renderUserError();
                    }
                });
            } catch (error) {
                if (fetchId === this.userFetchId) {
                    this._renderUserError();
                }
            }
        }

        _switchTab(event) {
            const selectedTab = event.target.dataset.tab;
            this.$tabs.each(function () {
                this.classList.toggle('active', this.dataset.tab === selectedTab);
            });

            if (selectedTab === 'console') {
                this.$logContainer.addClass('active');
                this.$infoContainer.removeClass('active');
                this.$userContainer.removeClass('active');
            } else if (selectedTab === 'info') {
                this._refreshInfo();
                this.$logContainer.removeClass('active');
                this.$infoContainer.addClass('active');
                this.$userContainer.removeClass('active');
            } else if (selectedTab === 'user') {
                this._refreshUserInfo();
                this.$logContainer.removeClass('active');
                this.$infoContainer.removeClass('active');
                this.$userContainer.addClass('active');
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
