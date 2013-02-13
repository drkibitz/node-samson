#!/usr/bin/env node

var vows = require('vows'),
    EOL = require('os').EOL,
    assert = require('assert'),
    path = require('path'),
    basename = path.basename(__filename),
    fs = require('fs'),
    spawn = require('child_process').spawn,
    out = '',
    error = '',
    input = [
        'test-in/scope/env.txt'
    ],
    outputDir = 'test-out/' + basename,
    testOutPath = 'test-in/scope/env.txt';

/**
 * Test suite
 */
vows.describe(basename).addBatch({
    "chdir": {
        topic: function () {
            process.chdir(__dirname);
            return __dirname;
        },
        "cwd is __dirname": function (dir) {
            assert.strictEqual(process.cwd(), dir);
        }
    },
    "spawn ../bin.js": {
        topic: function () {
            var child = spawn(process.execPath, ['../bin.js'].concat(input).concat([
                '-o', outputDir,
                '-d', 'USER=MY_USER_VAR=foo',
                '-d', 'HOME=bar',
                '-d', 'MY_ENV_VAR=ok'
            ]));

            child.stdout.on('data', function (data) {
                out += data.toString();
            });

            child.stderr.on('data', function (data) {
                error += data.toString();
            });

            child.on('exit', function (code) {
                this.callback(null, child, code);
            }.bind(this));
        },
        "on exit": {
            "code is 0": function (child, code) {
                assert.strictEqual(code, 0);
            },
            "stderr is empty": function (child, code) {
                assert.isString(error);
                assert.isEmpty(error);
            },
            "stdout is not empty": function (child, code) {
                assert.isString(out);
                assert.isNotEmpty(out);
            },
            "stdout contains 'Completed successfully.'": function (code) {
                assert.strictEqual(out.indexOf('Completed successfully.') > -1, true);
            },
            "stdout 'files: #' matches": {
                topic: function () {
                    return out.match(/Completed successfully.[\S\s]+files: ([0-9]+)[\S\s]+elapsed\(ms\)\: [0-9]+[\S\s]+$/);
                },
                "is not null": function (matches) {
                    assert.isNotNull(matches);
                },
                "[1] is not empty": function (matches) {
                    assert.isNotEmpty(matches[1]);
                },
                "[1] is equal to 1": function (matches) {
                    assert.strictEqual(parseInt(matches[1]), 1);
                }
            },
            "testing output file": {
                topic: function () {
                    fs.stat(path.join(outputDir, testOutPath), this.callback);
                },
                "after a successful 'fs.stat'": {
                    topic: function (stat) {
                        fs.open(path.join(outputDir, testOutPath), "r", stat.mode, this.callback);
                    },
                    "after a successful 'fs.open'": {
                        topic: function (fd, stat) {
                            fs.read(fd, stat.size, 0, "utf8", this.callback);
                        },
                        "we can 'fs.read' to get the file contents": function (data) {
                            assert.isString(data);
                        },
                        "'fs.read' contents length is > 0": function (data) {
                            assert.strictEqual(data.length > 0, true);
                        },
                        "'fs.read' contents matches '#def.USER -d'": function (data) {
                            var matches = data.toString().match(/\#def\.USER\ overridden through \-d[\S\s]+foo/);
                            assert.isNotNull(matches);
                            assert.isNotEmpty(matches[0]);
                        },
                        "'fs.read' contents matches '#def.MY_USER_VAR -d'": function (data) {
                            var matches = data.toString().match(/\#def\.MY_USER_VAR passed only through \-d[\S\s]+foo/);
                            assert.isNotNull(matches);
                            assert.isNotEmpty(matches[0]);
                        },
                        "'fs.read' contents matches '#def.HOME -d'": function (data) {
                            var matches = data.toString().match(/\#def\.HOME overridden through \-d[\S\s]+bar/);
                            assert.isNotNull(matches);
                            assert.isNotEmpty(matches[0]);
                        },
                        "'fs.read' contents matches '#def.PATH -d'": function (data) {
                            var i = data.toString().indexOf('#def.PATH not overridden' + EOL + process.env.PATH);
                            assert.strictEqual(i > -1, true);
                        },
                        "'fs.read' contents matches '#def.MY_ENV_VAR -d'": function (data) {
                            var matches = data.toString().match(/\#def\.MY_ENV_VAR passed only through \-d[\S\s]+ok/);
                            assert.isNotNull(matches);
                            assert.isNotEmpty(matches[0]);
                        },
                        "remove outputDir": function (data) {
                            spawn('rm', ['-fR', outputDir]);
                        }
                    }
                }
            }
        }
    }
}).export(module);
