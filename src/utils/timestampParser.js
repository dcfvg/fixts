/**
 * Unified timestamp parser - uses heuristic detection
 * Use this module for all filename-based timestamp parsing
 *
 * For file metadata (EXIF, audio tags), use fileMetadataParser.js instead
 */

import {
  getBestTimestamp,
  timestampToDate,
} from './heuristicDetector.js';

import { applyCustomPatterns } from './customPatternManager.js';

/**
 * Parse timestamp from filename using heuristic detection
 *
 * @param {string} filename - Filename to parse
 * @param {Object} options - Parsing options
 * @param {string} options.dateFormat - Date format for ambiguous dates: 'dmy' or 'mdy' (default: 'dmy')
 * @param {boolean} options.allowTimeOnly - Allow time-only formats (uses current date) (default: false)
 * @param {boolean} options.customOnly - Only use custom patterns, skip heuristic (default: false)
 * @returns {Date|null} - Parsed date or null if no timestamp found
 */
export function parseTimestamp(filename, options = {}) {
  const { dateFormat = 'dmy', allowTimeOnly = false, customOnly = false } = options;

  if (!filename || typeof filename !== 'string') {
    return null;
  }

  // Try custom patterns first (if any are registered)
  const customResult = applyCustomPatterns(filename);
  if (customResult) {
    return timestampToDate(customResult, { allowTimeOnly });
  }

  // If customOnly is true, don't fallback to heuristic
  if (customOnly) {
    return null;
  }

  // Fallback to heuristic detection
  return parseWithHeuristic(filename, { dateFormat, allowTimeOnly });
}

/**
 * Parse using heuristic detection
 * @private
 */
function parseWithHeuristic(filename, options = {}) {
  const { dateFormat = 'dmy', allowTimeOnly = false } = options;
  const timestamp = getBestTimestamp(filename, { dateFormat });
  return timestampToDate(timestamp, { allowTimeOnly });
}

/**
 * Get detailed detection info (for debugging/analysis)
 *
 * @param {string} filename - Filename to analyze
 * @returns {Object} - Detection details
 */
export function getDetectionInfo(filename) {
  const customTimestamp = applyCustomPatterns(filename);
  const customDate = customTimestamp ? timestampToDate(customTimestamp) : null;

  const heuristicTimestamp = getBestTimestamp(filename);
  const heuristicDate = timestampToDate(heuristicTimestamp);

  return {
    custom: {
      detected: !!customTimestamp,
      timestamp: customTimestamp,
      date: customDate,
      pattern: customTimestamp?.customPattern,
      type: customTimestamp?.type,
      precision: customTimestamp?.precision,
    },
    heuristic: {
      detected: !!heuristicTimestamp,
      timestamp: heuristicTimestamp,
      date: heuristicDate,
      type: heuristicTimestamp?.type,
      precision: heuristicTimestamp?.precision,
    },
  };
}

/**
 * Parse timestamp from filename (main API)
 *
 * Examples:
 * parseTimestampFromFilename('photo-2024-11-02.jpg')  // Date object
 * parseTimestampFromFilename('IMG_20241102_143025.jpg') // Date object with time
 */
export function parseTimestampFromFilename(filename, options = {}) {
  return parseTimestamp(filename, options);
}

/**
 * Alias for parseTimestampFromFilename
 * Provided for consistency with old timestampUtils.js API
 */
export function parseTimestampFromName(filename, options = {}) {
  return parseTimestamp(filename, options);
}
