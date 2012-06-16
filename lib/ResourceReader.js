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
module.exports = (function (path, Super, ReadStream, Glob, mimeMagic, Queue) {
    "use strict";

    /**
     * This namespace defines the events emitted by an instance of {@link ResourceReader}.
     * @readonly
     * @memberof ResourceReader
     * @namespace
     * @since 1.0
     */
    var event = Object.freeze(Object.create(null, /** @lends ResourceReader.event */ {
            /**
             * @event
             * @default "globEnd"
             * @since 1.0
             */
            GLOB_END : {value : 'globEnd'},
            /**
             * @event
             * @default "globError"
             * @since 1.0
             */
            GLOB_ERROR : {value : 'globError'},
            /**
             * @event
             * @default "mimeMagicError"
             * @since 1.0
             */
            MIME_MAGIC_END : {value : 'mimeMagicError'},
            /**
             * @event
             * @default "mimeMagicEnd"
             * @since 1.0
             */
            MIME_MAGIC_ERROR : {value : 'mimeMagicEnd'},
            /**
             * @event
             * @default "readStreamStart"
             * @since 1.0
             */
            READ_STREAM_START : {value : 'readStreamStart'},
            /**
             * @event
             * @default "readStreamData"
             * @since 1.0
             */
            READ_STREAM_DATA : {value : 'readStreamData'},
            /**
             * @event
             * @default "readStreamEnd"
             * @since 1.0
             */
            READ_STREAM_END : {value : 'readStreamEnd'},
            /**
             * @event
             * @default "readStreamError"
             * @since 1.0
             */
            READ_STREAM_ERROR : {value : 'readStreamError'},
            /**
             * @event
             * @default "readStreamClose"
             * @since 1.0
             */
            READ_STREAM_CLOSE : {value : 'readStreamClose'},
            /**
             * @event
             * @default "readerEnd"
             * @since 1.0
             */
            END : {value : 'readerEnd'}
        }));

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
     * @this module:fs.ReadStream
     * @param {string} data
     * @returns {void}
     * @since 1.0
     */
    function onStreamData(data) {
        this.__ob.emit(event.READ_STREAM_DATA, this, data);
    }

    /**
     * @private
     * @function
     * @this module:fs.ReadStream
     * @returns {void}
     * @since 1.0
     */
    function onStreamEnd() {
        this.__ob.emit(event.READ_STREAM_END, this);
        this.__ob.destroyStream(this.path);
    }

    /**
     * @private
     * @function
     * @this module:fs.ReadStream
     * @param {Error} exception
     * @returns {void}
     * @since 1.0
     */
    function onStreamError(exception) {
        this.__ob.emit(event.READ_STREAM_ERROR, this, exception);
        this.__ob.destroyStream(this.path);
    }

    /**
     * @private
     * @function
     * @this module:fs.ReadStream
     * @returns {void}
     * @since 1.0
     */
    function onStreamClose() {
        this.__ob.emit(event.READ_STREAM_CLOSE, this);
        this.__ob.destroyStream(this.path);
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
        stream = this.streams[file] = new ReadStream(file)
            .on('data', onStreamData)
            .once('end', onStreamEnd)
            .once('error', onStreamError)
            .once('close', onStreamClose);

        stream.destroyed = false;
        stream.mimeType = mimeType;
        stream.__ob = this;

        if (stream.readable) {
            this.emit(event.READ_STREAM_START, stream);
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
            this.emit(event.MIME_MAGIC_ERROR, exception);
            newStream.call(this, file, ResourceReader.DEFAULT_MIMETYPE);
        } else {
            this.emit(event.MIME_MAGIC_END, mimeType);
            newStream.call(this, file, mimeType);
        }

        if (this.mimeMagicQueue.length) {
            this.mimeMagicQueue.shiftApply();
        } else if (!this.totalAsync) {
            this.emit(event.END);
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
            mimeMagic.fileWrapper(file, onMimeMagic.bind(this, file));
        } catch (exception) {
            onMimeMagic.call(this, file, exception);
        }
    }

    /**
     * @private
     * @function
     * @this module:glob.Glob
     * @param {string} match
     * @returns {void}
     * @since 1.0
     */
    function forEachGlobMatch(match) {
        var ob = this.__ob,
            resolved = path.resolve(this.cwd, match);

        switch (this.statCache[match]) {
        // directory statCache type (Set by glob module)
        case 2:
            if (ob.recursive && -1 === this.pattern.indexOf(ResourceReader.RECURSIVE_PATTERN)) {
                newGlob.call(ob, ResourceReader.RECURSIVE_PATTERN, resolved);
            }
            break;
        // file stat statCache (Set by glob module)
        case 1:
            newMimeMagic.call(ob, resolved);
            break;
        }
    }

    /**
     * @private
     * @function
     * @this module:glob.Glob
     * @param {Array.<string>|Error} data
     * @returns {void}
     * @since 1.0
     */
    function onGlob(data) {
        var ob = this.__ob;
        ob.numOfGlobs--;

        if (data && (data instanceof Error)) {
            ob.emit(event.GLOB_ERROR, data);
        } else {
            ob.emit(event.GLOB_END, data);
            data.forEach(forEachGlobMatch, this);
        }

        if (ob.globQueue.length) {
            ob.globQueue.shiftApply();
        } else if (!ob.totalAsync) {
            ob.emit(event.END);
        }
        this.removeAllListeners();
        delete this.__ob;
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
        })
            .once('end', onGlob)
            .once('error', onGlob);

        glob.__ob = this;
    }

    /**
     * Object that joins the functionality of {@link module:glob.Glob}, {@link module:fs.ReadStream}
     * and {@link module:mime-magic}. It is meant to allow for matching many files, then detect the
     * mime-type of each one, and then read each one asynchronously through parallel streams.
     * There is a maximum amount for glob, stream, and mime-magic objects. If any call would exceed
     * these amounts, it is queued until the current number objects of their respective type is
     * complete. This class is also a {@link module:events.EventEmitter}, and each event emitted by a {@link ResourceReader}
     * object is specified in the namespace {@link ResourceReader.event}
     *
     * @name ResourceReader
     * @augments module:events.EventEmitter
     * @constructor
     *
     * @fires ResourceReader.event.GLOB_END
     * @fires ResourceReader.event.GLOB_ERROR
     * @fires ResourceReader.event.GLOB_END
     * @fires ResourceReader.event.GLOB_ERROR
     * @fires ResourceReader.event.MIME_MAGIC_END
     * @fires ResourceReader.event.MIME_MAGIC_ERROR
     * @fires ResourceReader.event.READ_STREAM_START
     * @fires ResourceReader.event.READ_STREAM_DATA
     * @fires ResourceReader.event.READ_STREAM_END
     * @fires ResourceReader.event.READ_STREAM_ERROR
     * @fires ResourceReader.event.READ_STREAM_CLOSE
     * @fires ResourceReader.event.END
     * @since 1.0
     */
    function ResourceReader() {
        // callSuper
        Super.call(this);
        // Define instance Object references
        Object.defineProperties(this, /** @lends ResourceReader# */ {
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
    ResourceReader.prototype = Object.freeze(Object.create(Super.prototype, /** @lends ResourceReader# */ {
        /** @ignore */
        constructor : {value : ResourceReader},

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
                        this.emit(event.END);
                    }
                    stream.destroyed = true;
                    stream.removeAllListeners();
                    delete stream.__ob;
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
    }));

    // Module provides
    return Object.freeze(Object.defineProperties(ResourceReader, /** @lends ResourceReader */ {
        event: {value : event},
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
    }));

}(
    require('path'),
    require('events').EventEmitter,
    require('fs').ReadStream,
    require('glob').Glob,
    require('mime-magic'),
    require('./Queue')
));
