/**
 * Heuristic-Based Timestamp Detection
 *
 * Alternative to heavy regex patterns - uses component validation approach:
 * 1. Detect digit sequences (2, 4, 6, 8, 10, 12, 13, 14 digits)
 * 2. Identify separators (-, /, ., _, space, T, "at", "à")
 * 3. Validate components (year 1970-2100, month 1-12, day 1-31, hour 0-23, etc.)
 * 4. Intelligently assemble based on context
 */

import {
  isValidYear,
  isValidMonth,
  isValidDay,
  isValidHours,
  isValidMinutes,
  isValidSeconds
} from './dateValidators.js';

/**
 * Validators for timestamp components
 */
const validators = {
  year4: (val) => isValidYear(val, { allowTwoDigit: false }),
  year2: (val) => isValidYear(val, { allowTwoDigit: true }) && val < 100,
  month: (val) => isValidMonth(val),
  day: (val) => isValidDay(val),
  hour: (val) => isValidHours(val),
  minute: (val) => isValidMinutes(val),
  second: (val) => isValidSeconds(val),
  millisecond: (val) => val >= 0 && val <= 999,
};

/**
 * Common separators in timestamps
 */
// Define separators for component extraction (for future use)
const _SEPARATORS = {
  dash: '-',
  slash: '/',
  dot: '.',
  underscore: '_',
  colon: ':',
  space: ' ',
  T: 'T',
};

/**
 * Extract all digit sequences from filename
 * Returns array of {value, start, end, digits}
 */
export function extractDigitSequences(filename) {
  const sequences = [];
  const regex = /\d+/g;
  let match;

  while ((match = regex.exec(filename)) !== null) {
    const value = match[0];
    sequences.push({
      value,
      numValue: parseInt(value, 10),
      start: match.index,
      end: match.index + value.length,
      digits: value.length,
      hasLeadingZero: value[0] === '0' && value.length > 1,
    });
  }

  return sequences;
}

/**
 * Get separator between two positions
 */
function getSeparatorBetween(filename, pos1, pos2) {
  if (pos2 - pos1 < 1) return null;

  const between = filename.slice(pos1, pos2);

  // Check for word separators
  if (between.includes('at')) return 'at';
  if (between.includes('à')) return 'à';

  // Single character separators
  const char = between.trim();
  if (char.length === 1) {
    return char;
  }

  return null;
}

/**
 * Try to parse as compact date: YYYYMMDD (8 digits) or DDMMYYYY (8 digits)
 */
function tryCompactDate(seq) {
  if (seq.digits !== 8) return null;

  const str = seq.value;

  // Try YYYYMMDD first (more common)
  const year_iso = parseInt(str.slice(0, 4), 10);
  const month_iso = parseInt(str.slice(4, 6), 10);
  const day_iso = parseInt(str.slice(6, 8), 10);

  const isValidISO = validators.year4(year_iso) && validators.month(month_iso) && validators.day(day_iso);

  // Try DDMMYYYY (European)
  const day_eu = parseInt(str.slice(0, 2), 10);
  const month_eu = parseInt(str.slice(2, 4), 10);
  const year_eu = parseInt(str.slice(4, 8), 10);

  const isValidEU = validators.day(day_eu) && validators.month(month_eu) && validators.year4(year_eu);

  // Try MMDDYYYY (US)
  const month_us = parseInt(str.slice(0, 2), 10);
  const day_us = parseInt(str.slice(2, 4), 10);
  const year_us = parseInt(str.slice(4, 8), 10);

  const isValidUS = validators.month(month_us) && validators.day(day_us) && validators.year4(year_us);

  // If YYYYMMDD is valid, strongly prefer it (it's the most common format)
  // Only check for DD/MM ambiguity if YYYYMMDD is NOT valid
  if (isValidISO) {
    return {
      type: 'COMPACT_DATE',
      year: year_iso,
      month: month_iso,
      day: day_iso,
      precision: 'day',
      start: seq.start,
      end: seq.end,
    };
  }

  // Check for DDMMYYYY vs MMDDYYYY ambiguity (when both are valid and day/month both 1-12)
  const isAmbiguous = isValidEU && isValidUS && day_eu >= 1 && day_eu <= 12 && month_eu >= 1 && month_eu <= 12;

  if (isAmbiguous) {
    return {
      type: 'COMPACT_AMBIGUOUS',
      year: year_eu,
      month: month_eu,
      day: day_eu,
      precision: 'day',
      start: seq.start,
      end: seq.end,
      ambiguous: true,
      alternatives: [
        { format: 'DDMMYYYY (European)', year: year_eu, month: month_eu, day: day_eu },
        { format: 'MMDDYYYY (US)', year: year_us, month: month_us, day: day_us }
      ]
    };
  }

  // Try remaining formats in order: DDMMYYYY > MMDDYYYY
  if (isValidEU) {
    return {
      type: 'COMPACT_EUROPEAN',
      year: year_eu,
      month: month_eu,
      day: day_eu,
      precision: 'day',
      start: seq.start,
      end: seq.end,
    };
  }

  if (isValidUS) {
    return {
      type: 'COMPACT_US',
      year: year_us,
      month: month_us,
      day: day_us,
      precision: 'day',
      start: seq.start,
      end: seq.end,
    };
  }

  return null;
}

