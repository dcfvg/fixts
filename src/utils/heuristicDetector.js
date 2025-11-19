/* Browser-safe module ✓ */
/**
 * @module heuristicDetector
 * @browserSafe true
 * @description Heuristic-Based Timestamp Detection
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

import { CONFIDENCE } from '../config/constants.js';

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

// Month abbreviations (English, can be extended if needed)
const MONTHS_ABBR = {
  jan: 1,
  janv: 1,
  january: 1,
  janvier: 1,
  feb: 2,
  fev: 2,
  fevr: 2,
  febr: 2,
  february: 2,
  fevrier: 2,
  mar: 3,
  mars: 3,
  march: 3,
  apr: 4,
  avril: 4,
  april: 4,
  may: 5,
  jun: 6,
  juin: 6,
  junio: 6,
  jul: 7,
  juillet: 7,
  julio: 7,
  aug: 8,
  aout: 8,
  agosto: 8,
  august: 8,
  sep: 9,
  sept: 9,
  septembre: 9,
  septiembre: 9,
  oct: 10,
  octobre: 10,
  october: 10,
  nov: 11,
  novembre: 11,
  november: 11,
  dec: 12,
  december: 12,
  decembre: 12,
};

/**
 * Precompute blacklist ranges (GUIDs, hex IDs, versions, resolutions/bitrates, backup markers)
 * These ranges are skipped or penalized to reduce false positives
 */
