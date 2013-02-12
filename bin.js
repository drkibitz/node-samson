#!/usr/bin/env node
/*global process, require*/
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
  -h, --help        You are looking at it.                    [boolean]
  --manifest        Output list of files in "output-dir".     [boolean]
  --overwrite       Allow "output-dir" to equal "input-dir".  [boolean]
  --simulate        Run without any filesystem changes.       [boolean]
  -i, --input-dir   Input directory.
  -o, --output-dir  Output directory.
  -q, --quiet       Suppress all status related output.       [boolean]
  -R, --recursive   Matches files recursively.                [boolean]
  -v, --version     Output version information.               [boolean]
  -V, --verbose     Output progress information.              [boolean]
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
if (process.mainModule !== module) {
    console.error('Samson is meant to be run as the mainModule!');
    process.exit(1);
}

(function (path, fs, optimist, samson) {
    "use strict";

    var Samson = samson.Samson,
        basename = path.basename(process.argv[1]),
        argv = optimist
            .usage(
                'Usage:\n\n' +
                '  ' + basename + ' pattern [pattern...]\n' +
                '  ' + basename + ' -i [directory]\n' +
                '  ' + basename + ' pattern [pattern...] -o [directory]\n' +
                '  ' + basename + ' -i [directory] -o [directory]\n\n' +
                'Operations are asynchronous, and in order of the glob match.\n' +
                'Only files of the proper type are processed before writing,\n' +
                'other files are simply copied.\n\n' +
                'Script arguments are also globbed, but ignored if "input-dir"\n' +
                'option is provided. Providing "output-dir" specifies a\n' +
                'destination directory for output. Without it, output is\n' +
                'passed to process.stdout() and in order of input.\n\n' +
                'Providing either "input-dir" or "output-dir" with empty\n' +
                'values results in the current working directory.')
            .boolean('h').alias('h', 'help')
                .describe('h', 'You are looking at it.')
            .string('manifest')
                .describe('manifest', 'Output list of files in "output-dir".')
            .boolean('overwrite')
                .describe('overwrite', 'Allow "output-dir" to equal "input-dir".')
            .boolean('simulate')
                .describe('simulate', 'Run without any filesystem changes')
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

        console.log(samson.package.version);
        process.exit(0);

    // Really try to run it
    } else {
        try {
            // Listeners for status related and verbose output
            if (!argv.q && argv.V) {
                /*samson
                    .on(Samson.event.READ_START, function onReadStart(file) {
                        console.log(new Date() + ' Read(start): ' +  path.relative(process.cwd(), file));
                    })
                    .on(Samson.event.READ, function onRead(file) {
                        console.log(new Date() + ' Read(data): ' + path.relative(process.cwd(), file));
                    })
                    .on(Samson.event.READ_END, function onReadEnd(file) {
                        console.log(new Date() + ' Read(end): ' + path.relative(process.cwd(), file));
                    })
                    .on(Samson.event.WRITE_START, function onWriteStart(file) {
                        console.log(new Date() + ' Write(start): ' + path.relative(process.cwd(), file));
                    })
                    .on(Samson.event.WRITE, function onWrite(file, validationCode) {
                        console.log(new Date() + ' Write(' + validationCode + '): ' + path.relative(process.cwd(), file));
                    })
                    .on(Samson.event.WRITE_END, function onWriteEnd(file) {
                        console.log(new Date() + ' Write(end): ' + path.relative(process.cwd(), file));
                    });*/
                samson.createLogger(process.stdout).on();
            }

            // Setup and run
            samson.def = {argv : argv};
            samson.writer.simulate = argv.simulate;
            samson
                .on(Samson.event.ERROR, function onError(error) {
                    !argv.q && console.error(error.toString());
                    this.reset();
                })
                .run((argv.i ? null : argv._), {
                    inputDir  : argv.i,
                    outputDir : argv.o,
                    overwrite : argv.overwrite,
                    manifest  : argv.manifest,
                    recursive : argv.R,
                })
                // Add listener after invoking run
                .on(Samson.event.END, function onEnd(error) {
                    if (error) {
                        !argv.q && console.error(error.toString());
                        process.exit(error.code || 1);
                    } else {
                        !argv.q && console.log('\nCompleted successfully.\n',
                            'files: ' + (this.processor.currentFileIndex) + '\n',
                            'elapsed(ms): ' + (Date.now() - this.processor.date.valueOf())
                        );
                    }
                    process.exit(0);
                });

        // Handle errors
        } catch (error) {
            switch (error.message) {
            case Samson.errorCode.UNSAFE_OUTPUT:
                console.error("Error: Input directory may be the same as output directory!\n\n" +
                              "  Files may be overwritten by output.\n" +
                              "  Please use the 'overwrite' option to ignore this error.");
                break;
            case Samson.errorCode.EMPTY_PATTERNS:
                console.log(
                    samson.package.name + ':\n' +
                    samson.package.description + '\n\n' +
                    '  Version  : ' + samson.package.version + '\n' +
                    '  Author   : ' + samson.package.author.name + ' <' + samson.package.author.email + '>\n' +
                    '  License  : ' + samson.package.licenses[0].url + '\n' +
                    '  Requires : node ' + samson.package.engines.node + '\n'
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
    require('path'),
    require('fs'),
    require('optimist'),
    require('./lib/main')
));
