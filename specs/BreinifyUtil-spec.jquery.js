"use strict";

describe('BreinifyUtil', function () {

    //noinspection JSUnresolvedFunction
    it('can handle empty text elements', function () {

        //noinspection JSUnresolvedFunction
        jasmine.getFixtures().fixturesPath = "specs/fixtures";
        //noinspection JSUnresolvedFunction
        loadFixtures('breinifyUtil-text-simple.html');

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts(".notavailable")).toEqual([]);
    });

    //noinspection JSUnresolvedFunction
    it('can select simple text from elements', function () {

        //noinspection JSUnresolvedFunction
        jasmine.getFixtures().fixturesPath = "specs/fixtures";
        //noinspection JSUnresolvedFunction
        loadFixtures('breinifyUtil-text-simple.html');

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts(".simpleText")).toEqual(['This is a simple text example!']);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.text(".simpleText")).toBe('This is a simple text example!');
    });

    //noinspection JSUnresolvedFunction
    it('can select multiple text from elements', function () {

        //noinspection JSUnresolvedFunction
        jasmine.getFixtures().fixturesPath = "specs/fixtures";
        //noinspection JSUnresolvedFunction
        loadFixtures('breinifyUtil-text-multiple.html');

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts(".multiText")).toEqual([
            'This is a simple text example!',
            'This is another text!',
            'This is the last text!'
        ]);
    });

    //noinspection JSUnresolvedFunction
    it('can select multiple text with child elements', function () {

        //noinspection JSUnresolvedFunction
        jasmine.getFixtures().fixturesPath = "specs/fixtures";
        //noinspection JSUnresolvedFunction
        loadFixtures('breinifyUtil-text-multiple-with-br.html');

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts(".multiTextBr")).toEqual([
            'This is a simple text example!\nWhatever it is, should be fine.',
            'This is another text!\nWhat is here!',
            'This is the last text!'
        ]);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts(".multiTextBr", false)).toEqual([
            'This is a simple text example!\nWhatever it is, should be fine.',
            'This is another text!\nWhat is here!',
            'This is the last text!\nThis is in a child node'
        ]);
    });

    //noinspection JSUnresolvedFunction
    it('can handle the complex examples', function () {

        //noinspection JSUnresolvedFunction
        jasmine.getFixtures().fixturesPath = "specs/fixtures";
        //noinspection JSUnresolvedFunction
        loadFixtures('breinifyUtil-text-complex.html');

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts("#complex1 div.first", true)).toEqual([
            'This is a text, which has some marked text.'
        ]);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts("#complex1 div.first", false)).toEqual([
            'This is a text, which has some marked text.'
        ]);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts("#complex1", true)).toEqual([
            ''
        ]);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts("#complex1 div.third", false)).toEqual([
            'Is there something\nIs that whenever, or wherever?\nWhere\nwe go'
        ]);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts("#complex1 div.third p", false)).toEqual([
            'Is there something',
            'Is that whenever, or wherever?',
            'Where\nwe go'
        ]);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts("#complex1 div.four", false)).toEqual([
            'anemail@andomain.com'
        ]);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts("#complex1 div.four", true)).toEqual([
            'anemail@andomain.com'
        ]);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.text("#complex1 div.four", true)).toBe('anemail@andomain.com');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.text("#complex1 div.four", false)).toBe('anemail@andomain.com');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.text("#complex1 div.four span", true)).toBe('anemail@andomain.com');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.text("#complex1 div.four span", false)).toBe('anemail@andomain.com');
    });

    //noinspection JSUnresolvedFunction
    it('can read inputs', function () {

        //noinspection JSUnresolvedFunction
        jasmine.getFixtures().fixturesPath = "specs/fixtures";
        //noinspection JSUnresolvedFunction
        loadFixtures('breinifyUtil-text-input.html');

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.text('input[name="name"]')).toBe('Mickey');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.text('input[name="password"]')).toBe('secret');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.text('input[name="gender"]')).toBe('male');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.texts('input[name="vehicle"]')).toEqual(['car', 'bus']);

        Breinify.UTL.text('input');
    });
});