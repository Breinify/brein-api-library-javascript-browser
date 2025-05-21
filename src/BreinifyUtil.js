// noinspection JSUnusedGlobalSymbols,JSUnresolvedReference

/**
 * The method has two scopes, the global scope (typically window),
 * and the dependency scope. Within the dependency scope all the
 * dependencies are bound.
 */
!function (scope, dependencyScope) {
    "use strict";

    //noinspection JSUnresolvedVariable
    const misc = dependencyScope.misc;
    if (misc.check(window, 'BreinifyUtil', true)) {
        return;
    }

    const storage = {
        anonymousIdStorage: null
    };

    const _private = {
        parseNumber: function (value) {
            if (/^[-+]?(?:\d+(?:\.\d+)?|Infinity)$/.test(value)) {
                return Number(value);
            } else {
                return NaN;
            }
        },

        parseBoolean: function (value) {
            return (/^true$/i).test(value);
        },

        append: function (str, val) {
            if (typeof val === 'string') {
                return str === null ? val : str + val;
            } else if ($.isArray(val)) {
                if (val.length === 0) {
                    return str;
                } else {
                    return val.join('');
                }
            } else {
                return str;
            }
        },

        determineText: function (el, onlyInline) {
            onlyInline = typeof onlyInline === 'boolean' ? onlyInline : false;

            let content = null;
            if (el.nodeType === 1) {
                let $el = $(el);
                let display = $el.css('display');

                if ($el.is('br')) {
                    content = this.append(content, '\n');
                } else if ($el.is('input')) {
                    let type = $el.attr('type');
                    type = typeof type === 'string' ? type.toLowerCase() : null;

                    if ('radio' === type) {
                        if (el.checked) {
                            content = this.append(content, $el.val());
                        }
                    } else if ('checkbox' === type) {
                        if (el.checked) {
                            content = this.append(content, $el.val());
                        }
                    } else {
                        // text, password
                        content = this.append(content, $el.val());
                    }
                } else if ($el.contents().length === 0) {
                    // do nothing
                } else if (display.indexOf('inline') > -1) {
                    content = this.append(content, BreinifyUtil.texts($el, true));
                } else if (!onlyInline) {
                    content = this.append(content, BreinifyUtil.texts($el, true));
                    content = this.append(content, '\n');
                }
            } else if (el.nodeType === 3) {
                content = this.append(content, el.nodeValue);
            }

            return content;
        },

        isDomEl: function (el) {
            if (typeof el === 'object') {
                return el.nodeType === 1;
            } else {
                return false;
            }
        },

        clickObserver: {
            clickObservers: {},
            defaultSettings: {
                allowMultiFire: false
            },

            add: function (selector, name, settings, callback) {
                const _self = this;

                // we allow only three parameters, so adapt with default settings
                if ($.isFunction(settings)) {
                    callback = settings;
                    settings = this.defaultSettings;
                } else if (!$.isPlainObject(settings)) {
                    settings = this.defaultSettings;
                } else if (typeof settings.allowMultiFire !== 'boolean') {
                    settings.allowMultiFire = false;
                }

                let existingClickObserver = this.clickObservers[selector];
                if ($.isPlainObject(existingClickObserver)) {

                    // Note: any existing callback would be overridden
                    existingClickObserver.callbacks[name] = callback;
                    return;
                }

                // create the new click observer
                existingClickObserver = {
                    callbacks: {}
                };
                this.clickObservers[selector] = existingClickObserver;

                // create a handler for this selector
                existingClickObserver.callbacks[name] = callback;
                existingClickObserver.handler = function (event) {
                    let clickObserver = _self.clickObservers[event.data.selector];
                    if (!$.isPlainObject(clickObserver) || !$.isPlainObject(clickObserver.callbacks)) {
                        return;
                    }

                    const el = this;
                    $.each(clickObserver.callbacks, function (name, callback) {
                        if (!$.isFunction(callback)) {
                            return;
                        } else if (!$.isPlainObject(event.data)) {
                            return;
                        }

                        /*
                         * If we change the event data at this point (the first time), we have to clone the
                         * object, otherwise we modify the initial object defined within the .on event
                         * definition
                         */
                        if (!$.isPlainObject(event.brDataTriggered)) {
                            event.brDataTriggered = {};
                            event.brDataTriggered[name] = [new Date().getTime()];
                        } else if (settings.allowMultiFire === false) {
                            // it was already fired, so return
                            return;
                        } else {
                            event.brDataTriggered[name].push(new Date().getTime());
                        }

                        callback.call(el, event, {
                            triggered: event.brDataTriggered[name],
                            selector: selector,
                            name: name
                        });
                    });
                };

                // and bind it
                $(document).on('click', selector, {selector: selector}, existingClickObserver.handler);
            }
        },

        domObserver: {
            isInitialized: false,
            mutationObserver: null,
            modifications: {},

            init: function () {
                const _self = this;

                this.mutationObserver = new MutationObserver(function (mutations) {
                    for (let i = 0; i < mutations.length; i++) {
                        for (let k = 0; k < mutations[i].addedNodes.length; k++) {
                            _self.checkModifications($(mutations[i].addedNodes[k]));
                        }
                    }
                });
                this.mutationObserver.observe(document, {
                    childList: true,
                    subtree: true
                });

                // if we have the html already, let's check the modifications
                let $html = $('html');
                if ($html.length > 0) {
                    this.checkModifications($html);
                }

                this.isInitialized = true;
            },

            addModification: function (name, modification) {

                /**
                 * A modification should have the following structure:
                 * {
                 *     'selector': '.fp-create-account-label',
                 *     'preCondition': function ($el) {
                 *         return window.location.hash.match(/#!\/login(?:$|\?)/) !== null &&
                 *             $el.closest('#account').length > 0;
                 *     },
                 *     'modifier': function ($el) {
                 *         $el.css('borderBottom', 'unset');
                 *         $el.after('<div><img src="https://www.bevmo.com/wp-content/uploads/003630_ClubBev_874x96_2A.png"></div>');
                 *         return true;
                 *     },
                 * }
                 */
                if (typeof name === 'string' && name.trim() !== '' &&
                    $.isPlainObject(modification) && typeof modification.selector === 'string' && modification.selector.trim() !== '') {
                    this.modifications[name] = modification;

                    // if the system is already initialized we trigger a check for this modification
                    if (this.isInitialized === true) {
                        this.checkModification($('body'), name, modification);
                    }
                }
            },

            checkModifications: function ($modifiedNode) {
                const _self = this;
                $.each(this.modifications, function (name, modification) {
                    _self.checkModification($modifiedNode, name, modification);
                });
            },

            checkModification: function ($modifiedNode, name, modification) {

                let $els = $modifiedNode
                    .find(modification.selector)
                    .addBack(modification.selector);

                if ($els.length === 0) {
                    return;
                } else if ($.isFunction(modification.preCondition) && !modification.preCondition($els)) {
                    return;
                } else if (!$.isFunction(modification.modifier)) {
                    return;
                }

                // get the current applied modifiers
                let appliedModifier = $els.attr('data-applied-modifier');
                appliedModifier = typeof appliedModifier === 'string' ? JSON.parse(appliedModifier) : [];
                if ($.inArray(name, appliedModifier) !== -1) {
                    return;
                }

                if (modification.modifier($els) === true) {
                    appliedModifier.push(name);
                    $els.attr('data-applied-modifier', JSON.stringify(appliedModifier));
                }
            },

            parseClasses: function (classes) {
                let classList = classes.split(/\s+/);

                let normalizedClasses = [];
                for (let i = 0; i < classList.length; i++) {
                    let classEntry = classList[i].trim();
                    if (classEntry === '') {
                        continue;
                    } else if ($.inArray(classEntry, normalizedClasses) > -1) {
                        continue;
                    }

                    normalizedClasses.push(classEntry);
                }

                return normalizedClasses;
            },

            diffClasses: function (cl1, cl2) {

                let diff = [];
                for (let i = 0; i < cl1.length; i++) {
                    if ($.inArray(cl1[i], cl2) > -1) {
                        continue;
                    }

                    diff.push(cl1[i]);
                }

                return diff;
            },

            addClassChangeObserver: function ($el, callback) {
                const _self = this;

                $el.each(function () {

                    new MutationObserver(function (mutations) {

                        for (let i = 0; i < mutations.length; i++) {
                            let mutation = mutations[i];
                            let newClasses = _self.parseClasses(mutation.target.className);
                            let oldClasses = _self.parseClasses(mutation.oldValue);

                            let addedClasses = _self.diffClasses(newClasses, oldClasses);
                            let removedClasses = _self.diffClasses(oldClasses, newClasses);

                            callback(null, {
                                el: $(mutation.target),
                                modified: true,
                                addedClasses: addedClasses,
                                removedClasses: removedClasses
                            });
                        }
                    }).observe(this, {
                        attributes: true,
                        attributeOldValue: true,
                        attributeFilter: ['class']
                    });

                    // we extract the info once all as added classes
                    callback(null, {
                        el: $(this),
                        modified: false,
                        addedClasses: _self.parseClasses(this.className),
                        removedClasses: []
                    });
                });
            }
        }
    };

    const BreinifyUtil = {

        _init: function () {
            _private.domObserver.init();
        },

        cookies: {
            sessionId: 'x-breinify-uuid',
            browserId: 'x-breinify-bid',
            delayedActivities: 'x-breinify-delayed'
        },

        constants: {
            errors: {
                prefix: {
                    validation: '[VALIDATION] ',
                    api: '[API] ',
                    assets: '[ASSETS] '
                }
            }
        },

        out: {
            console: window.console,
            supportsLogging: typeof window.console === 'object' && typeof window.console.log === 'function',
            supportsGroup: typeof window.console === 'object' && typeof window.console.log === 'function',

            log: function (logLevel, message) {

                if (!BreinifyUtil.internal.isDevMode()) {
                    // do nothing, we are not in dev mode
                    return;
                }

                // determine if we have passed parameters with the message, or we should check the unknowns
                let params;
                if (typeof message === 'string') {
                    params = [].slice.call(arguments, 1);
                } else {
                    params = message;
                }

                params[0] = '[Breinify] ' + params[0];

                if (!this.supportsLogging) {
                    // do nothing, we cannot do anything
                } else if (logLevel === 'error') {
                    if (typeof this.console.error === 'function') {
                        this.console.error.apply(this.console, params);
                    } else {
                        this.log('trace', '[' + logLevel + '] ' + message, params);
                    }
                } else if (logLevel === 'warn') {
                    if (typeof this.console.warn === 'function') {
                        this.console.warn.apply(this.console, params);
                    } else {
                        this.log('trace', '[' + logLevel + '] ' + message, params);
                    }
                } else if (logLevel === 'info') {
                    if (typeof this.console.info === 'function') {
                        this.console.info.apply(this.console, params);
                    } else {
                        this.log('trace', '[' + logLevel + '] ' + message, params);
                    }
                } else if (logLevel === 'debug') {
                    if (typeof this.console.debug === 'function') {
                        this.console.debug.apply(this.console, params);
                    } else {
                        this.log('trace', '[' + logLevel + '] ' + message, params);
                    }
                } else if (logLevel === 'trace') {
                    this.console.log.apply(this.console, params);
                }
            },

            error: function (message) {
                this.log('error', arguments);
            },

            warn: function (message) {
                this.log('warn', arguments);
            },

            info: function (message) {
                this.log('info', arguments);
            },

            debug: function (message) {
                this.log('debug', arguments);
            },

            trace: function (message) {
                this.log('trace', arguments);
            }
        },

        loc: {

            createGetParameter: function (value) {
                try {
                    value = btoa(JSON.stringify(value));

                    return '.' + value
                        .replace(/\+/g, '~')
                        .replace(/\//g, '-')
                        .replace(/=/g, '_');
                } catch (e) {
                    return null;
                }
            },

            parseGetParameter: function (name, value) {

                let base64;
                if (typeof value !== 'string') {
                    return null;
                } else if (value.charAt(0) === '.') {
                    base64 = value.substr(1)
                        .replace(/~/g, '+')
                        .replace(/-/g, '/')
                        .replace(/_/g, '=');
                } else {
                    base64 = decodeURIComponent(value);
                }

                try {
                    return JSON.parse(atob(base64));
                } catch (e) {
                    return null;
                }
            },

            params: function (paramListSeparator, paramSeparator, paramSplit, url) {

                try {
                    const urlSearchParams = new URLSearchParams(window.location.search);
                    const result = {};
                    urlSearchParams.forEach(function (value, key) {
                        result[key] = value;
                    });

                    return result;
                } catch (e) {

                    // if the url is not passed in we use a special decoding for HTML entities
                    // to avoid this, just pass in the url
                    if (typeof url !== 'string') {
                        let decoder = document.createElement('textarea');
                        decoder.innerHTML = this.url();
                        url = decoder.value;
                    }

                    paramListSeparator = typeof paramListSeparator === 'string' ? paramListSeparator : '?';
                    paramSeparator = typeof paramSeparator === 'string' ? paramSeparator : '&';
                    paramSplit = typeof paramSplit === 'string' ? paramSplit : '=';

                    let paramListSeparatorPos = url.indexOf(paramListSeparator);
                    if (paramListSeparatorPos < 0) {
                        return {};
                    }

                    let paramsUrl = url.substring(paramListSeparatorPos + 1);
                    let paramStrs = paramsUrl.split(paramSeparator);
                    if (paramStrs.length === 0) {
                        return {};
                    }

                    let result = {};
                    for (let i = 0; i < paramStrs.length; i++) {
                        let paramStr = paramStrs[i];
                        let paramVals = paramStr.split(paramSplit);

                        let paramName = decodeURIComponent(paramVals[0]);

                        if (paramVals.length === 2) {
                            result[paramName] = decodeURIComponent(paramVals[1]);
                        } else {
                            result[paramName] = null;
                        }
                    }

                    return result;
                }
            },

            hasParam: function (param, paramListSeparator, paramSeparator, paramSplit, url) {
                let params = this.params(paramListSeparator, paramSeparator, paramSplit, url);

                return this.isParam(param, params);
            },

            isParam: function (param, params) {
                return $.isPlainObject(params) && params !== null && params.hasOwnProperty(param) && typeof params[param] === 'string';
            },

            paramIs: function (expected, param, paramListSeparator, paramSeparator, paramSplit, url) {
                let parsedParam = this.parsedParam(typeof expected, param, paramListSeparator, paramSeparator, paramSplit, url);
                return parsedParam === expected;
            },

            parsedParam: function (expectedType, param, paramListSeparator, paramSeparator, paramSplit, url) {
                let value = this.param(param, paramListSeparator, paramSeparator, paramSplit, url);

                if (value === null) {
                    return null;
                } else {
                    let parsed;
                    if (expectedType === 'string') {
                        parsed = value;
                    } else if (expectedType === 'number') {
                        parsed = _private.parseNumber(value);
                    } else if (expectedType === 'boolean') {
                        parsed = _private.parseBoolean(value);
                    } else if (expectedType === 'json') {
                        try {
                            parsed = JSON.parse(value);
                        } catch (e) {
                            return null;
                        }
                    } else {
                        return null;
                    }

                    return parsed;
                }
            },

            param: function (param, paramListSeparator, paramSeparator, paramSplit, url) {
                let params = this.params(paramListSeparator, paramSeparator, paramSplit, url);

                if (this.isParam(param, params)) {
                    return params[param];
                } else {
                    return null;
                }
            },

            url: function () {
                return window.location.href;
            },

            extract: function (url) {
                let urlRegEx = /^(?:(https?):\/)?\/?(?:([\-\w]+):([\-\w]+)@)?([^:\/\s]+)(?::(\d+))?((?:\/[\-\w]+)*\/(?:[\w()\-.]+[^#?\s]?)?)?((?:.*)?(?:#[\w\-]+)?)$/g;
                let match = urlRegEx.exec(url);

                if (match === null) {
                    return null;
                } else {
                    return {
                        full: match[0] === '' || typeof match[0] === 'undefined' ? null : match[0],
                        protocol: match[1] === '' || typeof match[1] === 'undefined' ? null : match[1],
                        username: match[2] === '' || typeof match[2] === 'undefined' ? null : match[2],
                        password: match[3] === '' || typeof match[3] === 'undefined' ? null : match[3],
                        domain: match[4] === '' || typeof match[4] === 'undefined' ? null : match[4],
                        port: match[5] === '' || typeof match[5] === 'undefined' ? null : parseInt(match[5], 10),
                        path: match[6] === '' || typeof match[6] === 'undefined' ? null : match[6],
                        parameters: match[7] === '' || typeof match[7] === 'undefined' ? null : match[7]
                    }
                }
            },

            matches: function (regEx) {
                regEx = typeof regEx === 'string' ? new RegExp(regEx) : regEx;

                return this.url().match(regEx);
            }
        },

        cookie: {
            cookieDomain: null,

            /**
             * Gets all the cookies currently defined and accessible or an empty object if there aren't any.
             * @returns {object} the found cookies
             */
            all: function () {
                let strCookie = document.cookie;

                let result = {};
                if ('' !== strCookie.trim()) {
                    let cookies = strCookie.split(';');

                    for (let i = 0; i < cookies.length; i++) {
                        let cookie = cookies[i];

                        while (cookie.charAt(0) === ' ') {
                            cookie = cookie.substring(1);
                        }

                        let sepPosition = cookie.indexOf('=');
                        if (sepPosition < 0) {
                            result[cookie] = null;
                        } else {
                            let name = cookie.substring(0, sepPosition);
                            result[name] = cookie.substring(sepPosition + 1, cookie.length);
                        }
                    }
                }

                return result;
            },

            reset: function (name, specDomain) {
                this.set(name, '', -1, false, specDomain);
                this.set(name, '', -1, true, specDomain);
            },

            setJson: function (name, json, expiresInDays, global, specDomain, httpsOnly) {
                if ($.isPlainObject(json)) {
                    try {
                        let strJson = JSON.stringify(json);

                        // the stringified JSON may contain invalid characters, so lets replace these
                        let replacedJson = strJson.replace(/[\u00A0-\u2666]/g, function (c) {
                            return '&#' + c.charCodeAt(0) + ';';
                        });

                        // finally let's encode it to a base64 encoded string
                        let encJson = btoa(replacedJson);
                        this.set(name, encJson, expiresInDays, global, specDomain, httpsOnly);
                    } catch (e) {
                        this.reset(name, specDomain);
                    }
                } else {
                    this.reset(name, specDomain);
                }
            },

            getJson: function (name) {
                if (this.check(name)) {
                    try {
                        return JSON.parse(atob(this.get(name)));
                    } catch (e) {
                        return null;
                    }
                } else {
                    return null;
                }
            },

            set: function (name, value, expiresInDays, global, specDomain, httpsOnly, specSamesite) {

                let expires;
                if (typeof expiresInDays === 'number') {
                    let d = new Date();
                    d.setTime(d.getTime() + (expiresInDays * 24 * 60 * 60 * 1000));
                    expires = '; expires=' + d.toUTCString();
                } else {
                    expires = '';
                }

                let domain;
                if (typeof specDomain === 'string') {
                    domain = '; domain=' + specDomain;
                } else {
                    domain = '';
                }

                let secure;
                if (httpsOnly === false) {
                    secure = '';
                } else if (httpsOnly === true || scope.Breinify.config()['cookieHttpsOnly'] === true) {
                    secure = '; secure';
                } else {
                    secure = '';
                }

                let samesite;
                if (typeof specSamesite === 'string' && specSamesite.trim() !== '') {
                    samesite = specSamesite;
                } else {
                    samesite = scope.Breinify.config()['cookieSameSite'];
                }
                if (typeof samesite === 'string' && samesite.trim() !== '') {
                    samesite = '; samesite=' + samesite;
                } else {
                    samesite = '';
                }

                let path = global === true ? '; path=/' : '';
                document.cookie = name + '=' + value + expires + domain + path + secure + samesite;
            },

            get: function (name) {
                let cookies = this.all();

                if (cookies.hasOwnProperty(name)) {
                    return cookies[name];
                } else {
                    return null;
                }
            },

            check: function (cookie) {
                return this.get(cookie) !== null;
            },

            domain: function () {

                if (this.cookieDomain !== null) {
                    return this.cookieDomain;
                }

                // check if one is configured
                let configuredDomain = scope.Breinify.config()['cookieDomain'];
                if (typeof configuredDomain === 'string' && configuredDomain.trim() !== '') {
                    this.cookieDomain = '.' + configuredDomain;
                    return this.cookieDomain;
                }

                let url = BreinifyUtil.loc.extract(BreinifyUtil.loc.url());

                let domParts = url !== null && typeof url.domain === 'string' ? url.domain.split('.') : [];
                let domPartsLen = domParts.length;

                // local domain
                if (domPartsLen === 0) {
                    this.cookieDomain = null;
                }
                // any domain like localhost or just a server's name
                else if (domPartsLen === 1) {
                    if (domParts[0] === 'localhost') {
                        return null;
                    } else {
                        this.cookieDomain = '.' + domParts[0];
                    }
                }
                    // even if this is the most common case it gets tricky (because of all the co.uk)
                // we have two or more parts (so keep the last two), i.e., .[toplevel].[ending]
                else {
                    let possibleEnding = domParts[domPartsLen - 2] + '.' + domParts[domPartsLen - 1];

                    // there are possible domain-endings with larger 6, but honestly when this is the case
                    // use the configuration (cookieDomain)
                    if (domPartsLen === 2 || possibleEnding.length > 6) {
                        this.cookieDomain = '.' + possibleEnding;
                    } else {
                        this.cookieDomain = '.' + domParts[domPartsLen - 3] + '.' + possibleEnding;
                    }
                }

                // there are some special domains to handle
                // 1. .pantheonsite.io: https://pantheon.io/docs/cookies#setting-cookies-for-platform-domains
                if ('.pantheonsite.io' === this.cookieDomain) {
                    if (domPartsLen >= 3) {
                        this.cookieDomain = '.' + domParts[domPartsLen - 3] + this.cookieDomain;
                    }
                }

                return this.cookieDomain;
            }
        },

        internal: {
            isDevMode: function () {

                // we just assume that there is a variable set in the sessionStorage in Dev-Mode
                try {
                    return window.sessionStorage['breinify'] === 'true';
                } catch (e) {
                    return false;
                }
            },

            segment: function (apiToken, payload, cb, timeout) {

                this.token(apiToken, payload, function (error, data) {
                    if (error != null) {
                        cb(error);
                    } else if (typeof data.group !== 'string' || data.group.trim() === '') {
                        cb(new Error('Unexpected group information.'));
                    } else {
                        cb(null, {
                            group: data.group,
                            attachedData: $.isPlainObject(data.attachedData) ? data.attachedData : {}
                        });
                    }
                }, timeout);
            },

            token: function (apiToken, payload, cb, timeout) {
                $.ajax({
                    'url': 'https://api.breinify.com/res/' + apiToken,
                    'type': 'GET',
                    'crossDomain': true,
                    'data': payload,
                    'success': function (data) {

                        if (!$.isPlainObject(data)) {
                            cb(new Error('Unexpected data response.'));
                        } else if (typeof data.responseCode !== 'number' || data.responseCode !== 200) {
                            cb(new Error('Failed response (code: ' + data.responseCode + '): ' + JSON.stringify(data)));
                        } else if (!$.isPlainObject(data.payload)) {
                            cb(new Error('Unexpected payload.'));
                        } else {
                            cb(null, data.payload);
                        }
                    },
                    'error': function (jqXHR, text) {

                        let err;
                        try {
                            err = new Error(text + ' (status: ' + jqXHR.status + ', error: ' + jqXHR.statusText + ', details: ' + jqXHR.responseText + ')');
                        } catch (e) {
                            err = e;
                        }

                        cb(err);
                    },
                    'timeout': typeof timeout === 'number' ? timeout : 15000
                });
            },

            cbCollector: function (collection) {
                return $.extend({
                    _expectedCounter: null,
                    _errorCounter: 0,
                    _resultCounter: 0,
                    _errors: {},
                    _results: {},
                    _callback: function (errors, results) {
                    },
                    _check: function () {
                        if (this._expectedCounter === null) {
                            this._expectedCounter = 0;
                            for (let key in this) {
                                if (key.indexOf('_') !== 0 && this.hasOwnProperty(key)) {
                                    this._expectedCounter++;
                                }
                            }
                        }

                        // check if we are done
                        if (this._errorCounter + this._resultCounter === this._expectedCounter) {
                            this._callback(this._errorCounter > 0 ? this._errors : null, this._resultCounter > 0 ? this._results : {});
                        }
                    },
                    _set: function (property, error, data) {
                        if (error === null) {
                            this._results[property] = data;
                            this._resultCounter++;
                        } else {
                            this._errors[property] = error;
                            this._errorCounter++;
                        }

                        this._check();
                    }
                }, collection);
            },

            runExternaljQuery: function (plugin, func) {
                const _self = this;

                let executed = false;
                if ($.isFunction(window.$)) {
                    if (plugin === 'jquery') {
                        func();
                        executed = true;
                    } else if ($.isFunction(window.$.fn[plugin])) {
                        func();
                        executed = true;
                    }
                }

                if (executed === false) {
                    setTimeout(function () {
                        _self.runExternaljQuery(plugin, func);
                    }, 25);
                }
            }
        },

        dom: {

            getTagName: function($el) {
                let tagName = $el === null ? null : BreinifyUtil.isNonEmptyString($el.prop('tagName'));
                return tagName === null ? 'no tag' : tagName.toLowerCase();
            },

            determineElementType: function($el, mapper) {
                const tagName = this.getTagName($el);

                // apply any mapper first if one is specified
                if ($.isFunction(mapper)) {
                    const elementType = BreinifyUtil.isNonEmptyString(mapper(tagName, $el));
                    if (elementType !== null) {
                        return elementType;
                    }
                }

                switch (tagName) {
                    case 'a':
                        return 'anchor (' + tagName + ')';
                    case 'img':
                        return 'image (' + tagName + ')';
                    case 'div':
                        return 'block (' + tagName + ')';
                    case 'span':
                        return 'inline (' + tagName + ')';
                    default:
                        return 'miscellaneous (' + tagName + ')';
                }
            },

            addModification: function (modificationId, modification) {
                _private.domObserver.addModification(modificationId, modification);
            },

            removeModification: function (modificationId) {
                delete _private.domObserver.modifications[modificationId];
            },

            addClassChangeObserver: function ($el, callback) {
                _private.domObserver.addClassChangeObserver($el, callback);
            },

            addClickObserver: function (selector, name, callback) {
                _private.clickObserver.add(selector, name, callback);
            }
        },

        user: {
            browserId: null,
            sessionId: null,
            splitTestData: null,

            getSplitTestData: function (updateChanges) {
                if ($.isPlainObject(this.splitTestData)) {
                    return this.splitTestData;
                }

                // make sure the instance is initialized
                BreinifyUtil.storage.init({});

                // get the information from it
                this.splitTestData = BreinifyUtil.storage.get(BreinifyUtil.storage.splitTestDataInstanceName);
                if (this.splitTestData === null || !$.isPlainObject(this.splitTestData)) {
                    this.splitTestData = {};

                    return this.splitTestData;
                }

                // clean-up old split-test information (older than 7 days)
                let testExpiration = new Date().getTime() - (24 * 60 * 60 * 1000);
                let deletedInformation = false;
                for (let key in this.splitTestData) {
                    if (!this.splitTestData.hasOwnProperty(key)) {
                        continue;
                    }

                    let lastUpdated = this.splitTestData[key].lastUpdated;
                    if (typeof lastUpdated !== 'number' || lastUpdated < testExpiration) {
                        delete this.splitTestData[key];
                        deletedInformation = true;
                    }
                }

                if (updateChanges === true && deletedInformation === true) {
                    this.updateSplitTestData(this.splitTestData);
                }

                return this.splitTestData;
            },

            /**
             * This method is used to replace the split-test information of the named split-test. The data looks like:
             * <pre>
             * {
             *   "lastUpdated": <unixTimestamp>, // not needed, will be set by method
             *   "testName": "myTestName",       // not needed, will be set by method
             *   "groupDecision": "Breinify",
             *   "selectedInstance": "theInstance",
             *   "usedEnforcedGroup": false
             * }
             * </pre>
             *
             * @param name the name of the test to replace the data for
             * @param splitTestData the data to replace with
             */
            replaceSplitTestData: function (name, splitTestData) {

                // we allow to pass in the split-test name with the splitTestData
                if ($.isPlainObject(name) && (typeof splitTestData === 'undefined' || splitTestData === null)) {
                    splitTestData = name;
                    name = splitTestData.testName;
                }

                // check if we have valid information at this point
                if (typeof name !== 'string' || !$.isPlainObject(splitTestData)) {
                    return;
                }

                // get the currently stored data, and remove the split-test that is updated
                let currentData = this.getSplitTestData();
                currentData = $.isPlainObject(currentData) ? currentData : {};
                delete currentData[name];

                // if there is no data we just remove the split-test information completely, which already happened
                const newSplitTestData = {};
                if ($.isPlainObject(splitTestData)) {

                    // add the data for the new split-test in as an object with the name of the split-test
                    newSplitTestData[name] = $.extend(true, {}, splitTestData, {
                        testName: name,
                        lastUpdated: new Date().getTime()
                    });
                }

                this.updateSplitTestData($.extend(true, newSplitTestData, currentData));
            },

            /**
             * This method is used to override <b>ALL</b> split-test data with the one provided.
             */
            updateSplitTestData: function (splitTestData) {
                try {
                    BreinifyUtil.storage.update(BreinifyUtil.storage.splitTestDataInstanceName, 30 * 24 * 60, splitTestData);
                    this.splitTestData = splitTestData;
                } catch (e) {
                    // ignore if storage issues arise
                }
            },

            determineApiVersion: function () {
                if ($.isPlainObject(scope.Breinify) &&
                    $.isPlainObject(scope.Breinify.plugins) &&
                    $.isPlainObject(scope.Breinify.plugins.api) &&
                    typeof scope.Breinify.plugins.api.version === 'string' &&
                    scope.Breinify.plugins.api.version.trim() !== '') {
                    return scope.Breinify.plugins.api.version.trim();
                } else {
                    return 'n/a';
                }
            },

            create: function (user) {
                let splitTestData;
                try {
                    splitTestData = this.getSplitTestData(true);
                } catch (e) {
                    splitTestData = null;
                }
                splitTestData = $.isEmptyObject(splitTestData) ? null : splitTestData;

                // get the default user
                let defaultUser = {
                    'sessionId': this.getSessionId(),
                    'additional': {
                        'apiVersion': this.determineApiVersion(),
                        'splitTests': splitTestData,
                        'identifiers': {
                            'browserId': this.getBrowserId()
                        }
                    }
                };

                // check for any markers
                let markerSessionId = this.getMarkerSessionId();
                if (markerSessionId !== null) {
                    defaultUser.sessionIds = [markerSessionId];
                }

                // get the create user from the configuration
                let createUser = scope.Breinify.config()['createUser'];
                let createdUser;
                if ($.isFunction(createUser)) {
                    createdUser = createUser();
                    createdUser = $.isPlainObject(createdUser) ? createdUser : {};
                } else {
                    createdUser = {};
                }

                // check if we have a Breinify userLookup module
                let userLookUpPlugIn = scope.Breinify.plugins._getCustomization(dependencyScope.BreinifyConfig.CONSTANTS.CUSTOMER_PLUGIN_USER_LOOKUP);
                let userLookupResult;
                if (userLookUpPlugIn === null || !$.isFunction(userLookUpPlugIn.get)) {
                    userLookupResult = {};
                } else {
                    userLookupResult = userLookUpPlugIn.get();
                    userLookupResult = $.isPlainObject(userLookupResult) ? userLookupResult : {};
                }

                return $.extend(true, {}, createdUser, defaultUser, userLookupResult, user);
            },

            getBrowserId: function () {
                let cookie = BreinifyUtil.cookies.browserId;
                if (this.browserId !== null) {
                    // nothing to do
                } else if (storage.anonymousIdStorage.check(cookie, false)) {
                    this.browserId = storage.anonymousIdStorage.get(cookie, false);
                } else {
                    this.browserId = BreinifyUtil.uuid();
                    storage.anonymousIdStorage.set(cookie, this.browserId, 10 * 365, true, BreinifyUtil.cookie.domain());
                }

                return this.browserId;
            },

            getSessionId: function () {
                let cookie = BreinifyUtil.cookies.sessionId;

                if (this.sessionId !== null) {
                    // nothing to do
                } else if (storage.anonymousIdStorage.check(cookie, true)) {
                    this.sessionId = storage.anonymousIdStorage.get(cookie, true);
                } else {
                    this.resetSessionId(false);
                }

                return this.sessionId;
            },

            getMarkerSessionId: function () {
                let markerSessionId = BreinifyUtil.loc.param('br-msid');
                if (typeof markerSessionId === 'string' && markerSessionId.trim() !== '') {
                    return markerSessionId;
                } else {
                    return null;
                }
            },

            resetSessionId: function (reset) {
                if (reset === true || BreinifyUtil.isEmpty(this.sessionId)) {
                    this.sessionId = BreinifyUtil.uuid();
                }

                let cookie = BreinifyUtil.cookies.sessionId;
                storage.anonymousIdStorage.set(cookie, this.sessionId, null, true, BreinifyUtil.cookie.domain());

                return this.sessionId;
            }
        },

        google: {
            checkAgainDurationInMs: 100,
            checkMaxDurationInMs: 10000,
            _initialPush: null,
            dataLayerEventListener: {},

            addDataLayerEventListener: function (name, listener, replayExisting, checkTime) {
                const _self = this;

                // check if we have a dataLayer available
                if (!$.isArray(window.dataLayer) || !$.isFunction(window.dataLayer.push)) {
                    checkTime = typeof checkTime === 'number' ? checkTime : 0;

                    // we are done and give up
                    if (checkTime > _self.checkMaxDurationInMs) {
                        return;
                    }

                    // if we do not have it yet, we try again in a bit
                    setTimeout(function () {
                        _self.addDataLayerEventListener(name, listener, replayExisting, checkTime + _self.checkAgainDurationInMs);
                    }, _self.checkAgainDurationInMs);

                    return;
                }

                // override the existing listener (next event will be sent to this name)
                _self.dataLayerEventListener[name] = listener;

                // we added the listener but existing events are not pushed, so let's do it, if requested
                if (replayExisting === true) {
                    for (let i = 0; i < window.dataLayer.length; i++) {
                        let oldEvent = window.dataLayer[i];
                        _self._handleEvent(name, listener, oldEvent);
                    }
                }

                // if we already are initialized we can stop, the listener will be handled in the loop
                if (_self._initialPush !== null) {
                    return;
                }

                // keep the original push function
                _self._initialPush = window.dataLayer.push;

                // set a proxy push method
                window.dataLayer.push = function (event) {

                    // trigger the current implementation
                    try {
                        _self._initialPush.call(window.dataLayer, event);
                    } catch (e) {
                        // we ignore any error on the inital push
                    }

                    // trigger the event listeners
                    for (let name in _self.dataLayerEventListener) {
                        if (!_self.dataLayerEventListener.hasOwnProperty(name)) {
                            continue;
                        }

                        // trigger the listening
                        let instance = _self.dataLayerEventListener[name];
                        _self._handleEvent(name, instance, event);
                    }
                };
            },

            _handleEvent: function (name, instance, event) {

                try {
                    if ($.isFunction(instance)) {
                        instance.call(event, name, event);
                    } else if ($.isPlainObject(instance) && $.isFunction(instance.handle)) {
                        if (!$.isFunction(instance.filter) || instance.filter.call(event, name, event) === true) {
                            instance.handle.call(event, name, event);
                        }
                    }
                } catch (e) {
                    console.error('failed to handle event: ' + event, e);
                }
            }
        },

        events: {
            observerInterval: null,
            observables: {},

            click: function (selector, func, onlyOnce) {
                if ($.isFunction(func)) {
                    onlyOnce = typeof onlyOnce === 'boolean' ? onlyOnce : false;

                    if (onlyOnce) {
                        $(selector).one('click', func);
                    } else {
                        $(selector).click(func);
                    }
                }
            },

            pageloaded: function (func) {
                if ($.isFunction(func)) {
                    $(document).ready(func);
                }
            },

            observeDomChange: function (selector, callback) {
                const _self = this;

                let id = BreinifyUtil.uuid();
                this.observables[id] = {
                    selector: selector,
                    callback: typeof callback === 'function' ? callback : null
                };

                if (this.observerInterval === null) {
                    this.observerInterval = setInterval(function () {
                        $.each(_self.observables, function (elId, elParams) {
                            let elSelector = elParams.selector;
                            let elCallback = elParams.callback;

                            $(elSelector).each(function () {
                                let $el = $(this);

                                if ($el.attr('data-brnfy-observation-triggered') !== 'true') {
                                    $el.attr('data-brnfy-observation-triggered', 'true');

                                    if (elCallback !== null) {
                                        elCallback($el);
                                    }
                                }
                            });
                        });
                    }, 50);
                }

                return id;
            },

            removeAllDomObserver: function () {
                this.observables = {};
                clearInterval(this.observerInterval);
                this.observerInterval = null;
            },

            removeDomObserver: function (id) {
                delete this.observables[id];

                // if empty let's clean up
                if ($.isEmptyObject(this.observables)) {
                    clearInterval(this.observerInterval);
                    this.observerInterval = null;
                }
            }
        },

        select: function (cssSelector, childSelector, directChild) {
            let $el = cssSelector instanceof $ ? cssSelector : $(cssSelector);
            directChild = typeof directChild === 'boolean' ? directChild : false;

            if (directChild) {
                return $el.children(childSelector);
            } else {
                return $el.find(childSelector);
            }
        },

        texts: function (cssSelector, excludeChildren) {
            let $el = cssSelector instanceof $ ? cssSelector : $(cssSelector);
            excludeChildren = typeof excludeChildren === 'boolean' ? excludeChildren : true;

            let result = [];
            if ($el.length !== 0) {

                $el.each(function () {
                    let content = null;
                    let contentEls = $(this).contents();

                    if (contentEls.length === 0) {
                        content = _private.append(content, _private.determineText(this, excludeChildren));
                    } else {
                        contentEls.each(function () {
                            content = _private.append(content, _private.determineText(this, excludeChildren));
                        });
                    }

                    if (typeof content === 'string') {

                        // remove any multiple spaces
                        content = content.replace(/ ( )+/g, ' ');
                        // remove whitespaces at the start or the end of a line
                        content = content.replace(/(^ +)|( +$)/gm, '');
                        // remove any multiple newlines
                        content = content.replace(/\n(\n)+/g, '\n');
                        content = content.trim();

                        // add the modified result
                        result.push(content);
                    }
                });
            }

            return result;
        },

        text: function (cssSelector, excludeChildren) {
            let texts = this.texts(cssSelector, excludeChildren);
            if (texts.length === 0) {
                return '';
            } else {
                return texts.join('');
            }
        },

        setText: function (cssSelector, text) {
            let $el = cssSelector instanceof $ ? cssSelector : $(cssSelector);

            if ($el.is('input')) {
                $el.val(text);
            } else {
                $el.text(text);
            }
        },

        /**
         * Helper method to create an MD5-hash. Internally the Breinify system uses
         * other hashes. We even do not store this information, because of the possible
         * use of rainbow tables. Nevertheless, it is a possible way to send information
         * to us.
         *
         * @param value the value to be hashed
         * @returns {string|null} the hashed value, or null if the value was null
         */
        md5: function (value) {
            if (value === null) {
                return null;
            }

            //noinspection JSUnresolvedVariable,JSUnresolvedFunction
            return CryptoJS.MD5(value).toString();
        },

        /**
         * Generates a uuid, thanks to
         * http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
         *
         * @returns {string} a generated UUID
         */
        uuid: function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        /**
         * Checks if the passed value is empty, i.e., is an empty string (trimmed), an empty object, undefined or null.
         * @param val {*} the value to be checked
         * @returns {boolean} true if the value is empty, otherwise false
         */
        isEmpty: function (val) {
            if (val === null) {
                return true;
            }

            let type = typeof val;
            if ('undefined' === type) {
                return true;
            } else if ('object' === type && $.isEmptyObject(val)) {
                return true;
            } else {
                return 'string' === type && '' === val.trim();
            }
        },

        /**
         * Removes quotes from a string, e.g., "Test" => Test
         * @param str the string to remove the quotes from
         * @param {boolean} inclSingle can be true if also single quotes like ' should be removed, be careful something like "Test' would end up to be Test
         * @returns {*} if the passed value is not a string, this value will be returned, otherwise the trimmed str, without any surrounding quotes will be returned
         */
        trimQuotes: function (str, inclSingle) {
            if (str === null || typeof str !== 'string') {
                return str;
            }

            let quotes = inclSingle === true ? '["\']' : '["]';
            let regEx = '^' + quotes + '(.*)' + quotes + '$';
            return str.replace(new RegExp(regEx), '$1');
        },

        ensureSimpleObject: function (obj) {
            if (obj == null) {
                return {};
            } else if (!$.isPlainObject(obj)) {
                return {};
            }

            let cleanedObj = {};
            $.each(obj, function (key, value) {
                let type = typeof value;

                if (value === null || type === 'boolean' || type === 'string' || type === 'number') {
                    cleanedObj[key] = value;
                } else if ($.isArray(value)) {

                    let globalArrType = null;
                    let cleanedArr = [];
                    for (let i = 0; i < value.length; i++) {
                        let arrValue = value[i];
                        let arrType = typeof arrValue;

                        if (
                            // we have a null value
                            arrValue === null ||
                            // or we have an invalid value
                            (arrType !== 'boolean' && arrType !== 'string' && arrType !== 'number') ||
                            // or we have a type that does not match
                            (globalArrType !== null && globalArrType !== arrType)
                        ) {

                            // replace or use the existing null
                            cleanedArr.push(null);
                        } else {

                            // otherwise we have a valid value
                            globalArrType = arrType;
                            cleanedArr.push(arrValue);
                        }
                    }

                    cleanedObj[key] = cleanedArr;
                } else {
                    cleanedObj[key] = null;
                }
            });

            return cleanedObj;
        },

        isSimpleObject: function (obj) {
            if (obj == null) {
                return true;
            } else if (!$.isPlainObject(obj)) {
                return false;
            }

            // check the values of the object
            let result = true;
            $.each(obj, function (key, value) {
                let type = typeof value;
                if (value === null || type === 'boolean' || type === 'string' || type === 'number') {
                    return true;
                } else if ($.isArray(value)) {

                    let globalArrayType = null;
                    $.each(value, function (idx, arrayValue) {
                        let arrayType = typeof arrayValue;

                        if (arrayValue === null) {
                            return true;
                        } else if (arrayType !== 'boolean' && arrayType !== 'string' && arrayType !== 'number') {
                            result = false;
                        } else if (globalArrayType === null) {
                            globalArrayType = arrayType;
                        } else if (globalArrayType !== arrayType) {
                            result = false;
                        }
                        return result;
                    });
                } else {
                    result = false;
                }

                return result;
            });

            return result;
        },

        /**
         * Method to create a valid current unix timestamp.
         * @returns {number} the current unix timestamp (based on the system time)
         */
        unixTimestamp: function () {
            return Math.floor(new Date().getTime() / 1000);
        },

        /**
         * Method to get the current timezone of the user.
         * @returns {string} the current timezone
         */
        timezone: function () {
            //noinspection JSUnresolvedFunction
            return jstz().timezone_name;
        },

        /**
         * Gets the local date and time of the user. The method is based on the toString method of the Date instance.
         * @returns {string} the current local date and time
         */
        localDateTime: function () {
            return new Date().toString();
        },

        /**
         * Method wrapping up the toLocaleString functionality from JavaScript utilizing by default and fallback the
         * `UTC` timezone.
         * @param date {Date} the date to format
         * @param additional additional parameters passed to the toLocaleString method
         * @returns {string} by default a formatted MM/dd/yyyy is returned, which can be modified by the passed
         * additional parameters
         */
        localString: function (date, additional) {
            let defaultPayload = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour12: false,
                timeZone: 'UTC'
            };

            // some browser don't support other timeZones
            try {
                return date.toLocaleString('en-US', $.extend(defaultPayload, additional));
            } catch (e) {
                return date.toLocaleString('en-US', defaultPayload);
            }
        },

        deleteNullProperties: function (input) {
            if (!$.isPlainObject(input)) {
                return input;
            }

            for (let property in input) {
                if (input.hasOwnProperty(property)) {
                    if (input[property] === null) {
                        delete input[property];
                    } else if ($.isPlainObject(input[property])) {
                        this.deleteNullProperties(input[property]);
                        if ($.isEmptyObject(input[property])) {
                            delete input[property];
                        }
                    } else {
                        // nothing to do
                    }
                }
            }
        },

        getNestedByPath: function (obj, path) {
            let paths = typeof path === 'string' ? path.split('.') : [];
            for (let pos = 0; pos < paths.length; pos++) {
                if (!$.isPlainObject(obj) || obj === null || typeof obj === 'undefined') {
                    return null;
                }

                let property = paths[pos];
                if (!obj.hasOwnProperty(property)) {
                    return null;
                } else {
                    obj = obj[property];
                }
            }

            if (typeof obj === 'undefined') {
                return null;
            } else {
                return obj;
            }
        },

        getNested: function (obj /*, level1, level2, ... levelN*/) {
            for (let pos = 1; pos < arguments.length; pos++) {
                if (!$.isPlainObject(obj) || obj === null || typeof obj === 'undefined') {
                    return null;
                }

                let property = arguments[pos];
                if (!obj.hasOwnProperty(property)) {
                    return null;
                } else {
                    obj = obj[property];
                }
            }

            if (typeof obj === 'undefined') {
                return null;
            } else {
                return obj;
            }
        },

        endsWith: function (str, suffix) {
            if (str === null && suffix === null) {
                return true;
            } else if (typeof str === 'undefined' && typeof suffix === 'undefined') {
                return true;
            } else if (typeof str !== 'string' || typeof suffix !== 'string') {
                return false;
            } else {
                return str.indexOf(suffix, str.length - suffix.length) !== -1;
            }
        },

        bindjQueryPlugins: function (plugins, jQuery) {
            if (!$.isPlainObject(plugins)) {
                return;
            } else if (typeof jQuery === 'undefined') {
                jQuery = $;
            }

            // first we take the windows jQuery
            let wndjQuery = window.jQuery;
            window.jQuery = jQuery;

            $.each(plugins, function (key, plugin) {
                if ($.isFunction(plugin)) {

                    // the https://learn.jquery.com/plugins/basic-plugin-creation/ indicates that jQuery should
                    // be the expected parameter
                    plugin(jQuery);
                } else {
                    console.error('Unable to load plugin: ' + key);
                }
            });

            window.jQuery = wndjQuery;
        },

        capitalize: function (str) {
            return this.firstLetter(str, false);
        },

        lowerize: function (str) {
            return this.firstLetter(str, true);
        },

        firstLetter: function (str, toLowerCase) {
            if (typeof str !== 'string') {
                return str;
            } else if (str.length === 0) {
                return '';
            } else if (str.length === 1) {
                return toLowerCase === true ? str.toLowerCase() : str.toUpperCase();
            } else {
                let firstLetter = str.charAt(0);
                return (toLowerCase === true ? firstLetter.toLowerCase() : firstLetter.toUpperCase()) + str.substring(1, str.length);
            }
        },

        toNumber: function (value) {
            if (typeof value === 'string') {
                return _private.parseNumber(value);
            } else if (typeof value === 'number') {
                return value;
            } else {
                return NaN;
            }
        },

        isNonEmptyString: function (value) {
            return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
        },

        toPrice: function (price) {
            const nrPrice = this.toNumber(price);
            return typeof nrPrice !== 'number' || isNaN(nrPrice) ? null : +(nrPrice.toFixed(2));
        },

        formatPrice: function (price, settings) {
            settings = !$.isPlainObject(settings) ? {} : settings;
            settings.locales = typeof settings.locales === 'string' ? settings.locales : 'en-US';
            settings.symbol = typeof settings.symbol === 'string' ? settings.symbol : '$';
            settings.symbolPosition = typeof settings.symbolPosition === 'string' ? settings.symbolPosition : 'prefix';

            let value;
            try {
                if (price === null) {
                    return null;
                } else if (typeof price === 'number') {
                    value = price;
                } else if (/\d+(?:\.\d+)?/.test(price)) {
                    value = parseFloat(price);
                } else {
                    value = Number(price);
                    if (isNaN(value)) {
                        return null;
                    }
                }

                value = value.toLocaleString(settings.locales, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            } catch (e) {
                value = this.toPrice(price);
            }

            if (settings.symbolPosition === 'prefix') {
                return settings.symbol + value;
            } else if (settings.symbolPosition === 'suffix') {
                return value + settings.symbol;
            } else {
                return value;
            }
        },

        toInteger: function (integer) {
            const nrInteger = this.toNumber(integer);
            return typeof nrInteger !== 'number' || isNaN(nrInteger) ? null : +(nrInteger.toFixed(0));
        },

        extend: function () {
            for (let i = 1; i < arguments.length; i++) {
                for (let key in arguments[i]) {
                    if (arguments[i].hasOwnProperty(key)) {
                        let val = arguments[i][key];
                        if (val === null || typeof val === 'undefined') {
                            // do nothing
                        } else if ($.isPlainObject(val)) {
                            arguments[0][key] = this.extend({}, arguments[0][key], val);
                        } else {
                            arguments[0][key] = val;
                        }
                    }
                }
            }
            return arguments[0];
        },

        /**
         * Checks if two objects/variables are equal. The equality is a deep comparison and
         * assumes that arrays do not have to be equally sorted (i.e., [1, 2, 3] == [2, 1, 3]).
         *
         * @param o1 the first object
         * @param o2 the second object
         * @returns {boolean} returns true if o1 == o2, otherwise false
         */
        equals: function (o1, o2) {

            // check if they are the same reference, both undefined, or both null
            if (o1 === o2) {
                return true;
            } else if ($.isArray(o1) && $.isArray(o2)) {
                if (o1.length !== o2.length) {
                    return false;
                }

                // create a copy of obj2 to avoid modifying the original
                const obj2Copy = [...o2];

                // iterate over the arrays to search for an equal entry
                for (let i = 0; i < o1.length; i++) {
                    const obj1 = o1[i];

                    let index = -1;
                    for (let k = 0; k < obj2Copy.length; k++) {
                        const obj2 = obj2Copy[k];
                        if (this.equals(obj1, obj2)) {
                            index = k;
                        }
                    }

                    // if we could not find the item, the arrays are not equal
                    if (index === -1) {
                        return false;
                    } else {
                        // remove the found element from p2Copy
                        obj2Copy.splice(index, 1);
                    }
                }

                // if we reached this point, the obj2Copy must be empty and the arrays are equal
                return obj2Copy.length === 0;
            } else if ($.isPlainObject(o1) && $.isPlainObject(o2)) {
                const keys1 = Object.keys(o1);
                const keys2 = Object.keys(o2);
                if (keys1.length !== keys2.length) {
                    return false;
                }

                // recursively check each key-value pair
                for (const key of keys1) {
                    if ($.inArray(key, keys2) === -1 || !this.equals(o1[key], o2[key])) {
                        return false;
                    }
                }

                return true;
            } else {
                return false;
            }
        },

        storage: {
            splitTestDataInstanceName: 'split-test-data',
            instance: null,

            init: function (entries, callback) {
                if (!$.isPlainObject(entries)) {
                    entries = {};
                }

                // check if we already have an instance (init may be called multiple times)
                if (this.instance === null) {

                    let localStorageType;
                    try {
                        localStorageType = typeof window.localStorage;
                    } catch (e) {
                        localStorageType = null;
                    }

                    if (localStorageType === 'object') {
                        this.instance = window.localStorage;
                    } else {

                        // we create a simple shim, which only works within the correct loading
                        this.instance = {
                            store: {},
                            setItem: function (key, value) {
                                this.store[key] = value;
                            },
                            getItem: function (key) {
                                let result = this.store[key];
                                return typeof result === 'undefined' ? null : result;
                            },
                            removeItem: function (key) {
                                delete this.store[key];
                            },
                            clear: function () {
                                this.store = {}
                            }
                        }
                    }
                }

                const _self = this;
                let toBeLoaded = {};
                let loadingStatus = [];
                let counter = 0;
                $.each(entries, function (key, entry) {
                    if (_self.get(key) === null || _self.isExpired(key)) {
                        toBeLoaded[key] = entry;
                        loadingStatus.push(key);
                        counter++;
                    }
                });

                let loaded = [];
                let failed = [];
                $.each(toBeLoaded, function (key, entry) {
                    _self.load(key, entry, function (error, name) {
                        loadingStatus.splice($.inArray(name, loadingStatus), 1);

                        if (error === null) {
                            loaded.push(name);
                        } else {
                            failed.push(name);
                        }

                        if (loadingStatus.length === 0 && $.isFunction(callback)) {
                            callback(null, {
                                loaded: loaded,
                                failed: failed
                            });
                        }
                    });
                });

                // if nothing was loaded still trigger
                if (counter === 0 && loadingStatus.length === 0 && $.isFunction(callback)) {
                    callback(null, {
                        loaded: [],
                        failed: []
                    });
                }
            },

            load: function (name, entry, callback) {
                if (!$.isPlainObject(entry) || typeof name !== 'string' || name.trim() === '') {
                    callback(new Error("Invalid type(s): " + JSON.stringify({
                        'name': name,
                        'entry': entry
                    })));
                    return;
                }

                const _self = this;
                let loader = entry.loader;
                let expiresInSec = $.isNumeric(entry.expiresInSec) ? entry.expiresInSec : -1;
                if ($.isFunction(loader)) {
                    loader(function (error, data) {
                        if (error === null) {
                            _self.update(name, expiresInSec, data);
                        }
                        callback(error, name);
                    });
                } else if (typeof entry.values !== 'undefined') {
                    _self.update(name, expiresInSec, entry.values);
                    callback(null, name);
                } else {
                    callback(new Error('No values or loader specified.'));
                }
            },

            createStorableData: function (expiresInSec, data) {
                let now = new Date().getTime();
                return JSON.stringify({
                    'expires': expiresInSec <= 0 ? -1 : now + (expiresInSec * 1000),
                    'created': now,
                    'data': data
                });
            },

            isExpired: function (name) {
                if (this.instance === null || !$.isFunction(this.instance.getItem)) {
                    return true;
                }

                let json = this.instance.getItem('breinify-' + name);
                if (typeof json === 'string') {
                    let storableData = JSON.parse(json);
                    if ($.isPlainObject(storableData)) {
                        return new Date().getTime() > storableData.expires;
                    } else {
                        return true;
                    }
                } else {
                    return true;
                }
            },

            update: function (name, expiresInSec, data) {
                if (this.instance === null || !$.isFunction(this.instance.setItem)) {
                    return;
                }

                this.instance.setItem('breinify-' + name, this.createStorableData(expiresInSec, data));
            },

            getOrWait: function (name, callback, timeout, waitedFor) {
                const _self = this;
                let res = this.get(name);

                if (res !== null) {
                    callback(null, res);
                } else if (waitedFor > timeout) {
                    callback(new Error('Timed Out'), null);
                } else {
                    setTimeout(function () {
                        let newWaitedFor = (typeof waitedFor === 'number' ? waitedFor : 0) + 50;
                        _self.getOrWait(name, callback, timeout, newWaitedFor);
                    }, 50);
                }
            },

            get: function (name) {
                if (this.instance === null || !$.isFunction(this.instance.getItem)) {
                    return null;
                }

                let json = this.instance.getItem('breinify-' + name);
                if (typeof json === 'string') {
                    let storableData = JSON.parse(json);
                    return $.isPlainObject(storableData) ? storableData.data : null;
                } else {
                    return null;
                }
            }
        },

        _jquery: function () {

            /*
             * This is more tricky than it seems to be, since if there are multiple Breinify instances loaded, ex.,
             * one script is used for personalization content, the other for activity content, this instances
             * would change for each script (since jQuery is script bound). We want to ensure we utilize the same
             * instance for both scripts, thus we bind a jQuery internally as a global jQuery if it's not used yet
             */
            if (scope.Breinify.jQuery) {
                return scope.Breinify.jQuery;
            } else {
                return $;
            }
        }
    };

    // create the different storages and bind the one to be used
    const anonymousIdStorage = {
        cookieStorage: {
            check: function (cookie) {
                return BreinifyUtil.cookie.check(cookie);
            },
            get: function (cookie) {
                return BreinifyUtil.cookie.get(cookie);
            },
            set: function (cookie, value, expiration, secure, domain) {
                BreinifyUtil.cookie.set(cookie, value, expiration, secure, domain);
            }
        },
        browserStorage: {
            check: function (name, session) {
                return this._extractValue(name, session) !== null;
            },
            get: function (name, session) {
                return this._extractValue(name, session);
            },
            set: function (name, value, expiration) {
                if (value === null || typeof value === 'undefined') {
                    window.localStorage.removeItem(name);
                } else if (expiration === null) {
                    window.sessionStorage.setItem(name, value);
                } else if (typeof expiration === 'number' && expiration > 0) {

                    const json = JSON.stringify({
                        v: value,
                        exp: new Date().getTime() + (expiration * 24 * 60 * 60 * 1000)
                    });

                    window.localStorage.setItem(name, json);
                } else {
                    window.localStorage.removeItem(name);
                }
            },
            _extractValue: function (name, session) {
                if (session === true) {
                    return window.sessionStorage.getItem(name);
                } else {

                    const json = window.localStorage.getItem(name);
                    try {
                        const obj = JSON.parse(json);

                        if (obj.exp < new Date().getTime() || typeof obj.v === 'undefined' || obj.v === null) {
                            window.localStorage.removeItem(name);
                            return null;
                        } else {
                            return obj.v;
                        }
                    } catch (e) {
                        return null;
                    }
                }
            }
        }
    };

    try {
        window.localStorage.setItem('br-local-storage-test', 'true');
        window.localStorage.removeItem('br-local-storage-test');
        window.sessionStorage.setItem('br-session-storage-test', 'true');
        window.sessionStorage.removeItem('br-session-storage-test');

        storage.anonymousIdStorage = anonymousIdStorage.browserStorage;
    } catch (e) {
        storage.anonymousIdStorage = anonymousIdStorage.cookieStorage;
    }

    //noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'BreinifyUtil', BreinifyUtil, true);
}(window, dependencyScope);