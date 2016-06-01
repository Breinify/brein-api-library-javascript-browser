describe('BreinifyConfig', function () {

    //noinspection JSUnresolvedFunction
    it('is globally available', function () {

        //noinspection JSUnresolvedVariable
        var config = window['Breinify'].BreinifyConfig;

        //noinspection JSUnresolvedFunction
        expect(typeof config).toBe('function');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof config).toBe('function');
    });


    //noinspection JSUnresolvedFunction
    it('is constructable without any object', function () {

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var config = new Breinify.BreinifyConfig();

        //noinspection JSUnresolvedVariable
        var a = Breinify.BreinifyConfig.ATTRIBUTES;

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config.get(a.URL)).toBe(config.default(a.URL));
    });

    //noinspection JSUnresolvedFunction
    it('is constructable with plain object', function () {

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var config = new Breinify.BreinifyConfig({});

        //noinspection JSUnresolvedVariable
        var a = Breinify.BreinifyConfig.ATTRIBUTES;

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config.get(a.URL)).toBe(config.default(a.URL));
    });

    //noinspection JSUnresolvedFunction
    it('is constructable by cloning', function () {

        //noinspection JSUnresolvedVariable
        var a = Breinify.BreinifyConfig.ATTRIBUTES;

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var config1 = new Breinify.BreinifyConfig(new Breinify.BreinifyConfig({}));

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config1.get(a.URL)).toBe(config1.default(a.URL));

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var config2 = new Breinify.BreinifyConfig(new Breinify.BreinifyConfig({
            'url': 'https://internal-modified-api.breinify.com'
        }));

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config2.get(a.URL)).toBe('https://internal-modified-api.breinify.com');
    });

    //noinspection JSUnresolvedFunction
    it('provides attributes', function () {

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(typeof Breinify.BreinifyConfig.ATTRIBUTES).toBe('object');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.BreinifyConfig.ATTRIBUTES.hasOwnProperty('URL')).toBe(true);
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.BreinifyConfig.ATTRIBUTES.hasOwnProperty('API_KEY')).toBe(true);
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.BreinifyConfig.ATTRIBUTES.API_KEY).toBe('apiKey');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.BreinifyConfig.ATTRIBUTES.hasOwnProperty('NOT_AVAILABLE')).toBe(false);
    });

    //noinspection JSUnresolvedFunction
    it('can have multiple instances', function () {

        //noinspection JSUnresolvedVariable
        var a = Breinify.BreinifyConfig.ATTRIBUTES;

        // create a configuration
        var config = {};
        config[a.URL] = 'https://api-internal.breinify.com';
        config[a.API_KEY] = '123789123981273891';
        config[a.SECRET] = null;

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var config1 = new Breinify.BreinifyConfig(config);

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var config2 = new Breinify.BreinifyConfig(config);
        config2.set(a.SECRET, 'MyLittleSecret');

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config1.get(a.URL)).toBe('https://api-internal.breinify.com');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config1.get(a.SECRET)).toBeNull();

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config2.get(a.SECRET)).toBe('MyLittleSecret');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config2.get(a.URL)).toBe('https://api-internal.breinify.com');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config2.get(a.VALIDATE)).toBe(true);
    });

    //noinspection JSUnresolvedFunction
    it('TODO', function () {

        //noinspection JSUnresolvedVariable
        var a = Breinify.BreinifyConfig.ATTRIBUTES;

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        var config = new Breinify.BreinifyConfig({
            'url': 'https://www.breinify.com',
            'validate': false
        });

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config.get(a.URL)).toBe('https://www.breinify.com');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(config.get(a.VALIDATE)).toBe(false);
    });
});