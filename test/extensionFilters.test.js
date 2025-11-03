import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { rename } from '../src/core/renamer.js';

describe('Extension Filters', () => {
  const TEST_DIR = join(process.cwd(), 'test-extension-filters-temp');

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

  describe('--include-ext', () => {
    it('should process only included extensions', async () => {
      // Create test files
      writeFileSync(join(TEST_DIR, '2024-01-15-photo.jpg'), '');
      writeFileSync(join(TEST_DIR, '2024-01-16-video.mp4'), '');
      writeFileSync(join(TEST_DIR, '2024-01-17-document.pdf'), '');
      writeFileSync(join(TEST_DIR, '2024-01-18-image.png'), '');

      const result = await rename(TEST_DIR, {
        format: 'yyyy-mm-dd',
        dryRun: true,
        includeExt: ['jpg', 'png'],
      });

      // Should only process jpg and png files
      assert.strictEqual(result.results.length, 2);
      const processedFiles = result.results.map(r => r.oldName);
      assert.ok(processedFiles.includes('2024-01-15-photo.jpg'));
      assert.ok(processedFiles.includes('2024-01-18-image.png'));
      assert.ok(!processedFiles.includes('2024-01-16-video.mp4'));
      assert.ok(!processedFiles.includes('2024-01-17-document.pdf'));
    });

    it('should handle multiple extensions with -i flag', async () => {
      writeFileSync(join(TEST_DIR, '2024-01-15-file.txt'), '');
      writeFileSync(join(TEST_DIR, '2024-01-16-file.md'), '');
      writeFileSync(join(TEST_DIR, '2024-01-17-file.doc'), '');

      const result = await rename(TEST_DIR, {
        format: 'yyyy-mm-dd',
        dryRun: true,
        includeExt: ['txt', 'md'],
      });

      assert.strictEqual(result.results.length, 2);
      const processedFiles = result.results.map(r => r.oldName);
      assert.ok(processedFiles.includes('2024-01-15-file.txt'));
      assert.ok(processedFiles.includes('2024-01-16-file.md'));
      assert.ok(!processedFiles.includes('2024-01-17-file.doc'));
    });

    it('should be case-insensitive', async () => {
      writeFileSync(join(TEST_DIR, '2024-01-15-photo.JPG'), '');
      writeFileSync(join(TEST_DIR, '2024-01-16-photo.jpg'), '');
      writeFileSync(join(TEST_DIR, '2024-01-17-photo.Jpg'), '');

      const result = await rename(TEST_DIR, {
        format: 'yyyy-mm-dd',
        dryRun: true,
        includeExt: ['jpg'],
      });

      // All three should be processed
      assert.strictEqual(result.results.length, 3);
    });
  });

  describe('--exclude-ext', () => {
    it('should exclude specified extensions', async () => {
      writeFileSync(join(TEST_DIR, '2024-01-15-photo.jpg'), '');
      writeFileSync(join(TEST_DIR, '2024-01-16-video.mp4'), '');
      writeFileSync(join(TEST_DIR, '2024-01-17-document.pdf'), '');
      writeFileSync(join(TEST_DIR, '2024-01-18-image.png'), '');

      const result = await rename(TEST_DIR, {
        format: 'yyyy-mm-dd',
        dryRun: true,
        excludeExt: ['pdf', 'mp4'],
      });

      // Should process everything except pdf and mp4
      assert.strictEqual(result.results.length, 2);
      const processedFiles = result.results.map(r => r.oldName);
      assert.ok(processedFiles.includes('2024-01-15-photo.jpg'));
      assert.ok(processedFiles.includes('2024-01-18-image.png'));
      assert.ok(!processedFiles.includes('2024-01-16-video.mp4'));
      assert.ok(!processedFiles.includes('2024-01-17-document.pdf'));
    });

    it('should handle multiple excluded extensions', async () => {
      writeFileSync(join(TEST_DIR, '2024-01-15-file.txt'), '');
      writeFileSync(join(TEST_DIR, '2024-01-16-file.md'), '');
      writeFileSync(join(TEST_DIR, '2024-01-17-file.doc'), '');
      writeFileSync(join(TEST_DIR, '2024-01-18-file.docx'), '');

      const result = await rename(TEST_DIR, {
        format: 'yyyy-mm-dd',
        dryRun: true,
        excludeExt: ['doc', 'docx'],
      });

      assert.strictEqual(result.results.length, 2);
      const processedFiles = result.results.map(r => r.oldName);
      assert.ok(processedFiles.includes('2024-01-15-file.txt'));
      assert.ok(processedFiles.includes('2024-01-16-file.md'));
    });
  });

  describe('Combined filters', () => {
    it('should apply exclude before include', async () => {
      writeFileSync(join(TEST_DIR, '2024-01-15-photo.jpg'), '');
      writeFileSync(join(TEST_DIR, '2024-01-16-photo.png'), '');
      writeFileSync(join(TEST_DIR, '2024-01-17-document.pdf'), '');

      const result = await rename(TEST_DIR, {
        format: 'yyyy-mm-dd',
        dryRun: true,
        includeExt: ['jpg', 'png', 'pdf'],
        excludeExt: ['pdf'],
      });

      // pdf should be excluded even though it's in include list
      assert.strictEqual(result.results.length, 2);
      const processedFiles = result.results.map(r => r.oldName);
      assert.ok(!processedFiles.includes('2024-01-17-document.pdf'));
    });
  });

  describe('Recursive processing', () => {
    it('should apply filters recursively', async () => {
      const subdir = join(TEST_DIR, 'subdir');
      mkdirSync(subdir);

      writeFileSync(join(TEST_DIR, '2024-01-15-root.jpg'), '');
      writeFileSync(join(TEST_DIR, '2024-01-16-root.pdf'), '');
      writeFileSync(join(subdir, '2024-01-17-sub.jpg'), '');
      writeFileSync(join(subdir, '2024-01-18-sub.pdf'), '');

      const result = await rename(TEST_DIR, {
        format: 'yyyy-mm-dd',
        dryRun: true,
        includeExt: ['jpg'],
      });

      // Should process only jpg files from both root and subdir
      assert.strictEqual(result.results.length, 2);
      const processedFiles = result.results.map(r => r.oldName);
      assert.ok(processedFiles.includes('2024-01-15-root.jpg'));
      assert.ok(processedFiles.includes('2024-01-17-sub.jpg'));
    });
  });

  describe('No filters', () => {
    it('should process all files when no filters specified', async () => {
      writeFileSync(join(TEST_DIR, '2024-01-15-photo.jpg'), '');
      writeFileSync(join(TEST_DIR, '2024-01-16-video.mp4'), '');
      writeFileSync(join(TEST_DIR, '2024-01-17-document.pdf'), '');

      const result = await rename(TEST_DIR, {
        format: 'yyyy-mm-dd',
        dryRun: true,
      });

      // Should process all files
      assert.strictEqual(result.results.length, 3);
    });
  });
});
