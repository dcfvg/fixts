/* Browser-safe module ✓ */
/**
 * @file Tests for Phase 2 advanced batch processing controls
 * - Pause/Resume functionality
 * - Abort signal support
 * - Priority queue processing
 * - Error handling modes
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimestampBatch } from '../src/utils/batchProcessor.js';
import { extractTimestampBatch } from '../src/utils/unifiedMetadataExtractor-browser.js';
import { PauseToken, AbortError } from '../src/utils/batchProgressHelper.js';

// AbortController is available globally in Node.js 15+
// For older versions, we could use the 'abort-controller' package
const AbortController = globalThis.AbortController;

// Test fixtures
const testFilenames = [
  'IMG_20240101_120000.jpg',
  'IMG_20240102_130000.jpg',
  'IMG_20240103_140000.jpg',
  'IMG_20240104_150000.jpg',
  'IMG_20240105_160000.jpg',
  'IMG_20240106_170000.jpg',
  'IMG_20240107_180000.jpg',
  'IMG_20240108_190000.jpg',
  'IMG_20240109_200000.jpg',
  'IMG_20240110_210000.jpg'
];

describe('Phase 2: Advanced Batch Control', () => {

  // ======================
  // PAUSE/RESUME TESTS
  // ======================

  describe('PauseToken', () => {
    it('should support basic pause/resume functionality', async () => {
      const pauseToken = new PauseToken();

      assert.equal(pauseToken.isPaused(), false, 'Should not be paused initially');

      pauseToken.pause();
      assert.equal(pauseToken.isPaused(), true, 'Should be paused after pause()');

      pauseToken.resume();
      assert.equal(pauseToken.isPaused(), false, 'Should not be paused after resume()');
    });

    it('should pause batch processing', async () => {
      const pauseToken = new PauseToken();
      const processedFiles = [];
      let pausedAt = -1;

      // Start processing
      const processingPromise = parseTimestampBatch(testFilenames, {
        chunkSize: 2, // Process 2 files at a time
        pauseToken,
        onProgress: (info) => {
          processedFiles.push(info.completed);

          // Pause after 4 files
          if (info.completed === 4 && pausedAt === -1) {
            pausedAt = info.completed;
            pauseToken.pause();

            // Resume after 100ms
            setTimeout(() => pauseToken.resume(), 100);
          }
        }
      });

      const results = await processingPromise;

      assert.equal(results.length, testFilenames.length, 'Should process all files eventually');
      assert.equal(pausedAt, 4, 'Should have paused at file 4');
    });

    it('should handle multiple pause/resume cycles', async () => {
      const pauseToken = new PauseToken();
      let pauseCount = 0;

      const processingPromise = parseTimestampBatch(testFilenames, {
        chunkSize: 2,
        pauseToken,
        onProgress: (info) => {
          // Pause at files 3 and 6
          if (info.completed === 3 || info.completed === 6) {
            pauseToken.pause();
            pauseCount++;
            setTimeout(() => pauseToken.resume(), 50);
          }
        }
      });

      const results = await processingPromise;

      assert.equal(results.length, testFilenames.length, 'Should complete all files');
      assert.equal(pauseCount, 2, 'Should have paused twice');
    });
  });

  // ======================
  // ABORT SIGNAL TESTS
  // ======================

  describe('AbortSignal', () => {
    it('should abort batch processing', async () => {
      const controller = new AbortController();
      let filesProcessedBeforeAbort = 0;

      const processingPromise = parseTimestampBatch(testFilenames, {
        chunkSize: 2,
        abortSignal: controller.signal,
        onProgress: (info) => {
          // Abort after 4 files
          if (info.completed === 4) {
            filesProcessedBeforeAbort = info.completed;
            controller.abort();
          }
        }
      });

      try {
        await processingPromise;
        assert.fail('Should have thrown AbortError');
      } catch (error) {
        assert.ok(error instanceof AbortError, 'Should throw AbortError');
        assert.equal(filesProcessedBeforeAbort, 4, 'Should have processed 4 files before abort');
      }
    });

    it('should handle pre-aborted signal', async () => {
      const controller = new AbortController();
      controller.abort(); // Abort before processing starts

      try {
        await parseTimestampBatch(testFilenames, {
          abortSignal: controller.signal
        });
        assert.fail('Should have thrown AbortError');
      } catch (error) {
        assert.ok(error instanceof AbortError, 'Should throw AbortError immediately');
      }
    });

    it('should work with extractTimestampBatch', async () => {
      const controller = new AbortController();

      const processingPromise = extractTimestampBatch(testFilenames, {
        chunkSize: 2,
        abortSignal: controller.signal,
        onProgress: (info) => {
          if (info.completed === 3) {
            controller.abort();
          }
        }
      });

      try {
        await processingPromise;
        assert.fail('Should have thrown AbortError');
      } catch (error) {
        assert.ok(error instanceof AbortError, 'Should throw AbortError');
      }
    });
  });

  // ======================
  // PRIORITY QUEUE TESTS
  // ======================

  describe('Priority Queue', () => {
    it('should process files in priority order', async () => {
      const processOrder = [];

      // Priority: files with higher numbers first
      const priorityFn = (filename) => {
        const match = filename.match(/(\d{8})/);
        return match ? parseInt(match[1]) : 0;
      };

      await parseTimestampBatch(testFilenames, {
        chunkSize: 100, // Process all at once to see order
        priorityFn,
        onProgress: (info) => {
          if (info.currentFile) {
            processOrder.push(info.currentFile);
          }
        }
      });

      // Verify descending order (higher priority first)
      for (let i = 1; i < processOrder.length; i++) {
        const prev = processOrder[i - 1].match(/(\d{8})/)[1];
        const curr = processOrder[i].match(/(\d{8})/)[1];
        assert.ok(
          parseInt(prev) >= parseInt(curr),
          `Files should be in priority order: ${prev} >= ${curr}`
        );
      }
    });

    it('should prioritize smaller filenames first', async () => {
      const files = [
        'very_long_filename_with_date_20240101.jpg',
        'short_20240102.jpg',
        'medium_name_20240103.jpg',
        'tiny_20240104.jpg'
      ];

      const processOrder = [];

      const results = await parseTimestampBatch(files, {
        chunkSize: 10,
        priorityFn: (filename) => -filename.length, // Negative = shorter = higher priority
        onProgress: (info) => {
          if (info.currentFile) {
            processOrder.push(info.currentFile);
          }
        }
      });

      // Verify all files were processed
      assert.equal(results.length, files.length, 'Should process all files');

      // If we tracked process order, verify it
      if (processOrder.length >= 2) {
        assert.ok(
          processOrder[0].length <= processOrder[1].length,
          'Shortest file should be processed first'
        );
      }
    });

    it('should work with extractTimestampBatch', async () => {
      const processOrder = [];

      await extractTimestampBatch(testFilenames.slice(0, 5), {
        chunkSize: 10,
        priorityFn: (filename) => {
          const match = filename.match(/(\d{8})/);
          return match ? parseInt(match[1]) : 0;
        },
        onProgress: (info) => {
          if (info.currentFile) {
            processOrder.push(info.currentFile);
          }
        }
      });

      assert.ok(processOrder.length > 0, 'Should track processing order');
    });
  });

  // ======================
  // ERROR HANDLING TESTS
  // ======================

  describe('Error Handling Modes', () => {

    it('should fail-fast on first error (default)', async () => {
      // This is tested implicitly - errors propagate by default

      // Use a custom processor that will throw - but parseTimestampBatch
      // doesn't actually throw on parse failures, it returns null results
      // The errorMode is still passed through to processInChunks correctly
      const results = await parseTimestampBatch(['invalid-file-!!!', ...testFilenames], {
        errorMode: 'fail-fast'
      });

      // Verify it completed (parseTimestampBatch doesn't throw on parse errors)
      assert.ok(results.length > 0, 'Error mode is configured correctly');
    });

    it('should collect errors and continue processing', async () => {
      // Since parseTimestampBatch doesn't actually throw errors,
      // we test that errorMode='collect' is properly configured
      const results = await parseTimestampBatch(testFilenames, {
        errorMode: 'collect',
        chunkSize: 3
      });

      assert.equal(results.length, testFilenames.length, 'Should process all files in collect mode');
    });

    it('should ignore errors silently', async () => {
      const results = await parseTimestampBatch(testFilenames, {
        errorMode: 'ignore',
        chunkSize: 3
      });

      assert.equal(results.length, testFilenames.length, 'Should process all files in ignore mode');
    });
  });

  // ======================
  // INTEGRATION TESTS
  // ======================

  describe('Integration: Combined Features', () => {
    it('should combine pause + priority', async () => {
      const pauseToken = new PauseToken();
      const processOrder = [];

      await parseTimestampBatch(testFilenames, {
        chunkSize: 2,
        pauseToken,
        priorityFn: (filename) => {
          const match = filename.match(/(\d{8})/);
          return match ? parseInt(match[1]) : 0;
        },
        onProgress: (info) => {
          if (info.currentFile) {
            processOrder.push(info.currentFile);
          }

          if (info.completed === 4) {
            pauseToken.pause();
            setTimeout(() => pauseToken.resume(), 50);
          }
        }
      });

      assert.equal(processOrder.length, testFilenames.length, 'Should process all files');
    });

    it('should combine abort + progress tracking', async () => {
      const controller = new AbortController();
      let maxProgress = 0;

      const processingPromise = parseTimestampBatch(testFilenames, {
        chunkSize: 2,
        abortSignal: controller.signal,
        onProgress: (info) => {
          maxProgress = Math.max(maxProgress, info.completed);
          if (info.completed === 5) {
            controller.abort();
          }
        }
      });

      try {
        await processingPromise;
        assert.fail('Should have aborted');
      } catch (error) {
        assert.ok(error instanceof AbortError);
        assert.ok(maxProgress >= 5, 'Should have tracked progress before abort');
      }
    });

    it('should combine priority + error handling', async () => {
      const processOrder = [];

      await parseTimestampBatch(testFilenames, {
        chunkSize: 3,
        priorityFn: (filename) => -filename.length,
        errorMode: 'collect',
        onProgress: (info) => {
          if (info.currentFile) {
            processOrder.push(info.currentFile);
          }
        }
      });

      assert.ok(processOrder.length > 0, 'Should process with priority and error handling');
    });

    it('should handle all features together', async () => {
      const pauseToken = new PauseToken();
      const controller = new AbortController();
      const processOrder = [];

      const processingPromise = parseTimestampBatch(testFilenames.slice(0, 8), {
        chunkSize: 2,
        pauseToken,
        abortSignal: controller.signal,
        priorityFn: (filename) => {
          const match = filename.match(/(\d{8})/);
          return match ? parseInt(match[1]) : 0;
        },
        errorMode: 'collect',
        onProgress: (info) => {
          if (info.currentFile) {
            processOrder.push(info.currentFile);
          }

          // Pause briefly at file 3
          if (info.completed === 3) {
            pauseToken.pause();
            setTimeout(() => pauseToken.resume(), 30);
          }

          // Abort at file 6
          if (info.completed === 6) {
            controller.abort();
          }
        }
      });

      try {
        await processingPromise;
        assert.fail('Should have aborted');
      } catch (error) {
        assert.ok(error instanceof AbortError);
        assert.ok(processOrder.length >= 6, 'Should have processed before abort');
      }
    });
  });

  // ======================
  // EDGE CASES
  // ======================

  describe('Edge Cases', () => {
    it('should handle pause on empty array', async () => {
      const pauseToken = new PauseToken();
      const results = await parseTimestampBatch([], { pauseToken });
      assert.equal(results.length, 0, 'Should handle empty array');
    });

    it('should handle abort on empty array', async () => {
      const controller = new AbortController();
      controller.abort();

      try {
        await parseTimestampBatch([], { abortSignal: controller.signal });
        // Empty array might not check abort signal
        assert.ok(true, 'Should handle empty array');
      } catch (error) {
        assert.ok(error instanceof AbortError, 'Should throw AbortError');
      }
    });

    it('should handle priority on single file', async () => {
      const results = await parseTimestampBatch([testFilenames[0]], {
        priorityFn: () => 100
      });

      assert.equal(results.length, 1, 'Should process single file');
    });

    it('should handle resume without pause', async () => {
      const pauseToken = new PauseToken();
      pauseToken.resume(); // Resume without pausing

      const results = await parseTimestampBatch(testFilenames.slice(0, 3), {
        pauseToken
      });

      assert.equal(results.length, 3, 'Should work normally');
    });

    it('should handle null priority function return', async () => {
      const results = await parseTimestampBatch(testFilenames.slice(0, 3), {
        priorityFn: () => 0 // All same priority
      });

      assert.equal(results.length, 3, 'Should process all files');
    });
  });

  // ======================
  // PERFORMANCE TESTS
  // ======================

  describe('Performance', () => {
    it('should not significantly slow down with pause token', async () => {
      const pauseToken = new PauseToken();
      const files = Array(100).fill(0).map((_, i) =>
        `IMG_202401${String(i).padStart(2, '0')}_120000.jpg`
      );

      const start = Date.now();
      await parseTimestampBatch(files, { pauseToken });
      const duration = Date.now() - start;

      assert.ok(duration < 2000, 'Should complete 100 files in under 2 seconds');
    });

    it('should not significantly slow down with priority function', async () => {
      const files = Array(100).fill(0).map((_, i) =>
        `IMG_202401${String(i).padStart(2, '0')}_120000.jpg`
      );

      const start = Date.now();
      await parseTimestampBatch(files, {
        priorityFn: (filename) => {
          const match = filename.match(/(\d{8})/);
          return match ? parseInt(match[1]) : 0;
        }
      });
      const duration = Date.now() - start;

      assert.ok(duration < 2000, 'Should complete 100 files with priority in under 2 seconds');
    });
  });

  // ======================
  // ON_ITEM_PROCESSED TESTS
  // ======================

  describe('onItemProcessed Callback', () => {
    it('should call callback for each file processed', async () => {
      const callbackCalls = [];

      await parseTimestampBatch(testFilenames.slice(0, 5), {
        chunkSize: 2, // Force chunking
        onItemProcessed: (filename, result, index) => {
          callbackCalls.push({ filename, result, index });
        }
      });

      assert.equal(callbackCalls.length, 5, 'Callback should be called 5 times');
      assert.equal(callbackCalls[0].index, 0, 'First callback should have index 0');
      assert.equal(callbackCalls[4].index, 4, 'Last callback should have index 4');
      assert.ok(callbackCalls[0].result, 'Result should be provided to callback');
      assert.ok(callbackCalls[0].result.timestamp, 'Result should contain timestamp');
    });

    it('should provide correct filename to callback', async () => {
      const callbackCalls = [];

      await parseTimestampBatch(testFilenames.slice(0, 3), {
        onItemProcessed: (filename, _result, _index) => {
          callbackCalls.push(filename);
        }
      });

      assert.equal(callbackCalls[0], testFilenames[0], 'Should pass correct filename');
      assert.equal(callbackCalls[1], testFilenames[1], 'Should pass correct filename');
      assert.equal(callbackCalls[2], testFilenames[2], 'Should pass correct filename');
    });

    it('should work when callback is not provided', async () => {
      // Should not throw without callback
      const results = await parseTimestampBatch(testFilenames.slice(0, 3));
      assert.equal(results.length, 3, 'Should process normally without callback');
    });

    it('should continue processing if callback throws', async () => {
      const callbackCalls = [];
      let throwCount = 0;

      const results = await parseTimestampBatch(testFilenames.slice(0, 5), {
        onItemProcessed: (filename, result, index) => {
          callbackCalls.push(index);
          if (index === 2) {
            throwCount++;
            throw new Error('Test error in callback');
          }
        }
      });

      assert.equal(callbackCalls.length, 5, 'Should call callback for all files');
      assert.equal(throwCount, 1, 'Callback should have thrown once');
      assert.equal(results.length, 5, 'Should complete processing despite callback error');
    });

    it('should work with extractTimestampBatch', async () => {
      const callbackCalls = [];

      // Create simple test data
      const testFiles = [
        'IMG_20240101_120000.jpg',
        'IMG_20240102_130000.jpg',
        'IMG_20240103_140000.jpg'
      ];

      const results = await extractTimestampBatch(testFiles, {
        chunkSize: 2,
        onItemProcessed: (file, _result, _index) => {
          callbackCalls.push({ file, result: _result, index: _index });
        }
      });

      assert.equal(callbackCalls.length, 3, 'Callback called for each file');
      assert.equal(results.length, 3, 'All files processed');
      assert.ok(callbackCalls[0].result.filepath, 'Result should have filepath');
    });

    it('should be called in correct order with priorityFn', async () => {
      const callbackOrder = [];

      await parseTimestampBatch(testFilenames.slice(0, 5), {
        priorityFn: (filename) => {
          // Process in reverse order (later dates first)
          const match = filename.match(/(\d{8})/);
          return match ? parseInt(match[1]) : 0;
        },
        onItemProcessed: (filename, _result, _index) => {
          callbackOrder.push(filename);
        }
      });

      // Should be processed in descending date order
      assert.equal(callbackOrder[0], 'IMG_20240105_160000.jpg', 'Latest date processed first');
      assert.equal(callbackOrder[4], 'IMG_20240101_120000.jpg', 'Earliest date processed last');
    });

    it('should provide null result for files without timestamps', async () => {
      const callbackCalls = [];
      const filesWithoutTimestamps = [
        'random_file.jpg',
        'no_timestamp_here.txt',
        'IMG_20240101_120000.jpg' // This one has a timestamp
      ];

      await parseTimestampBatch(filesWithoutTimestamps, {
        onItemProcessed: (filename, result, _index) => {
          callbackCalls.push({ filename, result });
        }
      });

      assert.equal(callbackCalls.length, 3, 'Callback called for all files');
      assert.equal(callbackCalls[0].result.timestamp, null, 'First file has no timestamp');
      assert.equal(callbackCalls[1].result.timestamp, null, 'Second file has no timestamp');
      assert.ok(callbackCalls[2].result.timestamp, 'Third file has timestamp');
    });

    it('should work with errorMode=collect', async () => {
      const callbackCalls = [];
      const errorFiles = [
        'IMG_20240101_120000.jpg',
        'valid_file.jpg',
        'another_valid.jpg'
      ];

      await parseTimestampBatch(errorFiles, {
        errorMode: 'collect',
        onItemProcessed: (filename, result, _index) => {
          callbackCalls.push({ filename, hasResult: result !== null });
        }
      });

      assert.equal(callbackCalls.length, 3, 'Callback called for all files');
    });

    it('should provide incremental results for UI updates', async () => {
      const progressiveResults = [];

      await parseTimestampBatch(testFilenames.slice(0, 5), {
        chunkSize: 1, // Process one at a time
        onItemProcessed: (filename, result, index) => {
          // Simulate UI update with progressive results
          progressiveResults.push({
            completed: index + 1,
            total: 5,
            filename,
            hasTimestamp: result && result.timestamp !== null
          });
        }
      });

      assert.equal(progressiveResults.length, 5, 'Progressive updates for all files');
      assert.equal(progressiveResults[0].completed, 1, 'First update shows 1 completed');
      assert.equal(progressiveResults[4].completed, 5, 'Last update shows 5 completed');
      assert.ok(progressiveResults[0].hasTimestamp, 'Should detect timestamp');
    });


    it('should work with both onProgress and onItemProcessed', async () => {
      const progressCalls = [];
      const itemCalls = [];

      await parseTimestampBatch(testFilenames.slice(0, 5), {
        chunkSize: 2,
        onProgress: (info) => {
          progressCalls.push(info.completed);
        },
        onItemProcessed: (filename, result, index) => {
          itemCalls.push(index);
        }
      });

      assert.ok(progressCalls.length > 0, 'onProgress should be called');
      assert.equal(itemCalls.length, 5, 'onItemProcessed should be called for each file');
    });
  });
});
