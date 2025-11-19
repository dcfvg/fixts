#!/usr/bin/env node

/**
 * Test for FALSE POSITIVES identified in detection
 * These files SHOULD NOT be detected as having a timestamp
 */

import { parseTimestampFromName } from '../../src/utils/timestampParser.js';
import { generateNewName } from '../../src/core/formatter.js';

/**
 * Format date to YYYY-MM-DD using LOCAL timezone (not UTC)
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string (YYYY-MM-DD)
 */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const FALSE_POSITIVES = [
  // UUIDs
  { name: '621971E1-9E42-4832-9ABA-ACD8804409C0.png', reason: 'UUID starting with 6 digits' },
  { name: '0AF73C97-D767-43A0-BC81-B111613F264B.jpg', reason: 'UUID' },

  // Numeric IDs
  { name: 'video_43192087.mp4', reason: 'Video ID (6 digits)' },
  { name: 'file123456.txt', reason: 'Generic 6-digit ID' },

  // Frame/Index numbers
  { name: 'frame_1406_idx3071.png', reason: 'Frame and index numbers' },
  { name: 'outline_141_idx1120.png', reason: 'Outline and index' },
  { name: 'outline_257_idx2048.png', reason: 'Index number that looks like year' },
  { name: 'outline_302_idx2408.png', reason: 'Index number that looks like YYMM (2024-08)' },

  // Repetitions
  { name: '121212-test.txt', reason: 'Repeating pattern (not a date)' },
  { name: '141414.jpg', reason: 'Repeating pattern' },

  // Multiple Unix timestamps
  { name: '1224784167-1575999268.jpg', reason: 'Two Unix timestamps' },
];

const TRUE_POSITIVES = [
  // Valid dates
  { name: 'IMG_20241103_143045.jpg', expected: '2024-11-03' },
  { name: '2024-11-03 document.pdf', expected: '2024-11-03' },
  { name: '20200130-02_frame_001.png', expected: '2020-01-30' },
];

console.log('═══════════════════════════════════════════════════════════\n');
console.log('🔍 FALSE POSITIVES TEST\n');

let falsePositiveCount = 0;
let correctCount = 0;

FALSE_POSITIVES.forEach(({ name, reason }) => {
  const date = parseTimestampFromName(name);

  if (date) {
    console.log(`❌ FALSE POSITIVE: ${name}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Detected: ${formatLocalDate(date)}`);

    const newName = generateNewName(name, 'yyyy-mm-dd hh.MM.ss');
    console.log(`   New name: ${newName}`);
    console.log();
    falsePositiveCount++;
  } else {
    console.log(`✅ CORRECT: ${name} (not detected)`);
    correctCount++;
  }
});

console.log('\n═══════════════════════════════════════════════════════════\n');
console.log('✅ TRUE POSITIVES TEST\n');

let truePositiveCount = 0;
let missedCount = 0;

TRUE_POSITIVES.forEach(({ name, expected }) => {
  const date = parseTimestampFromName(name);

  if (date) {
    const detected = formatLocalDate(date);
    if (detected === expected) {
      console.log(`✅ ${name} → ${detected}`);
      truePositiveCount++;
    } else {
      console.log(`⚠️  ${name}`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Detected: ${detected}`);
    }
  } else {
    console.log(`❌ NOT DETECTED: ${name} (expected: ${expected})`);
    missedCount++;
  }
});

console.log('\n═══════════════════════════════════════════════════════════\n');
console.log('📊 RESULTS\n');
console.log(`False positives: ${falsePositiveCount}/${FALSE_POSITIVES.length}`);
console.log(`True negatives (correct): ${correctCount}/${FALSE_POSITIVES.length}`);
console.log(`True positives: ${truePositiveCount}/${TRUE_POSITIVES.length}`);
console.log(`False negatives (missed): ${missedCount}/${TRUE_POSITIVES.length}`);
console.log();

const accuracy = ((correctCount + truePositiveCount) / (FALSE_POSITIVES.length + TRUE_POSITIVES.length) * 100).toFixed(1);
console.log(`Overall accuracy: ${accuracy}%`);
console.log();

process.exit(falsePositiveCount > 0 ? 1 : 0);
