import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatDate, generateNewName } from '../src/core/formatter.js';
import { parseTimestampFromName, parseTimestamp } from '../src/utils/timestampParser.js';

describe('timestampUtils', () => {
  describe('parseTimestampFromName', () => {
    it('should parse ISO date format', () => {
      const result = parseTimestampFromName('document 2023-12-15.pdf');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2023);
      assert.strictEqual(result.getMonth(), 11); // December is 11
      assert.strictEqual(result.getDate(), 15);
    });

    it('should parse European date format with dots', () => {
      const result = parseTimestampFromName('photo 15.08.2024.jpg');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2024);
      assert.strictEqual(result.getMonth(), 7); // August is 7
      assert.strictEqual(result.getDate(), 15);
    });

    it('should parse compact date-time format', () => {
      const result = parseTimestampFromName('IMG_20240815_092345.jpg');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2024);
      assert.strictEqual(result.getMonth(), 7);
      assert.strictEqual(result.getDate(), 15);
      assert.strictEqual(result.getHours(), 9);
      assert.strictEqual(result.getMinutes(), 23);
      assert.strictEqual(result.getSeconds(), 45);
    });

    it('should parse year-month format', () => {
      const result = parseTimestampFromName('notes_2024-05.txt');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2024);
      assert.strictEqual(result.getMonth(), 4); // May is 4
    });

    it('should parse year-only format', () => {
      const result = parseTimestampFromName('report-2023.pdf');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2023);
    });

    it('should parse VID format', () => {
      const result = parseTimestampFromName('VID_20230815_143000.mp4');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2023);
      assert.strictEqual(result.getMonth(), 7);
      assert.strictEqual(result.getDate(), 15);
    });

    it('should parse PXL format', () => {
      const result = parseTimestampFromName('PXL_20240101_090000.jpg');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2024);
      assert.strictEqual(result.getMonth(), 0); // January is 0
      assert.strictEqual(result.getDate(), 1);
    });

    it('should parse REC format', () => {
      const result = parseTimestampFromName('REC_20221225_180000.m4a');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2022);
      assert.strictEqual(result.getMonth(), 11); // December is 11
      assert.strictEqual(result.getDate(), 25);
    });

    it('should parse European format with comma separator', () => {
      // Comma-separated datetime is handled by heuristic detection
      const result = parseTimestamp('recording 07-10-2025,11-09.wav');
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getFullYear(), 2025);
      assert.strictEqual(result.getMonth(), 9); // October is 9
      assert.strictEqual(result.getDate(), 7);
      assert.strictEqual(result.getHours(), 11);
      assert.strictEqual(result.getMinutes(), 9);
    });

    it('should return null for files without timestamps', () => {
      const result = parseTimestampFromName('document.pdf');
      assert.strictEqual(result, null);
    });
  });
});

