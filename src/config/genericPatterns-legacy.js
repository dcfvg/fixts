/**
 * Generic Timestamp Pattern Definitions
 *
 * Philosophy:
 * - Patterns are GENERIC, not application-specific
 * - Focus on FORMAT structure, not origin (IMG_ vs PXL_ vs DSC_ are all PREFIX_COMPACT)
 * - Ordered by specificity (most specific first to avoid premature matching)
 * - Each pattern has detection regex and metadata (precision, icons, etc.)
 */

import {
  isValidYear,
  isValidMonth,
  isValidDay,
  isValidHours,
  isValidMinutes,
  isValidSeconds,
  normalizeYear
} from '../utils/dateValidators.js';

/**
 * Pattern categories based on structure, not source
 */
export const PATTERN_CATEGORIES = {
  // Formats with TIME component (precise)
  DATETIME_ISO: 'DATETIME_ISO',                    // YYYY-MM-DD HH.MM.SS (most standard)
  DATETIME_ISO_T: 'DATETIME_ISO_T',                // YYYY-MM-DDTHH.MM.SS (strict ISO)
  DATETIME_COMPACT: 'DATETIME_COMPACT',            // YYYYMMDD_HHMMSS or YYYYMMDDHHMMSS
  DATETIME_AT: 'DATETIME_AT',                      // YYYY-MM-DD at/à HH.MM.SS (messaging exports)
  DATETIME_PREFIX_COMPACT: 'DATETIME_PREFIX_COMPACT',  // IMG_YYYYMMDD_HHMMSS, VID_..., REC_..., etc.
  DATETIME_KEYWORD: 'DATETIME_KEYWORD',            // Screenshot_YYYY-MM-DD-HH-MM-SS, Capture_..., etc.
  DATETIME_EUROPEAN: 'DATETIME_EUROPEAN',          // DD-MM-YYYY HH.MM.SS or DD.MM.YYYY HH.MM.SS
  DATETIME_WITH_MS: 'DATETIME_WITH_MS',            // YYYY-MM-DD HH.MM.SS.mmm (with milliseconds)

  // Formats with DATE only (day precision)
  DATE_ISO: 'DATE_ISO',                            // YYYY-MM-DD (standard)
  DATE_COMPACT: 'DATE_COMPACT',                    // YYYYMMDD
  DATE_EUROPEAN_DASH: 'DATE_EUROPEAN_DASH',        // DD-MM-YYYY
  DATE_EUROPEAN_DOT: 'DATE_EUROPEAN_DOT',          // DD.MM.YYYY
  DATE_AMBIGUOUS: 'DATE_AMBIGUOUS',                // DD-MM-YYYY where DD ≤ 12 (could be MM-DD)

  // Partial dates (lower precision)
  DATE_YEAR_MONTH: 'DATE_YEAR_MONTH',              // YYYY-MM
  DATE_YEAR_ONLY: 'DATE_YEAR_ONLY',                // YYYY

  // Special formats
  UNIX_TIMESTAMP: 'UNIX_TIMESTAMP',                // 1699027825 (10 digits)

  // No timestamp
  NO_TIMESTAMP: 'NO_TIMESTAMP',                    // Files without any timestamp
};

/**
 * Generic pattern definitions
 * Order matters: more specific patterns first
 */
