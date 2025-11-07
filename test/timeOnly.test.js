/**
 * Tests for time-only format support (allowTimeOnly option)
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimestampFromName } from '../src/utils/timestampParser.js';

describe('Time-only format support', () => {
  test('should return null for time-only by default (allowTimeOnly=false)', () => {
    const result = parseTimestampFromName('recording_14.30.25.m4a');
    assert.equal(result, null);
  });

  test('should parse time-only with allowTimeOnly=true', () => {
    const result = parseTimestampFromName('recording_14.30.25.m4a', { allowTimeOnly: true });
    assert.notEqual(result, null);
    assert.equal(result.getHours(), 14);
    assert.equal(result.getMinutes(), 30);
    assert.equal(result.getSeconds(), 25);

    // Should use current date
    const now = new Date();
    assert.equal(result.getFullYear(), now.getFullYear());
    assert.equal(result.getMonth(), now.getMonth());
    assert.equal(result.getDate(), now.getDate());
  });

  test('should parse HH.MM.SS format with dots', () => {
    const result = parseTimestampFromName('audio_10.15.30.mp3', { allowTimeOnly: true });
    assert.notEqual(result, null);
    assert.equal(result.getHours(), 10);
    assert.equal(result.getMinutes(), 15);
    assert.equal(result.getSeconds(), 30);
  });

  test('should parse HH-MM-SS format with dashes', () => {
    const result = parseTimestampFromName('voice_23-45-59.wav', { allowTimeOnly: true });
    assert.notEqual(result, null);
    assert.equal(result.getHours(), 23);
    assert.equal(result.getMinutes(), 45);
    assert.equal(result.getSeconds(), 59);
  });

  test('should parse HH_MM_SS format with underscores', () => {
    const result = parseTimestampFromName('note_08_15_42.ogg', { allowTimeOnly: true });
    assert.notEqual(result, null);
    assert.equal(result.getHours(), 8);
    assert.equal(result.getMinutes(), 15);
    assert.equal(result.getSeconds(), 42);
  });

  test('should validate time ranges', () => {
    // Invalid hour
    const invalid1 = parseTimestampFromName('recording_25.30.25.m4a', { allowTimeOnly: true });
    assert.equal(invalid1, null);

    // Invalid minute
    const invalid2 = parseTimestampFromName('recording_14.60.25.m4a', { allowTimeOnly: true });
    assert.equal(invalid2, null);

    // Valid edge case: 23:59:59
    const valid = parseTimestampFromName('recording_23.59.59.m4a', { allowTimeOnly: true });
    assert.notEqual(valid, null);
    assert.equal(valid.getHours(), 23);
    assert.equal(valid.getMinutes(), 59);
    assert.equal(valid.getSeconds(), 59);
  });

  test('should prefer full date-time over time-only', () => {
    // When both date and time are present, should use full date-time (not today's date)
    const result = parseTimestampFromName('2024-01-15_14.30.25.m4a', { allowTimeOnly: true });
    assert.notEqual(result, null);
    assert.equal(result.getFullYear(), 2024);
    assert.equal(result.getMonth(), 0); // January
    assert.equal(result.getDate(), 15);
    assert.equal(result.getHours(), 14);
    assert.equal(result.getMinutes(), 30);
    assert.equal(result.getSeconds(), 25);
  });

  test('should mark time-only results with timeOnly flag', () => {
    const result = parseTimestampFromName('recording_14.30.25.m4a', { allowTimeOnly: true });
    assert.notEqual(result, null);
    assert.equal(result.timeOnly, true);
    assert.equal(result.precision, 'time');
  });

  test('should not set timeOnly flag for full date-time', () => {
    const result = parseTimestampFromName('2024-11-07_14.30.25.m4a', { allowTimeOnly: true });
    assert.notEqual(result, null);
    assert.equal(result.timeOnly, undefined);
  });

  test('should handle compact HHMMSS format', () => {
    const result = parseTimestampFromName('Voix_143025.m4a', { allowTimeOnly: true });
    assert.notEqual(result, null);
    assert.equal(result.getHours(), 14);
    assert.equal(result.getMinutes(), 30);
    assert.equal(result.getSeconds(), 25);
  });
});
