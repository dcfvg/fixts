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

/**
 * Detection methods
 */
export const DETECTION_METHOD = {
  HEURISTIC: 'heuristic',
  AUTO: 'auto', // Same as heuristic (for compatibility)
};

/**
 * Parse timestamp from filename using specified method
 *
 * @param {string} filename - Filename to parse
 * @param {Object} options - Parsing options
 * @param {string} options.method - Detection method: 'heuristic' or 'auto' (default)
 * @param {string} options.dateFormat - Date format for ambiguous dates: 'dmy' or 'mdy' (default: 'dmy')
 * @returns {Date|null} - Parsed date or null if no timestamp found
 */
export function parseTimestamp(filename, options = {}) {
  const { dateFormat = 'dmy' } = options;

  if (!filename || typeof filename !== 'string') {
    return null;
  }

  return parseWithHeuristic(filename, { dateFormat });
}

/**
 * Parse using heuristic detection
 * @private
 */
function parseWithHeuristic(filename, options = {}) {
  const { dateFormat = 'dmy' } = options;
  const timestamp = getBestTimestamp(filename, { dateFormat });
  return timestampToDate(timestamp);
}

/**
 * Get detailed detection info (for debugging/analysis)
 *
 * @param {string} filename - Filename to analyze
 * @returns {Object} - Detection details
 */
export function getDetectionInfo(filename) {
  const heuristicTimestamp = getBestTimestamp(filename);
  const heuristicDate = timestampToDate(heuristicTimestamp);

  return {
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
