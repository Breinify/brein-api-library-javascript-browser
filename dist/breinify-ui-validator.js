"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('uiValidator')) {
        return;
    }

    var uiValidator = {

        email: function (val) {
            if (typeof val !== 'string') {
                return false;
            } else {
                var emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                return emailRegEx.test(val);
            }
        },

        usMobile: function (val) {
            if (typeof val !== 'string') {
                return false;
            } else {
                var mobileNumberRegEx = /\d{10}/i;
                return mobileNumberRegEx.test(val);
            }
        },

        mandatory: function (val) {
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