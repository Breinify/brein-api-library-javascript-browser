"use strict";

describe('Trigger DOM subscriber error isolation', function () {
    var $ = Breinify.UTL._jquery();
    var sequence = 0;
    var fixture;
    var modules;
    var calls;
    var prefix;
    var attribute = 'data-trigger-error-test';

    beforeEach(function () {
        modules = [];
        calls = [];
        prefix = 'trigger-error-test-' + (++sequence) + '-';
        fixture = document.createElement('div');
        fixture.innerHTML = '<span data-target="one"></span><span data-target="two"></span>';
        document.body.appendChild(fixture);
        spyOn(console, 'error');
        spyOn(Breinify, 'handleCaughtError').and.returnValue(true);
        Breinify.plugins.trigger.init();
    });

    afterEach(function () {
        modules.forEach(function (module) {
            module.findRequirements = function () { return false; };
            module.onChange = function () {};
        });
        fixture.remove();
    });

    function subscribe(name, failureStage, error) {
        var module = {
            findRequirements: function ($el, data) {
                if (!data || data.type !== 'attribute-change' || data.attribute !== attribute ||
                    !$el || !fixture.contains($el.get(0))) {
                    return false;
                }

                var target = $el.attr('data-target');
                if (failureStage === 'requirements') {
                    calls.push(name + ':' + target);
                    throw error;
                }
                return {target: target};
            },
            onChange: function (data) {
                calls.push(name + ':' + data.target);
                if (failureStage === 'callback') {
                    throw error;
                }
            }
        };
        modules.push(module);
        $(document).trigger('module-added', [prefix + name, module]);
    }

    async function mutateBothTargets() {
        fixture.children[0].setAttribute(attribute, 'changed');
        fixture.children[1].setAttribute(attribute, 'changed');
        await new Promise(function (resolve) { window.setTimeout(resolve, 0); });
    }

    function expectOrderedDelivery() {
        expect(calls).toEqual([
            'first:one', 'middle:one', 'last:one',
            'first:two', 'middle:two', 'last:two'
        ]);
    }

    ['requirements', 'callback'].forEach(function (stage) {
        it('continues subscribers and remaining mutation records after a ' + stage + ' error', async function () {
            var error = new Error('expected subscriber failure');
            subscribe('first');
            subscribe('middle', stage, error);
            subscribe('last');

            await mutateBothTargets();

            expectOrderedDelivery();
            expect(Breinify.handleCaughtError.calls.count()).toBe(1);
            expect(Breinify.handleCaughtError.calls.first().args[1].plugin).toBe('trigger');
            expect(console.error.calls.count()).toBe(2);
            expect(console.error).toHaveBeenCalledWith(
                'failed to handle DOM change for module: ' + prefix + 'middle', error
            );
        });
    });

    it('preserves successful delivery order without logging errors', async function () {
        subscribe('first');
        subscribe('middle');
        subscribe('last');

        await mutateBothTargets();

        expectOrderedDelivery();
        expect(console.error).not.toHaveBeenCalled();
        expect(Breinify.handleCaughtError).not.toHaveBeenCalled();
    });
    it('keeps delivering subscribers when the reporter throws', async function () {
        spyOn(Breinify, 'reportExecutionError').and.throwError('reporter failed');
        subscribe('first');
        subscribe('middle', 'callback', new TypeError('callback failed'));
        subscribe('last');
        await mutateBothTargets();
        expectOrderedDelivery();
    });

    it('does not report expected cancellation as a script defect', async function () {
        subscribe('first');
        subscribe('middle', 'callback', new DOMException('cancelled', 'AbortError'));
        subscribe('last');
        await mutateBothTargets();
        expectOrderedDelivery();
        expect(Breinify.handleCaughtError).not.toHaveBeenCalled();
    });

});
