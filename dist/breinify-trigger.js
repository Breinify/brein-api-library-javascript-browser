"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('trigger')) {
        return;
    }

    const $ = Breinify.UTL._jquery();

    const changeObserver = {
        domTreeObserver: null,
        domTreeDependModules: null,
        oldPushState: null,
        oldReplaceState: null,
        popStateListener: null,

        observeDomTreeChanges: function () {
            const _self = this;

            if (this.domTreeObserver !== null) {
                return;
            }

            this.domTreeObserver = new MutationObserver((mutations) => {

                for (let i = 0; i < mutations.length; i++) {
                    const mutation = mutations[i];
                    const attribute = mutation.attributeName;

                    const addedNodes = mutations[i].addedNodes;
                    const removedNodes = mutations[i].removedNodes;

                    if (typeof attribute === 'string' && attribute.trim() !== '') {
                        _self.handleDomChange($(mutation.target), {
                            type: 'attribute-change',
                            attribute: attribute
                        });
                    }

                    for (let k = 0; k < addedNodes.length; k++) {
                        const addedNode = addedNodes[k];
                        _self.handleDomChange($(addedNode), {
                            type: 'added-element'
                        });
                    }

                    for (let k = 0; k < removedNodes.length; k++) {
                        const removedNode = removedNodes[k];
                        _self.handleDomChange($(removedNode), {
                            type: 'removed-element'
                        });
                    }
                }
            });

            this.domTreeObserver.observe($('body').get(0), {
                childList: true, // Observe changes to child nodes
                attributes: true, // Observe changes to attributes
                characterData: true, // Observe changes to text content
                subtree: true, // Observe changes to all descendants of the target node
                attributeOldValue: false, // Record the previous value of changed attributes
                characterDataOldValue: false // Record the previous value of changed text nodes
            });
        },

        observeUrlChanges: function () {
            const _self = this;

            // we are already observing, so no need to do it again
            if (_self.oldPushState !== null || _self.oldReplaceState !== null || _self.popStateListener !== null) {
                return;
            } else if (typeof window.history !== 'object') {
                console.error('unable to observe history changes, disabling trigger observation');
                return;
            }

            // before observing changes trigger the dependent modules once ...
            this.handlePageChange();

            // ... and start observing for newly added modules need to be checked
            $(document).on('module-added', function (name, module) {
                try {
                    _self.checkModule(name, module);
                } catch (e) {
                    console.error('failed to check module: ' + name);
                }
            });

            if ($.isFunction(window.history.pushState)) {
                _self.oldPushState = window.history.pushState;
                window.history.pushState = function pushState() {
                    const ret = _self.oldPushState.apply(this, arguments);
                    window.dispatchEvent(new Event('pushstate'));
                    _self.handlePageChange();

                    return ret;
                };
            }

            if ($.isFunction(window.history.replaceState)) {
                _self.oldReplaceState = window.history.replaceState;
                window.history.replaceState = function replaceState() {
                    const ret = _self.oldReplaceState.apply(this, arguments);
                    window.dispatchEvent(new Event('replacestate'));
                    _self.handlePageChange();

                    return ret;
                };
            }

            // add a popstate listener
            _self.popStateListener = function () {
                _self.handlePageChange();
            };
            window.addEventListener('popstate', _self.popStateListener);
        },

        handlePageChange: function () {
            const _self = this;

            try {
                const api = Breinify.plugins.api;
                const modules = $.isPlainObject(api) ? api.modules : {};

                _self.domTreeDependModules = {};
                $.each(modules, function (name, module) {
                    try {
                        _self.checkModule(name, module);
                    } catch (e) {
                        console.error('failed to check module: ' + name);
                    }
                });
            } catch (e) {
                console.error('failed to trigger ready', e);
            }
        },

        handleDomChange: function ($el, details) {
            const _self = this;

            if (!$.isPlainObject(this.domTreeDependModules)) {
                return;
            }

            const normalizedDetails = $.isPlainObject(details) ? $.extend(true, {
                type: 'undefined'
            }, details) : {};

            // run through each module that is registered and execute the change
            $.each(this.domTreeDependModules, function (name, module) {
                _self.executeOnChange(module, $el, normalizedDetails);
            });
        },

        checkModule: function (name, module) {

            // if we do not have a valid module or not a ready function we are done
            if (!$.isPlainObject(module) || !$.isFunction(module.onChange)) {
                return;
            }
            // next we check that we have a valid-page checker and that the page is valid
            else if ($.isFunction(module.isValidPage) && !module.isValidPage(window.location.pathname)) {
                return;
            }
            // check if we have to find a specific dom-element to appear or happen
            else if (!$.isFunction(module.findRequirements)) {

                // if not we just trigger the change-detected since all requirements are met
                this.executeOnChange(module, {});
            }
            // make sure we do not have the same module twice, so just ignore if it exists already
            if (typeof this.domTreeDependModules[name] !== 'undefined') {
                return;
            }

            // check if the requirement is met on body
            this.executeOnChange(module, $('body'), {
                type: 'full-scan'
            });

            // we also add the element to observe any further changes
            this.domTreeDependModules[name] = module;
        },

        executeOnChange: function (module, $el, data) {
            if (!$.isPlainObject(module) || !$.isFunction(module.onChange)) {
                return;
            }

            // determine the requirements and handle the result
            const requirements = module.findRequirements($el, data);
            if (requirements === null || requirements === false || typeof requirements === 'undefined') {
                // do nothing we are done, the result indicates a no-handle
            } else if ($.isPlainObject(requirements)) {
                module.onChange(requirements);
            } else if (requirements instanceof $ && requirements.length > 0) {
                module.onChange({
                    $requirements: requirements
                });
            } else if (requirements === true) {
                module.onChange({});
            }
        }
    };

    /**
     * This plugin is used to add a new layer of triggers to the modules, beside "just" reacting to the ready
     * event this library allows to react on url-changes and on specific DOM-tree changes.
     * @type {{object}}
     */
    const Trigger = {
        init: function () {
            changeObserver.observeDomTreeChanges();
            changeObserver.observeUrlChanges();
        }
    };

    // bind the module
    const BoundTrigger = Breinify.plugins._add('trigger', Trigger);

    // finally use the bound activities (since getConfig is available) to retrieve activities
    Breinify.onReady(function () {
        BoundTrigger.init();
    });
})();