//noinspection JSUnresolvedVariable
/**
 * The method has two scopes, the global scope (typically window),
 * and the dependency scope. Within the dependency scope all the
 * dependencies are bound.
 */
//noinspection JSUnresolvedVariable
!function (scope, dependencyScope) {

    //noinspection JSUnresolvedVariable
    var misc = dependencyScope.misc;
    var $ = dependencyScope.jQuery;
    var BreinifyConfig = dependencyScope.BreinifyConfig;

    /*
     * The internally used configuration used for all calls.
     */
    var _config = null;

    /**
     * The one and only instance of the library.
     */
    var Breinify = {
        version: '{{PROJECT.VERSION}}',
        jQueryVersion: $.fn.jquery
    };

    Breinify.BreinifyConfig = BreinifyConfig;

    /**
     * Modify the configuration to the specified configuration.
     *
     * @param c the new configuration to be used, can be a plain object,
     * an instance of BreinifyConfig, or null
     */
    Breinify.setConfig = function (c) {

        //noinspection JSUnresolvedFunction
        _config = new BreinifyConfig(c);
    };

    /**
     * Gets the current configuration.
     *
     * @returns {BreinifyConfig} the current configuration
     */
    Breinify.config = function () {

        if (_config === null) {
            //noinspection JSUnresolvedFunction
            _config = new BreinifyConfig();
        }

        return _config.all();
    };

    Breinify.output = function () {

    };

    //noinspection JSUnresolvedFunction
    misc.export(scope, 'Breinify', Breinify);
}(window, dependencyScope);