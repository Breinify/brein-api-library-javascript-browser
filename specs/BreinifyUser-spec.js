"use strict";

describe('BreinifyUser', function () {

    //noinspection JSUnresolvedFunction
    it('is globally available', function () {

        //noinspection JSUnresolvedVariable
        var user = window['Breinify'].BreinifyUser;

        //noinspection JSUnresolvedFunction
        expect(typeof user).toBe('function');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof user).toBe('function');
    });

    //noinspection JSUnresolvedFunction
    it('is constructable without any object', function () {

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var user = new Breinify.BreinifyUser();

        //noinspection JSUnresolvedVariable
        var a = Breinify.BreinifyUser.ATTRIBUTES;

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(user.all()).toEqual({
            'additional': {
                'userAgent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1',
                'location': null
            }
        });
    });

    //noinspection JSUnresolvedFunction
    it('is constructable with plain object', function () {

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var user = new Breinify.BreinifyUser({
            'email': 'philipp.meisen@breinify.com'
        });

        //noinspection JSUnresolvedVariable
        var a = Breinify.BreinifyUser.ATTRIBUTES;

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(user.get(a.EMAIL)).toBe('philipp.meisen@breinify.com');
    });

    //noinspection JSUnresolvedFunction
    it('is constructable by cloning', function () {

        //noinspection JSUnresolvedVariable
        var a = Breinify.BreinifyUser.ATTRIBUTES;

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var user1 = new Breinify.BreinifyUser({
            'firstName': 'Philipp',
            'lastName': 'Meisen',
            'dateOfBirth': '01/20/1981'
        });
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var user2 = new Breinify.BreinifyUser(user1);

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(user1.get(a.FIRSTNAME)).toBe('Philipp');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(user1.get(a.LASTNAME)).toBe('Meisen');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(user1.get(a.DATEOFBIRTH)).toBe('01/20/1981');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(user2.get(a.FIRSTNAME)).toBe(user1.get(a.FIRSTNAME));
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(user2.get(a.LASTNAME)).toBe(user1.get(a.LASTNAME));
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(user2.get(a.DATEOFBIRTH)).toBe(user1.get(a.DATEOFBIRTH));
    });

    //noinspection JSUnresolvedFunction
    it('provides attributes', function () {

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof Breinify.BreinifyUser.ATTRIBUTES).toBe('object');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.BreinifyUser.ATTRIBUTES.hasOwnProperty('EMAIL')).toBe(true);
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.BreinifyUser.ATTRIBUTES.hasOwnProperty('FIRSTNAME')).toBe(true);
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.BreinifyUser.ATTRIBUTES.LASTNAME).toBe('lastName');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.BreinifyUser.ATTRIBUTES.hasOwnProperty('MD5EMAIL')).toBe(true);
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.BreinifyUser.ATTRIBUTES.hasOwnProperty('UNKNOWN')).toBe(false);
    });

    //noinspection JSUnresolvedFunction
    it('handles additional values correctly', function (done) {

        //noinspection JSUnresolvedVariable
        new Breinify.BreinifyUser({
            'additional': {
                'userAgent': 'hidden'
            }
        }, function(user) {
            
            //noinspection JSUnresolvedFunction,JSUnresolvedVariable
            expect(user.all().additional.userAgent).toBe('hidden');

            user.add('userAgent', navigator.userAgent);
            //noinspection JSUnresolvedFunction,JSUnresolvedVariable
            expect(user.all().additional.userAgent).toBe('Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1');
            //noinspection JSUnresolvedFunction,JSUnresolvedVariable
            expect(user.all().additional.location).toBeNull();

            var loc = {
                'longitude': -37.866963,
                'latitude': 144.980615
            };
            user.add('location', loc);
            //noinspection JSUnresolvedFunction,JSUnresolvedVariable
            expect(user.all().additional.userAgent).toBe('Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1');
            //noinspection JSUnresolvedFunction,JSUnresolvedVariable
            expect(user.all().additional.location).toEqual(loc);

            done();
        });
    });
});