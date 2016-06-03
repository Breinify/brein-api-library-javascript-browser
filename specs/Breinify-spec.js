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
});