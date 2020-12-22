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

    var _private = {
        resultCache: {},

        textResource: function (frameId, callback) {
            $.getJSON('https://assets.breinify.com/frame/' + frameId, function (data) {
                callback(null, data);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                callback({
                    error: prefixAssets + ' Unable to retrieve resource from "' + frameId + '"',
                    textStatus: textStatus,
                    responseText: jqXHR.responseText
                });
            });
        },

        /**
         * Determines the value behind a text-resource (<resourceType>.<resourceId>). Supports the usage of themes,
         * which allows that a theme is active at a specific time.
         * @param {string} frameId  the frameId
         * @param {string} resourceType the type of the resource to extract
         * @param {string} resourceId the id of the resource to extract
         * @param {function} callback the callback to fire after extraction
         * @param {number|optional} timestampInMs optional parameter which is used if themes are available (default: now)
         */
        determineTextResourceValue: function (frameId, resourceType, resourceId, callback, timestampInMs) {

            if (typeof resourceId !== 'string' || resourceId.trim() === '') {
                callback(null, null);
            } else if ($.isPlainObject(this.resultCache[frameId])) {
                this.extractResource(timestampInMs, resourceType, resourceId, this.resultCache[frameId], callback);
            } else {

                var _self = this;
                this.textResource(frameId, function (error, data) {

                    // if we have an error just return the fallback
                    if (error === null) {
                        _self.resultCache[frameId] = data;
                        _self.extractResource(timestampInMs, resourceType, resourceId, data, callback);
                    } else {
                        callback(null, null);
                    }
                });
            }
        },

        registerNamedResourcesImgObserver: function () {

            Breinify.UTL.dom.addModification('assets::namedResourcesImgObserver', {
                selector: 'img[data-frameId][data-resourceType][data-resourceId][data-frameLoaded!="true"]',
                modifier: function ($el) {
                    var frameId = $el.attr('data-frameId');
                    var resourceType = $el.attr('data-resourceType');
                    var resourceId = $el.attr('data-resourceId');
                    var fallbackSrc = $el.attr('data-fallbackSrc');

                    _self.determineTextResourceValue(frameId, resourceType, resourceId, function (result, themeId) {
                        if (typeof result === 'string' && result.trim() !== '') {
                            $el.attr('src', result);
                        } else if (typeof fallbackSrc === 'string' && fallbackSrc.trim() !== '') {
                            $el.attr('src', fallbackSrc);
                        } else {
                            $el.attr('src', '');
                        }

                        if ($el.attr('src').trim() !== '') {
                            $el.attr('data-frameLoaded', 'true').show();
                        }
                    });
                }
            })
        },

        extractResource: function (timestampInMs, resourceType, resourceId, data, callback) {
            var timestamp = Math.floor((typeof timestampInMs === 'number' ? timestampInMs : new Date().getTime()) / 1000);

            // determine which theme to use:
            //  - a theme is a higher level object which has a [start, end) defined in which it's valid
            var themeIds;
            if ($.isPlainObject(data.themes)) {
                var themeId = null;
                var themes = Object.keys(data.themes);
                for (var i = 0, lenThemes = themes.length; i < lenThemes; i++) {
                    var theme = data.themes[themes[i]];
                    var start = typeof theme.start === 'number' ? theme.start : null;
                    var end = typeof theme.end === 'number' ? theme.end : null;

                    if (start === null) {
                        // nothing to do
                    } else if (timestamp >= start && (end === null || timestamp < end)) {
                        themeId = themes[i];
                        break;
                    }
                }

                themeIds = data.fallbackThemes;
                themeIds = $.isArray(themeIds) ? themeIds : [];

                // add the selected themeId as the first to look at
                if (themeId !== null) {
                    themeIds = [themeId].concat(themeIds);
                }
                // if we do not have any themeIds we can stop right here
                else if (themeIds.length === 0) {
                    callback(null, null);
                    return;
                }
            } else {
                themeIds = [null];
            }

            for (var k = 0, lenThemeIds = themeIds.length; k < lenThemeIds; k++) {
                var possibleThemeId = themeIds[k];
                var possibleTheme = possibleThemeId === null ? data : data.themes[possibleThemeId];
                if (!$.isPlainObject(possibleTheme)) {
                    continue;
                }

                var possibleResource = possibleTheme[resourceType];
                if (!$.isPlainObject(possibleResource)) {
                    continue;
                }

                var possibleResult = possibleResource[resourceId];
                if (typeof possibleResult === 'string' && possibleResult.trim() !== '') {
                    callback(possibleResult, possibleThemeId);
                    return;
                }
            }

            // if we got so far we have no other chance
            callback(null, null);
        }
    };

    var Assets = {

        observeNamedResourceDomElements: function (options) {
            options = $.extend({
                imgObserver: true
            }, options);

            if (options.imgObserver === true) {
                _private.registerNamedResourcesImgObserver();
            }
        },

        textResource: function () {

            var _self = this;
            overload.overload({
                'String,Function': function (frameId, cb) {
                    _private.textResource(frameId, cb);
                },
                'String,String,String,Function,Number': function (frameId, resourceType, resourceId, cb, timestampInMs) {
                    _private.determineTextResourceValue(frameId, resourceType, resourceId, cb, timestampInMs);
                }
            }, arguments, this);
        }
    };

    // bind the observation if configured and Breinify is ready
    Breinify.onReady(function () {
        Assets.observeNamedResourceDomElements();
    });

    // bind the module
    Breinify.plugins._add('assets', Assets);
})();