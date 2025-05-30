"use strict";

(function () {
    const $ = Breinify.UTL._jquery();

    const _private = {
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
                div.plugin-bubble { background: linear-gradient(to bottom, #2a2a2a, #1f1f1f); border: 1px solid #333; border-left: 4px solid #4fc3f7; border-radius: 6px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; }
                div.plugin-header { font-size: 14px; font-weight: bold; color: #4fc3f7; padding: 10px 12px; cursor: pointer; user-select: none; position: relative; }
                span.plugin-indicator { position: absolute; right: 12px; top: 10px; font-size: 12px; transform-origin: center; transition: transform 0.3s ease; }
                div.plugin-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; padding: 0 12px; }
                div.plugin-content.expended { padding: 10px 12px }
                div.plugin-content ul { list-style-type: none; padding-left: 0; margin: 0; }
                div.plugin-content ul li { margin-bottom: 4px; }
                div.plugin-content ul li span.plugin-prop-key { color: #bbbbbb; display: inline-block; padding-right: 5px; }
                div.plugin-content ul li span.plugin-prop-value { color: #ffffff; display: inline-block; }
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
                    </div>
                </header>
                <div id="log-container" class="container active"></div>
                <div id="info-container" class="container"></div>
            </div>
            <div id="toggle-button" title="Show Breinify DevStudio" role="button" tabindex="0"><svg xmlns="http://www.w3.org/2000/svg" fill="white" width="16" height="16" viewBox="0 0 24 24"><path d="M12 2C8.1 2 6 4.4 6 7v5c0 .5-.2.9-.5 1.3-.3.4-.5.9-.5 1.4v.3c.1.6.5 1.1 1 1.5.5.4.8 1 .8 1.6 0 .6.2 1.1.5 1.5s.7.7 1.2.9V21c0 .6.4 1 1 1s1-.4 1-1v-1h2v1c0 .6.4 1 1 1s1-.4 1-1v-1.5c.5-.2.9-.5 1.2-.9s.5-.9.5-1.5c0-.6.3-1.2.8-1.6.5-.4.9-.9 1-1.5v-.3c0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.3V7c0-2.6-2.1-5-6-5z"/></svg></div>`;

            this.$shadowRoot = $(this.shadowRoot);
            this.$toggleButton = this.$shadowRoot.find('#toggle-button');
            this.$panel = this.$shadowRoot.find('#panel');
            this.$closeBtn = this.$shadowRoot.find('button.close-btn');
            this.$tabs = this.$shadowRoot.find('button.tab');

            this.$logContainer = this.$shadowRoot.find('#log-container');
            this.$infoContainer = this.$shadowRoot.find('#info-container');

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

        showPluginInfo(pluginName, config) {
            const $bubble = $('<div class="plugin-bubble"></div>');
            const $header =$('<div class="plugin-header">🔌 ' + pluginName + '</div>');

            const $indicator = $('<span class="plugin-indicator">─</span>');
            $header.append($indicator);

            const $content = $('<div class="plugin-content"></div>');
            const $list = $('<ul></ul>');

            Object.entries(config).forEach(([key, value]) => {
                const $item = $('<li><span class="plugin-prop-key">' + key + ':</span><span class="plugin-prop-value">' + value + '</span></li>');
                $list.append($item);
            });

            $content.append($list);
            $bubble.append($header);
            $bubble.append($content);

            this.$infoContainer.prepend($bubble);

            let expanded = false;
            $header.click(() => {
                expanded = $header.hasClass('expended');

                if (expanded) {
                    $header.removeClass('expended');
                    $content.css('maxHeight', $content[0].scrollHeight + 'px');
                    $indicator.text('▼');
                } else {
                    $header.addClass('expended');
                    $content.css('maxHeight', '0');
                    $indicator.text('─');
                }
            });
        }

        _switchTab(event) {
            const selectedTab = event.target.dataset.tab;
            this.$tabs.each(function () {
                this.classList.toggle('active', this.dataset.tab === selectedTab);
            });

            // For now, just clear or keep logs on console tab, and show placeholder on info tab
            if (selectedTab === 'console') {
                this.$logContainer.addClass('active');
                this.$infoContainer.removeClass('active');
            } else if (selectedTab === 'info') {
                this.$logContainer.removeClass('active');
                this.$infoContainer.addClass('active');
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