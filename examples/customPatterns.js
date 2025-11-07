#!/usr/bin/env node

/**
 * Example: Custom Pattern Support
 *
 * Demonstrates how to register and use custom timestamp patterns
 * for organization-specific or project-specific naming conventions.
 */

import {
  registerPattern,
  getRegisteredPatterns,
  clearPatterns,
  exportPatterns,
  importPatterns,
} from '../index.js';

import { parseTimestamp, getDetectionInfo } from '../index.js';

console.log('=== Custom Pattern Support Examples ===\n');

// Example 1: Simple project code format
console.log('Example 1: Project Code Format');
console.log('-------------------------------');
registerPattern({
  name: 'project-code',
  regex: /PRJ(\d{4})(\d{2})(\d{2})-/,
  extractor: (match) => ({
    year: parseInt(match[1]),
    month: parseInt(match[2]),
    day: parseInt(match[3])
  }),
  description: 'Internal project code format: PRJ20240315-filename'
});

const filename1 = 'PRJ20240315-budget-report.xlsx';
const date1 = parseTimestamp(filename1);
console.log(`File: ${filename1}`);
console.log(`Parsed date: ${date1}`);
console.log('Detection info:', getDetectionInfo(filename1).custom);
console.log();

// Example 2: Named capture groups (cleaner syntax)
console.log('Example 2: Named Capture Groups');
console.log('--------------------------------');
registerPattern({
  name: 'log-format',
  regex: /LOG_(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})_(?<hour>\d{2})(?<minute>\d{2})/,
  extractor: 'named',
  priority: 50,  // Higher priority (checked before project-code)
  description: 'Server log format'
});

const filename2 = 'LOG_20240315_1430_errors.log';
const date2 = parseTimestamp(filename2);
console.log(`File: ${filename2}`);
console.log(`Parsed date: ${date2}`);
const info2 = getDetectionInfo(filename2);
console.log(`Custom pattern used: ${info2.custom.pattern}`);
console.log(`Precision: ${info2.custom.precision}`);
console.log();

// Example 3: Mapping object (simple and clear)
console.log('Example 3: Mapping Object Syntax');
console.log('---------------------------------');
registerPattern({
  name: 'backup-format',
  regex: /BACKUP-(\d{2})\.(\d{2})\.(\d{4})-(\d{2})h(\d{2})/,
  extractor: {
    day: 1,      // First capture group
    month: 2,    // Second capture group
    year: 3,     // Third capture group
    hour: 4,     // Fourth capture group
    minute: 5    // Fifth capture group
  },
  description: 'Backup system naming: BACKUP-DD.MM.YYYY-HHhMM'
});

const filename3 = 'BACKUP-15.03.2024-14h30-database.sql';
const date3 = parseTimestamp(filename3);
console.log(`File: ${filename3}`);
console.log(`Parsed date: ${date3}`);
console.log();

// Example 4: Priority system
console.log('Example 4: Pattern Priority');
console.log('----------------------------');
console.log('Registered patterns (sorted by priority):');
const patterns = getRegisteredPatterns();
patterns.forEach(p => {
  console.log(`  ${p.name} (priority: ${p.priority})`);
  console.log(`    ${p.description}`);
});
console.log();

// Example 5: Export/Import patterns
console.log('Example 5: Export/Import Patterns');
console.log('----------------------------------');
const json = exportPatterns();
console.log('Exported patterns to JSON:');
console.log(json.substring(0, 200) + '...\n');

// Clear and reimport
clearPatterns();
console.log('Cleared all patterns');
console.log(`Registered count: ${getRegisteredPatterns().length}`);

const imported = importPatterns(json);
console.log(`Imported ${imported.length} patterns:`, imported.join(', '));
console.log(`Registered count: ${getRegisteredPatterns().length}`);
console.log();

// Example 6: Custom patterns with fallback to heuristic
console.log('Example 6: Custom + Heuristic Fallback');
console.log('---------------------------------------');

// These will use custom patterns
const customFiles = [
  'PRJ20240315-report.pdf',
  'LOG_20240315_1430_errors.log',
  'BACKUP-15.03.2024-14h30-db.sql'
];

// These will fallback to heuristic
const standardFiles = [
  'IMG_20240315_143025.jpg',
  'photo-2024-03-15.jpg',
  'document-15.03.2024.docx'
];

console.log('Custom pattern files:');
customFiles.forEach(f => {
  const info = getDetectionInfo(f);
  console.log(`  ${f}`);
  console.log(`    Custom: ${info.custom.detected ? info.custom.pattern : 'no'}`);
});

console.log('\nStandard files (heuristic):');
standardFiles.forEach(f => {
  const info = getDetectionInfo(f);
  console.log(`  ${f}`);
  console.log(`    Heuristic: ${info.heuristic.detected ? info.heuristic.type : 'no'}`);
});
console.log();

// Example 7: Custom-only mode
console.log('Example 7: Custom-Only Mode');
console.log('----------------------------');
const date7a = parseTimestamp('PRJ20240315-report.pdf', { customOnly: true });
const date7b = parseTimestamp('IMG_20240315_143025.jpg', { customOnly: true });

console.log(`PRJ file (custom-only): ${date7a ? date7a : 'not detected'}`);
console.log(`IMG file (custom-only): ${date7b ? date7b : 'not detected'}`);
console.log('Custom-only mode skips heuristic detection');
console.log();

// Example 8: Real-world use case - Company naming convention
console.log('Example 8: Company Naming Convention');
console.log('------------------------------------');
clearPatterns();

// Register company-specific patterns
registerPattern({
  name: 'invoice',
  regex: /INV-(\d{4})-(\d{2})-(\d{2})-/,
  extractor: { year: 1, month: 2, day: 3 },
  description: 'Invoice format'
});

registerPattern({
  name: 'contract',
  regex: /CTR(\d{2})(\d{2})(\d{4})/,
  extractor: { day: 1, month: 2, year: 3 },
  description: 'Contract format (DDMMYYYY)'
});

registerPattern({
  name: 'report',
  regex: /RPT_(?<year>\d{4})_Q(?<quarter>\d)/,
  extractor: (match) => {
    const year = parseInt(match.groups.year);
    const quarter = parseInt(match.groups.quarter);
    // Convert quarter to month (Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct)
    const month = (quarter - 1) * 3 + 1;
    return { year, month, day: 1 };
  },
  description: 'Quarterly report format'
});

const companyFiles = [
  'INV-2024-03-15-client-ABC.pdf',
  'CTR15032024-vendor-XYZ.docx',
  'RPT_2024_Q1-financial.xlsx'
];

console.log('Company files parsed with custom patterns:');
companyFiles.forEach(f => {
  const date = parseTimestamp(f);
  const info = getDetectionInfo(f);
  console.log(`  ${f}`);
  console.log(`    Date: ${date}`);
  console.log(`    Pattern: ${info.custom.pattern}`);
});

console.log('\n✨ Custom patterns make fixTS extensible for any naming convention!');
