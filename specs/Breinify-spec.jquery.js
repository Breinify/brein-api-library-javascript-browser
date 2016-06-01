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