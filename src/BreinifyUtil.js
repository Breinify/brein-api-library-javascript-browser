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

        determineText: function (el, onlyInline) {
            onlyInline = typeof onlyInline === 'boolean' ? onlyInline : false;

            var content = '';
            if (el.nodeType === 1) {
                var $el = $(el);
                var display = $el.css('display');
                var texts = BreinifyUtil.texts($el, true);

                if ($el.is('br')) {
                    content += texts.join('') + '\n';
                } else if (display.indexOf('inline') > -1) {
                    content += texts.join('');
                } else if (!onlyInline) {
                    content += texts.join('') + '\n';
                }
            } else if (el.nodeType === 3) {
                content += el.nodeValue;
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
            }
        },

        texts: function (cssSelector, excludeChildren) {
            var $el = cssSelector instanceof jQuery ? cssSelector : $(cssSelector);
            excludeChildren = typeof excludeChildren === 'boolean' ? excludeChildren : true;

            var result = [];
            if ($el.length !== 0) {

                $el.each(function (idx) {
                    var content = '';

                    $(this).contents().each(function (idx) {
                        content += _private.determineText(this, excludeChildren);
                    });

                    // remove any multiple spaces
                    content = content.replace(/ ( )+/g, ' ');
                    // remove whitespaces at the start or the end of a line
                    content = content.replace(/(^ +)|( +$)/gm, '');
                    // remove any multiple newlines
                    content = content.replace(/\n(\n)+/g, '\n');
                    content = content.trim();
                    result.push(content);
                });
            }

            return result;
        },

        text: function (cssSelector, excludeChildren) {
            var texts = this.texts(cssSelector, excludeChildren);
            if (texts.length === 1) {
                return texts[0];
            } else {
                return null;
            }
        }
    };

    //noinspection JSUnresolvedFunction
    misc.export(dependencyScope, 'BreinifyUtil', BreinifyUtil);
}(window, dependencyScope);