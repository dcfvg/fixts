/* Browser-safe module ✓ */
/**
 * Core ambiguity detection logic (platform-agnostic)
 *
 * This module contains the shared logic for detecting potential ambiguities
 * in date parsing. It works in both Node.js and browser environments.
 *
 * Platform-specific features (like CLI prompts) are in separate modules:
 * - ambiguityDetector.js (Node.js with readline prompts)
 * - ambiguityDetector-browser.js (browser-safe re-export)
 *
 * @module ambiguityDetector-core
 * @browserSafe true
 */

import { getBestTimestamp } from './heuristicDetector.js';

/**
 * Detect potential ambiguities in date parsing
 *
 * This function identifies dates that COULD be interpreted multiple ways,
 * even if the heuristic has already resolved them based on user preferences.
 * Useful for warnings, user prompts, or analysis.
 *
 * @param {string} filename - Filename to analyze
 * @param {Object} options - Detection options
 * @param {string} options.dateFormat - Date format preference: 'dmy' or 'mdy'
 * @returns {Object|null} - Ambiguity info or null if none detected
 */
export function detectAmbiguity(filename, options = {}) {
  const { dateFormat = 'dmy' } = options;

  // First, try heuristic detection for compact formats (truly ambiguous)
  const timestamp = getBestTimestamp(filename, { dateFormat });

  if (timestamp && timestamp.ambiguous && timestamp.type === 'COMPACT_AMBIGUOUS') {
    // Compact format ambiguity (e.g., 05062024)
    const alt1 = timestamp.alternatives[0]; // European
    const alt2 = timestamp.alternatives[1]; // US

    return {
      type: 'day-month-order',
      pattern: filename.substring(timestamp.start, timestamp.end),
      first: timestamp.day,   // Currently interpreted as day (DMY)
      second: timestamp.month, // Currently interpreted as month (DMY)
      filename,
      options: [
        { label: alt1.format, value: 'dmy' },
        { label: alt2.format, value: 'mdy' }
      ],
      heuristicInfo: timestamp
    };
  }

  // For separated formats, check if they WOULD be ambiguous
  // (even though heuristic resolves them via dateFormat option)
  // This is useful for warning users about their data
  const separatedPattern = /(\d{2})[-_/](\d{2})[-_/](\d{4})/;
  const match = filename.match(separatedPattern);

  if (match) {
    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);

    // Both could be valid days/months (1-12)
    if (first >= 1 && first <= 12 && second >= 1 && second <= 12) {
      return {
        type: 'day-month-order',
        pattern: match[0],
        first,
        second,
        filename,
        options: [
          { label: 'DD-MM-YYYY (European)', value: 'dmy' },
          { label: 'MM-DD-YYYY (US)', value: 'mdy' }
        ],
        note: 'Resolved by dateFormat option, but flagged for awareness'
      };
    }
  }

  return null;
}