/**
 * Try to parse as Unix timestamp (10 digits, seconds since epoch)
 */
function tryUnixTimestamp(seq) {
  if (seq.digits !== 10) return null;

  const timestamp = seq.numValue;

  // Unix timestamps for 2020-2030: ~1577836800 to ~1893456000
  if (timestamp >= 1577836800 && timestamp <= 1893456000) {
    const date = new Date(timestamp * 1000);

    return {
      type: 'UNIX_TIMESTAMP',
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      precision: 'second',
      start: seq.start,
      end: seq.end,
      unixTimestamp: timestamp,
    };
  }

  return null;
}

/**
 * Try to parse as compact datetime: YYYYMMDDHHMMSS (14 digits)
 */
function tryCompactDateTime(seq) {
  if (seq.digits !== 14) return null;

  const str = seq.value;
  const year = parseInt(str.slice(0, 4), 10);
  const month = parseInt(str.slice(4, 6), 10);
  const day = parseInt(str.slice(6, 8), 10);
  const hour = parseInt(str.slice(8, 10), 10);
  const minute = parseInt(str.slice(10, 12), 10);
  const second = parseInt(str.slice(12, 14), 10);

  if (
    validators.year4(year) &&
    validators.month(month) &&
    validators.day(day) &&
    validators.hour(hour) &&
    validators.minute(minute) &&
    validators.second(second)
  ) {
    return {
      type: 'COMPACT_DATETIME',
      year,
      month,
      day,
      hour,
      minute,
      second,
      precision: 'second',
      start: seq.start,
      end: seq.end,
    };
  }

  return null;
}

/**
 * Try to parse as compact time: HHMMSS (6 digits) or HHMM (4 digits)
 */
function tryCompactTime(seq) {
  // 6 digits: HHMMSS
  if (seq.digits === 6) {
    const str = seq.value;
    const hour = parseInt(str.slice(0, 2), 10);
    const minute = parseInt(str.slice(2, 4), 10);
    const second = parseInt(str.slice(4, 6), 10);

    if (validators.hour(hour) && validators.minute(minute) && validators.second(second)) {
      return {
        type: 'COMPACT_TIME_HMS',
        hour,
        minute,
        second,
        precision: 'second',
        start: seq.start,
        end: seq.end,
      };
    }
  }

  // 4 digits: HHMM
  if (seq.digits === 4) {
    const str = seq.value;
    const hour = parseInt(str.slice(0, 2), 10);
    const minute = parseInt(str.slice(2, 4), 10);

    if (validators.hour(hour) && validators.minute(minute)) {
      return {
        type: 'COMPACT_TIME_HM',
        hour,
        minute,
        second: 0,
        precision: 'minute',
        start: seq.start,
        end: seq.end,
      };
    }
  }

  return null;
}

/**
 * Try to parse as YYYYMM (6 digits) or YYMMDD (6 digits)
 */
