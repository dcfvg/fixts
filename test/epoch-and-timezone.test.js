import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getBestTimestamp, formatTimestamp } from '../src/utils/heuristicDetector.js';

describe('Epoch and timezone detection', () => {
  it('detects ISO datetime with Z timezone suffix', () => {
    const filename = '2024-03-15T12:30:45Z_note.txt';
    const result = getBestTimestamp(filename);

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.timezone, 'Z');
    assert.equal(result.utcOffsetMinutes, 0);
    assert.equal(result.hour, 12);
    assert.equal(result.precision, 'second');
    assert.ok(formatTimestamp(result).endsWith('Z'));
  });

  it('detects timezone offsets with separators', () => {
    const filename = 'report_2024-03-15 12.30.45 +0200.txt';
    const result = getBestTimestamp(filename);

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.timezone, '+0200');
    assert.equal(result.utcOffsetMinutes, 120);
    assert.equal(result.hour, 12);
  });

  it('parses Unix millisecond timestamps within modern range', () => {
    const filename = 'backup_1710000000000.tar';
    const result = getBestTimestamp(filename);
    const expected = new Date(1710000000000);

    assert.ok(result, 'Unix millisecond timestamp should be detected');
    assert.equal(result.type, 'UNIX_MILLISECONDS');
    assert.equal(result.year, expected.getUTCFullYear());
    assert.equal(result.month, expected.getUTCMonth() + 1);
    assert.equal(result.day, expected.getUTCDate());
  });

  it('ignores resolution-like patterns as years', () => {
    const result = getBestTimestamp('video_1920x1080.mp4');
    assert.equal(result, null);
  });

  it('detects ISO datetime with milliseconds and offset', () => {
    const filename = 'clip_2024-03-15T12:30:45.123+02:00.mp4';
    const result = getBestTimestamp(filename, { debug: true });

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.millisecond, 123);
    assert.equal(result.timezone, '+02:00');
    assert.equal(result.precision, 'millisecond');
  });

  it('detects ISO datetime with mixed separators and Z', () => {
    const filename = '2024-03-15T12.30.45Z';
    const result = getBestTimestamp(filename);

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.timezone, 'Z');
    assert.equal(result.hour, 12);
    assert.equal(result.minute, 30);
    assert.equal(result.second, 45);
  });

  it('detects ISO datetime with short offset', () => {
    const filename = '2024-03-15T12:30:45+02';
    const result = getBestTimestamp(filename);

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.timezone, '+02');
  });

  it('detects compact datetime with timezone', () => {
    const filename = '20240315 123045+0200';
    const result = getBestTimestamp(filename);

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.year, 2024);
    assert.equal(result.month, 3);
    assert.equal(result.day, 15);
    assert.equal(result.timezone, '+0200');
  });

  it('detects month-name dates (DMY)', () => {
    const filename = '15-Mar-2024_report.txt';
    const result = getBestTimestamp(filename);

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.month, 3);
    assert.equal(result.day, 15);
    assert.equal(result.year, 2024);
  });

  it('detects month-name dates (MDY)', () => {
    const filename = 'Mar_15_2024_notes.txt';
    const result = getBestTimestamp(filename);

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.month, 3);
    assert.equal(result.day, 15);
    assert.equal(result.year, 2024);
  });

  it('detects month-name dates with comma', () => {
    const filename = 'Mar 15, 2024 invoice.pdf';
    const result = getBestTimestamp(filename);

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.month, 3);
    assert.equal(result.day, 15);
    assert.equal(result.year, 2024);
  });

  it('detects long month names with time', () => {
    const filename = '15 March 2024 12h34 schedule.txt';
    const result = getBestTimestamp(filename);

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.hour, 12);
    assert.equal(result.minute, 34);
  });

  it('detects French month names', () => {
    const filename = '15-mars-2024_note.txt';
    const result = getBestTimestamp(filename);

    assert.ok(result, 'Timestamp should be detected');
    assert.equal(result.month, 3);
    assert.equal(result.day, 15);
  });

  it('detects exotic timezone offsets', () => {
    const plus = getBestTimestamp('2024-03-15T12:30:45+0930');
    const minus = getBestTimestamp('2024-03-15T12:30:45-0330');

    assert.ok(plus && plus.timezone === '+0930');
    assert.ok(minus && minus.timezone === '-0330');
  });

  it('skips GUID-like identifiers', () => {
    const filename = '123e4567-e89b-12d3-a456-426614174000.txt';
    const result = getBestTimestamp(filename);
    assert.equal(result, null);
  });

  it('skips UUID without dashes', () => {
    const filename = '123e4567e89b12d3a456426614174000.txt';
    const result = getBestTimestamp(filename);
    assert.equal(result, null);
  });

  it('skips long hashes/base36 ids', () => {
    const filename = 'file_ABCDEFGH1234567890ABCDEFGH1234567890.txt';
    const result = getBestTimestamp(filename);
    assert.equal(result, null);
  });

  it('skips resolution-like tags', () => {
    const filename = 'clip_720p_sample.mp4';
    const result = getBestTimestamp(filename);
    assert.equal(result, null);
  });
});