export const TIMESTAMP_PATTERNS = [
  // ========================================
  // HIGH PRECISION: DateTime with milliseconds
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_WITH_MS,
    name: 'DateTime with milliseconds',
    description: 'YYYY-MM-DD HH.MM.SS.mmm',
    regex: /(\d{4})[-_](\d{2})[-_](\d{2})[ T_-](\d{2})[.\-_:](\d{2})[.\-_:](\d{2})[.,](\d{1,3})/,
    hasTime: true,
    hasDate: true,
    precision: 'millisecond',
    icon: '🕐',
    priority: 1,
  },

  // ========================================
  // DATETIME: "at" separator (messaging apps)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_AT,
    name: 'DateTime with "at" separator',
    description: 'YYYY-MM-DD at HH.MM.SS',
    regex: /(\d{4})[-_](\d{2})[-_](\d{2})\s+(?:at|à)\s+(\d{2})[.](\d{2})[.](\d{2})/i,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 2,
    // Cleaning metadata
    cleaningRegex: /\s*\d{4}[-_/]\d{2}[-_/]\d{2}\s+(?:at|à)\s+\d{2}[.]\d{2}[.]\d{2}/gi,
    keepPrefix: false,
  },

  // ========================================
  // DATETIME: Prefix + Compact (cameras, phones, recorders)
  // Generic: matches IMG_, VID_, REC_, PXL_, DSC_, etc.
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_PREFIX_COMPACT,
    name: 'Prefixed compact datetime',
    description: 'PREFIX_YYYYMMDD_HHMMSS',
    regex: /\b[A-Z]{2,6}[-_](\d{4})(\d{2})(\d{2})[-_](\d{2})(\d{2})(\d{2})/i,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 3,
    examples: ['IMG_20241102_143025.jpg', 'VID_20241102_143025.mp4', 'REC_20241102_143025.m4a', 'PXL_20241102_143025.jpg'],
    // Cleaning metadata
    cleaningRegex: /([A-Z]{2,6})[_-]?(\d{8})[_-](\d{6})/gi,
    keepPrefix: true,
  },

  // ========================================
  // DATETIME: Uppercase prefix with compact date and HHMM
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_PREFIX_COMPACT,
    name: 'Uppercase prefix with HHMM',
    description: 'PREFIX_YYYYMMDD_HHMM',
    regex: /\b[A-Z]{2,10}[-_](\d{4})(\d{2})(\d{2})[-_](\d{4})\b/i,
    hasTime: true,
    hasDate: true,
    precision: 'minute',
    icon: '🕐',
    priority: 2, // Higher priority than HHMMSS pattern
    examples: ['FINAL_20241102_1430.pdf', 'DRAFT_20241102_1430.docx'],
  },

  // ========================================
  // DATETIME: Lowercase prefix compact (lowercase prefix with date/time)
  // Generic: matches cam_, sync_, capture_, etc.
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_PREFIX_COMPACT,
    name: 'Lowercase prefix compact datetime',
    description: 'prefix_YYYYMMDD_HHMMSS',
    regex: /\b[a-z]{2,10}[-_](\d{4})(\d{2})(\d{2})[-_](\d{2})(\d{2})(\d{2})/,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 3,
    examples: ['cam_20241102_1430.jpg', 'sync_20241102_143025.db', 'capture_20241102_143025.png'],
  },

  {
    category: PATTERN_CATEGORIES.DATETIME_PREFIX_COMPACT,
    name: 'Lowercase prefix compact date-time (HHMM)',
    description: 'prefix_YYYYMMDD_HHMM',
    regex: /\b[a-z]{2,10}[-_](\d{4})(\d{2})(\d{2})[-_](\d{4})\b/,
    hasTime: true,
    hasDate: true,
    precision: 'minute',
    icon: '🕐',
    priority: 3,
    examples: ['cam_20241102_1430.jpg', 'sync_20241102_1430.db', 'note_20241102_1430.txt'],
  },

  // ========================================
  // DATE: Prefix with compact date only (no time)
  // Generic: matches backup_, log_, ARCHIVE_, DRAFT_, v1_, etc.
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATE_COMPACT,
    name: 'Prefix with compact date',
    description: 'prefix_YYYYMMDD or PREFIX_YYYYMMDD',
    regex: /\b[a-z0-9]{1,10}[-_](\d{4})(\d{2})(\d{2})(?:[^0-9]|$)/i,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 8,
    examples: ['backup_20241102 archive.tar', 'log_20241102 suffix.log', 'DRAFT_20241102 wip.docx', 'v1_20241102 version.txt'],
  },

  {
    category: PATTERN_CATEGORIES.DATE_COMPACT,
    name: 'Suffix with compact date',
    description: '_YYYYMMDD suffix',
    regex: /(?:^|[^0-9])[-_](\d{4})(\d{2})(\d{2})(?:[^0-9]|$)/,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 9,
    examples: ['document_20241102 final.pdf', 'report_20241102.xlsx', 'data_20241102 set.csv'],
  },

  // ========================================
  // DATETIME: Compact YYYYMMDD_HHMM (date and time without seconds)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_COMPACT,
    name: 'Compact date-time HHMM',
    description: 'YYYYMMDD_HHMM',
    regex: /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})[-_](\d{4})(?:[^0-9]|$)/,
    hasTime: true,
    hasDate: true,
    precision: 'minute',
    icon: '🕐',
    priority: 7,
    examples: ['20241102_1430 file.txt', 'data_20241102_1430.csv'],
  },

  // ========================================
  // DATETIME: Suffix/prefix with compact datetime (YYYYMMDDHHMMSS)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_COMPACT,
    name: 'Suffix/prefix with compact datetime',
    description: '_YYYYMMDDHHMMSS or prefix_YYYYMMDDHHMMSS',
    regex: /(?:^|[^0-9])[-_](\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 7,
    examples: ['archive_20241102143025.zip', 'output_20241102143025.txt', 'v2_20241102_143025.txt'],
  },

  // ========================================
  // DATETIME: Keyword-based (screenshots, captures, recordings)
  // Generic: matches Screenshot_, Capture_, Recording_, etc.
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_KEYWORD,
    name: 'Keyword-based datetime',
    description: 'Keyword_YYYY-MM-DD-HH-MM-SS',
    regex: /\b[A-Z][a-z]+[-_](\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})/i,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 4,
    examples: ['Screenshot_2024-11-02-14-30-25.png', 'Capture_2024-11-02-14-30-25.png', 'Recording_2024-11-02-14-30-25.m4a'],
    // Cleaning metadata
    cleaningRegex: /([A-Z][a-z]+)[-_](\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})/gi,
    keepPrefix: true,
  },

  // ========================================
  // DATETIME: ISO with T separator (strict ISO 8601)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_ISO_T,
    name: 'ISO DateTime with T',
    description: 'YYYY-MM-DDTHH.MM.SS',
    regex: /(\d{4})[-_](\d{2})[-_](\d{2})T(\d{2})[.\-_:](\d{2})[.\-_:](\d{2})/,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 5,
  },

  // ========================================
  // DATETIME: Compact ISO with T and Z (UTC)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_ISO_T,
    name: 'Compact ISO with T and Z',
    description: 'YYYYMMDDThhmmssZ',
    regex: /\b(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?\b/,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 6,
  },

  // ========================================
  // DATETIME: ISO standard (most common)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_ISO,
    name: 'ISO DateTime',
    description: 'YYYY-MM-DD HH.MM.SS',
    regex: /^(\d{4})[-_](\d{2})[-_](\d{2})[ _-](\d{2})[.\-_:](\d{2})[.\-_:](\d{2})/,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 6,
  },

  // ========================================
  // DATETIME: ISO with compact time (signal format)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_ISO,
    name: 'ISO DateTime compact time',
    description: 'YYYY-MM-DD-HHMMSS',
    regex: /(\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{6})/,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 7,
  },

  // ========================================
  // DATETIME: Compact (no separators)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_COMPACT,
    name: 'Compact datetime',
    description: 'YYYYMMDD_HHMMSS',
    regex: /\b(\d{4})(\d{2})(\d{2})[-_]?(\d{2})(\d{2})(\d{2})\b/,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 7,
  },

  // ========================================
  // DATETIME: European formats
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_EUROPEAN,
    name: 'European datetime',
    description: 'DD-MM-YYYY HH.MM.SS',
    regex: /(\d{2})[-.](\d{2})[-.](\d{4})[ _-](\d{2})[.\-_:](\d{2})[.\-_:](\d{2})/,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 8,
  },

  // ========================================
  // DATETIME: European with comma separator (no seconds)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_EUROPEAN,
    name: 'European datetime with comma',
    description: 'DD-MM-YYYY,HH-MM',
    regex: /(\d{2})[-_](\d{2})[-_](\d{4})[,](\d{2})[-_](\d{2})/,
    hasTime: true,
    hasDate: true,
    precision: 'minute',
    icon: '🕐',
    priority: 9,
  },

  // ========================================
  // DATE ONLY: ISO (most standard)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATE_ISO,
    name: 'ISO Date',
    description: 'YYYY-MM-DD',
    regex: /^(\d{4})[-_](\d{2})[-_](\d{2})(?:\s|$|[^0-9])/,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 10,
  },

  // ========================================
  // DATE ONLY: ISO with dots
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATE_ISO,
    name: 'ISO Date with dots',
    description: 'YYYY.MM.DD',
    regex: /\b(\d{4})\.(\d{2})\.(\d{2})\b/,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 11,
  },

  // ========================================
  // DATE ONLY: Compact
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATE_COMPACT,
    name: 'Compact date',
    description: 'YYYYMMDD',
    regex: /\b(\d{4})(\d{2})(\d{2})\b/,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 12,
  },

  // ========================================
  // DATE ONLY: European with dots
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATE_EUROPEAN_DOT,
    name: 'European date with dots',
    description: 'DD.MM.YYYY',
    regex: /\b(\d{2})\.(\d{2})\.(\d{4})\b/,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 11,
  },

  // ========================================
  // DATE ONLY: European with dashes (check ambiguity separately)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATE_EUROPEAN_DASH,
    name: 'European date with dashes',
    description: 'DD-MM-YYYY',
    regex: /\b(\d{2})[-_](\d{2})[-_](\d{4})\b/,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 12,
    needsAmbiguityCheck: true, // Check if DD ≤ 12
  },

  // ========================================
  // DATE: 2-digit year formats (low priority to avoid false positives)
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATE_ISO,
    name: '2-digit year ISO',
    description: 'YY-MM-DD or YY_MM_DD',
    regex: /(?:^|[^0-9])(\d{2})[-_](\d{2})[-_](\d{2})(?:[^0-9]|$)/,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 14,
    twoDigitYear: true,  // Flag for special year handling
  },

  {
    category: PATTERN_CATEGORIES.DATE_ISO,
    name: '2-digit year with dots',
    description: 'YY.MM.DD',
    regex: /(?:^|[^0-9])(\d{2})\.(\d{2})\.(\d{2})(?:[^0-9]|$)/,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 14,
    twoDigitYear: true,
  },

  {
    category: PATTERN_CATEGORIES.DATE_COMPACT,
    name: '2-digit year compact',
    description: 'YYMMDD',
    regex: /(?:^|[^0-9])(\d{6})(?:[^0-9]|$)/,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 14,
    twoDigitYear: true,
  },

  {
    category: PATTERN_CATEGORIES.DATETIME_COMPACT,
    name: '2-digit year compact datetime',
    description: 'YYMMDDHHMMSS',
    regex: /(?:^|[^0-9])(\d{12})(?:[^0-9]|$)/,
    // Don't clean - too aggressive, matches phone numbers
    // Example: +330612345678 (FR format) = 12 digits after +33
    skipCleaning: true,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 14,
    twoDigitYear: true,
  },

  // ========================================
  // DATE: Compact formats with UTC/Z suffix
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_COMPACT,
    name: 'Compact datetime with UTC suffix',
    description: 'YYYYMMDDHHMMSS + UTC/Z',
    regex: /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:UTC|Z)\b/,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 6,
  },

  {
    category: PATTERN_CATEGORIES.DATETIME_COMPACT,
    name: 'Compact date-time HHMM with Z',
    description: 'YYYYMMDDHHMM + Z',
    regex: /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})(\d{4})Z\b/,
    hasTime: true,
    hasDate: true,
    precision: 'minute',
    icon: '🕐',
    priority: 6,
  },

  // ========================================
  // DATE: Compact with underscore separator
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATETIME_COMPACT,
    name: 'Compact datetime with underscore',
    description: 'YYYYMMDDHHMMSS_',
    regex: /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 6,
  },

  {
    category: PATTERN_CATEGORIES.DATE_COMPACT,
    name: 'Compact date with underscore',
    description: 'YYYYMMDD_',
    regex: /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})_(?:[a-z])/i,
    hasTime: false,
    hasDate: true,
    precision: 'day',
    icon: '📅',
    priority: 7,
  },

  // ========================================
  // DATE: Year-Month compact (YYYYMM)
  // Must come before YYMMDD to avoid false matches
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATE_YEAR_MONTH,
    name: 'Year-Month compact',
    description: 'YYYYMM',
    regex: /(?:^|[^0-9])[-_]?((?:19|20)\d{2})([01]\d)(?:[^0-9]|$)/,
    hasTime: false,
    hasDate: true,
    precision: 'month',
    icon: '📅',
    priority: 12,
    isYearMonth: true,
  },

  // ========================================
  // PARTIAL: Year-Month
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATE_YEAR_MONTH,
    name: 'Year-Month',
    description: 'YYYY-MM',
    regex: /^(\d{4})[-_](\d{2})(?:\s|$|[^0-9])/,
    hasTime: false,
    hasDate: true,
    precision: 'month',
    icon: '📅',
    priority: 14,
  },

  // ========================================
  // PARTIAL: Year only
  // ========================================
  {
    category: PATTERN_CATEGORIES.DATE_YEAR_ONLY,
    name: 'Year only',
    description: 'YYYY',
    regex: /^((?:19|20)\d{2})(?:\s|$|[^0-9])/,
    hasTime: false,
    hasDate: true,
    precision: 'year',
    icon: '📅',
    priority: 14,
  },

  // ========================================
  // SPECIAL: Unix timestamp
  // ========================================
  {
    category: PATTERN_CATEGORIES.UNIX_TIMESTAMP,
    name: 'Unix timestamp',
    description: '10-digit Unix timestamp',
    regex: /(?:^|[^0-9])(\d{10})(?:[^0-9]|$)/,
    // Don't clean - too aggressive, matches phone numbers without country code
    // Example: 0612345678 (FR mobile) = 10 digits
    skipCleaning: true,
    hasTime: true,
    hasDate: true,
    precision: 'second',
    icon: '🕐',
    priority: 15,
  },

  {
    category: PATTERN_CATEGORIES.UNIX_TIMESTAMP,
    name: 'Unix timestamp milliseconds',
    description: '13-digit Unix timestamp (ms)',
    regex: /(?:^|[^0-9])(\d{13})(?:[^0-9]|$)/,
    // Don't clean this pattern - same reason as 10-digit timestamps
    skipCleaning: true,
    hasTime: true,
    hasDate: true,
    precision: 'millisecond',
    icon: '🕐',
    priority: 15,
  },

  // ========================================
  // FALLBACK: No timestamp
  // ========================================
  {
    category: PATTERN_CATEGORIES.NO_TIMESTAMP,
    name: 'No timestamp',
    description: 'No timestamp detected',
    regex: null, // No regex, it's the fallback
    hasTime: false,
    hasDate: false,
    precision: null,
    icon: '❓',
    priority: 999,
  },
];

