#!/usr/bin/env node

var vows = require('vows'),
    assert = require('assert'),
    path = require('path'),
    basename = path.basename(__filename),
    fs = require('fs'),
    chunks = [],
    asyncRaw,
    syncRaw,
    ResourceReader = require('../lib/ResourceReader');

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
function handleEvent(reader, eventType, stream, asyncChunk) {
    switch (eventType) {
    // When ReadStream is created
    case ResourceReader.event.READ_STREAM_START:
        asyncRaw = '';
        syncRaw = fs.readFileSync(stream.path).toString();
        break;

    // When ReadStream reads
    case ResourceReader.event.READ_STREAM_DATA:
        asyncChunk = asyncChunk.toString();
        chunks.push({
            asyncRaw: asyncChunk,
            syncRaw: syncRaw.substr(asyncRaw.length, asyncChunk.length)
        });
        asyncRaw += asyncChunk;
        break;

    // When ReadStream ends
    case ResourceReader.event.READ_STREAM_END:
        this.callback(reader, asyncRaw, syncRaw, chunks);
        break;
    }
}

/**
 * Test suite
 */
vows.describe(basename).addBatch({
    "reader": {
        topic: new ResourceReader(),
        "instanceof ResourceReader": function (reader) {
            assert.strictEqual(reader instanceof ResourceReader, true);
        },
        "property": {
            // proto
            "maxNumOfGlobs":
                assertTopicPropertyContext(8),
            "maxNumOfStreams":
                assertTopicPropertyContext(4),
            "numOfGlobs":
                assertTopicPropertyContext(0),
            "numOfStreams":
                assertTopicPropertyContext(0),
            "recursive":
                assertTopicPropertyContext(false)
        },
        "read": {
            topic: function (reader) {
                reader
                    .on(ResourceReader.event.READ_STREAM_START,
                        handleEvent.bind(this, reader, ResourceReader.event.READ_STREAM_START))
                    .on(ResourceReader.event.READ_STREAM_DATA,
                        handleEvent.bind(this, reader, ResourceReader.event.READ_STREAM_DATA))
                    .on(ResourceReader.event.READ_STREAM_END,
                        handleEvent.bind(this, reader, ResourceReader.event.READ_STREAM_END))
                    .read([__dirname + '/test-in/largefile.txt']);
            },
            "syncRaw is not empty": function (reader, asyncRaw, syncRaw) {
                assert.isNotEmpty(syncRaw);
            },
            "asyncRaw is not empty": function (reader, asyncRaw, syncRaw) {
                assert.isNotEmpty(asyncRaw);
            },
            "syncRaw.length is 3153057": function (reader, asyncRaw, syncRaw) {
                assert.strictEqual(syncRaw.length, 3153057);
            },
            "asyncRaw.length is 3153057": function (reader, asyncRaw, syncRaw) {
                assert.strictEqual(asyncRaw.length, 3153057);
            },
            "async chunks equal sync chunks": function (reader, asyncRaw, syncRaw, chunks) {
                chunks.forEach(function(chunk) {
                    assert.strictEqual(chunk.asyncRaw, chunk.syncRaw);
                });
            },
            "getActiveStream is object": function (reader, asyncRaw, syncRaw) {
                var stream = reader.getActiveStream(__dirname + '/test-in/largefile.txt');
                assert.isObject(stream);
            },
            "getActiveStream instanceof fs.ReadStream": function (reader, asyncRaw, syncRaw) {
                var stream = reader.getActiveStream(__dirname + '/test-in/largefile.txt');
                assert.strictEqual(stream instanceof fs.ReadStream, true);
            }
        }
    }
}).export(module);
