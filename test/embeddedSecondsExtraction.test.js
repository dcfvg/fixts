/**
 * Test for embedded seconds extraction:
 * When a 6-digit pattern matches HH:MM from the main timestamp,
 * extract the SS (seconds) component to complete the time.
 *
 * Example: 2022-05-17-11:02 - USER_110214.jpg
 *          Main timestamp: 2022-05-17 11:02
 *          Embedded pattern: 110214 (11:02:14)
 *          Result: 2022-05-17 11:02:14 (seconds extracted)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseTimestamp } from '../src/utils/timestampParser.js';

describe('Embedded Seconds Extraction', () => {
  it('should prefer prefix timestamp over embedded 6-digit pattern', () => {
    const filename = '2022-05-17-11:02 - USER_110214.jpg';
    const result = parseTimestamp(filename);

    assert.ok(result, 'Should detect a timestamp');

    // Result is a Date object
    assert.equal(result.getFullYear(), 2022, 'Year should be 2022 (from prefix)');
    assert.equal(result.getMonth() + 1, 5, 'Month should be May (5)');
    assert.equal(result.getDate(), 17, 'Day should be 17');
    assert.equal(result.getHours(), 11, 'Hour should be 11');
    assert.equal(result.getMinutes(), 2, 'Minutes should be 02');
    assert.equal(result.getSeconds(), 14, 'Seconds should be 14 (extracted from 110214)');

    // Should NOT be 2011-02-14 (from embedded 110214)
    assert.notEqual(result.getFullYear(), 2011, 'Should NOT be year 2011');
    assert.notEqual(result.getMonth() + 1, 2, 'Should NOT be February (2)');
    assert.notEqual(result.getDate(), 14, 'Should NOT be day 14');
  });

  it('should include time components in formatted output', async () => {
    const filename = '2022-05-17-11:02 - USER_110214.jpg';
    const { processPath } = await import('../src/core/renamer.js');

    const result = processPath(filename, { dryRun: true });

    assert.ok(result, 'Should have result');
    assert.ok(result.newName, 'Should have newName in result');

    // Should contain time components with seconds
    assert.ok(result.newName.includes('11.02.14'), 'Should include time with seconds in formatted output');
    assert.ok(result.newName.includes('2022-05-17'), 'Should include correct date');
  });

  it('should handle similar patterns correctly', () => {
    const testCases = [
      {
        input: '2023-12-25-14:30 - USER_143045.jpg',
        expected: { year: 2023, month: 12, day: 25, hour: 14, minute: 30, second: 45 }
      },
      {
        input: '2024-01-15-09:45 - DATA_094523.txt',
        expected: { year: 2024, month: 1, day: 15, hour: 9, minute: 45, second: 23 }
      }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = parseTimestamp(input);
      assert.ok(result, `Should detect timestamp in ${input}`);

      assert.equal(result.getFullYear(), expected.year, `Year should be ${expected.year}`);
      assert.equal(result.getMonth() + 1, expected.month, `Month should be ${expected.month}`);
      assert.equal(result.getDate(), expected.day, `Day should be ${expected.day}`);
      assert.equal(result.getHours(), expected.hour, `Hour should be ${expected.hour}`);
      assert.equal(result.getMinutes(), expected.minute, `Minutes should be ${expected.minute}`);
      assert.equal(result.getSeconds(), expected.second, `Seconds should be ${expected.second}`);
    });
  });
});