function trySixDigits(seq, _filename) {
  if (seq.digits !== 6) return null;

  const str = seq.value;

  // ANTI-FALSE-POSITIVE: Reject obvious patterns (repeating digits, sequences)
  // Examples: 111111, 121212, 123456, 654321
  const isRepeatingPair = /^(\d{2})\1{2}$/.test(str); // 121212, 131313
  const isAllSame = /^(\d)\1{5}$/.test(str); // 111111, 222222
  const isSequential = str === '123456' || str === '654321' || str === '012345';

  if (isRepeatingPair || isAllSame || isSequential) {
    // Likely an ID or pattern, not a date
    return null;
  }

  // Try YYYYMM first (more reliable)
  const yearMonth_year = parseInt(str.slice(0, 4), 10);
  const yearMonth_month = parseInt(str.slice(4, 6), 10);

  if (validators.year4(yearMonth_year) && validators.month(yearMonth_month)) {
    return {
      type: 'YEAR_MONTH',
      year: yearMonth_year,
      month: yearMonth_month,
      precision: 'month',
      start: seq.start,
      end: seq.end,
    };
  }

  // Try YYMMDD
  const yy = parseInt(str.slice(0, 2), 10);
  const mm = parseInt(str.slice(2, 4), 10);
  const dd = parseInt(str.slice(4, 6), 10);

  // Heuristic: if dd is 20-30, it's likely DDMMYY format
  if (dd >= 20 && dd <= 30 && validators.month(mm) && validators.day(yy)) {
    return {
      type: 'EUROPEAN_COMPACT',
      year: 2000 + dd,
      month: mm,
      day: yy,
      precision: 'day',
      start: seq.start,
      end: seq.end,
    };
  }

  // Otherwise assume YYMMDD
  if (validators.month(mm) && validators.day(dd)) {
    return {
      type: 'COMPACT_YY',
      year: 2000 + yy,
      month: mm,
      day: dd,
      precision: 'day',
      start: seq.start,
      end: seq.end,
    };
  }

  return null;
}

/**
 * Try to parse as 4 digits: YYYY, HHMM, or YYMM
 */
function tryFourDigits(seq, filename) {
  if (seq.digits !== 4) return null;

  const str = seq.value;

  // Try as 4-digit year first (most common)
  if (validators.year4(seq.numValue)) {
    // Anti-false-positive: check if this looks like an index number
    // Examples: frame_2048_idx, outline_2055_idx, doc_2074
    const beforeContext = filename.slice(Math.max(0, seq.start - 10), seq.start);
    const afterContext = filename.slice(seq.end, Math.min(filename.length, seq.end + 10));

    // Patterns that suggest this is an index, not a year
    const indexPatterns = [
      /(?:frame|outline|doc|img|image|file|item)[-_]$/i,  // frame_2048
      /^[-_](?:idx|index|id|num|no|n)/i,                  // 2048_idx
      /\bimg[-_]$/i,                                       // img-2048
      /_idx$/i,                                            // outline_257_idx2048
    ];

    const looksLikeIndex = indexPatterns.some(pattern =>
      pattern.test(beforeContext) || pattern.test(afterContext)
    );

    if (looksLikeIndex) {
      return null; // Reject as false positive
    }

    return {
      type: 'YEAR_ONLY',
      year: seq.numValue,
      precision: 'year',
      start: seq.start,
      end: seq.end,
    };
  }

  // Try as HHMM
  const hour = parseInt(str.slice(0, 2), 10);
  const minute = parseInt(str.slice(2, 4), 10);

  if (validators.hour(hour) && validators.minute(minute)) {
    return {
      type: 'COMPACT_TIME_HM',
      hour,
      minute,
      second: 0,
      precision: 'minute',
      start: seq.start,
      end: seq.end,
    };
  }

  // Try as YYMM (20-30 for years, 01-12 for months)
  const yy = parseInt(str.slice(0, 2), 10);
  const mm = parseInt(str.slice(2, 4), 10);

  if (yy >= 20 && yy <= 30 && validators.month(mm)) {
    // Anti-false-positive: check if this looks like an index number
    // Example: outline_302_idx2408 (2408 should not be interpreted as 2024-08)
    const beforeContext = filename.slice(Math.max(0, seq.start - 10), seq.start);
    const afterContext = filename.slice(seq.end, Math.min(filename.length, seq.end + 10));

    const indexPatterns = [
      /(?:frame|outline|doc|img|image|file|item)[-_]$/i,  // frame_2408
      /^[-_](?:idx|index|id|num|no|n)/i,                  // 2408_idx
      /_idx$/i,                                            // outline_302_idx2408
    ];

    const looksLikeIndex = indexPatterns.some(pattern =>
      pattern.test(beforeContext) || pattern.test(afterContext)
    );

    if (looksLikeIndex) {
      return null; // Reject as false positive
    }

    return {
      type: 'YEAR_MONTH_COMPACT',
      year: 2000 + yy,
      month: mm,
      precision: 'month',
      start: seq.start,
      end: seq.end,
    };
  }

  return null;
}

