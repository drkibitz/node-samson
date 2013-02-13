#!/usr/bin/env node

var vows = require('vows'),
    assert = require('assert'),
    path = require('path'),
    fs = require('fs'),
    spawn = require('child_process').spawn,
    out = '',
    error = '',
    basename = path.basename(__filename),
    input = [
        'test-in/input-dir/*',
        'test-in/input-dir/subdir/*',
        'test-in/input-dir/subdir/subdir/*',
        'test-in/input-dir/subdir/subdir/subdir/*'
    ],
    outputDir = 'test-out/' + basename,
    testOutPath = 'test-in/input-dir/subdir/subdir/subdir/largefile2.txt';

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
            var child = spawn(process.execPath, ['../bin.js'].concat(input).concat(['-o', outputDir]));

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
                "[1] is equal to 18": function (matches) {
                    assert.strictEqual(parseInt(matches[1]), 18);
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
                        // "'fs.read' contents length is 4901250": function (data) {
                        //  assert.strictEqual(data.length, 4901250);
                        // },
                        "remove outputDir": function (data) {
                            spawn('rm', ['-fR', outputDir]);
                        }
                    }
                }
            }
        }
    }
}).export(module);
