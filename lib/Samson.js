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
module.exports = (function (os, path, fs, Super, mimeparse, event, ResourceReader, ResourceWriter, ResourceProcessor, packageInfo) {
    "use strict";

    /** @private */
    var EOL = os.EOL;

    /**
     * @namespace
     * @memberof Samson
     * @readonly
     * @since 1.0
     */
    var errorCode = Object.create(null, /** @lends Samson.errorCode */ {
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
     * @param {ResourceWriter} writer
     * @param {string} relativeFrom
     * @param {string} file
     * @returns {Function}
     * @since 1.0
     */
    function createManifestWriter(writer, relativeFrom, file) {
        return function writeManifest() {
            var arr = writer.getFilesWritten(relativeFrom);
            if (file) {
                if (!writer.simulate) fs.writeFileSync(file, arr.join(EOL) + EOL);
            } else {
                console.log(arr.join(EOL) + EOL);
            }
        };
    }

    /**
     * @private
     * @param  {Samson} samson
     * @param  {string} eventType
     * @param  {ReadStream|WriteStream} stream
     * @param  {data=} [data]
     * @returns {void}
     */
    function handleStreamEvent(samson, eventType, stream, data) {
        var file = stream.path;
        switch (eventType) {
        // When ReadStream reads, write to WriteStream
        case event.READER_STREAM_DATA:
            if (true === samson.writer.write(file, data)) {
                samson.emit(event.WRITE,
                    samson.writer.getFilteredPath(file),
                    samson.processor.getActiveTpl(file).previousValidationCode);
            } else {
                stream.pause();
            }
            break;
        // When ReadStream ends, destroy WriteStream
        case event.READER_STREAM_END:
            stream = samson.getWriteStreamFromReadPath(file);
            if (stream && stream !== process.stdout) stream.destroySoon();
            break;
        // When ReadStream errors, destroy WriteStream
        case event.READER_STREAM_ERROR:
            stream = samson.getWriteStreamFromReadPath(file);
            if (stream && stream !== process.stdout) stream.destroySoon();
            break;
        // When WriteStream drains, resume ReadStream
        case event.WRITER_STREAM_DRAIN:
            stream = samson.getReadStreamFromWritePath(file);
            samson.emit(event.WRITE, file, samson.processor.getActiveTpl(stream.path).previousValidationCode);
            if (stream) stream.resume();
            break;
        // When WriteStream errors, destroy ReadStream
        case event.WRITER_STREAM_ERROR:
            stream = samson.getReadStreamFromWritePath(file);
            if (stream) stream.destroy();
            break;
        // When WriteStream closes, destroy template
        case event.WRITER_STREAM_CLOSE:
            samson.processor.destroyTpl(file);
            break;
        }
    }

    /**
     * @private
     * @param {Samson} samson
     * @param {Object} [def]
     * @returns {void}
     */
    function initialize(samson, def) {
        // Enum
        if (def) samson.def = def;

        // Not Enum
        // Define instance Object references
        Object.defineProperties(samson, /** @lends Samson# */ {
            /**
             * @readonly
             * @type {ResourceReader}
             * @since 1.0
             */
            reader : {value : new ResourceReader(samson)},
            /**
             * @readonly
             * @type {ResourceWriter}
             * @since 1.0
             */
            writer : {value : new ResourceWriter(samson)},
            /**
             * @readonly
             * @type {ResourceProcessor}
             * @since 1.0
             */
            processor : {value : new ResourceProcessor()}
        });

        samson.writer.filterFileData = function filterFileData(file, data) {
            var stream = samson.getReadStreamFromWritePath(file);
            return samson.processor.processFile(stream.mimeType, stream.path, data, samson.def);
        };
    }

    /**
     * Main object used when running the node-samson script. This object
     * wraps the functionality of three internally defined modules
     * {@link module:node-samson/lib/ResourceReader},
     * {@link module:node-samson/lib/ResourceWriteer}, and
     * {@link module:node-samson/lib/ResourceProcessor}. This object binds to
     * events that are emitted by instances of each of these modules, and then
     * emits its own events defined within the {@link module:node-samson/lib/event} namespace.
     *
     * @name Samson
     * @augments module:events.EventEmitter
     * @constructor
     * @param {Object} [def]
     *
     * @fires module:node-samson/lib/event.WRITE
     * @fires module:node-samson/lib/event.END
     * @fires module:node-samson/lib/event.ERROR
     * @since 1.0
     */
    function Samson(def) {
        Super.call(this);
        initialize(this);
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
        packageInfo : {value : packageInfo},
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
         * @type {Function}
         * @since 1.0
         */
        writeManifest: {value: null, writable: true},

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
                    off: function off(emitter) {
                        Object.keys(listeners).forEach(function (eventType) {
                            (emitter || that).off(eventType, listeners[eventType]);
                        });
                    },
                    on: function on(emitter) {
                        Object.keys(listeners).forEach(function (eventType) {
                            (emitter || that).on(eventType, listeners[eventType]);
                        });
                    }
                };
                writeStream.once('error', logger.clear);
                writeStream.once('close', logger.clear);

                listeners = {};
                listeners[event.READER_STREAM_START] = logger.log.bind(logger, 'Read(start)');
                listeners[event.READER_STREAM_DATA] = logger.log.bind(logger, 'Read(data)');
                listeners[event.READER_STREAM_END] = logger.log.bind(logger, 'Read(end)');
                listeners[event.WRITER_STREAM_START] = logger.log.bind(logger, 'Write(start)');
                listeners[event.WRITE] = function (file, validationCode) {
                    logger.log('Write(' + validationCode + ')', file);
                };
                listeners[event.WRITER_STREAM_CLOSE] = logger.log.bind(logger, 'Write(end)');

                return logger;
            }
        },

        /**
         * Override EventEmitter.prototype.emit to handle the
         * eventType being emitted by another emitter through an
         * "EventTarget-like" approach to emitting events.
         * @override
         * @since 1.0
         */
        emit : {
            value : function emit(eventType, arg1, arg2) {
                // emit the event first
                var result = Super.prototype.emit.apply(this, arguments);
                // The switch case is then a hidden catch all handler
                switch (eventType) {
                case event.READER_STREAM_DATA:
                case event.READER_STREAM_END:
                case event.READER_STREAM_ERROR:
                case event.WRITER_STREAM_DRAIN:
                case event.WRITER_STREAM_ERROR:
                case event.WRITER_STREAM_CLOSE:
                    handleStreamEvent(this, eventType, arg1, arg2);
                    break;
                case event.READER_STREAM_START:
                    this.reading = true;
                    break;
                case event.WRITER_STREAM_START:
                    this.writing = true;
                    break;
                case event.READER_END:
                    this.reading = false;
                    if (!this.writing) this.reset();
                    break;
                case event.WRITER_END:
                    this.writing = false;
                    if (!this.reading) this.reset();
                    break;
                case event.ERROR:
                    this.error = arg1;
                    break;
                }
                return result;
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
                return this.reader.getActiveStream(this.writer.getUnfilteredPath(file));
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
                return this.writer.getActiveStream(this.writer.getFilteredPath(file));
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
                    if ('function' === typeof this.writeManifest) this.writeManifest();
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
                        manifest = path.resolve(outputDir, this.packageInfo.name + '.manifest');
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

                // Are we going to only read and process files with a matched mime-type?
                // Or are we going to copy over anything that didn't match as well?
                this.reader.filterFileBeforeRead = function filterFileBeforeRead(file, mimeType) {
                    return options.copyUnknown || !!mimeparse.bestMatch(ResourceProcessor.mimePatterns, mimeType);
                };

                // Create method to write manifest to output or input directory
                this.writeManifest = createManifestWriter(this.writer, outputDir || inputDir, manifest);

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
    require('os'),
    require('path'),
    require('fs'),
    require('events').EventEmitter,
    require('mimeparse'),
    require('./event'),
    require('./ResourceReader'),
    require('./ResourceWriter'),
    require('./ResourceProcessor'),
    require('./../package')
));
