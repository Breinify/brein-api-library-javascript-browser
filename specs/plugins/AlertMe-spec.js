"use strict";

describe('AlertMe', function () {

    var assertValidatePhoneNumber = function (config, number, allowShortCodes, expectedNumber, expectedError, done) {
        alertMe.setConfig(config);
        alertMe._validatePhoneNumber(number, allowShortCodes, function (error, data) {
            expect(error).toEqual(expectedError);
            expect(data).toEqual(expectedNumber);
            alertMe.config = {};
            done();
        });
    };

    var assertValidateLocation = function (config, input, expectedData, expectedError, done) {
        alertMe.setConfig(config);
        alertMe._validateLocation(input, function (error, data) {
            expect(error).toEqual(expectedError);
            expect(data).toEqual(expectedData);
            alertMe.config = {};
            done();
        });
    };

    //noinspection JSUnresolvedVariable
    var alertMe = window['Breinify'].plugins.alertMe;

    //noinspection JSUnresolvedFunction
    it('is available through Breinify', function () {

        //noinspection JSUnresolvedFunction
        expect(typeof alertMe).toBe('object');
    });

    //noinspection JSUnresolvedFunction
    it('validates location', function (done) {
        assertValidateLocation({}, {
            name: 'testLocation',
            id: 'validId',
            type: 'store'
        }, {
            name: 'testLocation',
            id: 'validId',
            type: 'store'
        }, null, done);
    });

    //noinspection JSUnresolvedFunction
    it('supports configuration for location types - fails (1)', function (done) {

        assertValidateLocation({'locationTypes': [/A.*/]}, {
            name: 'testLocation',
            id: 'validId',
            type: 'store'
        }, undefined, new Error('[VALIDATION] Invalid location-type specified: store'), done);
    });

    //noinspection JSUnresolvedFunction
    it('supports configuration for location types - validates (2)', function (done) {

        assertValidateLocation({'locationTypes': [/A.*/]}, {
            name: 'testLocation',
            id: 'validId',
            type: 'A-Location'
        }, {
            name: 'testLocation',
            id: 'validId',
            type: 'A-Location'
        }, null, done);
    });

    //noinspection JSUnresolvedFunction
    it('supports configuration for location types - fails (3)', function (done) {

        assertValidateLocation({'locationTypes': ['justMeAndOnlyMe']}, {
            name: 'testLocation',
            id: 'validId',
            type: 'thereMayBeMore'
        }, undefined, new Error('[VALIDATION] Invalid location-type specified: thereMayBeMore'), done);
    });

    //noinspection JSUnresolvedFunction
    it('supports configuration for location types - validates (4)', function (done) {

        assertValidateLocation({'locationTypes': ['justMeAndOnlyMe']}, {
            name: 'testLocation',
            id: 'validId',
            type: 'justMeAndOnlyMe'
        }, {
            name: 'testLocation',
            id: 'validId',
            type: 'justMeAndOnlyMe'
        }, null, done);
    });

    //noinspection JSUnresolvedFunction
    it('can validate phone-numbers (1)', function (done) {
        assertValidatePhoneNumber({}, '+491772552780', false, '+491772552780', null, done);
    });

    it('can validate phone-numbers (2)', function (done) {
        assertValidatePhoneNumber({}, '+491772552780', false, '+491772552780', null, done);
    });

    it('fails on shortcode if not allowed', function (done) {
        assertValidatePhoneNumber({}, '55667', false, undefined, new Error('[VALIDATION] Phone-number must include the country-code (e.g., +1): 55667'), done);
    });

    it('validates shortcode if allowed', function (done) {
        assertValidatePhoneNumber({}, '55667', true, '55667', null, done);
    });
});