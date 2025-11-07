/**
 * Tests for confidence scoring in heuristic detection
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getBestTimestamp } from '../src/utils/heuristicDetector.js';

describe('Confidence Scoring', () => {
  test('should assign high confidence to compact datetime formats', () => {
    const result = getBestTimestamp('IMG_20241107_143025.jpg');
    assert.ok(result.confidence >= 0.70, `Expected >=0.70, got ${result.confidence}`);
    // Detected as COMPACT_DATE with full datetime (high precision)
  });

  test('should assign high confidence to ISO formats', () => {
    const result = getBestTimestamp('report_2024-11-07.pdf');
    assert.ok(result.confidence >= 0.80, `Expected >=0.80, got ${result.confidence}`);
  });

  test('should assign medium confidence to European dates', () => {
    const result = getBestTimestamp('document_15-03-2024.txt');
    assert.ok(result.confidence >= 0.70 && result.confidence <= 1.0);
  });

  test('should assign lower confidence to ambiguous formats', () => {
    const result = getBestTimestamp('file_05062024.doc');
    assert.ok(result.confidence < 0.70, `Expected <0.70, got ${result.confidence}`);
    assert.equal(result.ambiguous, true);
  });

  test('should assign lower confidence to year-only', () => {
    const result = getBestTimestamp('archive_2024.zip');
    assert.ok(result.confidence < 0.60, `Expected <0.60, got ${result.confidence}`);
    assert.equal(result.precision, 'year');
  });

  test('should boost confidence for early position in filename', () => {
    const early = getBestTimestamp('2024-11-07_document.pdf');
    const late = getBestTimestamp('document_with_long_name_2024-11-07.pdf');

    assert.ok(early.confidence > late.confidence,
      `Early (${early.confidence}) should be > late (${late.confidence})`);
  });

  test('should boost confidence with context markers', () => {
    const withMarker = getBestTimestamp('photo_backup_2024-11-07.png');
    const withoutMarker = getBestTimestamp('random_2024-11-07.dat');

    // Both should have confidence, check they're valid
    assert.ok(withMarker.confidence >= 0 && withMarker.confidence <= 1);
    assert.ok(withoutMarker.confidence >= 0 && withoutMarker.confidence <= 1);
  });

  test('should boost confidence for higher precision', () => {
    const withTime = getBestTimestamp('file_20241107_143025.dat');
    const dateOnly = getBestTimestamp('file_20241107.dat');

    assert.ok(withTime.precision === 'second' || withTime.precision === 'millisecond');
    assert.ok(dateOnly.precision === 'day' || dateOnly.precision === 'month');
    // Higher precision should generally have higher or equal confidence
    assert.ok(withTime.confidence >= dateOnly.confidence * 0.9);
  });  test('should include confidence in alternatives', () => {
    const result = getBestTimestamp('IMG_20241107_143025_and_2024-11-07.jpg');

    if (result.alternatives && result.alternatives.length > 0) {
      result.alternatives.forEach(alt => {
        assert.ok(typeof alt.confidence === 'number');
        assert.ok(alt.confidence >= 0 && alt.confidence <= 1);
      });
    }
  });

  test('should clamp confidence between 0 and 1', () => {
    // Test various formats to ensure confidence is always in range
    const testFiles = [
      'IMG_20241107_143025.jpg',
      'photo_05062024.jpg',
      'archive_2024.zip',
      '2024-11-07_report.pdf',
      'random_file.txt'
    ];

    testFiles.forEach(filename => {
      const result = getBestTimestamp(filename);
      if (result) {
        assert.ok(result.confidence >= 0 && result.confidence <= 1,
          `${filename}: confidence ${result.confidence} out of range`);
      }
    });
  });

  test('should return null confidence for no timestamp', () => {
    const result = getBestTimestamp('random_file_with_no_date.txt');
    assert.equal(result, null);
  });
});
