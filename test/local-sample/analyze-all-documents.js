#!/usr/bin/env node
import { readFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { generateNewName } from '../../src/core/formatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sampleFile = join(__dirname, 'temp', 'sample-files.txt');

const files = readFileSync(sampleFile, 'utf-8')
  .split('\n')
  .filter(f => f.trim())
  .map(f => basename(f));

console.log(`Analyzing ${files.length} random files from sample...\n`);

const stats = {
  detected: 0,
  notDetected: 0,
  underscores: 0,
  longNumbers: 0,
  technicalSuffixes: 0,
  cameraIds: 0,
  dimensions: 0,
  duplicateTimestamps: 0
};

const samples = {
  underscores: [],
  longNumbers: [],
  technicalSuffixes: [],
  cameraIds: [],
  dimensions: [],
  duplicateTimestamps: [],
  notDetected: []
};

files.forEach(name => {
  const result = generateNewName(name, 'yyyy-mm-dd hh.MM.ss');

  if (!result) {
    stats.notDetected++;
    if (samples.notDetected.length < 30) {
      samples.notDetected.push(name);
    }
    return;
  }

  stats.detected++;
  const cleanPart = result.replace(/^\d{4}-\d{2}-\d{2}( \d{2}\.\d{2}\.\d{2})?/, '').trim().replace(/^-\s*/, '');

  // Detect residual problems
  if (cleanPart.includes('_')) {
    stats.underscores++;
    if (samples.underscores.length < 10) samples.underscores.push({ name, result });
  }

  if (/\d{6,}/.test(cleanPart)) {
    stats.longNumbers++;
    if (samples.longNumbers.length < 10) samples.longNumbers.push({ name, result });
  }

  if (/_sd\b|_hd\b|_lr\b|_hr\b|_\d+p\b/i.test(cleanPart)) {
    stats.technicalSuffixes++;
    if (samples.technicalSuffixes.length < 10) samples.technicalSuffixes.push({ name, result });
  }

  if (/\b[A-Z]{2,}\d{4,}/.test(cleanPart)) {
    stats.cameraIds++;
    if (samples.cameraIds.length < 10) samples.cameraIds.push({ name, result });
  }

  if (/_\d+x\d+/.test(cleanPart)) {
    stats.dimensions++;
    if (samples.dimensions.length < 10) samples.dimensions.push({ name, result });
  }

  if (/\d{6}/.test(cleanPart)) {
    stats.duplicateTimestamps++;
    if (samples.duplicateTimestamps.length < 10) samples.duplicateTimestamps.push({ name, result });
  }
});

console.log('═══════════════════════════════════════════════════════════════');
console.log(`STATISTICS: ${files.length} files`);
console.log(`✅ Detected: ${stats.detected} (${Math.round(stats.detected/files.length*100)}%)`);
console.log(`❌ Not detected: ${stats.notDetected} (${Math.round(stats.notDetected/files.length*100)}%)`);
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('RESIDUAL PROBLEMS:');
console.log(`  • Underscores: ${stats.underscores} (${Math.round(stats.underscores/stats.detected*100)}%)`);
console.log(`  • Long numbers: ${stats.longNumbers} (${Math.round(stats.longNumbers/stats.detected*100)}%)`);
console.log(`  • Technical suffixes: ${stats.technicalSuffixes} (${Math.round(stats.technicalSuffixes/stats.detected*100)}%)`);
console.log(`  • Camera IDs: ${stats.cameraIds} (${Math.round(stats.cameraIds/stats.detected*100)}%)`);
console.log(`  • Dimensions: ${stats.dimensions} (${Math.round(stats.dimensions/stats.detected*100)}%)`);
console.log(`  • Duplicate timestamps: ${stats.duplicateTimestamps} (${Math.round(stats.duplicateTimestamps/stats.detected*100)}%)\n`);

// Display samples
if (samples.notDetected.length > 0) {
  console.log(`\n❌ FILES NOT DETECTED (${samples.notDetected.length} samples):`);
  samples.notDetected.forEach(name => console.log(`   ${name}`));
}

Object.entries(samples).forEach(([type, items]) => {
  if (type !== 'notDetected' && items.length > 0) {
    console.log(`\n⚠️  ${type.toUpperCase()} (${items.length} samples):`);
    items.forEach(({ name, result }) => {
      console.log(`   ${name}`);
      console.log(`   → ${result}\n`);
    });
  }
});
