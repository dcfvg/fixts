import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, utimesSync } from 'fs';
import { join } from 'path';
import { analyzeAmbiguousFile, batchAnalyzeAmbiguousFiles } from '../src/utils/smartAmbiguityResolver.js';

const TEST_DIR = join(process.cwd(), 'test-smart-resolver-temp');

describe('smartAmbiguityResolver', () => {
  describe('analyzeAmbiguousFile', () => {
    it('should resolve DD-MM ambiguity with high confidence when mtime matches', () => {
      // Create test directory
      mkdirSync(TEST_DIR, { recursive: true });

      const testFile = join(TEST_DIR, '01-06-2024 test.txt');
      writeFileSync(testFile, 'test');

      // Set mtime to June 5, 2024 (close to June 1)
      const targetDate = new Date('2024-06-05T12:00:00Z');
      utimesSync(testFile, targetDate, targetDate);

      const result = analyzeAmbiguousFile(testFile);

      assert.strictEqual(result.type, 'day-month-order');
      assert.strictEqual(result.smart.resolution, 'dmy'); // Should prefer 01 June over 06 January
      assert.ok(result.smart.confidence >= 70, `Expected confidence >= 70, got ${result.smart.confidence}`);
      assert.ok(result.smart.suggestion.includes('DD-MM-YYYY'));

      // Cleanup
      rmSync(TEST_DIR, { recursive: true, force: true });
    });

    it('should resolve MM-DD ambiguity with high confidence when mtime matches', () => {
      mkdirSync(TEST_DIR, { recursive: true });

      const testFile = join(TEST_DIR, '06-01-2024 test.txt');
      writeFileSync(testFile, 'test');

      // Set mtime to June 5, 2024 (close to June 1)
      const targetDate = new Date('2024-06-05T12:00:00Z');
      utimesSync(testFile, targetDate, targetDate);

      const result = analyzeAmbiguousFile(testFile);

      assert.strictEqual(result.type, 'day-month-order');
      assert.strictEqual(result.smart.resolution, 'mdy'); // Should prefer June 01 over Jan 06
      assert.ok(result.smart.confidence >= 70);
      assert.ok(result.smart.suggestion.includes('MM-DD-YYYY'));

      rmSync(TEST_DIR, { recursive: true, force: true });
    });

    it('should have low confidence when mtime is far from both interpretations', () => {
      mkdirSync(TEST_DIR, { recursive: true });

      const testFile = join(TEST_DIR, '01-06-2020 test.txt');
      writeFileSync(testFile, 'test');

      // Set mtime to current date (2024) - very far from 2020
      const targetDate = new Date('2024-11-03T12:00:00Z');
      utimesSync(testFile, targetDate, targetDate);

      const result = analyzeAmbiguousFile(testFile);

      assert.strictEqual(result.type, 'day-month-order');
      // Both interpretations should have low confidence
      assert.ok(result.smart.confidence <= 30, `Expected confidence <= 30, got ${result.smart.confidence}`);

      rmSync(TEST_DIR, { recursive: true, force: true });
    });

    // TODO: 2-digit year ambiguity not yet supported by heuristic
    // it('should resolve 2-digit year with 2000s when mtime is recent', () => {
    //   mkdirSync(TEST_DIR, { recursive: true });
    //
    //   const testFile = join(TEST_DIR, '241103_120000 test.txt');
    //   writeFileSync(testFile, 'test');
    //
    //   // Set mtime to November 2024
    //   const targetDate = new Date('2024-11-03T12:00:00Z');
    //   utimesSync(testFile, targetDate, targetDate);
    //
    //   const result = analyzeAmbiguousFile(testFile);
    //
    //   assert.strictEqual(result.type, 'two-digit-year');
    //   assert.strictEqual(result.smart.resolution, '2000s');
    //   assert.ok(result.smart.confidence >= 90, `Expected confidence >= 90, got ${result.smart.confidence}`);
    //   assert.ok(result.smart.suggestion.includes('2024'));
    //
    //   rmSync(TEST_DIR, { recursive: true, force: true });
    // });

    it('should return null for non-ambiguous files', () => {
      mkdirSync(TEST_DIR, { recursive: true });

      const testFile = join(TEST_DIR, '2024-11-03 test.txt');
      writeFileSync(testFile, 'test');

      const result = analyzeAmbiguousFile(testFile);

      assert.strictEqual(result, null);

      rmSync(TEST_DIR, { recursive: true, force: true });
    });

    it('should return null for files without dates', () => {
      mkdirSync(TEST_DIR, { recursive: true });

      const testFile = join(TEST_DIR, 'no-date.txt');
      writeFileSync(testFile, 'test');

      const result = analyzeAmbiguousFile(testFile);

      assert.strictEqual(result, null);

      rmSync(TEST_DIR, { recursive: true, force: true });
    });
  });

  describe('batchAnalyzeAmbiguousFiles', () => {
    it('should auto-resolve files with high confidence', () => {
      mkdirSync(TEST_DIR, { recursive: true });

      // Create files with mtime matching one interpretation
      const file1 = join(TEST_DIR, '01-06-2024 file1.txt');
      const file2 = join(TEST_DIR, '02-07-2024 file2.txt');

      writeFileSync(file1, 'test1');
      writeFileSync(file2, 'test2');

      // Set mtimes to match DD-MM interpretation
      utimesSync(file1, new Date('2024-06-05'), new Date('2024-06-05'));
      utimesSync(file2, new Date('2024-07-05'), new Date('2024-07-05'));

      const files = [
        { path: file1, name: '01-06-2024 file1.txt' },
        { path: file2, name: '02-07-2024 file2.txt' },
      ];

      const result = batchAnalyzeAmbiguousFiles(files, 70);

      assert.strictEqual(result.stats.total, 2);
      assert.ok(result.stats.autoResolved >= 1, 'Should auto-resolve at least 1 file');
      assert.ok(result.autoResolved.size >= 1);

      rmSync(TEST_DIR, { recursive: true, force: true });
    });

    it('should require prompt for files with low confidence', () => {
      mkdirSync(TEST_DIR, { recursive: true });

      // Create file with mtime far from date in filename
      const file1 = join(TEST_DIR, '01-06-2020 old.txt');
      writeFileSync(file1, 'test');

      // Set mtime to current date (far from 2020)
      utimesSync(file1, new Date('2024-11-03'), new Date('2024-11-03'));

      const files = [
        { path: file1, name: '01-06-2020 old.txt' },
      ];

      const result = batchAnalyzeAmbiguousFiles(files, 80);

      assert.strictEqual(result.stats.total, 1);
      assert.strictEqual(result.stats.needsPrompt, 1);
      assert.strictEqual(result.needsPrompt.length, 1);

      rmSync(TEST_DIR, { recursive: true, force: true });
    });
  });
});
