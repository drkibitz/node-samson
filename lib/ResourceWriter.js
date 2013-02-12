/*global module, require, console, setTimeout, clearTimeout*/
/**
 * Provides the class {@link ResourceWriter}.
 * @module node-samson/lib/ResourceWriter
 * @author <a href="mailto:drkibitz@gmail.com">Dr. Kibitz</a>
 * @license {@link http://www.opensource.org/licenses/MIT}
 * @requires path
 * @requires fs
 * @requires events.EventEmitter
 * @requires mkdirp
 * @requires node-samson/lib/Queue
 * @since 1.0
 */
module.exports = (function (path, fs, Super, mkdirp, Queue) {
    "use strict";

    /**
     * This namespace defines the events emitted by an instance of {@link ResourceWriter}.
     * @readonly
     * @memberof ResourceWriter
     * @namespace
     * @since 1.0
     */
    var event = Object.create(null, /** @lends ResourceWriter.event */ {
            /**
             * @event
             * @default "mkdirpEnd"
             * @since 1.0
             */
            MKDIRP_END : {value : 'mkdirpEnd'},
            /**
             * @event
             * @default "mkdirpError"
             * @since 1.0
             */
            MKDIRP_ERROR : {value : 'mkdirpError'},
            /**
             * @event
             * @default "writeStreamStart"
             * @since 1.0
             */
            WRITE_STREAM_START : {value : 'writeStreamStart'},
            /**
             * @event
             * @default "writeStreamDrain"
             * @since 1.0
             */
            WRITE_STREAM_DRAIN : {value : 'writeStreamDrain'},
            /**
             * @event
             * @default "writeStreamError"
             * @since 1.0
             */
            WRITE_STREAM_ERROR : {value : 'writeStreamError'},
            /**
             * @event
             * @default "writeStreamClose"
             * @since 1.0
             */
            WRITE_STREAM_CLOSE : {value : 'writeStreamClose'},
            /**
             * @event
             * @default "writerEnd"
             * @since 1.0
             */
            END : {value : 'writerEnd'}
        });

    var fdSimulated = 0;
    function fsOpenSimulated(path, flags, mode, callback) {
        setTimeout(function () {
            callback(null, fdSimulated++);
            console.log('Simulated(fs.open):', path, flags, mode);
        }, 10 + Math.random() * 500);
    }

    function fsWriteSimulated(fd, buffer, offset, length, position, callback) {
        setTimeout(function () {
            console.log('Simulated(fs.write):', fd, buffer, offset, length, position);
            callback(null, buffer.length, buffer);
        }, 10 + Math.random() * 500);
    }

    function fsCloseSimulated(fd, callback) {
        setTimeout(function () {
            console.log('Simulated(fs.close):', fd);
            callback(null);
        }, 10 + Math.random() * 500);
    }

    function WriteStreamSimulated(path, options) {
        if (!(this instanceof WriteStreamSimulated)) return new WriteStreamSimulated(path, options);
        fs.WriteStream.call(this, path, options);
    }

    // Instance properties
    WriteStreamSimulated.prototype = Object.create(fs.WriteStream.prototype, /** @lends WriteStreamSimulated# */ {
        /** @override */
        _open : {
            get : function () {
                return fsOpenSimulated;
            },
            set : function () {}
        },
        /** @override */
        flush : {
            value : function flush() {
                this._queue.forEach(function (args) {
                    if (!args) return;
                    var method = args[0];
                    switch (method) {
                    // case fs.open  : method = fsOpenSimulated;  break;
                    case fs.write : method = fsWriteSimulated; break;
                    case fs.close : method = fsCloseSimulated; break;
                    default: return;
                    }
                    args[0] = method;
                });
                return fs.WriteStream.prototype.flush.apply(this, arguments);
            }
        }
    });

    /**
     * @private
     * @function
     * @this ResourceWriter
     * @returns {void}
     * @since 1.0
     */
    function deferredEmitEnd(delay) {
        if (false === delay) {
            this._timeout = null;
            this.emit(event.END);
            this.reset();
        } else {
            if (null !== this._timeout) {
                clearTimeout(this._timeout);
            }
            this._timeout = setTimeout(deferredEmitEnd.bind(this, false), delay || 100);
        }
    }

    /**
     * @private
     * @function
     * @this ResourceWriter
     * @param {module:fs.WriteStream} stream
     * @returns {void}
     * @since 1.0
     */
    function onStreamDrain(stream) {
        this.emit(event.WRITE_STREAM_DRAIN, stream);
    }

    /**
     * @private
     * @function
     * @this ResourceWriter
     * @param {module:fs.WriteStream} stream
     * @param {Error} [exception]
     * @returns {void}
     * @since 1.0
     */
    function onStreamError(stream, exception) {
        this.emit(event.WRITE_STREAM_ERROR, stream, exception);
        this.destroyStream(stream.path);
        stream.destroySoon();
    }

    /**
     * @private
     * @function
     * @this ResourceWriter
     * @param {module:fs.WriteStream} stream
     * @returns {void}
     * @since 1.0
     */
    function onStreamClose(stream) {
        this.emit(event.WRITE_STREAM_CLOSE, stream);
        this.destroyStream(stream.path);
    }

    /**
     * @private
     * @function
     * @this ResourceWriter
     * @param {string} file
     * @returns {void}
     * @since 1.0
     */
    function newStream(file) {
        var stream = this.getActiveStream(file);
        if (null !== stream) {
            return stream
        }

        if (this.numOfStreams >= this.maxNumOfStreams) {
            this.streamQueue.push(arguments);
            return;
        }

        this.numOfStreams++;
        stream = this.simulate ? new WriteStreamSimulated(file) : new fs.WriteStream(file);
        stream.on('drain', onStreamDrain.bind(this, stream))
            .once('error', onStreamError.bind(this, stream))
            .once('close', onStreamClose.bind(this, stream));

        stream.destroyed = false;
        this.streams[file] = stream;

        if (stream.writable) {
            this.emit(event.WRITE_STREAM_START, stream);
            // If we have any queued data, write to stream now.
            // Emit the drain event because ResourceWriter#write
            // should behave like WriteStream#write.
            if (this._queuedData.hasOwnProperty(file)) {
                if (true === stream.write(this._queuedData[file])) {
                    delete this._queuedData[file];
                    this.emit(event.WRITE_STREAM_DRAIN, stream);
                }
            } else {
                this.emit(event.WRITE_STREAM_DRAIN, stream);
            }
        } else {
            this.destroyStream(file);
        }
    }

    /**
     * @private
     * @function
     * @this ResourceWriter
     * @param {string} file
     * @param {Error} exception
     * @returns {void}
     * @since 1.0
     */
    function onMkdirp(file, exception) {
        this.numOfMkdirps--;

        if (exception && (exception instanceof Error)) {
            this.emit(event.MKDIRP_ERROR, exception);
            // If we have any queued data, delete it
            if (this._queuedData.hasOwnProperty(file)) {
                delete this._queuedData[file];
            }
        } else {
            this.emit(event.MKDIRP_END, file);
            newStream.call(this, file);
        }

        if (this.mkdirpQueue.length) {
            this.mkdirpQueue.shiftApply();
        } else if (!this.totalAsync) {
            deferredEmitEnd.call(this);
        }
    }

    /**
     * @private
     * @function
     * @this ResourceWriter
     * @param {string} file
     * @returns {void}
     * @since 1.0
     */
    function newMkdirp(file) {
        if (this.numOfMkdirps >= this.maxNumOfMkdirps) {
            this.mkdirpQueue.push(arguments);
            return;
        }

        this.numOfMkdirps++;
        if (this.simulate) {
            onMkdirp.call(this, file);
        } else {
            mkdirp(path.dirname(file), onMkdirp.bind(this, file));
        }
    }

    /**
     * Object responsible for the multiple asynchronous processes of writing
     * many files, of various size, and to various directory level locations.
     * It wraps the functionality of the {@link mkdirp} module, and also
     * manages many instances of {@link fs.WriteStream}.
     * @name ResourceWriter
     * @augments module:events.EventEmitter
     * @constructor
     * @param {Function} [filterFilePath]
     * @param {Function} [filterFileData]
     *
     * @fires ResourceWriter.event.MKDIRP_END
     * @fires ResourceWriter.event.MKDIRP_ERROR
     * @fires ResourceWriter.event.WRITE_STREAM_START
     * @fires ResourceWriter.event.WRITE_STREAM_DRAIN
     * @fires ResourceWriter.event.WRITE_STREAM_ERROR
     * @fires ResourceWriter.event.WRITE_STREAM_CLOSE
     * @fires ResourceWriter.event.END
     * @since 1.0
     */
    function ResourceWriter(filterFilePath, filterFileData) {
        // callSuper
        Super.call(this);
        // Define instance Object references
        Object.defineProperties(this, /** @lends ResourceWriter# */ {
            /** @private */
            _timeout : {value : null, writable : true},
            /** @private */
            _pathsFiltered : {value : {}, writable : true},
            /** @private */
            _pathsUnfiltered : {value : {}, writable : true},
            /** @private */
            _queuedData : {value : {}, writable : true},
            /**
             * @type {Function}
             * @since 1.0
             */
            filterFilePath: {value: filterFilePath, writable: true},
            /**
             * @type {Function}
             * @since 1.0
             */
            filterFileData: {value: filterFileData, writable: true},
            /**
             * @readonly
             * @type {Queue}
             * @since 1.0
             */
            mkdirpQueue: {value: new Queue(newMkdirp, this)},
            /**
             * @readonly
             * @type {Queue}
             * @since 1.0
             */
            streamQueue: {value: new Queue(newStream, this)},
            /**
             * @readonly
             * @type {Object}
             * @since 1.0
             */
            streams: {value: {}}
        });
    }

    // Instance properties
    ResourceWriter.prototype = Object.create(Super.prototype, /** @lends ResourceWriter# */ {
        /** @ignore */
        constructor : {value : ResourceWriter},

        /**
         * @type {uint}
         * @default 8
         * @since 1.0
         */
        maxNumOfMkdirps : {value : 8},
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
        numOfMkdirps : {value : 0},
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
        simulate : {value : false},
        /**
         * @readonly
         * @type {uint}
         * @default 0
         * @since 1.0
         */
        totalAsync : {
            get : function getTotalAsync() {
                return this.numOfMkdirps +
                    this.numOfStreams +
                    this.mkdirpQueue.length +
                    this.streamQueue.length;
            }
        },

        /**
         * Prepare an instance of {@link fs.WriteSteam}, retrieved by
         * the file path it is writing to, to be removed from memory.
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

                    // If we have any queued data, delete it
                    if (this._queuedData.hasOwnProperty(file)) {
                        delete this._queuedData[file];
                    }

                    if (this.streamQueue.length) {
                        this.streamQueue.shiftApply();
                    } else if (!this.totalAsync) {
                        deferredEmitEnd.call(this);
                    }
                    stream.destroyed = true;
                    stream.removeAllListeners();
                    delete this.streams[file];
                }
            }
        },

        /**
         * Retrieve an instance of {@link fs.WriteSteam} by the file
         * path that it is currently writing to.
         * @method
         * @param {string} file
         * @returns {module:fs.WriteStream}
         * @since 1.0
         */
        getActiveStream : {
            value : function getActiveStream(file) {
                return this.streams.hasOwnProperty(file) ? this.streams[file] : null;
            }
        },

        /**
         * This is a helper method to retrieve an array of strings
         * that represent the files this instance has written.
         * @method
         * @param {string} relativeFrom
         * @returns {string}
         * @since 1.0
         */
        getFilesWritten : {
            value : function getFilesWritten(relativeFrom) {
                var arr = Object.keys(this._pathsUnfiltered).sort();
                return relativeFrom ? arr.map(path.relative.bind(path, relativeFrom)) : arr;
            }
        },

        /**
         * When using the {@link module:node-samson/lib/ResourceWriter#filterFilePath}
         * callback, this method is able to retrieve the filtered or new file path, by
         * passing its corresponding unfilered or original file path.
         * @method
         * @param {string} file
         * @returns {string}
         * @since 1.0
         */
        getFilteredPath : {
            value : function getFilteredPath(file) {
                var filtered;
                if (this._pathsFiltered.hasOwnProperty(file)) {
                    return this._pathsFiltered[file];
                } else if ('function' === typeof this.filterFilePath) {
                    filtered = this.filterFilePath.call(this, file);
                    // Save reference of unfiltered -> filtered
                    this._pathsFiltered[file] = filtered;
                    // Save reference of filtered -> unfiltered
                    this._pathsUnfiltered[filtered] = file;
                    return filtered;
                }
                this._pathsUnfiltered[file] = file;
                return file;
            }
        },

        /**
         * When using the {@link module:node-samson/lib/ResourceWriter#filterFilePath}
         * callback, this method is able to retrieve the unfiltered or original file
         * path, by its corresponding filered or new file path.
         * @method
         * @param {string} file
         * @returns {string}
         * @since 1.0
         */
        getUnfilteredPath : {
            value : function getUnfilteredPath(file) {
                if (this._pathsUnfiltered.hasOwnProperty(file)) {
                    return this._pathsUnfiltered[file];
                }
                return file;
            }
        },

        /**
         * Removes properties that may have been set after instantiation.
         * @method
         * @returns {ResourceWriter}
         * @since 1.0
         */
        reset : {
            value : function reset() {
                var i, l, keys, val;

                this._queuedData = {};
                this._pathsFiltered = {};
                this._pathsUnfiltered = {};
                // Clear read-only array and object properties
                this.mkdirpQueue.clear();
                this.streamQueue.clear();
                keys = Object.keys(this.streams);
                for (i = 0, l = keys.length; i < l; ++i) {
                    this.destroyStream(keys[i]);
                }
                return this;
            }
        },

        /**
         * This method behaves similarly to {@link fs.WriteStream#write} in that
         * it returns false if the stream failed to write and is waiting to drain.
         * But it also includes the extra steps of invoking {@link mkdirp} and stepping
         * through the filters of {@link module:node-samson/lib/ResourceWriter#filterFilePath}
         * and {@link module:node-samson/lib/ResourceWriter#filterFileData}. Since working
         * with streams objects happens internally within thismethod, each unique file path
         * argument represents a different instance of {@link fs.WriteStream}. This method
         * always expects the unfiltered file path, and internally maps to stream objects
         * that write to filtered file path locations.
         * @method
         * @param {string} file
         * @param {string} data
         * @returns {boolean}
         * @since 1.0
         */
        write : {
            value : function write(file, data) {
                var stream;

                file = this.getFilteredPath(file);
                stream = this.getActiveStream(file);

                if ('function' === typeof this.filterFileData) {
                    data = this.filterFileData.call(this, file, data);
                }

                if (stream) {
                    return stream.write(data);
                } else if (!this._queuedData.hasOwnProperty(file)) {
                    this._queuedData[file] = data;
                    newMkdirp.call(this, file);
                }
                return false;
            }
        }
    });

    // Module provides
    return Object.defineProperties(ResourceWriter, /** @lends ResourceWriter */ {
        event : {value : event}
    });

}(
    require('path'),
    require('fs'),
    require('events').EventEmitter,
    require('mkdirp'),
    require('./Queue')
));
