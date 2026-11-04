'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

// Keep dependency order explicit; plugins are loaded only for plugin specs.
const plugins = [
    'feature-storage', 'trigger', 'activities', 'snippet-manager', 'web-experiences',
    'recommendations', 'ui-recommendations', 'ui-modify-content', 'ui-survey', 'ui-countdown', 'alertme', 'sms'
];

function taskCommand(task) {
    // Use the running Node interpreter and local CLI, so neither node, npm nor npx needs to be on PATH.
    const args = [process.execPath, require.resolve('grunt/bin/grunt'), '--gruntfile',
        path.resolve('gruntfile.js'), task];
    return args.map(arg => "'" + arg.replace(/'/g, "'\\''") + "'").join(' ');
}

function distributionBundle(grunt) {
    const bundle = path.resolve(grunt.config.get('pkg.main'));
    const files = [bundle, ...plugins.map(plugin => path.resolve('dist', 'breinify-' + plugin + '.js'))];
    const missing = files.filter(file => !fs.existsSync(file));
    if (missing.length) {
        throw new Error('Missing distribution files:\n  ' + missing.join('\n  ') + '\n' +
            'Run the test task to build dist and prepare the browser before running specs.\n' +
            'Grunt file: ' + path.resolve('gruntfile.js') + '\n' + taskCommand('test'));
    }
    return bundle;
}

async function runFile(browser, file, bundle, timeout) {
    const context = await browser.newContext({locale: 'en-US', timezoneId: 'America/Los_Angeles'});
    const errors = [];
    try {
        // Provide a real origin for cookies/storage/history, but never send test traffic to a live service.
        await context.route('**/*', route => {
            const request = route.request();
            if (request.isNavigationRequest() && new URL(request.url()).origin === 'http://breinify.test') {
                return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><body></body></html>'});
            }
            return route.abort('blockedbyclient');
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.stack || error.message));
        await page.goto('http://breinify.test/');
        await page.addScriptTag({path: bundle});
        if (!await page.evaluate(() => window.Breinify && Breinify.version !== 'FALLBACK')) {
            throw new Error('The distribution bundle did not initialize. ' + errors.join('\n'));
        }
        if (file.startsWith('specs/plugins/')) {
            for (const plugin of plugins) {
                await page.addScriptTag({path: path.resolve('dist', 'breinify-' + plugin + '.js')});
            }
        }

        // Jasmine 7 installs its browser globals itself; the HTML boot script is not needed in headless mode.
        const jasminePath = path.join(path.dirname(require.resolve('jasmine-core')), 'jasmine-core/jasmine.js');
        await page.addScriptTag({path: jasminePath});
        await page.evaluate(() => {
            const env = jasmine.getEnv();
            env.configure({random: false});
            const specs = [];
            const failures = [];
            env.addReporter({
                specDone(result) {
                    specs.push({name: result.fullName, status: result.status, pendingReason: result.pendingReason,
                        failures: result.failedExpectations.map(item => ({message: item.message, stack: item.stack}))});
                },
                suiteDone(result) {
                    failures.push(...result.failedExpectations.map(item => ({message: item.message, stack: item.stack})));
                },
                jasmineDone(result) {
                    failures.push(...result.failedExpectations.map(item => ({message: item.message, stack: item.stack})));
                    window.__testResult = {status: result.overallStatus, incompleteReason: result.incompleteReason,
                        specs, failures};
                }
            });
        });
        let specSource = fs.readFileSync(file, 'utf8');
        if (file.startsWith('specs/plugins/')) {
            // Legacy plugin specs expect $, but the SDK intentionally does not expose global jQuery.
            specSource = '(function ($) {\n' + specSource + '\n})(Breinify.UTL._jquery());';
        }
        await page.addScriptTag({content: specSource + '\n//# sourceURL=' + file});
        await page.evaluate(() => { jasmine.getEnv().execute(); });
        await page.waitForFunction(() => window.__testResult !== undefined, null, {timeout});
        const result = await page.evaluate(() => window.__testResult);
        return {file, ...result, errors};
    } catch (error) {
        return {file, status: 'failed', specs: [], failures: [], errors: [...errors, error.stack || error.message]};
    } finally {
        await context.close();
    }
}

module.exports = function (grunt) {
    grunt.registerTask('test', 'Build dist, prepare Chromium, and run Jasmine specs.',
        ['dist', 'test-setup', 'test-run']);

    grunt.registerTask('test-setup', 'Install the headless Chromium browser used by grunt test.', function () {
        const done = this.async();
        const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
        grunt.log.writeln('Installing the browser required by this project\'s Playwright version.');
        grunt.log.writeln('The first download may take several minutes. Existing installations are reused.');
        grunt.util.spawn({
            cmd: process.execPath,
            args: [cli, 'install', '--only-shell', 'chromium'],
            opts: {stdio: 'inherit'}
        }, error => {
            if (error) {
                grunt.log.error('Browser installation failed. Check the download error above, then rerun grunt test-setup.');
                done(false);
            } else {
                grunt.log.ok('Browser ready. In IntelliJ, run the test task from: ' + path.resolve('gruntfile.js'));
                grunt.log.writeln('Or paste this command into a terminal:\n  ' + taskCommand('test'));
                done();
            }
        });
    });

    grunt.registerTask('test-run', 'Run Jasmine against existing dist files without rebuilding or browser setup.', function () {
        const done = this.async();
        (async () => {
            const filter = grunt.option('spec');
            const timeout = Number(grunt.option('test-timeout') || 60000);
            if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('--test-timeout must be positive milliseconds.');
            const files = grunt.file.expand('specs/**/*-spec.js').sort()
                .filter(file => !filter || file.includes(String(filter)));
            if (!files.length) throw new Error('No spec files matched' + (filter ? ': ' + filter : '.'));
            const bundle = distributionBundle(grunt);
            let browser;
            const results = [];
            try {
                try {
                    browser = await chromium.launch({headless: true});
                } catch (error) {
                    // Give a project-specific recovery command only for a missing browser, not other launch failures.
                    if (error.message.includes("Executable doesn't exist at")) {
                        throw new Error('The test browser is not installed for this Playwright version.\n' +
                            'No tests have run yet. npm install / npm ci does not download this browser.\n\n' +
                            'In IntelliJ, open this file in the Grunt tool window:\n  ' +
                            path.resolve('gruntfile.js') + '\n' +
                            'Run test-setup, wait for "Browser ready", then run test.\n\n' +
                            'Or paste this command into a terminal (works from any directory; no npx needed):\n  ' +
                            taskCommand('test-setup') + '\n\n' +
                            'Repeat test-setup after upgrading Playwright. See README.md: Running tests.');
                    }
                    throw error;
                }
                for (const file of files) {
                    const result = await runFile(browser, file, bundle, timeout);
                    results.push(result);
                    const passed = result.specs.filter(spec => spec.status === 'passed').length;
                    const failed = result.specs.filter(spec => spec.status === 'failed').length;
                    grunt.log.writeln(file + ': ' + passed + ' passed, ' + failed + ' failed (' + result.status + ')');
                    for (const spec of result.specs.filter(spec => spec.status === 'failed')) {
                        grunt.log.error(spec.name);
                        spec.failures.forEach(failure => grunt.log.error(failure.message));
                    }
                    result.failures.forEach(failure => grunt.log.error(failure.message));
                    result.errors.forEach(error => grunt.log.error(error));
                    if (result.incompleteReason) grunt.log.error(result.incompleteReason);
                }
            } finally {
                if (browser) await browser.close();
                grunt.file.write('target/test-results.json', JSON.stringify(results, null, 2) + '\n');
            }
            const specs = results.flatMap(result => result.specs);
            const passed = specs.filter(spec => spec.status === 'passed').length;
            const failed = specs.filter(spec => spec.status === 'failed').length;
            const pending = specs.filter(spec => spec.status === 'pending' || spec.status === 'excluded').length;
            grunt.log.writeln('\n' + passed + ' passed, ' + failed + ' failed, ' + pending +
                ' pending/excluded in ' + files.length + ' files.');
            grunt.log.writeln('Detailed results: target/test-results.json');
            if (results.some(result => result.status !== 'passed' || result.errors.length || result.failures.length)) {
                throw new Error('Tests failed. See the failures above.');
            }
        })().then(() => done(), error => {
            grunt.log.error(error.message);
            done(false);
        });
    });
};