/**
 * Try to parse as 2-digit component (could be year, month, day, etc.)
 * Currently unused but kept for future enhancements
 */
function _tryTwoDigits(seq) {
  if (seq.digits !== 2) return null;

  const val = seq.numValue;

  return {
    value: val,
    possibleTypes: [
      validators.year2(val) ? 'year2' : null,
      validators.month(val) ? 'month' : null,
      validators.day(val) ? 'day' : null,
      validators.hour(val) ? 'hour' : null,
      validators.minute(val) ? 'minute' : null,
      validators.second(val) ? 'second' : null,
    ].filter(Boolean),
    start: seq.start,
    end: seq.end,
  };
}

/**
 * Detect French time format: HHhMMmSSsmmm or HHhMMmSSs
 * Examples: 14h05m37s448, 19h22m44s055
 */
function detectFrenchTime(filename) {
  // Match: 2digits + h + 2digits + m + 2digits + s + optional 3digits
  const frenchTimeRegex = /(\d{2})h(\d{2})m(\d{2})s(\d{3})?/g;
  const matches = [];

  let match;
  while ((match = frenchTimeRegex.exec(filename)) !== null) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const milliseconds = match[4] ? parseInt(match[4], 10) : 0;

    if (validators.hour(hours) && validators.minute(minutes) && validators.second(seconds)) {
      matches.push({
        type: 'FRENCH_TIME',
        hour: hours,
        minute: minutes,
        second: seconds,
        millisecond: milliseconds,
        precision: match[4] ? 'millisecond' : 'second',
        start: match.index,
        end: match.index + match[0].length,
        timeOnly: true, // Flag to indicate this needs a date component
      });
    }
  }

  return matches;
}

/**
 * Analyze sequence of 2-digit components with separators
 * Typical patterns:
 * - YYYY-MM-DD (4-2-2)
 * - DD-MM-YYYY (2-2-4)
 * - YY-MM-DD (2-2-2)
 * - HH:MM:SS (2-2-2 with colon)
 */
