"use strict";

describe('BreinifyUtil', function () {

    describe('placeholders', function () {
        it('resolves own dotted paths and formats values without recursively interpreting their text', function () {
            const context = {condition: {feature: {value: '%%condition.missing.value%%'},
                dataFeedMetric: {metricValue: 23}, weather: {subConditions: ['A', 'B']}}};
            const placeholders = Breinify.UTL.placeholders;
            expect(placeholders.render('Hot: %%condition.dataFeedMetric.metricValue | number:0%%', context))
                .toBe('Hot: ' + Breinify.UTL.formatValue(23, 'number', {decimalPlaces: 0}));
            expect(placeholders.render('%%condition.weather.subConditions | join:", | "%%', context)).toBe('A, | B');
            expect(placeholders.render('%%condition.feature.value%%', context)).toBe('%%condition.missing.value%%');
            expect(placeholders.render('Try %%name%%', context)).toBe('Try %%name%%');
        });

        it('distinguishes missing data from zero, false and empty strings', function () {
            const placeholders = Breinify.UTL.placeholders;
            const context = {condition: {feature: {value: false}, elementExists: {count: 0}}, activation: {groups: {1: ''}}};
            expect(placeholders.render('%%condition.feature.value%%', context)).toBe('false');
            expect(placeholders.render('%%condition.elementExists.count%%', context)).toBe('0');
            expect(placeholders.render('%%activation.groups.1%%', context)).toBe('');
            expect(function () { placeholders.render('%%condition.missing.value%%', context); }).toThrowError();
        });

        it('rejects inherited properties, executable expressions, missing delimiters and implicit array conversion', function () {
            const placeholders = Breinify.UTL.placeholders;
            const context = {condition: Object.create({feature: {value: 'inherited'}})};
            expect(function () { placeholders.render('%%condition.feature.value%%', context); }).toThrowError();
            expect(function () { placeholders.render('%%condition.constructor.name%%', context); }).toThrowError();
            expect(function () { placeholders.render('%%condition.feature.value', context); }).toThrowError();
            expect(function () { placeholders.render('%%condition.feature.value | alert(1)%%', {
                condition: {feature: {value: 1}}
            }); }).toThrowError();
            expect(function () { placeholders.render('%%condition.feature.value%%', {
                condition: {feature: {value: ['A']}}
            }); }).toThrowError();
        });

        it('creates immutable snapshots without modifying source data', function () {
            const source = {condition: {feature: {value: ['A']}}};
            const snapshot = Breinify.UTL.placeholders.snapshot(source);
            source.condition.feature.value.push('B');
            expect(snapshot.condition.feature.value).toEqual(['A']);
            expect(Object.isFrozen(snapshot.condition.feature.value)).toBe(true);
            expect(Object.isFrozen(source)).toBe(false);
        });
    });

    describe('formatValue', function () {
        it('formats numbers with locale grouping and explicit or default precision', function () {
            const format = Breinify.UTL.formatValue;
            expect(format(1234.567, 'number', {locale: 'en-US'})).toBe('1,234.567');
            expect(format(1234.5678, 'number', {locale: 'en-US'})).toBe('1,234.568');
            expect(format(1234.567, 'number', {locale: 'en-US', decimalPlaces: 0})).toBe('1,235');
            expect(format(1234.5, 'number', {locale: 'en-US', decimalPlaces: 2})).toBe('1,234.50');
            expect(format(-1234.5, 'number', {locale: 'de-DE', decimalPlaces: 2})).toBe('-1.234,50');
            expect(format(0, 'number', {locale: 'en-US'})).toBe('0');
            expect(format(1, 'number', {locale: 'en-US', decimalPlaces: 20})).toBe('1.00000000000000000000');
        });

        it('uses the browser locale when none is specified', function () {
            const expected = new Intl.NumberFormat(undefined, {
                style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 3
            }).format(1234.567);
            expect(Breinify.UTL.formatValue(1234.567, 'number')).toBe(expected);
        });

        it('formats fractions as percentages without modifying the source value', function () {
            const format = Breinify.UTL.formatValue;
            expect(format(0.3, 'percent', {locale: 'en-US'})).toBe('30%');
            expect(format(0.12345, 'percent', {locale: 'en-US', decimalPlaces: 2})).toBe('12.35%');
            expect(format(30, 'percent', {locale: 'en-US'})).toBe('3,000%');
        });

        it('requires currency explicitly and supports currency-specific or explicit precision', function () {
            const format = Breinify.UTL.formatValue;
            expect(format(1234.5, 'currency', {locale: 'en-US', currency: 'usd'})).toBe('$1,234.50');
            expect(format(1234.5, 'currency', {
                locale: 'en-US', currency: 'USD', decimalPlaces: 0
            })).toBe('$1,235');
            const expected = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'JPY'}).format(1234.5);
            expect(format(1234.5, 'currency', {locale: 'en-US', currency: 'JPY'})).toBe(expected);
            [undefined, null, '', 'US', '$', ' USD '].forEach(function (currency) {
                expect(function () { format(1, 'currency', {currency: currency}); }).toThrowError(TypeError);
            });
        });

        it('uses locale-aware case conversion and preserves empty strings', function () {
            const format = Breinify.UTL.formatValue;
            expect(format('social', 'upper', {locale: 'en-US'})).toBe('SOCIAL');
            expect(format('SOCIAL', 'lower', {locale: 'en-US'})).toBe('social');
            expect(format('i', 'upper', {locale: 'tr'})).toBe('\u0130');
            expect(format('I', 'lower', {locale: 'tr'})).toBe('\u0131');
            expect(format('', 'upper')).toBe('');
            expect(function () { format(123, 'lower'); }).toThrowError(TypeError);
        });

        it('joins scalar arrays with an explicit separator without mutating them', function () {
            const values = Object.freeze(['A', 0, false]);
            const options = Object.freeze({separator: ', '});
            expect(Breinify.UTL.formatValue(values, 'join', options)).toBe('A, 0, false');
            expect(values).toEqual(['A', 0, false]);
            expect(Breinify.UTL.formatValue(['A', 'B'], 'join', {separator: ''})).toBe('AB');
            expect(Breinify.UTL.formatValue([], 'join', options)).toBe('');
            expect(function () { Breinify.UTL.formatValue(values, 'join'); }).toThrowError(TypeError);
        });

        it('rejects sparse or nonscalar arrays rather than silently producing misleading text', function () {
            [[null], [undefined], [{}], [['A']], [Infinity], [NaN], new Array(1), 'A'].forEach(function (value) {
                expect(function () {
                    Breinify.UTL.formatValue(value, 'join', {separator: ', '});
                }).toThrowError(TypeError);
            });
        });

        it('returns null for missing values but never converts numeric strings or booleans to numbers', function () {
            const format = Breinify.UTL.formatValue;
            expect(format(null, 'number')).toBeNull();
            expect(format(undefined, 'upper')).toBeNull();
            expect(format(null, 'currency', {currency: 'USD'})).toBeNull();
            ['12', '', false, true, {}, [], NaN, Infinity, -Infinity].forEach(function (value) {
                expect(function () { format(value, 'number'); }).toThrowError(TypeError);
            });
        });

        it('rejects unknown formatters and options, including when the value is missing', function () {
            const format = Breinify.UTL.formatValue;
            expect(function () { format(1, 'unknown'); }).toThrowError(RangeError);
            expect(function () { format(null, 'unknown'); }).toThrowError(RangeError);
            expect(function () { format(1, function () {}); }).toThrowError(TypeError);
            expect(function () { format(1, 'number', null); }).toThrowError(TypeError);
            expect(function () { format(1, 'number', []); }).toThrowError(TypeError);
            expect(function () { format(1, 'number', {currency: 'USD'}); }).toThrowError(RangeError);
            expect(function () { format('a', 'upper', {decimalPlaces: 2}); }).toThrowError(RangeError);
        });

        it('rejects invalid precision and locale instead of silently falling back', function () {
            const format = Breinify.UTL.formatValue;
            [-1, 21, 1.5, '2', null, NaN, Infinity].forEach(function (places) {
                expect(function () { format(1, 'number', {decimalPlaces: places}); }).toThrowError(RangeError);
            });
            ['', ' en-US ', null, ['en-US'], 123].forEach(function (locale) {
                expect(function () { format(1, 'number', {locale: locale}); }).toThrowError(TypeError);
            });
            expect(function () { format(1, 'number', {locale: 'en_US'}); }).toThrowError(RangeError);
            expect(function () { format(null, 'upper', {locale: 'en_US'}); }).toThrowError(RangeError);
        });

        it('does not mutate options, parse tokens, or escape text for a rendering destination', function () {
            const options = Object.freeze({locale: 'en-US', currency: 'usd', decimalPlaces: 2});
            expect(Breinify.UTL.formatValue(12, 'currency', options)).toBe('$12.00');
            expect(options.currency).toBe('usd');
            expect(Breinify.UTL.formatValue(['<b>', '%%name%%'], 'join', {separator: ''}))
                .toBe('<b>%%name%%');
        });
    });

    describe('split-test assignment expiry', function () {
        var user;
        var originalData;
        var now;

        beforeEach(function () {
            user = Breinify.UTL.user;
            originalData = user.splitTestData;
            now = Date.now();
            spyOn(Date, 'now').and.callFake(function () { return now; });
            spyOn(Breinify.UTL.storage, 'init');
            spyOn(Breinify.UTL.storage, 'get');
            spyOn(Breinify.UTL.storage, 'update');
        });

        afterEach(function () {
            user.splitTestData = originalData;
        });

        it('removes an expired preview from memory and persistence while retaining normal assignments', function () {
            user.splitTestData = {
                preview: {preview: true, expiresAt: now, lastUpdated: now - 1800000},
                normal: {lastUpdated: now - 3600000, groupDecision: 'Control'}
            };
            var data = user.getSplitTestData();
            expect(data.preview).toBeUndefined();
            expect(data.normal.groupDecision).toBe('Control');
            expect(Breinify.UTL.storage.update).toHaveBeenCalledWith(
                Breinify.UTL.storage.splitTestDataInstanceName, 30 * 24 * 60, data);
        });

        it('does not renew a preview on inspection and expires it on a later in-memory read', function () {
            var expiresAt = now + 1800000;
            var lastUpdated = now;
            user.splitTestData = {preview: {preview: true, expiresAt: expiresAt, lastUpdated: lastUpdated}};
            now += 600000;
            var data = user.getSplitTestData();
            expect(data.preview.expiresAt).toBe(expiresAt);
            expect(data.preview.lastUpdated).toBe(lastUpdated);
            expect(Breinify.UTL.storage.update).not.toHaveBeenCalled();
            now = expiresAt;
            expect(user.getSplitTestData().preview).toBeUndefined();
        });

        it('cleans restored expired previews and keeps the existing normal retention window', function () {
            user.splitTestData = null;
            Breinify.UTL.storage.get.and.returnValue({
                preview: {preview: true, expiresAt: now - 1, lastUpdated: now - 1800000},
                old: {lastUpdated: now - 86400001},
                current: {lastUpdated: now - 3600000}
            });
            var data = user.getSplitTestData();
            expect(Object.keys(data)).toEqual(['current']);
            expect(Breinify.UTL.storage.update).toHaveBeenCalled();
        });
    });

    //noinspection JSUnresolvedFunction
    it('is available through Breinify', function () {

        //noinspection JSUnresolvedVariable
        var util = window['Breinify'].UTL;

        //noinspection JSUnresolvedFunction
        expect(typeof util).toBe('object');
    });

    //noinspection JSUnresolvedFunction
    it('param retrieval in loc is working correctly', function () {
        var url;

        url = 'https://sample.com/search#q=SearchValue&p=5';
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.param('q', '#', null, null, url)).toBe('SearchValue');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.param('p', '#', null, null, url)).toBe('5');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.hasParam('p', '#', null, null, url)).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.hasParam('unknown', '#', null, null, url)).toBe(false);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.paramIs(5, 'p', '#', null, null, url)).toBe(true);

        url = 'https://moreSample.com/search#q=What%20Am%20I%20Searching%20for%20(%3F%25!%23%24)&p=1';
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.param('q', '#', null, null, url)).toBe('What Am I Searching for (?%!#$)');

        url = 'http://www.amazon.com/s/ref=nb_sb_noss_2?url=search-alias%3Daps&field-keywords=What%20Am%20I%20Searching%20for%20(%3F%25!%23%24)&rh=i%3Aaps%2Ck%3AWhat+Am+I+Searching+for+(%3F%25!%23%24)';
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.param('field-keywords', null, null, null, url)).toBe('What Am I Searching for (?%!#$)');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.parsedParam('string', 'url', null, null, null, url)).toBe('search-alias=aps');
    });

    //noinspection JSUnresolvedFunction
    it('calculates the correct md5', function () {
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.UTL.md5('philipp.meisen@breinify.com')).toBe('b82052775f777ec53787a3c2d3bc3b5d');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.UTL.md5('Hello World')).toBe('b10a8db164e0754105b7a99be72e3fe5');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.UTL.md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.UTL.md5(null)).toBeNull();
    });

    //noinspection JSUnresolvedFunction
    it('detects empty values', function () {

        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.UTL.isEmpty()).toBe(true);
        //noinspection JSUnresolvedFunction,JSUnresolvedVariable
        expect(Breinify.UTL.isEmpty(null)).toBe(true);
    });

    it('ensure simple object works', function () {
        var obj;

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.ensureSimpleObject(null)).toEqual({});

        obj = {};
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.ensureSimpleObject(obj)).toEqual(obj);

        obj = {'array': ['string1']};
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.ensureSimpleObject(obj)).toEqual(obj);

        obj = {'array': ['string1', 'string2']};
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.ensureSimpleObject(obj)).toEqual(obj);

        obj = {'array': [1, 2]};
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.ensureSimpleObject(obj)).toEqual(obj);

        obj = {'array': [1, 2, null, 3]};
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.ensureSimpleObject(obj)).toEqual(obj);

        obj = {'val1': 1, 'val2': 2, 'val3': []};
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.ensureSimpleObject(obj)).toEqual(obj);

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.ensureSimpleObject({'array': [1, 2, null, '3']})).toEqual({'array': [1, 2, null, null]});
    });

    //noinspection JSUnresolvedFunction
    it('simple object works', function () {
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.isSimpleObject(null)).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.isSimpleObject({})).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.isSimpleObject({'array': ['string1']})).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.isSimpleObject({'array': ['string1', 'string2']})).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.isSimpleObject({'array': [1, 2]})).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.isSimpleObject({'array': [1, 2, null, 3]})).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.isSimpleObject({'array': [1, 2, null, '3']})).toBe(false);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.isSimpleObject({'val1': 1, 'val2': 2, 'val3': []})).toBe(true);
    });

    //noinspection JSUnresolvedFunction
    it('trimQuotes', function () {
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.trimQuotes(null)).toBeNull();
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.trimQuotes({})).toEqual({});
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.trimQuotes('"Test"')).toEqual('Test');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.trimQuotes('  "Test"   ')).toEqual('  "Test"   ');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.trimQuotes('\'Test\'', true)).toEqual('Test');
    });

    //noinspection JSUnresolvedFunction
    it('getNested', function () {
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.getNested({})).toEqual({});
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.getNested(null)).toEqual(null);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.getNested()).toEqual(null);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.getNested({a: {b: {c: 'value'}}}, 'a', 'b', 'c')).toEqual('value');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.getNested({a: {b: {c: 'value'}}}, 'a', 'b', 'd')).toEqual(null);
    });

    //noinspection JSUnresolvedFunction
    it('getNestedByPath', function () {
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.getNestedByPath({})).toEqual({});
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.getNestedByPath(null)).toEqual(null);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.getNestedByPath()).toEqual(null);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.getNestedByPath({a: {b: {c: 'value'}}}, 'a.b.c')).toEqual('value');
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.getNestedByPath({a: {b: {c: 'value'}}}, 'a.b.d')).toEqual(null);
    });

    //noinspection JSUnresolvedFunction
    it('endsWith', function () {
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.endsWith('abc', 'c')).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.endsWith('abc', 'bc')).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.endsWith('abc', 'abc')).toBe(true);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.endsWith('abc', 'dabc')).toBe(false);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.endsWith(null, 'dabc')).toBe(false);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.endsWith('dabs', null)).toBe(false);

        var a = undefined;
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.endsWith(a, 'dabc')).toBe(false);
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.endsWith('dabs', a)).toBe(false);
    });

    //noinspection JSUnresolvedFunction
    it('extractsNeededInformation', function () {
        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.extract('http://google.de')).toEqual({
            full: 'http://google.de',
            username: null,
            password: null,
            port: null,
            protocol: 'http',
            domain: 'google.de',
            path: null,
            parameters: null
        });

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.extract('http://api.breinify.com/activity')).toEqual({
            full: 'http://api.breinify.com/activity',
            username: null,
            password: null,
            port: null,
            protocol: 'http',
            domain: 'api.breinify.com',
            path: '/activity',
            parameters: null
        });

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.extract('http://142.42.1.1/')).toEqual({
            full: 'http://142.42.1.1/',
            username: null,
            password: null,
            port: null,
            protocol: 'http',
            domain: '142.42.1.1',
            path: '/',
            parameters: null
        });

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.extract('https://142.42.1.1:8080/')).toEqual({
            full: 'https://142.42.1.1:8080/',
            username: null,
            password: null,
            port: 8080,
            protocol: 'https',
            domain: '142.42.1.1',
            path: '/',
            parameters: null
        });

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.extract('http://foo.com/blah_(wikipedia)_blah#cite-1')).toEqual({
            full: 'http://foo.com/blah_(wikipedia)_blah#cite-1',
            username: null,
            password: null,
            port: null,
            protocol: 'http',
            domain: 'foo.com',
            path: '/blah_(wikipedia)_blah',
            parameters: '#cite-1'
        });

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.extract('http://code.google.com/events/#&product=browser')).toEqual({
            full: 'http://code.google.com/events/#&product=browser',
            username: null,
            password: null,
            port: null,
            protocol: 'http',
            domain: 'code.google.com',
            path: '/events/',
            parameters: '#&product=browser'
        });

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.extract('http://foo.bar/?q=Test%20URL-encoded%20stuff')).toEqual({
            full: 'http://foo.bar/?q=Test%20URL-encoded%20stuff',
            username: null,
            password: null,
            port: null,
            protocol: 'http',
            domain: 'foo.bar',
            path: '/',
            parameters: '?q=Test%20URL-encoded%20stuff'
        });

        //noinspection JSUnresolvedFunction
        expect(Breinify.UTL.loc.extract('http://staging.sample.com/beer-cider/craft-brew.html')).toEqual({
            full: 'http://staging.sample.com/beer-cider/craft-brew.html',
            username: null,
            password: null,
            port: null,
            protocol: 'http',
            domain: 'staging.sample.com',
            path: '/beer-cider/craft-brew.html',
            parameters: null
        });
    });

    //noinspection JSUnresolvedFunction
    it('cbCollection', function (done) {
        var collector = Breinify.UTL.internal.cbCollector({
            '_callback': function (errors, results) {
                expect(results.success).toBe('successful');
                expect(results.error).toBe(undefined);
                expect(errors.success).toBe(undefined);
                expect(errors.error).toEqual(new Error('failed'));

                done();
            },
            'success': function (error, data) {
                this._set('success', error, data);
            },
            'error': function (error, data) {
                this._set('error', error, data);
            }
        });

        setTimeout(function () {
            collector.success(null, 'successful')
        }, 10);
        setTimeout(function () {
            collector.error(new Error('failed'))
        }, 10);
    });

    it('initializesTheStorage', function (done) {
        Breinify.UTL.storage.init({
            'products': {
                'values': []
            },
            'awards': {
                'values': []
            }
        }, function (error, result) {
            expect(result).toEqual({
                'loaded': ['products', 'awards'],
                'failed': []
            });

            // clear the storage to make sure the test did not keep any data
            Breinify.UTL.storage.instance.clear();
            done();
        });
    });

    it('handlesGetParameters', function () {
        var result;
        var input = [
            {},
            'a string',
            {special: '/\\Àäã.~!@#$%^&*()_-+='},
            1232151.123213,
            12312
        ];

        for (var i = 0; i < input.length; i++) {
            result = Breinify.UTL.loc.createGetParameter(input[i]);
            expect(Breinify.UTL.loc.parseGetParameter('test', result)).toEqual(input[i]);
        }
    });

    it('appliesContentByDomOperation', function () {
        var $fixture = $(
            '<div>' +
            '    <span class="first"></span>' +
            '    <span class="second"></span>' +
            '    <div class="content"></div>' +
            '</div>'
        );
        var $anchors = $fixture.find('.first, .second');
        var $content = $fixture.find('.content');

        expect(Breinify.UTL.dom.attachByOperation(
            'after',
            $anchors,
            $('<span class="inserted"></span>')
        )).toBe(true);
        expect($fixture.find('.inserted').length).toBe(2);

        expect(Breinify.UTL.dom.applyContentByOperation(
            'replaceContent',
            $content,
            '<strong>text content</strong>',
            false
        )).toBe(true);
        expect($content.text()).toBe('<strong>text content</strong>');
        expect($content.find('strong').length).toBe(0);

        expect(Breinify.UTL.dom.applyContentByOperation(
            'replaceContent',
            $content,
            '<strong>html content</strong>',
            true
        )).toBe(true);
        expect($content.find('strong').text()).toBe('html content');

        expect(Breinify.UTL.dom.applyContentByOperation(
            'append',
            $content,
            '<em>appended html</em>',
            true
        )).toBe(true);
        expect($content.find('em').text()).toBe('appended html');

        expect(Breinify.UTL.dom.applyContentByOperation(
            'replace',
            $content,
            $('<img class="replacement" />'),
            false
        )).toBe(true);
        expect($fixture.find('.content').length).toBe(0);
        expect($fixture.find('.replacement').length).toBe(1);
    });
});
