"use strict";

describe('AttributeCollection', function () {

    //noinspection JSUnresolvedVariable
    var AttributeCollection = window['Breinify'].AttributeCollection;

    //noinspection JSUnresolvedFunction
    it('is available through Breinify', function () {

        //noinspection JSUnresolvedFunction
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
        }).toThrow(new Error('The attribute "myProperty" is not valid.'));
    });

    //noinspection JSUnresolvedFunction
    it('can add and validate values', function () {

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
        expect(coll.validateProperties({'email': 'philipp.meisen@breinify.com'})).toBe(true);

        coll.add('SIMPLE');

        //noinspection JSUnresolvedFunction
        expect(coll.all()).toEqual({'EMAIL': 'email', 'SIMPLE': 'SIMPLE'});

        coll.add('ALSOSIMPLE', 'soSimple');

        //noinspection JSUnresolvedFunction
        expect(coll.all()).toEqual({'EMAIL': 'email', 'SIMPLE': 'SIMPLE', 'ALSOSIMPLE': 'soSimple'});
        //noinspection JSUnresolvedFunction
        expect(coll.is('email')).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(coll.is('SIMPLE')).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(coll.is('soSimple')).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(coll.default('email')).toBeUndefined();
        //noinspection JSUnresolvedFunction
        expect(coll.default('SIMPLE')).toBeUndefined();
        //noinspection JSUnresolvedFunction
        expect(coll.default('soSimple')).toBeUndefined();
        //noinspection JSUnresolvedFunction
        expect(coll.validateProperties({'email': 'philipp.meisen@breinify.com'})).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(coll.validateProperties({
            'email': 'philipp.meisen@breinify.com',
            'SIMPLE': null,
            'soSimple': 'value'
        })).toBe(true);
    });

    //noinspection JSUnresolvedFunction
    it('can validate groups', function () {

        var coll = new AttributeCollection();
        coll.add('FIRST', {
            name: 'first',
            group: 1
        });
        coll.add('LAST', {
            name: 'last',
            group: 1,
            optional: false
        });
        coll.add('DATE', {
            name: 'date',
            group: 1,
            optional: false
        });
        coll.add('OTHER', {
            name: 'other',
            group: 2
        });
        coll.add('MORE', {
            name: 'more',
            group: 3,
            optional: false
        });
        coll.add('ANOTHER', {
            name: 'another',
            group: 3,
            optional: false
        });

        //noinspection JSUnresolvedFunction
        expect(coll.validateProperties({
            'other': 'anotherValue'
        })).toBe(true);

        //noinspection JSUnresolvedFunction
        expect(coll.validateProperties({
            'first': 'Diane',
            'last': 'Keng',
            'date': '01/01/1980'
        })).toBe(true);

        //noinspection JSUnresolvedFunction
        expect(function () {
            coll.validateProperties({
                'first': 'Diane',
                'date': '01/01/1980'
            });
        }).toThrow(new Error('The group "1" expects a valid value for the attribute "last".'));

        //noinspection JSUnresolvedFunction
        expect(coll.validateProperties({
            'last': 'Keng',
            'date': '01/01/1980',
            'more': 'more is more',
            'another': 'less can be good'
        })).toBe(true);

        //noinspection JSUnresolvedFunction
        expect(function () {
            coll.validateProperties({
                'last': 'Keng',
                'date': '01/01/1980',
                'another': 'less can be good'
            });
        }).toThrow(new Error('The group "3" expects a valid value for the attribute "more".'));

        //noinspection JSUnresolvedFunction
        expect(function () {
            coll.validateProperties({
                'last': 'Keng',
                'more': 'more is more',
                'another': 'less can be good'
            });
        }).toThrow(new Error('The group "1" expects a valid value for the attribute "date".'));
    });
});