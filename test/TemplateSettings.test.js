#!/usr/bin/env node

var vows = require('vows'),
    assert = require('assert'),
    path = require('path'),
    basename = path.basename(__filename),
    TemplateSettings = require('../lib/TemplateSettings');

/**
 * @private
 */
function assertTopicPropertyContext(value, toString) {
    value = toString ? value.toString() : value;
    var context = {
        topic: function (topic) {
            return topic[this.context.name];
        }
    }
    context["is " + value] = function (topic) {
        assert.strictEqual(toString ? topic.toString() : topic, value);
    };
    return context;
}

/**
 * @private
 */
function assertValidationTypeContext(type) {
    var context = {
        topic: function (settings) {
            return settings.validate(this.context.name);
        }
    };
    context["is " + type] = function (code) {
        assert.strictEqual(code, TemplateSettings.validationCode[type]);
    };
    return context;
}

/**
 * Test suite
 */
vows.describe(basename).addBatch({
    "settings": {
        topic: new TemplateSettings('{tag{', '}tag}'),
        "instanceof TemplateSettings": function (settings) {
            assert.strictEqual(settings instanceof TemplateSettings, true);
        },
        "property": {
            // proto
            "append":
                assertTopicPropertyContext(true),
            "strip":
                assertTopicPropertyContext(false),
            "varname":
                assertTopicPropertyContext('it'),
            "varnameFiltered":
                assertTopicPropertyContext('it'),
            // instance
            "tagStart":
                assertTopicPropertyContext('{tag{'),
            "tagEnd":
                assertTopicPropertyContext('}tag}'),
            "evaluate":
                assertTopicPropertyContext(/\{tag\{([\s\S]+?)\}tag\}/g, true),
            "interpolate":
                assertTopicPropertyContext(/\{tag\{=([\s\S]+?)\}tag\}/g, true),
            "encode":
                assertTopicPropertyContext(/\{tag\{!([\s\S]+?)\}tag\}/g, true),
            "use":
                assertTopicPropertyContext(/\{tag\{#([\s\S]+?)\}tag\}/g, true),
            "define":
                assertTopicPropertyContext(/\{tag\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}tag\}/g, true),
            "conditional":
                assertTopicPropertyContext(/\{tag\{\?(\?)?\s*([\s\S]*?)\s*\}tag\}/g, true),
            "iterate":
                assertTopicPropertyContext(/\{tag\{~\s*(?:\}tag\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}tag\})/g, true),
            "brokenTag":
                assertTopicPropertyContext(/\{tag\{((?!\}tag\}).)*$/g, true),
            "validationCode":
                assertTopicPropertyContext(TemplateSettings.validationCode.UNVALIDATED)
        },
        "validate": {
            // BROKEN_CONDITIONAL
            "Testing some string here {tag{?test}tag} ok what":
                assertValidationTypeContext('BROKEN_CONDITIONAL'),
            "Testing some string here {tag{?test}tag} ok {tag{?}tag":
                assertValidationTypeContext('BROKEN_CONDITIONAL'),
            "Testing some string here {tag{?test}tag} ok {tag{?} {ta":
                assertValidationTypeContext('BROKEN_CONDITIONAL'),
            "Testing some string here {tag{?test}tag} ok {tag{?}tag} {tag{?test}tag}{tag{=this}tag}":
                assertValidationTypeContext('BROKEN_CONDITIONAL'),
            // BROKEN_ITERATE
            "Testing some string here {tag{~test:value}tag} ok what":
                assertValidationTypeContext('BROKEN_ITERATE'),
            "Testing some string here {tag{~test:value}tag} ok {tag{~}tag":
                assertValidationTypeContext('BROKEN_ITERATE'),
            "Testing some string here {tag{~test:value}tag} ok {tag{~} {ta":
                assertValidationTypeContext('BROKEN_ITERATE'),
            "Testing some string here {tag{~test:value}tag} ok {tag{~}tag} {tag{~test:value}tag}{tag{=this}tag}":
                assertValidationTypeContext('BROKEN_ITERATE'),
            // BROKEN_TAG
            "Something something darkside {tag{":
                assertValidationTypeContext('BROKEN_TAG'),
            "Something {tag{?test}tag} something {tag{?}tag} darkside {tag{?":
                assertValidationTypeContext('BROKEN_TAG'),
            "Something {tag{?test}tag} something {tag{?}tag} darkside {tag{?}tag":
                assertValidationTypeContext('BROKEN_TAG'),
            "Something {tag{?test}tag} something {tag{?}tag} darkside {tag{?}tag Something something darkside.":
                assertValidationTypeContext('BROKEN_TAG'),
            // POSSIBLE_BROKEN_TAG
            "Testing some string here. Something Something darkside {tag":
                assertValidationTypeContext('POSSIBLE_BROKEN_TAG'),
            "Testing some string here. Something Something darkside {ta":
                assertValidationTypeContext('POSSIBLE_BROKEN_TAG'),
            "Testing some string here. Something Something darkside {":
                assertValidationTypeContext('POSSIBLE_BROKEN_TAG'),
            "Testing some string here. {tag{?test}tag} ok {tag{?}tag} {ta":
                assertValidationTypeContext('POSSIBLE_BROKEN_TAG'),
            // VALID
            "Testing some string here. Something Something darkside {tag ":
                assertValidationTypeContext('VALID'),
            "Testing something string here. Something Something darkside {}":
                assertValidationTypeContext('VALID'),
            "Testing something string here. {build{?test}} ok {build{?}} {ta ":
                assertValidationTypeContext('VALID'),
            "Testing something string here. {build{?test}} ok {build{?}} {{{tag ":
                assertValidationTypeContext('VALID')
        }
    }
}).export(module);
