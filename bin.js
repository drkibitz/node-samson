#!/usr/bin/env node
/*global process, require, console*/
/**
 * Command line script to invoke functionality of {@link module:node-samson}.
<pre>
Usage:

  bin.js pattern [pattern...]
  bin.js -i [directory]
  bin.js pattern [pattern...] -o [directory]
  bin.js -i [directory] -o [directory]

Operations are asynchronous, and in order of the glob match.
Only files of the proper type are processed before writing,
other files are simply copied.

Script arguments are also globbed, but ignored if "input-dir"
option is provided. Providing "output-dir" specifies a
destination directory for output. Without it, output is
passed to process.stdout() and in order of input.

Providing either "input-dir" or "output-dir" with empty
values results in the current working directory.

Options:
  -h, --help          You are looking at it.                    [boolean]
  -d, --def           KEY=value pair to set on def namespace.   [string]
  --manifest          Output list of files in "output-dir".     [string]
  --overwrite         Allow "output-dir" to equal "input-dir".  [boolean]
  -c, --copy-unknown  Copy files with an unmatched mime-type.   [boolean]
  -i, --input-dir     Input directory.
  -o, --output-dir    Output directory.
  -q, --quiet         Suppress all status related output.       [boolean]
  -R, --recursive     Matches files recursively.                [boolean]
  -s, --simulate      Run without any filesystem changes        [boolean]
  -v, --version       Output version information.               [boolean]
  -V, --verbose       Output progress information.              [boolean]
</pre>
 * @module bin
 * @author <a href="mailto:drkibitz@gmail.com">Dr. Kibitz</a>
 * @license {@link http://www.opensource.org/licenses/MIT}
 * @requires path
 * @requires fs
 * @requires optimist
 * @requires node-samson/lib/main
 * @since 1.0
 */
