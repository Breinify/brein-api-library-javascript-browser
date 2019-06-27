"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }

    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var prefixValidation = Breinify.UTL.constants.errors.prefix.validation;
    var prefixApi = Breinify.UTL.constants.errors.prefix.api;

    var prefixCssPopup = "breinify-popup";

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
            maxWidth: null,
            bindings: null
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

        this.id = id;
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

    UiPopup.prototype.hide = function (id) {
        $('html')
            .css('marginRight', '')
            .css('overflow', '');

        this.$popup.hide();
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
        if (this.currentPageNr <= 1) {
            return;
        } else {
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

        this.$popup.show();
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

        create: function (id, options) {
            var popup = new UiPopup();
            popup.init(id, options);

            return popup;
        }
    });
})();