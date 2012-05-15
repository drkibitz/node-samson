/*global define, Array*/

/**
 * Copyright 2012 Dr. Kibitz, all rights reserved
 * @author Dr. Kibitz <drkibitz@gmail.com>
 * @url http://drkibitz.github.com/qijs/
 */

/**
 * @name testing
 * @namespace
 */
define('testing', function () {
    /*jslint plusplus: true, nomen: true, bitwise: true */
    "use strict";

    /**
     * @private
     * @namespace
     */
    var testing = {};

    /*{build{?argv.RELEASE == 'debug'}}*/
    array.debug = function () {
        return "OK";
    };
    /*{build{?}}*/

    // Module provides
    return testing;
});