(function (os, path, fs, optimist, samson) {
    "use strict";

    var Samson = samson.Samson,
        EOL = os.EOL,
        basename = path.basename(process.argv[1]),
        argv = optimist
            .usage(
                'Usage:' + EOL + EOL +
                '  ' + basename + ' pattern [pattern...]' + EOL +
                '  ' + basename + ' -i [directory]' + EOL +
                '  ' + basename + ' pattern [pattern...] -o [directory]' + EOL +
                '  ' + basename + ' -i [directory] -o [directory]' + EOL + EOL +
                'Operations are asynchronous, and in order of the glob match.' + EOL +
                'Only files of the proper type are processed before writing,' + EOL +
                'other files are simply copied.' + EOL + EOL +
                'Script arguments are also globbed, but ignored if "input-dir"' + EOL +
                'option is provided. Providing "output-dir" specifies a' + EOL +
                'destination directory for output. Without it, output is' + EOL +
                'passed to process.stdout() and in order of input.' + EOL + EOL +
                'Providing either "input-dir" or "output-dir" with empty' + EOL +
                'values results in the current working directory.')
            .boolean('h').alias('h', 'help')
                .describe('h', 'You are looking at it.')
            .string('d').alias('d', 'def')
                .describe('d', 'KEY=value pair to set on def namespace.')
            .string('manifest')
                .describe('manifest', 'Output list of files in "output-dir".')
            .boolean('overwrite')
                .describe('overwrite', 'Allow "output-dir" to equal "input-dir".')
            .boolean('c').alias('c', 'copy-unknown')
                .describe('c', 'Copy files with an unmatched mime-type.')
            // [todo] Research how to best implement this functionality.
            // Have not yet started, but this is a reminder that it needs it.
            /*.string('ignore')
                .describe('ignore', 'List of patterns to ignore.')*/
            .alias('i', 'input-dir')
                .describe('i', "Input directory.")
            .alias('o', 'output-dir')
                .describe('o', 'Output directory.')
            .boolean('q').alias('q', 'quiet')
                .describe('q', 'Suppress all status related output.')
            .boolean('R').alias('R', 'recursive')
                .describe('R', 'Matches files recursively.')
            .boolean('s').alias('s', 'simulate')
                .describe('s', 'Run without any filesystem changes')
            .boolean('v').alias('v', 'version')
                .describe('v', 'Output version information.')
            .boolean('V').alias('V', 'verbose')
                .describe('V', 'Output progress information.')
            .argv;

    // Check for help option
    if (argv.h) {

        optimist.showHelp(console.log);
        process.exit(0);

    // Check for version option
    } else if (argv.v) {

        console.log(samson.packageInfo.version);
        process.exit(0);

    // Really try to run it
    } else {
        try {
            // Create def namespace that will override defaults already in def
            // Defaults are process.env members, as well as stuff defined in ResourceProcessor.
            samson.def = {argv : argv};
            // If we have 1 or more arguments def pairs, parse them and set on the def namespace.
            // Basically, if somebody wants to override something, let them.
            // This allows for things assignments:
            // -d TARGET=browser -d VENDOR=WebKit
            // This allows for unassigned flags whose values default to true:
            // -d DEBUG -d DEV
            // This allows for chaining assignments:
            // -d TARGET=VENDOR=CSS_PREFIX=WebKit -d FOO=BAR=baz
            if (argv.d) {
                Array.prototype.concat(argv.d).filter(function (pair) {
                    return 'string' === typeof pair && pair.length;
                }).forEach(function (pair) {
                    var split = pair.split('='), v, k, i;
                    if (split.length === 1) {
                        k = split[0];
                        if (k.length) samson.def[k] = true;
                    } else {
                        i = split.length;
                        v = split[--i];
                        while (i--) {
                            k = split[i];
                            if (k.length) samson.def[k] = v;
                        }
                    }
                });
            }

            // Only simulating
            samson.writer.simulate = argv.simulate;
            // Verbose logger
            if (!argv.q && argv.V) samson.createLogger(process.stdout).on();
            samson
                .on(Samson.event.ERROR, function onError(error) {
                    if (!argv.q) console.error(error.toString());
                    this.reset();
                })
                .on(Samson.event.END, function onEnd(error) {
                    if (error) {
                        if (!argv.q) console.error(error.toString());
                        process.exit(error.code || 1);
                    } else if (!argv.q) {
                        console.log(
                            'Completed successfully.' + EOL +
                            '  files: ' + (this.processor.currentFileIndex) + EOL +
                            '  elapsed(ms): ' + (Date.now() - this.processor.date.valueOf())
                        );
                    }
                    process.exit(0);
                })
                .run((argv.i ? null : argv._), {
                    copyUnknown : argv.c,
                    inputDir    : argv.i,
                    outputDir   : argv.o,
                    overwrite   : argv.overwrite,
                    manifest    : argv.manifest,
                    recursive   : argv.R
                });

        // Handle errors
        } catch (error) {
            switch (error.message) {
            case Samson.errorCode.UNSAFE_OUTPUT:
                console.error(
                    "Error: Input directory may be the same as output directory!" + EOL + EOL +
                    "  Files may be overwritten by output." + EOL +
                    "  Please use the 'overwrite' option to ignore this error."
                );
                break;
            case Samson.errorCode.EMPTY_PATTERNS:
                console.log(
                    samson.packageInfo.name + ':' + EOL +
                    samson.packageInfo.description + EOL + EOL +
                    '  Version  : ' + samson.packageInfo.version + EOL +
                    '  Author   : ' + samson.packageInfo.author.name + ' <' + samson.packageInfo.author.email + '>' + EOL +
                    '  License  : ' + samson.packageInfo.licenses[0].url + EOL +
                    '  Requires : node ' + samson.packageInfo.engines.node + EOL
                );
                optimist.showHelp();
                break;
            default:
                console.error(error.toString());
            }
            process.exit(error.code || 1);
        }
    }
}(
    require('os'),
    require('path'),
    require('fs'),
    require('optimist'),
    require('./lib/main')
));