describe('formatter', () => {
  describe('formatDate', () => {
    it('should format date with default template', () => {
      const date = new Date('2024-08-15T09:23:45');
      const result = formatDate(date, 'yyyy-mm-dd hh.MM.ss', { hasTime: true, hasDay: true, hasMonth: true, hasYear: true });
      assert.ok(result.includes('2024'));
      assert.ok(result.includes('08'));
      assert.ok(result.includes('15'));
    });

    it('should format date without time when not present', () => {
      const date = new Date('2024-08-15');
      const result = formatDate(date, 'yyyy-mm-dd hh.MM.ss', { hasTime: false, hasDay: true, hasMonth: true, hasYear: true });
      assert.ok(result.includes('2024'));
      assert.ok(result.includes('08'));
      assert.ok(result.includes('15'));
      assert.ok(!result.includes('00.00.00'));
    });

    it('should format year-only', () => {
      const date = new Date('2023-01-01');
      const result = formatDate(date, 'yyyy-mm-dd hh.MM.ss', { hasTime: false, hasDay: false, hasMonth: false, hasYear: true });
      assert.strictEqual(result, '2023');
    });

    it('should format year-month', () => {
      const date = new Date('2024-05-01');
      const result = formatDate(date, 'yyyy-mm-dd hh.MM.ss', { hasTime: false, hasDay: false, hasMonth: true, hasYear: true });
      assert.strictEqual(result, '2024-05');
    });
  });

  describe('generateNewName', () => {
    it('should generate new name for IMG format', () => {
      const result = generateNewName('IMG_20240815_092345.jpg');
      assert.ok(result.startsWith('2024-08-15'));
      assert.ok(result.includes('IMG'));
      assert.ok(result.endsWith('.jpg'));
    });

    it('should generate new name for European date', () => {
      const result = generateNewName('photo 15.08.2024.jpg');
      assert.ok(result.startsWith('2024-08-15'));
      assert.ok(result.includes('photo'));
      assert.ok(result.endsWith('.jpg'));
      assert.ok(!result.includes('15.08'));
    });

    it('should generate new name for year-only', () => {
      const result = generateNewName('report-2023.pdf');
      assert.ok(result.startsWith('2023'));
      assert.ok(result.includes('report'));
      assert.ok(result.endsWith('.pdf'));
    });

    it('should generate new name for comma-separated format', () => {
      // Comma-separated datetime is handled by heuristic detection
      const result = generateNewName('recording 07-10-2025,11-09.wav', 'yyyy-mm-dd hh.MM.ss');
      assert.ok(result.includes('2025-10-07'));
      assert.ok(result.includes('11.09'));
      assert.ok(result.includes('recording'));
      assert.ok(result.endsWith('.wav'));
    });

    it('should return null for files without timestamps', () => {
      const result = generateNewName('document.pdf');
      assert.strictEqual(result, null);
    });

    it('should handle dots in filename', () => {
      const result = generateNewName('meeting.2023.12.15.notes.txt');
      assert.ok(result.startsWith('2023-12-15'));
      assert.ok(result.includes('meeting.notes'));
      assert.ok(!result.includes('..'));
    });

    it('should preserve content after timestamp removal', () => {
      const result = generateNewName('backup 2020-01-01 08.30.00.tar.gz');
      assert.ok(result.includes('backup'));
      assert.ok(result.endsWith('.tar.gz'));
      assert.ok(!result.includes('backup .tar'));
    });

    // New tests for v1.1 features

    it('should handle DD.MM.YYYY format without duplication (Pattern 8)', () => {
      const result = generateNewName('screenshot 04.04.2025');
      assert.strictEqual(result, '2025-04-04 - screenshot');
      assert.ok(!result.includes('04.04.2025')); // Date should not be duplicated
    });

    it('should handle DD.MM.YYYY format with extension', () => {
      const result = generateNewName('Capture ecran 04.04.2025.png');
      assert.strictEqual(result, '2025-04-04 - Capture ecran.png');
      assert.ok(!result.includes('04.04.2025')); // Date should be cleaned
    });

    it('should parse ambiguous date as DD-MM-YYYY by default (European)', () => {
      const result = generateNewName('photo 01-02-2023.jpg');
      assert.strictEqual(result, '2023-02-01 - photo.jpg'); // 01 February 2023
    });

    it('should parse ambiguous date as DD-MM-YYYY when dateFormat=dmy', () => {
      const result = generateNewName('photo 01-02-2023.jpg', 'yyyy-mm-dd hh.MM.ss', { dateFormat: 'dmy' });
      assert.strictEqual(result, '2023-02-01 - photo.jpg'); // 01 February 2023
    });

    it('should parse ambiguous date as MM-DD-YYYY when dateFormat=mdy', () => {
      const result = generateNewName('photo 01-02-2023.jpg', 'yyyy-mm-dd hh.MM.ss', { dateFormat: 'mdy' });
      assert.strictEqual(result, '2023-01-02 - photo.jpg'); // 02 January 2023
    });

    it('should not affect non-ambiguous dates with dateFormat option', () => {
      const resultDMY = generateNewName('photo 15-03-2023.jpg', 'yyyy-mm-dd hh.MM.ss', { dateFormat: 'dmy' });
      const resultMDY = generateNewName('photo 15-03-2023.jpg', 'yyyy-mm-dd hh.MM.ss', { dateFormat: 'mdy' });
      // Day > 12, so always interpreted as DD-MM-YYYY regardless of option
      assert.strictEqual(resultDMY, '2023-03-15 - photo.jpg');
      assert.strictEqual(resultMDY, '2023-03-15 - photo.jpg');
    });

    it('should handle WhatsApp format with "at" separator', () => {
      const result = generateNewName('WhatsApp Image 2021-08-01 at 13.15.13.jpeg');
      assert.strictEqual(result, '2021-08-01 13.15.13 - WhatsApp Image.jpeg');
      assert.ok(!result.includes(' at ')); // "at" separator should be cleaned
    });

    it('should handle signal compact time format', () => {
      const result = generateNewName('signal-2021-06-06-173515.aac');
      assert.strictEqual(result, '2021-06-06 17.35.15 - signal.aac');
    });

    it('should not treat numeric dots as extensions', () => {
      // .2025 should not be considered an extension
      const result = generateNewName('file 04.04.2025');
      assert.ok(result.startsWith('2025-04-04'));
      assert.ok(!result.includes('.2025'));
    });
  });
});
