import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectAmbiguity } from '../src/utils/ambiguityDetector.js';

describe('ambiguityDetector', () => {
  describe('detectAmbiguity', () => {
    it('should detect DD-MM-YYYY vs MM-DD-YYYY ambiguity', () => {
      const result = detectAmbiguity('document 03-05-2024.pdf');
      assert.ok(result !== null);
      assert.strictEqual(result.type, 'day-month-order');
      assert.strictEqual(result.first, 3);
      assert.strictEqual(result.second, 5);
      assert.strictEqual(result.pattern, '03-05-2024');
      assert.strictEqual(result.options.length, 2);
    });

    it('should detect ambiguity with underscores', () => {
      const result = detectAmbiguity('photo_01_12_2023.jpg');
      assert.ok(result !== null);
      assert.strictEqual(result.type, 'day-month-order');
      assert.strictEqual(result.first, 1);
      assert.strictEqual(result.second, 12);
    });

    it('should detect ambiguity with slashes', () => {
      const result = detectAmbiguity('backup 06/07/2025.tar');
      assert.ok(result !== null);
      assert.strictEqual(result.type, 'day-month-order');
      assert.strictEqual(result.first, 6);
      assert.strictEqual(result.second, 7);
    });

    it('should not detect ambiguity when day > 12', () => {
      const result = detectAmbiguity('file 15-08-2024.txt');
      assert.strictEqual(result, null);
    });

    it('should not detect ambiguity when month > 12', () => {
      const result = detectAmbiguity('file 08-15-2024.txt');
      assert.strictEqual(result, null);
    });

    // TODO: 2-digit year ambiguity not yet supported by heuristic
    // it('should detect 2-digit year ambiguity', () => {
    //   const result = detectAmbiguity('photo_240815_120000.jpg');
    //   assert.ok(result !== null);
    //   assert.strictEqual(result.type, 'two-digit-year');
    //   assert.strictEqual(result.year, 24);
    //   assert.strictEqual(result.pattern, '240815_120000');
    //   assert.strictEqual(result.options.length, 2);
    // });

    it('should return null for ISO format (no ambiguity)', () => {
      const result = detectAmbiguity('document 2024-08-15.pdf');
      assert.strictEqual(result, null);
    });

    it('should return null for files without dates', () => {
      const result = detectAmbiguity('regular-file.txt');
      assert.strictEqual(result, null);
    });

    it('should detect ambiguity in complex filenames', () => {
      const result = detectAmbiguity('IMG_05-06-2024_vacation_photo.jpg');
      assert.ok(result !== null);
      assert.strictEqual(result.type, 'day-month-order');
    });

    it('should handle edge case 01-01 (always ambiguous)', () => {
      const result = detectAmbiguity('new-year 01-01-2024.txt');
      assert.ok(result !== null);
      assert.strictEqual(result.type, 'day-month-order');
      assert.strictEqual(result.first, 1);
      assert.strictEqual(result.second, 1);
    });

    it('should handle edge case 12-12', () => {
      const result = detectAmbiguity('december 12-12-2023.log');
      assert.ok(result !== null);
      assert.strictEqual(result.type, 'day-month-order');
      assert.strictEqual(result.first, 12);
      assert.strictEqual(result.second, 12);
    });
  });
});
