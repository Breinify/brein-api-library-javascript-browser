"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }

    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var prefixValidation = Breinify.UTL.constants.errors.prefix.validation;
    var prefixApi = Breinify.UTL.constants.errors.prefix.api;

    var popupPrefix = "breinify-popup";
    var alertMePrefix = 'breinify-alert-me';

    var minHtml = "<div class=\"" + popupPrefix + "\"><div class=\"" + popupPrefix + "-content\"><div class=\"" + popupPrefix + "-header\"><div style=\"display:inline-block\"></div><span class=\"" + popupPrefix + "-close\">&times;</span></div><div class=\"" + popupPrefix + "-pages\"></div><div class=\"" + popupPrefix + "-footer\"></div></div></div>";
    var minCss = "<style id=\"" + popupPrefix + "-style\">." + popupPrefix + "{display:none;position:fixed;z-index:1000;left:0;top:0;width:100%;height:100%;overflow:auto;background-color:#000;background-color:rgba(0,0,0,.4)}." + popupPrefix + "-content>." + popupPrefix + "-header{padding-bottom:0;min-height:16px}." + popupPrefix + "-content{position:relative;background-color:#fefefe;margin:15% auto;padding:0px;border:1px solid #888;width:80%}." + popupPrefix + "-close{position:absolute;right:10px;top:10px;line-height:12px;vertical-align:top;color:#aaa;float:right;font-size:28px;font-weight:700}." + popupPrefix + "-close:focus,." + popupPrefix + "-close:hover{color:#000;text-decoration:none;cursor:pointer}." + popupPrefix + "-content>div{padding:10px}." + popupPrefix + "-page{border:1px solid #e7e7e7;border-radius:4px;background:#f8f8f8 none repeat scroll 0 0;padding:10px 13px}</style>";

    var defaultPages = {
        'loading': '',
        'success': '',
        'error': '',
        'setAlert': '' +
        '<div style="color:#000;font-size:13px;line-height:17px;">' +
        '   <div>You are about to set an alert to be informed via text message when <b data-breinify-placeholder=\"product.name\"></b> will be available at <span data-breinify-placeholder=\"company.name\"></span> within the next <span data-breinify-placeholder=\"settings.alertExpiresInDays\"></span> days. Setting an alert does not reserve the product, it notifies you when it is available.</div>' +
        '   <div style="padding:10px 0 0 0">Please provide the following information:</div>' +
        '   <div style="padding:10px 0 0 0">' +
        '       <div style="margin-bottom:5px"><label style="font-weight:bold" for=\"' + alertMePrefix + '-mobile-number\">Mobile Number:</label></div>  ' +
        '       <div><input style="font-size:inherit;font-family:inherit;color:#000;box-sizing:border-box;max-width:450px;width:100%;height:40px;padding: 0 8px;background-color:#fff;border-radius:5px;border:1px solid #999999" id=\"' + alertMePrefix + '-mobile-number\" type=\"text\" placeholder=\"(xxx) xxx-xxxx\" autocomplete=\"off\" maxlength=\"14\" data-alert-me-visualize-error=\"false\"></div>' +
        '   </div>' +
        '   <div style="padding:10px 0 0 0">' +
        '       <div style="margin-bottom:5px"><label style="font-weight:bold" for=\"' + alertMePrefix + '-alert-time\">Alert-Time (when available):</label></div>  ' +
        '       <div><select style="-moz-appearance:none;-webkit-appearance:none;font-size:inherit;font-family:inherit;color:#000;box-sizing:border-box;max-width:450px;width:100%;height:40px;padding: 0 8px;background:#fff no-repeat 98% 50%;border-radius:5px;border:1px solid #999999" id=\"' + alertMePrefix + '-alert-time\">' +
        '           <option value=\"0|24|-1\">anytime, as soon as available</option>' +
        '           <option value=\"9|18|-1\">between 9:00am - 6:00pm</option>' +
        '           <option value=\"9|12|-1\">between 9:00am - noon</option>' +
        '           <option value=\"12|18|-1\">between noon - 6:00pm</option>' +
        '           <option value=\"9|18|0\">between 9:00am - 6:00pm (weekdays only)</option>' +
        '           <option value=\"9|18|1\">between 9:00am - 6:00pm (weekends only)</option>' +
        '           <option value=\"9|12|0\">between 9:00am - noon (weekdays only)</option>' +
        '           <option value=\"9|12|1\">between 9:00am - noon (weekends only)</option>' +
        '           <option value=\"12|18|0\">between noon - 6:00pm (weekdays only)</option>' +
        '           <option value=\"12|18|1\">between noon - 6:00pm (weekends only)</option>' +
        '       </select></div>' +
        '   </div>' +
        '   <div style="padding:10px 0 0 0;font-size:10px;line-height:13px;font-weight:400;color:#222222;">By setting this alert, you confirm that the entered mobile number is yours and that you consent to receive text messages to inform you about the alert. By providing your mobile number and signing up for alerts you agree to receive text messages that may be deemed marketing under applicable law, and that these messages may be sent using an autodialer. Your consent is not a condition of any purchase. Setting an alert is not a reservation of a product.</div>' +
        '   <div style="padding:10px 0 0 0;text-align:center;">' +
        '       <button id=\"' + alertMePrefix + '-set-alert\" style=\"min-width:150px;width:50%;white-space:nowrap;cursor:pointer;line-height:25px;font-size:14px;border-radius:4px;border-color:#de0000;background:#de0000;color:#fff;\" type=\"submit\" title=\"Set Alert\" disabled=\"\"><span>Set Alert</span></button>' +
        '   </div>' +
        '</div>'
    };

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
            maxWidth: null,
            bindings: null
        }, options);

        // make sure we have the minimal CSS needed
        if ($('#' + popupPrefix + '-style').length === 0) {
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
        var $close = this.$popup.find('.' + popupPrefix + '-close');
        if (this.getOption('showClose', true) === true) {
            $close.show();
            $close.click(function () {
                _self.hide();
            });
        } else {
            $close.hide()
        }

        // check if we show the footer
        var $footer = this.$popup.find('.' + popupPrefix + '-footer');
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
            var $content = this.$popup.find('.' + popupPrefix + '-content');
            $content.css('maxWidth', maxWidth);
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

    UiPopup.prototype.setBindings = function (bindings) {
        this.bindings = $.isPlainObject(bindings) ? bindings : this.getOption('bindings', {});
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
        var $pagesContainer = this.$popup.find('.' + popupPrefix + '-pages');
        var $page = $('<div class="' + popupPrefix + '-page">' + page + '</div>');

        var pageNr = this.$pages.push($page);
        $page.attr('data-pageNr', pageNr);
        $page.hide();

        $pagesContainer.append($page);

        return $page;
    };

    UiPopup.prototype.addDefaultPage = function (id) {
        var page = defaultPages[id];
        if (typeof page === 'string') {
            return this.addPage(page);
        } else {
            return null;
        }
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

        var $header = this.$popup.find('.' + popupPrefix + '-header>div:first');
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