/**
 * Get pattern by category
 */
export function getPatternByCategory(category) {
  return TIMESTAMP_PATTERNS.find(p => p.category === category);
}

/**
 * Get all patterns sorted by priority
 */
export function getPatternsByPriority() {
  return [...TIMESTAMP_PATTERNS].sort((a, b) => a.priority - b.priority);
}

/**
 * Get cleaning patterns for timestamp removal
 * Extracts patterns with cleaning metadata (cleaningRegex, keepPrefix)
 * Falls back to detection regex if no specific cleaning regex provided
 * @returns {Array<{regex: RegExp, keepPrefix: boolean}>}
 */
export function getCleaningPatterns() {
  const cleaningPatterns = [];

  for (const pattern of TIMESTAMP_PATTERNS) {
    // Skip patterns without regex or that are fallbacks
    if (!pattern.regex || pattern.category === PATTERN_CATEGORIES.NO_TIMESTAMP) {
      continue;
    }

    // Skip patterns marked for no cleaning (e.g., Unix timestamps that match phone numbers)
    if (pattern.skipCleaning) {
      continue;
    }

    // Use cleaningRegex if provided, otherwise use detection regex
    const regex = pattern.cleaningRegex || pattern.regex;
    const keepPrefix = pattern.keepPrefix || false;

    cleaningPatterns.push({ regex, keepPrefix });
  }

  return cleaningPatterns;
}

