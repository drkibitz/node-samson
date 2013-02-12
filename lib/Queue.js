/*global module, require, console*/
/**
 * Provides the class {@link Queue}.
 * @module node-samson/lib/Queue
 * @author <a href="mailto:drkibitz@gmail.com">Dr. Kibitz</a>
 * @license {@link http://www.opensource.org/licenses/MIT}
 * @since 1.0
 */
module.exports = (function () {
    "use strict";

    /**
     * @name Array
     * @class
     * @ignore
     */
    /**
     * This is a simple object that represents a callback and an array
     * of argument groups that will be passed to it at a later time.
     * @constructor
     * @augments Array
     * @param {Function} callback
     * @param {Object} [thisObj]
     *
     * @name Queue
     * @since 1.0
     */
    function Queue(callback, thisObj) {
        // Not Enum
        Object.defineProperties(this, /** @lends Queue# */ {
            /**
             * Callback that items will be applied to.
             * @type {Function}
             * @since 1.0
             */
            callback : {value : callback, writable : true},
            /**
             * Context that the callback will be applied to.
             * @type {Object}
             * @since 1.0
             */
            thisObj : {value : thisObj, writable : true}
        });
    }

    // Instance properties
    Queue.prototype = Object.create([], /** @lends Queue# */ {
        /** @ignore */
        constructor : {value : Queue},

        /**
         * Removes all instance properties.
         * @method
         * @returns {Array}
         * @since 1.0
         */
        destroy : {
            value : function destroy() {
                this.clear();
                this.callback = this.thisObj = null;
            }
        },

        /**
         * @method
         * @param {Object} thisObj
         * @returns {mixed|null} The return of {@link Queue#callback}
         * @since 1.0
         */
        popApply : {
            value : function popApply(thisObj) {
                if (this.length) {
                    return this.callback.apply(thisObj || this.thisObj || this, this.pop());
                }
                return null;
            }
        },

        /**
         * @method
         * @param {Object} thisObj
         * @returns {mixed|null} The return of {@link Queue#callback}
         * @since 1.0
         */
        shiftApply : {
            value : function shiftApply(thisObj) {
                if (this.length) {
                    return this.callback.apply(thisObj || this.thisObj || this, this.shift());
                }
                return null;
            }
        },

        /**
         * @method
         * @param {int} index
         * @param {uint} howMany
         * @param {Object} thisObj
         * @returns {Array|null} All the results of {@link Queue#callback}
         * @since 1.0
         */
        spliceApply : {
            value : function spliceApply(index, howMany, thisObj) {
                var arr = null, i, reverse;
                if (this.length) {
                    reverse = index < 0;
                    arr = reverse ? this.splice(index) : this.splice(index, howMany);
                    howMany = arr.length;
                    i = reverse ? howMany : 0;
                    while (reverse ? i-- : (i < howMany)) {
                        arr[i] = this.callback.apply(thisObj || this.thisObj || this, arr[i]);
                        if (!reverse) {
                            i++;
                        }
                    }
                }
                return arr;
            }
        },

        /**
         * Removes all items from the queue.
         * @method
         * @returns {Array}
         * @since 1.0
         */
        clear : {
            value : function clear() {
                return this.splice(-this.length);
            }
        }
    });

    // Module provides
    return Queue;
}());
