#!/usr/bin/env node

/**
 * Batch Processing API Demo
 *
 * Shows how to use fixTS batch processing for analyzing large sets of files
 */

import {
  parseTimestampBatch,
  parseAndGroupByConfidence,
  getBatchStats,
  filterByTimestamp
} from '../index.js';

// Sample filenames (simulate a typical photo/document folder)
const sampleFiles = [
  // Camera photos (high confidence)
  'IMG_20240115_143025.jpg',
  'IMG_20240115_143026.jpg',
  'IMG_20240115_143027.jpg',
  'IMG_20240116_093015.jpg',
  'IMG_20240117_120000.jpg',

  // Screenshots (high confidence)
  'Screenshot 2024-11-02 at 14.30.25.png',
  'Screenshot 2024-11-03 at 09.15.30.png',

  // ISO format documents (high confidence)
  '2024-11-02-report.txt',
  '2024-11-02-14-30-25-notes.md',
  '2024-11-03-presentation.pdf',

  // European dates (medium confidence, some ambiguous)
  '02-11-2024-invoice.pdf',
  '15-03-2023-contract.pdf',
  '01-12-2024-ambiguous.txt',

  // Year-only (low confidence)
  '2024-summary.txt',
  '2023-report.pdf',

  // No timestamp
  'document.pdf',
  'readme.txt',
  'photo1.jpg',
  'photo2.jpg'
];

console.log('='.repeat(80));
console.log('BATCH PROCESSING API DEMO');
console.log('='.repeat(80));
console.log(`\nAnalyzing ${sampleFiles.length} files...\n`);

// ============================================================================
// 1. Basic Batch Parsing
// ============================================================================
console.log('1. BASIC BATCH PARSING');
console.log('-'.repeat(80));

const results = parseTimestampBatch(sampleFiles, { dateFormat: 'dmy' });

console.log(`Processed ${results.length} files`);
console.log('\nFirst 3 results:');
results.slice(0, 3).forEach(r => {
  console.log(`  ${r.filename}`);
  console.log(`    → ${r.date ? r.date.toISOString() : 'No timestamp'}`);
  console.log(`    → Confidence: ${r.confidence ? r.confidence.toFixed(2) : 'N/A'}`);
});

// ============================================================================
// 2. Group by Confidence
// ============================================================================
console.log('\n\n2. GROUP BY CONFIDENCE');
console.log('-'.repeat(80));

const grouped = parseAndGroupByConfidence(sampleFiles, { dateFormat: 'dmy' });

console.log(`High confidence (>= 0.85):     ${grouped.high.length} files`);
console.log(`Medium confidence (0.70-0.84): ${grouped.medium.length} files`);
console.log(`Low confidence (0.50-0.69):    ${grouped.low.length} files`);
console.log(`Very low confidence (< 0.50):  ${grouped.veryLow.length} files`);
console.log(`No timestamp:                  ${grouped.none.length} files`);

console.log('\nHigh confidence files:');
grouped.high.forEach(r => {
  console.log(`  ✓ ${r.filename} (${r.confidence.toFixed(2)})`);
});

if (grouped.medium.length > 0) {
  console.log('\nMedium confidence files (may need review):');
  grouped.medium.forEach(r => {
    console.log(`  ⚠ ${r.filename} (${r.confidence.toFixed(2)})`);
  });
}

if (grouped.veryLow.length > 0) {
  console.log('\nVery low confidence files (likely need manual review):');
  grouped.veryLow.forEach(r => {
    console.log(`  ⚠ ${r.filename} (${r.confidence.toFixed(2)})`);
  });
}

// ============================================================================
// 3. Batch Statistics
// ============================================================================
console.log('\n\n3. BATCH STATISTICS');
console.log('-'.repeat(80));

const stats = getBatchStats(sampleFiles, { dateFormat: 'dmy' });

console.log(`Total files:        ${stats.total}`);
console.log(`Detected:           ${stats.detected} (${(stats.detected / stats.total * 100).toFixed(1)}%)`);
console.log(`Not detected:       ${stats.notDetected} (${(stats.notDetected / stats.total * 100).toFixed(1)}%)`);
console.log(`Avg confidence:     ${stats.avgConfidence.toFixed(3)}`);
console.log(`Ambiguous:          ${stats.ambiguous} files`);

console.log('\nDetection types:');
Object.entries(stats.types)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    console.log(`  ${type.padEnd(20)} ${count} files`);
  });

console.log('\nPrecision levels:');
Object.entries(stats.precisions)
  .sort((a, b) => b[1] - a[1])
  .forEach(([precision, count]) => {
    console.log(`  ${precision.padEnd(20)} ${count} files`);
  });

// ============================================================================
// 4. Filter by Timestamp
// ============================================================================
console.log('\n\n4. FILTER BY TIMESTAMP');
console.log('-'.repeat(80));

const filtered = filterByTimestamp(sampleFiles, { dateFormat: 'dmy' });

console.log(`With timestamp:     ${filtered.withTimestamp.length} files`);
console.log(`Without timestamp:  ${filtered.withoutTimestamp.length} files`);

console.log('\nFiles without timestamp:');
filtered.withoutTimestamp.forEach(f => {
  console.log(`  ✗ ${f}`);
});

// ============================================================================
// 5. Performance Test
// ============================================================================
console.log('\n\n5. PERFORMANCE TEST');
console.log('-'.repeat(80));

// Generate 1000 files
const largeSet = [];
for (let i = 0; i < 1000; i++) {
  const type = i % 4;
  if (type === 0) largeSet.push(`IMG_20240115_${String(i).padStart(6, '0')}.jpg`);
  else if (type === 1) largeSet.push(`2024-11-${String((i % 28) + 1).padStart(2, '0')}-file-${i}.txt`);
  else if (type === 2) largeSet.push(`Screenshot 2024-11-02 at ${String((i % 24)).padStart(2, '0')}.${String((i % 60)).padStart(2, '0')}.00.png`);
  else largeSet.push(`document-${i}.pdf`);
}

console.log(`Processing ${largeSet.length} files...`);
const start = Date.now();
const largeStats = getBatchStats(largeSet);
const duration = Date.now() - start;

console.log(`\nCompleted in ${duration}ms`);
console.log(`Average: ${(duration / largeSet.length).toFixed(2)}ms per file`);
console.log(`Throughput: ${(largeSet.length / (duration / 1000)).toFixed(0)} files/second`);
console.log(`\nDetected: ${largeStats.detected}/${largeStats.total} (${(largeStats.detected / largeStats.total * 100).toFixed(1)}%)`);

// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('DEMO COMPLETE');
console.log('='.repeat(80));
console.log('\nBatch API exports:');
console.log('  - parseTimestampBatch()         : Parse multiple files efficiently');
console.log('  - parseAndGroupByConfidence()   : Group by detection quality');
console.log('  - getBatchStats()               : Get statistics for analysis');
console.log('  - filterByTimestamp()           : Separate files with/without timestamps');
console.log('\nFor more info, see: docs/BATCH_API.md');
console.log('='.repeat(80));
