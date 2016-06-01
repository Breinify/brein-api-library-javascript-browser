/*
 * This gruntfile is based on the project-gruntfile found at:
 *  https://github.com/Breinify/brein-javascript/tree/master/grunt/project-gruntfile.js
 *
 * The following dependencies have to be added:
 *  "grunt": "^0.4.5",
 *  "grunt-bower-install-simple": "^1.2.1",
 *  "grunt-contrib-clean": "^1.0.0",
 *  "grunt-contrib-concat": "^1.0.0",
 *  "grunt-contrib-connect": "^1.0.1",
 *  "grunt-contrib-copy": "^1.0.0",
 *  "grunt-contrib-jasmine": "^1.0.0",
 *  "grunt-contrib-uglify": "^1.0.1",
 *  "grunt-contrib-watch": "^1.0.0",
 *  "grunt-string-replace": "^1.2.1",
 *  "main-bower-files": "^2.11.1"
 *
 * Template Version: 1.0.0
 *
 * Change Log:
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
    var defaultPort = 10000;
    var banner = '/*\n' +
        ' * ' + '<%= pkg.name %>\n' +
        ' * ' + 'v<%= pkg.version %>\n' +
        ' * ' + '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
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
    grunt.loadNpmTasks('grunt-contrib-jasmine');

    //noinspection JSUnresolvedFunction
    grunt.initConfig({

        /*
         * Store the project settings from the package.json file into the pkg property.
         * This allows us to refer to the values of properties within our package.json
         * file: <%= pkg.name %>.
         */
        pkg: grunt.file.readJSON('package.json'),

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
                    checkExistence: true,
                    paths: bowerPaths,
                    overrides: {
                        // added: override for the dependencies
                        'brein-util': {'main': 'common/dist/brein-util-common.js'}
                    }
                },
                dest: 'target/dep'
            },
            setup: {
                options: {
                    checkExistence: true,
                    paths: bowerPaths,
                    overrides: {
                        'brein-util': {
                            'main': 'grunt/default-layout/**/*'
                        }
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
                    expand: true, cwd: 'src/', src: '**/*.js', dest: 'target/replaced'
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
                        'src/snippets/disable-global-jquery.js.snippet',
                        'src/snippets/prefix-replace-window.js.snippet',
                        'target/dep/**/*.js',
                        'src/snippets/suffix-replace-window.js.snippet',
                        'target/replaced/BreinifyConfig.js',
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
                    banner: banner
                },
                files: {
                    'target/combined/<%= pkg.name %>.min.js': 'target/combined/<%= pkg.name %>.js'
                }
            }
        },

        /*
         * Copies the files into the right location for the web server.
         */
        copy: {
            setup: {
                files: [
                    // {expand: true, cwd: 'target/dep', src: '**', dest: 'target/root/js'},
                    {expand: true, cwd: 'dist', src: '**/<%= pkg.name %>.js', dest: 'target/root/js'},
                    {expand: true, cwd: 'dist', src: '**/<%= pkg.name %>.min.js', dest: 'target/root/js'},
                    {expand: true, cwd: 'sample', src: '**', dest: 'target/root'}
                ]
            },
            dist: {
                files: [
                    {expand: true, cwd: 'target/combined', src: '**/*.js', dest: 'dist'}
                ]
            }
        },

        /*
         * Task to test stuff with Jasmine
         */
        jasmine: {
            test: {
                src: ['dist/<%= pkg.name %>.js'],
                options: {
                    specs: ['specs/**/*.js', '!specs/**/*.jquery.js']
                }
            },
            testWithJQuery: {
                src: ['dist/<%= pkg.name %>.js'],
                options: {
                    vendor: ['node_modules/jquery/dist/jquery.js', 'node_modules/jasmine-jquery/lib/jasmine-jquery.js'],
                    specs: 'specs/**/*.jquery.js'
                }
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
    grunt.registerTask('dep', 'Resolves the dependencies used by bower.', function (clean) {
        clean = typeof clean === 'string' && 'true' === clean.toLowerCase();

        var tasks = [];
        if (clean) tasks.push('clean:dep');
        tasks.push('bower-install-simple:dep');
        if (grunt.file.exists('bower_components')) {
            tasks.push('bower:dep');
        }

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
        grunt.task.run('clean:combine', 'clean:dist', 'combine:true', 'copy:dist');
    });

    //noinspection JSUnresolvedFunction
    grunt.registerTask('setup', 'Updates the files for the web server', function () {

        //noinspection JSUnresolvedVariable
        grunt.task.run('clean:setup', 'combine:false', 'bower:setup', 'dist', 'copy:setup');
    });

    //noinspection JSUnresolvedFunction
    grunt.registerTask('test', 'Tests the files using Jasmine', function () {

        //noinspection JSUnresolvedVariable
        grunt.task.run('dist', 'jasmine:test', 'jasmine:testWithJQuery');
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
};