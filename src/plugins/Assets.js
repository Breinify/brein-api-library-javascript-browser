"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('assets')) {
        return;
    }

    // bind the jQuery default object $
    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var prefixAssets = Breinify.UTL.constants.errors.prefix.assets;

    var Assets = {

        textResource: function () {

            var _self = this;
            overload.overload({
                'String,Function': function (frameId, cb) {
                    _self._textResource(frameId, cb);
                }
            }, arguments, this);
        },

        _textResource: function (frameId, callback) {
            $.getJSON('https://assets.breinify.com/frame/' + frameId, function (data) {
                callback(null, data);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                callback({
                    error: prefixAssets + ' Unable to retrieve resource from "' + frameId + '"',
                    textStatus: textStatus,
                    responseText: jqXHR.responseText
                });
            });
        }
    };

    // bind the module
    Breinify.plugins._add('assets', Assets);
})();