function analyzeSeparatedComponents(sequences, filename, dateFormat = 'dmy') {
  const results = [];

  for (let i = 0; i < sequences.length; i++) {
    const seq = sequences[i];

    // Look for date patterns: X-X-X or X.X.X or X/X/X
    if (i + 2 < sequences.length) {
      const seq2 = sequences[i + 1];
      const seq3 = sequences[i + 2];

      const sep1 = getSeparatorBetween(filename, seq.end, seq2.start);
      const sep2 = getSeparatorBetween(filename, seq2.end, seq3.start);

      // Same separator and common date separators
      if (sep1 && sep1 === sep2 && ['-', '.', '/', '_'].includes(sep1)) {
        // Pattern: 4-2-2 = YYYY-MM-DD
        if (seq.digits === 4 && seq2.digits === 2 && seq3.digits === 2) {
          const year = seq.numValue;
          const month = seq2.numValue;
          const day = seq3.numValue;

          if (validators.year4(year) && validators.month(month) && validators.day(day)) {
            results.push({
              type: 'ISO_DATE',
              year,
              month,
              day,
              precision: 'day',
              start: seq.start,
              end: seq3.end,
              separator: sep1,
            });
            i += 2; // Skip processed sequences
            continue;
          }
        }

        // Pattern: 2-2-4 = DD-MM-YYYY (European) or MM-DD-YYYY (US), depends on dateFormat
        if (seq.digits === 2 && seq2.digits === 2 && seq3.digits === 4) {
          const v1 = seq.numValue;
          const v2 = seq2.numValue;
          const year = seq3.numValue;

          // Check if both interpretations are valid
          const isValidEuropean = validators.day(v1) && validators.month(v2) && validators.year4(year);
          const isValidUS = validators.month(v1) && validators.day(v2) && validators.year4(year);

          // If only one interpretation is valid, use it
          if (isValidEuropean && !isValidUS) {
            results.push({
              type: 'EUROPEAN_DATE',
              year,
              month: v2,
              day: v1,
              precision: 'day',
              start: seq.start,
              end: seq3.end,
              separator: sep1,
            });
            i += 2;
            continue;
          } else if (isValidUS && !isValidEuropean) {
            results.push({
              type: 'US_DATE',
              year,
              month: v1,
              day: v2,
              precision: 'day',
              start: seq.start,
              end: seq3.end,
              separator: sep1,
            });
            i += 2;
            continue;
          } else if (isValidEuropean && isValidUS) {
            // Both valid - use dateFormat to decide
            if (dateFormat === 'mdy') {
              // US format: MM-DD-YYYY
              results.push({
                type: 'US_DATE',
                year,
                month: v1,
                day: v2,
                precision: 'day',
                start: seq.start,
                end: seq3.end,
                separator: sep1,
              });
            } else {
              // European format (default): DD-MM-YYYY
              results.push({
                type: 'EUROPEAN_DATE',
                year,
                month: v2,
                day: v1,
                precision: 'day',
                start: seq.start,
                end: seq3.end,
                separator: sep1,
              });
            }
            i += 2;
            continue;
          }
        }

        // Pattern: 2-2-2 = could be TIME (HH:MM:SS) or DATE (YY-MM-DD or DD-MM-YY)
        // IMPORTANT: Check TIME first because time constraints are stricter
        if (seq.digits === 2 && seq2.digits === 2 && seq3.digits === 2) {
          const v1 = seq.numValue;
          const v2 = seq2.numValue;
          const v3 = seq3.numValue;

          // First check if it's a valid TIME (HH:MM:SS) - stricter constraints
          if (validators.hour(v1) && validators.minute(v2) && validators.second(v3)) {
            results.push({
              type: 'TIME',
              hour: v1,
              minute: v2,
              second: v3,
              precision: 'second',
              start: seq.start,
              end: seq3.end,
              separator: sep1,
            });
            i += 2;
            continue;
          }

          // Then check if it's a date: DD-MM-YY (2020-2030)
          // Heuristic: if v3 >= 20 && v3 <= 30, likely DD-MM-YY
          if (v3 >= 20 && v3 <= 30 && validators.day(v1) && validators.month(v2)) {
            results.push({
              type: 'EUROPEAN_YY_DATE',
              year: 2000 + v3,
              month: v2,
              day: v1,
              precision: 'day',
              start: seq.start,
              end: seq3.end,
              separator: sep1,
            });
            i += 2;
            continue;
          }

          // Try YY-MM-DD (ISO-like with 2-digit year)
          if (v1 >= 20 && v1 <= 30 && validators.month(v2) && validators.day(v3)) {
            results.push({
              type: 'ISO_YY_DATE',
              year: 2000 + v1,
              month: v2,
              day: v3,
              precision: 'day',
              start: seq.start,
              end: seq3.end,
              separator: sep1,
            });
            i += 2;
            continue;
          }
        }
      }
    }

    // Look for YYYY-MM or YY-MM or HH:MM pattern
    if (i + 1 < sequences.length) {
      const seq2 = sequences[i + 1];
      const sep = getSeparatorBetween(filename, seq.end, seq2.start);

      if (sep && ['-', '.', '_', ':'].includes(sep)) {
        // YYYY-MM
        if (seq.digits === 4 && seq2.digits === 2) {
          const year = seq.numValue;
          const month = seq2.numValue;

          if (validators.year4(year) && validators.month(month)) {
            results.push({
              type: 'YEAR_MONTH',
              year,
              month,
              precision: 'month',
              start: seq.start,
              end: seq2.end,
              separator: sep,
            });
            i += 1;
            continue;
          }
        }

        // YY-MM or HH:MM
        if (seq.digits === 2 && seq2.digits === 2) {
          const v1 = seq.numValue;
          const v2 = seq2.numValue;

          // Check if it's time (HH:MM) - colon separator or values suggest time
          if (sep === ':' || (validators.hour(v1) && validators.minute(v2))) {
            // Check if previous component was a date (context-aware detection)
            const prevIsDate = results.length > 0 &&
                              results[results.length - 1].precision === 'day' &&
                              (results[results.length - 1].end === seq.start - 1 ||
                               results[results.length - 1].end === seq.start - 2);

            // Only add as time if it's really a time pattern (not a date)
            // Accept if: colon separator, values > 12, OR previous component was a date
            if (sep === ':' || v1 > 12 || v2 > 12 || prevIsDate) {
              results.push({
                type: 'TIME_HM',
                hour: v1,
                minute: v2,
                second: 0,
                precision: 'minute',
                start: seq.start,
                end: seq2.end,
                separator: sep,
              });
              i += 1;
              continue;
            }
          }

          // Check if it's YY-MM (year-month)
          if (v1 >= 20 && v1 <= 30 && validators.month(v2)) {
            results.push({
              type: 'YEAR_MONTH_YY',
              year: 2000 + v1,
              month: v2,
              precision: 'month',
              start: seq.start,
              end: seq2.end,
              separator: sep,
            });
            i += 1;
            continue;
          }
        }
      }
    }
  }

  return results;
}

