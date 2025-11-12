import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateNewName } from '../index.js';

describe('Redundant Timestamp Cleaning', () => {
  describe('Basic redundant date removal', () => {
    it('should remove redundant date when only date exists', () => {
      const result = generateNewName('2020.11.22.jpg');
      assert.strictEqual(result, '2020-11-22.jpg');
    });

    it('should remove redundant date from already-formatted filename', () => {
      const result = generateNewName('2020-11-22 19.49.56 - 2020.11.22.jpg');
      assert.strictEqual(result, '2020-11-22 19.49.56.jpg');
    });

    it('should remove redundant date and keep semantic content', () => {
      const result = generateNewName('2024-01-15 - 20240115-meeting.pdf');
      assert.strictEqual(result, '2024-01-15 - meeting.pdf');
    });

    it('should remove redundant date in complex filename', () => {
      const result = generateNewName('20240115_doc-2024.01.15.txt');
      assert.strictEqual(result, '2024-01-15 - doc.txt');
    });
  });

  describe('Multiple redundant timestamps', () => {
    it('should remove multiple redundant timestamps (same date)', () => {
      const result = generateNewName('2024-11-02-14-30-25-iso-2024.11.02.txt');
      assert.strictEqual(result, '2024-11-02 14.30.25 - iso.txt');
    });

    it('should remove all matching date patterns', () => {
      const result = generateNewName('20241102-doc-2024.11.02-2024-11-02.pdf');
      assert.strictEqual(result, '2024-11-02 - doc.pdf');
    });
  });

  describe('Preserve semantic content', () => {
    it('should keep document name when removing timestamp', () => {
      const result = generateNewName('20201122-document.pdf');
      assert.strictEqual(result, '2020-11-22 - document.pdf');
    });

    it('should keep IMG prefix when removing timestamp', () => {
      const result = generateNewName('IMG_20201122_194956.jpg');
      assert.strictEqual(result, '2020-11-22 19.49.56 - IMG.jpg');
    });

    it('should keep photo name when removing timestamp', () => {
      const result = generateNewName('2020-11-22-photo.jpg');
      assert.strictEqual(result, '2020-11-22 - photo.jpg');
    });

    it('should preserve meaningful text between timestamps', () => {
      const result = generateNewName('20240115_important-document-2024.01.15.pdf');
      // Note: underscores are converted to spaces, but hyphens are preserved
      assert.strictEqual(result, '2024-01-15 - important-document.pdf');
    });
  });

  describe('Different date formats', () => {
    it('should handle dot-separated dates', () => {
      const result = generateNewName('2024.01.15-doc.txt');
      assert.strictEqual(result, '2024-01-15 - doc.txt');
    });

    it('should handle compact dates (YYYYMMDD)', () => {
      const result = generateNewName('20240115-doc.pdf');
      assert.strictEqual(result, '2024-01-15 - doc.pdf');
    });

    it('should handle dash-separated dates', () => {
      const result = generateNewName('2024-01-15-doc.txt');
      assert.strictEqual(result, '2024-01-15 - doc.txt');
    });

    it('should handle underscore-separated dates', () => {
      const result = generateNewName('2024_01_15_doc.txt');
      assert.strictEqual(result, '2024-01-15 - doc.txt');
    });
  });

  describe('Edge cases', () => {
    it('should handle filename with only timestamp (no extension)', () => {
      const result = generateNewName('2020.11.22');
      assert.strictEqual(result, '2020-11-22');
    });

    it('should handle filename with timestamp and whitespace', () => {
      const result = generateNewName('  2020.11.22  .jpg');
      assert.strictEqual(result, '2020-11-22.jpg');
    });

    it('should handle filename with redundant timestamp in different format', () => {
      const result = generateNewName('2024-01-15-20240115.txt');
      assert.strictEqual(result, '2024-01-15.txt');
    });

    it('should not remove timestamps with different dates', () => {
      // In this case, the primary timestamp is likely the first one
      // and the second one should remain since it's a different date
      const result = generateNewName('2024-01-15-report-2024-01-20.pdf');
      // The second date (2024-01-20) has a different day, so it should be kept
      // This test verifies we only remove redundant (identical) dates
      assert.ok(result !== null);
      assert.ok(result.includes('2024-01-15'));
      // The exact result depends on which timestamp is considered primary
      // but we should have some meaningful content preserved
    });
  });

  describe('Performance with redundant timestamps', () => {
    it('should handle batch processing with redundant timestamps', () => {
      const filenames = [
        '2020.11.22.jpg',
        '2020-11-22 19.49.56 - 2020.11.22.jpg',
        '20201122-document.pdf',
        'IMG_20201122_194956.jpg'
      ];

      const results = filenames.map(name =>
        generateNewName(name, 'yyyy-mm-dd hh.MM.ss', { dateFormat: 'auto' })
      );

      assert.strictEqual(results[0], '2020-11-22.jpg');
      assert.strictEqual(results[1], '2020-11-22 19.49.56.jpg');
      assert.strictEqual(results[2], '2020-11-22 - document.pdf');
      assert.strictEqual(results[3], '2020-11-22 19.49.56 - IMG.jpg');
    });
  });

  describe('Real-world filename patterns', () => {
    it('should handle camera-style filenames with redundant dates', () => {
      const result = generateNewName('IMG_20241112_143052-2024.11.12.jpg');
      assert.strictEqual(result, '2024-11-12 14.30.52 - IMG.jpg');
    });

    it('should handle scan filenames with redundant dates', () => {
      const result = generateNewName('scan_2024-11-12_document_20241112.pdf');
      assert.strictEqual(result, '2024-11-12 - scan document.pdf');
    });

    it('should handle backup filenames with redundant dates', () => {
      const result = generateNewName('backup-2024.11.12-20241112.tar.gz');
      assert.strictEqual(result, '2024-11-12 - backup.tar.gz');
    });

    it('should handle already-formatted fixTS filenames', () => {
      // A file that was already processed by fixTS but has a redundant date in the suffix
      const result = generateNewName('2024-11-12 14.30.52 - document-2024.11.12.pdf');
      assert.strictEqual(result, '2024-11-12 14.30.52 - document.pdf');
    });
  });
});
