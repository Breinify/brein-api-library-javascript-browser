"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }

    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var prefixValidation = Breinify.UTL.constants.errors.prefix.validation;
    var prefixApi = Breinify.UTL.constants.errors.prefix.api;

    var uiValidator = {

        usMobile: function(val) {
            if (typeof val !== 'string') {
                return false;
            } else {
                var mobileNumberRegEx = /\d{10}/i;
                return mobileNumberRegEx.test(val);
            }
        },

        mandatory: function(val) {
            if (typeof val === 'undefined') {
                return false;
            } else if (val === null) {
                return false;
            } else if (typeof val === 'string' && val.trim() === '') {
                return false;
            } else {
                return true;
            }
        }
    };

    // bind the module
    Breinify.plugins._add('uiValidator', uiValidator);
})();