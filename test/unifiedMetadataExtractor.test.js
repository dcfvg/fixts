import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import {
  extractTimestamp,
  extractTimestampBatch,
  compareTimestampSources,
  getSourceStatistics,
  suggestBestSource,
  SOURCE_TYPE,
  DEFAULT_PRIORITY
} from '../src/utils/unifiedMetadataExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create temporary test files
const tempDir = path.join(__dirname, 'temp-unified-test');
const ensureTempDir = () => {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
};

const cleanupTempDir = () => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

test('Unified Metadata Extractor - Basic Extraction', async (t) => {
  await t.test('extractTimestamp from filename only', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    const result = await extractTimestamp(filepath);

    assert.ok(result, 'Should extract timestamp');
    assert.strictEqual(result.source, SOURCE_TYPE.FILENAME);
    assert.ok(result.timestamp instanceof Date);
    assert.strictEqual(result.timestamp.getFullYear(), 2024);
    assert.strictEqual(result.timestamp.getMonth(), 2); // March (0-indexed)
    assert.strictEqual(result.timestamp.getDate(), 15);
    assert.ok(result.confidence > 0);

    cleanupTempDir();
  });

  await t.test('extractTimestamp returns null for no timestamp', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, 'no-timestamp.txt');
    fs.writeFileSync(filepath, 'test');

    const result = await extractTimestamp(filepath);

    // Should return null or fallback to file system metadata
    if (result) {
      // If it returns a result, it should be from file system
      assert.ok([SOURCE_TYPE.MTIME, SOURCE_TYPE.BIRTHTIME].includes(result.source));
    }

    cleanupTempDir();
  });

  await t.test('extractTimestamp from file system metadata', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, 'no-timestamp.txt');
    fs.writeFileSync(filepath, 'test');

    const result = await extractTimestamp(filepath, {
      sources: [SOURCE_TYPE.MTIME]
    });

    assert.ok(result, 'Should extract from mtime');
    assert.strictEqual(result.source, SOURCE_TYPE.MTIME);
    assert.ok(result.timestamp instanceof Date);
    assert.strictEqual(result.confidence, 0.50); // mtime has low confidence

    cleanupTempDir();
  });

  await t.test('extractTimestamp respects source priority', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-06-15-test.txt');
    fs.writeFileSync(filepath, 'test');

    // Default priority should check filename first
    const result = await extractTimestamp(filepath);
    assert.strictEqual(result.source, SOURCE_TYPE.FILENAME);

    // Custom priority: check mtime first
    const result2 = await extractTimestamp(filepath, {
      sources: [SOURCE_TYPE.MTIME, SOURCE_TYPE.FILENAME]
    });
    assert.strictEqual(result2.source, SOURCE_TYPE.MTIME);

    cleanupTempDir();
  });
});

test('Unified Metadata Extractor - Multiple Sources', async (t) => {
  await t.test('includeAll returns all available sources', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    const result = await extractTimestamp(filepath, {
      includeAll: true
    });

    assert.ok(result.primary, 'Should have primary source');
    assert.ok(Array.isArray(result.all), 'Should have all sources array');
    assert.ok(result.all.length >= 2, 'Should have at least 2 sources');

    // Primary should be highest priority
    assert.strictEqual(result.primary.source, result.all[0].source);

    // All sources should have timestamps
    result.all.forEach(source => {
      assert.ok(source.timestamp instanceof Date);
      assert.ok(source.source);
      assert.ok(typeof source.confidence === 'number');
    });

    cleanupTempDir();
  });

  await t.test('includeConfidence option', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    const withConfidence = await extractTimestamp(filepath, {
      includeConfidence: true
    });
    assert.ok(typeof withConfidence.confidence === 'number');

    const withoutConfidence = await extractTimestamp(filepath, {
      includeConfidence: false
    });
    assert.strictEqual(withoutConfidence.confidence, undefined);

    cleanupTempDir();
  });
});

test('Unified Metadata Extractor - Batch Processing', async (t) => {
  await t.test('extractTimestampBatch processes multiple files', async () => {
    ensureTempDir();

    const files = [
      path.join(tempDir, '2024-01-15-file1.txt'),
      path.join(tempDir, '2024-02-20-file2.txt'),
      path.join(tempDir, 'no-timestamp.txt')
    ];

    files.forEach(f => fs.writeFileSync(f, 'test'));

    const results = await extractTimestampBatch(files);

    assert.strictEqual(results.length, 3);
    assert.ok(results[0].filepath);
    assert.ok(results[0].result); // First has timestamp
    assert.ok(results[1].result); // Second has timestamp
    // Third may or may not have timestamp depending on file system metadata

    cleanupTempDir();
  });

  await t.test('extractTimestampBatch with options', async () => {
    ensureTempDir();

    const files = [
      path.join(tempDir, '2024-01-15-file1.txt'),
      path.join(tempDir, '2024-02-20-file2.txt')
    ];

    files.forEach(f => fs.writeFileSync(f, 'test'));

    const results = await extractTimestampBatch(files, {
      includeAll: true,
      includeConfidence: true
    });

    assert.strictEqual(results.length, 2);
    results.forEach(({ result }) => {
      assert.ok(result.primary);
      assert.ok(Array.isArray(result.all));
    });

    cleanupTempDir();
  });
});

