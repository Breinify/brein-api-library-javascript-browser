"use strict";

describe('DevStudio consent tab', function () {
    const consent = Breinify.UTL.consent;
    let panel;
    let update;

    function configure(value) {
        consent.configure({provider: {
            evaluate: function (callback) { callback(value); },
            getSettings: function () { return {provider: 'example', mappings: {analytics: ['Statistics']}}; },
            onChange: function (callback) {
                update = function (next) { value = next; callback(next); };
                return function () {};
            }
        }});
    }

    beforeAll(function () {
        spyOn(Breinify.UTL.internal, 'isDevMode').and.returnValue(true);
        Breinify.plugins.devStudio.init();
        panel = Breinify.plugins.devStudio.devStudio;
        panel.remove();
    });

    beforeEach(function () {
        jasmine.clock().install();
        consent.configure({enabled: false});
        panel.consentSnapshot = null;
        document.body.appendChild(panel);
    });

    afterEach(function () {
        panel.remove();
        consent.configure({enabled: false});
        jasmine.clock().uninstall();
    });

    it('hides the tab when disabled and returns to Info if a saved Consent tab is unavailable', function () {
        panel._updateConsentTab();
        expect(panel.$tabs.filter('[data-tab="consent"]').prop('hidden')).toBe(true);
        panel._switchTab({target: {dataset: {tab: 'consent'}}});
        expect(panel.activeTab).toBe('info');
    });

    it('shows active settings and feature permissions without evaluating consent or collecting users', function () {
        configure({functional: true, analytics: false, personalization: true});
        panel._updateConsentTab();
        const evaluate = spyOn(consent, 'evaluate');
        const user = spyOn(Breinify.UTL.user, 'create');
        panel._switchTab({target: {dataset: {tab: 'consent'}}});
        expect(panel.$tabs.filter('[data-tab="consent"]').prop('hidden')).toBe(false);
        expect(panel.$consentContainer.text()).toContain('Provider: example');
        expect(panel.$consentContainer.text()).toContain('Statistics');
        expect(panel.$consentContainer.find('[data-level="personalization"] .consent-status').attr('aria-label'))
            .toBe('Denied');
        expect(panel.$consentContainer.find('.consent-levels li').length).toBe(4);
        expect(panel.$consentContainer.find('[data-feature="activities"] td').eq(1).find('.consent-status').attr('aria-label')).toBe('Denied');
        expect(panel.$consentContainer.find('[data-feature="recommendations"] td').eq(1).find('.consent-status').attr('aria-label')).toBe('Granted');
        expect(evaluate).not.toHaveBeenCalled();
        expect(user).not.toHaveBeenCalled();
    });

    it('updates visible decisions on consent changes and hides the tab after disabling', function () {
        configure({analytics: false});
        panel._switchTab({target: {dataset: {tab: 'consent'}}});
        panel.isVisible = true;
        update({analytics: true});
        jasmine.clock().tick(1000);
        expect(panel.$consentContainer.find('[data-feature="activities"] td').eq(1).find('.consent-status').attr('aria-label')).toBe('Granted');
        consent.configure({enabled: false});
        jasmine.clock().tick(1000);
        expect(panel.$tabs.filter('[data-tab="consent"]').prop('hidden')).toBe(true);
        expect(panel.activeTab).toBe('info');
    });

    it('distinguishes waiting from timeout and keeps content available in the diagnostic matrix', function () {
        consent.configure({timeoutInMs: 10});
        panel._switchTab({target: {dataset: {tab: 'consent'}}});
        expect(panel.$consentContainer.text()).toContain('Waiting for consent information');
        jasmine.clock().tick(10);
        panel._refreshConsent();
        expect(panel.$consentContainer.text()).toContain('Timeout — Content-only fallback');
        expect(panel.$consentContainer.find('[data-feature="recommendations"] td').eq(1).find('.consent-status').attr('aria-label')).toBe('Granted');
    });

    it('clears the diagnostic timer on disconnect and restarts it on reconnect', function () {
        expect(panel.consentTimer).not.toBeNull();
        panel.remove();
        expect(panel.consentTimer).toBeNull();
        document.body.appendChild(panel);
        expect(panel.consentTimer).not.toBeNull();
    });

    it('shows named optional and required storage permissions instead of request storage flags', function () {
        configure({functional: true, analytics: true, personalization: true});
        panel._switchTab({target: {dataset: {tab: 'consent'}}});
        const $sections = panel.$consentContainer.find('.consent-section');
        expect($sections.eq(0).find('h2').text()).toBe('Feature permissions');
        expect($sections.eq(1).find('h2').text()).toBe('Storage permissions');
        expect($sections.eq(0).find('[data-feature="identifierStorage"]').length).toBe(0);
        expect($sections.eq(1).find('[data-feature="activities"]').length).toBe(0);
        expect($sections.eq(1).find('[data-feature="identifierStorage"] .consent-status.granted').length).toBe(2);
        const $activity = panel.$consentContainer.find('[data-feature="activities"]');
        expect($activity.find('[data-storage-feature="identifierStorage"]').text()).toContain('Optional · ✓ / ✓');
        expect($activity.find('[data-storage-feature="profileStorage"]').text()).toContain('Optional · ✓ / ✓');
        const $delayed = panel.$consentContainer.find('[data-feature="delayedActivities"]');
        expect($delayed.find('[data-storage-feature="continuityStorage"]').text()).toContain('Required · ✓ / ✓');
        expect(panel.$consentContainer.find('[data-feature="preferenceManagement"]').text())
            .toContain('No declared dependency');
        update({});
        panel._refreshConsent();
        expect(panel.$consentContainer.find('[data-feature="activities"] [data-storage-feature="identifierStorage"]')
            .text()).toContain('Optional · ✕ / ✕');
    });

    it('shows exact data rules and their current permission without granting the whole profile', function () {
        consent.configure({data: {store: {path: 'additional.location.goPuffStoreId'},
            lat: {path: 'additional.location.lat', requires: ['analytics']}}});
        panel._switchTab({target: {dataset: {tab: 'consent'}}});
        expect(panel.$consentContainer.find('[data-rule="store"]').text()).toContain('Always allowed');
        expect(panel.$consentContainer.find('[data-rule="store"] .consent-status').attr('aria-label')).toBe('Granted');
        expect(panel.$consentContainer.find('[data-rule="lat"] .consent-status').attr('aria-label')).toBe('Denied');
    });

    it('renders provider settings as text rather than markup', function () {
        consent.configure({provider: {
            evaluate: function (callback) { callback({}); },
            getSettings: function () { return {provider: '<img src=x onerror="throw 1">'}; }
        }});
        panel._switchTab({target: {dataset: {tab: 'consent'}}});
        expect(panel.$consentContainer.find('img').length).toBe(0);
        expect(panel.$consentContainer.text()).toContain('<img src=x');
    });
});
