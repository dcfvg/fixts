import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseTimestampFromName } from '../src/utils/timestampParser.js';

describe('timestampUtils - v1.1 features', () => {
  describe('parseTimestampFromName with dateFormat option', () => {
    it('should parse ambiguous date as DD-MM-YYYY by default', () => {
      const result = parseTimestampFromName('photo 01-02-2023.jpg');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2023);
      assert.strictEqual(result.getMonth(), 1); // February (0-indexed)
      assert.strictEqual(result.getDate(), 1);
    });

    it('should parse ambiguous date as DD-MM-YYYY with dateFormat=dmy', () => {
      const result = parseTimestampFromName('photo 01-02-2023.jpg', { dateFormat: 'dmy' });
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2023);
      assert.strictEqual(result.getMonth(), 1); // February (0-indexed)
      assert.strictEqual(result.getDate(), 1);
    });

    it('should parse ambiguous date as MM-DD-YYYY with dateFormat=mdy', () => {
      const result = parseTimestampFromName('photo 01-02-2023.jpg', { dateFormat: 'mdy' });
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2023);
      assert.strictEqual(result.getMonth(), 0); // January (0-indexed)
      assert.strictEqual(result.getDate(), 2);
    });

    it('should handle 05-06-2022 as DD-MM-YYYY by default', () => {
      const result = parseTimestampFromName('document 05-06-2022.pdf');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2022);
      assert.strictEqual(result.getMonth(), 5); // June (0-indexed)
      assert.strictEqual(result.getDate(), 5);
    });

    it('should handle 05-06-2022 as MM-DD-YYYY with dateFormat=mdy', () => {
      const result = parseTimestampFromName('document 05-06-2022.pdf', { dateFormat: 'mdy' });
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2022);
      assert.strictEqual(result.getMonth(), 4); // May (0-indexed)
      assert.strictEqual(result.getDate(), 6);
    });

    it('should not be affected by dateFormat when day > 12', () => {
      const resultDMY = parseTimestampFromName('photo 15-03-2023.jpg', { dateFormat: 'dmy' });
      const resultMDY = parseTimestampFromName('photo 15-03-2023.jpg', { dateFormat: 'mdy' });

      // Day is 15, which can only be a day, so both should give same result
      assert.strictEqual(resultDMY.getFullYear(), 2023);
      assert.strictEqual(resultDMY.getMonth(), 2); // March
      assert.strictEqual(resultDMY.getDate(), 15);

      assert.strictEqual(resultMDY.getFullYear(), 2023);
      assert.strictEqual(resultMDY.getMonth(), 2); // March
      assert.strictEqual(resultMDY.getDate(), 15);
    });

    it('should not be affected by dateFormat when month > 12', () => {
      const resultDMY = parseTimestampFromName('photo 05-13-2023.jpg', { dateFormat: 'dmy' });
      const resultMDY = parseTimestampFromName('photo 05-13-2023.jpg', { dateFormat: 'mdy' });

      // Month is 13, which can only be interpreted as MM-DD-YYYY
      assert.strictEqual(resultDMY.getFullYear(), 2023);
      assert.strictEqual(resultDMY.getMonth(), 4); // May
      assert.strictEqual(resultDMY.getDate(), 13);

      assert.strictEqual(resultMDY.getFullYear(), 2023);
      assert.strictEqual(resultMDY.getMonth(), 4); // May
      assert.strictEqual(resultMDY.getDate(), 13);
    });

    it('should handle edge case 01-01 (always ambiguous)', () => {
      const resultDMY = parseTimestampFromName('photo 01-01-2023.jpg', { dateFormat: 'dmy' });
      const resultMDY = parseTimestampFromName('photo 01-01-2023.jpg', { dateFormat: 'mdy' });

      // Both should parse, but give same result since 01-01 is same either way
      assert.strictEqual(resultDMY.getFullYear(), 2023);
      assert.strictEqual(resultDMY.getMonth(), 0); // January
      assert.strictEqual(resultDMY.getDate(), 1);

      assert.strictEqual(resultMDY.getFullYear(), 2023);
      assert.strictEqual(resultMDY.getMonth(), 0); // January
      assert.strictEqual(resultMDY.getDate(), 1);
    });

    it('should handle WhatsApp "at" separator format', () => {
      const result = parseTimestampFromName('WhatsApp Image 2021-08-01 at 13.15.13.jpeg');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2021);
      assert.strictEqual(result.getMonth(), 7); // August
      assert.strictEqual(result.getDate(), 1);
      assert.strictEqual(result.getHours(), 13);
      assert.strictEqual(result.getMinutes(), 15);
      assert.strictEqual(result.getSeconds(), 13);
    });

    it('should handle signal compact time format', () => {
      const result = parseTimestampFromName('signal-2021-06-06-173515.aac');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2021);
      assert.strictEqual(result.getMonth(), 5); // June
      assert.strictEqual(result.getDate(), 6);
      assert.strictEqual(result.getHours(), 17);
      assert.strictEqual(result.getMinutes(), 35);
      assert.strictEqual(result.getSeconds(), 15);
    });

    it('should handle DD.MM.YYYY format', () => {
      const result = parseTimestampFromName('screenshot 04.04.2025');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2025);
      assert.strictEqual(result.getMonth(), 3); // April
      assert.strictEqual(result.getDate(), 4);
    });
  });
});
