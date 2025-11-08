import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseTimestampBatch,
  parseAndGroupByConfidence,
  getBatchStats,
  filterByTimestamp
} from '../src/utils/batchProcessor.js';

describe('Batch Processor', () => {
  describe('parseTimestampBatch()', () => {
    it('should parse multiple filenames efficiently', async () => {
      const filenames = [
        'IMG_20240115_143025.jpg',
        'IMG_20240116_093015.jpg',
        'IMG_20240117_120000.jpg',
        'document.pdf',
        '2024-11-02-report.txt'
      ];

      const results = await parseTimestampBatch(filenames);

      assert.strictEqual(results.length, 5);
      assert.ok(results[0].date); // IMG has timestamp
      assert.ok(results[1].date); // IMG has timestamp
      assert.ok(results[2].date); // IMG has timestamp
      assert.ok(!results[3].date); // document.pdf has no timestamp
      assert.ok(results[4].date); // ISO date has timestamp
    });

    it('should include confidence scores by default', async () => {
      const filenames = [
        'IMG_20240115_143025.jpg',
        '2024-11-02-report.txt'
      ];

      const results = await parseTimestampBatch(filenames);

      assert.ok(results[0].confidence);
      assert.ok(results[1].confidence);
      assert.ok(results[0].confidence >= 0 && results[0].confidence <= 1);
      assert.ok(results[1].confidence >= 0 && results[1].confidence <= 1);
    });

    it('should respect dateFormat option', async () => {
      const filenames = ['02-11-2024-file.txt'];

      const dmyResults = await parseTimestampBatch(filenames, { dateFormat: 'dmy' });
      const mdyResults = await parseTimestampBatch(filenames, { dateFormat: 'mdy' });

      assert.strictEqual(dmyResults[0].date.getMonth(), 10); // November (0-indexed)
      assert.strictEqual(mdyResults[0].date.getMonth(), 1); // February (0-indexed)
    });

    it('should support allowTimeOnly option', async () => {
      const filenames = ['recording_14.30.25.m4a'];

      const results = await parseTimestampBatch(filenames, { allowTimeOnly: true });

      assert.ok(results[0].date);
      assert.strictEqual(results[0].date.getHours(), 14);
      assert.strictEqual(results[0].date.getMinutes(), 30);
      assert.strictEqual(results[0].date.getSeconds(), 25);
    });

    it('should handle empty array', async () => {
      const results = await parseTimestampBatch([]);
      assert.strictEqual(results.length, 0);
    });

    it('should handle array with no detectable timestamps', async () => {
      const filenames = ['document.pdf', 'readme.txt', 'photo.jpg'];
      const results = await parseTimestampBatch(filenames);

      assert.strictEqual(results.length, 3);
      assert.ok(!results[0].date);
      assert.ok(!results[1].date);
      assert.ok(!results[2].date);
    });
  });

  describe('parseAndGroupByConfidence()', () => {
    it('should group results by confidence levels', async () => {
      const filenames = [
        'IMG_20240115_143025.jpg',      // High confidence (camera format)
        '2024-11-02-14-30-25-file.txt', // High confidence (ISO)
        '02-11-2024-report.txt',        // Medium confidence (ambiguous)
        '2024-file.txt',                // Low confidence (year-only)
        'document.pdf'                  // No timestamp
      ];

      const grouped = await parseAndGroupByConfidence(filenames);

      assert.ok(grouped.high.length >= 1); // At least camera/ISO formats
      assert.ok(grouped.none.length >= 1); // document.pdf
      assert.ok(Array.isArray(grouped.medium));
      assert.ok(Array.isArray(grouped.low));
      assert.ok(Array.isArray(grouped.veryLow));
    });

    it('should correctly categorize high confidence timestamps', async () => {
      const filenames = [
        'IMG_20240115_143025.jpg',
        'Screenshot 2024-11-02 at 14.30.25.png'
      ];

      const grouped = await parseAndGroupByConfidence(filenames);

      // Camera and screenshot formats should be high confidence
      assert.ok(grouped.high.length >= 1);
    });

    it('should handle batch with only no-timestamp files', async () => {
      const filenames = ['doc1.pdf', 'doc2.txt', 'photo.jpg'];
      const grouped = await parseAndGroupByConfidence(filenames);

      assert.strictEqual(grouped.none.length, 3);
      assert.strictEqual(grouped.high.length, 0);
      assert.strictEqual(grouped.medium.length, 0);
      assert.strictEqual(grouped.low.length, 0);
    });
  });

  describe('getBatchStats()', () => {
    it('should calculate statistics for batch', async () => {
      const filenames = [
        'IMG_20240115_143025.jpg',
        '2024-11-02-report.txt',
        'document.pdf',
        'Screenshot 2024-11-02 at 14.30.25.png'
      ];

      const stats = await getBatchStats(filenames);

      assert.strictEqual(stats.total, 4);
      assert.ok(stats.detected >= 3); // At least 3 with timestamps
      assert.ok(stats.notDetected >= 1); // document.pdf
      assert.ok(stats.avgConfidence >= 0 && stats.avgConfidence <= 1);
      assert.ok(typeof stats.types === 'object');
      assert.ok(typeof stats.precisions === 'object');
    });

    it('should track type distribution', async () => {
      const filenames = [
        'IMG_20240115_143025.jpg',
        'IMG_20240116_093015.jpg',
        '2024-11-02-report.txt'
      ];

      const stats = await getBatchStats(filenames);

      assert.ok(stats.types); // Should have type distribution
      assert.ok(Object.keys(stats.types).length > 0);
    });

    it('should calculate average confidence', async () => {
      const filenames = [
        'IMG_20240115_143025.jpg',
        'IMG_20240116_093015.jpg'
      ];

      const stats = await getBatchStats(filenames);

      assert.ok(stats.avgConfidence > 0);
      assert.ok(stats.avgConfidence <= 1);
    });

    it('should handle empty batch', async () => {
      const stats = await getBatchStats([]);

      assert.strictEqual(stats.total, 0);
      assert.strictEqual(stats.detected, 0);
      assert.strictEqual(stats.notDetected, 0);
      assert.strictEqual(stats.avgConfidence, 0);
    });

    it('should count ambiguous timestamps', async () => {
      const filenames = [
        '01-12-2024-file.txt', // Ambiguous
        '02-11-2024-file.txt'  // Ambiguous
      ];

      const stats = await getBatchStats(filenames, { dateFormat: 'dmy' });

      assert.ok(stats.ambiguous >= 0); // Should track ambiguous count
    });
  });

  describe('filterByTimestamp()', () => {
    it('should separate files with and without timestamps', async () => {
      const filenames = [
        'IMG_20240115_143025.jpg',
        'document.pdf',
        '2024-11-02-report.txt',
        'readme.txt'
      ];

      const filtered = await filterByTimestamp(filenames);

      assert.ok(filtered.withTimestamp.length >= 2); // At least IMG and ISO
      assert.ok(filtered.withoutTimestamp.length >= 1); // At least document or readme
      assert.strictEqual(
        filtered.withTimestamp.length + filtered.withoutTimestamp.length,
        filenames.length
      );
    });

    it('should handle all files with timestamps', async () => {
      const filenames = [
        'IMG_20240115_143025.jpg',
        '2024-11-02-report.txt'
      ];

      const filtered = await filterByTimestamp(filenames);

      assert.strictEqual(filtered.withTimestamp.length, 2);
      assert.strictEqual(filtered.withoutTimestamp.length, 0);
    });

    it('should handle no files with timestamps', async () => {
      const filenames = ['doc1.pdf', 'doc2.txt'];
      const filtered = await filterByTimestamp(filenames);

      assert.strictEqual(filtered.withTimestamp.length, 0);
      assert.strictEqual(filtered.withoutTimestamp.length, 2);
    });
  });

  describe('Performance', () => {
    it('should handle large batches efficiently', async () => {
      // Generate 1000 filenames
      const filenames = [];
      for (let i = 0; i < 1000; i++) {
        filenames.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
      }

      const start = Date.now();
      const results = await parseTimestampBatch(filenames);
      const duration = Date.now() - start;

      assert.strictEqual(results.length, 1000);
      assert.ok(duration < 5000, `Should complete in < 5s, took ${duration}ms`);
    });

    it('should handle mixed large batches', async () => {
      const filenames = [];
      for (let i = 0; i < 500; i++) {
        filenames.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
        filenames.push(`2024-11-${String((i % 28) + 1).padStart(2, '0')}-file-${i}.txt`);
      }

      const start = Date.now();
      const stats = await getBatchStats(filenames);
      const duration = Date.now() - start;

      assert.strictEqual(stats.total, 1000);
      assert.ok(duration < 5000, `Should complete in < 5s, took ${duration}ms`);
    });
  });
});