/**
 * Combine date and time components that are adjacent
 */
function combineDateTimeComponents(components, filename) {
  const combined = [];

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];

    // If this is a date, look for adjacent time
    if (comp.precision === 'day' && i + 1 < components.length) {
      const nextComp = components[i + 1];

      // Check if next component is a time (various types)
      const isTimeComponent = nextComp.type === 'TIME' ||
                             nextComp.type === 'TIME_HM' ||
                             nextComp.type === 'COMPACT_TIME_HMS' ||
                             nextComp.type === 'COMPACT_TIME_HM' ||
                             nextComp.type === 'FRENCH_TIME';

      if (isTimeComponent) {
        // Check if they're reasonably close (allow for "at", "à", "T", space, etc.)
        const between = filename.slice(comp.end, nextComp.start);

        // Allow up to 5 characters for separators like " at ", "à", "T", "_", "-", etc.
        if (between.length <= 5) {
          combined.push({
            ...comp,
            hour: nextComp.hour || 0,
            minute: nextComp.minute || 0,
            second: nextComp.second || 0,
            millisecond: nextComp.millisecond || 0,
            precision: nextComp.precision || 'second',
            end: nextComp.end,
          });
          i++; // Skip the time component
          continue;
        }
      }
    }

    combined.push(comp);
  }

  return combined;
}

/**
 * Main heuristic detection function
 * Returns array of detected timestamps with their positions
 */
