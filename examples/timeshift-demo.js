#!/usr/bin/env node

/**
 * Time Shift Example
 *
 * Demonstrates how to use the time shift feature to correct camera clock errors.
 * Common use cases:
 * - Camera was set to wrong timezone
 * - Forgot to adjust for daylight saving time
 * - Camera clock was incorrect
 */

// import { rename } from '../index.js';  // Uncomment for programmatic usage
import { parseTimeShift, formatTimeShift, applyTimeShift } from '../index.js';

console.log('====================================');
console.log('Time Shift Feature Demo');
console.log('====================================\n');

// Example 1: Parse and understand time shifts
console.log('Example 1: Understanding Time Shift Syntax\n');

const shifts = [
  '+2h',           // Add 2 hours
  '-1d',           // Subtract 1 day
  '+30m',          // Add 30 minutes
  '-1d3h30m',      // Subtract 1 day, 3 hours, 30 minutes
  '+5h30m',        // Add 5 hours 30 minutes (timezone correction)
];

shifts.forEach(shiftStr => {
  const shiftMs = parseTimeShift(shiftStr);
  const formatted = formatTimeShift(shiftMs);
  console.log(`  ${shiftStr.padEnd(15)} = ${formatted.padEnd(20)} (${shiftMs}ms)`);
});

console.log('\n');

// Example 2: Apply time shift to a date
console.log('Example 2: Applying Time Shifts\n');

const originalDate = new Date('2024-11-03T14:30:00');
console.log(`  Original: ${originalDate.toISOString()}`);

const shifts2 = ['+2h', '-1d', '+5h30m'];
shifts2.forEach(shiftStr => {
  const shiftMs = parseTimeShift(shiftStr);
  const shifted = applyTimeShift(originalDate, shiftMs);
  console.log(`  ${shiftStr.padEnd(8)} → ${shifted.toISOString()}`);
});

console.log('\n');

// Example 3: Real-world scenario
console.log('Example 3: Real-World Use Case\n');
console.log('Scenario: Vacation photos taken in Japan (UTC+9) but camera was set to PST (UTC-8)');
console.log('Need to add 17 hours to correct the timestamps\n');

const japanShift = '+17h';
const shiftMs = parseTimeShift(japanShift);
console.log(`  Time shift: ${formatTimeShift(shiftMs)}`);
console.log('  Camera time: 2024-11-03 14:30:00');
console.log('  Actual time: 2024-11-04 07:30:00 (after +17h shift)\n');

// Example 4: Using with CLI (commented out for demo)
console.log('Example 4: CLI Usage\n');
console.log('  # Preview changes with 2-hour shift');
console.log('  $ fixts ./photos --shift +2h');
console.log('');
console.log('  # Apply changes');
console.log('  $ fixts ./photos --shift +2h --execute');
console.log('');
console.log('  # Complex shift: subtract 1 day and 3 hours');
console.log('  $ fixts ./old-photos --shift -1d3h --execute');
console.log('');
console.log('  # Timezone correction (+5h 30m for IST)');
console.log('  $ fixts ./india-trip --shift +5h30m --execute\n');

// Example 5: Programmatic usage
console.log('Example 5: Programmatic Usage\n');

console.log('```javascript');
console.log('import { rename } from \'fixts\';');
console.log('import { parseTimeShift } from \'fixts\';');
console.log('');
console.log('// Correct camera clock error');
console.log('const shiftMs = parseTimeShift(\'+2h\');');
console.log('');
console.log('await rename(\'./photos\', {');
console.log('  timeShiftMs: shiftMs,');
console.log('  execute: true');
console.log('});');
console.log('```\n');

// Example 6: Common time shift patterns
console.log('Example 6: Common Patterns\n');

const patterns = [
  { shift: '+1h', desc: 'Daylight Saving Time forward' },
  { shift: '-1h', desc: 'Daylight Saving Time backward' },
  { shift: '+5h30m', desc: 'India Standard Time from UTC' },
  { shift: '+9h', desc: 'Japan Standard Time from UTC' },
  { shift: '-8h', desc: 'Pacific Standard Time from UTC' },
  { shift: '-1d', desc: 'Camera was one day ahead' },
  { shift: '+12h', desc: 'AM/PM confusion' },
];

patterns.forEach(({ shift, desc }) => {
  console.log(`  ${shift.padEnd(10)} - ${desc}`);
});

console.log('\n');

console.log('====================================');
console.log('For more info: npm run docs');
console.log('====================================');
