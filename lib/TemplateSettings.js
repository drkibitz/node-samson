/*global module, require, console*/
/**
 * Provides the class {@link TemplateSettings}.
 * @module node-samson/lib/TemplateSettings
 * @author <a href="mailto:drkibitz@gmail.com">Dr. Kibitz</a>
 * @license {@link http://www.opensource.org/licenses/MIT}
 * @requires dot
 * @since 1.0
 */
module.exports = (function (dot) {
    "use strict";

    /**
     * Contains the possible codes that may be returned by {@link TemplateSettings#validate}.
     * Note: {@link TemplateSettings.validationCode.INVALID} is currently not used,
     * but exists for a common value to be used under various unforeseen conditions.
     * @namespace
     * @memberOf TemplateSettings
     * @readonly
     * @since 1.0
     */
    var validationCode = Object.freeze(Object.create(null, /** @lends TemplateSettings.validationCode */ {
            /**
             * Data is not valid, and there is no appropriate code defined for the condition.
             * @constant
             * @type {int}
             * @default -1
             * @since 1.0
             */
            INVALID : {value : -1},
            /**
             * Data has not been validated. This is the code
             * {@link TemplateSettings#validationCode} is set to before
             * invoking {@link TemplateSettings#validate}, and after
             * invoking {@link TemplateSettings#reset}.
             * @constant
             * @type {int}
             * @default 0
             * @since 1.0
             */
            UNVALIDATED : {value : 0},
            /**
             * Data passed validation.
             * @constant
             * @type {int}
             * @default 1
             * @since 1.0
             */
            VALID : {value : 1},
            /**
             * Data contains a broken conditional tag pair.
             * @constant
             * @type {int}
             * @default 2
             * @since 1.0
             */
            BROKEN_CONDITIONAL : {value : 2},
            /**
             * Data contains a broken conditional tag pair.
             * @constant
             * @type {int}
             * @default 2
             * @since 1.0
             */
            BROKEN_ITERATE : {value : 3},
            /**
             * Data contains a broken tag at the end of the string.
             * @constant
             * @type {int}
             * @default 3
             * @since 1.0
             */
            BROKEN_TAG : {value : 4},
            /**
             * Data contains a tag that may or may not be a broken tag at the end of the string.
             * @constant
             * @type {int}
             * @default 4
             * @since 1.0
             */
            POSSIBLE_BROKEN_TAG : {value : 5}
        })),
        /**
         * Create a copy of RegExp sources that come with {@link module:dot.templateSettings}.
         * As of today, these are the defaults from {@link module:dot.templateSettings}:
         *    evaluate:    /\{\{([\s\S]+?)\}\}/g
         *    interpolate: /\{\{=([\s\S]+?)\}\}/g
         *    encode:      /\{\{!([\s\S]+?)\}\}/g
         *    use:         /\{\{#([\s\S]+?)\}\}/g
         *    define:      /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g
         *    conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g
         *    iterate:     /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g
         *
         * @private
         * @since 1.0
         */
        dotProps = {sources : {}};

    /**
     * @private
     * @function
     * @param {string} str
     * @returns {string} Escapsed string ready for RegExp
     * @since 1.0
     */
    function xEsc(str) {
        return 'string' === typeof str ? str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") : '';
    }

    /**
     * @private
     * @function
     * @param {Object} target Object where properties will be set
     * @param {string} tagStart Unescaped string to replace the default tagStart
     * @param {string} tagEnd Unescaped string to replace the default tagEnd
     * returns RegExp
     * @since 1.0
     */
    function defineRegexDelimiters(target, tagStart, tagEnd) {
        tagStart = xEsc(tagStart);
        tagEnd = xEsc(tagEnd);
        // First mixin all known RegExp sources
        Object.keys(dotProps.sources).forEach(function (name) {
            var source = dotProps.sources[name]
                .replace(dotProps.tagStartReplace, tagStart)
                .replace(dotProps.tagEndReplace, tagEnd);
            target[name] = new RegExp(source, 'g');
        });
        // Special RegExp
        target.brokenTag = new RegExp(tagStart + '((?!' + tagEnd + ').)*$', 'g');
    }

    // Mixin module:dot.templateSettings RegExp sources
    Object.keys(dot.templateSettings).forEach(function (name) {
        if (this[name] instanceof RegExp) {
            dotProps.sources[name] = this[name].source;
        }
    }, dot.templateSettings);

    // Set the replacement RegExp objects
    dotProps.tagStartReplace = new RegExp(xEsc(xEsc('{{')), 'g');
    dotProps.tagEndReplace = new RegExp(xEsc(xEsc('}}')), 'g');

    /**
     * Object that contains settings that are meant to be sent
     * to the {@link module:dot.template} method. On instantiation, RegExp objects
     * are created that are specific to its own {@link TemplateSettings#tagStart}
     * and {@link TemplateSettings#tagEnd} properties.
     *
     * @constructor
     * @param {string} tagStart Value to set {@link TemplateSettings#tagStart} property.
     * @param {string} tagEnd Value to set {@link TemplateSettings#tagEnd} property.
     *
     * @name TemplateSettings
     * @property {RegExp} evaluate Created from {@link module:dot.templateSettings.evaluate}
     * @property {RegExp} interpolate Created from {@link module:dot.templateSettings.interpolate}
     * @property {RegExp} encode Created from {@link module:dot.templateSettings.encode}
     * @property {RegExp} use Created from {@link module:dot.templateSettings.use}
     * @property {RegExp} define Created from {@link module:dot.templateSettings.define}
     * @property {RegExp} conditional Created from {@link module:dot.templateSettings.conditional}
     * @property {RegExp} iterate Created from {@link module:dot.templateSettings.iterate}
     * @property {RegExp} brokenTag Not specfied in {@link module:dot.templateSettings}
     * because it is not a complete tag (hence the name... `brokenTag`).
     * @since 1.0
     */
    function TemplateSettings(tagStart, tagEnd) {
        // Enum
        defineRegexDelimiters(this, tagStart, tagEnd);
        // Not Enum
        Object.defineProperties(this, /** @lends TemplateSettings# */ {
            /**
             * <p>This function is invoked when accessing the {@link TemplateSettings#varname} property.</p>
             * <pre>
             *     console.log(settings.varname) // Outputs 'it'
             *     settings.filterVarname = function (varname) { return 'newvarname'; };
             *     console.log(settings.varname) // Outputs 'newvarname'
             * </pre>
             * @type {Function}
             * @default null
             * @since 1.0
             */
            filterVarname : {value : null, writable : true},
            /**
             * The previous matches returned when validating conditionals in {@link TemplateSettings#validate}.
             * @type {Array}
             * @default null
             * @since 1.0
             */
            previousMatches : {value : null, writable : true},
            /**
             * The beginning of the template tag which RegExp objects in this instance are created for.
             * @readonly
             * @type {string}
             * @since 1.0
             */
            tagStart : {value : tagStart},
            /**
             * The end of the template tag which RegExp objects in this instance are created for.
             * @readonly
             * @type {string}
             * @since 1.0
             */
            tagEnd : {value : tagEnd}
        });
    }

    // Instance properties
    TemplateSettings.prototype = Object.freeze(Object.create(dot.templateSettings, /** @lends TemplateSettings# */ {
        /** @ignore */
        constructor : {value : TemplateSettings},

        /**
         * Passed directly to {@link module:dot.template} method.
         * @type {boolean}
         * @default false
         * @since 1.0
         */
        strip : {value : false},
        /**
         * Passed directly to {@link module:dot.template} method. Accessing this
         * property may invoke the optional callback {@link TemplateSettings#filterVarname}.
         * @readonly
         * @type {string}
         * @default {@link TemplateSettings#varnameFiltered}
         * @since 1.0
         */
        varname : {
            get : function getVarname() {
                if ('function' === typeof this.filterVarname) {
                    this.varnameFiltered = this.filterVarname.call(this, this.varnameFiltered);
                } else if (this.hasOwnProperty('varnameFiltered')) {
                    delete this.varnameFiltered;
                }
                return this.varnameFiltered;
            }
        },
        /**
         * Cached value that is set after accessing the property {@link TemplateSettings#varname},
         * and the callback {@link TemplateSettings#filterVarname} is set.
         * @type {string|Array.<string>}
         * @default "it"
         * @since 1.0
         */
        varnameFiltered : {value : 'it'},
        /**
         * The last code returned by {@link TemplateSettings#validate}.
         * @type {int}
         * @default {@link TemplateSettings.validationCode.UNVALIDATED}
         * @since 1.0
         */
        validationCode : {value : validationCode.UNVALIDATED},

        /**
         * Removes all instance properties.
         * @method
         * @returns {void}
         * @since 1.0
         */
        destroy : {
            value : function destroy() {
                this.reset();
                // kill the rest of the enumerables
                var i, l, keys = Object.keys(this);
                for (i = 0, l = keys.length; i < l; ++i) {
                    delete this[keys[i]];
                }
            }
        },

        /**
         * @method
         * @param {string} data Any data that is meant to be run through {@link module:dot.template}
         * @returns {int} The current value of {@link TemplateSettings#validationCode}
         * @since 1.0
         */
        validate : {
            value : function validate(data) {
                var tagStart, tagEnd, len, total, index, broken, diff;

                tagStart = this.tagStart;
                tagEnd = this.tagEnd;
                len = data.length;

                // Make sure we are working with a string
                if (data && 'string' !== typeof data.valueOf()) {
                    data = data.toString();
                }

                if (len > tagStart.length) {
                    // Check for a broken conditional.
                    // First match all conditionals, start and end.
                    // Saving these matches in case we want to use them later.
                    this.previousMatches = data.match(this.conditional);
                    total = this.previousMatches ? this.previousMatches.length : 0;
                    // If the value of total matches is odd, there is something broke.
                    if (!!(total & 1)) {
                        this.validationCode = validationCode.BROKEN_CONDITIONAL;
                        return this.validationCode;
                    }

                    // Check for a broken iterate.
                    // First match all iterates, start and end.
                    // Saving these matches in case we want to use them later.
                    this.previousMatches = data.match(this.iterate);
                    total = this.previousMatches ? this.previousMatches.length : 0;
                    // If the value of total matches is odd, there is something broke.
                    if (!!(total & 1)) {
                        this.validationCode = validationCode.BROKEN_ITERATE;
                        return this.validationCode;
                    }

                    // Check for a broken end tag.
                    // Should match last tagStart if does not have a corresponding tagEnd.
                    if (data.match(this.brokenTag)) {
                        this.validationCode = validationCode.BROKEN_TAG;
                        return this.validationCode;
                    }

                    // Check for possible broken end tag.
                    // This should be small enough that it doesn't care if
                    // it's an actual broken tag or not, just being super safe.
                    index = data.lastIndexOf(tagStart.charAt(0));
                    diff = len - index;
                    // First check if our difference, which is the length of data,
                    // minus the index of the last occurrence of the first character
                    // of the tagStart, is actually less than the length of tagStart.
                    // Then make sure the index comes after the last endTag occurrence.
                    broken = index !== -1 &&
                        diff < tagStart.length &&
                        index > data.lastIndexOf(tagEnd) + tagEnd.length;
                    // Now loop through the rest to see if characters continue to be
                    // a possible value of tagStart. The loop breaks when this is false.
                    // Check data length otherwise charAt may result in a false positive.
                    while (broken && index < len) {
                        broken = data.charAt(index) === tagStart.charAt(diff - (len - index));
                        index++;
                    }
                    if (broken) {
                        this.validationCode = validationCode.POSSIBLE_BROKEN_TAG;
                        return this.validationCode;
                    }
                }

                // All checks passed
                this.validationCode = validationCode.VALID;
                return this.validationCode;
            }
        },

        /**
         * Removes properties that may have been set after instantiation.
         * @method
         * @returns {TemplateSettings} this
         * @since 1.0
         */
        reset : {
            value : function reset() {
                delete this.varnameFiltered;
                delete this.validationCode;
                this.filterVarname = this.previousMatches = null;
                return this;
            }
        }
    }));

    // Module provides
    return Object.freeze(Object.defineProperties(TemplateSettings, /** @lends TemplateSettings */ {
        validationCode : {value : validationCode}
    }));

}(
    require('dot')
));
