/**
 * Global constants for the fixts utility
 */

/**
 * Date and time limits
 */
export const DATE_LIMITS = {
  MIN_YEAR: 1970,
  MAX_YEAR: 2100,
  TWO_DIGIT_YEAR_THRESHOLD: 70, // Years < 70 are 20xx, >= 70 are 19xx
  HOURS_PER_DAY: 24,
  MINUTES_PER_HOUR: 60,
  SECONDS_PER_MINUTE: 60,
  MILLISECONDS_PER_SECOND: 1000,
  MIN_MONTH: 1,
  MAX_MONTH: 12,
  MIN_DAY: 1,
  MAX_DAY: 31
};

/**
 * File system limits
 */
export const FILE_LIMITS = {
  MAX_FILENAME_LENGTH: 255,
  MAX_PATH_LENGTH: 4096
};

/**
 * Default date format templates
 */
export const DATE_TEMPLATES = {
  ISO: 'YYYY-MM-DD',
  US: 'MM/DD/YYYY',
  EU: 'DD/MM/YYYY',
  COMPACT: 'YYYYMMDD'
};

/**
 * File extension configuration
 */
export const FILE_EXTENSIONS = {
  // Matches single or compound extensions (e.g., .txt, .tar.gz, .backup.zip, .m4a, .mp4)
  // Must contain at least one letter, 2-5 characters per segment
  // Pattern explanation: Each segment must have at least one letter [a-zA-Z]
  // but can contain digits anywhere, e.g., .m4a, .mp3, .h264
  PATTERN: /((?:\.[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]*)+)$/,
  MIN_LENGTH: 2,
  MAX_LENGTH: 5
};

/**
 * Performance optimization settings
 */
export const PERFORMANCE = {
  REGEX_CACHE_SIZE: 100,
  MAX_FILE_SCAN_DEPTH: 10
};

/**
 * Default options
 */
export const DEFAULTS = {
  DATE_FORMAT: 'YYYY-MM-DD - {name}',
  DRY_RUN: true,
  COPY_MODE: false,
  DATE_ORDER: 'dmy' // 'dmy' or 'mdy'
};