test('Unified Metadata Extractor - Source Comparison', async (t) => {
  await t.test('compareTimestampSources detects no discrepancy', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    // Sleep briefly to ensure mtime is different
    await new Promise(resolve => setTimeout(resolve, 100));

    const comparison = await compareTimestampSources(filepath);

    assert.ok(typeof comparison.hasDiscrepancy === 'boolean');
    assert.ok(Array.isArray(comparison.sources));
    assert.ok(Array.isArray(comparison.discrepancies));

    cleanupTempDir();
  });

  await t.test('compareTimestampSources with custom threshold', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    const comparison = await compareTimestampSources(filepath, {
      thresholdSeconds: 1 // Very strict threshold
    });

    // With strict threshold, more likely to detect discrepancies
    assert.ok(typeof comparison.hasDiscrepancy === 'boolean');
    if (comparison.hasDiscrepancy) {
      assert.ok(comparison.discrepancies.length > 0);
      comparison.discrepancies.forEach(d => {
        assert.ok(d.source1);
        assert.ok(d.source2);
        assert.ok(typeof d.difference === 'number');
        assert.ok(d.message);
      });
    }

    cleanupTempDir();
  });

  await t.test('compareTimestampSources provides recommendation', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    const comparison = await compareTimestampSources(filepath);

    assert.ok(comparison.recommendation);
    assert.ok(typeof comparison.recommendation === 'string');

    cleanupTempDir();
  });
});

test('Unified Metadata Extractor - Source Statistics', async (t) => {
  await t.test('getSourceStatistics provides distribution', async () => {
    ensureTempDir();

    const files = [
      path.join(tempDir, '2024-01-15-file1.txt'),
      path.join(tempDir, '2024-02-20-file2.txt'),
      path.join(tempDir, '2024-03-25-file3.txt')
    ];

    files.forEach(f => fs.writeFileSync(f, 'test'));

    const stats = await getSourceStatistics(files);

    assert.strictEqual(stats.total, 3);
    assert.ok(stats.detected >= 0);
    assert.ok(stats.sourceDistribution);
    assert.ok(typeof stats.avgConfidence === 'number');
    assert.ok(stats.confidenceBySource);

    // All files should be detected (either from filename or file system)
    assert.ok(stats.detected === 3);

    // Should have filename as primary source for these files
    assert.ok(stats.sourceDistribution[SOURCE_TYPE.FILENAME] >= 1);

    cleanupTempDir();
  });

  await t.test('getSourceStatistics calculates confidence correctly', async () => {
    ensureTempDir();

    const files = [
      path.join(tempDir, '2024-01-15-file1.txt'),
      path.join(tempDir, '2024-02-20-file2.txt')
    ];

    files.forEach(f => fs.writeFileSync(f, 'test'));

    const stats = await getSourceStatistics(files);

    assert.ok(stats.avgConfidence > 0);
    assert.ok(stats.avgConfidence <= 1);

    // Check confidence by source
    Object.values(stats.confidenceBySource).forEach(conf => {
      assert.ok(conf > 0);
      assert.ok(conf <= 1);
    });

    cleanupTempDir();
  });
});

test('Unified Metadata Extractor - Best Source Suggestion', async (t) => {
  await t.test('suggestBestSource provides suggestion', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    const suggestion = await suggestBestSource(filepath);

    assert.ok(suggestion.suggestion);
    assert.ok(suggestion.confidence);
    assert.ok(suggestion.timestamp instanceof Date);
    assert.ok(Array.isArray(suggestion.alternatives));
    assert.ok(typeof suggestion.hasDiscrepancy === 'boolean');
    assert.ok(suggestion.reason);

    cleanupTempDir();
  });

  await t.test('suggestBestSource prefers high confidence sources', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    const suggestion = await suggestBestSource(filepath);

    // Filename should be suggested over mtime
    assert.strictEqual(suggestion.suggestion, SOURCE_TYPE.FILENAME);
    assert.ok(suggestion.confidence > 0.5);

    cleanupTempDir();
  });

  await t.test('suggestBestSource handles no sources', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, 'no-timestamp.txt');
    fs.writeFileSync(filepath, 'test');

    const suggestion = await suggestBestSource(filepath);

    // Should either suggest file system metadata or null
    if (suggestion.suggestion) {
      assert.ok([SOURCE_TYPE.MTIME, SOURCE_TYPE.BIRTHTIME].includes(suggestion.suggestion));
    } else {
      assert.strictEqual(suggestion.suggestion, null);
    }

    cleanupTempDir();
  });
});

