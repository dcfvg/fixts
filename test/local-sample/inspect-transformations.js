#!/usr/bin/env node

import { readFileSync } from 'fs';
import { parseTimestampFromName } from '../../src/utils/timestampParser.js';
import { generateNewName } from '../../src/core/formatter.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sampleFile = path.join(__dirname, 'temp', 'sample-files.txt');
const files = readFileSync(sampleFile, 'utf-8').trim().split('\n');

console.log('\n🔍 MANUAL INSPECTION - SEARCHING FOR INCONSISTENCIES\n');
console.log('='.repeat(100));

let detected = 0;
let shown = 0;
const maxShow = 100;

const issues = {
  residualDates: [],
  underscores: [],
  overCleaning: [],
  edgeSpaces: [],
  longNumbers: []
};

for (const fullPath of files) {
  const filename = path.basename(fullPath);
  const result = parseTimestampFromName(filename);

  if (result) {
    detected++;
    const formatted = generateNewName(filename);

    // Extraire le nom nettoyé (après " - ")
    const cleanedMatch = formatted.match(/ - (.+)$/);
    const cleaned = cleanedMatch ? cleanedMatch[1] : formatted;

    // Check for inconsistencies
    const warnings = [];

    // 1. Residual date - BUT ignore if formatted does NOT contain " - " (case where name = timestamp only)
    const hasContent = formatted.includes(' - ');
    if (hasContent && cleaned.match(/\d{4}[-_]\d{2}[-_]\d{2}/)) {
      warnings.push('⚠️  Residual date');
      issues.residualDates.push({ original: filename, formatted, cleaned });
    }

    // 2. Residual underscores
    if (cleaned.includes('_')) {
      warnings.push('⚠️  Residual underscores');
      issues.underscores.push({ original: filename, formatted, cleaned });
    }

    // 3. Over-cleaning
    if (cleaned.length < 5 && filename.length > 20) {
      warnings.push('⚠️  Over-cleaning (name too short)');
      issues.overCleaning.push({ original: filename, formatted, cleaned });
    }

    // 4. Edge spaces/dashes
    if (cleaned.match(/^[-\s]+|[-\s]+$/)) {
      warnings.push('⚠️  Dashes/spaces at start/end');
      issues.edgeSpaces.push({ original: filename, formatted, cleaned });
    }

    // 5. Long numbers (> 6 consecutive digits)
    const longNumbers = cleaned.match(/\d{7,}/g);
    if (longNumbers && longNumbers.length > 0) {
      warnings.push('⚠️  Long numbers: ' + longNumbers.join(', '));
      issues.longNumbers.push({ original: filename, formatted, cleaned, numbers: longNumbers });
    }

    // Display only first 100
    if (shown < maxShow) {
      console.log('\n[' + detected + '] ' + filename);
      console.log('    → ' + formatted);

      if (warnings.length > 0) {
        warnings.forEach(w => console.log('    ' + w));
      }

      shown++;
    }
  }
}

console.log('\n' + '='.repeat(100));
console.log('\n📊 STATISTICS: ' + detected + '/' + files.length + ' detected (' + Math.round(detected/files.length*100) + '%)\n');

console.log('\n📋 SUMMARY OF DETECTED PROBLEMS:\n');

const total = detected || 1; // Avoid division by zero
console.log('  • Residual dates: ' + issues.residualDates.length + ' (' + Math.round(issues.residualDates.length/total*100) + '%)');
console.log('  • Underscores: ' + issues.underscores.length + ' (' + Math.round(issues.underscores.length/total*100) + '%)');
console.log('  • Over-cleaning: ' + issues.overCleaning.length + ' (' + Math.round(issues.overCleaning.length/total*100) + '%)');
console.log('  • Edge spaces/dashes: ' + issues.edgeSpaces.length + ' (' + Math.round(issues.edgeSpaces.length/total*100) + '%)');
console.log('  • Long numbers: ' + issues.longNumbers.length + ' (' + Math.round(issues.longNumbers.length/total*100) + '%)');

// Détails des problèmes
if (issues.residualDates.length > 0) {
  console.log('\n❌ RESIDUAL DATES (' + issues.residualDates.length + '):');
  issues.residualDates.slice(0, 10).forEach(item => {
    console.log('   ' + item.original);
    console.log('   → ' + item.formatted);
  });
}

if (issues.underscores.length > 0) {
  console.log('\n❌ RESIDUAL UNDERSCORES (' + issues.underscores.length + '):');
  issues.underscores.slice(0, 10).forEach(item => {
    console.log('   ' + item.original);
    console.log('   → ' + item.formatted);
  });
}

if (issues.overCleaning.length > 0) {
  console.log('\n❌ OVER-CLEANING (' + issues.overCleaning.length + '):');
  issues.overCleaning.slice(0, 10).forEach(item => {
    console.log('   ' + item.original + ' (' + item.original.length + ' chars)');
    console.log('   → ' + item.formatted + ' (' + item.cleaned.length + ' chars cleaned)');
  });
}

if (issues.edgeSpaces.length > 0) {
  console.log('\n❌ EDGE SPACES/DASHES (' + issues.edgeSpaces.length + '):');
  issues.edgeSpaces.slice(0, 10).forEach(item => {
    console.log('   ' + item.original);
    console.log('   → "' + item.formatted + '"');
  });
}

if (issues.longNumbers.length > 0) {
  console.log('\n⚠️  LONG NUMBERS (' + issues.longNumbers.length + ') - may be legitimate (IDs Instagram, etc.):');
  issues.longNumbers.slice(0, 10).forEach(item => {
    console.log('   ' + item.original);
    console.log('   → ' + item.formatted);
    console.log('   Numbers: ' + item.numbers.join(', '));
  });
}

console.log('\n');
