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
        }
    };

    var BreinifyUtil = {

        loc: {

            params: function (paramListSeparator, paramSeparator, paramSplit, url) {
                url = typeof url === 'string' ? url : this.url();

                paramListSeparator = typeof paramListSeparator === 'string' ? paramListSeparator : '?';
                paramSeparator = typeof paramSeparator === 'string' ? paramSeparator : '&';
                paramSplit = typeof paramSplit === 'string' ? paramSplit : '=';

                var paramListSeparatorPos = url.indexOf(paramListSeparator);
                if (paramListSeparatorPos < 0) {
                    return {};
                }

                var paramsUrl = url.substring(paramListSeparatorPos + 1);
                var paramStrs = paramsUrl.split(paramSeparator);
                if (paramStrs.length == 0) {
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

            matches: function (regEx) {
                regEx = typeof regEx === 'string' ? new RegExp(regEx) : regEx;

                return this.url().match(regEx);
            }
        },

        cookie: {

            /**
             * Gets all the cookies currently defined and accessible or an empty array if there aren't any.
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

            reset: function (name) {
                this.set(name, '', -1);
            },

            set: function (name, value, expiresInDays) {
                expiresInDays = typeof expiresInDays === 'number' ? expiresInDays : 1;

                var d = new Date();
                d.setTime(d.getTime() + (expiresInDays * 24 * 60 * 60 * 1000));

                var expires = "expires=" + d.toUTCString();

                document.cookie = name + "=" + value + "; " + expires;
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

        texts: function (cssSelector, excludeChildren) {
            var $el = cssSelector instanceof jQuery ? cssSelector : $(cssSelector);
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
         * The method ensures that the specified func is only executed after the
         * whole DOM is loaded.
         * @param func {function} the function to be excecuted
         */
        ready: function (func) {
            if ($.isFunction(func)) {
                $(document).ready(func);
            }
        },

        /**
         * Checks if the passed value is empty, i.e., is an empty string (trimmed), an empty object, undefined or null.
         * @param val {mixed} the value to be checked
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
        }
    };

//noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'BreinifyUtil', BreinifyUtil);
}(window, dependencyScope);