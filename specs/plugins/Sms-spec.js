"use strict";

describe('Sms', function () {

    //noinspection JSUnresolvedVariable
    var sms = window['Breinify'].plugins.sms;

    //noinspection JSUnresolvedFunction
    it('is available through Breinify', function () {

        //noinspection JSUnresolvedFunction
        expect(typeof sms).toBe('object');
    });
});