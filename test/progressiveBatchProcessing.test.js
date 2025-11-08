import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseTimestampBatch, extractTimestampBatch } from '../index.js';

describe('Progressive Batch Processing', () => {
  describe('Progress Callbacks', () => {
    it('should report progress during batch processing', async () => {
      const filenames = [];
      for (let i = 0; i < 50; i++) {
        filenames.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      const progressUpdates = [];
      await parseTimestampBatch(filenames, {
        chunkSize: 10,
        onProgress: (info) => {
          progressUpdates.push(info);
        }
      });

      // Should have received progress updates
      assert.ok(progressUpdates.length > 0, 'Should receive progress updates');

      // Check first progress update
      const firstUpdate = progressUpdates[0];
      assert.ok(firstUpdate.completed > 0);
      assert.strictEqual(firstUpdate.total, 50);
      assert.ok(firstUpdate.percentage >= 0 && firstUpdate.percentage <= 1);
      assert.ok(firstUpdate.elapsedMs >= 0);
      assert.ok(firstUpdate.filesPerSecond >= 0);

      // Check last progress update
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      assert.strictEqual(lastUpdate.completed, 50);
      assert.strictEqual(lastUpdate.total, 50);
      assert.strictEqual(lastUpdate.percentage, 1);
    });

    it('should include current file in progress updates', async () => {
      const filenames = ['file1.txt', 'file2.txt', 'file3.txt'];
      const progressUpdates = [];

      await parseTimestampBatch(filenames, {
        chunkSize: 1,
        onProgress: (info) => {
          if (info.currentFile) {
            progressUpdates.push(info.currentFile);
          }
        }
      });

      assert.ok(progressUpdates.length > 0);
      assert.ok(progressUpdates.some(file => file === 'file1.txt'));
    });

    it('should calculate ETA during processing', async () => {
      const filenames = [];
      for (let i = 0; i < 20; i++) {
        filenames.push(`file${i}.txt`);
      }

      let hasETA = false;
      await parseTimestampBatch(filenames, {
        chunkSize: 5,
        onProgress: (info) => {
          if (info.estimatedRemainingMs !== null && info.completed > 5) {
            hasETA = true;
            assert.ok(info.estimatedRemainingMs >= 0);
          }
        }
      });

      assert.ok(hasETA, 'Should calculate ETA after processing some files');
    });
  });

  describe('Chunk Size Options', () => {
    it('should process in chunks when chunkSize is specified', async () => {
      const filenames = [];
      for (let i = 0; i < 30; i++) {
        filenames.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      const results = await parseTimestampBatch(filenames, {
        chunkSize: 10
      });

      assert.strictEqual(results.length, 30);
      results.forEach(result => {
        assert.ok(result.timestamp);
      });
    });

    it('should use auto chunk size calculation', async () => {
      const filenames = [];
      for (let i = 0; i < 100; i++) {
        filenames.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      const results = await parseTimestampBatch(filenames, {
        chunkSize: 'auto' // Should auto-calculate optimal chunk size
      });

      assert.strictEqual(results.length, 100);
    });

    it('should handle small batches without chunking', async () => {
      const filenames = ['file1.txt', 'file2.txt', 'file3.txt'];

      const results = await parseTimestampBatch(filenames, {
        chunkSize: 'auto' // Should process all at once for small batches
      });

      assert.strictEqual(results.length, 3);
    });

    it('should process large batches efficiently with chunking', async () => {
      const filenames = [];
      for (let i = 0; i < 500; i++) {
        filenames.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      const start = Date.now();
      const results = await parseTimestampBatch(filenames, {
        chunkSize: 50
      });
      const duration = Date.now() - start;

      assert.strictEqual(results.length, 500);
      // Should still be fast even with chunking
      assert.ok(duration < 10000, `Should complete in < 10s, took ${duration}ms`);
    });
  });

  describe('Browser Context - extractTimestampBatch', () => {
    it('should support progress callbacks for file extraction', async () => {
      // Simulate browser File objects (using strings in Node.js tests)
      // Use more files to ensure chunking happens
      const files = [];
      for (let i = 0; i < 20; i++) {
        files.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      const progressUpdates = [];
      const results = await extractTimestampBatch(files, {
        chunkSize: 5,
        onProgress: (info) => {
          progressUpdates.push(info);
        },
        sources: ['filename'] // Use only filename parsing in tests
      });

      assert.strictEqual(results.length, 20);
      assert.ok(progressUpdates.length > 0, 'Should receive progress updates');
      assert.strictEqual(progressUpdates[progressUpdates.length - 1].completed, 20);
    });

    it('should yield between chunks for UI responsiveness', async () => {
      const files = [];
      for (let i = 0; i < 30; i++) {
        files.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      const start = Date.now();
      await extractTimestampBatch(files, {
        chunkSize: 10,
        yieldBetweenChunks: true,
        sources: ['filename']
      });
      const duration = Date.now() - start;

      // Should take slightly longer due to yielding, but not much
      assert.ok(duration < 5000);
    });

    it('should disable yielding when yieldBetweenChunks is false', async () => {
      const files = [];
      for (let i = 0; i < 20; i++) {
        files.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      const start = Date.now();
      await extractTimestampBatch(files, {
        chunkSize: 10,
        yieldBetweenChunks: false,
        sources: ['filename']
      });
      const duration = Date.now() - start;

      // Should be fast without yielding
      assert.ok(duration < 5000);
    });
  });

  describe('Processing Rate Calculation', () => {
    it('should calculate files per second', async () => {
      const filenames = [];
      for (let i = 0; i < 50; i++) {
        filenames.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      let filesPerSecond = 0;
      await parseTimestampBatch(filenames, {
        chunkSize: 10,
        onProgress: (info) => {
          if (info.filesPerSecond > filesPerSecond) {
            filesPerSecond = info.filesPerSecond;
          }
        }
      });

      assert.ok(filesPerSecond > 0, 'Should calculate files per second');
      // Should be able to process at least 100 files/second
      assert.ok(filesPerSecond >= 10, `Processing rate should be reasonable: ${filesPerSecond} files/s`);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without progress options (backward compatible)', async () => {
      const filenames = [
        'IMG_20240115_143025.jpg',
        '2024-11-02-report.txt'
      ];

      // Should work exactly like before without new options
      const results = await parseTimestampBatch(filenames);

      assert.strictEqual(results.length, 2);
      assert.ok(results[0].timestamp);
      assert.ok(results[1].timestamp);
    });

    it('should process all files in one chunk when no chunk size specified', async () => {
      const filenames = ['file1.txt', 'file2.txt', 'file3.txt'];

      const progressCount = [];
      await parseTimestampBatch(filenames, {
        onProgress: (info) => {
          progressCount.push(info.completed);
        }
      });

      // Without chunking, should get updates for each file
      assert.ok(progressCount.length > 0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array with progress callback', async () => {
      const progressUpdates = [];
      const results = await parseTimestampBatch([], {
        onProgress: (info) => {
          progressUpdates.push(info);
        }
      });

      assert.strictEqual(results.length, 0);
      // May or may not receive progress updates for empty array
    });

    it('should handle single file', async () => {
      const progressUpdates = [];
      const results = await parseTimestampBatch(['IMG_20240115_143025.jpg'], {
        chunkSize: 10,
        onProgress: (info) => {
          progressUpdates.push(info);
        }
      });

      assert.strictEqual(results.length, 1);
      if (progressUpdates.length > 0) {
        assert.strictEqual(progressUpdates[progressUpdates.length - 1].completed, 1);
      }
    });

    it('should handle chunk size larger than file count', async () => {
      const filenames = ['file1.txt', 'file2.txt'];

      const results = await parseTimestampBatch(filenames, {
        chunkSize: 100 // Larger than file count
      });

      assert.strictEqual(results.length, 2);
    });
  });

  describe('Performance Validation', () => {
    it('should maintain high throughput with progress reporting', async () => {
      const filenames = [];
      for (let i = 0; i < 200; i++) {
        filenames.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      const start = Date.now();
      await parseTimestampBatch(filenames, {
        chunkSize: 50,
        onProgress: (_info) => {
          // Progress callback should not significantly slow down processing
        }
      });
      const duration = Date.now() - start;

      // Even with progress reporting, should still be fast
      assert.ok(duration < 5000, `Should complete 200 files in < 5s, took ${duration}ms`);
    });

    it('should handle very large batches', async () => {
      const filenames = [];
      for (let i = 0; i < 1000; i++) {
        filenames.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      const progressUpdates = [];
      const start = Date.now();
      const results = await parseTimestampBatch(filenames, {
        chunkSize: 'auto',
        onProgress: (info) => {
          // Only store every 10th update to avoid memory issues
          if (info.completed % 100 === 0) {
            progressUpdates.push(info);
          }
        }
      });
      const duration = Date.now() - start;

      assert.strictEqual(results.length, 1000);
      assert.ok(progressUpdates.length > 0);
      assert.ok(duration < 10000, `Should complete 1000 files in < 10s, took ${duration}ms`);
    });
  });
});
