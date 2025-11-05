import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeShift, applyTimeShift, formatTimeShift, validateShiftedDate } from '../src/utils/timeShift.js';

describe('parseTimeShift', () => {
  describe('Basic single unit shifts', () => {
    it('should parse days only', () => {
      assert.equal(parseTimeShift('+1d'), 86400000); // 1 day
      assert.equal(parseTimeShift('-2d'), -172800000); // -2 days
      assert.equal(parseTimeShift('+7d'), 604800000); // 7 days
    });

    it('should parse hours only', () => {
      assert.equal(parseTimeShift('+1h'), 3600000); // 1 hour
      assert.equal(parseTimeShift('-2h'), -7200000); // -2 hours
      assert.equal(parseTimeShift('+24h'), 86400000); // 24 hours = 1 day
    });

    it('should parse minutes only', () => {
      assert.equal(parseTimeShift('+1m'), 60000); // 1 minute
      assert.equal(parseTimeShift('-30m'), -1800000); // -30 minutes
      assert.equal(parseTimeShift('+45m'), 2700000); // 45 minutes
    });

    it('should parse seconds only', () => {
      assert.equal(parseTimeShift('+1s'), 1000); // 1 second
      assert.equal(parseTimeShift('-30s'), -30000); // -30 seconds
      assert.equal(parseTimeShift('+60s'), 60000); // 60 seconds
    });
  });

  describe('Combined unit shifts', () => {
    it('should parse hours and minutes', () => {
      assert.equal(parseTimeShift('+2h30m'), 9000000); // 2h 30m
      assert.equal(parseTimeShift('-1h15m'), -4500000); // -1h 15m
    });

    it('should parse minutes and seconds', () => {
      assert.equal(parseTimeShift('+1m8s'), 68000); // 1m 8s
      assert.equal(parseTimeShift('+5m30s'), 330000); // 5m 30s
      assert.equal(parseTimeShift('-2m15s'), -135000); // -2m 15s
    });

    it('should parse days and hours', () => {
      assert.equal(parseTimeShift('+1d3h'), 97200000); // 1d 3h
      assert.equal(parseTimeShift('-2d12h'), -216000000); // -2d 12h
    });

    it('should parse days, hours, and minutes', () => {
      assert.equal(parseTimeShift('+1d2h30m'), 95400000); // 1d 2h 30m
      assert.equal(parseTimeShift('-1d3h15m'), -98100000); // -1d 3h 15m (86400000 + 10800000 + 900000)
    });

    it('should parse all four units', () => {
      assert.equal(parseTimeShift('+1d2h30m45s'), 95445000); // 1d 2h 30m 45s
      assert.equal(parseTimeShift('+100d2h5m2s'), 8647502000); // 100d 2h 5m 2s
      assert.equal(parseTimeShift('-7d8h30m15s'), -635415000); // -7d 8h 30m 15s
    });
  });

  describe('Edge cases and variations', () => {
    it('should handle no sign (defaults to positive)', () => {
      assert.equal(parseTimeShift('1h'), 3600000); // +1 hour
      assert.equal(parseTimeShift('30m'), 1800000); // +30 minutes
    });

    it('should handle explicit positive sign', () => {
      assert.equal(parseTimeShift('+1h'), 3600000);
      assert.equal(parseTimeShift('+30m'), 1800000);
    });

    it('should handle case insensitivity', () => {
      assert.equal(parseTimeShift('+1D'), 86400000);
      assert.equal(parseTimeShift('+1H'), 3600000);
      assert.equal(parseTimeShift('+1M'), 60000);
      assert.equal(parseTimeShift('+1S'), 1000);
      assert.equal(parseTimeShift('+1d2H3m4S'), 93784000);
    });

    it('should handle whitespace variations', () => {
      assert.equal(parseTimeShift('  +1h  '), 3600000);
      assert.equal(parseTimeShift('  -30m  '), -1800000);
    });

    it('should handle large values within limits', () => {
      assert.equal(parseTimeShift('+365d'), 31536000000); // 1 year
      assert.equal(parseTimeShift('+100d'), 8640000000); // 100 days
      assert.equal(parseTimeShift('-365d'), -31536000000); // -1 year
      assert.equal(parseTimeShift('-600d'), -51840000000); // -600 days (~1.6 years)
      assert.equal(parseTimeShift('+3650d'), 315360000000); // 10 years
    });
  });

  describe('Invalid inputs', () => {
    it('should reject values beyond 10 years (3650 days)', () => {
      assert.equal(parseTimeShift('+3651d'), null);
      assert.equal(parseTimeShift('+4000d'), null);
      assert.equal(parseTimeShift('-3651d'), null);
    });

    it('should reject empty or invalid strings', () => {
      assert.equal(parseTimeShift(''), null);
      assert.equal(parseTimeShift('   '), null);
      assert.equal(parseTimeShift('invalid'), null);
      assert.equal(parseTimeShift('abc'), null);
    });

    it('should reject missing units', () => {
      assert.equal(parseTimeShift('+'), null);
      assert.equal(parseTimeShift('-'), null);
      assert.equal(parseTimeShift('+1'), null);
      assert.equal(parseTimeShift('1'), null);
    });

    it('should reject wrong unit order or duplicates', () => {
      // Note: Current regex requires d, h, m, s order
      // These should be rejected but let's verify behavior
      assert.equal(parseTimeShift('+1h2d'), null); // wrong order
      assert.equal(parseTimeShift('+1m2h'), null); // wrong order
      assert.equal(parseTimeShift('+1d1d'), null); // duplicate
    });

    it('should reject invalid characters', () => {
      assert.equal(parseTimeShift('+1h@30m'), null);
      assert.equal(parseTimeShift('+1h 30m'), null); // space between units
      assert.equal(parseTimeShift('+1.5h'), null); // decimal
    });

    it('should reject null/undefined', () => {
      assert.equal(parseTimeShift(null), null);
      assert.equal(parseTimeShift(undefined), null);
    });
  });

  describe('Real-world use cases', () => {
    it('should handle timezone corrections', () => {
      assert.equal(parseTimeShift('+8h'), 28800000); // UTC+8
      assert.equal(parseTimeShift('-5h'), -18000000); // UTC-5
      assert.equal(parseTimeShift('+5h30m'), 19800000); // UTC+5:30 (India)
    });

    it('should handle daylight saving time corrections', () => {
      assert.equal(parseTimeShift('+1h'), 3600000); // DST forward
      assert.equal(parseTimeShift('-1h'), -3600000); // DST backward
    });

    it('should handle camera clock errors', () => {
      assert.equal(parseTimeShift('+2h15m'), 8100000); // Camera 2h15m fast
      assert.equal(parseTimeShift('-3h45m'), -13500000); // Camera 3h45m slow
      assert.equal(parseTimeShift('+1d2h'), 93600000); // Camera 1 day ahead
    });
  });
});

