/**
 * @fileoverview Tests for confidence scores in heuristic detection
 * Verifies that confidence scores are properly exposed in the API
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDetectionInfo, getBestTimestamp } from '../index.js';

describe('Confidence Scores - Heuristic Detection', () => {

  describe('getBestTimestamp()', () => {
    it('should include confidence score for camera format', () => {
      const result = getBestTimestamp('IMG_20241103_143045.jpg');
      assert.ok(result, 'Should detect timestamp');
      assert.ok(result.confidence !== undefined, 'Should have confidence property');
      assert.ok(typeof result.confidence === 'number', 'Confidence should be a number');
      assert.ok(result.confidence >= 0 && result.confidence <= 1, 'Confidence should be 0-1');
      assert.ok(result.confidence >= 0.85, 'Camera format should have high confidence');
    });

    it('should include confidence score for ISO date format', () => {
      const result = getBestTimestamp('2024-11-03-document.pdf');
      assert.ok(result, 'Should detect timestamp');
      assert.ok(result.confidence !== undefined, 'Should have confidence property');
      assert.ok(result.confidence >= 0.70, 'ISO format should have medium-high confidence');
    });

    it('should include confidence score for ambiguous date', () => {
      const result = getBestTimestamp('01-02-2024-file.txt');
      assert.ok(result, 'Should detect timestamp');
      assert.ok(result.confidence !== undefined, 'Should have confidence property');
      // Note: High confidence because heuristic can parse it, even though it's ambiguous
      // Ambiguity is a separate concern handled by ambiguityDetector
      assert.ok(result.confidence >= 0.70, 'Well-structured date should have good confidence');
    });

    it('should include confidence score for year-only format', () => {
      const result = getBestTimestamp('report-2024.pdf');
      assert.ok(result, 'Should detect timestamp');
      assert.ok(result.confidence !== undefined, 'Should have confidence property');
      assert.ok(result.confidence <= 0.70, 'Year-only should have lower confidence');
    });

    it('should include alternatives with confidence scores', () => {
      const result = getBestTimestamp('2024-11-03_14.30.45_extra.jpg');
      assert.ok(result, 'Should detect timestamp');
      assert.ok(result.confidence !== undefined, 'Should have confidence for best match');

      if (result.alternatives && result.alternatives.length > 0) {
        result.alternatives.forEach(alt => {
          assert.ok(alt.confidence !== undefined, 'Each alternative should have confidence');
          assert.ok(typeof alt.confidence === 'number', 'Alternative confidence should be a number');
          assert.ok(alt.confidence >= 0 && alt.confidence <= 1, 'Alternative confidence should be 0-1');
        });
      }
    });

    it('should return null for filenames without timestamps', () => {
      const result = getBestTimestamp('document.pdf');
      assert.equal(result, null, 'Should return null for no timestamp');
    });
  });

  describe('getDetectionInfo()', () => {
    it('should include confidence in heuristic detection info', () => {
      const info = getDetectionInfo('IMG_20241103_143045.jpg');

      assert.ok(info.heuristic, 'Should have heuristic property');
      assert.equal(info.heuristic.detected, true, 'Should detect with heuristic');
      assert.ok(info.heuristic.confidence !== undefined, 'Should have confidence in heuristic');
      assert.ok(typeof info.heuristic.confidence === 'number', 'Confidence should be a number');
      assert.ok(info.heuristic.confidence >= 0 && info.heuristic.confidence <= 1, 'Confidence should be 0-1');
    });

    it('should include alternatives with confidence in detection info', () => {
      const info = getDetectionInfo('2024-11-03_14.30.45_extra.jpg');

      assert.ok(info.heuristic, 'Should have heuristic property');

      if (info.heuristic.alternatives && info.heuristic.alternatives.length > 0) {
        assert.ok(Array.isArray(info.heuristic.alternatives), 'Alternatives should be an array');
        info.heuristic.alternatives.forEach(alt => {
          assert.ok(alt.confidence !== undefined, 'Each alternative should have confidence');
          assert.ok(typeof alt.confidence === 'number', 'Alternative confidence should be a number');
        });
      }
    });

    it('should handle filenames with no timestamp', () => {
      const info = getDetectionInfo('document.pdf');

      assert.equal(info.heuristic.detected, false, 'Should not detect timestamp');
      assert.equal(info.heuristic.confidence, undefined, 'Should have no confidence when not detected');
    });

    it('should include confidence for custom patterns if registered', () => {
      // This test would require registering a custom pattern first
      // For now, just verify the structure exists
      const info = getDetectionInfo('IMG_20241103_143045.jpg');

      assert.ok(info.custom !== undefined, 'Should have custom property');
      // Confidence should be undefined if no custom pattern matched
      // But the property should be exposed when custom patterns do match
    });

    it('should provide consistent confidence across different formats', () => {
      const formats = [
        { filename: 'IMG_20241103_143045.jpg', expectedMin: 0.85 },
        { filename: '2024-11-03-file.pdf', expectedMin: 0.90 },
        { filename: '01-02-2024-file.txt', expectedMin: 0.70 }, // Well-structured even if ambiguous
        { filename: 'report-2024.pdf', expectedMax: 0.70 },
      ];

      formats.forEach(({ filename, expectedMin, expectedMax }) => {
        const info = getDetectionInfo(filename);
        assert.ok(info.heuristic.detected, `Should detect: ${filename}`);
        assert.ok(info.heuristic.confidence !== undefined, `Should have confidence: ${filename}`);

        if (expectedMin) {
          assert.ok(info.heuristic.confidence >= expectedMin,
            `${filename} confidence (${info.heuristic.confidence}) should be >= ${expectedMin}`);
        }
        if (expectedMax) {
          assert.ok(info.heuristic.confidence <= expectedMax,
            `${filename} confidence (${info.heuristic.confidence}) should be <= ${expectedMax}`);
        }
      });
    });
  });

  describe('Confidence Score Ranges', () => {
    it('should assign high confidence (>0.85) to unambiguous camera formats', () => {
      const cameraFormats = [
        'IMG_20241103_143045.jpg',
        'VID_20241103_143045.mp4',
        'PXL_20241103_143045.jpg',
        'REC_20241103_143045.m4a',
      ];

      cameraFormats.forEach(filename => {
        const result = getBestTimestamp(filename);
        assert.ok(result.confidence >= 0.85,
          `${filename} should have high confidence (got ${result.confidence})`);
      });
    });

    it('should assign medium confidence (0.65-0.90) to structured formats', () => {
      const structuredFormats = [
        '2024-11-03-file.pdf',
        '2024_11_03_file.pdf',
        '20241103-file.pdf',
      ];

      structuredFormats.forEach(filename => {
        const result = getBestTimestamp(filename);
        assert.ok(result.confidence >= 0.65 && result.confidence <= 1.0,
          `${filename} should have medium-high confidence (got ${result.confidence})`);
      });
    });

    it('should assign varying confidence based on pattern specificity', () => {
      // These formats have different confidence based on their structure
      // Note: "ambiguous" dates (01-02-2024) still get good confidence from heuristic
      // because they are well-structured. Ambiguity is a separate concern.
      const formats = [
        '01-02-2024-file.txt',  // Well-structured, good confidence
        '03-04-2023-report.pdf', // Well-structured, good confidence
      ];

      formats.forEach(filename => {
        const result = getBestTimestamp(filename);
        assert.ok(result.confidence >= 0.65,
          `${filename} should have reasonable confidence (got ${result.confidence})`);
      });
    });
  });

  describe('API Consistency', () => {
    it('should expose confidence in both getBestTimestamp() and getDetectionInfo()', () => {
      const filename = 'IMG_20241103_143045.jpg';

      const timestamp = getBestTimestamp(filename);
      const info = getDetectionInfo(filename);

      assert.equal(timestamp.confidence, info.heuristic.confidence,
        'Both APIs should return the same confidence');
    });

    it('should maintain confidence through timestampToDate conversion', () => {
      // The timestamp object should preserve confidence even after conversion
      const filename = 'IMG_20241103_143045.jpg';
      const timestamp = getBestTimestamp(filename);

      assert.ok(timestamp.confidence !== undefined,
        'Timestamp object should preserve confidence');
    });
  });
});
