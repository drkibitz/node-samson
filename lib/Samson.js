/*global module, require, process, console*/
/**
 * Provides the class {@link Samson}.
 * @module node-samson/lib/Samson
 * @author <a href="mailto:drkibitz@gmail.com">Dr. Kibitz</a>
 * @license {@link http://www.opensource.org/licenses/MIT}
 * @requires path
 * @requires fs
 * @requires os
 * @requires events.EventEmitter
 * @requires node-samson/lib/ResourceReader
 * @requires node-samson/lib/ResourceWriter
 * @requires node-samson/lib/ResourceProcessor
 * @since 1.0
 */
module.exports = (function (path, fs, os, Super, mimeparse, ResourceReader, ResourceWriter, ResourceProcessor) {
    "use strict";

    /** @private */
    var EOL = os.EOL;

    /**
     * This namespace defines the events emitted by an instance of {@link Samson}.
     * @readonly
     * @namespace
     * @memberof Samson
     * @since 1.0
     */
    var event = Object.create(null, /** @lends Samson.event */ {
            /**
             * @event
             * @default "readStart"
             * @since 1.0
             */
            READ_START : {value : 'readStart'},
            /**
             * @event
             * @default "read"
             * @since 1.0
             */
            READ : {value : 'read'},
            /**
             * @event
             * @default "readEnd"
             * @since 1.0
             */
            READ_END : {value : 'readEnd'},
            /**
             * @event
             * @default "reset"
             * @since 1.0
             */
            RESET : {value : 'reset'},
            /**
             * @event
             * @default "writeStart"
             * @since 1.0
             */
            WRITE_START : {value : 'writeStart'},
            /**
             * @event
             * @default "write"
             * @since 1.0
             */
            WRITE : {value : 'write'},
            /**
             * @event
             * @default "writeEnd"
             * @since 1.0
             */
            WRITE_END : {value : 'writeEnd'},
            /**
             * @event
             * @default "end"
             * @since 1.0
             */
            END : {value : 'end'},
            /**
             * @event
             * @default "error"
             * @since 1.0
             */
            ERROR : {value : 'error'}
        }),
        /**
         * @namespace
         * @memberof Samson
         * @readonly
         * @since 1.0
         */
        errorCode = Object.create(null, /** @lends Samson.errorCode */ {
            /**
             * @readonly
             * @type {string}
             * @since 1.0
             */
            RESET_CANCEL : {value : 'RESETCANCEL'},
            /**
             * @readonly
             * @type {string}
             * @since 1.0
             */
            EMPTY_PATTERNS : {value : 'EMPTYPATTERNS'},
            /**
             * @readonly
             * @type {string}
             * @since 1.0
             */
            UNSAFE_OUTPUT : {value : 'UNSAFEOUTPUT'}
        });

    /**
     * @private
     * @function
     * @this Samson
     * @param {string} file
     * @param {string} data
     * @returns {string}
     * @since 1.0
     */
    function apply(file, data) {
        var mimeType = this.getReadStreamFromWritePath(file).mimeType;
        return this.processor.apply(mimeType, file, data, this.def);
    }

    /**
     * @private
     * @function
     * @this Samson
     * @param {string} eventType
     * @param {ReadStream|WriteStream} stream
     * @param {mixed} [data]
     * @returns {void}
     * @since 1.0
     */
    function handleStreamEvent(eventType, stream, data) {
        var file = stream.path;
        switch (eventType) {

        // When ReadStream is created
        case ResourceReader.event.READ_STREAM_START:
            this.reading = true;
            this.emit(event.READ_START, file);
            break;

        // When WriteStream is created
        case ResourceWriter.event.WRITE_STREAM_START:
            this.writing = true;
            this.emit(event.WRITE_START, file);
            break;

        // When ReadStream reads, write to WriteStream
        case ResourceReader.event.READ_STREAM_DATA:
            this.emit(event.READ, file, data);
            /*if (!this.options.overwrite && fs.existsSync(file)) {
                this.error = new Error(errorCode.UNSAFE_OUTPUT);
                this.emit(event.ERROR, this.error);
            } else */
            if (true === this.writer.write(file, data)) {
                file = this.writer.getFilteredPath(file);
                this.emit(event.WRITE, file, this.processor.getActiveTpl(file).previousValidationCode);
            } else {
                stream.pause();
            }
            break;

        // When ReadStream ends, destroy WriteStream
        case ResourceReader.event.READ_STREAM_END:
            stream = this.getWriteStreamFromReadPath(file);
            if (stream && stream !== process.stdout) {
                stream.destroySoon();
            }
            this.emit(event.READ_END, file);
            break;

        // When ReadStream closes, destroy WriteStream
        case ResourceReader.event.READ_STREAM_ERROR:
            stream = this.getWriteStreamFromReadPath(file);
            if (stream && stream !== process.stdout) {
                stream.destroySoon();
            }
            this.error = data;
            this.emit(event.ERROR, data);
            break;

        // When WriteStream drains, resume ReadStream
        case ResourceWriter.event.WRITE_STREAM_DRAIN:
            this.emit(event.WRITE, file, this.processor.getActiveTpl(file).previousValidationCode);
            stream = this.getReadStreamFromWritePath(file);
            if (stream) {
                stream.resume();
            }
            break;

        // When WriteStream errors, destroy ReadStream
        case ResourceWriter.event.WRITE_STREAM_ERROR:
            stream = this.getReadStreamFromWritePath(file);
            if (stream) {
                stream.destroy();
            }
            this.error = data;
            this.emit(event.ERROR, data);
            break;

        // When WriteStream closes, destroy template
        case ResourceWriter.event.WRITE_STREAM_CLOSE:
            this.processor.destroyTpl(file);
            this.emit(event.WRITE_END, file);
            break;
        }
    }

    /**
     * @private
     * @function
     * @this Samson
     * @param {string} eventType
     * @param {Error} [exception]
     * @returns {void}
     * @since 1.0
     */
    function handleEvent(eventType, exception) {
        switch (eventType) {
        case ResourceReader.event.GLOB_ERROR:
        case ResourceReader.event.MIME_MAGIC_ERROR:
        case ResourceWriter.event.MKDIRP_ERROR:
            this.error = exception;
            this.emit(event.ERROR, exception);
            break;
        // Possible end
        case ResourceReader.event.END:
            this.reading = false;
            if (!this.writing) {
                this.reset();
            }
            break;
        // Possible end
        case ResourceWriter.event.END:
            this.writing = false;
            if (!this.reading) {
                this.reset();
            }
            break;
        }
    }

    /**
     * Main object used when running the node-samson script. This object
     * wraps the functionality of three internally defined modules
     * {@link module:node-samson/lib/ResourceReader},
     * {@link module:node-samson/lib/ResourceWriteer}, and
     * {@link module:node-samson/lib/ResourceProcessor}. This object binds to
     * events that are emitted by instances of each of these modules, and then
     * emits its own events defined within the {@link Samson.event} namespace.
     *
     * @name Samson
     * @augments module:events.EventEmitter
     * @constructor
     * @param {Object} [def]
     *
     * @fires Samson.event.READ_START
     * @fires Samson.event.READ
     * @fires Samson.event.READ_END
     * @fires Samson.event.WRITE_START
     * @fires Samson.event.WRITE
     * @fires Samson.event.WRITE_END
     * @fires Samson.event.END
     * @fires Samson.event.ERROR
     * @since 1.0
     */
    function Samson(def) {
        // callSuper
        Super.call(this);

        // Enum
        if (def) {
            this.def = def;
        }

        // Not Enum
        // Define instance Object references
        Object.defineProperties(this, /** @lends Samson# */ {
            /**
             * @readonly
             * @type {ResourceReader}
             * @since 1.0
             */
            reader : {value : new ResourceReader()},
            /**
             * @readonly
             * @type {ResourceWriter}
             * @since 1.0
             */
            writer : {value : new ResourceWriter()},
            /**
             * @readonly
             * @type {ResourceProcessor}
             * @since 1.0
             */
            processor : {value : new ResourceProcessor()}
        });

        this.reader
            .on(ResourceReader.event.READ_STREAM_START,
                handleStreamEvent.bind(this, ResourceReader.event.READ_STREAM_START))
            .on(ResourceReader.event.READ_STREAM_DATA,
                handleStreamEvent.bind(this, ResourceReader.event.READ_STREAM_DATA))
            .on(ResourceReader.event.READ_STREAM_END,
                handleStreamEvent.bind(this, ResourceReader.event.READ_STREAM_END))
            .on(ResourceReader.event.READ_STREAM_ERROR,
                handleStreamEvent.bind(this, ResourceReader.event.READ_STREAM_ERROR))
            .on(ResourceReader.event.READ_STREAM_CLOSE,
                handleStreamEvent.bind(this, ResourceReader.event.READ_STREAM_CLOSE))
            .on(ResourceReader.event.GLOB_ERROR,
                handleEvent.bind(this, ResourceReader.event.GLOB_ERROR))
            .on(ResourceReader.event.MIME_MAGIC_ERROR,
                handleEvent.bind(this, ResourceReader.event.MIME_MAGIC_ERROR))
            .on(ResourceReader.event.END,
                handleEvent.bind(this, ResourceReader.event.END));

        this.writer
            .on(ResourceWriter.event.WRITE_STREAM_START,
                handleStreamEvent.bind(this, ResourceWriter.event.WRITE_STREAM_START))
            .on(ResourceWriter.event.WRITE_STREAM_DRAIN,
                handleStreamEvent.bind(this, ResourceWriter.event.WRITE_STREAM_DRAIN))
            .on(ResourceWriter.event.WRITE_STREAM_ERROR,
                handleStreamEvent.bind(this, ResourceWriter.event.WRITE_STREAM_ERROR))
            .on(ResourceWriter.event.WRITE_STREAM_CLOSE,
                handleStreamEvent.bind(this, ResourceWriter.event.WRITE_STREAM_CLOSE))
            .on(ResourceWriter.event.MKDIRP_ERROR,
                handleEvent.bind(this, ResourceWriter.event.MKDIRP_ERROR))
            .on(ResourceWriter.event.END,
                handleEvent.bind(this, ResourceWriter.event.END))
            .filterFileData = apply.bind(this);
    }

    // Instance properties
    Samson.prototype = Object.create(Super.prototype, /** @lends Samson# */ {
        /** @ignore */
        constructor : {value : Samson},

        /**
         * @type {Object}
         * @since 1.0
         */
        def : {value : null},
        /**
         * @type {Error}
         * @since 1.0
         */
        error : {value : null},
        /**
         * @type {Error}
         * @since 1.0
         */
        options : {value : null},
        /**
         * @type {Object}
         * @since 1.0
         */
        package : {value : require('./../package')},
        /**
         * @type {boolean}
         * @since 1.0
         */
        reading : {value : false},
        /**
         * @type {boolean}
         * @since 1.0
         */
        writing : {value : false},

        /**
         * @method
         * @param {fs.WriteStream} writeStream
         * @returns {Function}
         * @since 1.0
         */
        createLogger: {
            value: function createLogger(writeStream) {
                var that = this, lines = [], logger, listeners, onDrain;

                logger = {
                    clear: function clear() {
                        lines.length = 0;
                        if (onDrain) {
                            writeStream.off('drain', onDrain);
                            onDrain = null;
                        }
                    },
                    log: function log(message, file) {
                        var line = new Date() + ': ' + message;
                        if (file) {
                            line += ' ' + path.relative(process.cwd(), file);
                        }
                        lines[lines.length] = line;
                        if (true === writeStream.write(lines.join(EOL) + EOL)) {
                            logger.clear();
                        } else if (!onDrain) {
                            onDrain = function () {
                                logger.log(message, file);
                            };
                            writeStream.on('drain', onDrain);
                        }
                    },
                    off: function off() {
                        Object.keys(listeners).forEach(function (eventType) {
                            that.off(eventType, listeners[eventType]);
                        });
                    },
                    on: function on() {
                        Object.keys(listeners).forEach(function (eventType) {
                            that.on(eventType, listeners[eventType]);
                        });
                    }
                };
                writeStream.once('error', logger.clear);
                writeStream.once('close', logger.clear);

                listeners = {};
                listeners[Samson.event.READ_START] = logger.log.bind(logger, 'Read(start)');
                listeners[Samson.event.READ] = logger.log.bind(logger, 'Read(data)');
                listeners[Samson.event.READ_END] = logger.log.bind(logger, 'Read(end)');
                listeners[Samson.event.WRITE_START] = logger.log.bind(logger, 'Write(start)');
                listeners[Samson.event.WRITE] = function (file, validationCode) {
                    logger.log('Write(' + validationCode + ')', file);
                };
                listeners[Samson.event.WRITE_END] = logger.log.bind(logger, 'Write(end)');

                return logger;
            }
        },

        /**
         * Since the purpose of this object is the process or
         * copy files from one location to another, this is a helper
         * method that allows retrieval of the stream reading the
         * original file based on the new file's destination.
         * @method
         * @param {string} file
         * @returns {module:fs.ReadStream} ReadStream instance
         * @since 1.0
         */
        getReadStreamFromWritePath : {
            value : function getReadStreamFromWritePath(file) {
                file = this.writer.getUnfilteredPath(file);
                return this.reader.getActiveStream(file);
            }
        },

        /**
         * Since the purpose of this object is the process or
         * copy files from one location to another, this is a helper
         * method that allows retrieval of the stream writing the new
         * file based on the original file's location.
         * @method
         * @param {string} file
         * @returns {module:fs.WriteStream} WriteStream instance
         * @since 1.0
         */
        getWriteStreamFromReadPath : {
            value : function getWriteStreamFromReadPath(file) {
                file = this.writer.getFilteredPath(file);
                return this.writer.getActiveStream(file);
            }
        },

        /**
         * @method
         * @param {string} relativeFrom
         * @param {string} file
         * @returns {Samson} this
         * @since 1.0
         */
        prepareToWriteManifest : {
            value : function prepareToWriteManifest(relativeFrom, file) {
                this.once(event.END, function (err) {
                    var output = this.writer.getFilesWritten(relativeFrom).join(EOL);
                    if (file) {
                        if (!this.writer.simulate) {
                            fs.writeFileSync(file, output);
                        }
                    } else {
                        console.log('Manifest:' + EOL + EOL + output);
                    }
                });
            }
        },

        /**
         * @method
         * @returns {Samson} this
         * @throws Error
         * @since 1.0
         */
        reset : {
            value : function reset() {
                if (this.hasOwnProperty('reading') || this.hasOwnProperty('writing')) {
                    if (this.reading || this.writing) {
                        this.error = new Error(errorCode.RESET_CANCEL);
                    }
                    this.emit(event.END, this.error);
                }
                this.emit(event.RESET);
                this.reader.reset();
                this.writer.reset();
                this.processor.reset();
                delete this.error;
                delete this.reading;
                delete this.writing;
            }
        },

        /**
         * This method is the main entry point of the process of
         * reading, processing, and writing files.
         * @method
         * @param {Array} patterns
         * @param {Object} [options]
         * @returns {Samson} this
         * @throws Error
         * @since 1.0
         */
        run : {
            value : function run(patterns, options) {
                var xInput, inputDir, outputDir, manifest;

                Object.keys(Samson.options).forEach(function (key) {
                    if (!options.hasOwnProperty(key)) {
                        options[key] = Samson.options[key];
                    }
                });
                this.options = options;

                inputDir  = options.inputDir;
                outputDir = options.outputDir;
                manifest  = options.manifest;

                if (inputDir) {
                    patterns = [options.recursive ? ResourceReader.RECURSIVE_PATTERN : '*'];
                }
                // Defaults and relative to process.cwd()
                inputDir = path.resolve(inputDir);

                // Only do the following if using an outputDir.
                if (outputDir) {
                    // Relative to process.cwd()
                    outputDir = path.resolve(outputDir);
                    // Create regex to use in filter
                    xInput = new RegExp('^' + inputDir);
                    // Set path filter on ResourceWriter
                    this.writer.filterFilePath = function filterFilePath(file) {
                        // First try to match inputDir to replace with outputDir
                        if (file.match(xInput)) {
                            return file.replace(xInput, outputDir);
                        // If that doesn't work, append full path to outputDir.
                        // No, it doesn't matter if it is already a full path.
                        } else {
                            return path.join(outputDir, file);
                        }
                    };
                    if (true === manifest) {
                        manifest = path.resolve(outputDir, this.package.name + '.manifest');
                    }

                // Since there is no output directory set a path filter that
                // doesn't actually filter, but instead sets a common output.
                // Setting the stream now bypasses any WriteStream creation.
                } else {
                    this.writer.filterFilePath = function filterFilePath(file) {
                        this.streams[file] = process.stdout;
                        return file;
                    };
                    if (manifest) {
                        manifest = path.resolve(inputDir, manifest);
                    }
                }

                // Possible errors
                if (inputDir === outputDir && !options.overwrite) {
                    throw new Error(errorCode.UNSAFE_OUTPUT);
                }
                if (!patterns.length) {
                    throw new Error(errorCode.EMPTY_PATTERNS);
                }

                // Prep manifest for output or input directory
                this.prepareToWriteManifest(outputDir || inputDir, manifest);

                // Are we going to only read and process files with a matched mime-type?
                // Or are we going to copy over anything that didn't match as well?
                if (!options.copyUnknown) {
                    this.reader.filterFileBeforeRead = function filterFileBeforeRead(file, mimeType) {
                        return !!mimeparse.bestMatch(ResourceProcessor.mimePatterns, mimeType);
                    };
                }

                // Start reading
                this.reader.read(patterns, inputDir, options.recursive);
                return this;
            }
        }
    });

    // Module provides
    return Object.defineProperties(Samson, /** @lends Samson */ {
        event : {value : event},
        errorCode : {value : errorCode},
        /**
         * @type {boolean}
         * @since 1.0
         */
        options : {
            value : {
                copyUnknown : false,
                inputDir    : '',
                outputDir   : '',
                manifest    : '',
                overwrite   : false,
                recursive   : false
            }
        }
    });

}(
    require('path'),
    require('fs'),
    require('os'),
    require('events').EventEmitter,
    require('mimeparse'),
    require('./ResourceReader'),
    require('./ResourceWriter'),
    require('./ResourceProcessor')
));