describe('applyTimeShift', () => {
  it('should add positive shift', () => {
    const date = new Date('2024-01-01T12:00:00Z');
    const shifted = applyTimeShift(date, 3600000); // +1 hour
    assert.equal(shifted.toISOString(), '2024-01-01T13:00:00.000Z');
  });

  it('should subtract negative shift', () => {
    const date = new Date('2024-01-01T12:00:00Z');
    const shifted = applyTimeShift(date, -3600000); // -1 hour
    assert.equal(shifted.toISOString(), '2024-01-01T11:00:00.000Z');
  });

  it('should handle multi-component shifts', () => {
    const date = new Date('2024-01-01T12:00:00Z');
    const shiftMs = parseTimeShift('+1d2h30m');
    const shifted = applyTimeShift(date, shiftMs);
    assert.equal(shifted.toISOString(), '2024-01-02T14:30:00.000Z');
  });

  it('should return original date if shift is 0', () => {
    const date = new Date('2024-01-01T12:00:00Z');
    const shifted = applyTimeShift(date, 0);
    assert.equal(shifted.toISOString(), date.toISOString());
  });

  it('should return original date if shift is null/undefined', () => {
    const date = new Date('2024-01-01T12:00:00Z');
    assert.equal(applyTimeShift(date, null), date);
    assert.equal(applyTimeShift(date, undefined), date);
  });

  it('should handle date rollover', () => {
    const date = new Date('2024-01-31T23:30:00Z');
    const shiftMs = parseTimeShift('+1h');
    const shifted = applyTimeShift(date, shiftMs);
    assert.equal(shifted.toISOString(), '2024-02-01T00:30:00.000Z');
  });

  it('should handle year rollover', () => {
    const date = new Date('2024-12-31T23:00:00Z');
    const shiftMs = parseTimeShift('+2h');
    const shifted = applyTimeShift(date, shiftMs);
    assert.equal(shifted.toISOString(), '2025-01-01T01:00:00.000Z');
  });
});

