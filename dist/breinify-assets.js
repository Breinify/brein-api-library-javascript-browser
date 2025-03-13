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
    const $ = Breinify.UTL._jquery();
    const overload = Breinify.plugins._overload();
    const Journey = Breinify.plugins.journey;

    const prefixAssets = Breinify.UTL.constants.errors.prefix.assets;

    const _private = {
        marker: {
            mappedResourceType: {
                image: 'image'
            },
            mappedResourceData: {
                settings: 'br-mapped-resource-data'
            }
        },
        resultCache: {},
        resourceAutoRefresh: {
            handler: null,
            resources: []
        },


        _textResource: function (frameId, timestamp, callback) {
            let url = 'https://assets.breinify.com/frame/' + frameId;

            if (typeof timestamp === 'number' && /^\d{10}$/.test(timestamp.toString())) {
                url += '/' + timestamp;
            }

            $.getJSON(url, function (data) {
                callback(null, data);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                callback({
                    error: prefixAssets + ' Unable to retrieve resource from "' + frameId + '"',
                    textStatus: textStatus,
                    responseText: jqXHR.responseText
                });
            });
        },

        textResource: function (frameId, timestamp, callback) {
            const _self = this;

            // make sure the timestamp is valid
            if (typeof timestamp !== 'number' || timestamp.toString().length !== 10) {
                timestamp = null;
            }

            let cacheKey = frameId + (timestamp === null ? '' : '/' + timestamp);
            if ($.isPlainObject(this.resultCache[cacheKey])) {
                callback(null, this.resultCache[cacheKey]);
            } else if (typeof this.resultCache[cacheKey] === 'boolean') {

                if (this.resultCache[cacheKey] === true) {

                    // push it again in the execution loop
                    setTimeout(function () {
                        _self.textResource(frameId, timestamp, callback);
                    }, 10);
                } else {

                    // we had an error as result, so let's keep it
                    callback(null, null);
                }
            } else {

                // mark the resource to be in progress (to be loaded)
                this.resultCache[cacheKey] = true;

                // fire the query
                this._textResource(frameId, timestamp, function (error, data) {

                    // if we have an error just return the fallback
                    if (error === null) {
                        _self.resultCache[cacheKey] = data;
                        callback(null, data);
                    } else {
                        _self.resultCache[cacheKey] = false;
                        callback(null, null);
                    }
                });
            }
        },

        determineDataTagsResourceValue: function (frameId, group, item, callback) {

            const _self = this;

            if (typeof group !== 'string' || group.trim() === '' ||
                typeof item !== 'string' || item.trim() === '') {
                callback(null, null);
            } else {

                this.textResource(frameId, null, function (error, data) {

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
            const _self = this;

            let results = {};
            let counter = 0;
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
            const _self = this;

            if (typeof resourceId !== 'string' || resourceId.trim() === '') {
                callback(null, null);
            } else {

                this.textResource(frameId, null, function (error, data) {

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
            const _self = this;

            Breinify.UTL.dom.addModification('assets::namedResourcesDataTagsObserver', {
                selector: '[data-frameId][data-personalize-group][data-personalize-item][data-personalize-value][data-personalize-loaded!="true"]',
                modifier: function ($els) {
                    $els.each(function () {

                        // get the values from the element
                        let $el = $(this);
                        let frameId = $el.attr('data-frameId');
                        let group = $el.attr('data-personalize-group');
                        let item = $el.attr('data-personalize-item');
                        let value = $el.attr('data-personalize-value');
                        let modifications = value.split(/\s*,\s*/);

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

        registerMapResourcesDataTagsObserver: function () {
            const _self = this;

            Breinify.UTL.dom.addModification('assets::mapResourcesDataTagsObserver', {
                selector: '[data-mapId][data-personalize-loaded!="true"]',
                modifier: function ($els) {
                    $els.each(function () {
                        const $el = $(this);

                        _self._renderMappedResource($el);
                        $el.attr('data-personalize-loaded', 'true');
                    });
                }
            });
        },

        refreshMappedResource: function ($el, settings) {
            const data = $el.data(this.marker.mappedResourceData.settings);

            // mapId was no string and empty
            if (!$.isPlainObject(data) || typeof data.mapId !== 'string' || data.mapId === '') {
                return;
            }

            const source = this._createSource(data.mapId, settings);
            $el.removeAttr('src');
            $el.attr('src', source);

            data.source = source;
        },

        _renderMappedResource: function ($el) {
            const _self = this;

            // make sure we have a valid mapId, otherwise there is nothing to do
            let mapId = $el.attr('data-mapId');
            if (typeof mapId !== 'string' || mapId.trim() === '') {
                return;
            }

            // determine the type (if we do not have one)
            let type = $el.attr('data-type');
            if (typeof type === 'string' && type.trim() !== '') {
                // nothing to do we already have a valid type
            } else if ($el.is('a')) {
                type = 'link';
            } else if ($el.is('img')) {
                type = 'image';
            } else {
                return;
            }

            // create the source
            const source = this._createSource(mapId);

            // create an identifier
            let resourceId = $el.attr('id');
            resourceId = typeof resourceId === 'string' && resourceId.trim() !== '' ? resourceId : Breinify.UTL.uuid();

            // create the data object we attach to the element
            const data = {
                type: type,
                resourceId: resourceId,
                mapId: mapId,
                source: source
            };

            // apply the type
            let $newEl = null;
            if (type === this.marker.mappedResourceType.image) {
                if ($el.is('img')) {
                    $newEl = $el;
                    $newEl.attr('src', source);
                } else {
                    $newEl = $('<img src="" alt="" />');
                    $newEl.attr('class', $el.attr('class'))
                        .attr('style', $el.attr('style'))
                        .attr('alt', $el.attr('data-alt'))
                        .attr('src', source);

                    $el.replaceWith($newEl);
                }
            }

            // apply some default attributes
            if ($newEl !== null) {
                $newEl.attr('id', resourceId);
                $newEl.data(this.marker.mappedResourceData.settings, data);
                $newEl.show();
            }

            const autoRefresh = $el.attr('data-auto-refresh') === 'true';
            if (autoRefresh === true) {
                if (this.resourceAutoRefresh.handler === null) {
                    this.resourceAutoRefresh.handler = window.setInterval(function () {
                        _self._checkAutoRefresh();
                    }, 1000);
                }

                this.resourceAutoRefresh.resources.push(resourceId);
                this._checkAutoRefresh();
            }
        },

        _createSource: function (mapId, settings) {

            // add the date instance (format yyyyMMdd HHmmss)
            const curDate = new Date();
            const yyyy = curDate.getFullYear();
            const MM = ('0' + (curDate.getMonth() + 1)).slice(-2);
            const dd = ('0' + curDate.getDate()).slice(-2);
            const HH = ('0' + curDate.getHours()).slice(-2);
            // we only care about the full hour so 110000 instead of 113254, to avoid unneeded loading
            const mm = '00'; // ('0' + curDate.getMinutes()).slice(-2);
            const ss = '00'; //('0' + curDate.getSeconds()).slice(-2);

            // get and modify the user object (we do not want all the additional information, just the user info)
            const user = Breinify.UTL.user.create();
            delete user.additional;

            // determine the values
            const date = yyyy + MM + dd + ' ' + HH + mm + ss;
            const browserId = Breinify.UTL.user.getBrowserId();

            // build the whole thing, we add back the browserId
            const data = $.extend(true, {
                date: date,
                additional: {
                    identifiers: {
                        browserId: browserId
                    }
                }
            }, user, $.isPlainObject(settings) ? settings : {});

            // encode the data instance
            let suffix = '/J/';
            try {
                const json = JSON.stringify(data);
                const base64Json = btoa(json);
                const urlFriendlyJson = base64Json.replaceAll('+', '~')
                    .replaceAll('/', '-')
                    .replaceAll('=', '_');
                suffix += urlFriendlyJson;
            } catch (e) {

                // use default if it didn't work
                suffix = '';
            }

            return 'https://assets.breinify.com/mappedResource/' + mapId + suffix;
        },

        _checkAutoRefresh: function () {

            for (let i = this.resourceAutoRefresh.resources.length - 1; i >= 0; i--) {
                const resourceId = this.resourceAutoRefresh.resources[i];
                const $resource = $('#' + resourceId);

                // cleanup if we have to
                if (this._checkElementAutoRefresh($resource) === false) {
                    this.resourceAutoRefresh.resources.splice(i, 1);
                }
            }
        },

        _checkElementAutoRefresh: function ($resource) {
            if ($resource.length === 0) {
                return false;
            }

            const data = $resource.data(this.marker.mappedResourceData.settings);
            if (!$.isPlainObject(data) || typeof data.mapId !== 'string') {
                return false;
            }

            // determine the new source, if it changed apply it otherwise nothing to change
            const newSource = this._createSource(data.mapId);
            if (data.source === newSource) {
                return true;
            } else if (data.type === this.marker.mappedResourceType.image) {
                $resource.attr('src', newSource);
                data.source = newSource;

                return true;
            } else {
                return false;
            }
        },

        areDataTagsEnabled: function (data, group, item) {

            // check if data is even present
            if (!$.isPlainObject(data)) {
                return false;
            }

            let dataTags = this.extractDataTagsSettings(group, item, data);

            for (var i = 0; i < dataTags.length; i++) {
                let dataTag = dataTags[i];

                // make sure we have a valid dataTag
                if (!$.isPlainObject(dataTag)) {
                    continue;
                }

                // check if we are on the right journey
                let journey = $.isArray(dataTag.journey) ? dataTag.journey : null;
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
                let dataTag = dataTags[i];
                if (!$.isPlainObject(dataTag)) {
                    continue;
                }

                // check if we are on the right journey
                let journey = $.isArray(dataTag.journey) ? dataTag.journey : null;
                if (journey !== null && !Journey.is(journey)) {
                    continue;
                }

                // check if we have an enabled set
                if (this.isDataTagEnabled(dataTag, modifications) === false) {
                    continue;
                }

                // apply the defined modifications
                for (var k = 0; k < modifications.length; k++) {
                    let modification = modifications[k];
                    let modificationValue = typeof dataTag[modification] === 'undefined' ? null : dataTag[modification];

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

        registerNamedResourcesResourceObserver: function () {
            const _self = this;

            Breinify.UTL.dom.addModification('assets::namedResourcesResourceObserver', {
                selector: '[data-frameId][data-resourceType][data-resourceId][data-resourceLoaded!="true"]',
                modifier: function ($els) {
                    $els.each(function () {
                        let $el = $(this);
                        let frameId = $el.attr('data-frameId');
                        let resourceType = $el.attr('data-resourceType');
                        let resourceId = $el.attr('data-resourceId');

                        _self.determineTextResourceValue(frameId, resourceType, resourceId, function (result, themeId) {
                            _self.applyResourceModification($el, result);
                        });
                    });
                }
            })
        },

        applyResourceModification: function ($el, result) {
            let value = typeof result === 'string' && result.trim() !== '' ? result : null;

            if ($el.is('img')) {
                value = value === null ? $el.attr('data-fallbackSrc') : value;
                this.applyDataTagsModification($el, 'src', value);
            } else if ($el.is('a')) {
                value = value === null ? $el.attr('data-fallbackHref') : value;
                this.applyDataTagsModification($el, 'link', value);
            }

            if (value !== null && value !== '') {
                $el.attr('data-resourceLoaded', 'true').show();
            }
        },

        extractDataTagsSettings: function (group, item, data, callback) {
            data = $.isPlainObject(data) ? data : {};
            let allDataTags = $.isPlainObject(data['data-tags']) ? data['data-tags'] : {};

            // determine the group, if there is a separator we have to split and determine by sub-groups
            let dataGroup;
            if (group.indexOf('.') > 0) {
                dataGroup = allDataTags;

                let subGroups = group.split('\.');
                for (var i = 0; i < subGroups.length; i++) {
                    let subGroup = subGroups[i];
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

            let dataTags;
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
            let parts = strDate.split('\/');

            let year = parseInt(parts[0]);
            let month = parseInt(parts[1]);
            let day = parseInt(parts[2]);

            let date = new Date();
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
            let timestamp = this.parseDate(strDate);
            let date = new Date(timestamp * 1000);

            let parts = strTime.split(':');
            let hours = parseInt(parts[0]);
            let minutes = parseInt(parts[1]);
            let seconds = parseInt(parts[2]);

            date.setHours(hours);
            date.setMinutes(minutes);
            date.setSeconds(seconds);
            date.setMilliseconds(0);

            return Math.floor(date.getTime() / 1000);
        },

        extractResource: function (timestampInMs, resourceType, resourceId, data, callback) {

            let timestamp;
            if (typeof timestampInMs === 'number') {
                timestamp = Math.floor(timestampInMs / 1000);
            } else if (Breinify.UTL.loc.hasParam('assetTimestamp')) {
                try {
                    let assetTimestamp = Breinify.UTL.loc.param('assetTimestamp');
                    if (/^[0-9]+$/.test(assetTimestamp)) {
                        timestamp = parseInt(assetTimestamp);
                    } else if (/^[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}$/.test(assetTimestamp)) {
                        timestamp = this.parseDate(assetTimestamp);
                    } else if (/^[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}[_\- ][0-9]{1,2}:[0-9]{1,2}:[0-9]{1,2}$/.test(assetTimestamp)) {
                        let parts = assetTimestamp.split(/[_\- ]/);
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
            let themeIds;
            if ($.isPlainObject(data.themes)) {
                let themeId = null;
                let themes = Object.keys(data.themes);
                for (var i = 0, lenThemes = themes.length; i < lenThemes; i++) {
                    let theme = data.themes[themes[i]];
                    let start = typeof theme.start === 'number' ? theme.start : null;
                    let end = typeof theme.end === 'number' ? theme.end : null;

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
                let possibleThemeId = themeIds[k];
                let possibleTheme = possibleThemeId === null ? data : data.themes[possibleThemeId];
                if (!$.isPlainObject(possibleTheme)) {
                    continue;
                }

                let possibleResource = possibleTheme[resourceType];
                if (!$.isPlainObject(possibleResource)) {
                    continue;
                }

                let possibleResult = possibleResource[resourceId];
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

    const Assets = {

        applyResourceModification: function ($el) {
            let frameId = $el.attr('data-frameId');
            let resourceType = $el.attr('data-resourceType');
            let resourceId = $el.attr('data-resourceId');

            _private.determineTextResourceValue(frameId, resourceType, resourceId, function (result, themeId) {
                _private.applyResourceModification($el, result);
            });
        },

        applyDataTagsModifications: function ($el, dataTags) {

            let group = $el.attr('data-personalize-group');
            let item = $el.attr('data-personalize-item');
            let value = $el.attr('data-personalize-value');
            let modifications = value.split(/\s*,\s*/);

            let extractedDataTags = _private.extractDataTagsSettings(group, item, dataTags);
            _private.applyDataTagsModifications($el, extractedDataTags, modifications);

            // show it if marked
            if ($el.attr('data-personalize-show') === 'true') {
                $el.show();
            }

            // mark it as loaded
            $el.attr('data-personalize-loaded', 'true');
        },

        observeNamedResourceDomElements: function (options) {
            options = $.extend({
                resourceObserver: this.getConfig('observeResources', false) || this.getConfig('observeImages', false),
                dataTagsObserver: this.getConfig('observeDataTags', false)
            }, options);

            if (options.resourceObserver === true) {
                _private.registerNamedResourcesResourceObserver();
            }

            if (options.dataTagsObserver === true) {
                _private.registerNamedResourcesDataTagsObserver();
                _private.registerMapResourcesDataTagsObserver();
            }
        },

        refreshMapResource: function ($el, settings) {
            _private.refreshMappedResource($el, settings);
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
                    _private.textResource(res.frameId, null, cb);
                },
                'String,Function': function (frameId, cb) {
                    _private.textResource(frameId, null, cb);
                },
                'Object,Number,Function': function (res, timestamp, cb) {
                    _private.textResource(res.frameId, timestamp, cb);
                },
                'String,Number,Function': function (frameId, timestamp, cb) {
                    _private.textResource(frameId, timestamp, cb);
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
    const BoundAssets = Breinify.plugins._add('assets', Assets);

    // bind the observation if configured and Breinify is ready
    Breinify.onReady(function () {
        BoundAssets.observeNamedResourceDomElements();
    });
})();