#!/usr/bin/env node

var vows = require('vows'),
    assert = require('assert'),
    path = require('path'),
    basename = path.basename(__filename),
    Template = require('../lib/Template');

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
function assertAppliedStringContext(value) {
    var context = {
        topic: function (template) {
            return template.apply(this.context.name);
        }
    };
    context["is " + value] = function (applied) {
        assert.strictEqual(applied, value);
    };
    return context;
}

/**
 * Test suite
 */
vows.describe(basename).addBatch({
    "template": {
        topic: new Template(),
        "instanceof Template": function (template) {
            assert.strictEqual(template instanceof Template, true);
        },
        "property": {
            // proto
            "type":
                assertTopicPropertyContext('txt'),
            "settings": {
                topic: function (template) {
                    return template.settings;
                },
                "tagStart":
                    assertTopicPropertyContext('#{build{'),
                "tagEnd":
                    assertTopicPropertyContext('}}#')
            }
        },
        "apply": {
            topic: function (template) {
                template.def = {
                    DEBUG: false,
                    PARTIAL: 'This is a partial.',
                    argv: {
                        RELEASE: true
                    }
                }
                return template;
            },
            "compile-time": {
                "Testing some string here. IS DEBUG: #{build{#def.DEBUG}}#":
                    assertAppliedStringContext('Testing some string here. IS DEBUG: false'),
                "Testing some string here#{build{##def.NEW_PARTIAL:This is a new partial.#}}# ok what.":
                    assertAppliedStringContext('Testing some string here ok what.'),
                "Testing#{build{##def.NEW_PARTIAL:This should change anything.#}}# ok what.":
                    assertAppliedStringContext('Testing ok what.'),
                "Testing #{build{#def.ANOTHER_PARTIAL='yet another partial.'}}# ok what.":
                    assertAppliedStringContext('Testing yet another partial. ok what.'),
                "Testing some string here. #{build{#def.PARTIAL}}# #{build{#def.NEW_PARTIAL}}#":
                    assertAppliedStringContext('Testing some string here. This is a partial. This is a new partial.')
            },
            "run-time": {
                "Testing some string here#{build{?DEBUG}}# ok what#{build{?}}# is it.":
                    assertAppliedStringContext('Testing some string here is it.'),
                "Testing some string here#{build{?argv.RELEASE}}# ok what#{build{?}}# is it.":
                    assertAppliedStringContext('Testing some string here ok what is it.'),
                "Testing some string here. #{build{=PARTIAL}}# #{build{=NEW_PARTIAL}}# #{build{=ANOTHER_PARTIAL}}#":
                    assertAppliedStringContext('Testing some string here. This is a partial. This is a new partial. yet another partial.'),
                "Testing some string here #{build{?argv.RELEASE}}##{build{=ANOTHER_PARTIAL}}##{build{?}}# is it.":
                    assertAppliedStringContext('Testing some string here yet another partial. is it.'),
                "Testing some string here #{build{?DEBUG}}##{build{=NEW_PARTIAL}}##{build{?}}# is it.":
                    assertAppliedStringContext('Testing some string here  is it.'),
            }
        }
    }
}).export(module);
