import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  registerPattern,
  unregisterPattern,
  getRegisteredPatterns,
  clearPatterns,
  hasPattern,
  getPattern,
  applyCustomPatterns,
  exportPatterns,
  importPatterns,
  PatternValidationError,
} from '../src/utils/customPatternManager.js';

describe('Custom Pattern Manager', () => {
  beforeEach(() => {
    // Clear patterns before each test
    clearPatterns();
  });

  describe('registerPattern()', () => {
    test('should register a pattern with function extractor', () => {
      const pattern = registerPattern({
        name: 'test-pattern',
        regex: /TEST(\d{4})(\d{2})(\d{2})/,
        extractor: (match) => ({
          year: parseInt(match[1]),
          month: parseInt(match[2]),
          day: parseInt(match[3])
        }),
        description: 'Test pattern'
      });

      assert.equal(pattern.name, 'test-pattern');
      assert.ok(pattern.regex instanceof RegExp);
      assert.equal(typeof pattern.extractor, 'function');
      assert.equal(pattern.priority, 100); // Default priority
    });

    test('should register pattern with named capture groups', () => {
      const pattern = registerPattern({
        name: 'named-pattern',
        regex: /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
        extractor: 'named'
      });

      assert.equal(pattern.name, 'named-pattern');
      assert.equal(pattern.extractor, 'named');
    });

    test('should register pattern with mapping object', () => {
      const pattern = registerPattern({
        name: 'mapping-pattern',
        regex: /(\d{2})\.(\d{2})\.(\d{4})/,
        extractor: {
          day: 1,
          month: 2,
          year: 3
        }
      });

      assert.equal(pattern.name, 'mapping-pattern');
      assert.deepEqual(pattern.extractor, { day: 1, month: 2, year: 3 });
    });

    test('should accept string regex', () => {
      const pattern = registerPattern({
        name: 'string-regex',
        regex: '\\d{4}-\\d{2}-\\d{2}',
        extractor: 'named'
      });

      assert.ok(pattern.regex instanceof RegExp);
    });

    test('should sort by priority', () => {
      registerPattern({ name: 'low', regex: /low/, extractor: 'named', priority: 200 });
      registerPattern({ name: 'high', regex: /high/, extractor: 'named', priority: 50 });
      registerPattern({ name: 'medium', regex: /med/, extractor: 'named', priority: 100 });

      const patterns = getRegisteredPatterns();
      assert.equal(patterns[0].name, 'high');
      assert.equal(patterns[1].name, 'medium');
      assert.equal(patterns[2].name, 'low');
    });

    test('should throw error if name is missing', () => {
      assert.throws(
        () => registerPattern({ regex: /test/, extractor: 'named' }),
        PatternValidationError
      );
    });

    test('should throw error if regex is missing', () => {
      assert.throws(
        () => registerPattern({ name: 'test', extractor: 'named' }),
        PatternValidationError
      );
    });

    test('should throw error if extractor is missing', () => {
      assert.throws(
        () => registerPattern({ name: 'test', regex: /test/ }),
        PatternValidationError
      );
    });

    test('should throw error on duplicate name', () => {
      registerPattern({ name: 'dup', regex: /test/, extractor: 'named' });
      assert.throws(
        () => registerPattern({ name: 'dup', regex: /test/, extractor: 'named' }),
        PatternValidationError
      );
    });

    test('should throw error on invalid regex string', () => {
      assert.throws(
        () => registerPattern({ name: 'bad', regex: '[invalid(', extractor: 'named' }),
        PatternValidationError
      );
    });
  });

  describe('unregisterPattern()', () => {
    test('should unregister existing pattern', () => {
      registerPattern({ name: 'test', regex: /test/, extractor: 'named' });
      assert.ok(hasPattern('test'));

      const removed = unregisterPattern('test');
      assert.equal(removed, true);
      assert.ok(!hasPattern('test'));
    });

    test('should return false if pattern does not exist', () => {
      const removed = unregisterPattern('nonexistent');
      assert.equal(removed, false);
    });
  });

  describe('getRegisteredPatterns()', () => {
    test('should return empty array when no patterns', () => {
      const patterns = getRegisteredPatterns();
      assert.equal(patterns.length, 0);
    });

    test('should return all registered patterns', () => {
      registerPattern({ name: 'p1', regex: /test1/, extractor: 'named' });
      registerPattern({ name: 'p2', regex: /test2/, extractor: 'named' });

      const patterns = getRegisteredPatterns();
      assert.equal(patterns.length, 2);
      assert.ok(patterns.some(p => p.name === 'p1'));
      assert.ok(patterns.some(p => p.name === 'p2'));
    });

    test('should return a copy (not mutate internal array)', () => {
      registerPattern({ name: 'test', regex: /test/, extractor: 'named' });
      const patterns = getRegisteredPatterns();
      patterns.push({ name: 'fake' });

      const patterns2 = getRegisteredPatterns();
      assert.equal(patterns2.length, 1);
    });
  });

  describe('clearPatterns()', () => {
    test('should clear all patterns', () => {
      registerPattern({ name: 'p1', regex: /test1/, extractor: 'named' });
      registerPattern({ name: 'p2', regex: /test2/, extractor: 'named' });
      assert.equal(getRegisteredPatterns().length, 2);

      clearPatterns();
      assert.equal(getRegisteredPatterns().length, 0);
    });
  });

  describe('hasPattern()', () => {
    test('should return true for existing pattern', () => {
      registerPattern({ name: 'test', regex: /test/, extractor: 'named' });
      assert.ok(hasPattern('test'));
    });

    test('should return false for nonexistent pattern', () => {
      assert.ok(!hasPattern('nonexistent'));
    });
  });

  describe('getPattern()', () => {
    test('should return pattern object', () => {
      registerPattern({ name: 'test', regex: /test/, extractor: 'named' });
      const pattern = getPattern('test');
      assert.equal(pattern.name, 'test');
    });

    test('should return null if not found', () => {
      const pattern = getPattern('nonexistent');
      assert.equal(pattern, null);
    });
  });

  describe('applyCustomPatterns()', () => {
    test('should match and extract with function extractor', () => {
      registerPattern({
        name: 'proj',
        regex: /PRJ(\d{4})(\d{2})(\d{2})/,
        extractor: (match) => ({
          year: parseInt(match[1]),
          month: parseInt(match[2]),
          day: parseInt(match[3])
        })
      });

      const result = applyCustomPatterns('PRJ20240315-document.pdf');
      assert.ok(result);
      assert.equal(result.year, 2024);
      assert.equal(result.month, 3);
      assert.equal(result.day, 15);
      assert.equal(result.type, 'CUSTOM');
      assert.equal(result.customPattern, 'proj');
      assert.equal(result.precision, 'day');
    });

    test('should match with named capture groups', () => {
      registerPattern({
        name: 'iso',
        regex: /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
        extractor: 'named'
      });

      const result = applyCustomPatterns('report-2024-03-15.txt');
      assert.ok(result);
      assert.equal(result.year, 2024);
      assert.equal(result.month, 3);
      assert.equal(result.day, 15);
    });

    test('should match with mapping object', () => {
      registerPattern({
        name: 'euro',
        regex: /(\d{2})\.(\d{2})\.(\d{4})/,
        extractor: { day: 1, month: 2, year: 3 }
      });

      const result = applyCustomPatterns('invoice_15.03.2024.pdf');
      assert.ok(result);
      assert.equal(result.year, 2024);
      assert.equal(result.month, 3);
      assert.equal(result.day, 15);
    });

    test('should extract time components', () => {
      registerPattern({
        name: 'datetime',
        regex: /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/,
        extractor: {
          year: 1,
          month: 2,
          day: 3,
          hour: 4,
          minute: 5,
          second: 6
        }
      });

      const result = applyCustomPatterns('log_20240315_143025.txt');
      assert.ok(result);
      assert.equal(result.year, 2024);
      assert.equal(result.month, 3);
      assert.equal(result.day, 15);
      assert.equal(result.hour, 14);
      assert.equal(result.minute, 30);
      assert.equal(result.second, 25);
      assert.equal(result.precision, 'second');
    });

    test('should handle 2-digit years', () => {
      registerPattern({
        name: 'short-year',
        regex: /(\d{2})(\d{2})(\d{2})/,
        extractor: { year: 1, month: 2, day: 3 }
      });

      const result = applyCustomPatterns('file_240315.txt');
      assert.ok(result);
      assert.equal(result.year, 2024); // Converts 24 -> 2024
    });

    test('should return null if no match', () => {
      registerPattern({
        name: 'test',
        regex: /NOTFOUND/,
        extractor: 'named'
      });

      const result = applyCustomPatterns('normal-file.txt');
      assert.equal(result, null);
    });

    test('should check patterns in priority order', () => {
      // Register a pattern that matches a longer format (less specific)
      registerPattern({
        name: 'low-priority',
        regex: /\d{4}/,
        extractor: (match) => ({ year: parseInt(match[0]) }),
        priority: 200
      });

      // Register a pattern that matches a more specific format
      // Uses a different transformation that's still valid
      registerPattern({
        name: 'high-priority',
        regex: /file(\d{4})/,
        extractor: (match) => ({ year: parseInt(match[1]), month: 6 }), // Add month to differentiate
        priority: 50
      });

      const result = applyCustomPatterns('file2024.txt');
      // High priority pattern should match first and include month
      assert.equal(result.year, 2024);
      assert.equal(result.month, 6); // Only high-priority pattern adds month
      assert.equal(result.customPattern, 'high-priority');
    });

    test('should skip invalid matches', () => {
      registerPattern({
        name: 'invalid',
        regex: /(\d{2})(\d{2})(\d{4})/,
        extractor: { year: 3, month: 1, day: 2 }  // month=99 will be invalid
      });

      const result = applyCustomPatterns('file_99991234.txt'); // month=99 invalid
      assert.equal(result, null);
    });

    test('should validate month range', () => {
      registerPattern({
        name: 'test',
        regex: /(\d{4})-(\d{2})-(\d{2})/,
        extractor: { year: 1, month: 2, day: 3 }
      });

      const result = applyCustomPatterns('2024-13-01'); // month=13 invalid
      assert.equal(result, null);
    });

    test('should validate day range', () => {
      registerPattern({
        name: 'test',
        regex: /(\d{4})-(\d{2})-(\d{2})/,
        extractor: { year: 1, month: 2, day: 3 }
      });

      const result = applyCustomPatterns('2024-01-32'); // day=32 invalid
      assert.equal(result, null);
    });
  });

  describe('exportPatterns() / importPatterns()', () => {
    test('should export patterns to JSON', () => {
      registerPattern({
        name: 'test',
        regex: /test-(\d{4})/,
        extractor: { year: 1 },
        priority: 50,
        description: 'Test pattern'
      });

      const json = exportPatterns();
      assert.ok(json.includes('"name": "test"'));
      assert.ok(json.includes('"priority": 50'));
      assert.ok(json.includes('"description": "Test pattern"'));
    });

    test('should import patterns from JSON', () => {
      const json = JSON.stringify([{
        name: 'imported',
        regex: 'test-(\\d{4})',
        flags: '',
        extractor: { year: 1 },
        priority: 75,
        description: 'Imported'
      }]);

      const imported = importPatterns(json);
      assert.equal(imported.length, 1);
      assert.equal(imported[0], 'imported');

      assert.ok(hasPattern('imported'));
      const pattern = getPattern('imported');
      assert.equal(pattern.priority, 75);
    });

    test('should skip function extractors on export', () => {
      registerPattern({
        name: 'func',
        regex: /test/,
        extractor: () => ({ year: 2024 })
      });

      const json = exportPatterns();
      assert.ok(json.includes('cannot be serialized'));
    });

    test('should skip invalid patterns on import', () => {
      const json = JSON.stringify([{
        name: 'bad',
        regex: '[invalid(',
        extractor: { year: 1 }
      }]);

      const imported = importPatterns(json);
      assert.equal(imported.length, 0);
    });

    test('should round-trip export/import', () => {
      registerPattern({
        name: 'p1',
        regex: /test1-(\d{4})/,
        extractor: { year: 1 },
        priority: 50
      });

      registerPattern({
        name: 'p2',
        regex: /test2-(\d{4})/,
        extractor: 'named',
        priority: 100
      });

      const json = exportPatterns();
      clearPatterns();
      const imported = importPatterns(json);

      assert.equal(imported.length, 2);
      assert.ok(hasPattern('p1'));
      assert.ok(hasPattern('p2'));
    });
  });

  describe('Real-world scenarios', () => {
    test('should handle project code format', () => {
      registerPattern({
        name: 'project-code',
        regex: /PRJ(\d{4})(\d{2})(\d{2})-/,
        extractor: (match) => ({
          year: parseInt(match[1]),
          month: parseInt(match[2]),
          day: parseInt(match[3])
        }),
        description: 'Internal project code format'
      });

      const result = applyCustomPatterns('PRJ20240315-budget-report.xlsx');
      assert.equal(result.year, 2024);
      assert.equal(result.month, 3);
      assert.equal(result.day, 15);
    });

    test('should handle custom log format', () => {
      registerPattern({
        name: 'log-format',
        regex: /LOG_(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})_(?<hour>\d{2})(?<minute>\d{2})/,
        extractor: 'named',
        description: 'Server log naming convention'
      });

      const result = applyCustomPatterns('LOG_20240315_1430_errors.log');
      assert.equal(result.year, 2024);
      assert.equal(result.month, 3);
      assert.equal(result.day, 15);
      assert.equal(result.hour, 14);
      assert.equal(result.minute, 30);
      assert.equal(result.precision, 'minute');
    });

    test('should handle custom backup naming', () => {
      registerPattern({
        name: 'backup',
        regex: /BACKUP-(\d{2})\.(\d{2})\.(\d{4})-(\d{2})h(\d{2})/,
        extractor: {
          day: 1,
          month: 2,
          year: 3,
          hour: 4,
          minute: 5
        },
        description: 'Backup system format'
      });

      const result = applyCustomPatterns('BACKUP-15.03.2024-14h30-database.sql');
      assert.equal(result.year, 2024);
      assert.equal(result.month, 3);
      assert.equal(result.day, 15);
      assert.equal(result.hour, 14);
      assert.equal(result.minute, 30);
    });
  });
});
