"use strict";

describe('Breinify ExternaljQuery', function () {

    //noinspection JSUnresolvedFunction
    it('is jQuery globally known', function () {
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof $).toBe('function');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect($.fn.jquery).toBe('2.2.2');

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof Breinify.jQueryVersion).toBe('string');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof Breinify.jQueryVersion).not.toBe('');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.jQueryVersion).not.toBe('2.2.2');
    });
});

describe('Breinify ExternaljQuery - Fallback', function () {

    //noinspection JSUnresolvedFunction
    beforeEach(function () {
        window.loadedBreinify = Breinify;

        //noinspection JSUnresolvedFunction
        jasmine.getFixtures().fixturesPath = "specs/fixtures";
        //noinspection JSUnresolvedFunction
        loadFixtures('breinifyUtil-failed-breinify.html');
    });

    //noinspection JSUnresolvedFunction
    it('fallback Breinify supports all functions needed', function (done) {

        var deepCompare = function (o1, o2) {
            $.each(o1, function (property) {
                var propVal = o1[property];
                var failedPropVal = o2[property];

                //noinspection JSUnresolvedFunction
                expect([property, typeof propVal]).toEqual([property, typeof failedPropVal]);

                // do a deep comparision
                if (typeof propVal === 'object' && typeof failedPropVal === 'object') {
                    deepCompare(propVal, failedPropVal);
                }
            });
        };

        setTimeout(function () {

            //noinspection JSUnresolvedFunction
            expect(window.failedBreinify.version).toBe('FALLBACK');

            // remove any plugins and just keep general functionality
            var plugins = window.loadedBreinify.plugins;
            window.loadedBreinify.plugins = {};
            for (var key in plugins) {
                if (key.indexOf('_') === 0 && plugins.hasOwnProperty(key)) {
                    window.loadedBreinify.plugins[key] = plugins[key];
                }
            }

            deepCompare(window.loadedBreinify, window.failedBreinify);

            // reset the modification
            window.loadedBreinify.plugins = plugins;

            done();
        }, 500);
    });
});