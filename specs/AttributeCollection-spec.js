"use strict";

describe('AttributeCollection', function () {

    //noinspection JSUnresolvedVariable
    var AttributeCollection = window['Breinify'].AttributeCollection;

    //noinspection JSUnresolvedFunction
    it('is available through Breinify', function () {

        //noinspection JSUnresolvedFunction
        expect(typeof AttributeCollection).toBe('function');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof AttributeCollection).toBe('function');
    });

    //noinspection JSUnresolvedFunction
    it('check empty collection', function () {

        var coll = new AttributeCollection();

        //noinspection JSUnresolvedFunction
        expect(coll.all()).toEqual({});

        //noinspection JSUnresolvedFunction
        expect(coll.defaults()).toEqual({});

        //noinspection JSUnresolvedFunction
        expect(coll.validateProperties({})).toEqual(true);

        //noinspection JSUnresolvedFunction
        expect(function () {
            coll.validateProperties({'myProperty': 'myValue'});
        }).toThrow(new Error('The property "myProperty" is not a valid attribute.'));
    });

    //noinspection JSUnresolvedFunction
    it('can add values', function () {

        var coll = new AttributeCollection();
        coll.add('EMAIL', {
            name: 'email',
            validate: function (value) {
                return typeof value === 'string' && value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
            }
        });

        //noinspection JSUnresolvedFunction
        expect(coll.all()).toEqual({'EMAIL': 'email'});
        //noinspection JSUnresolvedFunction
        expect(coll.is('email')).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(coll.default('email')).toBeUndefined();
        //noinspection JSUnresolvedFunction
        expect(function () {
            coll.validateProperties({'email': 'myValue'});
        }).toThrow(new Error('The value "myValue" is invalid for the property "email".'));
        //noinspection JSUnresolvedFunction
        expect(coll.validateProperties({'email': 'philipp@meisen.net'})).toBe(true);
    });
});