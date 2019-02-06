"use strict";

describe('Breinify', function () {

    //noinspection JSUnresolvedFunction
    it('is globally available', function () {

        //noinspection JSUnresolvedFunction
        expect(typeof window['Breinify']).toBe('object');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof Breinify).toBe('object');
    });

    //noinspection JSUnresolvedFunction
    it('is jQuery globally unknown', function () {
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof $).toBe('undefined');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof jQuery).toBe('undefined');

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof Breinify.jQueryVersion).toBe('string');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof Breinify.jQueryVersion).not.toBe('');
    });

    //noinspection JSUnresolvedFunction
    it('utils are available', function () {
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof Breinify.UTL).toBe('object');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof Breinify.UTL.loc).toBe('object');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof Breinify.UTL.loc.url).toBe('function');
    });

    //noinspection JSUnresolvedFunction
    it('calculates the right signature', function (done) {
        Breinify.setConfig({
            'apiKey': '5D8B-064C-F007-4F92-A8DC-D06B-56B4-FAD8',
            'category': 'other',
            'secret': '5e9xqoesiygkuzddxjlkaq=='
        });

        //noinspection JSCheckFunctionSignatures
        Breinify.UTL.unixTimestamp = function () {
            return 1451962516;
        };
        Breinify.activityUser({
            email: 'email@sample.com'
        }, 'search', null, null, null, true, function (data) {

            //noinspection JSUnresolvedFunction
            expect(data.apiKey).toBe('5D8B-064C-F007-4F92-A8DC-D06B-56B4-FAD8');
            //noinspection JSUnresolvedFunction
            expect(data.unixTimestamp).toBe(1451962516);
            //noinspection JSUnresolvedFunction
            expect(data.activity.type).toBe('search');
            //noinspection JSUnresolvedFunction
            expect(data.activity.category).toBe('other');
            //noinspection JSUnresolvedFunction
            expect(data.signature).toBe('rsXU0ozhfzieNLA2jQs2h2e4sz2+qHGxbgSYyfWr5EM=');

            done();
        });
    });

    //noinspection JSUnresolvedFunction
    it('creates the correct temporal data request instance', function (done) {
        Breinify.setConfig({
            'url': 'https://api.breinify.com',
            'apiKey': '41B2-F48C-156A-409A-B465-317F-A0B4-E0E8'
        });

        //noinspection JSCheckFunctionSignatures
        Breinify.UTL.unixTimestamp = function () {
            return 1451962516;
        };
        Breinify.temporalDataUser({}, false, function (data) {

            //noinspection JSUnresolvedFunction
            expect(data.apiKey).toBe('41B2-F48C-156A-409A-B465-317F-A0B4-E0E8');
            //noinspection JSUnresolvedFunction
            expect(data.unixTimestamp).toBe(1451962516);
            //noinspection JSUnresolvedFunction
            expect(data.timezone).not.toBeNull();

            done();
        });
    });

    //noinspection JSUnresolvedFunction
    it('creates the correct recommendation data request instance', function (done) {
        Breinify.setConfig({
            'url': 'https://api.breinify.com',
            'apiKey': '41B2-F48C-156A-409A-B465-317F-A0B4-E0E8'
        });

        //noinspection JSCheckFunctionSignatures
        Breinify.UTL.unixTimestamp = function () {
            return 1451962516;
        };
        Breinify.recommendationUser({}, {
            'numRecommendations': 10,
            'recommendationCategory': "some category"
        }, false, function (data) {

            //noinspection JSUnresolvedFunction
            expect(data.apiKey).toBe('41B2-F48C-156A-409A-B465-317F-A0B4-E0E8');
            //noinspection JSUnresolvedFunction
            expect(data.unixTimestamp).toBe(1451962516);
            //noinspection JSUnresolvedFunction
            expect(data.recommendation.recommendationCategory).toBe('some category');
            //noinspection JSUnresolvedFunction
            expect(data.recommendation.numRecommendations).toBe(10);

            done();
        });
    });
});