export function detectTimestampHeuristic(filename, options = {}) {
  const { dateFormat = 'dmy' } = options;

  // Extract all digit sequences
  const sequences = extractDigitSequences(filename);

  if (sequences.length === 0) {
    return [];
  }

  const results = [];
  const processedRanges = []; // Track which sequences we've already processed

  // Helper to check if a sequence was already processed
  const isProcessed = (seq) => {
    return processedRanges.some(
      (range) => seq.start >= range.start && seq.end <= range.end
    );
  };

  // First, detect French time format (HHhMMmSSs) which has letter separators
  // This must be done before other analysis since it uses letters not digits
  const frenchTimes = detectFrenchTime(filename);
  for (const timeComp of frenchTimes) {
    results.push(timeComp);
    processedRanges.push({ start: timeComp.start, end: timeComp.end });
  }

  // Try separated formats first (multiple sequences with separators)
  // These are more reliable than single compact sequences
  const separated = analyzeSeparatedComponents(sequences, filename, dateFormat);
  for (const comp of separated) {
    results.push(comp);
    processedRanges.push({ start: comp.start, end: comp.end });
  }

  // Then try compact formats (single sequences) for unprocessed sequences
  for (const seq of sequences) {
    if (isProcessed(seq)) continue;

    // 14 digits: YYYYMMDDHHMMSS
    const compact14 = tryCompactDateTime(seq);
    if (compact14) {
      results.push(compact14);
      processedRanges.push({ start: seq.start, end: seq.end });
      continue;
    }

    // 10 digits: Unix timestamp
    const unix = tryUnixTimestamp(seq);
    if (unix) {
      results.push(unix);
      processedRanges.push({ start: seq.start, end: seq.end });
      continue;
    }

    // 12 digits: YYMMDDHHMMSS
    if (seq.digits === 12) {
      const yy = parseInt(seq.value.slice(0, 2), 10);
      const mm = parseInt(seq.value.slice(2, 4), 10);
      const dd = parseInt(seq.value.slice(4, 6), 10);
      const hh = parseInt(seq.value.slice(6, 8), 10);
      const min = parseInt(seq.value.slice(8, 10), 10);
      const ss = parseInt(seq.value.slice(10, 12), 10);

      if (yy >= 20 && yy <= 30 &&
          validators.month(mm) && validators.day(dd) &&
          validators.hour(hh) && validators.minute(min) && validators.second(ss)) {
        results.push({
          type: 'COMPACT_YY_DATETIME',
          year: 2000 + yy,
          month: mm,
          day: dd,
          hour: hh,
          minute: min,
          second: ss,
          precision: 'second',
          start: seq.start,
          end: seq.end,
        });
        processedRanges.push({ start: seq.start, end: seq.end });
        continue;
      }
    }

    // 8 digits: YYYYMMDD or DDMMYYYY or MMDDYYYY
    const compact8 = tryCompactDate(seq);
    if (compact8) {
      results.push(compact8);
      processedRanges.push({ start: seq.start, end: seq.end });
      continue;
    }

    // 6 digits: YYYYMM, YYMMDD, or HHMMSS
    // Smart detection: if preceded by 8-digit date, prefer time interpretation
    if (seq.digits === 6) {
      const compact6time = tryCompactTime(seq);
      const compact6date = trySixDigits(seq, filename);

      // Check if there's a recent 8-digit date component before this sequence
      const hasRecentDate = results.some(r =>
        r.precision === 'day' &&
        r.end < seq.start &&
        (seq.start - r.end) <= 5 // Within 5 chars (e.g., "_", "-", " ")
      );

      // Prefer time if we have both interpretations and there's a recent date
      if (compact6time && compact6date && hasRecentDate) {
        results.push(compact6time);
        processedRanges.push({ start: seq.start, end: seq.end });
        continue;
      }

      // Otherwise, prefer date interpretation (YYYYMM is very common)
      if (compact6date) {
        results.push(compact6date);
        processedRanges.push({ start: seq.start, end: seq.end });
        continue;
      }

      if (compact6time) {
        results.push(compact6time);
        processedRanges.push({ start: seq.start, end: seq.end });
        continue;
      }
    }

    // 4 digits: YYYY, HHMM, or YYMM
    const four = tryFourDigits(seq, filename);
    if (four) {
      results.push(four);
      processedRanges.push({ start: seq.start, end: seq.end });
      continue;
    }
  }

  // Sort by position BEFORE combining (so date comes before time)
  results.sort((a, b) => a.start - b.start);

  // Combine date + time components
  const combined = combineDateTimeComponents(results, filename);

  // Sort by precision for final ranking
  combined.sort((a, b) => {
    // First by position
    if (a.start !== b.start) return a.start - b.start;

    // Then by precision (more specific first)
    const precisionOrder = { millisecond: 5, second: 4, day: 3, month: 2, year: 1 };
    const precA = precisionOrder[a.precision] || 0;
    const precB = precisionOrder[b.precision] || 0;
    return precB - precA;
  });

  return combined;
}

/**
 * Get the best (most precise) timestamp from filename
 */
