//noinspection JSUnresolvedVariable
/**
 * The method has two scopes, the global scope (typically window),
 * and the dependency scope. Within the dependency scope all the
 * dependencies are bound.
 */
!function (scope, dependencyScope) {
    "use strict";

    //noinspection JSUnresolvedVariable
    var misc = dependencyScope.misc;
    if (misc.check(window, 'BreinifyUtil')) {
        return;
    }

    var _private = {
        parseNumber: function (value) {
            if (/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/.test(value)) {
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

            var content = null;
            if (el.nodeType === 1) {
                var $el = $(el);
                var display = $el.css('display');

                if ($el.is('br')) {
                    content = this.append(content, '\n');
                } else if ($el.is('input')) {
                    var type = $el.attr('type');
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
        }
    };

    var BreinifyUtil = {
        cookies: {
            assignedGroup: 'x-breinify-ag',
            sessionId: 'x-breinify-uuid',
            browserId: 'x-breinify-bid',
            delayedActivities: 'x-breinify-delayed'
        },

        constants: {
            errors: {
                prefix: {
                    validation: '[VALIDATION] ',
                    api: '[API] ',
                    assets: '[ASSETS] ',
                }
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

                var base64;
                if (typeof value !== 'string' || value === null) {
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

                // if the url is not passed in we use a special decoding for HTML entities
                // to avoid this, just pass in the url
                if (typeof url !== 'string') {
                    var decoder = document.createElement('textarea');
                    decoder.innerHTML = this.url();
                    url = decoder.value;
                }

                paramListSeparator = typeof paramListSeparator === 'string' ? paramListSeparator : '?';
                paramSeparator = typeof paramSeparator === 'string' ? paramSeparator : '&';
                paramSplit = typeof paramSplit === 'string' ? paramSplit : '=';

                var paramListSeparatorPos = url.indexOf(paramListSeparator);
                if (paramListSeparatorPos < 0) {
                    return {};
                }

                var paramsUrl = url.substring(paramListSeparatorPos + 1);
                var paramStrs = paramsUrl.split(paramSeparator);
                if (paramStrs.length === 0) {
                    return {};
                }

                var result = {};
                for (var i = 0; i < paramStrs.length; i++) {
                    var paramStr = paramStrs[i];
                    var paramVals = paramStr.split(paramSplit);

                    var paramName = decodeURIComponent(paramVals[0]);

                    if (paramVals.length === 2) {
                        result[paramName] = decodeURIComponent(paramVals[1]);
                    } else {
                        result[paramName] = null;
                    }
                }

                return result;
            },

            hasParam: function (param, paramListSeparator, paramSeparator, paramSplit, url) {
                var params = this.params(paramListSeparator, paramSeparator, paramSplit, url);

                return this.isParam(param, params);
            },

            isParam: function (param, params) {
                return $.isPlainObject(params) && params !== null && params.hasOwnProperty(param) && typeof params[param] === 'string';
            },

            paramIs: function (expected, param, paramListSeparator, paramSeparator, paramSplit, url) {
                var parsedParam = this.parsedParam(typeof expected, param, paramListSeparator, paramSeparator, paramSplit, url);
                return parsedParam === expected;
            },

            parsedParam: function (expectedType, param, paramListSeparator, paramSeparator, paramSplit, url) {
                var value = this.param(param, paramListSeparator, paramSeparator, paramSplit, url);

                if (value === null) {
                    return null;
                } else {
                    var parsed;
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
                var params = this.params(paramListSeparator, paramSeparator, paramSplit, url);

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
                var urlRegEx = /^(?:(?:(http[s]?):\/)?\/?)(?:([\-\w]+):([\-\w]+)@)?([^:\/\s]+)(?::(\d+))?((?:(?:\/[\-\w]+)*\/)(?:[\w\(\)\-\.]+[^#?\s]?)?)?((?:.*)?(?:#[\w\-]+)?)$/g;
                var match = urlRegEx.exec(url);

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
                var strCookie = document.cookie;

                var result = {};
                if ('' !== strCookie.trim()) {
                    var cookies = strCookie.split(';');

                    for (var i = 0; i < cookies.length; i++) {
                        var cookie = cookies[i];

                        while (cookie.charAt(0) === ' ') {
                            cookie = cookie.substring(1);
                        }

                        var sepPosition = cookie.indexOf('=');
                        if (sepPosition < 0) {
                            result[cookie] = null;
                        } else {
                            var name = cookie.substring(0, sepPosition);
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
                        var encJson = btoa(JSON.stringify(json));
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

                var expires;
                if (typeof expiresInDays === 'number') {
                    var d = new Date();
                    d.setTime(d.getTime() + (expiresInDays * 24 * 60 * 60 * 1000));
                    expires = '; expires=' + d.toUTCString();
                } else {
                    expires = '';
                }

                var domain;
                if (typeof specDomain === 'string') {
                    domain = '; domain=' + specDomain;
                } else {
                    domain = '';
                }

                var secure;
                if (httpsOnly === false) {
                    secure = '';
                } else if (httpsOnly === true || scope.Breinify.config()['cookieHttpsOnly'] === true) {
                    secure = '; secure';
                } else {
                    secure = '';
                }

                var samesite;
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

                var path = global === true ? '; path=/' : '';
                document.cookie = name + '=' + value + expires + domain + path + secure + samesite;
            },

            get: function (name) {
                var cookies = this.all();

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
                var configuredDomain = scope.Breinify.config()['cookieDomain'];
                if (typeof configuredDomain === 'string' && configuredDomain.trim() !== '') {
                    this.cookieDomain = '.' + configuredDomain;
                    return this.cookieDomain;
                }

                var url = BreinifyUtil.loc.extract(BreinifyUtil.loc.url());

                var domParts = url !== null && typeof url.domain === 'string' ? url.domain.split('.') : [];
                var domPartsLen = domParts.length;

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
                    var possibleEnding = domParts[domPartsLen - 2] + '.' + domParts[domPartsLen - 1];

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
                            for (var key in this) {
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
            }
        },

        user: {
            assignedGroup: {},
            browserId: null,
            sessionId: null,

            create: function (user) {

                // get the default user
                var defaultUser = {
                    sessionId: this.getSessionId(),
                    'additional': {
                        identifiers: {
                            browserId: this.getBrowserId(),
                            assignedGroup: this.getAssignedGroup()
                        }
                    }
                };

                // get the create user from the configuration
                var createUser = scope.Breinify.config()['createUser'];
                var createdUser;
                if ($.isFunction(createUser)) {
                    createdUser = createUser();
                } else {
                    createdUser = {};
                }

                // check if we have a Breinify userLookup module
                var userLookUpPlugIn = scope.Breinify.plugins._getCustomization(dependencyScope.BreinifyConfig.CONSTANTS.CUSTOMER_PLUGIN_USER_LOOKUP);
                var userLookupResult;
                if (userLookUpPlugIn === null || !$.isFunction(userLookUpPlugIn.get)) {
                    userLookupResult = {};
                } else {
                    userLookupResult = userLookUpPlugIn.get();
                }

                return $.extend(true, {}, createdUser, defaultUser, userLookupResult, user);
            },

            getBrowserId: function () {
                var cookie = BreinifyUtil.cookies.browserId;
                if (this.browserId !== null) {
                    // nothing to do
                } else if (BreinifyUtil.cookie.check(cookie)) {
                    this.browserId = BreinifyUtil.cookie.get(cookie);
                } else {
                    this.browserId = BreinifyUtil.uuid();
                    BreinifyUtil.cookie.set(cookie, this.browserId, 10 * 365, true, BreinifyUtil.cookie.domain());
                }

                return this.browserId;
            },

            getSessionId: function () {
                var cookie = BreinifyUtil.cookies.sessionId;

                if (this.sessionId !== null) {
                    // nothing to do
                } else if (BreinifyUtil.cookie.check(cookie)) {
                    this.sessionId = BreinifyUtil.cookie.get(cookie);
                } else {
                    this.resetSessionId(false);
                }

                return this.sessionId;
            },

            resetSessionId: function (reset) {
                if (reset === true || BreinifyUtil.isEmpty(this.sessionId)) {
                    this.sessionId = BreinifyUtil.uuid();
                }

                var cookie = BreinifyUtil.cookies.sessionId;
                BreinifyUtil.cookie.set(cookie, this.sessionId, null, true, BreinifyUtil.cookie.domain());

                return this.sessionId;
            },

            getAssignedGroup: function (cookie, split) {
                if (typeof cookie !== 'string' || cookie.trim() === '') {
                    cookie = BreinifyUtil.cookies.assignedGroup;
                }

                if (typeof split !== 'number') {
                    split = 75;
                } else if (split < 0) {
                    split = 0;
                } else if (split > 100) {
                    split = 100;
                }

                // create the groupName
                var groupName = cookie + '::' + split;

                if (typeof this.assignedGroup[groupName] === 'string') {
                    // nothing to do
                } else if (BreinifyUtil.internal.isDevMode()) {
                    this.assignedGroup[groupName] = 'DEV';
                } else if (navigator.cookieEnabled === false) {
                    this.assignedGroup[groupName] = 'DISABLED';
                } else if (BreinifyUtil.cookie.check(groupName)) {
                    this.assignedGroup[groupName] = BreinifyUtil.cookie.get(groupName);
                } else {
                    this.assignedGroup[groupName] = (Math.floor(Math.random() * 100)) < split ? 'TEST' : 'CONTROL';
                    BreinifyUtil.cookie.set(groupName, this.assignedGroup[groupName], 10 * 365, true, BreinifyUtil.cookie.domain());
                }

                return this.assignedGroup[groupName];
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
                var _self = this;

                var id = BreinifyUtil.uuid();
                this.observables[id] = {
                    selector: selector,
                    callback: typeof callback === 'function' ? callback : null
                };

                if (this.observerInterval === null) {
                    this.observerInterval = setInterval(function () {
                        $.each(_self.observables, function (elId, elParams) {
                            var elSelector = elParams.selector;
                            var elCallback = elParams.callback;

                            $(elSelector).each(function () {
                                var $el = $(this);

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

            removeAllDomObserver: function (id) {
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
            var $el = cssSelector instanceof $ ? cssSelector : $(cssSelector);
            directChild = typeof directChild === 'boolean' ? directChild : false;

            if (directChild) {
                return $el.children(childSelector);
            } else {
                return $el.find(childSelector);
            }
        },

        texts: function (cssSelector, excludeChildren) {
            var $el = cssSelector instanceof $ ? cssSelector : $(cssSelector);
            excludeChildren = typeof excludeChildren === 'boolean' ? excludeChildren : true;

            var result = [];
            if ($el.length !== 0) {

                $el.each(function (idx) {
                    var content = null;
                    var contentEls = $(this).contents();

                    if (contentEls.length === 0) {
                        content = _private.append(content, _private.determineText(this, excludeChildren));
                    } else {
                        contentEls.each(function (idx) {
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
            var texts = this.texts(cssSelector, excludeChildren);
            if (texts.length === 0) {
                return '';
            } else {
                return texts.join('');
            }
        },

        setText: function (cssSelector, text) {
            var $el = cssSelector instanceof $ ? cssSelector : $(cssSelector);

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
                var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
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

            var type = typeof val;
            if ('undefined' === type) {
                return true;
            } else if ('object' === type && $.isEmptyObject(val)) {
                return true;
            } else if ('string' === type && '' === val.trim()) {
                return true;
            } else {
                return false;
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

            var quotes = inclSingle === true ? '["\']' : '["]';
            var regEx = '^' + quotes + '(.*)' + quotes + '$';
            return str.replace(new RegExp(regEx), '$1');
        },

        isSimpleObject: function (obj) {
            if (obj == null) {
                return true;
            } else if (!$.isPlainObject(obj)) {
                return false;
            }

            // check the values of the object
            var result = true;
            $.each(obj, function (key, value) {
                var type = typeof value;
                if (value === null || type === 'boolean' || type === 'string' || type === 'number') {
                    return true;
                } else if ($.isArray(value)) {

                    var globalArrayType = null;
                    $.each(value, function (idx, arrayValue) {
                        var arrayType = typeof arrayValue;

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
            var defaultPayload = {
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

            for (var property in input) {
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
            var paths = typeof path === 'string' ? path.split('.') : [];
            for (var pos = 0; pos < paths.length; pos++) {
                if (!$.isPlainObject(obj) || obj === null || typeof obj === 'undefined') {
                    return null;
                }

                var property = paths[pos];
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
            for (var pos = 1; pos < arguments.length; pos++) {
                if (!$.isPlainObject(obj) || obj === null || typeof obj === 'undefined') {
                    return null;
                }

                var property = arguments[pos];
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
            var wndjQuery = window.jQuery;
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

        storage: {
            instance: null,

            init: function (entries, reset, callback) {
                if (!$.isPlainObject(entries)) {
                    return;
                }
                // we allow also to not specify reset
                else if ($.isFunction(reset) && typeof callback === 'undefined') {
                    callback = reset;
                    reset = false;
                }

                // check if we already have an instance (init may be called multiple times)
                if (this.instance === null) {
                    if (typeof window.localStorage === 'object') {
                        this.instance = window.localStorage;
                    } else {

                        // we create a simple shim, which only works within the correct loading
                        this.instance = {
                            store: {},
                            setItem: function (key, value) {
                                this.store[key] = value;
                            },
                            getItem: function (key) {
                                var result = this.store[key];
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

                if (reset) {
                    this.instance.clear();
                }

                var _self = this;
                var toBeLoaded = {};
                var loadingStatus = [];
                $.each(entries, function (key, entry) {
                    if (_self.get(key) === null || _self.isExpired(key)) {
                        toBeLoaded[key] = entry;
                        loadingStatus.push(key);
                    }
                });

                var loaded = [];
                var failed = [];
                $.each(toBeLoaded, function (key, entry) {
                    _self.load(key, entry, function (error, name) {
                        loadingStatus.splice($.inArray(name, loadingStatus), 1);

                        if (error === null) {
                            loaded.push(name);
                        } else {
                            failed.push(name);
                        }
                        if (loadingStatus.length === 0) {
                            callback(null, {
                                loaded: loaded,
                                failed: failed
                            });
                        }
                    });
                });

                if (loadingStatus.length === 0) {
                    callback(null, {
                        loaded: 0,
                        failed: 0
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

                var _self = this;
                var loader = entry.loader;
                var expiresInSec = $.isNumeric(entry.expiresInSec) ? entry.expiresInSec : -1;
                if ($.isFunction(loader)) {
                    loader(function (error, data) {
                        if (error === null) {
                            _self.instance.setItem('breinify-' + name, _self.createStorabledata(expiresInSec, data));
                        }
                        callback(error, name);
                    });
                } else if (typeof entry.values !== 'undefined') {
                    _self.instance.setItem('breinify-' + name, _self.createStorabledata(expiresInSec, entry.values));
                    callback(null, name);
                } else {
                    callback(new Error('No values or loader specified.'));
                }
            },

            createStorabledata: function (expiresInSec, data) {
                var now = new Date().getTime();
                return JSON.stringify({
                    'expires': expiresInSec <= 0 ? -1 : now + (expiresInSec * 1000),
                    'created': now,
                    'data': data
                });
            },

            isExpired: function (name) {
                var json = this.instance.getItem('breinify-' + name);

                if (typeof json === 'string') {
                    var storableData = JSON.parse(json);
                    if ($.isPlainObject(storableData)) {
                        return new Date().getTime() > storableData.expires;
                    } else {
                        return true;
                    }
                } else {
                    return true;
                }
            },

            get: function (name) {
                var json = this.instance.getItem('breinify-' + name);
                if (typeof json === 'string') {
                    var storableData = JSON.parse(json);
                    return $.isPlainObject(storableData) ? storableData.data : null;
                } else {
                    return null;
                }
            }
        },

        _jquery: function () {
            return $;
        }
    };

    //noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'BreinifyUtil', BreinifyUtil);
}(window, dependencyScope);