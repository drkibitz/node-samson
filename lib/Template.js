/*global module, require, console*/
/**
 * Provides the class {@link Template}.
 * @module node-samson/lib/Template
 * @author <a href="mailto:drkibitz@gmail.com">Dr. Kibitz</a>
 * @license {@link http://www.opensource.org/licenses/MIT}
 * @requires dot
 * @requires node-samson/lib/TemplateSettings
 * @since 1.0
 */
module.exports = (function (dot, TemplateSettings) {
    "use strict";

    /**
     * Contains instances of {@link TemplateSettings} that correspond to
     * their type. The type is represented by each object's key.
     * @readonly
     * @memberof Template
     * @namespace
     * @since 1.0
     */
    var settingsByType = /** @lends Template.settingsByType */ {
            /**
             * Settings meant for the most common of comment formats.
             * The default type of all intances of {@link Template}.
             * @type {TemplateSettings}
             * @default new TemplateSettings('#{', '}#')
             * @since 1.0
             */
            txt : new TemplateSettings('#{', '}#'),
            /**
             * Settings specific for the HTML multiline comment format.
             * @type {TemplateSettings}
             * @default new TemplateSettings('<!--{', '}-->')
             * @since 1.0
             */
            html : new TemplateSettings('<!--{', '}-->'),
            /**
             * Settings specific for the JavaScript multiline comment format.
             * Uses some arbitrary escaping so this file may also be processed.
             * @type {TemplateSettings}
             * @default new TemplateSettings('/\u002A{', '}\u002A/')
             * @since 1.0
             */
            js : new TemplateSettings('/\u002A{', '}\u002A/')
        };

    /**
     * Settings specific for the CSS multiline comment format.
     * This is simply a reference to {@link Template.settingsByType.js}.
     * @name Template.settingsByType.css
     * @type {TemplateSettings}
     * @since 1.0
     */
    /**
     * Settings specific for the PHP multiline comment format.
     * This is simply a reference to {@link Template.settingsByType.js}.
     * @name Template.settingsByType.php
     * @type {TemplateSettings}
     * @since 1.0
     */
    settingsByType.css = settingsByType.php = settingsByType.js;

    /**
     * @private
     * @function
     * @this Template
     * @returns {Array}
     * @since 1.0
     */
    function filterVarname() {
        var arr = Object.keys(this.def).concat(Object.keys(this.vars)),
            i, l, obj = {};
        for (i = 0, l = arr.length; i < l; ++i) {
            obj[arr[i]] = arr[i];
        }
        return Object.keys(obj);
    }

    /**
     * Object that wraps and abstracts the functionality of {@link module:dot}.
     * It is meant to provide an enclosure for defines and vars so that they may persist
     * and may be passed to the multiple functions returned by {@link module:dot.template}.
     * Each property key of {@link Template#def} is also passed to these template functions
     * to provide both compile time and run time access. The members of {@link Template#vars}
     * also persist and are passed to the template function in the same way, but are not
     * accessed the same way as {@link Template#def} in compile time. Every instance of
     * this class is linked to a singleton {@link TemplateSettings} object. This link
     * is made by the type string specified by {@link Template#type}.
     *
     * @name Template
     * @constructor
     * @param {string} [type] Value to set {@link Template#type} property.
     * @param {Object} [def] Value to set {@link Template#def} property.
     * @param {Object} [vars] Value to set {@link Template#vars} property.
     * @since 1.0
     */
    function Template(type, def, vars) {
        // Not Enum
        Object.defineProperties(this, /** @lends Template# */ {
            /**
             * Namespace to hold all defines when compiling data with this template.
             * @type {Object}
             * @default new Object()
             * @since 1.0
             */
            def : {
                value : 'object' === typeof def ? def : {},
                writable : true
            },
            /**
             * Namespace to hold additional vars to be passed to the runtime runtime.
             * These are in addition to, but will not override any defines set with the same name.
             * @type {Object}
             * @default new Object()
             * @since 1.0
             */
            vars : {
                value : 'object' === typeof vars ? vars : {},
                writable : true
            }
        });
        // Invoke setter
        this.type = type;
    }

    // Instance properties
    Object.freeze(Object.defineProperties(Template.prototype, /** @lends Template# */ {
        /** @private */
        _type : {value : 'txt'},
        /**
         * The value of the {@link TemplateSettings#validateCode} property
         * of this instance's {@link Template#settings} object, which is set before
         * invoking {@link Template#apply}.
         * @type {int}
         * @default null
         * @since 1.0
         */
        previousValidationCode : {value : null},
        /**
         * The settings object associated to this object by {@link Template#type}.
         * These settings are a member and retrieved from {@link Template.settingsByType}.
         * @readonly
         * @type {TemplateSettings}
         * @default {@link Template.settingsByType.txt}
         * @since 1.0
         */
        settings : {
            get : function getSettings() {
                return settingsByType[this._type];
            }
        },
        /**
         * The type string passed to this instance's constructor.
         * This value must exist as a key in {@link Template.settingsByType}.
         * @type {string}
         * @default "txt"
         * @since 1.0
         */
        type : {
            get : function getType() {
                return this._type;
            },
            set : function setType(type) {
                if (
                    type &&
                    type !== this._type &&
                    settingsByType.hasOwnProperty(type)
                ) {
                    this._type = type;
                } else if (this.hasOwnProperty('_type')) {
                    delete this._type;
                }
            }
        },

        /**
         * Wrapper around the function returned by {@link module:dot.template}.
         * @method
         * @param {string} data
         * @param {Object} [vars] Value to set {@link Template#vars} property.
         * @param {Object} [thisObj] Object to call function returned by {@link module:dot.template}
         * @returns {string} The data ran through the template.
         * @since 1.0
         */
        apply : {
            value : function apply(data, vars, thisObj) {
                var i, l, settings = this.settings, vals, fn;

                if ('object' === typeof vars) {
                    this.vars = vars;
                }

                // Compile it!!!
                this.previousValidationCode = this.settings.validationCode;
                settings.filterVarname = filterVarname.bind(this);
                fn = dot.template(data, settings, this.def);

                // Grab the values that may have been defined during compile time.
                vals = settings.varnameFiltered.slice(0) || [];
                for (i = 0, l = vals.length; i < l; ++i) {
                    // Using def values before vars values is intentional.
                    // These are treated as constants, vars should not override.
                    vals[i] = this.def[vals[i]] || this.vars[vals[i]];
                }

                // Reset the settings for next time around.
                settings.reset();

                // Apply it!!!
                return fn.apply(thisObj || this, vals);
            }
        },

        /**
         * Removes all instance properties.
         * @method
         * @returns {void}
         * @since 1.0
         */
        destroy : {
            value : function destroy() {
                // kill enumerables
                var i, l, keys = Object.keys(this);
                for (i = 0, l = keys.length; i < l; ++i) {
                    delete this[keys[i]];
                }
                // kill non-enumerables
                this.def = this.vars = null;
            }
        }
    }));

    // Module provides
    return Object.freeze(Object.defineProperties(Template, /** @lends Template */ {
        settingsByType : {value : settingsByType}
    }));

}(
    require('dot'),
    require('./TemplateSettings')
));
