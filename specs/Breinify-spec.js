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

    //noinspection JSUnresolvedFunction
    it('handlesGetParameters', function () {
        var oldParams = Breinify.UTL.loc.params;
        var oldActivity = Breinify.activity;

        var test = [];
        var value = {};

        Breinify.activity = function (user, type, category, description, tags, sign, onReady) {

            // create a unique new identifier for the test
            test.push(true);

            // add the information
            value[test.length] = {
                user: user,
                type: type,
                category: category,
                description: description,
                tags: tags,
                sign: sign
            };
        };

        // use some old configuration without any marker
        Breinify.UTL.loc.params = function (done) {
            return {
                'brec': 'eyJ1c2VyIjogeyJlbWFpbCI6ICJwaGlsaXBwQG1laXNlbi5uZXQiLCJ1c2VySWQiOiAiNDAyODAxOTMxNTQifSwiYWN0aXZpdHkiOiB7InRhZ3MiOiB7InByb2R1Y3RQcmljZXMiOiBbMzkuOTldLCJwcm9kdWN0SWRzIjogWyIyMTg2Il0sIndpZGdldElkIjogIm1heUxpa2UyIiwid2lkZ2V0VHlwZSI6ICJpbWFnZSIsImNhbXBhaWduSWQiOiAiYmV2bW9GcmlkYXlFbWFpbHwyMDE5LTA0LTEyIiwiY2FtcGFpZ25UeXBlIjogImJldm1vRnJpZGF5RW1haWwifX19'
            };
        };
        Breinify.setConfig({
            'apiKey': '5555-064C-F007-4F92-A8DC-D06B-56B4-FAD8',
            'category': 'other',
            'handleParameters': true
        });

        // another old configuration without marker
        Breinify.UTL.loc.params = function (done) {
            return {
                'brec': 'eyJ1c2VyIjogeyJlbWFpbCI6ICJwaGlsaXBwQG1laXNlbi5uZXQiLCJ1c2VySWQiOiAiNDAyODAxOTMxNTQifSwiYWN0aXZpdHkiOiB7InRhZ3MiOiB7InByb2R1Y3RQcmljZXMiOiBbMjYuOTldLCJwcm9kdWN0SWRzIjogWyI1MTIwNCJdLCJ3aWRnZXRJZCI6ICJtYXlMaWtlNCIsIndpZGdldFR5cGUiOiAiaW1hZ2UiLCJjYW1wYWlnbklkIjogImJldm1vRnJpZGF5RW1haWx8MjAxOS0wNC0xMiIsImNhbXBhaWduVHlwZSI6ICJiZXZtb0ZyaWRheUVtYWlsIn19fQ%3D%3D'
            };
        };
        Breinify.setConfig({
            'apiKey': '5555-064C-F007-4F92-A8DC-D06B-56B4-FAD8',
            'category': 'other',
            'handleParameters': true
        });

        // use some new configuration with the marker
        Breinify.UTL.loc.params = function (done) {
            return {
                'brec': '.eyJhY3Rpdml0eSI6eyJ0eXBlIjoiY2xpY2tlZFJlY29tbWVuZGF0aW9uIiwidGFncyI6eyJwcm9kdWN0SWRzIjpbIjU0MTIzIl19fSwidXNlciI6eyJlbWFpbCI6InBoaWxpcHBAYnJlaW5pZnkuY29tIn19'
            };
        };
        Breinify.setConfig({
            'apiKey': '5555-064C-F007-4F92-A8DC-D06B-56B4-FAD8',
            'category': 'other',
            'handleParameters': true
        });

        // reset everything
        Breinify.UTL.loc.params = oldParams;
        Breinify.activity = oldActivity;

        //noinspection JSUnresolvedFunction
        expect(value).toEqual({
            "1": {
                "user": {
                    "additional": value["1"].user.additional,
                    "sessionId": value["1"].user.sessionId,
                    "email": "philipp@meisen.net",
                    "userId": "40280193154"
                },
                "type": "clickedRecommendation",
                "category": null,
                "description": null,
                "tags": {
                    "productPrices": [39.99],
                    "productIds": ["2186"],
                    "widgetId": "mayLike2",
                    "widgetType": "image",
                    "campaignId": "bevmoFridayEmail|2019-04-12",
                    "campaignType": "bevmoFridayEmail"
                },
                "sign": null
            },
            "2": {
                "user": {
                    "additional": value["2"].user.additional,
                    "sessionId": value["2"].user.sessionId,
                    "email": "philipp@meisen.net",
                    "userId": "40280193154"
                },
                "type": "clickedRecommendation",
                "category": null,
                "description": null,
                "tags": {
                    "productPrices": [26.99],
                    "productIds": ["51204"],
                    "widgetId": "mayLike4",
                    "widgetType": "image",
                    "campaignId": "bevmoFridayEmail|2019-04-12",
                    "campaignType": "bevmoFridayEmail"
                },
                "sign": null
            },
            "3": {
                "user": {
                    "additional": value["3"].user.additional,
                    "sessionId": value["3"].user.sessionId,
                    "email": "philipp@breinify.com"
                },
                "type": "clickedRecommendation",
                "category": null,
                "description": null,
                "tags": {
                    "productIds": ["54123"]
                },
                "sign": null
            }
        });
    });

});