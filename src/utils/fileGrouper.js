/**
 * Group files by timestamp patterns and metadata sources
 * This helps provide a clear overview when processing mixed directories
 */

import { detectAmbiguity } from './ambiguityDetector.js';
import { getBestTimestamp } from './heuristicDetector.js';

/**
 * Detect the pattern type of a filename
 * @param {string} filename - Filename to analyze
 * @returns {Object} - { pattern, description, hasTime, hasDate, precision, icon, ambiguous }
 */
export function detectPattern(filename) {
  const timestamp = getBestTimestamp(filename);
  const ambiguity = detectAmbiguity(filename);

  if (!timestamp) {
    return {
      pattern: 'NO_TIMESTAMP',
      description: 'No timestamp detected',
      hasTime: false,
      hasDate: false,
      precision: null,
      icon: '❓',
      ambiguous: false,
    };
  }

  return {
    pattern: timestamp.type || 'UNKNOWN',
    description: timestamp.type || 'Unknown',
    hasTime: timestamp.hour !== undefined,
    hasDate: timestamp.day !== undefined,
    precision: timestamp.precision,
    icon: timestamp.precision === 'day' ? '📅' : '🕐',
    ambiguous: ambiguity !== null,
  };
}

/**
 * Group files by their patterns
 * @param {Array<Object>} files - Array of file objects with { path, name }
 * @returns {Map} - Map of pattern -> array of files
 */
export function groupByPattern(files) {
  const groups = new Map();

  files.forEach((file) => {
    const pattern = detectPattern(file.name);
    const key = pattern.pattern;

    if (!groups.has(key)) {
      groups.set(key, {
        pattern: pattern.pattern,
        description: pattern.description,
        hasTime: pattern.hasTime,
        hasDate: pattern.hasDate,
        precision: pattern.precision,
        icon: pattern.icon,
        ambiguous: pattern.ambiguous || false,
        files: [],
      });
    }

    groups.get(key).files.push(file);
  });

  return groups;
}

/**
 * Create a summary of all patterns found
 * @param {Map} groups - Map from groupByPattern
 * @returns {Object} - Summary statistics
 */
export function createSummary(groups) {
  const summary = {
    totalFiles: 0,
    patterns: [],
    hasAmbiguous: false,
    needsMetadata: false,
  };

  groups.forEach((group, key) => {
    summary.totalFiles += group.files.length;

    summary.patterns.push({
      pattern: key,
      description: group.description,
      count: group.files.length,
      hasTime: group.hasTime,
      precision: group.precision,
      icon: group.icon,
      ambiguous: group.ambiguous,
    });

    if (group.ambiguous) {
      summary.hasAmbiguous = true;
    }

    if (key === 'NO_TIMESTAMP') {
      summary.needsMetadata = true;
    }
  });

  // Sort patterns by count (descending)
  summary.patterns.sort((a, b) => b.count - a.count);

  return summary;
}

/**
 * Display a formatted summary of file patterns
 * @param {Object} summary - Summary from createSummary
 */
export function displaySummary(summary) {
  console.log('\n📊 File Pattern Analysis\n');
  console.log(`Found ${summary.totalFiles} file(s) in ${summary.patterns.length} pattern(s):\n`);

  summary.patterns.forEach((p, index) => {
    // Use icon from pattern result (already included in summary)
    const icon = p.icon || (p.ambiguous ? '⚠️ ' : p.hasTime ? '🕐 ' : p.hasDate ? '📅 ' : '❓ ');
    const precision = p.precision ? `[${p.precision}]` : '';
    console.log(`${index + 1}. ${icon}${p.description} ${precision}`);
    console.log(`   ${p.count} file(s)`);
    if (p.ambiguous) {
      console.log('   ⚠️  Requires format disambiguation');
    }
    console.log('');
  });

  if (summary.hasAmbiguous) {
    console.log('⚠️  Some files have ambiguous date formats that need clarification.\n');
  }

  if (summary.needsMetadata) {
    console.log('ℹ️  Some files have no timestamp and will need metadata extraction.\n');
  }
}

/**
 * Display files in a specific group
 * @param {Object} group - Group object from groupByPattern
 * @param {number} maxDisplay - Maximum number of files to display
 */
export function displayGroup(group, maxDisplay = 5) {
  console.log(`\nPattern: ${group.description}`);
  console.log(`Files: ${group.files.length}\n`);

  const toShow = group.files.slice(0, maxDisplay);
  toShow.forEach((file) => {
    console.log(`  • ${file.name}`);
  });

  if (group.files.length > maxDisplay) {
    console.log(`  ... and ${group.files.length - maxDisplay} more`);
  }
}
