#!/usr/bin/env node

var vows = require('vows'),
    assert = require('assert'),
    path = require('path'),
    basename = path.basename(__filename),
    fs = require('fs'),
    chunks = [],
    asyncRaw,
    syncRaw,
    event = require('../lib/event'),
    ResourceReader = require('../lib/ResourceReader');

/**
 * @private
 */
function handleEvent(reader, eventType, stream, asyncChunk) {
    switch (eventType) {
    // When ReadStream is created
    case event.READER_STREAM_START:
        asyncRaw = '';
        syncRaw = fs.readFileSync(stream.path).toString();
        break;

    // When ReadStream reads
    case event.READER_STREAM_DATA:
        asyncChunk = asyncChunk.toString();
        chunks.push({
            asyncRaw: asyncChunk,
            syncRaw: syncRaw.substr(asyncRaw.length, asyncChunk.length)
        });
        asyncRaw += asyncChunk;
        break;

    // When ReadStream ends
    case event.READER_STREAM_END:
        this.callback(reader, asyncRaw, syncRaw, chunks);
        break;
    }
}

/**
 * Test suite
 */
vows.describe(basename).addBatch({
    "reader": {
        "new": {
            topic: new ResourceReader(),
            "instanceof ResourceReader": function (reader) {
                assert.strictEqual(reader instanceof ResourceReader, true);
            },
            "properties": {
                "maxNumOfGlobs is 8": function (topic) {
                    assert.strictEqual(topic.maxNumOfGlobs, 8);
                },
                "maxNumOfStreams is 4": function (topic) {
                    assert.strictEqual(topic.maxNumOfStreams, 4);
                },
                "numOfGlobs is 0": function (topic) {
                    assert.strictEqual(topic.numOfGlobs, 0);
                },
                "numOfStreams is 0": function (topic) {
                    assert.strictEqual(topic.numOfStreams, 0);
                },
                "recursive is false": function (topic) {
                    assert.strictEqual(topic.recursive, false);
                }
            }
        },
        "read": {
            topic: function () {
                reader = new ResourceReader();
                reader
                    .on(event.READER_STREAM_START,
                        handleEvent.bind(this, reader, event.READER_STREAM_START))
                    .on(event.READER_STREAM_DATA,
                        handleEvent.bind(this, reader, event.READER_STREAM_DATA))
                    .on(event.READER_STREAM_END,
                        handleEvent.bind(this, reader, event.READER_STREAM_END))
                    .read([__dirname + '/test-in/largefile.txt']);
            },
            "syncRaw is not empty": function (reader, asyncRaw, syncRaw) {
                assert.isNotEmpty(syncRaw);
            },
            "asyncRaw is not empty": function (reader, asyncRaw, syncRaw) {
                assert.isNotEmpty(asyncRaw);
            },
            "syncRaw.length is 2937985": function (reader, asyncRaw, syncRaw) {
                assert.strictEqual(syncRaw.length, 2937985);
            },
            "asyncRaw.length is 2937985": function (reader, asyncRaw, syncRaw) {
                assert.strictEqual(asyncRaw.length, 2937985);
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