/**
 * Detect which pattern matches a filename
 * @param {string} filename - Filename to analyze
 * @param {Function} ambiguityChecker - Optional function to check ambiguity
 * @returns {Object} Pattern info
 */
export function detectPatternInFilename(filename, ambiguityChecker = null) {
  // Check ambiguity first if checker provided
  if (ambiguityChecker) {
    const ambiguity = ambiguityChecker(filename);
    // If ambiguity detected (returns an object, not null)
    if (ambiguity) {
      return {
        category: PATTERN_CATEGORIES.DATE_AMBIGUOUS,
        name: 'Ambiguous date',
        description: 'DD-MM-YYYY or MM-DD-YYYY (Ambiguous)',
        hasTime: false,
        hasDate: true,
        precision: 'day',
        icon: '⚠️',
        ambiguous: true,
      };
    }
  }

  // Try each pattern in priority order
  const patterns = getPatternsByPriority();
  for (const pattern of patterns) {
    if (!pattern.regex) continue; // Skip NO_TIMESTAMP

    if (pattern.regex.test(filename)) {
      return {
        category: pattern.category,
        name: pattern.name,
        description: pattern.description,
        hasTime: pattern.hasTime,
        hasDate: pattern.hasDate,
        precision: pattern.precision,
        icon: pattern.icon,
        ambiguous: false,
      };
    }
  }

  // Fallback to NO_TIMESTAMP
  const noTimestamp = getPatternByCategory(PATTERN_CATEGORIES.NO_TIMESTAMP);
  return {
    category: noTimestamp.category,
    name: noTimestamp.name,
    description: noTimestamp.description,
    hasTime: noTimestamp.hasTime,
    hasDate: noTimestamp.hasDate,
    precision: noTimestamp.precision,
    icon: noTimestamp.icon,
    ambiguous: false,
  };
}

