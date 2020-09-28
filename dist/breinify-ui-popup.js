"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }

    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var prefixValidation = Breinify.UTL.constants.errors.prefix.validation;
    var prefixApi = Breinify.UTL.constants.errors.prefix.api;

    var prefixCssPopup = 'breinify-popup';
    var prefixCssLoadPage = prefixCssPopup + '-page-load';
    var prefixCssDonePage = prefixCssPopup + '-page-done';

    var minHtml = "<div class=\"" + prefixCssPopup + "\"><div class=\"" + prefixCssPopup + "-content\"><div class=\"" + prefixCssPopup + "-header\"><div style=\"display:inline-block\"></div><span class=\"" + prefixCssPopup + "-close\">&times;</span></div><div class=\"" + prefixCssPopup + "-pages\"></div><div class=\"" + prefixCssPopup + "-footer\"></div></div></div>";
    var minCss = "<style id=\"" + prefixCssPopup + "-style\">." + prefixCssPopup + "{display:none;position:fixed;z-index:1000;left:0;top:0;width:100%;height:100%;overflow:auto;background-color:#000;background-color:rgba(0,0,0,.4)}." + prefixCssPopup + "-content>." + prefixCssPopup + "-header{padding-bottom:0;min-height:16px}." + prefixCssPopup + "-content{position:relative;background-color:#fefefe;margin:15% auto;padding:0px;border:1px solid #888;width:80%}." + prefixCssPopup + "-close{position:absolute;right:10px;top:10px;line-height:12px;vertical-align:top;color:#aaa;float:right;font-size:28px;font-weight:700}." + prefixCssPopup + "-close:focus,." + prefixCssPopup + "-close:hover{color:#000;text-decoration:none;cursor:pointer}." + prefixCssPopup + "-content>div{padding:10px}." + prefixCssPopup + "-page{border:1px solid #e7e7e7;border-radius:4px;background:#f8f8f8 none repeat scroll 0 0;padding:10px 13px}</style>";

    var UiPopup = function UiPopup() {
    };

    UiPopup.prototype.init = function (id, options) {
        var _self = this;
        var $body = $('body');

        // general settings to keep
        this.currentPageNr = 0;
        this.$pages = [];
        this.id = id;
        this.options = $.extend(true, {
            showClose: true,
            showFooter: true,
            closeOnEscape: true,
            header: null,
            footer: null,
            maxWidth: null,
            bindings: null,
            onClose: null
        }, options);

        // make sure we have the minimal CSS needed
        if ($('#' + prefixCssPopup + '-style').length === 0) {
            $body.append(minCss);
        }

        // check if the element with this id exists
        var $el = $('#' + id);
        if ($el.length === 0) {
            var $minHtml = $(minHtml);
            $minHtml.attr('id', id);
            $body.append($minHtml);
            this.$popup = $minHtml;
        } else {
            this.$popup = $el;
        }

        // check if we show close
        var $close = this.$popup.find('.' + prefixCssPopup + '-close');
        if (this.getOption('showClose', true) === true) {
            $close.show();
            $close.click(function () {
                _self.hide();
            });
        } else {
            $close.hide()
        }

        // check if we show the footer
        var $footer = this.$popup.find('.' + prefixCssPopup + '-footer');
        if (this.getOption('showFooter', true) === true) {
            $footer.show();
        } else {
            $footer.hide()
        }

        // check the maxWidth
        var maxWidth = this.getOption('maxWidth', null);
        if (typeof maxWidth === 'number') {
            maxWidth = maxWidth + 'px';
        }
        if (typeof maxWidth === 'string') {
            var $content = this.$popup.find('.' + prefixCssPopup + '-content');
            $content.css('maxWidth', maxWidth);
        }

        // check esc-handling
        if (this.getOption('closeOnEscape', true) === true) {
            this.escHandler = function (event) {
                if (event.keyCode === 27) {
                    _self.hide();
                }
            };
            $(document).bind('keyup', this.escHandler);
        } else {
            this.escHandler = null;
        }

        // use some setters
        this.setBindings(null);
        this.setHeader(null);
        this.setFooter(null);

        this.id = id;
    };

    UiPopup.prototype.reset = function ($page) {
        if (typeof $page === 'number') {
            var pageNr = this.validatePage($page);
            this.reset(this.$pages[pageNr]);
        } else if (typeof $page === 'undefined') {
            var _self = this;
            $.each(this.$pages, function (idx, $p) {
                _self.reset($p);
            });
        } else {
            var $resetEls = $page.find('[data-breinify-reset=true]');
            $resetEls.each(function () {
                var $resetEl = $(this);
                var val = $resetEl.attr('data-breinify-reset-value');

                if ($resetEl.is('input[type="text"]')) {
                    $resetEl.val(val);
                } else if ($resetEl.is('select')) {
                    $resetEl.val(val);
                } else if ($resetEl.is('textarea')) {
                    $resetEl.val(val);
                } else if ($resetEl.is('input[type="checkbox"]')) {
                    $resetEl.prop('checked', val === 'true');
                } else {
                    $resetEl.text(val);
                }
            });
        }
    };

    UiPopup.prototype.css = function (selector, css) {
        var $el = this.$popup.find(selector);
        $el.css($.isPlainObject(css) ? css : {});

        return css;
    };

    UiPopup.prototype.find = function (selector) {
        return this.$popup.find(selector);
    };

    UiPopup.prototype.setBindings = function (bindings) {
        this.bindings = $.isPlainObject(bindings) ? bindings : this.getOption('bindings', {});
    };

    UiPopup.prototype.getBinding = function (path, def) {
        var val = Breinify.UTL.getNestedByPath(this.bindings, path);
        if (typeof val === 'undefined' || val === null) {
            return def;
        } else {
            return val;
        }
    };

    UiPopup.prototype.extendBindings = function (bindings) {
        this.bindings = $.extend(true, {}, this.bindings, bindings);
    };

    UiPopup.prototype.show = function (pageNr) {
        pageNr = this.validatePage(typeof pageNr === 'number' ? pageNr : 1);
        this.showPage(pageNr);
    };

    UiPopup.prototype.hide = function (ignoreOnClose) {
        $('html')
            .css('marginRight', '')
            .css('overflow', '');

        if ($.isFunction(this.options.onClose) && ignoreOnClose !== true) {
            this.options.onClose(this);
        }

        this.reset();
        this.$popup.css('display', 'none');
    };

    UiPopup.prototype.destroy = function () {
        if (this.escHandler !== null) {
            $(document).unbind('keyup', this.escHandler);
            this.escHandler = null;
        }
    };

    UiPopup.prototype.addPage = function (page, pageSettings) {

        var code;
        var hasInit;
        if (typeof page === 'string') {
            code = page;
            hasInit = false;
        } else if ($.isPlainObject(page)) {
            var style = typeof page.style === 'string' ? page.style : '';
            var html = typeof page.html === 'string' ? page.html : '';
            code = style + html;
            hasInit = $.isFunction(page.init);
        } else {
            return null;
        }

        var $pagesContainer = this.$popup.find('.' + prefixCssPopup + '-pages');
        var $page = $('<div class="' + prefixCssPopup + '-page">' + code + '</div>');

        var pageNr = this.$pages.push($page);
        $page.attr('data-pageNr', pageNr);
        $page.hide();

        var $resetEls = $page.find('[data-breinify-reset=true]');
        $resetEls.each(function () {
            var $resetEl = $(this);

            var val;
            if ($resetEl.is('input[type="text"]')) {
                val = $resetEl.val();
            } else if ($resetEl.is('select')) {
                val = $resetEl.val();
            } else if ($resetEl.is('textarea')) {
                val = $resetEl.val();
            } else if ($resetEl.is('input[type="checkbox"]')) {
                val = $resetEl.is(":checked");
            } else {
                val = $resetEl.text();
            }

            $resetEl.attr('data-breinify-reset-value', val);
        });

        $pagesContainer.append($page);

        // initialize the page now
        if (hasInit) {
            page.init(this, $page, $.isPlainObject(pageSettings) ? pageSettings : {});
        }

        return $page;
    };

    UiPopup.prototype.showNextPage = function () {
        this.showPage(this.currentPageNr + 1);
    };

    UiPopup.prototype.showPrevPage = function () {
        if (this.currentPageNr > 1) {
            this.showPage(this.currentPageNr - 1);
        }
    };

    UiPopup.prototype.showPage = function (pageNr) {
        pageNr = this.validatePage(pageNr);

        if (this.currentPageNr !== 0) {
            var $currentPage = this.$pages[this.currentPageNr - 1];
            this._resetBindings($currentPage);
            $currentPage.hide();
        }

        // set the current-page it will become affective now
        this.currentPageNr = pageNr;
        if (pageNr > 0) {
            var $page = this.$pages[pageNr - 1];
            this._applyBindings($page);
            $page.show();
        }

        $('html')
            .css('marginRight', '15px')
            .css('overflow', 'hidden');

        this.$popup.css('display', 'block');
    };

    UiPopup.prototype._applyBindings = function ($el) {
        var _self = this;

        var $placeholders = $el.find('[data-breinify-placeholder]');
        var popupPlaceholders = {
            popup: {
                currentPageNr: this.currentPageNr,
                totalPageNr: this.$pages.length
            }
        };
        $placeholders.each(function () {
            var $placeholderEl = $(this);
            var placeholder = $placeholderEl.attr('data-breinify-placeholder');

            var value;
            if (placeholder.indexOf('popup.') === 0) {
                value = Breinify.UTL.getNestedByPath(popupPlaceholders, placeholder);
            } else {
                value = Breinify.UTL.getNestedByPath(_self.bindings, placeholder);
            }

            $placeholderEl.text(value);
        });
    };

    UiPopup.prototype._resetBindings = function ($el) {
        var $placeholder = $el.find('[data-breinify-placeholder!=""]');
    };

    UiPopup.prototype.validatePage = function (pageNr) {
        if (typeof pageNr === 'number') {
            return Math.max(0, Math.min(this.$pages.length, pageNr));
        } else {
            return this.currentPageNr;
        }
    };

    UiPopup.prototype.setHeader = function (header) {
        if (typeof header !== 'string') {
            header = this.getOption('header', '');
        }

        var $header = this.$popup.find('.' + prefixCssPopup + '-header>div:first');
        $header.html(header);
    };

    UiPopup.prototype.setFooter = function (footer) {
        if (typeof footer !== 'string') {
            footer = this.getOption('footer', '');
        }

        var $footer = this.$popup.find('.' + prefixCssPopup + '-footer');
        $footer.html(footer);
    };

    UiPopup.prototype.getOption = function (option, def) {
        var val = this.options[option];
        if (typeof val === 'undefined' || val === null) {
            return def;
        } else {
            return val;
        }
    };

    // bind the module
    Breinify.plugins._add('uiPopup', {

        pages: {
            load: {
                init: function (popup, $loadPage, settings) {
                    this.settings = $.extend(true, {
                        message: null
                    }, settings);

                    var $msgEl = $('#' + prefixCssLoadPage + '-message');
                    if (typeof this.settings.message === 'string' && this.settings.message !== '') {
                        $msgEl.html(this.settings.message);
                    } else {
                        $msgEl.html('');
                    }
                },
                style:
                '<style id="' + prefixCssLoadPage + '-style">' +
                '.' + prefixCssLoadPage + '-container { text-align: center; }' +
                '.' + prefixCssLoadPage + '-container svg { max-width: 150px;width: 100%;padding: 1em 0; }' +
                '#' + prefixCssLoadPage + '-message { font-size: 1.5em;line-height: 1.5em; }' +
                '#' + prefixCssLoadPage + '-svg { stroke-dasharray: 150, 200;stroke-dashoffset: -10;-webkit-animation: ' + prefixCssLoadPage + '-dash 1.5s ease-in-out infinite, ' + prefixCssLoadPage + '-color 6s ease-in-out infinite;animation: ' + prefixCssLoadPage + '-dash 1.5s ease-in-out infinite, ' + prefixCssLoadPage + '-color 6s ease-in-out infinite;stroke-width: 2px;stroke: #8EC343;fill: none; }' +
                '@-webkit-keyframes ' + prefixCssLoadPage + '-dash {' +
                '    0% { stroke-dasharray: 1, 200;stroke-dashoffset: 0; }' +
                '    50% { stroke-dasharray: 89, 200;stroke-dashoffset: -35; }' +
                '    100% { stroke-dasharray: 89, 200;stroke-dashoffset: -150; }' +
                '}' +
                '@keyframes ' + prefixCssLoadPage + '-dash {' +
                '    0% { stroke-dasharray: 1, 200;stroke-dashoffset: 0; }' +
                '    50% { stroke-dasharray: 89, 200;stroke-dashoffset: -35; }' +
                '    100% { stroke-dasharray: 89, 200;stroke-dashoffset: -150; }' +
                '}' +
                '@-webkit-keyframes ' + prefixCssLoadPage + '-color { 0% { stroke: #8EC343; } 100% { stroke: #8EC343; } }' +
                '@keyframes ' + prefixCssLoadPage + '-color { 0% { stroke: #8EC343; } 100% { stroke: #8EC343; } }' +
                '</style>',
                html:
                '<div class="' + prefixCssLoadPage + '-container">' +
                '  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-263.5 236.5 26 26">' +
                '    <circle id="' + prefixCssLoadPage + '-svg" cx="-250.5" cy="249.5" r="12">' +
                '  </svg>' +
                '  <div id="' + prefixCssLoadPage + '-message">' +
                '  </div>' +
                '</div>'
            },
            success: {
                init: function (popup, $loadPage, settings) {
                    this.settings = $.extend(true, {
                        showCloseButton: false,
                        closeButtonLabel: null,
                        message: null
                    }, settings);

                    var $closeButton = $('#' + prefixCssDonePage + '-close-button');
                    var hasButtonLabel = typeof this.settings.closeButtonLabel === 'string' && this.settings.closeButtonLabel !== ''
                    if (hasButtonLabel === true && this.settings.showCloseButton === true) {
                        $closeButton.click(function () {
                            popup.hide();
                        });
                        $closeButton.show();
                    } else {
                        $closeButton.hide();
                    }

                    if (hasButtonLabel) {
                        $closeButton.html(this.settings.closeButtonLabel);
                    } else {
                        $closeButton.html('');
                    }

                    var $msgEl = $('#' + prefixCssDonePage + '-message');
                    if (typeof this.settings.message === 'string' && this.settings.message !== '') {
                        $msgEl.html(this.settings.message);
                    } else {
                        $msgEl.html('');
                    }
                },
                style:
                '<style id="' + prefixCssDonePage + '-style">' +
                '.' + prefixCssDonePage + '-container { text-align: center; }' +
                '.' + prefixCssDonePage + '-container svg { max-width: 150px;width: 100%;padding: 1em 0; }' +
                '#' + prefixCssDonePage + '-message { font-size: 1.5em;line-height: 1.5em; }' +
                '.' + prefixCssDonePage + '-container button { min-width:150px;width:50%;white-space:nowrap;cursor:pointer;line-height:25px;font-size:14px;border-radius:4px;border-color:#cccccc;background:#cccccc;color:#fff; }' +
                '.' + prefixCssDonePage + '-container button:disabled { cursor:not-allowed;border-color:#eeeeee;background:#cccccc; }' +
                '#' + prefixCssDonePage + '-svg { stroke-width: 2px;stroke: #8EC343;fill: none; }' +
                '#' + prefixCssDonePage + '-svg path { stroke-dasharray: 17px,17px;stroke-dashoffset: 0px;-webkit-animation: ' + prefixCssDonePage + '-checkmark 0.25s ease-in-out 0.7s backwards;animation: ' + prefixCssDonePage + '-checkmark 0.25s ease-in-out 0.7s backwards; }' +
                '#' + prefixCssDonePage + '-svg circle { stroke-dasharray: 76px, 76px;stroke-dashoffset: 0pxtransform-origin: 50% 50%;-webkit-animation: ' + prefixCssDonePage + '-checkmark-circle 0.6s ease-in-out forwards;animation: ' + prefixCssDonePage + '-checkmark-circle 0.6s ease-in-out forwards;' +
                '}' +
                '@keyframes ' + prefixCssDonePage + '-checkmark { 0% { stroke-dashoffset: 17px; } 100% { stroke-dashoffset: 0 } }' +
                '@keyframes ' + prefixCssDonePage + '-checkmark-circle { 0% { stroke-dashoffset: 76px; } 100% { stroke-dashoffset: 0px; } }' +
                '</style>',
                html:
                '<div class="' + prefixCssDonePage + '-container">' +
                '  <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="-263.5 236.5 26 26">' +
                '    <g id="' + prefixCssDonePage + '-svg">' +
                '      <circle cx="-250.5" cy="249.5" r="12"></circle>' +
                '      <path d="M-256.46 249.65l3.9 3.74 8.02-7.8"></path>' +
                '    </g>' +
                '  </svg>' +
                '  <div>' +
                '    <div id="' + prefixCssDonePage + '-message"></div>' +
                '    <button id="' + prefixCssDonePage + '-close-button" class="button"></button>' +
                '  </div>' +
                '</div>'
            }
        },

        create: function (id, options) {
            var popup = new UiPopup();
            popup.init(id, options);

            return popup;
        }
    });
})();