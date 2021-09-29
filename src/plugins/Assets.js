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
    var Journey = Breinify.plugins.journey;

    var prefixAssets = Breinify.UTL.constants.errors.prefix.assets;

    var _private = {
        resultCache: {},

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
        },

        textResource: function (frameId, callback) {
            var _self = this;

            if ($.isPlainObject(this.resultCache[frameId])) {
                callback(null, this.resultCache[frameId]);
            } else if (typeof this.resultCache[frameId] === 'boolean') {

                if (this.resultCache[frameId] === true) {

                    // push it again in the execution loop
                    setTimeout(function () {
                        _self.textResource(frameId, callback);
                    }, 10);
                } else {

                    // we had an error as result, so let's keep it
                    callback(null, null);
                }
            } else {

                // mark the resource to be in progress (to be loaded)
                this.resultCache[frameId] = true;

                // fire the query
                this._textResource(frameId, function (error, data) {

                    // if we have an error just return the fallback
                    if (error === null) {
                        _self.resultCache[frameId] = data;
                        callback(null, data);
                    } else {
                        _self.resultCache[frameId] = false;
                        callback(null, null);
                    }
                });
            }
        },

        determineDataTagsResourceValue: function (frameId, group, item, callback) {

            var _self = this;

            if (typeof group !== 'string' || group.trim() === '' ||
                typeof item !== 'string' || item.trim() === '') {
                callback(null, null);
            } else {

                this.textResource(frameId, function (error, data) {

                    // if we have an error just return the fallback
                    if (error === null) {
                        _self.extractDataTagsSettings(group, item, data, callback);
                    } else {
                        callback(null, null);
                    }
                });
            }
        },

        determineTextResourceValues: function (frameId, resourceType, resourceIds, callback, timestampInMs) {
            var _self = this;

            var results = {};
            var counter = 0;
            for (var i = 0; i < resourceIds.length; i++) {
                _self._bindTextResourceValue(frameId, resourceType, resourceIds[i], function (resourceId, result, themeId) {
                    results[resourceId] = {
                        value: result,
                        themeId: themeId
                    };

                    if (++counter === resourceIds.length) {
                        callback(results);
                    }
                }, timestampInMs);
            }
        },

        _bindTextResourceValue: function (frameId, resourceType, resourceId, callback, timestampInMs) {
            this.determineTextResourceValue(frameId, resourceType, resourceId, function (result, themeId) {
                callback(resourceId, result, themeId);
            }, timestampInMs);
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
            } else {

                this.textResource(frameId, function (error, data) {

                    // if we have an error just return the fallback
                    if (error === null) {
                        _self.extractResource(timestampInMs, resourceType, resourceId, data, callback);
                    } else {
                        callback(null, null);
                    }
                });
            }
        },

        registerNamedResourcesDataTagsObserver: function () {
            var _self = this;

            Breinify.UTL.dom.addModification('assets::namedResourcesDataTagsObserver', {
                selector: '[data-frameId][data-personalize-group][data-personalize-item][data-personalize-value][data-personalize-loaded!="true"]',
                modifier: function ($els) {
                    $els.each(function () {

                        // get the values from the element
                        var $el = $(this);
                        var frameId = $el.attr('data-frameId');
                        var group = $el.attr('data-personalize-group');
                        var item = $el.attr('data-personalize-item');
                        var value = $el.attr('data-personalize-value');
                        var modifications = value.split(/\s*,\s*/);

                        _self.determineDataTagsResourceValue(frameId, group, item, function (error, dataTags) {
                            if (error === null) {
                                _self.applyDataTagsModifications($el, dataTags, modifications);

                                if ($el.attr('data-personalize-show') === 'true') {
                                    $el.show();
                                }
                            }

                            // mark it as loaded (even with an error, why would it go away)
                            $el.attr('data-personalize-loaded', 'true');
                        });
                    });
                }
            });
        },

        areDataTagsEnabled: function (data, group, item) {

            var dataTags = this.extractDataTagsSettings(group, item, data);

            for (var i = 0; i < dataTags.length; i++) {
                var dataTag = dataTags[i];

                // make sure we have a valid dataTag
                if (!$.isPlainObject(dataTag)) {
                    continue;
                }

                // check if we are on the right journey
                var journey = $.isArray(dataTag.journey) ? dataTag.journey : null;
                if (journey !== null && !Journey.is(journey)) {
                    continue;
                }

                if (this.isDataTagEnabled(dataTag, ['enabled']) === false) {
                    return false;
                }
            }

            return true;
        },

        isDataTagEnabled: function (dataTag, modifications) {

            if ($.inArray('enabled', modifications) === -1) {
                return true;
            } else {
                return typeof dataTag['enabled'] === 'boolean' ? dataTag['enabled'] : false;
            }
        },

        applyDataTagsModifications: function ($el, dataTags, modifications) {

            if (!$.isArray(modifications) || modifications.length === 0) {
                return;
            } else if (!$.isArray(dataTags)) {
                return;
            }

            for (var i = 0; i < dataTags.length; i++) {
                var dataTag = dataTags[i];
                if (!$.isPlainObject(dataTag)) {
                    continue;
                }

                // check if we are on the right journey
                var journey = $.isArray(dataTag.journey) ? dataTag.journey : null;
                if (journey !== null && !Journey.is(journey)) {
                    continue;
                }

                // check if we have an enabled set
                if (this.isDataTagEnabled(dataTag, modifications) === false) {
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

            if ('text' === modification) {
                $el.text(modificationValue);
            } else if ('html' === modification) {
                $el.html(modificationValue);
            } else if ('font-color' === modification) {
                $el.css('color', modificationValue);
            } else if ('background-color' === modification) {
                $el.css('background-color', modificationValue);
            } else if ('style' === modification) {
                $el.attr('style', modificationValue);
            } else if ('link' === modification || 'href' === modification) {
                $el.attr('href', modificationValue);
            } else if ('image' === modification || 'src' === modification) {
                $el.attr('src', modificationValue);
            } else if ('alt' === modification) {
                $el.attr('alt', modificationValue);
            } else if ('title' === modification) {
                $el.attr('title', modificationValue);
            } else if ('source' === modification) {
                $el.attr('src', modificationValue);
            } else if ('enabled' === modification) {
                // already checked
            } else {
                console.log('Unknown modification: ' + modification);
            }
        },

        registerNamedResourcesImgObserver: function () {
            var _self = this;

            Breinify.UTL.dom.addModification('assets::namedResourcesImgObserver', {
                selector: 'img[data-frameId][data-resourceType][data-resourceId][data-resourceLoaded!="true"]',
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
                                $el.attr('data-resourceLoaded', 'true').show();
                            }
                        });
                    });
                }
            })
        },

        extractDataTagsSettings: function (group, item, data, callback) {
            data = $.isPlainObject(data) ? data : {};
            var allDataTags = $.isPlainObject(data['data-tags']) ? data['data-tags'] : {};

            // determine the group, if there is a separator we have to split and determine by sub-groups
            var dataGroup;
            if (group.indexOf('.') > 0) {
                dataGroup = allDataTags;

                var subGroups = group.split('\.');
                for (var i = 0; i < subGroups.length; i++) {
                    var subGroup = subGroups[i];
                    if ($.isPlainObject(dataGroup[subGroup])) {
                        dataGroup = dataGroup[subGroup];
                    } else {
                        dataGroup = {};
                        break;
                    }
                }
            } else {
                dataGroup = $.isPlainObject(allDataTags[group]) ? allDataTags[group] : {};
            }

            var dataTags;
            if ($.isArray(dataGroup[item])) {
                dataTags = dataGroup[item];
            } else if ($.isPlainObject(dataGroup[item])) {
                dataTags = [dataGroup[item]];
            } else {
                dataTags = [];
            }

            if ($.isFunction(callback)) {
                callback(null, dataTags);
            }

            // we also return the item since this can be used synchronized as well
            return dataTags;
        },

        parseDate: function (strDate) {
            var parts = strDate.split('\/');

            var year = parseInt(parts[0]);
            var month = parseInt(parts[1]);
            var day = parseInt(parts[2]);

            var date = new Date();
            date.setFullYear(year);
            date.setMonth(month - 1);
            date.setDate(day);
            date.setHours(0);
            date.setMinutes(0);
            date.setSeconds(0);
            date.setMilliseconds(0);

            return Math.floor(date.getTime() / 1000);
        },

        parseDateTime: function (strDate, strTime) {
            var timestamp = this.parseDate(strDate);
            var date = new Date(timestamp * 1000);

            var parts = strTime.split(':');
            var hours = parseInt(parts[0]);
            var minutes = parseInt(parts[1]);
            var seconds = parseInt(parts[2]);

            date.setHours(hours);
            date.setMinutes(minutes);
            date.setSeconds(seconds);
            date.setMilliseconds(0);

            return Math.floor(date.getTime() / 1000);
        },

        extractResource: function (timestampInMs, resourceType, resourceId, data, callback) {

            var timestamp;
            if (typeof timestampInMs === 'number') {
                timestamp = Math.floor(timestampInMs / 1000);
            } else if (Breinify.UTL.loc.hasParam('assetTimestamp')) {
                try {
                    var assetTimestamp = Breinify.UTL.loc.param('assetTimestamp');
                    if (/^[0-9]+$/.test(assetTimestamp)) {
                        timestamp = parseInt(assetTimestamp);
                    } else if (/^[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}$/.test(assetTimestamp)) {
                        timestamp = this.parseDate(assetTimestamp);
                    } else if (/^[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}[_\- ][0-9]{1,2}:[0-9]{1,2}:[0-9]{1,2}$/.test(assetTimestamp)) {
                        var parts = assetTimestamp.split(/[_\- ]/);
                        timestamp = this.parseDateTime(parts[0], parts[1]);
                    }
                } catch (e) {
                    console.log('Failed to parse: ' + assetTimestamp);
                    timestamp = null;
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
                if (typeof possibleResult !== 'undefined' && possibleResult !== null &&
                    (typeof possibleResult !== 'string' || possibleResult.trim() !== '')) {
                    callback(possibleResult, possibleThemeId);
                    return;
                }
            }

            // if we got so far we have no other chance
            callback(null, null);
        }
    };

    var Assets = {

        applyDataTagsModifications: function ($el, dataTags) {
            var value = $el.attr('data-personalize-value');
            var modifications = value.split(/\s*,\s*/);

            _private.applyDataTagsModifications($el, dataTags, modifications);

            // show it if marked
            if ($el.attr('data-personalize-show') === 'true') {
                $el.show();
            }

            // mark it as loaded
            $el.attr('data-personalize-loaded', 'true');
        },

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

        areDataTagsEnabled: function () {
            return overload.overload({
                'Object,Object': function (data, res) {
                    return _private.areDataTagsEnabled(data, res.group, res.item, cb);
                },
                'Object,String,String': function (data, group, item) {
                    return _private.areDataTagsEnabled(data, group, item);
                }
            }, arguments, this);
        },

        textResource: function () {
            overload.overload({
                'Object,Function': function (res, cb) {
                    _private.textResource(res.frameId, cb);
                },
                'String,Function': function (frameId, cb) {
                    _private.textResource(frameId, cb);
                },
                'String,String,String,Function,Number': function (frameId, resourceType, resourceId, cb, timestampInMs) {
                    _private.determineTextResourceValue(frameId, resourceType, resourceId, cb, timestampInMs);
                },
                'String,String,Array,Function,Number': function (frameId, resourceType, resourceId, cb, timestampInMs) {
                    _private.determineTextResourceValues(frameId, resourceType, resourceId, cb, timestampInMs);
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