#!/usr/bin/env node

/**
 * Metadata Extraction Workflow Example
 *
 * Demonstrates how to extract timestamps from metadata (EXIF, audio tags, file system)
 * and use them for renaming files.
 */

import {
  extractTimestamp,
  extractTimestampBatch,
  // compareTimestampSources,  // Uncomment for programmatic usage
  getSourceStatistics,
  suggestBestSource,
  SOURCE_TYPE
} from '../index.js';
import { existsSync } from 'fs';
// import { join } from 'path';  // Uncomment if needed

console.log('====================================');
console.log('Metadata Extraction Workflow Demo');
console.log('====================================\n');

// Example 1: Extract from single file
console.log('Example 1: Extract Timestamp from Single File\n');

const exampleFile = './test/integration/fixtures/2020-01-01-12-00-00-file.txt';

if (existsSync(exampleFile)) {
  const result = await extractTimestamp(exampleFile);
  if (result) {
    console.log('  File:', exampleFile);
    console.log('  Source:', result.source);
    console.log('  Timestamp:', result.timestamp.toISOString());
    console.log('  Confidence:', result.confidence);
    console.log('');
  }
}

// Example 2: Custom source priority
console.log('Example 2: Custom Source Priority\n');

console.log('  Default priority:', SOURCE_TYPE.FILENAME, '→', SOURCE_TYPE.EXIF, '→', SOURCE_TYPE.AUDIO, '→', SOURCE_TYPE.BIRTHTIME, '→', SOURCE_TYPE.MTIME);
console.log('  Custom priority: EXIF → AUDIO → FILENAME (prefer metadata over filename)\n');

console.log('```javascript');
console.log('const result = await extractTimestamp(\'photo.jpg\', {');
console.log('  sources: [SOURCE_TYPE.EXIF, SOURCE_TYPE.AUDIO, SOURCE_TYPE.FILENAME]');
console.log('});');
console.log('```\n');

// Example 3: Get all available sources
console.log('Example 3: Get All Available Sources\n');

console.log('```javascript');
console.log('const result = await extractTimestamp(\'photo.jpg\', {');
console.log('  includeAll: true');
console.log('});');
console.log('');
console.log('console.log(result.primary);  // Best source');
console.log('console.log(result.all);      // All detected sources');
console.log('```\n');

// Example 4: Batch processing
console.log('Example 4: Batch Processing\n');

const testFiles = [
  './test/integration/fixtures/2020-01-01-12-00-00-file.txt',
  './test/integration/fixtures/2024-11-02-14-30-25-iso-dashes.txt',
  './test/integration/fixtures/2024-Nov-02-named-month.txt',
].filter(existsSync);

if (testFiles.length > 0) {
  const results = await extractTimestampBatch(testFiles);

  console.log(`  Processed ${results.length} files:`);
  results.forEach(({ filepath, result }) => {
    if (result) {
      const filename = filepath.split('/').pop();
      console.log(`    ✓ ${filename.padEnd(40)} ${result.source}`);
    } else {
      const filename = filepath.split('/').pop();
      console.log(`    ✗ ${filename.padEnd(40)} No timestamp`);
    }
  });
  console.log('');
}

// Example 5: Compare sources for discrepancies
console.log('Example 5: Detect Discrepancies Between Sources\n');

console.log('```javascript');
console.log('const comparison = await compareTimestampSources(\'photo.jpg\');');
console.log('');
console.log('if (comparison.hasDiscrepancy) {');
console.log('  console.log(\'Warning: Sources disagree!\');');
console.log('  comparison.discrepancies.forEach(d => {');
console.log('    console.log(`${d.source1} vs ${d.source2}: ${d.message}`);');
console.log('  });');
console.log('}');
console.log('');
console.log('console.log(\'Recommendation:\', comparison.recommendation);');
console.log('```\n');

// Example 6: Batch statistics
console.log('Example 6: Get Statistics for Batch\n');

if (testFiles.length > 0) {
  const stats = await getSourceStatistics(testFiles);

  console.log('  Statistics:');
  console.log(`    Total files: ${stats.total}`);
  console.log(`    Detected: ${stats.detected}`);
  console.log(`    Average confidence: ${stats.avgConfidence}`);
  console.log('    Source distribution:', stats.sourceDistribution);
  console.log('    Confidence by source:', stats.confidenceBySource);
  console.log('');
}

// Example 7: Get best source suggestion
console.log('Example 7: Get Best Source Recommendation\n');

if (existsSync(exampleFile)) {
  const suggestion = await suggestBestSource(exampleFile);

  console.log('  File:', exampleFile);
  console.log('  Suggested source:', suggestion.suggestion);
  console.log('  Confidence:', suggestion.confidence);
  console.log('  Reason:', suggestion.reason);
  console.log('');
}

// Example 8: CLI Usage
console.log('Example 8: CLI Usage with Metadata\n');

console.log('  # Use EXIF data for files without timestamps in filename');
console.log('  $ fixts ./photos -m content --execute');
console.log('');
console.log('  # Use earliest available source (EXIF, audio, or file creation time)');
console.log('  $ fixts ./media -m earliest --execute');
console.log('');
console.log('  # Use only file creation time');
console.log('  $ fixts ./documents -m birthtime --execute');
console.log('');
console.log('  # Custom source priority');
console.log('  $ fixts ./mixed --metadata-priority exif,audio,filename --execute\n');

// Example 9: Source confidence levels
console.log('Example 9: Understanding Confidence Levels\n');

const confidenceLevels = [
  { source: 'EXIF', confidence: 0.95, desc: 'Camera EXIF metadata - highly reliable' },
  { source: 'AUDIO', confidence: 0.90, desc: 'Audio file tags - reliable' },
  { source: 'FILENAME', confidence: 0.70, desc: 'Filename parsing - heuristic based' },
  { source: 'BIRTHTIME', confidence: 0.60, desc: 'File creation time - can be modified' },
  { source: 'MTIME', confidence: 0.50, desc: 'File modification time - often changed' },
];

confidenceLevels.forEach(({ source, confidence, desc }) => {
  console.log(`  ${source.padEnd(10)} (${confidence.toFixed(2)}) - ${desc}`);
});

console.log('\n');

// Example 10: Handling files without metadata
console.log('Example 10: Workflow for Mixed Files\n');

console.log('```javascript');
console.log('// Step 1: Try filename first (fastest)');
console.log('let result = await extractTimestamp(filepath, {');
console.log('  sources: [SOURCE_TYPE.FILENAME]');
console.log('});');
console.log('');
console.log('// Step 2: Fall back to metadata if no filename timestamp');
console.log('if (!result) {');
console.log('  result = await extractTimestamp(filepath, {');
console.log('    sources: [SOURCE_TYPE.EXIF, SOURCE_TYPE.AUDIO]');
console.log('  });');
console.log('}');
console.log('');
console.log('// Step 3: Last resort - use file system metadata');
console.log('if (!result) {');
console.log('  result = await extractTimestamp(filepath, {');
console.log('    sources: [SOURCE_TYPE.BIRTHTIME, SOURCE_TYPE.MTIME]');
console.log('  });');
console.log('}');
console.log('```\n');

console.log('====================================');
console.log('For more info: npm run docs');
console.log('====================================');
