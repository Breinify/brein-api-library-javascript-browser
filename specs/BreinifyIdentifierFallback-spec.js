"use strict";

describe('Identifier cookie fallback', function () {
    it('selects cookie storage lazily when browser storage is blocked', function () {
        const cookies = Breinify.UTL.cookies;
        spyOnProperty(window, 'localStorage', 'get').and.throwError('Storage blocked');
        spyOnProperty(window, 'sessionStorage', 'get').and.throwError('Storage blocked');
        spyOn(Breinify.UTL.cookie, 'get').and.callFake(function (name) {
            return name === cookies.browserId ? 'cookie-browser' : 'cookie-session';
        });
        expect(Breinify.UTL.user.getBrowserId()).toBe('cookie-browser');
        expect(Breinify.UTL.user.getSessionId()).toBe('cookie-session');
    });
});