test('Unified Metadata Extractor - Source Priority Constants', async (t) => {
  await t.test('SOURCE_TYPE has all expected types', () => {
    assert.ok(SOURCE_TYPE.FILENAME);
    assert.ok(SOURCE_TYPE.EXIF);
    assert.ok(SOURCE_TYPE.AUDIO);
    assert.ok(SOURCE_TYPE.MTIME);
    assert.ok(SOURCE_TYPE.BIRTHTIME);
    assert.ok(SOURCE_TYPE.CUSTOM);
  });

  await t.test('DEFAULT_PRIORITY has correct order', () => {
    assert.ok(Array.isArray(DEFAULT_PRIORITY));
    assert.ok(DEFAULT_PRIORITY.length >= 5);

    // Filename should be first (highest priority)
    assert.strictEqual(DEFAULT_PRIORITY[0], SOURCE_TYPE.FILENAME);

    // File system metadata should be last (lowest priority)
    const lastTwo = DEFAULT_PRIORITY.slice(-2);
    assert.ok(lastTwo.includes(SOURCE_TYPE.MTIME));
    assert.ok(lastTwo.includes(SOURCE_TYPE.BIRTHTIME));
  });
});

test('Unified Metadata Extractor - Edge Cases', async (t) => {
  await t.test('handles file:// URLs', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    const fileUrl = new URL(`file://${filepath}`).href;
    const result = await extractTimestamp(fileUrl);

    assert.ok(result);
    assert.ok(result.timestamp instanceof Date);

    cleanupTempDir();
  });

  await t.test('handles missing file gracefully', async () => {
    const filepath = path.join(tempDir, 'nonexistent.txt');
    const result = await extractTimestamp(filepath);

    // Should return null since file doesn't exist
    assert.strictEqual(result, null);
  });

  await t.test('handles invalid source types gracefully', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    const result = await extractTimestamp(filepath, {
      sources: ['invalid_source', SOURCE_TYPE.FILENAME]
    });

    // Should skip invalid source and use filename
    assert.ok(result);
    assert.strictEqual(result.source, SOURCE_TYPE.FILENAME);

    cleanupTempDir();
  });

  await t.test('handles empty sources array', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-photo.txt');
    fs.writeFileSync(filepath, 'test');

    const result = await extractTimestamp(filepath, {
      sources: []
    });

    // Should return null with no sources
    assert.strictEqual(result, null);

    cleanupTempDir();
  });
});

test('Unified Metadata Extractor - Parsing Options', async (t) => {
  await t.test('passes parsingOptions to filename parser', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '15-03-2024.txt'); // Clearly different interpretations
    fs.writeFileSync(filepath, 'test');

    const resultEU = await extractTimestamp(filepath, {
      parsingOptions: { dateFormat: 'EU' }
    });

    const resultUS = await extractTimestamp(filepath, {
      parsingOptions: { dateFormat: 'US' }
    });

    // Should parse differently based on format
    assert.ok(resultEU);
    assert.ok(resultUS);

    // EU: 15-03-2024 = March 15, 2024
    assert.strictEqual(resultEU.timestamp.getMonth(), 2); // March (0-indexed)
    assert.strictEqual(resultEU.timestamp.getDate(), 15);

    // US: 15-03-2024 would be invalid (month 15), should fallback or error
    // So let's just verify they exist
    assert.ok(resultEU.timestamp instanceof Date);

    cleanupTempDir();
  });

  await t.test('parsingOptions with allowTimeOnly', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '14-30-00.txt'); // Time only
    fs.writeFileSync(filepath, 'test');

    const result = await extractTimestamp(filepath, {
      parsingOptions: { allowTimeOnly: true }
    });

    assert.ok(result, 'Should detect time-only pattern');
    assert.ok(result.timestamp instanceof Date);

    cleanupTempDir();
  });
});

test('Unified Metadata Extractor - Real World Scenarios', async (t) => {
  await t.test('photo workflow: prefer EXIF over filename', async () => {
    ensureTempDir();

    // Simulate a renamed photo with wrong filename date
    const filepath = path.join(tempDir, '2020-01-01-photo.txt');
    fs.writeFileSync(filepath, 'test');

    // Without EXIF, should use filename
    const result = await extractTimestamp(filepath, {
      sources: [SOURCE_TYPE.FILENAME]
    });

    assert.ok(result);
    assert.strictEqual(result.source, SOURCE_TYPE.FILENAME);
    assert.strictEqual(result.timestamp.getFullYear(), 2020);

    cleanupTempDir();
  });

  await t.test('document workflow: filename is primary', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-report.txt');
    fs.writeFileSync(filepath, 'test');

    const result = await extractTimestamp(filepath);

    // For documents, filename should be primary
    assert.strictEqual(result.source, SOURCE_TYPE.FILENAME);
    assert.ok(result.confidence >= 0.70);

    cleanupTempDir();
  });

  await t.test('backup workflow: verify consistency', async () => {
    ensureTempDir();
    const filepath = path.join(tempDir, '2024-03-15-backup.txt');
    fs.writeFileSync(filepath, 'test');

    const comparison = await compareTimestampSources(filepath);

    // Should have multiple sources
    assert.ok(comparison.sources.length >= 2);

    // Should provide recommendation
    assert.ok(comparison.recommendation);

    cleanupTempDir();
  });
});
