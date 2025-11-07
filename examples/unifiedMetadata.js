/**
 * Unified Metadata API Examples
 *
 * Demonstrates extracting timestamps from multiple sources:
 * - Filenames
 * - EXIF data (photos)
 * - Audio metadata
 * - File system metadata (mtime, birthtime)
 */

import {
  extractTimestamp,
  extractTimestampBatch,
  compareTimestampSources,
  getSourceStatistics,
  suggestBestSource,
  SOURCE_TYPE,
  DEFAULT_PRIORITY
} from '../index.js';

console.log('='.repeat(60));
console.log('Unified Metadata API Examples');
console.log('='.repeat(60));

// Example 1: Basic extraction - single file
console.log('\n📄 Example 1: Extract timestamp from single file');
console.log('-'.repeat(60));

const filepath = 'test/integration/fixtures/2024-11-02-14-30-25-iso-dashes.txt';
const result = await extractTimestamp(filepath);

if (result) {
  console.log(`Source: ${result.source}`);
  console.log(`Timestamp: ${result.timestamp.toISOString()}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log('Details:', result.details);
} else {
  console.log('No timestamp found');
}

// Example 2: Extract from all sources
console.log('\n📊 Example 2: Extract from all available sources');
console.log('-'.repeat(60));

const resultAll = await extractTimestamp(filepath, {
  includeAll: true
});

if (resultAll) {
  console.log('\nPrimary source:');
  console.log(`  ${resultAll.primary.source}: ${resultAll.primary.timestamp.toISOString()}`);
  console.log(`  Confidence: ${(resultAll.primary.confidence * 100).toFixed(0)}%`);

  console.log('\nAll sources:');
  resultAll.all.forEach((source, i) => {
    console.log(`  ${i + 1}. ${source.source}: ${source.timestamp.toISOString()}`);
    console.log(`     Confidence: ${(source.confidence * 100).toFixed(0)}%`);
  });
}

// Example 3: Custom source priority
console.log('\n🔧 Example 3: Custom source priority');
console.log('-'.repeat(60));

// Prioritize file system metadata over filename
const customPriority = await extractTimestamp(filepath, {
  sources: [SOURCE_TYPE.MTIME, SOURCE_TYPE.BIRTHTIME, SOURCE_TYPE.FILENAME]
});

console.log('Using custom priority [mtime, birthtime, filename]:');
console.log(`  Source: ${customPriority.source}`);
console.log(`  Timestamp: ${customPriority.timestamp.toISOString()}`);

// Example 4: Batch processing
console.log('\n📦 Example 4: Batch processing multiple files');
console.log('-'.repeat(60));

const files = [
  'test/integration/fixtures/2024-01-15 14.30.00 - already-formatted.txt',
  'test/integration/fixtures/2024-Nov-02-named-month.txt',
  'test/integration/fixtures/02-Nov-2024-dd-mmm-yyyy.txt'
];

const batchResults = await extractTimestampBatch(files);

batchResults.forEach(({ filepath, result }) => {
  const filename = filepath.split('/').pop();
  if (result) {
    console.log(`✓ ${filename}`);
    console.log(`  Source: ${result.source}, Date: ${result.timestamp.toLocaleDateString()}`);
  } else {
    console.log(`✗ ${filename} - No timestamp found`);
  }
});

// Example 5: Compare sources and detect discrepancies
console.log('\n⚠️  Example 5: Compare timestamp sources');
console.log('-'.repeat(60));

const comparison = await compareTimestampSources(filepath);

console.log(`Has discrepancy: ${comparison.hasDiscrepancy}`);
console.log(`Sources found: ${comparison.sources.length}`);

if (comparison.discrepancies.length > 0) {
  console.log('\nDiscrepancies:');
  comparison.discrepancies.forEach(d => {
    console.log(`  • ${d.message}`);
  });
}

console.log(`\nRecommendation: ${comparison.recommendation}`);

// Example 6: Get source statistics for batch
console.log('\n📈 Example 6: Source statistics for batch');
console.log('-'.repeat(60));

const stats = await getSourceStatistics(files);

console.log(`Total files: ${stats.total}`);
console.log(`Detected: ${stats.detected}`);
console.log(`Average confidence: ${(stats.avgConfidence * 100).toFixed(0)}%`);

console.log('\nSource distribution:');
Object.entries(stats.sourceDistribution).forEach(([source, count]) => {
  console.log(`  ${source}: ${count} files`);
});

console.log('\nConfidence by source:');
Object.entries(stats.confidenceBySource).forEach(([source, conf]) => {
  console.log(`  ${source}: ${(conf * 100).toFixed(0)}%`);
});

// Example 7: Get best source suggestion
console.log('\n💡 Example 7: Suggest best timestamp source');
console.log('-'.repeat(60));

const suggestion = await suggestBestSource(filepath);

console.log(`Suggested source: ${suggestion.suggestion}`);
console.log(`Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);
console.log(`Timestamp: ${suggestion.timestamp.toISOString()}`);
console.log(`Reason: ${suggestion.reason}`);

if (suggestion.alternatives.length > 0) {
  console.log('\nAlternatives:');
  suggestion.alternatives.forEach((alt, i) => {
    console.log(`  ${i + 1}. ${alt.source}: ${alt.timestamp.toISOString()}`);
    console.log(`     Confidence: ${(alt.confidence * 100).toFixed(0)}%`);
  });
}

// Example 8: Real-world workflow - photo organization
console.log('\n📸 Example 8: Photo organization workflow');
console.log('-'.repeat(60));

// Simulate organizing photos with mixed sources
const photoWorkflow = async (photoPath) => {
  console.log(`Processing: ${photoPath.split('/').pop()}`);

  // Get all sources
  const allSources = await extractTimestamp(photoPath, { includeAll: true });

  if (!allSources) {
    console.log('  ⚠️  No timestamp sources available');
    return;
  }

  // Check for consistency
  const comparison = await compareTimestampSources(photoPath, {
    thresholdSeconds: 5 // Photos should be very consistent
  });

  if (comparison.hasDiscrepancy) {
    console.log('  ⚠️  Warning: Timestamp sources disagree!');
    comparison.discrepancies.forEach(d => {
      console.log(`     ${d.message}`);
    });
    console.log(`  📌 Recommendation: ${comparison.recommendation}`);
  } else {
    console.log('  ✓ All sources agree');
    console.log(`  📅 Date: ${allSources.primary.timestamp.toLocaleString()}`);
    console.log(`  📊 Confidence: ${(allSources.primary.confidence * 100).toFixed(0)}%`);
  }
};

await photoWorkflow('test/integration/fixtures/2024-11-02-14-30-25-iso-dashes.txt');

// Example 9: Document workflow - prefer filename
console.log('\n📝 Example 9: Document workflow (prefer filename)');
console.log('-'.repeat(60));

const documentWorkflow = async (docPath) => {
  console.log(`Processing: ${docPath.split('/').pop()}`);

  // For documents, filename is usually authoritative
  const result = await extractTimestamp(docPath, {
    sources: [SOURCE_TYPE.FILENAME, SOURCE_TYPE.BIRTHTIME, SOURCE_TYPE.MTIME]
  });

  if (result) {
    console.log(`  Source: ${result.source}`);
    console.log(`  Date: ${result.timestamp.toLocaleDateString()}`);

    if (result.source === SOURCE_TYPE.FILENAME) {
      console.log('  ✓ Using filename (preferred for documents)');
    } else {
      console.log('  ⚠️  Filename has no timestamp, using fallback');
    }
  }
};

await documentWorkflow('test/integration/fixtures/2024-01-15 14.30.00 - already-formatted.txt');

// Example 10: Source priority constants
console.log('\n🔍 Example 10: Understanding source types and priority');
console.log('-'.repeat(60));

console.log('Available source types:');
Object.entries(SOURCE_TYPE).forEach(([key, value]) => {
  console.log(`  ${key}: '${value}'`);
});

console.log('\nDefault priority order (checked in this order):');
DEFAULT_PRIORITY.forEach((source, i) => {
  console.log(`  ${i + 1}. ${source}`);
});

console.log('\nConfidence levels by source type:');
console.log('  filename: 70% (heuristic detection)');
console.log('  exif: 95% (camera metadata)');
console.log('  audio: 90% (audio file tags)');
console.log('  birthtime: 60% (file creation time)');
console.log('  mtime: 50% (file modification time)');

console.log('\n' + '='.repeat(60));
console.log('Examples complete! See index.js for full API reference.');
console.log('='.repeat(60));
