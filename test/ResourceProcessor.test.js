#!/usr/bin/env node

var vows = require('vows'),
    assert = require('assert'),
    path = require('path'),
    basename = path.basename(__filename),
    fs = require('fs'),
    chunks = [],
    asyncProcessed,
    syncProcessed,
    ResourceReader = require('../lib/ResourceReader'),
    ResourceProcessor = require('../lib/ResourceProcessor'),
    Template = require('../lib/Template'),
    def = {argv: {}},
    reader = new ResourceReader();

/**
 * @private
 */
function handleEvent(processor, eventType, stream, asyncChunk) {
    switch (eventType) {
    // When ReadStream is created
    case ResourceReader.event.READ_STREAM_START:
        asyncProcessed = '';
        syncProcessed = processor.processFile(stream.mimeType, stream.path, fs.readFileSync(stream.path).toString(), def);
        break;

    // When ReadStream reads
    case ResourceReader.event.READ_STREAM_DATA:
        asyncChunk = processor.processFile(stream.mimeType, stream.path, asyncChunk.toString(), def);
        chunks.push({
            asyncProcessed: asyncChunk,
            syncProcessed: syncProcessed.substr(asyncProcessed.length, asyncChunk.length)
        });
        asyncProcessed += asyncChunk;
        break;

    // When ReadStream ends
    case ResourceReader.event.READ_STREAM_END:
        this.callback(processor, asyncProcessed, syncProcessed, chunks);
        break;
    }
}

/**
 * Test suite
 */
vows.describe(basename).addBatch({
    "processor": {
        "new": {
            topic: new ResourceProcessor(),
            "instanceof ResourceProcessor": function (processor) {
                assert.strictEqual(processor instanceof ResourceProcessor, true);
            },
            "property": {
                // proto
                "currentFileIndex is 0": function (topic) {
                    assert.strictEqual(topic.currentFileIndex, 0);
                },
                "date is instanceof Date": function (topic) {
                    assert.strictEqual(topic.date instanceof Date, true);
                }
            },
        },
        "apply": {
            topic: function () {
                processor = new ResourceProcessor();
                reader
                    .on(ResourceReader.event.READ_STREAM_START,
                        handleEvent.bind(this, processor, ResourceReader.event.READ_STREAM_START))
                    .on(ResourceReader.event.READ_STREAM_DATA,
                        handleEvent.bind(this, processor, ResourceReader.event.READ_STREAM_DATA))
                    .on(ResourceReader.event.READ_STREAM_END,
                        handleEvent.bind(this, processor, ResourceReader.event.READ_STREAM_END))
                    .read([path.join(__dirname, 'test-in', 'largefile2.txt')]);
            },
            "syncProcessed is not empty": function (processor, asyncProcessed, syncProcessed) {
                assert.isNotEmpty(syncProcessed);
            },
            "asyncProcessed is not empty": function (processor, asyncProcessed, syncProcessed) {
                assert.isNotEmpty(asyncProcessed);
            },
            "syncProcessed.length is 4397890": function (processor, asyncProcessed, syncProcessed) {
                assert.strictEqual(syncProcessed.length, 3716066);
            },
            "asyncProcessed.length is 4397890": function (processor, asyncProcessed, syncProcessed) {
                assert.strictEqual(asyncProcessed.length, 3716066);
            },
            "asyncProcessed chunks equal syncProcessed chunks": function (processor, asyncProcessed, syncProcessed, chunks) {
                chunks.forEach(function(chunk) {
                    assert.strictEqual(chunk.asyncProcessed, chunk.syncProcessed);
                });
            },
            "getActiveTpl is object": function (processor, asyncProcessed, syncProcessed) {
                var template = processor.getActiveTpl(path.join(__dirname, 'test-in', 'largefile2.txt'));
                assert.isObject(template);
            },
            "getActiveTpl instanceof Template": function (processor, asyncProcessed, syncProcessed) {
                var template = processor.getActiveTpl(path.join(__dirname, 'test-in', 'largefile2.txt'));
                assert.strictEqual(template instanceof Template, true);
            }/*,
            "save asyncProcessed": function (processor, asyncProcessed, syncProcessed) {
                fs.writeFileSync(
                    path.join(__dirname, 'test-out', path.basename(__filename)),
                    asyncProcessed
                );
            }*/
        }
    }
}).export(module);