function detectBlacklistedRanges(filename) {
  const ranges = [];

  const patterns = [
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, // GUID
    /\b[0-9a-fA-F]{32}\b/g, // long hex ids
    /\b[0-9a-fA-F]{40}\b/g, // SHA1-like
    /\b[0-9A-Za-z]{32,40}\b/g, // base36/base62 ids
    /\bv?\d+\.\d+\.\d+(?:\.\d+)?\b/g, // version numbers
    /\b\d{3,4}[pi]\b/gi, // 1080p, 1080i, 2160p
    /\b[34]k\b/gi, // 4k, 3k
    /\b\d{2,3}0kbps\b/gi, // 320kbps etc.
    /\b2\.4ghz\b/gi,
    /\bframe\d{3,}\b/gi, // frame counters
    /\b(?:_final|_backup)\b/gi,
    /\b(?:_v?final|_copy|draft)\b/gi,
    /checksum/gi,
  ];

  for (const regex of patterns) {
    let m;
    while ((m = regex.exec(filename)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  return ranges;
}

function isInBlacklistedRange(ranges, seq) {
  return ranges.some((range) => seq.start >= range.start && seq.end <= range.end);
}

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
 * @param {string} filename - Filename to check
 * @param {number} pos1 - Start position
 * @param {number} pos2 - End position
 * @returns {string|null} - Separator character/string or null
 * @private
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
 * @param {Object} seq - Digit sequence object from extractDigitSequences
 * @returns {Object|null} - Parsed timestamp or null
 * @private
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
 * Epoch timestamp detection range (looser than before to reduce false negatives)
 */
const DEFAULT_EPOCH_YEAR_RANGE = {
  min: 2015,
  max: 2035,
};

function isDateWithinEpochRange(date, epochRange = DEFAULT_EPOCH_YEAR_RANGE) {
  if (!date || Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  return year >= epochRange.min && year <= epochRange.max;
}

/**
 * Try to parse as Unix timestamp in seconds (10 digits), milliseconds (13 digits) or microseconds (16 digits)
 * @param {Object} seq - Digit sequence object from extractDigitSequences
 * @param {Object} epochRange - Allowed UTC year window for epoch conversion
 * @returns {Object|null} - Parsed timestamp or null
 * @private
 */
function tryUnixTimestamp(seq, epochRange = DEFAULT_EPOCH_YEAR_RANGE) {
  if (![10, 13, 16].includes(seq.digits)) return null;

  // 10 = seconds, 13 = ms, 16 = micro (convert to ms)
  const raw = seq.numValue;
  const isSafe = Number.isSafeInteger(raw);
  if (!isSafe) return null;

  let epochMs = null;
  let type = null;

  if (seq.digits === 10) {
    epochMs = raw * 1000;
    type = 'UNIX_TIMESTAMP';
  } else if (seq.digits === 13) {
    epochMs = raw;
    type = 'UNIX_MILLISECONDS';
  } else if (seq.digits === 16) {
    epochMs = Math.floor(raw / 1000); // microseconds to milliseconds
    type = 'UNIX_MICROSECONDS';
  }

  if (epochMs === null) return null;

  const date = new Date(epochMs);
  if (!isDateWithinEpochRange(date, epochRange)) return null;

  return {
    type,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    precision: 'second',
    start: seq.start,
    end: seq.end,
    unixTimestamp: Math.floor(epochMs / 1000),
    unixMs: epochMs,
  };
}

/**
 * Try to parse as compact datetime: YYYYMMDDHHMMSS (14 digits)
 * @param {Object} seq - Digit sequence object from extractDigitSequences
 * @returns {Object|null} - Parsed timestamp or null
 * @private
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
 * @param {Object} seq - Digit sequence object from extractDigitSequences
 * @returns {Object|null} - Parsed timestamp or null
 * @private
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
 * @param {Object} seq - Digit sequence object from extractDigitSequences
 * @param {string} _filename - Filename context (unused but kept for API consistency)
 * @returns {Object|null} - Parsed timestamp or null
 * @private
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
 * @param {Object} seq - Digit sequence object from extractDigitSequences
 * @param {string} filename - Filename for context
 * @returns {Object|null} - Parsed timestamp or null
 * @private
 */
function tryFourDigits(seq, filename) {
  if (seq.digits !== 4) return null;

  const str = seq.value;
  const resolutionAfter = filename.slice(seq.end, Math.min(filename.length, seq.end + 6));
  const resolutionBefore = filename.slice(Math.max(0, seq.start - 5), seq.start);
  const looksLikeResolution = /^x\d{3,4}/i.test(resolutionAfter) || /\d{3,4}x$/i.test(resolutionBefore);

  if (looksLikeResolution) {
    return null;
  }

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
    const resolutionContext = filename.slice(seq.end, Math.min(filename.length, seq.end + 6));
    if (/^p(?![a-z])/i.test(resolutionContext) || /^px/i.test(resolutionContext)) {
      return null;
    }

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
/**
 * Detect French time format: HHhMMmSSsmmm or HHhMMmSSs
 * Examples: 14h05m37s448, 19h22m44s055
 * @param {string} filename - Filename to search
 * @returns {Array<Object>} - Array of detected French time matches
 * @private
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
 * Detect ISO-like datetimes with optional milliseconds and timezone
 * Supports:
 *  - 2024-03-15T12:30:45.123Z
 *  - 2024-03-15T12.30.45Z
 *  - 20240315 123045+0200
 * @param {string} filename
 * @param {Object} options
 * @param {boolean} options.debug
 * @param {Object} options.epochRange
 * @returns {Array<Object>}
 */
function detectIsoLikeDateTimes(filename, { debug = false, epochRange: _epochRange = DEFAULT_EPOCH_YEAR_RANGE } = {}) {
  const matches = [];

  const isoRegex = /(\d{4})-(\d{2})-(\d{2})[T\s](\d{2})[:.](\d{2})[:.](\d{2})(?:[.,](\d{3}))?\s*(Z|UTC|[+-]\d{2}(?::?\d{2})?)?/gi;
  const compactTzRegex = /(\d{4})(\d{2})(\d{2})[ T]?(\d{2})(\d{2})(\d{2})(?:[.,](\d{3}))?\s*(Z|UTC|[+-]\d{2}(?::?\d{2})?)/gi;

  const processMatch = (match, groups, index) => {
    const [year, month, day, hour, minute, second, milliRaw, tzRaw] = groups;
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);
    const secondNum = parseInt(second, 10);
    const millisecond = milliRaw ? parseInt(milliRaw.replace(/[.,]/, ''), 10) : 0;

    if (!(validators.year4(yearNum) && validators.month(monthNum) && validators.day(dayNum) &&
      validators.hour(hourNum) && validators.minute(minuteNum) && validators.second(secondNum))) {
      return;
    }

    const timezone = tzRaw ? tzRaw.toUpperCase() : undefined;
    const utcOffsetMinutes = timezone ? parseTimezoneOffset(timezone) : undefined;

    const start = index;
    const end = index + match.length;

    matches.push({
      type: 'ISO_DATETIME',
      year: yearNum,
      month: monthNum,
      day: dayNum,
      hour: hourNum,
      minute: minuteNum,
      second: secondNum,
      millisecond,
      precision: millisecond ? 'millisecond' : 'second',
      start,
      end,
      timezone,
      utcOffsetMinutes,
      trace: debug ? 'iso-like' : undefined,
    });
  };

  let m;
  while ((m = isoRegex.exec(filename)) !== null) {
    processMatch(m[0], [m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]], m.index);
  }

  while ((m = compactTzRegex.exec(filename)) !== null) {
    processMatch(m[0], [m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]], m.index);
  }

  return matches;
}

/**
 * Detect dates with month names/abbreviations (English)
 * Examples: 15-Mar-2024, Mar_15_2024
 * @param {string} filename
 * @param {Object} options
 * @param {boolean} options.debug
 */
function detectMonthNameDates(filename, { debug = false } = {}) {
  const results = [];
  const monthAlternatives = Object.keys(MONTHS_ABBR).join('|');

  const boundary = '(?:$|[^0-9A-Za-z])';
  const timeOpt = '(?:\\s+(\\d{2})[:h\\.]?(\\d{2})(?:[:\\.]?(\\d{2}))?)?';
  const dayFirst = new RegExp(`(\\d{1,2})[._\\-\\s](${monthAlternatives})[,_\\-\\s]*(\\d{4})${timeOpt}(?=${boundary})`, 'gi');
  const monthFirst = new RegExp(`(${monthAlternatives})[._\\-\\s](\\d{1,2})[,_\\-\\s]*(\\d{4})${timeOpt}(?=${boundary})`, 'gi');

  const process = (match, dayStr, monthStr, yearStr, timeParts, index) => {
    const day = parseInt(dayStr, 10);
    const month = MONTHS_ABBR[monthStr.toLowerCase().slice(0, 3)];
    const year = parseInt(yearStr, 10);
    const [hourStr, minStr, secStr] = timeParts || [];
    const hour = hourStr ? parseInt(hourStr, 10) : undefined;
    const minute = minStr ? parseInt(minStr, 10) : undefined;
    const second = secStr ? parseInt(secStr, 10) : undefined;

    const baseValid = validators.year4(year) && validators.month(month) && validators.day(day);
    const timeValid = hour === undefined ||
      (validators.hour(hour) && validators.minute(minute || 0) && (second === undefined || validators.second(second)));

    if (baseValid && timeValid) {
      results.push({
        type: 'MONTH_NAME_DATE',
        year,
        month,
        day,
        hour: hour ?? undefined,
        minute: minute ?? undefined,
        second: second ?? undefined,
        precision: hour !== undefined ? (second !== undefined ? 'second' : 'minute') : 'day',
        start: index,
        end: index + match.length,
        separator: '-',
        trace: debug ? 'month-name' : undefined,
      });
    }
  };

  let m;
  while ((m = dayFirst.exec(filename)) !== null) {
    process(m[0], m[1], m[2], m[3], [m[4], m[5], m[6]], m.index);
  }

  while ((m = monthFirst.exec(filename)) !== null) {
    process(m[0], m[2], m[1], m[3], [m[4], m[5], m[6]], m.index);
  }

  return results;
}

/**
 * Infer date format preference from filename context (very lightweight heuristic)
 * Returns 'mdy' or 'dmy'
 */
function inferDateFormatPreference(filename) {
  const lower = filename.toLowerCase();

  let mdyScore = 0;
  let dmyScore = 0;

  // Locale hints
  if (/(^|[_.-])(us|usa|america)([^a-z]|$)/.test(lower)) mdyScore += 2;
  if (/(^|[_.-])(uk|eu|fr|de|es|it)([^a-z]|$)/.test(lower)) dmyScore += 2;

  // Extension hints
  if (/\.(us)\b/.test(lower)) mdyScore += 1;
  if (/\.(uk)\b/.test(lower)) dmyScore += 1;

  // Timezone hints: negative offsets more common US, positive EU/Asia (rough heuristic)
  if (/[+-]0[0-5]:?\d{2}/.test(lower) || /-[0-9]{2}/.test(lower)) mdyScore += 1;
  if (/\+0[1-3]:?\d{2}/.test(lower) || /\+0[4-9]:?\d{2}/.test(lower)) dmyScore += 1;

  return mdyScore > dmyScore ? 'mdy' : 'dmy';
}

/**
 * Analyze sequence of 2-digit components with separators
 * Typical patterns:
 * - YYYY-MM-DD (4-2-2)
 * - DD-MM-YYYY (2-2-4)
 * - YY-MM-DD (2-2-2)
 * - HH:MM:SS (2-2-2 with colon)
 * @param {Array<Object>} sequences - Digit sequences from extractDigitSequences
 * @param {string} filename - Filename for context
 * @param {string} dateFormat - Date format preference ('dmy' or 'mdy')
 * @returns {Object|null} - Parsed timestamp components or null
 * @private
 */
function analyzeSeparatedComponents(sequences, filename, { dateFormat = 'dmy', localePreference = 'dmy', debug = false } = {}) {
  const results = [];
  const preferredFormat = dateFormat === 'auto' ? localePreference : dateFormat;

  for (let i = 0; i < sequences.length; i++) {
    const seq = sequences[i];

    // Look for date patterns: X-X-X or X.X.X or X/X/X
    if (i + 2 < sequences.length) {
      const seq2 = sequences[i + 1];
      const seq3 = sequences[i + 2];

      const sep1 = getSeparatorBetween(filename, seq.end, seq2.start);
      const sep2 = getSeparatorBetween(filename, seq2.end, seq3.start);

      // Same separator and common date/time separators
      // Include colon for time formats (HH:MM:SS)
      if (sep1 && sep1 === sep2 && ['-', '.', '/', '_', ':'].includes(sep1)) {
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
            // Both valid - emit both and let preference/confidence decide
            results.push({
              type: 'US_DATE',
              year,
              month: v1,
              day: v2,
              precision: 'day',
              start: seq.start,
              end: seq3.end,
              separator: sep1,
              ambiguous: true,
              preferenceBoost: preferredFormat === 'mdy' ? 0.4 : 0,
              trace: debug ? 'ambiguous-us' : undefined,
            });
            results.push({
              type: 'EUROPEAN_DATE',
              year,
              month: v2,
              day: v1,
              precision: 'day',
              start: seq.start,
              end: seq3.end,
              separator: sep1,
              ambiguous: true,
              preferenceBoost: preferredFormat !== 'mdy' ? 0.4 : 0,
              trace: debug ? 'ambiguous-eu' : undefined,
            });
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
 * Parse timezone offsets like Z, UTC, +0200, -05:00
 * @param {string} tzString
 * @returns {number|null} offset in minutes or null if invalid
 */
function parseTimezoneOffset(tzString) {
  if (!tzString) return null;
  if (/^z$/i.test(tzString) || /^utc$/i.test(tzString)) return 0;

  const match = /^([+-])(\d{2})(?::?(\d{2}))?$/.exec(tzString);
  if (!match) return null;

  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;

  if (hours > 14 || minutes > 59) return null; // Avoid wild offsets

  return sign * (hours * 60 + minutes);
}

/**
 * Detect timezone token immediately following a timestamp
 * @param {string} filename
 * @param {number} index - Position to start searching (typically end of time component)
 * @returns {Object|null}
 */
function detectTimezoneAt(filename, index) {
  const tail = filename.slice(index);
  const match = /^[\sT_-]*(Z|UTC|[+-]\d{2}(?::?\d{2})?)/i.exec(tail);

  if (!match) return null;

  const timezone = match[1].toUpperCase();
  const utcOffsetMinutes = parseTimezoneOffset(timezone);
  if (utcOffsetMinutes === null || Number.isNaN(utcOffsetMinutes)) {
    return null;
  }
  return {
    timezone,
    utcOffsetMinutes,
    end: index + match[0].length,
  };
}

/**
 * Combine date and time components that are adjacent
 * @param {Array<Object>} components - Parsed timestamp components
 * @param {string} filename - Filename for context
 * @returns {Array<Object>} - Combined date-time components
 * @private
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

  // Attach timezone info if present right after the component
  return combined.map((comp) => {
    const hasTime = comp.precision === 'second' || comp.precision === 'millisecond';
    if (!hasTime) return comp;

    const tz = detectTimezoneAt(filename, comp.end);
    if (tz) {
      return {
        ...comp,
        timezone: tz.timezone,
        utcOffsetMinutes: tz.utcOffsetMinutes,
        end: tz.end,
      };
    }

    return comp;
  });
}

/**
 * Main heuristic detection function
 * Returns array of detected timestamps with their positions
 */
export function detectTimestampHeuristic(filename, options = {}) {
  const {
    dateFormat = 'dmy',
    debug = false,
    epochRange = DEFAULT_EPOCH_YEAR_RANGE,
  } = options;

  const localePreference = inferDateFormatPreference(filename);
  const effectiveDateFormat = dateFormat === 'auto' ? localePreference : dateFormat;

  // Extract all digit sequences
  const sequences = extractDigitSequences(filename);

  if (sequences.length === 0) {
    return [];
  }

  const results = [];
  const processedRanges = []; // Track which sequences we've already processed
  const blacklistRanges = detectBlacklistedRanges(filename);

  // Helper to check if a sequence was already processed
  const isProcessed = (seq) => {
    return processedRanges.some(
      (range) => seq.start >= range.start && seq.end <= range.end
    );
  };

  // First, detect month-name dates and ISO-like patterns (use letters/mixed separators)
  const isoLike = detectIsoLikeDateTimes(filename, { debug, epochRange });
  for (const comp of isoLike) {
    results.push(comp);
    processedRanges.push({ start: comp.start, end: comp.end });
  }

  const monthNames = detectMonthNameDates(filename, { debug });
  for (const comp of monthNames) {
    results.push(comp);
    processedRanges.push({ start: comp.start, end: comp.end });
  }

  // Then, detect French time format (HHhMMmSSs) which has letter separators
  // This must be done before other analysis since it uses letters not digits
  const frenchTimes = detectFrenchTime(filename);
  for (const timeComp of frenchTimes) {
    results.push(timeComp);
    processedRanges.push({ start: timeComp.start, end: timeComp.end });
  }

  // Try separated formats first (multiple sequences with separators)
  // These are more reliable than single compact sequences
  const separated = analyzeSeparatedComponents(
    sequences,
    filename,
    { dateFormat: effectiveDateFormat, localePreference, debug }
  );
  for (const comp of separated) {
    results.push(comp);
    processedRanges.push({ start: comp.start, end: comp.end });
  }

  // Then try compact formats (single sequences) for unprocessed sequences
  for (const seq of sequences) {
    if (isProcessed(seq) || isInBlacklistedRange(blacklistRanges, seq)) continue;

    // 14 digits: YYYYMMDDHHMMSS
    const compact14 = tryCompactDateTime(seq);
    if (compact14) {
      results.push(compact14);
      processedRanges.push({ start: seq.start, end: seq.end });
      continue;
    }

    // 10/13/16 digits: Unix timestamp (s/ms/µs)
    const unix = tryUnixTimestamp(seq, epochRange);
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
 * Calculate confidence score for a detected timestamp
 * @param {Object} timestamp - Detected timestamp object
 * @param {string} filename - Original filename
 * @returns {number} - Confidence score (0.0 - 1.0)
 */
function calculateConfidence(timestamp, filename) {
  if (!timestamp) return 0;

  let confidence = CONFIDENCE.BASE; // Base confidence

  // Factor 1: Pattern specificity (40% weight)
  const specificityScores = {
    // High confidence: Camera/app-specific formats
    'CAMERA_IMG': CONFIDENCE.VERY_HIGH,
    'CAMERA_VID': CONFIDENCE.VERY_HIGH,
    'CAMERA_PXL': CONFIDENCE.VERY_HIGH,
    'CAMERA_REC': CONFIDENCE.VERY_HIGH,
    'WHATSAPP': 0.90,
    'SCREENSHOT': 0.90,
    'ISO_DATETIME': 0.90,

    // Medium-high: Clear structured formats
    'ISO_DATE': CONFIDENCE.HIGH,
    'EUROPEAN_DATE': 0.75,
    'US_DATE': 0.75,
    'FRENCH_TIME': 0.80,
    'COMPACT_DATETIME': CONFIDENCE.MEDIUM_HIGH,
    'UNIX_TIMESTAMP': CONFIDENCE.HIGH,
    'UNIX_MILLISECONDS': CONFIDENCE.HIGH,
    'UNIX_MICROSECONDS': CONFIDENCE.HIGH,

    // Medium: Less specific
    'COMPACT_EUROPEAN': 0.65,
    'COMPACT_US': 0.65,
    'COMPACT_AMBIGUOUS': CONFIDENCE.MEDIUM, // Ambiguous by definition

    // Lower: Generic patterns
    'SEPARATED_DATETIME': 0.60,
    'YEAR_MONTH': CONFIDENCE.MEDIUM,
    'YEAR_ONLY': 0.40,
    'MERGED_DATETIME': CONFIDENCE.MEDIUM_HIGH,
  };

  const specificityScore = specificityScores[timestamp.type] || CONFIDENCE.MEDIUM;
  confidence = specificityScore;

  // Factor 2: Precision bonus (up to +0.15)
  const precisionBonus = {
    'millisecond': 0.15,
    'second': CONFIDENCE.BOOST_PRECISION,
    'minute': 0.05,
    'day': 0.02,
    'month': 0.01,
    'year': 0.0
  };
  confidence += precisionBonus[timestamp.precision] || 0;

  // Factor 3: Position in filename (early = more likely intentional) (up to +0.10)
  const filenameLength = filename.length;
  const relativePosition = timestamp.start / filenameLength;
  if (relativePosition < 0.3) {
    confidence += CONFIDENCE.BOOST_EARLY; // Early in filename
  } else if (relativePosition < 0.5) {
    confidence += CONFIDENCE.BOOST_MIDDLE; // Middle
  }

  // Factor 4: Validation success (components are valid) (+0.05)
  const hasValidComponents =
    timestamp.year >= 1970 && timestamp.year <= 2100 &&
    (!timestamp.month || (timestamp.month >= 1 && timestamp.month <= 12)) &&
    (!timestamp.day || (timestamp.day >= 1 && timestamp.day <= 31)) &&
    (!timestamp.hour || (timestamp.hour >= 0 && timestamp.hour < 24)) &&
    (!timestamp.minute || (timestamp.minute >= 0 && timestamp.minute < 60)) &&
    (!timestamp.second || (timestamp.second >= 0 && timestamp.second < 60));

  if (hasValidComponents) {
    confidence += CONFIDENCE.BOOST_CONTEXT;
  }

  // Factor 5: Timezone awareness (+0.05)
  if (timestamp.timezone || typeof timestamp.utcOffsetMinutes === 'number') {
    confidence += 0.05;
  }

  // Factor 6: Ambiguity preference hints (+0.05 max)
  if (timestamp.preferenceBoost) {
    confidence += timestamp.preferenceBoost;
  }

  // Factor 7: Context markers (keywords that suggest timestamps) (+0.10)
  const contextMarkers = [
    /\bIMG_/i, /\bVID_/i, /\bPXL_/i, /\bREC_/i,
    /\bScreenshot/i, /\bWhatsApp/i, /\bSignal/i,
    /\bphoto/i, /\bvideo/i, /\brecording/i,
    /\bbackup/i, /\bexport/i, /\barchive/i
  ];

  const hasContextMarker = contextMarkers.some(marker => marker.test(filename));
  if (hasContextMarker) {
    confidence += CONFIDENCE.BOOST_PRECISION;
  }

  // Factor 8: Penalty for ambiguity (-0.20)
  if (timestamp.ambiguous) {
    confidence -= CONFIDENCE.PENALTY_AMBIGUOUS;
  }

  // Factor 9: Penalty for blacklist-like patterns nearby (-0.10)
  const blacklistPenaltyMatchers = [
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    /\bv?\d+\.\d+\.\d+(?:\.\d+)?\b/,
    /\b\d{3,4}p\b/i,
    /\bframe\d{3,}\b/i,
  ];
  if (blacklistPenaltyMatchers.some((rx) => rx.test(filename))) {
    confidence -= 0.1;
  }

  // Factor 10: Bonus for separator coherence (+0.02)
  if (timestamp.separator && filename.split(timestamp.separator).length > 2) {
    confidence += 0.02;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Get the best (most precise) timestamp from filename
 */
export function getBestTimestamp(filename, options = {}) {
  const {
    dateFormat = 'dmy',
    debug = false,
    epochRange = DEFAULT_EPOCH_YEAR_RANGE,
    contextYear = null,
  } = options;
  const timestamps = detectTimestampHeuristic(filename, { dateFormat, debug, epochRange });

  if (timestamps.length === 0) {
    return null;
  }

  // Special case 1: merge DATE + TIME when separated (e.g., "2025-10-08 00.00.00 - 10.03.23")
  // Look for pattern: full date with time (precision=second) followed by another time component
  const fullDateTime = timestamps.find(ts => ts.year && ts.month && ts.day && ts.precision === 'second');
  const timeOnly = timestamps.find(ts => !ts.year && ts.hour !== undefined && ts.precision === 'second');

  if (fullDateTime && timeOnly && timeOnly.start > fullDateTime.end) {
    // Merge: use date from first, time from second
    const merged = {
      ...fullDateTime,
      hour: timeOnly.hour,
      minute: timeOnly.minute,
      second: timeOnly.second,
      start: fullDateTime.start,
      end: timeOnly.end,
      type: 'MERGED_DATETIME',
      timezone: fullDateTime.timezone || timeOnly.timezone,
      utcOffsetMinutes: fullDateTime.utcOffsetMinutes ?? timeOnly.utcOffsetMinutes,
    };
    // Add confidence score
    merged.confidence = calculateConfidence(merged, filename);
    return merged;
  }

  // Special case 2: Extract seconds from 6-digit HHMMSS pattern when HH:MM matches existing timestamp
  // Example: "2022-05-17-11:02 - NADEGE_110214.jpg" → 110214 provides seconds (14)
  // Find datetime with minute precision
  const dateTimeMinute = timestamps.find(ts => ts.year && ts.month && ts.day && ts.precision === 'minute');
  // Find 6-digit pattern that could be HHMMSS
  const sixDigitPattern = timestamps.find(ts => {
    // Must be 6 digits (COMPACT_YY type or similar)
    if (ts.end - ts.start !== 6) return false;
    // Must come after the datetime
    if (!dateTimeMinute || ts.start <= dateTimeMinute.end) return false;

    // Check if first 4 digits match HH:MM from the datetime
    const patternStr = filename.slice(ts.start, ts.end);
    const hh = parseInt(patternStr.slice(0, 2), 10);
    const mm = parseInt(patternStr.slice(2, 4), 10);
    const ss = parseInt(patternStr.slice(4, 6), 10);

    // Must be valid time components
    if (!validators.hour(hh) || !validators.minute(mm) || !validators.second(ss)) {
      return false;
    }

    // Check if HH:MM matches the datetime's hour:minute
    return hh === dateTimeMinute.hour && mm === dateTimeMinute.minute;
  });

  if (dateTimeMinute && sixDigitPattern) {
    // Extract seconds from the 6-digit pattern
    const patternStr = filename.slice(sixDigitPattern.start, sixDigitPattern.end);
    const seconds = parseInt(patternStr.slice(4, 6), 10);

    // Create merged timestamp with seconds
    const merged = {
      ...dateTimeMinute,
      second: seconds,
      precision: 'second', // Upgrade precision
      end: dateTimeMinute.end, // Keep original end position
      type: 'MERGED_WITH_SECONDS',
      timezone: dateTimeMinute.timezone,
      utcOffsetMinutes: dateTimeMinute.utcOffsetMinutes,
    };
    merged.confidence = calculateConfidence(merged, filename);
    return merged;
  }

  // Precision order: millisecond > second > minute > day > month > year
  const precisionOrder = {
    millisecond: 6,
    second: 5,
    minute: 4,  // Add minute precision
    day: 3,
    month: 2,
    year: 1
  };

  // Build coherence signals (modal year/month, epoch anchor)
  const yearCounts = timestamps.reduce((acc, ts) => {
    if (ts.year) acc[ts.year] = (acc[ts.year] || 0) + 1;
    return acc;
  }, {});
  const modalYear = Object.entries(yearCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const monthCounts = timestamps.reduce((acc, ts) => {
    if (ts.month) acc[ts.month] = (acc[ts.month] || 0) + 1;
    return acc;
  }, {});
  const modalMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const hasEpoch = timestamps.some((ts) => ts.type && ts.type.startsWith('UNIX_'));

  const adjustedConfidence = (ts) => {
    let conf = calculateConfidence(ts, filename);
    const allowPrecisionBoost = ts.precision && ts.precision !== 'year';
    if (allowPrecisionBoost && ts.year && modalYear && Number(ts.year) === Number(modalYear)) conf += 0.05;
    if (allowPrecisionBoost && ts.month && modalMonth && Number(ts.month) === Number(modalMonth)) conf += 0.02;
    if (allowPrecisionBoost && contextYear && ts.year && Math.abs(ts.year - contextYear) <= 1) conf += 0.05;
    if (ts.year && (ts.year < 1980 || ts.year > 2070)) conf -= 0.15;
    if (allowPrecisionBoost && hasEpoch && ts.type && ts.type.startsWith('UNIX_')) conf += 0.02;
    if (dateFormat !== 'auto' && ts.ambiguous) {
      const prefersUS = dateFormat === 'mdy';
      if (prefersUS && ts.type === 'US_DATE') conf += 0.3;
      if (!prefersUS && (ts.type === 'EUROPEAN_DATE' || ts.type === 'EUROPEAN_YY_DATE')) conf += 0.3;
      if (prefersUS && ts.type === 'EUROPEAN_DATE') conf -= 0.5;
      if (!prefersUS && ts.type === 'US_DATE') conf -= 0.5;
    }
    const relPos = Math.min(1, Math.max(0, ts.start / Math.max(1, filename.length)));
    conf -= relPos * 0.05; // positional tie-breaker to keep early > late
    return Math.max(0, Math.min(1, conf));
  };

  timestamps.sort((a, b) => {
    // IMPORTANT: Sort by CONFIDENCE first, then precision
    const confA = adjustedConfidence(a);
    const confB = adjustedConfidence(b);

    if (Math.abs(confA - confB) > 0.2) {
      return confB - confA; // Higher confidence wins
    }

    // Otherwise, use precision
    const precA = precisionOrder[a.precision] || 0;
    const precB = precisionOrder[b.precision] || 0;

    // If same precision, prefer the one with time components (more complete)
    if (precA === precB) {
      const hasTimeA = a.hour !== undefined ? 1 : 0;
      const hasTimeB = b.hour !== undefined ? 1 : 0;
      if (hasTimeA !== hasTimeB) {
        return hasTimeB - hasTimeA;
      }
      // If still equal, prefer the earlier one in the filename (start position)
      return a.start - b.start;
    }

    return precB - precA;
  });

  const best = timestamps[0];

  // Add confidence score to the result
  best.confidence = adjustedConfidence(best);

  // Add alternative timestamps if there are multiple candidates
  if (timestamps.length > 1) {
    best.alternatives = timestamps.slice(1).map(ts => ({
      ...ts,
      confidence: adjustedConfidence(ts)
    }));
  }

  return best;
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

  if (timestamp.precision === 'second' || timestamp.precision === 'millisecond') {
    const hour = String(timestamp.hour || 0).padStart(2, '0');
    const minute = String(timestamp.minute || 0).padStart(2, '0');
    const second = String(timestamp.second || 0).padStart(2, '0');
    result += `T${hour}:${minute}:${second}`;
    if (timestamp.precision === 'millisecond') {
      const ms = String(timestamp.millisecond || 0).padStart(3, '0');
      result += `.${ms}`;
    }

    if (timestamp.timezone) {
      // Normalize UTC to Z for compactness
      const tz = timestamp.timezone === 'UTC' ? 'Z' : timestamp.timezone;
      result += tz;
    }
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

  const { allowTimeOnly = false, defaultDate = null } = options;

  // Handle time-only patterns if allowed
  if (!timestamp.year && allowTimeOnly) {
    // Time-only: use provided default date or current date
    const base = defaultDate instanceof Date ? defaultDate : new Date();
    const year = base.getFullYear();
    const month = base.getMonth();
    const day = base.getDate();
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
