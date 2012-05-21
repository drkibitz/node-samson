#!/usr/bin/env node
/*global process, require*/
/**
 * Command line script to invoke functionality of {@link module:node-samson}.
<pre>
Usage:

  samson pattern [pattern...]
  samson -i [directory]
  samson pattern [pattern...] -o [directory]
  samson -i [directory] -o [directory]

All reading and writing occurs asynchronously, and in the
order matched with glob. Only files of the proper type are
processed before writing, other files are simply copied.

Script arguments are each matched with glob, but ignored if
the "input-dir" option is used. The "output-dir" option is
the destination for output. Without this option, all output
is sent directly to process.stdout in the order of the input.

Providing the options of either "input-dir" or "output-dir"
with an empty value results in the value of process.cwd().

Options:
  -h, --help        You are looking at it.                    [boolean]
  --manifest        Output list of files in "output-dir".     [boolean]
  --overwrite       Allow "output-dir" to equal "input-dir".  [boolean]
  -i, --input-dir   Input directory.
  -o, --output-dir  Output directory.
  -q, --quiet       Suppress all status output.               [boolean]
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
            .usage('Usage:\n\n' +
               '  ' + basename + ' pattern [pattern...]\n' +
               '  ' + basename + ' -i [directory]\n' +
               '  ' + basename + ' pattern [pattern...] -o [directory]\n' +
               '  ' + basename + ' -i [directory] -o [directory]\n\n' +
               'All reading and writing occurs asynchronously, and in the\n' +
               'order matched with glob. Only files of the proper type are\n' +
               'processed before writing, other files are simply copied.\n\n' +
               'Script arguments are each matched with glob, but ignored if\n' +
               'the "input-dir" option is used. The "output-dir" option is\n' +
               'the destination for output. Without this option, all output\n' +
               'is sent directly to process.stdout in the order of the input.\n\n' +
               'Providing the options of either "input-dir" or "output-dir"\n' +
               'with an empty value results in the value of process.cwd().')
            .boolean('h').alias('h', 'help')
                .describe('h', 'You are looking at it.')
            .boolean('manifest')
                .describe('manifest', 'Output list of files in "output-dir".')
            .boolean('overwrite')
                .describe('overwrite', 'Allow "output-dir" to equal "input-dir".')
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

        console.log(Samson.getVersion());
        process.exit(0);

    // Really try to run it
    } else {
        try {
            // Listeners for status related and verbose output
            if (!argv.q && argv.V) {
                samson
                    .on(Samson.event.READ_START, function onReadStart(file) {
                        console.log('Read(start):', path.relative(process.cwd(), file));
                    })
                    .on(Samson.event.READ, function onRead(file) {
                        console.log('Read(data):', path.relative(process.cwd(), file));
                    })
                    .on(Samson.event.READ_END, function onReadEnd(file) {
                        console.log('Read(end):', path.relative(process.cwd(), file));
                    })
                    .on(Samson.event.WRITE_START, function onWriteStart(file) {
                        console.log('Write(start):', path.relative(process.cwd(), file));
                    })
                    .on(Samson.event.WRITE, function onWrite(file, validationCode) {
                        console.log('Write(' + validationCode + '):', path.relative(process.cwd(), file));
                    })
                    .on(Samson.event.WRITE_END, function onWriteEnd(file) {
                        console.log('Write(end):', path.relative(process.cwd(), file));
                    });
            }

            // Setup and run
            samson.def = {argv : argv};
            samson.manifest = argv.manifest;
            samson.overwrite = argv.overwrite;
            samson
                .on('error', function onError(error) {
                    !argv.q && console.error(error.toString());
                    process.exit(error.hasOwnProperty('code') ? error.code : 1);
                })
                .on('end', function onEnd(file) {
                    !argv.q && console.log('\nCompleted successfully.\n',
                        'files: ' + (this.processor.currentFileIndex) + '\n',
                        'elapsed(ms): ' + (Date.now() - this.processor.date.valueOf())
                    );
                    process.exit(0);
                })
                .run((argv.i ? null : argv._), argv.i, argv.o, argv.R);

        // Handle errors
        } catch (error) {
            switch (error.message) {
            case Samson.errorCode.UNSAFE_OUTPUT:
                console.error("Error: Input directory may be the same as output directory!\n\n" +
                              "  Files may be overwritten by output.\n" +
                              "  Please use the 'overwrite' option to ignore this error.");
                break;
            case Samson.errorCode.EMPTY_PATTERNS:
                optimist.showHelp();
                break;
            default:
                console.error(error.toString());
            }
            process.exit(error.hasOwnProperty('code') ? error.code : 1);
        }
    }
}(
    require('path'),
    require('fs'),
    require('optimist'),
    require('./lib/main')
));
