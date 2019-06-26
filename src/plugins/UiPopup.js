"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }

    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var prefixValidation = Breinify.UTL.constants.errors.prefix.validation;
    var prefixApi = Breinify.UTL.constants.errors.prefix.api;

    var prefix = "breinify-popup";
    var minHtml = "<div class=\"" + prefix + "\"><div class=\"" + prefix + "-content\"><div class=\"" + prefix + "-header\"><div style=\"display:inline-block\"></div><span class=\"" + prefix + "-close\">&times;</span></div><div class=\"" + prefix + "-pages\"></div><div class=\"" + prefix + "-footer\"></div></div></div>";
    var minCss = "<style id=\"" + prefix + "-style\">." + prefix + "{display:none;position:fixed;z-index:1;left:0;top:0;width:100%;height:100%;overflow:auto;background-color:#000;background-color:rgba(0,0,0,.4)}." + prefix + "-content>." + prefix + "-header{padding-bottom:0;min-height:16px}." + prefix + "-content{background-color:#fefefe;margin:15% auto;padding:0px;border:1px solid #888;width:80%}." + prefix + "-close{line-height:12px;vertical-align:top;color:#aaa;float:right;font-size:28px;font-weight:700}." + prefix + "-close:focus,." + prefix + "-close:hover{color:#000;text-decoration:none;cursor:pointer}." + prefix + "-content>div{padding:10px}." + prefix + "-page{border:1px solid #e7e7e7;border-radius:4px;background:#f8f8f8 none repeat scroll 0 0;padding:10px 13px}</style>";

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
            header: null,
            maxWidth: null
        }, options);

        // make sure we have the minimal CSS needed
        if ($('#' + prefix + '-style').length === 0) {
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
        var $close = this.$popup.find('.' + prefix + '-close');
        if (this.getOption('showClose') === true) {
            $close.show();
            $close.click(function () {
                _self.hide();
            });
        } else {
            $close.hide()
        }

        // check if we show the footer
        var $footer = this.$popup.find('.' + prefix + '-footer');
        if (this.getOption('showFooter') === true) {
            $footer.show();
        } else {
            $footer.hide()
        }

        // check the maxWidth
        var maxWidth = this.getOption('maxWidth');
        if (typeof maxWidth === 'number') {
            maxWidth = maxWidth + 'px';
        }
        if (typeof maxWidth === 'string') {
            var $content = this.$popup.find('.' + prefix + '-content');
            $content.css('maxWidth', maxWidth);
        }

        // set the header (using the options, explicit null)
        this.setHeader(null);

        this.id = id;
    };

    UiPopup.prototype.setBindings = function (bindings) {
        this.bindings = $.isPlainObject(bindings) ? bindings : {};
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

    UiPopup.prototype.addPage = function (page) {
        var $pagesContainer = this.$popup.find('.' + prefix + '-pages');
        var $page = $('<div class="' + prefix + '-page">' + page + '</div>');

        var pageNr = this.$pages.push($page);
        $page.attr('data-pageNr', pageNr);
        $page.hide();

        $pagesContainer.append($page);

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

        if (pageNr > 0) {
            var $page = this.$pages[pageNr - 1];
            this._applyBindings($page);
            $page.show();
        }

        this.currentPageNr = pageNr;

        $('html')
            .css('marginRight', '15px')
            .css('overflow', 'hidden');

        this.$popup.show();
    };

    UiPopup.prototype._applyBindings = function($el) {

    };

    UiPopup.prototype._resetBindings = function($el) {

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
            header = this.getOption('header');
        }

        var $header = this.$popup.find('.' + prefix + '-header>div:first');
        $header.text(header);
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