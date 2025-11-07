import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { processPath } from '../src/core/renamer.js';

const TEST_DIR = join(process.cwd(), 'test-temp-renamer');

describe('renamer - directories', () => {
  beforeEach(() => {
    // Create clean test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should rename directory with ISO timestamp', () => {
    const dirPath = join(TEST_DIR, 'project 2024-08-15');
    mkdirSync(dirPath);

    const result = processPath(dirPath, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.includes('2024-08-15'));
    assert.ok(result.newPath.includes('project'));
    assert.ok(existsSync(result.newPath));
  });

  it('should rename directory with European date', () => {
    const dirPath = join(TEST_DIR, 'backup 15.08.2024');
    mkdirSync(dirPath);

    const result = processPath(dirPath, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.includes('2024-08-15'));
    assert.ok(result.newPath.includes('backup'));
  });

  it('should rename directory with year-only', () => {
    const dirPath = join(TEST_DIR, 'photos-2023');
    mkdirSync(dirPath);

    const result = processPath(dirPath, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.startsWith(join(TEST_DIR, '2023')));
    assert.ok(result.newPath.includes('photos'));
  });

  it('should handle dry-run for directories', () => {
    const dirPath = join(TEST_DIR, 'folder 2024-01-01');
    mkdirSync(dirPath);

    const result = processPath(dirPath, { dryRun: true });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.includes('2024-01-01'));
    // Original should still exist with old name
    assert.ok(existsSync(dirPath));
    assert.ok(!existsSync(result.newPath));
  });

  it('should skip directory without timestamp', () => {
    const dirPath = join(TEST_DIR, 'regular-folder');
    mkdirSync(dirPath);

    const result = processPath(dirPath, { dryRun: false });

    assert.strictEqual(result.success, false);
    assert.ok(existsSync(dirPath));
  });

  it('should rename nested directory', () => {
    const parentDir = join(TEST_DIR, 'parent');
    const childDir = join(parentDir, 'child 2024-12-25');
    mkdirSync(parentDir, { recursive: true });
    mkdirSync(childDir);

    const result = processPath(childDir, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.includes('2024-12-25'));
    assert.ok(result.newPath.includes('child'));
  });

  it('should preserve directory contents when renaming', () => {
    const dirPath = join(TEST_DIR, 'data 2024-03-01');
    mkdirSync(dirPath);
    writeFileSync(join(dirPath, 'file1.txt'), 'content1');
    writeFileSync(join(dirPath, 'file2.txt'), 'content2');

    const result = processPath(dirPath, { dryRun: false });

    assert.strictEqual(result.success, true);
    const files = readdirSync(result.newPath);
    assert.strictEqual(files.length, 2);
    assert.ok(files.includes('file1.txt'));
    assert.ok(files.includes('file2.txt'));
  });

  it('should handle directory with timestamp and time', () => {
    const dirPath = join(TEST_DIR, 'meeting 2024-06-15 14.30.00');
    mkdirSync(dirPath);

    const result = processPath(dirPath, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.includes('2024-06-15'));
    assert.ok(result.newPath.includes('14.30.00'));
    assert.ok(result.newPath.includes('meeting'));
  });

  it('should rename directory with compact format', () => {
    const dirPath = join(TEST_DIR, 'backup_20240815_120000');
    mkdirSync(dirPath);

    const result = processPath(dirPath, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.includes('2024-08-15'));
    assert.ok(result.newPath.includes('backup'));
  });

  it('should handle directory with comma-separated format', () => {
    // Comma-separated datetime requires regex mode (heuristic doesn't support comma as datetime separator)
    const dirPath = join(TEST_DIR, 'recording 07-10-2025,11-09');
    mkdirSync(dirPath);

    const result = processPath(dirPath, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.includes('2025-10-07'));
    assert.ok(result.newPath.includes('11.09')); // Will be 11.09.00 (seconds added by formatter)
    assert.ok(result.newPath.includes('recording'));
  });
});

describe('renamer - files', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should rename file with timestamp', () => {
    const filePath = join(TEST_DIR, 'document 2024-01-15.pdf');
    writeFileSync(filePath, 'test content');

    const result = processPath(filePath, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.includes('2024-01-15'));
    assert.ok(result.newPath.includes('document'));
    assert.ok(existsSync(result.newPath));
  });

  it('should preserve file extension', () => {
    const filePath = join(TEST_DIR, 'photo 2024-08-15.jpg');
    writeFileSync(filePath, 'image data');

    const result = processPath(filePath, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.endsWith('.jpg'));
  });

  it('should handle multiple files with same timestamp', () => {
    const file1 = join(TEST_DIR, 'IMG_20240815_120000.jpg');
    const file2 = join(TEST_DIR, 'IMG_20240815_120001.jpg');
    writeFileSync(file1, 'photo1');
    writeFileSync(file2, 'photo2');

    const result1 = processPath(file1, { dryRun: false });
    const result2 = processPath(file2, { dryRun: false });

    assert.strictEqual(result1.success, true);
    assert.strictEqual(result2.success, true);
    assert.notStrictEqual(result1.newPath, result2.newPath);
  });

  it('should handle file with complex extension', () => {
    const filePath = join(TEST_DIR, 'backup 2024-01-01.tar.gz');
    writeFileSync(filePath, 'archive');

    const result = processPath(filePath, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(result.newPath.endsWith('.tar.gz'));
    assert.ok(result.newPath.includes('backup'));
  });

  it('should skip file without timestamp', () => {
    const filePath = join(TEST_DIR, 'readme.txt');
    writeFileSync(filePath, 'content');

    const result = processPath(filePath, { dryRun: false });

    assert.strictEqual(result.success, false);
    assert.ok(existsSync(filePath));
  });

  // New test for v1.1: timestamp preservation
  it('should preserve file timestamps (atime and mtime) after rename', async () => {
    const { utimesSync, statSync } = await import('fs');

    const filePath = join(TEST_DIR, 'document-2023-05-20.txt');
    writeFileSync(filePath, 'test content');

    // Set specific timestamps (May 20, 2023, 15:30:00)
    const targetTime = new Date('2023-05-20T15:30:00').getTime() / 1000;
    utimesSync(filePath, targetTime, targetTime);

    // Get original timestamps
    const originalStats = statSync(filePath);
    const originalAtime = originalStats.atime.getTime();
    const originalMtime = originalStats.mtime.getTime();

    // Rename the file
    const result = processPath(filePath, { dryRun: false });

    assert.strictEqual(result.success, true);
    assert.ok(existsSync(result.newPath));

    // Check that timestamps are preserved
    const newStats = statSync(result.newPath);
    const newAtime = newStats.atime.getTime();
    const newMtime = newStats.mtime.getTime();

    // Allow 1 second tolerance for filesystem precision
    assert.ok(Math.abs(newAtime - originalAtime) < 1000, 'atime should be preserved');
    assert.ok(Math.abs(newMtime - originalMtime) < 1000, 'mtime should be preserved');
  });
});
