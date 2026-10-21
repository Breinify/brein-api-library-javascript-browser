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
    });
});