describe('formatTimeShift', () => {
  it('should format single units', () => {
    assert.equal(formatTimeShift(86400000), '+1d'); // 1 day
    assert.equal(formatTimeShift(3600000), '+1h'); // 1 hour
    assert.equal(formatTimeShift(60000), '+1m'); // 1 minute
    assert.equal(formatTimeShift(1000), '+1s'); // 1 second
  });

  it('should format negative shifts', () => {
    assert.equal(formatTimeShift(-86400000), '-1d');
    assert.equal(formatTimeShift(-3600000), '-1h');
    assert.equal(formatTimeShift(-60000), '-1m');
  });

  it('should format combined units', () => {
    assert.equal(formatTimeShift(9000000), '+2h 30m'); // 2h 30m
    assert.equal(formatTimeShift(68000), '+1m 8s'); // 1m 8s
    assert.equal(formatTimeShift(95445000), '+1d 2h 30m 45s'); // 1d 2h 30m 45s
  });

  it('should handle zero', () => {
    assert.equal(formatTimeShift(0), '0s');
  });

  it('should omit zero components', () => {
    assert.equal(formatTimeShift(3661000), '+1h 1m 1s'); // No zero components
    assert.equal(formatTimeShift(86460000), '+1d 1m'); // 1d 0h 1m 0s → 1d 1m
  });
});

describe('validateShiftedDate', () => {
  it('should accept reasonable dates', () => {
    assert.equal(validateShiftedDate(new Date('2024-01-01')), true);
    assert.equal(validateShiftedDate(new Date('2025-12-31')), true);
    assert.equal(validateShiftedDate(new Date('2020-06-15')), true);
  });

  it('should reject dates too far in the past', () => {
    assert.equal(validateShiftedDate(new Date('1899-12-31')), false);
    assert.equal(validateShiftedDate(new Date('1800-01-01')), false);
  });

  it('should reject dates too far in the future', () => {
    assert.equal(validateShiftedDate(new Date('2101-01-01')), false);
    assert.equal(validateShiftedDate(new Date('2200-01-01')), false);
  });

  it('should accept boundary dates', () => {
    assert.equal(validateShiftedDate(new Date('1970-01-01')), true);
    assert.equal(validateShiftedDate(new Date('2100-12-31')), true);
  });
});

describe('Integration tests', () => {
  it('should parse and apply shift correctly', () => {
    const date = new Date('2024-06-15T14:30:00Z');
    const shiftMs = parseTimeShift('+2h30m');
    const shifted = applyTimeShift(date, shiftMs);
    assert.equal(shifted.toISOString(), '2024-06-15T17:00:00.000Z');
    assert.equal(formatTimeShift(shiftMs), '+2h 30m');
  });

  it('should handle round-trip formatting', () => {
    const inputs = ['+1d', '+2h30m', '-1h15m', '+1d2h30m45s'];
    
    inputs.forEach(input => {
      const ms = parseTimeShift(input);
      const formatted = formatTimeShift(ms);
      // formatTimeShift adds spaces, so we need to remove them for parsing
      const reparsed = parseTimeShift(formatted.replace(/\s+/g, ''));
      assert.equal(ms, reparsed, `Round-trip failed for ${input}`);
    });
  });

  it('should handle complex real-world scenario', () => {
    // Camera was 1 day and 3 hours fast
    const date = new Date('2024-07-04T16:00:00Z');
    const shiftMs = parseTimeShift('-1d3h');
    const corrected = applyTimeShift(date, shiftMs);
    
    assert.equal(corrected.toISOString(), '2024-07-03T13:00:00.000Z');
    assert.equal(validateShiftedDate(corrected), true);
    assert.equal(formatTimeShift(shiftMs), '-1d 3h');
  });
});
