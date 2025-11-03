import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { discoverPatterns } from '../src/utils/patternDiscovery.js';

const TEST_DIR = join(process.cwd(), 'test-temp-patterns');

describe('patternDiscovery', () => {
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

  it('should discover ISO date pattern', () => {
    writeFileSync(join(TEST_DIR, '2024-08-15 file1.txt'), '');
    writeFileSync(join(TEST_DIR, '2024-09-20 file2.txt'), '');
    writeFileSync(join(TEST_DIR, '2024-10-01 file3.txt'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;
    const isoPattern = patterns.find(p =>
      p.pattern.includes('YYYY-MM-DD') || p.pattern.includes('ISO')
    );

    assert.ok(isoPattern !== undefined, `Should find ISO pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(isoPattern.count >= 3);
  });

  it('should discover European date pattern with dots', () => {
    writeFileSync(join(TEST_DIR, 'photo1 15.08.2024.jpg'), '');
    writeFileSync(join(TEST_DIR, 'photo2 16.08.2024.jpg'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;
    const europeanPattern = patterns.find(p =>
      p.pattern.includes('EUROPEAN_DATE') || p.pattern.includes('precision: day')
    );

    assert.ok(europeanPattern !== undefined, `Should find European pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(europeanPattern.count >= 2);
  });

  it('should discover compact datetime pattern', () => {
    writeFileSync(join(TEST_DIR, 'IMG_20240815_120000.jpg'), '');
    writeFileSync(join(TEST_DIR, 'IMG_20240816_130000.jpg'), '');
    writeFileSync(join(TEST_DIR, 'IMG_20240817_140000.jpg'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;
    const compactPattern = patterns.find(p =>
      p.pattern.includes('COMPACT_DATE') || p.pattern.includes('precision: second')
    );

    assert.ok(compactPattern !== undefined, `Should find compact pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(compactPattern.count >= 3);
  });

  it('should discover VID format', () => {
    writeFileSync(join(TEST_DIR, 'VID_20240815_143000.mp4'), '');
    writeFileSync(join(TEST_DIR, 'VID_20240816_150000.mp4'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;
    const vidPattern = patterns.find(p =>
      p.pattern.includes('COMPACT_DATE') || p.pattern.includes('precision: second')
    );

    assert.ok(vidPattern !== undefined, `Should find VID pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.strictEqual(vidPattern.count, 2);
  });

  it('should discover year-only pattern', () => {
    writeFileSync(join(TEST_DIR, '2023 report.pdf'), '');
    writeFileSync(join(TEST_DIR, '2024 summary.pdf'), '');
    writeFileSync(join(TEST_DIR, '2022 archive.pdf'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;
    const yearPattern = patterns.find(p =>
      p.pattern.includes('YEAR_ONLY') || p.pattern.includes('precision: year')
    );

    assert.ok(yearPattern !== undefined, `Should find year-only pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(yearPattern.count >= 3);
  });

  it('should discover year-month pattern', () => {
    writeFileSync(join(TEST_DIR, '2024-01 notes.txt'), '');
    writeFileSync(join(TEST_DIR, '2024-02 notes.txt'), '');
    writeFileSync(join(TEST_DIR, '2024-03 notes.txt'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;
    const ymPattern = patterns.find(p =>
      p.pattern.includes('YEAR_MONTH') || p.pattern.includes('precision: month')
    );

    assert.ok(ymPattern !== undefined, `Should find year-month pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(ymPattern.count >= 3);
  });

  it('should discover comma-separated format', () => {
    writeFileSync(join(TEST_DIR, 'recording1 07-10-2025,11-09.wav'), '');
    writeFileSync(join(TEST_DIR, 'recording2 08-10-2025,14-30.wav'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;
    // This format is recognized as European date with time (heuristic detects date and time separately)
    const datePattern = patterns.find(p =>
      p.pattern.includes('EUROPEAN_DATE') || p.pattern.includes('ISO_DATE') || p.pattern.includes('precision: day')
    );

    assert.ok(datePattern !== undefined, `Should find date pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(datePattern.count >= 2);
  });

  it('should discover patterns in nested directories', () => {
    const subdir = join(TEST_DIR, 'subdir');
    mkdirSync(subdir);
    writeFileSync(join(subdir, '2024-08-15 file1.txt'), '');
    writeFileSync(join(subdir, '2024-09-20 file2.txt'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;
    const isoPattern = patterns.find(p =>
      p.pattern.includes('YYYY-MM-DD') || p.pattern.includes('ISO')
    );

    assert.ok(isoPattern !== undefined, `Should find ISO pattern in nested dirs. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(isoPattern.count >= 2);
  });

  it('should discover multiple patterns in same directory', () => {
    writeFileSync(join(TEST_DIR, '2024-08-15 file1.txt'), '');
    writeFileSync(join(TEST_DIR, '15.08.2024 file2.txt'), '');
    writeFileSync(join(TEST_DIR, 'IMG_20240815_120000.jpg'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;

    assert.ok(patterns.length >= 3);
  });

  it('should handle directory with no timestamp patterns', () => {
    writeFileSync(join(TEST_DIR, 'readme.txt'), '');
    writeFileSync(join(TEST_DIR, 'document.pdf'), '');
    writeFileSync(join(TEST_DIR, 'photo.jpg'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;

    assert.strictEqual(patterns.length, 0);
  });

  it('should discover patterns in directory names', () => {
    const dir1 = join(TEST_DIR, '2024-08-15 project');
    const dir2 = join(TEST_DIR, '2024-09-20 backup');
    mkdirSync(dir1);
    mkdirSync(dir2);
    writeFileSync(join(dir1, 'file.txt'), '');
    writeFileSync(join(dir2, 'file.txt'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;
    const isoPattern = patterns.find(p =>
      p.pattern.includes('YYYY-MM-DD') || p.pattern.includes('ISO')
    );

    assert.ok(isoPattern !== undefined, `Should find ISO pattern in dir names. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(isoPattern.count >= 2);
  });

  it('should prioritize more specific patterns', () => {
    // Create files with different precision levels
    writeFileSync(join(TEST_DIR, '2024-08-15 report.txt'), ''); // YYYY-MM-DD
    writeFileSync(join(TEST_DIR, '2024-09 summary.txt'), ''); // YYYY-MM
    writeFileSync(join(TEST_DIR, '2025 archive.txt'), ''); // YYYY

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;

    // Should detect three different patterns (one per file)
    assert.ok(patterns.length === 3, `Expected 3 patterns, got ${patterns.length}: ${JSON.stringify(patterns.map(p => p.pattern))}`);

    // Verify each pattern type is detected
    const hasFullDate = patterns.some(p => p.pattern.includes('ISO_DATE') || p.pattern.includes('precision: day'));
    const hasYearMonth = patterns.some(p => p.pattern.includes('YEAR_MONTH'));
    const hasYearOnly = patterns.some(p => p.pattern.includes('YEAR_ONLY'));

    assert.ok(hasFullDate, `Should detect full date pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(hasYearMonth, `Should detect year-month pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(hasYearOnly, `Should detect year-only pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
  });

  it('should provide examples for each pattern', () => {
    writeFileSync(join(TEST_DIR, 'photo1 15.08.2024.jpg'), '');
    writeFileSync(join(TEST_DIR, 'photo2 16.08.2024.jpg'), '');

    const result = discoverPatterns(TEST_DIR);
    const patterns = result.knownPatterns;
    const europeanPattern = patterns.find(p =>
      p.pattern.includes('EUROPEAN_DATE') || p.pattern.includes('precision: day')
    );

    assert.ok(europeanPattern !== undefined, `Should find European pattern. Got: ${JSON.stringify(patterns.map(p => p.pattern))}`);
    assert.ok(Array.isArray(europeanPattern.examples));
    assert.ok(europeanPattern.examples.length > 0);
    assert.ok(europeanPattern.examples.some(ex => ex.includes('15.08.2024') || ex.includes('16.08.2024')));
  });
});
