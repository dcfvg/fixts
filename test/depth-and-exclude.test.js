import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { rename } from '../src/core/renamer.js';

describe('Depth and Directory Exclusion Tests', () => {
  const testDir = join(process.cwd(), 'test-depth-exclude-temp');

  beforeEach(() => {
    // Clean up before each test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    // Create test directory structure:
    // test-depth-exclude-temp/
    //   IMG_20240101_120000.txt (root file with timestamp)
    //   subfolder1/
    //     IMG_20240102_120000.txt (level 1 file)
    //     subfolder2/
    //       IMG_20240103_120000.txt (level 2 file)
    //       subfolder3/
    //         IMG_20240104_120000.txt (level 3 file)
    //   node_modules/
    //     IMG_20240105_120000.txt
    //   .git/
    //     IMG_20240106_120000.txt
    //   temp/
    //     IMG_20240107_120000.txt

    mkdirSync(testDir);
    writeFileSync(join(testDir, 'IMG_20240101_120000.txt'), 'root');

    mkdirSync(join(testDir, 'subfolder1'));
    writeFileSync(join(testDir, 'subfolder1', 'IMG_20240102_120000.txt'), 'level1');

    mkdirSync(join(testDir, 'subfolder1', 'subfolder2'), { recursive: true });
    writeFileSync(join(testDir, 'subfolder1', 'subfolder2', 'IMG_20240103_120000.txt'), 'level2');

    mkdirSync(join(testDir, 'subfolder1', 'subfolder2', 'subfolder3'), { recursive: true });
    writeFileSync(join(testDir, 'subfolder1', 'subfolder2', 'subfolder3', 'IMG_20240104_120000.txt'), 'level3');

    mkdirSync(join(testDir, 'node_modules'));
    writeFileSync(join(testDir, 'node_modules', 'IMG_20240105_120000.txt'), 'module');

    mkdirSync(join(testDir, '.git'));
    writeFileSync(join(testDir, '.git', 'IMG_20240106_120000.txt'), 'git');

    mkdirSync(join(testDir, 'temp'));
    writeFileSync(join(testDir, 'temp', 'IMG_20240107_120000.txt'), 'temp');
  });

  afterEach(() => {
    // Clean up after each test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Depth parameter tests', () => {
    it('should process only root level with depth=1', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        depth: 1,
      });

      // Only root-file should be found
      assert.equal(result.results.length, 1);
      assert.equal(result.results[0].oldName, 'IMG_20240101_120000.txt');
    });

    it('should process root + 1 level with depth=2', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        depth: 2,
      });

      // Root + all direct children (subfolder1, node_modules, .git, temp) = 5 files
      assert.equal(result.results.length, 5);
      const fileNames = result.results.map(r => r.oldName).sort();
      assert.deepEqual(fileNames, [
        'IMG_20240101_120000.txt',  // root
        'IMG_20240102_120000.txt',  // subfolder1
        'IMG_20240105_120000.txt',  // node_modules
        'IMG_20240106_120000.txt',  // .git
        'IMG_20240107_120000.txt',  // temp
      ].sort());
    });

    it('should process root + 2 levels with depth=3', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        depth: 3,
      });

      // Root + level1 + level2 files = 6 files (all except level3/IMG_20240104)
      assert.equal(result.results.length, 6);
      const fileNames = result.results.map(r => r.oldName).sort();
      assert.deepEqual(fileNames, [
        'IMG_20240101_120000.txt',  // root
        'IMG_20240102_120000.txt',  // subfolder1
        'IMG_20240103_120000.txt',  // subfolder1/subfolder2
        'IMG_20240105_120000.txt',  // node_modules
        'IMG_20240106_120000.txt',  // .git
        'IMG_20240107_120000.txt',  // temp
      ].sort());
    });

    it('should process all levels with depth=Infinity (default)', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        depth: Infinity,
      });

      // All files (including node_modules, .git, temp - 7 files total)
      assert.equal(result.results.length, 7);
      const fileNames = result.results.map(r => r.oldName).sort();
      assert.deepEqual(fileNames, [
        'IMG_20240101_120000.txt',
        'IMG_20240102_120000.txt',
        'IMG_20240103_120000.txt',
        'IMG_20240104_120000.txt',
        'IMG_20240105_120000.txt',
        'IMG_20240106_120000.txt',
        'IMG_20240107_120000.txt',
      ].sort());
    });
  });

  describe('Directory exclusion tests', () => {
    it('should exclude node_modules directory', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        excludeDir: ['node_modules'],
      });

      const fileNames = result.results.map(r => r.oldName);
      assert.ok(!fileNames.includes('IMG_20240105_120000.txt'));
    });

    it('should exclude .git directory', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        excludeDir: ['.git'],
      });

      const fileNames = result.results.map(r => r.oldName);
      assert.ok(!fileNames.includes('IMG_20240106_120000.txt'));
    });

    it('should exclude multiple directories', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        depth: Infinity,
        excludeDir: ['node_modules', '.git', 'temp'],
      });

      const fileNames = result.results.map(r => r.oldName).sort();
      assert.deepEqual(fileNames, [
        'IMG_20240101_120000.txt',
        'IMG_20240102_120000.txt',
        'IMG_20240103_120000.txt',
        'IMG_20240104_120000.txt',
      ].sort());
    });

    it('should exclude temp directory', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        excludeDir: ['temp'],
      });

      const fileNames = result.results.map(r => r.oldName);
      assert.ok(!fileNames.includes('IMG_20240107_120000.txt'));
    });
  });

  describe('Combined depth and exclusion tests', () => {
    it('should combine depth=2 with directory exclusion', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        depth: 2,
        excludeDir: ['temp'],
      });

      // Root + direct children, excluding temp = 4 files
      assert.equal(result.results.length, 4);
      const fileNames = result.results.map(r => r.oldName).sort();
      assert.deepEqual(fileNames, [
        'IMG_20240101_120000.txt',  // root
        'IMG_20240102_120000.txt',  // subfolder1
        'IMG_20240105_120000.txt',  // node_modules
        'IMG_20240106_120000.txt',  // .git
      ].sort());
    });

    it('should combine depth=1 with excludeDir (should not matter)', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        depth: 1,
        excludeDir: ['node_modules', '.git', 'temp'],
      });

      // Only root level
      assert.equal(result.results.length, 1);
      assert.equal(result.results[0].oldName, 'IMG_20240101_120000.txt');
    });
  });

  describe('Edge cases', () => {
    it('should handle depth greater than actual depth', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        depth: 100, // Much deeper than actual structure
      });

      // Should process all 7 files
      assert.equal(result.results.length, 7);
    });

    it('should handle empty excludeDir array', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        depth: Infinity,
        excludeDir: [],
      });

      // Should process all 7 files
      assert.equal(result.results.length, 7);
    });

    it('should handle non-existent directory in excludeDir', async () => {
      const result = await rename(testDir, {
        format: 'yyyy-mm-dd hh.MM.ss',
        dryRun: true,
        depth: Infinity,
        excludeDir: ['non-existent-dir'],
      });

      // Should process all 7 files (non-existent dir doesn't affect anything)
      assert.equal(result.results.length, 7);
    });
  });
});
