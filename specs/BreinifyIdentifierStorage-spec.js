"use strict";

describe('Existing identifier storage formats', function () {
    it('reads existing browser and session identifiers without changing their stored formats', function () {
        const storage = Breinify.UTL.storage;
        const cookies = Breinify.UTL.cookies;
        const browserEntry = JSON.stringify({v: 'existing-browser', exp: Date.now() + 60000});
        window.localStorage.setItem(cookies.browserId, browserEntry);
        window.sessionStorage.setItem(cookies.sessionId, 'existing-session');
        expect(Breinify.UTL.user.getBrowserId()).toBe('existing-browser');
        expect(Breinify.UTL.user.getSessionId()).toBe('existing-session');
        expect(window.localStorage.getItem(cookies.browserId)).toBe(browserEntry);
        expect(window.sessionStorage.getItem(cookies.sessionId)).toBe('existing-session');
        expect(storage.keys('local').filter(function (key) {
            return key.indexOf('br-storage-test-') === 0;
        })).toEqual([]);
    });
});
