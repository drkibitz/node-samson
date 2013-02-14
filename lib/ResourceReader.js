/*global module, require, console*/
/**
 * Provides the class {@link ResourceReader}.
 * @module node-samson/lib/ResourceReader
 * @author <a href="mailto:drkibitz@gmail.com">Dr. Kibitz</a>
 * @license {@link http://www.opensource.org/licenses/MIT}
 * @requires path
 * @requires events.EventEmitter
 * @requires fs.ReadStream
 * @requires glob.Glob
 * @requires mime-magic
 * @requires node-samson/lib/Queue
 * @since 1.0
 */
module.exports = (function (path, Super, ReadStream, Glob, mimeMagic, event, Queue) {
    "use strict";

    /**
     * Return a clone of the array provided with duplicates removed.
     * @private
     * @function
     * @param {Array} arr
     * @returns {Array}
     * @since 1.0
     */
    function arrayUnique(arr) {
        var i, l, obj = {};
        for (i = 0, l = arr.length; i < l; ++i) {
            obj[arr[i]] = arr[i];
        }
        return Object.keys(obj);
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param module:fs.ReadStream} stream
     * @param {string} data
     * @returns {void}
     * @since 1.0
     */
    function onStreamData(stream, data) {
        this.emit(event.READER_STREAM_DATA, stream, data);
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param module:fs.ReadStream} stream
     * @returns {void}
     * @since 1.0
     */
    function onStreamEnd(stream) {
        this.emit(event.READER_STREAM_END, stream);
        this.destroyStream(stream.path);
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param module:fs.ReadStream} stream
     * @param {Error} exception
     * @returns {void}
     * @since 1.0
     */
    function onStreamError(stream, exception) {
        this.emit(event.READER_STREAM_ERROR, stream, exception);
        this.destroyStream(stream.path);
        this.emit(event.ERROR, exception);
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param module:fs.ReadStream} stream
     * @returns {void}
     * @since 1.0
     */
    function onStreamClose(stream) {
        this.emit(event.READER_STREAM_CLOSE, stream);
        this.destroyStream(stream.path);
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param {string} file
     * @param {string} mimeType
     * @returns {module:fs.ReadStream|uint}
     * @since 1.0
     */
    function newStream(file, mimeType) {
        var stream = this.getActiveStream(file);
        if (null !== stream) {
            return;
        }
        if (this.numOfStreams >= this.maxNumOfStreams) {
            this.streamQueue.push(arguments);
            return;
        }

        this.numOfStreams++;
        stream = this.streams[file] = new ReadStream(file);
        stream.on('data', onStreamData.bind(this, stream))
            .once('end', onStreamEnd.bind(this, stream))
            .once('error', onStreamError.bind(this, stream))
            .once('close', onStreamClose.bind(this, stream));

        stream.destroyed = false;
        stream.mimeType = mimeType;

        if (stream.readable) {
            this.emit(event.READER_STREAM_START, stream);
        } else {
            this.destroyStream(file);
        }
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param {string} file
     * @param {Error} [exception]
     * @param {string} mimeType
     * @returns {void}
     * @since 1.0
     */
    function onMimeMagic(file, exception, mimeType) {
        this.numOfMimeMagics--;

        if (exception && (exception instanceof Error)) {
            this.emit(event.ERROR, exception);
            newStream.call(this, file, ResourceReader.DEFAULT_MIMETYPE);
        } else {
            this.emit(event.READER_MIME_MAGIC_END, mimeType);
            // If we don't have a filter, or we do not get something true, ignore this file
            if ('function' !== typeof this.filterFileBeforeRead ||
                this.filterFileBeforeRead.call(this, file, mimeType)) {
                newStream.call(this, file, mimeType);
            }
        }

        if (this.mimeMagicQueue.length) {
            this.mimeMagicQueue.shiftApply();
        } else if (!this.totalAsync) {
            this.emit(event.READER_END);
        }
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param {string} file
     * @returns {void}
     * @since 1.0
     */
    function newMimeMagic(file) {
        if (this.numOfMimeMagics >= this.maxNumOfMimeMagics) {
            this.mimeMagicQueue.push(arguments);
            return;
        }

        this.numOfMimeMagics++;
        try {
            mimeMagic(file, onMimeMagic.bind(this, file));
        } catch (exception) {
            onMimeMagic.call(this, file, exception);
        }
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param {module:glob.Glob} glob
     * @param {string} match
     * @returns {void}
     * @since 1.0
     */
    function forEachGlobMatch(glob, match) {
        var resolved = path.resolve(glob.cwd, match);

        switch (glob.statCache[match]) {
        // directory statCache type (Set by glob module)
        case 2:
            if (this.recursive && -1 === glob.pattern.indexOf(ResourceReader.RECURSIVE_PATTERN)) {
                newGlob.call(this, ResourceReader.RECURSIVE_PATTERN, resolved);
            }
            break;
        // file stat statCache (Set by glob module)
        case 1:
            newMimeMagic.call(this, resolved);
            break;
        }
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param {module:glob.Glob} glob
     * @returns {void}
     * @since 1.0
     */
    function onGlob(glob) {
        this.numOfGlobs--;
        if (this.globQueue.length) {
            this.globQueue.shiftApply();
        } else if (!this.totalAsync) {
            this.emit(event.READER_END);
        }
        glob.removeAllListeners();
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param {module:glob.Glob} glob
     * @param {Array.<string>} matches
     * @returns {void}
     * @since 1.0
     */
    function onGlobEnd(glob, matches) {
        this.emit(event.READER_GLOB_END, matches);
        matches.forEach(forEachGlobMatch.bind(this, glob));
        onGlob.call(this, glob);
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param {module:glob.Glob} glob
     * @param {Error} error
     * @returns {void}
     * @since 1.0
     */
    function onGlobError(glob, error) {
        this.emit(event.ERROR, error);
        onGlob.call(this, glob);
    }

    /**
     * @private
     * @function
     * @this ResourceReader
     * @param {string} pattern
     * @param {string} [cwd]
     * @returns {void}
     * @since 1.0
     */
    function newGlob(pattern, cwd) {
        var glob;

        if (this.numOfGlobs >= this.maxNumOfGlobs) {
            this.globQueue.push(arguments);
            return;
        }

        this.numOfGlobs++;
        glob = new Glob(pattern, {
            // Important, but still defaults to process.cwd()
            cwd : cwd,
            // Make sure to stat everything.
            // We want to know what is a directory everytime.
            stat : true,
            // Using a static cache object for all globs.
            statCache : ResourceReader.statCache,
            // Haven't run into problems with this, yet.
            strict : true
        });
        glob.once('end', onGlobEnd.bind(this, glob))
            .once('error', onGlobError.bind(this, glob));
    }

    /**
     * Object that joins the functionality of {@link module:glob.Glob}, {@link module:fs.ReadStream}
     * and {@link module:mime-magic}. It is meant to allow for matching many files, then detect the
     * mime-type of each one, and then read each one asynchronously through parallel streams.
     * There is a maximum amount for glob, stream, and mime-magic objects. If any call would exceed
     * these amounts, it is queued until the current number objects of their respective type is
     * complete. This class is also a {@link module:events.EventEmitter}, and each event emitted by a {@link ResourceReader}
     * object is specified in the namespace {@link module:node-samson/lib/event}
     *
     * @name ResourceReader
     * @augments module:events.EventEmitter
     * @constructor
     * @param {EventEmitter} [emitter]
     *
     * @fires node-samson/lib/event.READER_GLOB_END
     * @fires node-samson/lib/event.READER_MIME_MAGIC_END
     * @fires node-samson/lib/event.READER_STREAM_START
     * @fires node-samson/lib/event.READER_STREAM_DATA
     * @fires node-samson/lib/event.READER_STREAM_END
     * @fires node-samson/lib/event.READER_STREAM_ERROR
     * @fires node-samson/lib/event.READER_STREAM_CLOSE
     * @fires node-samson/lib/event.READER_END
     * @since 1.0
     */
    function ResourceReader(emitter) {
        // callSuper
        Super.call(this);
        // Define instance Object references
        Object.defineProperties(this, /** @lends ResourceReader# */ {
            /**
             * @readonly
             * @type {EventEmitter}
             * @since 1.0
             */
            emitter : {value : emitter, writable: true},
            /**
             * @readonly
             * @type {Queue}
             * @default new Queue()
             * @since 1.0
             */
            globQueue : {value : new Queue(newGlob, this)},
            /**
             * @readonly
             * @type {Queue}
             * @default new Queue()
             * @since 1.0
             */
            mimeMagicQueue : {value : new Queue(newMimeMagic, this)},
            /**
             * @readonly
             * @type {Queue}
             * @default new Queue()
             * @since 1.0
             */
            streamQueue : {value : new Queue(newStream, this)},
            /**
             * @readonly
             * @type {Object}
             * @default new Object()
             * @since 1.0
             */
            streams : {value : {}}
        });
    }

    // Instance properties
    ResourceReader.prototype = Object.create(Super.prototype, /** @lends ResourceReader# */ {
        /** @ignore */
        constructor : {value : ResourceReader},

        /**
         * @type {Function}
         * @since 1.0
         */
        filterFileBeforeRead: {value: null, writable: true},
        /**
         * @type {uint}
         * @default 8
         * @since 1.0
         */
        maxNumOfGlobs : {value : 8},
        /**
         * @type {uint}
         * @default 4
         * @since 1.0
         */
        maxNumOfMimeMagics : {value : 4},
        /**
         * @type {uint}
         * @default 4
         * @since 1.0
         */
        maxNumOfStreams : {value : 4},
        /**
         * @type {uint}
         * @default 0
         * @since 1.0
         */
        numOfGlobs : {value : 0},
        /**
         * @type {uint}
         * @default 0
         * @since 1.0
         */
        numOfMimeMagics : {value : 0},
        /**
         * @type {uint}
         * @default 0
         * @since 1.0
         */
        numOfStreams : {value : 0},
        /**
         * @type {boolean}
         * @default false
         * @since 1.0
         */
        recursive : {value : false},
        /**
         * @readonly
         * @type {uint}
         * @default 0
         * @since 1.0
         */
        totalAsync : {
            get : function getTotalAsync() {
                return this.numOfGlobs +
                    this.numOfMimeMagics +
                    this.numOfStreams +
                    this.globQueue.length +
                    this.mimeMagicQueue.length +
                    this.streamQueue.length;
            }
        },

        /**
         * Override EventEmitter.prototype.emit to allow for an
         * "EventTarget-like" approach to emitting events.
         * @override
         * @since 1.0
         */
        emit : {
            value : function emit(eventType) {
                if (this.emitter) {
                    this.emitter.emit.apply(this.emitter, arguments);
                } else {
                    Super.prototype.emit.apply(this, arguments);
                }
                return this;
            }
        },

        /**
         * @method
         * @param {string} file
         * @returns {module:fs.ReadStream}
         * @since 1.0
         */
        getActiveStream : {
            value : function getActiveStream(file) {
                return this.streams.hasOwnProperty(file) ? this.streams[file] : null;
            }
        },

        /**
         * @method
         * @param {string} file
         * @returns {void}
         * @since 1.0
         */
        destroyStream : {
            value : function destroyStream(file) {
                var stream = this.getActiveStream(file);

                if (stream && !stream.destroyed) {
                    this.numOfStreams--;

                    if (this.streamQueue.length) {
                        this.streamQueue.shiftApply();
                    } else if (!this.totalAsync) {
                        this.emit(event.READER_END);
                    }
                    stream.destroyed = true;
                    stream.removeAllListeners();
                    delete this.streams[file];
                }
            }
        },

        /**
         * @method
         * @param {Array.<string>} patterns
         * @param {string} [cwd] Use this instead of the value returned by process.cwd().
         * @param {boolean} [recursive=false]
         * @returns {ResourceReader} this
         * @throws Error
         * @since 1.0
         */
        read : {
            value : function read(patterns, cwd, recursive) {
                var i, l;

                if (!Array.isArray(patterns)) {
                    throw new Error(patterns + ' is expected to be an Array.');
                }

                // Set recursive flag
                this.recursive = !!recursive;
                // Clear anything queued
                this.reset();

                // Remove duplicates
                patterns = arrayUnique(patterns);
                cwd = cwd || null;

                // Start matching
                for (i = 0, l = patterns.length; i < l; ++i) {
                    newGlob.call(this, patterns[i], cwd);
                }
                return this;
            }
        },

        /**
         * Removes properties that may have been set after instantiation.
         * @method
         * @returns {ResourceReader} this
         * @since 1.0
         */
        reset : {
            value : function reset() {
                var i, l, keys;

                // Clear read-only array and object properties
                this.globQueue.clear();
                this.mimeMagicQueue.clear();
                this.streamQueue.clear();
                keys = Object.keys(this.streams);
                for (i = 0, l = keys.length; i < l; ++i) {
                    this.destroyStream(keys[i]);
                }
                return this;
            }
        }
    });

    // Module provides
    return Object.defineProperties(ResourceReader, /** @lends ResourceReader */ {
        /**
         * @constant
         * @type {string}
         * @default "application/octet-stream"
         * @since 1.0
         */
        DEFAULT_MIMETYPE : {value : 'application/octet-stream'},
        /**
         * @constant
         * @type {string}
         * @default "** / *" (Without the spaces)
         * @since 1.0
         */
        RECURSIVE_PATTERN : {value : '**/*'},
        /**
         * This object is used by every instance of {@link module:glob.Glob} created
         * after invoking {@link ResourceReader#read}.
         * @readonly
         * @type {Object}
         * @default new Object()
         * @since 1.0
         */
        statCache : {value : {}}
    });

}(
    require('path'),
    require('events').EventEmitter,
    require('fs').ReadStream,
    require('glob').Glob,
    require('mime-magic'),
    require('./event'),
    require('./Queue')
));
