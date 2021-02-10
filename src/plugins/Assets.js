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

        determineDataTagsResourceValue: function (frameId, group, item, callback) {

            var _self = this;

            if (typeof group !== 'string' || group.trim() === '' ||
                typeof item !== 'string' || item.trim() === '') {
                callback(null, null);
            } else if ($.isPlainObject(this.resultCache[frameId])) {
                this.extractDataTagsSettings(group, item, this.resultCache[frameId], callback);
            } else if (typeof this.resultCache[frameId] === 'boolean') {

                if (this.resultCache[frameId] === true) {

                    // push it again in the execution loop
                    setTimeout(function () {
                        _self.determineDataTagsResourceValue(frameId, group, item, callback);
                    }, 10);
                } else {

                    // we had an error as result, so let's keep it
                    callback(null, null);
                }
            } else {

                // mark the resource to be in progress (to be loaded)
                this.resultCache[frameId] = true;

                // fire the query
                this.textResource(frameId, function (error, data) {

                    // if we have an error just return the fallback
                    if (error === null) {
                        _self.resultCache[frameId] = data;
                        _self.extractDataTagsSettings(group, item, data, callback);
                    } else {
                        _self.resultCache[frameId] = false;
                        callback(null, null);
                    }
                });
            }
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
            var _self = this;

            if (typeof resourceId !== 'string' || resourceId.trim() === '') {
                callback(null, null);
            } else if ($.isPlainObject(this.resultCache[frameId])) {
                this.extractResource(timestampInMs, resourceType, resourceId, this.resultCache[frameId], callback);
            } else if (typeof this.resultCache[frameId] === 'boolean') {

                if (this.resultCache[frameId] === true) {

                    // push it again in the execution loop
                    setTimeout(function () {
                        _self.determineTextResourceValue(frameId, resourceType, resourceId, callback, timestampInMs);
                    }, 10);
                } else {

                    // we had an error as result, so let's keep it
                    callback(null, null);
                }
            } else {

                // mark the resource to be in progress (to be loaded)
                this.resultCache[frameId] = true;

                // fire the query
                this.textResource(frameId, function (error, data) {

                    // if we have an error just return the fallback
                    if (error === null) {
                        _self.resultCache[frameId] = data;
                        _self.extractResource(timestampInMs, resourceType, resourceId, data, callback);
                    } else {
                        _self.resultCache[frameId] = false;
                        callback(null, null);
                    }
                });
            }
        },

        registerNamedResourcesDataTagsObserver: function () {
            var _self = this;

            Breinify.UTL.dom.addModification('assets::namedResourcesDataTagsObserver', {
                selector: '[data-frameId][data-personalize-group][data-personalize-item][data-personalize-value][data-frameLoaded!="true"]',
                modifier: function ($els) {
                    $els.each(function () {

                        // get the values from the element
                        var $el = $(this);
                        var frameId = $el.attr('data-frameId');
                        var group = $el.attr('data-personalize-group');
                        var item = $el.attr('data-personalize-item');
                        var value = $el.attr('data-personalize-value');
                        var modifications = value.split(/\s*,\s*/);

                        _self.determineDataTagsResourceValue(frameId, group, item, function (dataTags) {
                            _self.applyDataTagsModifications($el, dataTags, modifications);
                            $el.attr('data-frameLoaded', 'true').show();
                        });
                    });
                }
            })
        },

        applyDataTagsModifications: function ($el, dataTags, modifications) {

            if (!$.isArray(modifications) || modifications.length === 0) {
                return;
            } else if (!$.isArray(dataTags)) {
                return;
            }

            console.log(dataTags);
            console.log(modifications);

            for (var i = 0; i < dataTags.length; i++) {
                var dataTag = dataTags[i];
                if (!$.isPlainObject(dataTag)) {
                    continue;
                }

                // check if we are on the right journey
                var journey = typeof dataTag.journey === 'string' && dataTag.journey.trim() !== '' ? dataTag.journey : null;
                if (journey !== null && !Journey.is(journey)) {
                    continue;
                }

                // apply the defined modifications
                for (var k = 0; k < modifications.length; k++) {
                    var modification = modifications[k];
                    var modificationValue = typeof dataTag[modification] === 'undefined' ? null : dataTag[modification];

                    this.applyDataTagsModification($el, modification, modificationValue);
                }
            }
        },

        applyDataTagsModification: function ($el, modification, modificationValue) {
            if (modificationValue === null) {
                return;
            }

            console.log(modification);
            console.log(modificationValue);
        },

        registerNamedResourcesImgObserver: function () {
            var _self = this;

            Breinify.UTL.dom.addModification('assets::namedResourcesImgObserver', {
                selector: 'img[data-frameId][data-resourceType][data-resourceId][data-frameLoaded!="true"]',
                modifier: function ($els) {
                    $els.each(function () {
                        var $el = $(this);
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
                    });
                }
            })
        },

        extractDataTagsSettings: function (data, group, item, callback) {
            data = $.isPlainObject(data) ? data : {};
            var dataGroup = $.isPlainObject(data[group]) ? data[group] : {};
            var dataItem = $.isPlainObject(dataGroup[item]) ? dataGroup[item] : {};

            callback(null, dataItem);
        },

        extractResource: function (timestampInMs, resourceType, resourceId, data, callback) {

            var timestamp;
            if (typeof timestampInMs === 'number') {
                timestamp = Math.floor(timestampInMs / 1000);
            } else if (Breinify.UTL.loc.hasParam('assetTimestamp')) {
                var paramTimestampInSec = Breinify.UTL.loc.param('assetTimestamp');
                if (/[0-9]+/.test(paramTimestampInSec)) {
                    timestamp = parseInt(paramTimestampInSec);
                }
            }
            timestamp = typeof timestamp === 'number' ? timestamp : Math.floor(new Date().getTime() / 1000);

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
                imgObserver: this.getConfig('observeImages', false),
                dataTagsObserver: this.getConfig('observeDataTags', false)
            }, options);

            if (options.imgObserver === true) {
                _private.registerNamedResourcesImgObserver();
            }

            if (options.dataTagsObserver === true) {
                _private.registerNamedResourcesDataTagsObserver();
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

    // bind the module
    var BoundAssets = Breinify.plugins._add('assets', Assets);

    // bind the observation if configured and Breinify is ready
    Breinify.onReady(function () {
        BoundAssets.observeNamedResourceDomElements();
    });
})();