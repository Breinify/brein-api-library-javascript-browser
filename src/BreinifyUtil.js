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
        loc: {

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

            set: function (name, value, expiresInDays, global, specDomain, httpsOnly) {

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
                if (httpsOnly === true) {
                    secure = '; secure';
                } else {
                    secure = '';
                }

                var path = global === true ? '; path=/' : '';
                document.cookie = name + '=' + value + expires + domain + path + secure;
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
            }
        },

        events: {
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

        getNested: function (obj /*, level1, level2, ... levelN*/) {
            if (!$.isPlainObject(obj) || obj === null) {
                return null;
            }

            for (var pos = 1; pos < arguments.length; pos++) {
                var property = arguments[pos];

                if (!obj.hasOwnProperty(property)) {
                    return null;
                }

                obj = obj[property];
            }

            return obj;
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

        _jquery: function () {
            return $;
        }
    };

    //noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'BreinifyUtil', BreinifyUtil);
}(window, dependencyScope);