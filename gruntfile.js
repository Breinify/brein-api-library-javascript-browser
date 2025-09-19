/*
 * This gruntfile is based on the project-gruntfile found at:
 *  https://github.com/Breinify/brein-javascript/tree/master/grunt/project-gruntfile.js
 *
 * Template Version: 1.1.0
 *
 * Change Log:
 *
 * 1.1.0
 *  - removed Jasmine from grunt build script (because of dependency issues)
 *
 * 1.0.2
 *  - added possibility to define a port for the server
 *  - added replacement of placeholders in JavaScripts ({{PROJECT.VERSION}})
 *  - added a first taste of Jasmine
 *  - added a default-layout
 *
 * 1.0.1
 *  - added a file checking dependency for bower_components
 *  - added this header, i.e. versions without this header are based on 1.0.0
 *
 * 1.0.0
 *  - first release
 */
module.exports = function (grunt) {

    /*
     * Configuration settings
     */
    var defaultPort = 20000;
    var banner = '/*\n' +
        ' * ' + '<%= pkg.name %>\n' +
        ' * ' + 'v<%= pkg.version %>\n' +
        ' **/\n';
    var bowerPaths = {
        bowerDirectory: 'bower_components',
        bowerrc: '.bowerrc',
        bowerJson: 'bower.json'
    };

    //noinspection JSUnresolvedFunction
    grunt.loadNpmTasks('main-bower-files');
    //noinspection JSUnresolvedFunction
    grunt.loadNpmTasks('grunt-contrib-copy');
    //noinspection JSUnresolvedFunction
    grunt.loadNpmTasks('grunt-bower-install-simple');
    //noinspection JSUnresolvedFunction
    grunt.loadNpmTasks('grunt-contrib-clean');
    //noinspection JSUnresolvedFunction
    grunt.loadNpmTasks('grunt-contrib-connect');
    //noinspection JSUnresolvedFunction
    grunt.loadNpmTasks('grunt-contrib-watch');
    //noinspection JSUnresolvedFunction
    grunt.loadNpmTasks('grunt-contrib-concat');
    //noinspection JSUnresolvedFunction
    grunt.loadNpmTasks('grunt-contrib-uglify');
    //noinspection JSUnresolvedFunction
    grunt.loadNpmTasks('grunt-string-replace');
    //noinspection JSUnresolvedFunction
    //grunt.loadNpmTasks('grunt-sync-json');

    var uglifySaveLicense = require('uglify-save-license');

    //noinspection JSUnresolvedFunction
    grunt.initConfig({

        /*
         * Store the project settings from the package.json file into the pkg property.
         * This allows us to refer to the values of properties within our package.json
         * file: <%= pkg.name %>.
         */
        pkg: grunt.file.readJSON('package.json'),

        'sync-json': {
            'options': {
                'indent': 2,
                'include': [
                    'name',
                    'description',
                    'version',
                    'author as authors'
                ]
            },
            bower: {
                files: {
                    'bower.json': 'package.json'
                }
            }
        },

        /*
         * For some tasks, we want to clean up a little.
         */
        clean: {

            /*
             * In the case of dependencies, we have to remove all the dependencies.
             * In addition, the important files will be copied to target/dep. Thus,
             * we clean this as well.
             */
            dep: [
                'target/dep',
                'bower_components'
            ],
            combine: [
                'target/replaced',
                'target/combined'
            ],
            /*
             * In the case of distribution, we have to remove the distributed stuff.
             */
            dist: [
                'target/combined',
                'dist'
            ],
            setup: [
                'target/root'
            ]
        },

        /*
         * The watch tasks observes changes on the file-system, which
         * allow us to see changes directly in the browser.
         */
        watch: {
            server: {
                options: {
                    livereload: true,

                    /*
                     * See documentation: Setting this option to false speeds
                     * up the reaction time of the watch (usually 500ms faster
                     * for most)
                     */
                    spawn: false
                },

                // define the task to run when a change happens
                tasks: ['setup'],

                // files to observe, can be an array
                files: ['src/**/*', 'sample/**/*']
            }
        },

        /*
         * The connect task starts a web server for us to see our results and
         * do some testing.
         */
        connect: {
            server: {
                options: {
                    port: '<%= server.port %>',
                    base: 'target/root'
                    // we don't need any livereload because we have watch
                    // livereload: true
                }
            }
        },

        /*
         * Task used to install bower dependencies.
         */
        'bower-install-simple': {
            dep: {
                options: {
                    production: false
                }
            }
        },

        /*
         * Modify the bower dependencies and move the needed files to the
         * target location.
         */
        bower: {
            dep: {
                options: {
                    includeDev: true,
                    checkExistence: true,
                    paths: bowerPaths,
                    overrides: {
                        'brein-util': {'main': 'common/dist/brein-util-common.js'},
                        'cryptojslib': {
                            'main': [
                                'components/core.js',

                                // base64 encoding
                                'components/enc-base64.js',

                                // 'rollups/md5.js',
                                'components/md5.js',

                                // 'rollups/hmac-sha256.js'
                                'components/sha256.js',
                                'components/hmac.js'
                            ]
                        },
                        'jstz': {'main': 'jstz.js'}
                    }
                },
                dest: 'target/dep'
            },
            setup: {
                options: {
                    includeDev: true,
                    checkExistence: true,
                    paths: bowerPaths,
                    overrides: {
                        'brein-util': {'main': 'grunt/default-layout/**/*'},
                        'cryptojslib': {'ignore': true},
                        'jquery': {'ignore': true},
                        'jstz': {'ignore': true}
                    }
                },
                base: bowerPaths.bowerDirectory + '/brein-util/grunt/default-layout',
                dest: 'target/root'
            }
        },

        /*
         * Task used to replace specific placeholders.
         */
        'string-replace': {
            combine: {
                files: [{
                    expand: true, cwd: 'src/', src: '*.js', dest: 'target/replaced'
                }],
                options: {
                    replacements: [
                        {pattern: '{{PROJECT.VERSION}}', replacement: '<%= pkg.version %>'}
                    ]
                }
            }
        },

        /*
         * Task is used to combine the source files and dependencies into one file.
         */
        concat: {
            combine: {
                options: {
                    separator: ';\n',
                    banner: banner
                },
                files: [{
                    src: [
                        'src/snippets/prefix-global.js.snippet',
                        'target/dep/jquery.js',

                        'target/dep/core.js',
                        'target/dep/enc-base64.js',
                        'target/dep/md5.js',
                        'target/dep/sha256.js',
                        'target/dep/hmac.js',

                        'target/dep/jstz.js',

                        'src/snippets/disable-global-jquery.js.snippet',
                        'src/snippets/prefix-replace-window.js.snippet',
                        'target/dep/**/*.js',
                        'src/snippets/suffix-replace-window.js.snippet',
                        'target/replaced/AttributeCollection.js',
                        'target/replaced/BreinifyUtil.js',
                        'target/replaced/BreinifyConfig.js',
                        'target/replaced/BreinifyUser.js',
                        'target/replaced/**/*.js',
                        'src/snippets/suffix-global.js.snippet'
                    ],
                    dest: 'target/combined/<%= pkg.name %>.js'
                }]
            }
        },

        /*
         * Task is used to uglify the combined file to create a single file.
         */
        uglify: {
            combine: {
                options: {
                    output: {
                        comments: uglifySaveLicense
                    },
                    banner: '' // no banner needed it's in the library
                },
                files: {
                    'target/combined/<%= pkg.name %>.min.js': 'target/combined/<%= pkg.name %>.js'
                }
            },
            plugins: {
                files: {
                    'dist/breinify-activities.min.js': 'src/plugins/Activities.js',
                    'dist/breinify-trigger.min.js': 'src/plugins/Trigger.js',
                    'dist/breinify-dev-studio.min.js': 'src/plugins/DevStudio.js',
                    'dist/breinify-assets.min.js': 'src/plugins/Assets.js',
                    'dist/breinify-split-tests.min.js': 'src/plugins/SplitTests.js',
                    'dist/breinify-shopify.min.js': 'src/plugins/Shopify.js',
                    'dist/breinify-slick.min.js': 'src/plugins/Slick.js',
                    'dist/breinify-web-experiences.min.js': 'src/plugins/WebExperiences.js',
                    'dist/breinify-snippet-manager.min.js': 'src/plugins/SnippetManager.js',
                    'dist/breinify-journey.min.js': 'src/plugins/Journey.js',
                    'dist/breinify-recommendations.min.js': 'src/plugins/Recommendations.js',
                    'dist/breinify-alertme.min.js': 'src/plugins/AlertMe.js',
                    'dist/breinify-pickup.min.js': 'src/plugins/PickUp.js',
                    'dist/breinify-sms.min.js': 'src/plugins/Sms.js',
                    'dist/breinify-ui-countdown.min.js': 'src/plugins/UiCountdown.js',
                    'dist/breinify-ui-recommendations.min.js': 'src/plugins/UiRecommendations.js',
                    'dist/breinify-ui-popup.min.js': 'src/plugins/UiPopup.js',
                    'dist/breinify-ui-validator.min.js': 'src/plugins/UiValidator.js',
                    'dist/breinify-opt-status.min.js': 'src/plugins/OptStatus.js',
                    'dist/breinify-youtube.min.js': 'src/plugins/YouTube.js',
                    'dist/breinify-unsubscribe.min.js': 'src/plugins/Unsubscribe.js'
                }
            }
        },

        /*
         * Copies the files into the right location for the web server.
         */
        copy: {
            setup: {
                files: [
                    {expand: true, cwd: 'dist', src: '**/*.js', dest: 'target/root/js'},
                    {expand: true, cwd: 'sample', src: '**', dest: 'target/root'}
                ]
            },
            dist: {
                files: [
                    {expand: true, cwd: 'target/combined', src: '**/*.js', dest: 'dist'}
                ]
            },
            plugins: {
                files: [
                    {expand: true, cwd: 'src/plugins', src: 'Activities.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-activities.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'Trigger.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-trigger.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'DevStudio.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-dev-studio.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'Assets.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-assets.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'SplitTests.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-split-tests.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'Slick.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-slick.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'WebExperiences.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-web-experiences.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'SnippetManager.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-snippet-manager.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'Shopify.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-shopify.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'Journey.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-journey.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'Recommendations.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-recommendations.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'AlertMe.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-alertme.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'PickUp.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-pickup.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'Sms.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-sms.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'UiCountdown.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-ui-countdown.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'UiRecommendations.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-ui-recommendations.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'UiPopup.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-ui-popup.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'UiValidator.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-ui-validator.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'OptStatus.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-opt-status.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'YouTube.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-youtube.js' } },
                    {expand: true, cwd: 'src/plugins', src: 'Unsubscribe.js', dest: 'dist', rename: function(dest) { return dest + '/breinify-unsubscribe.js' } }
                ]
            }
        }
    });

    //noinspection JSUnresolvedFunction
    grunt.registerTask('server', 'Start the web-server for fast debugging.', function (port) {
        port = typeof port === 'undefined' || port === null || isNaN(parseFloat(port)) || !isFinite(port) ? defaultPort : parseInt(port);

        grunt.config.set('server.port', port);
        grunt.log.writeln('Starting web server on port ' + port + '...');

        //noinspection JSUnresolvedVariable
        grunt.task.run('setup', 'connect:server', 'watch:server');
    });

    //noinspection JSUnresolvedFunction
    grunt.registerTask('createBowerDir', 'Creates the needed bower directory', function () {

        //noinspection JSUnresolvedFunction
        grunt.file.mkdir(bowerPaths.bowerDirectory);
    });

    //noinspection JSUnresolvedFunction
    grunt.registerTask('dep', 'Resolves the dependencies used by bower.', function (clean) {
        clean = typeof clean === 'string' && 'true' === clean.toLowerCase();

        var tasks = [];
        if (clean) {
            tasks.push('clean:dep');
            tasks.push('createBowerDir');
        }
        //tasks.push('sync-json:bower');
        tasks.push('bower-install-simple:dep');
        tasks.push('bower:dep');

        //noinspection JSUnresolvedVariable
        grunt.task.run(tasks);
    });

    //noinspection JSUnresolvedFunction
    grunt.registerTask('combine', 'Combines the files (i.e., combines and uglifies)', function (uglify) {
        uglify = typeof uglify === 'string' && 'true' === uglify.toLowerCase();

        var tasks = [];
        tasks.push('dep:false');
        tasks.push('string-replace:combine');
        tasks.push('concat:combine');
        if (uglify) tasks.push('uglify:combine');

        //noinspection JSUnresolvedVariable
        grunt.task.run(tasks);
    });

    //noinspection JSUnresolvedFunction
    grunt.registerTask('dist', 'Distributes the file for deployment', function () {

        //noinspection JSUnresolvedVariable
        grunt.task.run('clean:combine', 'clean:dist', 'combine:true', 'copy:dist', 'uglify:plugins', 'copy:plugins');
    });

    //noinspection JSUnresolvedFunction
    grunt.registerTask('setup', 'Updates the files for the web server', function () {

        //noinspection JSUnresolvedVariable
        grunt.task.run('clean:setup', 'combine:false', 'createBowerDir', 'bower:setup', 'dist', 'copy:setup');
    });

    //noinspection JSUnresolvedFunction
    grunt.registerTask('publish', 'Publishes the package to npm', function () {

        //noinspection JSUnresolvedVariable
        grunt.task.run('dist');
    });

    //noinspection JSUnresolvedFunction
    grunt.registerTask('help', 'Help output regarding the tasks', function () {
        console.log('Usage:');
        console.log(' - grunt server<port> : to start a web server on the defined port (default: ' + defaultPort + '); auto refresh is enabled');
        console.log(' - grunt setup        : updates the current version of the web server');
        console.log(' - grunt dep:<bool>   : to resolve dependencies; true to clean up dependencies, otherwise false (default)');
        console.log(' - grunt dist:<bool>  : distributes the files of the project; true to uglify the files, otherwise false (default)');
        console.log(' - grunt test         : to run the defined tests');
    });

    /*
     * Notes when deploying new version:
     *  -> check version in package.json to be sure (you'll get a warning if it's wrong)
     *  -> grunt dist:true
     *  -> npm publish
     *  -> github (create a new release)
     */
};