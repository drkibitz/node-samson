/*global module, require, console*/
/**
 * Provides the class {@link ResourceProcessor}.
 * @module node-samson/lib/ResourceProcessor
 * @author <a href="mailto:drkibitz@gmail.com">Dr. Kibitz</a>
 * @license {@link http://www.opensource.org/licenses/MIT}
 * @requires path
 * @requires fs
 * @requires mimeparse
 * @requires node-samson/lib/TemplateSettings
 * @requires node-samson/lib/Template
 * @since 1.0
 */
module.exports = (function (path, fs, mimeparse, TemplateSettings, Template) {
    "use strict";

    /**
     * @private
     * @function
     * @this ResourceProcessor
     * @param {string} mimeType
     * @param {string} file
     * @param {string} data
     * @since 1.0
     */
    function prepareData(mimeType, file, data) {
        var index,
            tpl = this.tpls[file],
            tagStart = tpl.settings.tagStart;

        // If we don't match the mimeType then we skip processing
        if (!mimeparse.bestMatch(ResourceProcessor.mimePatterns, mimeType)) {
            tpl.previousValidationCode = tpl.settings.validationCode = TemplateSettings.validationCode.INVALID;
            return data;
        }

        // Make sure we have an array in the queue
        if (!this._queuedData.hasOwnProperty(file)) {
            this._queuedData[file] = [];
        // If we do, get everything out of the queue
        // and prepend it onto the current chunk.
        } else if (this._queuedData[file].length) {
            data = this._queuedData[file]
                .splice(0, this._queuedData[file].length)
                .join('') + data;
        }

        data = data.toString();

        switch(tpl.settings.validate(data)) {
        case TemplateSettings.validationCode.BROKEN_CONDITIONAL:
            //console.log('TemplateSettings.validationCode.BROKEN_CONDITIONAL');
            index = data.lastIndexOf(tpl.settings.previousMatches[tpl.settings.previousMatches.length - 1]);
            break;
        case TemplateSettings.validationCode.BROKEN_TAG:
            //console.log('TemplateSettings.validationCode.BROKEN_TAG');
            index = data.lastIndexOf(tagStart);
            break;
        case TemplateSettings.validationCode.POSSIBLE_BROKEN_TAG:
            //console.log('TemplateSettings.validationCode.POSSIBLE_BROKEN_TAG');
            index = data.lastIndexOf(tagStart.charAt(0));
            break;
        case TemplateSettings.validationCode.VALID:
            //console.log('TemplateSettings.validationCode.VALID');
            return data;
        }
        // Queue the broken data, and return what is ok.
        this._queuedData[file].push(data.substr(index));
        return data.substr(0, index);
    }

    /**
     * Object responsible for the multiple instances of
     * {@link node-samson/lib/Template}. It is also responsible for validating
     * data before processing it through a template. It is a failsafe to be
     * to read and process chunks of a large file through the same template
     * separately without fear of missing strings that should be processed.
     * @name ResourceProcessor
     * @constructor
     * @since 1.0
     */
    function ResourceProcessor() {
        // Define instance Object references
        Object.defineProperties(this, /** @lends ResourceProcessor# */ {
            /**
             * @private
             */
            _queuedData : {value : {}, writable : true},
            /**
             * @type {Date}
             * @default new Date()
             * @since 1.0
             */
            date : {value : new Date(), writable : true},
            /**
             * @readonly
             * @type {Object}
             * @default new Object()
             * @since 1.0
             */
            tpls : {value : {}}
        });
    }

    /**
     * @private
     */
    Object.freeze(Object.defineProperties(ResourceProcessor.prototype, /** @lends ResourceProcessor# */ {
        /**
         * @type {uint}
         * @default 0
         * @since 1.0
         */
        currentFileIndex : {value : 0},

        /**
         * @method
         * @param {string} mimeType
         * @param {string} file
         * @param {string} data
         * @param {Object} [def] mixin {@link ResourceProcessor.def}
         * @param {Object} [vars] Sets {@link Template#vars} if provided
         * @returns {string}
         * @since 1.0
         */
        apply : {
            value : function apply(mimeType, file, data, def, vars) {
                var i, l, keys, descriptor,
                    tpl = this.getActiveTpl(file);

                if (null === tpl) {
                    // def property descriptor
                    descriptor = /** @lends ResourceProcessor.def */ {
                        /**
                         * @readonly
                         * @type {Date}
                         * @default {@link ResourceProcessor#date}
                         * @since 1.0
                         */
                        'DATE' : {value : this.date, enumerable : true},
                        /**
                         * The elapsed time in milliseconds from {@link ResourceProcessor#date}
                         * @readonly
                         * @type {uint}
                         * @since 1.0
                         */
                        'ELAPSED' : {
                            get : function ELAPSED() {
                                return Date.now() - this.DATE.valueOf();
                            },
                            enumerable : true
                        },
                        /**
                         * @readonly
                         * @type {string}
                         * @since 1.0
                         */
                        'MIMETYPE' :  {value : mimeType, enumerable : true},
                        /**
                         * @readonly
                         * @type {string}
                         * @since 1.0
                         */
                        'FILE' :      {value : file, enumerable : true},
                        /**
                         * @readonly
                         * @type {uint}
                         * @since 1.0
                         */
                        'INDEX' :     {value : this.currentFileIndex++, enumerable : true},
                        /**
                         * @readonly
                         * @type {uint}
                         * @default {@link ResourceProcessor#date} in milliseconds
                         * @since 1.0
                         */
                        'TIMESTAMP' : {value : this.date.valueOf(), enumerable : true},
                        /**
                         * @readonly
                         * @type {string}
                         * @since 1.0
                         */
                        'BASENAME' :  {value : path.basename(file), enumerable : true},
                        /**
                         * @readonly
                         * @type {string}
                         * @since 1.0
                         */
                        'DIRNAME' :   {value : path.dirname(file), enumerable : true}
                    };
                    // Mixin def object to the descriptor
                    if (def) {
                        keys = Object.keys(def);
                        for (i = 0, l = keys.length; i < l; ++i) {
                            descriptor[keys[i]] = {value : def[keys[i]], enumerable : true};
                        }
                    }
                    // Now create a new Template with a def using descriptor
                    tpl = this.tpls[file] = new Template(
                        path.extname(file).substr(1),
                        Object.create(ResourceProcessor.def, descriptor)
                    );
                }

                data = prepareData.call(this, mimeType, file, data);

                // Apply the template if validationCode tells us it is able.
                if (tpl.settings.validationCode !== TemplateSettings.validationCode.INVALID) {
                    // [todo] Figure out a controlled way to handle these errors.
                    try {
                        data = tpl.apply(data, vars);
                    } catch (err) {
                        // console.log('--------------------------', file, tpl.settings.validationCode);
                        // console.log(this._queuedData[file]);
                        // console.log('--------------------------');
                        // console.log(data.substr(data.length - 500));
                        // console.log('--------------------------', file, tpl.settings.validationCode);
                        throw err;
                    }
                }
                // Return the data as is.
                return data;
            }
        },

        /**
         * @method
         * @param {string} file
         * @returns {void}
         * @since 1.0
         */
        destroyTpl : {
            value : function destroyTpl(file) {
                var tpl = this.getActiveTpl(file);

                if (tpl) {
                    tpl.destroy();
                    delete this.tpls[file];
                }
            }
        },

        /**
         * @method
         * @param {string} file
         * @returns {Template}
         * @since 1.0
         */
        getActiveTpl : {
            value : function getActiveTpl(file) {
                return this.tpls.hasOwnProperty(file) ? this.tpls[file] : null;
            }
        },

        /**
         * Removes properties that may have been set after instantiation.
         * @method
         * @returns {ResourceProcessor}
         * @since 1.0
         */
        reset : {
            value : function reset() {
                var i, l, keys;

                delete this.currentFileIndex;

                // Clear read-only array and object properties
                keys = Object.keys(this.tpls);
                for (i = 0, l = keys.length; i < l; ++i) {
                    this.destroyTpl(keys[i]);
                }
                return this;
            }
        }
    }));

    // Module provides
    return Object.freeze(Object.defineProperties(ResourceProcessor, /** @lends ResourceProcessor */ {
        /**
         * @namespace
         * @readonly
         * @since 1.0
         */
        def : {
            value : Object.create(null, /** @lends ResourceProcessor.def */ {
                /**
                 * @readonly
                 * @type {Object}
                 * @default new Object()
                 * @since 1.0
                 */
                'partials' : {value : {}},

                /**
                 * Reads the file at provided path.
                 * Relative paths are resolved with {@link ResourceProcessor.def.resolve}.
                 * @method
                 * @param {string} file
                 * @returns {string}
                 * @since 1.0
                 */
                'partial' : {
                    value : function partial(file) {
                        if (!this.partials.hasOwnProperty(file)) {
                            //this.partials[file] = fs.readFileSync(this.resolve(file));
                        }
                        return this.partials[file];
                    }
                },

                /**
                 * Returns a resolved path.
                 * Relative paths are resolved from from {@link ResourceProcessor.def.DIRNAME}.
                 * @method
                 * @param {string} pathname
                 * @returns {string}
                 * @since 1.0
                 */
                'resolve' : {
                    value : function resolve(pathname) {
                        return path.resolve(this.DIRNAME, pathname);
                    }
                }
            })
        },
        /**
         * @readonly
         * @type {Array.<string>}
         * @since 1.0
         */
        mimePatterns : {
            value : [
                'text/*',
                '*/json',
                '*/javascript',
                '*/word',
                '*/xml'
            ]
        }
    }));
}(
    require('path'),
    require('fs'),
    require('mimeparse'),
    require('./TemplateSettings'),
    require('./Template')
));
