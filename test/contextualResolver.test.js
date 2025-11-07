/**
 * Tests for context-aware ambiguity resolution
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeContextualFormat,
  resolveAmbiguitiesByContext,
  getContextualParsingOptions,
  hasAmbiguousDates,
  getFormatSummary
} from '../src/utils/contextualResolver.js';

describe('Context-Aware Ambiguity Resolution', () => {
  describe('analyzeContextualFormat()', () => {
    test('should detect DD-MM format from unambiguous dates', () => {
      const files = [
        'photo_15-03-2024.jpg',  // Day 15 > 12, must be DD-MM
        'video_20-06-2024.mp4',  // Day 20 > 12, must be DD-MM
        'doc_25-12-2024.pdf',    // Day 25 > 12, must be DD-MM
        'note_05-08-2024.txt'    // Ambiguous, but context suggests DD-MM
      ];

      const analysis = analyzeContextualFormat(files);

      assert.equal(analysis.recommendation, 'dmy');
      assert.ok(analysis.confidence >= 0.80);
      assert.ok(analysis.stats.dmyProof >= 3);
    });

    test('should detect MM-DD format from unambiguous dates', () => {
      const files = [
        'photo_03-15-2024.jpg',  // Month 15 > 12, must be MM-DD
        'video_06-20-2024.mp4',  // Month 20 > 12, must be MM-DD
        'doc_12-25-2024.pdf',    // Month 25 > 12, must be MM-DD
        'note_08-05-2024.txt'    // Ambiguous, but context suggests MM-DD
      ];

      const analysis = analyzeContextualFormat(files);

      assert.equal(analysis.recommendation, 'mdy');
      assert.ok(analysis.confidence >= 0.80);
      assert.ok(analysis.stats.mdyProof >= 3);
    });

    test('should have low confidence with only ambiguous dates', () => {
      const files = [
        'file_01-02-2024.txt',  // Could be Jan 2 or Feb 1
        'file_03-04-2024.txt',  // Could be Mar 4 or Apr 3
        'file_05-06-2024.txt'   // Could be May 6 or Jun 5
      ];

      const analysis = analyzeContextualFormat(files);

      assert.ok(analysis.confidence <= 0.60);
      assert.equal(analysis.stats.ambiguous, 3);
      assert.equal(analysis.stats.dmyProof, 0);
      assert.equal(analysis.stats.mdyProof, 0);
    });

    test('should default to DMY with only ambiguous dates', () => {
      const files = [
        'file_01-12-2024.txt',
        'file_02-11-2024.txt'
      ];

      const analysis = analyzeContextualFormat(files);

      assert.equal(analysis.recommendation, 'dmy');
      assert.ok(analysis.confidence <= 0.60);
      assert.ok(analysis.evidence.some(e => e.includes('Defaulting to DD-MM')));
    });

    test('should prioritize files from current directory', () => {
      const files = [
        '/project/folder1/photo_15-03-2024.jpg',  // DMY
        '/project/folder1/video_20-06-2024.mp4',  // DMY
        '/project/folder2/doc_03-15-2024.pdf',    // MDY
        '/project/folder2/note_06-20-2024.txt'    // MDY
      ];

      // Analyze with folder1 as current directory
      const analysis = analyzeContextualFormat(files, {
        currentDirectory: '/project/folder1'
      });

      // Should prioritize folder1 files (DMY format)
      assert.equal(analysis.recommendation, 'dmy');
      assert.ok(analysis.stats.sameDirectoryFiles >= 2);
      assert.ok(analysis.evidence.some(e => e.includes('current directory')));
    });

    test('should handle mixed formats with warning', () => {
      const files = [
        'photo_15-03-2024.jpg',  // DMY
        'video_03-15-2024.mp4',  // MDY (conflicting!)
        'doc_20-06-2024.pdf'     // DMY
      ];

      const analysis = analyzeContextualFormat(files);

      // Should still recommend DMY (2 vs 1)
      assert.equal(analysis.recommendation, 'dmy');
      // But confidence should be lower due to conflict
      assert.ok(analysis.confidence < 0.80);
      assert.ok(analysis.evidence.some(e => e.includes('Warning')));
    });

    test('should handle files without dates', () => {
      const files = [
        'document.pdf',
        'readme.txt',
        'photo_15-03-2024.jpg'  // Only one with date
      ];

      const analysis = analyzeContextualFormat(files);

      assert.equal(analysis.recommendation, 'dmy');
      assert.equal(analysis.stats.dmyProof, 1);
    });

    test('should boost confidence for consistent 4-digit years', () => {
      const files = [
        'photo_15-03-2024.jpg',
        'video_20-06-2024.mp4',
        'doc_25-12-2024.pdf',
        'note_30-01-2024.txt'
      ];

      const analysis = analyzeContextualFormat(files);

      assert.ok(analysis.confidence >= 0.85);
      assert.ok(analysis.stats.yearProof >= 3);
      assert.ok(analysis.evidence.some(e => e.includes('4-digit years')));
    });
  });

  describe('resolveAmbiguitiesByContext()', () => {
    test('should auto-resolve with high confidence', () => {
      const files = [
        'photo_15-03-2024.jpg',
        'video_20-06-2024.mp4',
        'doc_05-08-2024.pdf'
      ];

      const result = resolveAmbiguitiesByContext(files);

      assert.equal(result.format, 'dmy');
      assert.equal(result.autoResolved, true);
      assert.ok(result.confidence >= 0.70);
      assert.equal(result.shouldPromptUser, false);
    });

    test('should suggest user prompt with low confidence', () => {
      const files = [
        'file_01-02-2024.txt',
        'file_03-04-2024.txt'
      ];

      const result = resolveAmbiguitiesByContext(files);

      assert.equal(result.autoResolved, false);
      assert.equal(result.shouldPromptUser, true);
      assert.ok(result.confidence < 0.70);
    });

    test('should respect custom confidence threshold', () => {
      const files = [
        'photo_15-03-2024.jpg',
        'file_05-08-2024.txt'
      ];

      // With high threshold (0.90), should not auto-resolve
      const result = resolveAmbiguitiesByContext(files, {
        confidenceThreshold: 0.90
      });

      assert.equal(result.autoResolved, false);
    });

    test('should use default format when no recommendation', () => {
      const files = ['document.pdf', 'readme.txt'];

      const result = resolveAmbiguitiesByContext(files, {
        defaultFormat: 'mdy'
      });

      assert.equal(result.format, 'mdy');
      assert.equal(result.autoResolved, false);
    });
  });

  describe('getContextualParsingOptions()', () => {
    test('should return parsing options with recommended format', () => {
      const files = [
        'photo_15-03-2024.jpg',
        'video_20-06-2024.mp4'
      ];

      const options = getContextualParsingOptions(files);

      assert.ok(options.dateFormat);
      assert.ok(typeof options.confidence === 'number');
      assert.ok(typeof options.autoResolved === 'boolean');
      assert.ok(Array.isArray(options.evidence));
    });

    test('should return options suitable for parseTimestamp', () => {
      const files = ['photo_15-03-2024.jpg'];
      const options = getContextualParsingOptions(files);

      // Should have dateFormat property that can be passed to parseTimestamp
      assert.ok(['dmy', 'mdy'].includes(options.dateFormat));
    });
  });

  describe('hasAmbiguousDates()', () => {
    test('should return true for ambiguous dates', () => {
      const files = ['file_01-12-2024.txt'];
      assert.equal(hasAmbiguousDates(files), true);
    });

    test('should return false for unambiguous dates', () => {
      const files = ['file_15-03-2024.txt'];
      assert.equal(hasAmbiguousDates(files), false);
    });

    test('should return false when no dates', () => {
      const files = ['document.pdf'];
      assert.equal(hasAmbiguousDates(files), false);
    });

    test('should detect ambiguous dates in batch', () => {
      const files = [
        'file1.txt',
        'photo_15-03-2024.jpg',
        'video_01-02-2024.mp4'  // Ambiguous
      ];

      assert.equal(hasAmbiguousDates(files), true);
    });
  });

  describe('getFormatSummary()', () => {
    test('should provide comprehensive summary', () => {
      const files = [
        'photo_15-03-2024.jpg',
        'video_01-02-2024.mp4',
        'document.pdf'
      ];

      const summary = getFormatSummary(files);

      assert.equal(summary.totalFiles, 3);
      assert.ok(summary.filesWithDates >= 1);
      assert.ok(summary.recommendation);
      assert.ok(typeof summary.confidence === 'number');
      assert.ok(Array.isArray(summary.evidence));
      assert.ok(typeof summary.needsUserInput === 'boolean');
    });

    test('should indicate when user input needed', () => {
      const files = [
        'file_01-02-2024.txt',
        'file_03-04-2024.txt'
      ];

      const summary = getFormatSummary(files);

      assert.equal(summary.needsUserInput, true);
      assert.ok(summary.ambiguousDates > 0);
    });

    test('should not need user input with high confidence', () => {
      const files = [
        'photo_15-03-2024.jpg',
        'video_20-06-2024.mp4'
      ];

      const summary = getFormatSummary(files);

      assert.equal(summary.needsUserInput, false);
      assert.ok(summary.confidence >= 0.70);
    });
  });

  describe('Real-world scenarios', () => {
    test('should handle photo backup folder (all DMY)', () => {
      const files = [
        'IMG_20240315_143025.jpg',
        'VID_20240316_120000.mp4',
        'screenshot_15-03-2024.png',
        'photo_20-06-2024.jpg'
      ];

      const result = resolveAmbiguitiesByContext(files);

      assert.equal(result.format, 'dmy');
      assert.equal(result.autoResolved, true);
    });

    test('should handle US document folder (all MDY)', () => {
      const files = [
        'invoice_03-15-2024.pdf',
        'report_06-20-2024.docx',
        'statement_12-25-2024.pdf'
      ];

      const result = resolveAmbiguitiesByContext(files);

      assert.equal(result.format, 'mdy');
      assert.equal(result.autoResolved, true);
    });

    test('should handle mixed source folder (needs user input)', () => {
      const files = [
        'download_01-02-2024.pdf',
        'download_03-04-2024.pdf',
        'download_05-06-2024.pdf'
      ];

      const result = resolveAmbiguitiesByContext(files);

      assert.equal(result.shouldPromptUser, true);
    });
  });
});
