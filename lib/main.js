/*global module, require, console*/
/**
 * @module path
 * @ignore
 */
/**
 * @module events
 * @ignore
 */
/**
 * @name module:events.EventEmitter
 * @class
 * @ignore
 */
/**
 * @module fs
 * @ignore
 */
/**
 * @name module:fs.ReadStream
 * @class
 * @ignore
 */
/**
 * @name module:fs.WriteStream
 * @class
 * @ignore
 */
/**
 * @module dot
 * @ignore
 */
/**
 * @module glob
 * @ignore
 */
/**
 * @name module:glob.Glob
 * @class
 * @ignore
 */
/**
 * @module mime-magic
 * @ignore
 */
/**
 * @module mkdirp
 * @ignore
 */
/**
 * @module mimeparse
 * @ignore
 */

/**
 * Main module of node-samson package, and is an instance of {@link Samson}.
 * @module node-samson/lib/main
 * @author <a href="mailto:drkibitz@gmail.com">Dr. Kibitz</a>
 * @license {@link http://www.opensource.org/licenses/MIT}
 * @requires node-samson/lib/Samson
 * @since 1.0
 */
module.exports = (function (Samson) {

    /**
     * @readonly
     * @name module:node-samson/lib/main.Samson
     * @type {Function}
     * @default {@link Samson}
     * @since 1.0
     */

    // Module provides
    return Object.defineProperty(new Samson(), 'Samson', {value : Samson});

}(
    require('./Samson')
));
