Samson
===========

### The elevator pitch:

A very useful build step; read any number of files, process them as JavaScript templates, and save output to another destination.

### The more descriptive version:

Process an input directory to an output directory recursively:

    samson -i path/to/directory -o path/to/other/directory -R

Samson's functionality can be summarized in 3 steps:

1. Read any number of files that are of any size
2. Process the content of files read as doT.js templates
    - Each template's delimiters are defined as comment blocks specific to the processed file's language
    - Although files are processed in chunks, the internal validation queues data until it may be processed correctly
    - If a file's mimeType is not a processable type, then the data is simply piped through without processing
3. Write the processed or piped data to a new location on the file system

Include samson in your own module:

    var samson = require('samson');
    samson.run(['source/dir/**/*'], {
        copyUnknown : true,
        outputDir   : 'build/dir',
        recursive   : true
    });

### doT

Sounds pretty simple right?

The unique part of Samson is in step #2. doT.js is both the fastest, and most open-ended JavaScript template engine I've found to date, and is the engine I believe to be best suited for the task I'm trying to achieve with Samson. If you are familiar with doT, skip to the next section, otherwise now would be a good time to visit http://olado.github.com/doT/

Install
-----------

With npm this module prefers global installation:

    npm i samson -g

Usage
-----------

### Settings

One thing doT allows, is defining custom delimiters before compiling a string into a template, and with that I have defined different settings for the most common comment block delimiters.

A quick look at these settings:
- html
    - tag start `<!--{`
    - tag end `}-->`
- js, css, php
    - tag start `/*{`
    - tag end `}*/`
- txt (the most common and default format)
    - tag start `#{`
    - tag end `}#`

A more detailed view of these settings can be found here http://drkibitz.github.com/node-samson/docs/latest/Template.settingsByType.html

### Example

Take a look at the following example in `my-file.js`, that is not processed with Samson:

    /* start */
    /*{?argv.target !== 'release'}*/
    var DEBUG = true;
    /*{?}*/
    /* end */

Process with Samson as `samson my-file.js` outputs:

    /* start */

    var DEBUG = true;

    /* end */

Process with Samson as `samson my-file.js --target release` outputs:

    /* start */


    /* end */

### Template Namespaces and Variables

Notice the `argv` member accessible in the doT template. This object contains all of the script arguments parsed by the module optimist, and passed directly into the doT template.

Just as within doT, the `def` object is special. Once a member property is set, it may not be changed. There is one `def` object defined for each file, and one file's template may not access another file's `def`.

Additionally but not limited to, enumerables set within `def` are passed directly to the template's runtime function as arguments. What this means is `/*{#def.FILE}*/`, may also be accessed as `/*{=FILE}*/`

For a more detailed view of the defailt members of `def`, please visit http://drkibitz.github.com/node-samson/docs/latest/ResourceProcessor.def.html

### More Usage Examples

Be sure to to look at:

    samson
    samson -h
    samson --help

Process a single file and output to console:

    samson path/to/file

Process a single file and output to file system:

    samson path/to/file -o path/to/directory

Process multiple files and output to file system:

    samson path/to/file1 path/to/file2 path/to/file3 -o path/to/directory

Process single directory recursively and output to file system:

    samson path/to/directory -o path/to/directory -R

Process files and directories recursively and output to file system:

    samson path/to/dir1 path/to/file path/to/dir2 -o path/to/directory -R

Process matched files recursively and output to file system:

    samson -i path/to/* -o path/to/other/directory -R