/**
 * Parse timestamp from filename using generic pattern matching
 * This is an internal implementation that uses the generic pattern system.
 * For general use, prefer parseTimestampFromFilename from timestampParser.js
 * which provides a unified interface with multiple detection methods.
 *
 * @param {string} filename - The filename to parse
 * @param {Object} options - Options for parsing
 * @param {string} options.dateFormat - Date format preference: 'dmy' (DD-MM-YYYY, default) or 'mdy' (MM-DD-YYYY)
 * @returns {Date|null} - Parsed Date object or null
 * @private
 */
export function parseTimestampUsingPatterns(filename, options = {}) {
  const { dateFormat = 'dmy' } = options;

  if (!filename || typeof filename !== 'string') {
    return null;
  }

  // Prepare candidates (with and without extension)
  const basename = filename.split('/').pop() || filename;
  const candidates = [];

  // Only remove file extensions (not dates like .2024)
  // Extensions must be 2-10 chars and NOT be 4 digits (years)
  const rawClean = filename.replace(/\.([a-zA-Z][a-zA-Z0-9]{1,9}|[a-z]{2,10})$/i, '');
  candidates.push(rawClean);

  const baseClean = basename.replace(/\.([a-zA-Z][a-zA-Z0-9]{1,9}|[a-z]{2,10})$/i, '');
  if (baseClean !== rawClean) {
    candidates.push(baseClean);
  }

  // Helper to create date safely
  function tryCreateDate(year, month, day, hours = 0, minutes = 0, seconds = 0, milliseconds = 0) {
    // Normalize 2-digit years
    if (year < 100) {
      year = normalizeYear(year);
    }

    // Validate ranges using centralized validators
    if (!isValidYear(year, { allowTwoDigit: false })) return null;
    if (!isValidMonth(month)) return null;
    if (!isValidDay(day, month, year)) return null;
    if (!isValidHours(hours)) return null;
    if (!isValidMinutes(minutes)) return null;
    if (!isValidSeconds(seconds)) return null;

    const date = new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
    if (Number.isNaN(date.getTime())) return null;

    // Verify date components (catch invalid dates like Feb 31)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  // Try parsing each candidate
  for (const candidate of candidates) {
    // Try each pattern in priority order
    const patterns = getPatternsByPriority();

    for (const pattern of patterns) {
      if (!pattern.regex) continue; // Skip NO_TIMESTAMP

      // Create a parsing-friendly regex (remove ^ anchor to match anywhere)
      const parsingRegex = new RegExp(pattern.regex.source.replace(/^\^/, ''), pattern.regex.flags);
      const match = candidate.match(parsingRegex);
      if (!match) continue;

      // GLOBAL FALSE-POSITIVE FILTER
      // Skip if the match is part of a longer numeric sequence (UUID, ID, Unix timestamp, etc.)
      // This prevents matching "1971" in "621971E1-9E42-..." or "2087" in "43192087"
      const fullMatch = match[0];
      const matchIndex = candidate.indexOf(fullMatch);

      // Check characters before and after the match
      const charBefore = candidate[matchIndex - 1] || '';
      const charAfter = candidate[matchIndex + fullMatch.length] || '';

      // If surrounded by digits or hex (part of longer number/UUID), skip
      if (/\d/.test(charBefore) || (/[0-9A-F]/i.test(charAfter) && charAfter !== charAfter.toLowerCase())) {
        // Part of longer sequence, not a standalone timestamp
        continue;
      }

      // Special handling for Unix timestamps (10 digits or 13 digits)
      if (pattern.category === PATTERN_CATEGORIES.UNIX_TIMESTAMP && match.length === 2) {
        const timestampStr = match[1];
        let timestamp;

        if (timestampStr.length === 13) {
          // Already in milliseconds
          timestamp = Number(timestampStr);
        } else {
          // 10 digits: seconds since epoch
          timestamp = Number(timestampStr) * 1000;
        }

        const date = new Date(timestamp);
        if (
          !Number.isNaN(date.getTime()) &&
          date.getFullYear() >= 1970 &&
          date.getFullYear() <= 2100
        ) {
          return date;
        }
        continue;
      }

      // Extract captures (skip full match at index 0)
      // Keep as strings first to preserve leading zeros
      const rawCaptures = match.slice(1).filter(c => c !== undefined);

      // Filter out non-numeric captures (like prefix text)
      const stringCaptures = rawCaptures.filter(c => !Number.isNaN(Number(c)));
      if (stringCaptures.length === 0) continue;

      // Convert to numbers for later use
      const captures = stringCaptures.map(c => Number(c));

      // Determine components based on pattern category and capture count
      let year, month, day, hours = 0, minutes = 0, seconds = 0, milliseconds = 0;

      // Special case: YYMMDDHHMMSS compact (12 digits in single capture)
      if (stringCaptures.length === 1 && stringCaptures[0].length === 12 && pattern.twoDigitYear) {
        const yymmddhhmmss = stringCaptures[0];
        const yy = Number(yymmddhhmmss.substring(0, 2));
        month = Number(yymmddhhmmss.substring(2, 4));
        day = Number(yymmddhhmmss.substring(4, 6));
        hours = Number(yymmddhhmmss.substring(6, 8));
        minutes = Number(yymmddhhmmss.substring(8, 10));
        seconds = Number(yymmddhhmmss.substring(10, 12));
        // Convert 2-digit year to 4-digit (assume 2000-2099)
        year = yy >= 70 ? 1900 + yy : 2000 + yy;
      }
      // Special case: YYMMDD compact (6 digits in single capture)
      else if (stringCaptures.length === 1 && stringCaptures[0].length === 6 && pattern.twoDigitYear) {
        const yymmdd = stringCaptures[0];

        // ANTI-FALSE-POSITIVE CHECKS for YYMMDD pattern
        // This pattern is very aggressive and matches many non-dates

        // 1. Check if part of UUID (hex characters after digits)
        //    Example: 621971E1-9E42-... → 621971 is NOT a date
        const matchIndex = candidate.indexOf(yymmdd);
        const afterMatch = candidate.substring(matchIndex + 6, matchIndex + 10);

        if (/^[0-9A-F]{2,}[-]/i.test(afterMatch)) {
          // Likely UUID format (hex-hex-hex-...)
          continue;
        }

        // 2. Check if part of longer number (8+ digits)
        //    Example: 1224784167 (Unix timestamp), 43192087 (video ID)
        const beforeMatch = candidate.substring(Math.max(0, matchIndex - 2), matchIndex);
        if (/\d{2}$/.test(beforeMatch) || /^\d{2,}/.test(afterMatch)) {
          // Part of 8+ digit number, likely not a date
          continue;
        }

        const part1 = Number(yymmdd.substring(0, 2));
        const part2 = Number(yymmdd.substring(2, 4));
        const part3 = Number(yymmdd.substring(4, 6));

        // Determine if YYMMDD or DDMMYY
        // If part1 > 31, it's YY at start (YYMMDD)
        // If part1 > 12, it's DD at start (DDMMYY)
        // If part3 > 31, it's YY at end (DDMMYY)
        // If part3 is 20-30, likely recent year (2020-2030) at end (DDMMYY)
        // Otherwise ambiguous - default to YYMMDD

        if (part1 > 31) {
          // YYMMDD format (part1 is definitely year)
          const yy = part1;
          year = yy >= 70 ? 1900 + yy : 2000 + yy;
          month = part2;
          day = part3;
        } else if (part1 > 12) {
          // DDMMYY format (part1 is definitely day > 12)
          day = part1;
          month = part2;
          const yy = part3;
          year = yy >= 70 ? 1900 + yy : 2000 + yy;
        } else if (part3 > 31) {
          // DDMMYY format (part3 is definitely year > 31)
          day = part1;
          month = part2;
          const yy = part3;
          year = yy >= 70 ? 1900 + yy : 2000 + yy;
        } else if (part3 >= 20 && part3 <= 30 && part1 <= 31 && part2 <= 12) {
          // Likely DDMMYY with recent year (2020-2030)
          // Only if part1 and part2 are valid day/month
          day = part1;
          month = part2;
          const yy = part3;
          year = yy >= 70 ? 1900 + yy : 2000 + yy;
        } else {
          // Ambiguous - default to YYMMDD
          const yy = part1;
          year = yy >= 70 ? 1900 + yy : 2000 + yy;
          month = part2;
          day = part3;
        }

        // 3. Validate year is reasonable (2000-2030 for recent files)
        //    Reject obvious false positives like year 2087 or 1971
        if (year < 2000 || year > 2030) {
          // Too old or too futuristic, likely a random ID
          continue;
        }
      }
      // Year only
      else if (captures.length === 1) {
        year = captures[0];
        month = 1;
        day = 1;
      }
      // Year-Month
      else if (captures.length === 2) {
        [year, month] = captures;
        day = 1;

        // Special handling for isYearMonth flag (YYYYMM could be misinterpreted)
        if (pattern.isYearMonth) {
          // Verify this is actually YYYY and MM (not YYYYMMDD without the DD)
          if (isValidYear(year, { allowTwoDigit: false }) && isValidMonth(month)) {
            // Valid year-month
          } else {
            // Invalid, skip this pattern
            continue;
          }
        }
      }
      // Date only (YYYY-MM-DD or DD-MM-YYYY)
      else if (captures.length === 3) {
        const [p1, p2, p3] = captures;

        // Check if this is a 2-digit year pattern
        if (pattern.twoDigitYear) {
          // For 2-digit years: need to determine if DD-MM-YY or YY-MM-DD
          // If first component > 31, it's likely YYMMDD format (e.g., 70-01-15)
          // If third component > 31, it's likely DDMMYY format (e.g., 15-01-70)
          // Otherwise, check if first > 12 (must be day)

          if (p1 > 31) {
            // YY-MM-DD format (p1 is year)
            const yy = p1;
            year = yy >= 70 ? 1900 + yy : 2000 + yy;
            month = p2;
            day = p3;
          } else if (p3 > 31) {
            // DD-MM-YY format (p3 is year)
            day = p1;
            month = p2;
            const yy = p3;
            year = yy >= 70 ? 1900 + yy : 2000 + yy;
          } else if (p1 > 12) {
            // Must be DD-MM-YY (p1 is day > 12)
            day = p1;
            month = p2;
            const yy = p3;
            year = yy >= 70 ? 1900 + yy : 2000 + yy;
          } else if (p2 > 12) {
            // p2 can't be month, so either YY-DD-MM or DD-YY-MM
            // Most likely YY-DD-MM is rare, assume DD-YY-MM is wrong
            // Default to YY-MM-DD
            const yy = p1;
            year = yy >= 70 ? 1900 + yy : 2000 + yy;
            month = p2;
            day = p3;
          } else {
            // Ambiguous: assume YY-MM-DD by default
            const yy = p1;
            year = yy >= 70 ? 1900 + yy : 2000 + yy;
            month = p2;
            day = p3;
          }
        }
        // Determine format based on pattern category
        else if (
          pattern.category === PATTERN_CATEGORIES.DATE_EUROPEAN_DASH ||
          pattern.category === PATTERN_CATEGORIES.DATE_EUROPEAN_DOT ||
          pattern.category === PATTERN_CATEGORIES.DATETIME_EUROPEAN
        ) {
          // DD-MM-YYYY format
          if (p1 > 12) {
            day = p1;
            month = p2;
          } else if (p2 > 12) {
            month = p1;
            day = p2;
          } else {
            // Ambiguous - use dateFormat option
            if (dateFormat === 'mdy') {
              month = p1;
              day = p2;
            } else {
              day = p1;
              month = p2;
            }
          }
          year = p3;
        } else {
          // YYYY-MM-DD format (default)
          year = p1;
          month = p2;
          day = p3;
        }
      }
      // Date + compact time (YYYY-MM-DD-HHMMSS: 4 captures where last is 6 digits)
      // Or date + compact time HHMM (4 captures where last is 4 digits)
      else if (captures.length === 4 && captures[3] >= 100) {
        const [p1, p2, p3, compactTime] = captures;
        year = p1;
        month = p2;
        day = p3;

        if (compactTime >= 100000) {
          // HHMMSS format (6 digits)
          const timeStr = compactTime.toString().padStart(6, '0');
          hours = Number(timeStr.substring(0, 2));
          minutes = Number(timeStr.substring(2, 4));
          seconds = Number(timeStr.substring(4, 6));
        } else {
          // HHMM format (4 digits)
          const timeStr = compactTime.toString().padStart(4, '0');
          hours = Number(timeStr.substring(0, 2));
          minutes = Number(timeStr.substring(2, 4));
        }
      }
      // Date + time without seconds (5 components)
      else if (captures.length === 5) {
        const [p1, p2, p3, p4, p5] = captures;

        // Determine date format
        if (
          pattern.category === PATTERN_CATEGORIES.DATETIME_EUROPEAN
        ) {
          day = p1;
          month = p2;
          year = p3;
        } else {
          year = p1;
          month = p2;
          day = p3;
        }

        hours = p4;
        minutes = p5;
      }
      // Full datetime (6 or 7 components)
      else if (captures.length >= 6) {
        const [p1, p2, p3, p4, p5, p6, p7] = captures;

        // Determine date format
        if (
          pattern.category === PATTERN_CATEGORIES.DATETIME_EUROPEAN
        ) {
          day = p1;
          month = p2;
          year = p3;
        } else {
          year = p1;
          month = p2;
          day = p3;
        }

        hours = p4;
        minutes = p5;
        seconds = p6;
        if (p7 !== undefined) milliseconds = p7;
      }

      // Try to create date
      const result = tryCreateDate(year, month, day, hours, minutes, seconds, milliseconds);
      if (result) return result;
    }
  }

  return null;
}
