/*global module*/
/**
 * Centralized module where all event types for samson are defined.
 * It is also provided as a namespace {@link Samson.event}.
 * @module node-samson/lib/event
 * @author <a href="mailto:drkibitz@gmail.com">Dr. Kibitz</a>
 * @license {@link http://www.opensource.org/licenses/MIT}
 * @since 1.0
 */
module.exports = {
    /**
     * @event
     * @default "readerGlobEnd"
     * @since 1.0
     */
    READER_GLOB_END : 'readerGlobEnd',
    /**
     * @event
     * @default "readerMimeMagicError"
     * @since 1.0
     */
    READER_MIME_MAGIC_END : 'readerMimeMagicEnd',
    /**
     * @event
     * @default "readerStreamStart"
     * @since 1.0
     */
    READER_STREAM_START : 'readerStreamStart',
    /**
     * @event
     * @default "readerStreamData"
     * @since 1.0
     */
    READER_STREAM_DATA : 'readerStreamData',
    /**
     * @event
     * @default "readerStreamEnd"
     * @since 1.0
     */
    READER_STREAM_END : 'readerStreamEnd',
    /**
     * @event
     * @default "readerStreamError"
     * @since 1.0
     */
    READER_STREAM_ERROR : 'readerStreamError',
    /**
     * @event
     * @default "readerStreamClose"
     * @since 1.0
     */
    READER_STREAM_CLOSE : 'readerStreamClose',
    /**
     * @event
     * @default "readerEnd"
     * @since 1.0
     */
    READER_END : 'readerEnd',
    /**
     * @event
     * @default "writerMkdirpEnd"
     * @since 1.0
     */
    WRITER_MKDIRP_END : 'writerMkdirpEnd',
    /**
     * @event
     * @default "writerStreamStart"
     * @since 1.0
     */
    WRITER_STREAM_START : 'writerStreamStart',
    /**
     * @event
     * @default "writerStreamDrain"
     * @since 1.0
     */
    WRITER_STREAM_DRAIN : 'writerStreamDrain',
    /**
     * @event
     * @default "writerStreamError"
     * @since 1.0
     */
    WRITER_STREAM_ERROR : 'writerStreamError',
    /**
     * @event
     * @default "writerStreamClose"
     * @since 1.0
     */
    WRITER_STREAM_CLOSE : 'writerStreamClose',
    /**
     * @event
     * @default "writerEnd"
     * @since 1.0
     */
    WRITER_END : 'writerEnd',
    /**
     * @event
     * @default "end"
     * @since 1.0
     */
    END : 'end',
    /**
     * @event
     * @default "error"
     * @since 1.0
     */
    ERROR : 'error',
    /**
     * @event
     * @default "reset"
     * @since 1.0
     */
    RESET : 'reset',
    /**
     * @event
     * @default "write"
     * @since 1.0
     */
    WRITE : 'write'
};
