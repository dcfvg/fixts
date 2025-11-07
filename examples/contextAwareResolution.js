#!/usr/bin/env node

/**
 * Example: Context-Aware Date Format Resolution
 *
 * Demonstrates how to use the context-aware ambiguity resolution API
 * to automatically determine whether files use DD-MM or MM-DD format.
 */

import {
  analyzeContextualFormat,
  resolveAmbiguitiesByContext,
  getContextualParsingOptions,
  hasAmbiguousDates,
  getFormatSummary
} from '../index.js';

console.log('=== Context-Aware Date Format Resolution Examples ===\n');

// Example 1: European Photo Backup (clear DMY preference)
console.log('Example 1: European Photo Backup Folder');
console.log('---------------------------------------');
const europeanFiles = [
  '/backup/photos/IMG_15-03-2024.jpg',  // day=15 > 12, must be DD-MM
  '/backup/photos/IMG_20-06-2024.jpg',  // day=20 > 12, must be DD-MM
  '/backup/photos/IMG_25-12-2024.jpg',  // day=25 > 12, must be DD-MM
  '/backup/photos/VID_08-04-2024.mp4',  // ambiguous (both ≤12)
  '/backup/photos/DOC_05-06-2024.pdf'   // ambiguous (both ≤12)
];

const analysis1 = analyzeContextualFormat(europeanFiles);
console.log('Files:', europeanFiles);
console.log('Analysis:', {
  recommendation: analysis1.recommendation,
  confidence: analysis1.confidence.toFixed(2),
  stats: analysis1.stats,
  evidence: analysis1.evidence
});

const summary1 = getFormatSummary(analysis1);
console.log('Summary:', summary1);
console.log();

// Example 2: US Document Folder (clear MDY preference)
console.log('Example 2: US Document Folder');
console.log('-------------------------------');
const usFiles = [
  'invoice_03-15-2024.pdf',    // month=15 > 12, must be MM-DD
  'report_06-20-2024.docx',    // month=20 > 12, must be MM-DD
  'statement_12-25-2024.pdf',  // month=25 > 12, must be MM-DD
  'memo_05-08-2024.txt'        // ambiguous (both ≤12)
];

const analysis2 = analyzeContextualFormat(usFiles);
console.log('Files:', usFiles);
console.log('Analysis:', {
  recommendation: analysis2.recommendation,
  confidence: analysis2.confidence.toFixed(2),
  stats: analysis2.stats
});

const resolution2 = resolveAmbiguitiesByContext(analysis2);
console.log('Resolution:', resolution2);
console.log();

// Example 3: Mixed Sources (needs user input)
console.log('Example 3: Mixed Source Folder');
console.log('--------------------------------');
const mixedFiles = [
  'photo_15-03-2024.jpg',  // DMY proof
  'video_03-15-2024.mp4',  // MDY proof (conflict!)
  'doc_20-06-2024.pdf',    // DMY proof
  'scan_04-07-2024.tif'    // ambiguous
];

const analysis3 = analyzeContextualFormat(mixedFiles);
console.log('Files:', mixedFiles);
console.log('Analysis:', {
  recommendation: analysis3.recommendation,
  confidence: analysis3.confidence.toFixed(2),
  stats: analysis3.stats,
  evidence: analysis3.evidence
});

const resolution3 = resolveAmbiguitiesByContext(analysis3, { threshold: 0.70 });
console.log('Resolution:', resolution3);
console.log('User prompt needed:', resolution3.action === 'prompt');
console.log();

// Example 4: Directory Prioritization
console.log('Example 4: Multi-Directory with Prioritization');
console.log('----------------------------------------------');
const multiDirFiles = [
  '/project/europe/photo_15-03-2024.jpg',  // DMY
  '/project/europe/video_20-06-2024.mp4',  // DMY
  '/project/usa/doc_03-15-2024.pdf',       // MDY
  '/project/usa/note_06-20-2024.txt'       // MDY
];

// Analyze with Europe directory priority
const analysisEurope = analyzeContextualFormat(multiDirFiles, {
  currentDirectory: '/project/europe'
});
console.log('Files:', multiDirFiles);
console.log('Current directory: /project/europe');
console.log('Analysis:', {
  recommendation: analysisEurope.recommendation,
  confidence: analysisEurope.confidence.toFixed(2),
  sameDirectoryFiles: analysisEurope.stats.sameDirectoryFiles
});

// Analyze with USA directory priority
const analysisUsa = analyzeContextualFormat(multiDirFiles, {
  currentDirectory: '/project/usa'
});
console.log('Current directory: /project/usa');
console.log('Analysis:', {
  recommendation: analysisUsa.recommendation,
  confidence: analysisUsa.confidence.toFixed(2),
  sameDirectoryFiles: analysisUsa.stats.sameDirectoryFiles
});
console.log();

// Example 5: Only Ambiguous Dates (defaults to DMY)
console.log('Example 5: Only Ambiguous Dates');
console.log('--------------------------------');
const ambiguousOnly = [
  'file_01-02-2024.txt',
  'file_03-04-2024.txt',
  'file_05-06-2024.txt'
];

const analysis5 = analyzeContextualFormat(ambiguousOnly);
console.log('Files:', ambiguousOnly);
console.log('Has ambiguous dates:', hasAmbiguousDates(ambiguousOnly));
console.log('Analysis:', {
  recommendation: analysis5.recommendation,
  confidence: analysis5.confidence.toFixed(2),
  note: 'Low confidence - all dates ambiguous'
});

const options5 = getContextualParsingOptions(ambiguousOnly);
console.log('Parsing options:', options5);
console.log();

// Example 6: Using in Batch Processing
console.log('Example 6: Integration with Batch Processing');
console.log('--------------------------------------------');
import { parseTimestampBatch } from '../index.js';

const batchFiles = [
  'photo_15-03-2024.jpg',
  'photo_20-06-2024.jpg',
  'video_08-04-2024.mp4'
];

// Analyze format first
const formatAnalysis = analyzeContextualFormat(batchFiles);
console.log('Detected format:', formatAnalysis.recommendation);
console.log('Confidence:', formatAnalysis.confidence.toFixed(2));

// Use recommended format for batch processing
const options = getContextualParsingOptions(batchFiles);
const results = parseTimestampBatch(batchFiles, options);
console.log('Parsed timestamps:');
results.forEach(r => {
  if (r.timestamp) {
    console.log(`  ${r.filename}: ${r.timestamp.year}-${String(r.timestamp.month).padStart(2, '0')}-${String(r.timestamp.day).padStart(2, '0')}`);
  }
});