export function getBestTimestamp(filename, options = {}) {
  const { dateFormat = 'dmy' } = options;
  const timestamps = detectTimestampHeuristic(filename, { dateFormat });

  if (timestamps.length === 0) {
    return null;
  }

  // Special case: merge DATE + TIME when separated (e.g., "2025-10-08 00.00.00 - 10.03.23")
  // Look for pattern: full date with time (precision=second) followed by another time component
  const fullDateTime = timestamps.find(ts => ts.year && ts.month && ts.day && ts.precision === 'second');
  const timeOnly = timestamps.find(ts => !ts.year && ts.hour !== undefined && ts.precision === 'second');

  if (fullDateTime && timeOnly && timeOnly.start > fullDateTime.end) {
    // Merge: use date from first, time from second
    return {
      ...fullDateTime,
      hour: timeOnly.hour,
      minute: timeOnly.minute,
      second: timeOnly.second,
      start: fullDateTime.start,
      end: timeOnly.end,
      type: 'MERGED_DATETIME',
    };
  }

  // Precision order: millisecond > second > day > month > year
  const precisionOrder = { millisecond: 5, second: 4, day: 3, month: 2, year: 1 };

  timestamps.sort((a, b) => {
    const precA = precisionOrder[a.precision] || 0;
    const precB = precisionOrder[b.precision] || 0;

    // If same precision, prefer the one with time components (more complete)
    if (precA === precB) {
      const hasTimeA = a.hour !== undefined ? 1 : 0;
      const hasTimeB = b.hour !== undefined ? 1 : 0;
      if (hasTimeA !== hasTimeB) {
        return hasTimeB - hasTimeA;
      }
      // If still equal, prefer the later one in the filename
      return b.start - a.start;
    }

    return precB - precA;
  });

  return timestamps[0];
}

/**
 * Format timestamp as ISO string
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return null;

  const year = String(timestamp.year).padStart(4, '0');
  const month = String(timestamp.month || 1).padStart(2, '0');
  const day = String(timestamp.day || 1).padStart(2, '0');

  let result = `${year}-${month}-${day}`;

  if (timestamp.precision === 'second') {
    const hour = String(timestamp.hour || 0).padStart(2, '0');
    const minute = String(timestamp.minute || 0).padStart(2, '0');
    const second = String(timestamp.second || 0).padStart(2, '0');
    result += `T${hour}:${minute}:${second}`;
  }

  return result;
}

/**
 * Convert timestamp to Date object for compatibility with existing code
 * @param {Object} timestamp - Parsed timestamp object
 * @param {Object} options - Conversion options
 * @param {boolean} options.allowTimeOnly - Allow time-only patterns (uses current date)
 * @returns {Date|null}
 */
export function timestampToDate(timestamp, options = {}) {
  if (!timestamp) return null;

  // Handle time-only patterns if allowed
  if (!timestamp.year && options.allowTimeOnly) {
    // Time-only: use current date
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const hour = timestamp.hour || 0;
    const minute = timestamp.minute || 0;
    const second = timestamp.second || 0;
    const millisecond = timestamp.millisecond || 0;

    // Validate time ranges
    if (hour < 0 || hour > 23) return null;
    if (minute < 0 || minute > 59) return null;
    if (second < 0 || second > 59) return null;

    const date = new Date(year, month, day, hour, minute, second, millisecond);
    if (Number.isNaN(date.getTime())) return null;

    // Mark as time-only
    date.precision = 'time';
    date.timeOnly = true;

    return date;
  }

  // Skip time-only patterns (no year) by default
  if (!timestamp.year) return null;

  const year = timestamp.year;
  const month = (timestamp.month || 1) - 1; // JS months are 0-indexed
  const day = timestamp.day || 1;
  const hour = timestamp.hour || 0;
  const minute = timestamp.minute || 0;
  const second = timestamp.second || 0;
  const millisecond = timestamp.millisecond || 0;

  // Validate ranges
  if (year < 1970 || year > 2100) return null;
  if (month < 0 || month > 11) return null;
  if (day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;

  const date = new Date(year, month, day, hour, minute, second, millisecond);

  // Verify date is valid (catch invalid dates like Feb 31)
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  // Add precision property to Date object
  date.precision = timestamp.precision;

  // Add ambiguity info if present
  if (timestamp.ambiguous) {
    date.ambiguous = true;
    date.alternatives = timestamp.alternatives;
  }

  return date;
}
