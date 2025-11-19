/* Browser-safe module ✓ */
/**
 * @module contextualResolver
 * @browserSafe true
 * @description Context-Aware Ambiguity Resolution
 *
 * Analyzes multiple filenames together to automatically determine
 * the most likely date format (DD-MM vs MM-DD) based on patterns
 * across the entire set.
 */

import { detectAmbiguity } from './ambiguityDetector.js';
import { detectTimestampHeuristic } from './heuristicDetector.js';

/**
 * Analyze a batch of filenames to determine the most likely date format
 *
 * Strategy:
 * 1. Group by directory (same folder = same convention)
 * 2. Find all ambiguous dates (01-12, 02-11, etc.)
 * 3. Look for "proof" dates where day > 12 (unambiguous)
 * 4. Check consistency across the batch
 * 5. Return recommendation with confidence score
 * @param {string[]} filenames - Array of filenames (can include paths)
 * @param {object} options - Analysis options
 * @param {string} options.currentDirectory - If provided, prioritize files from this directory
 * @returns {object} - Analysis result with recommendation
 */
export function analyzeContextualFormat(filenames, options = {}) {
  const { currentDirectory } = options;
  const analysis = {
    recommendation: null,      // 'dmy' or 'mdy'
    confidence: 0,             // 0.0 - 1.0
    evidence: [],              // Array of evidence strings
    stats: {
      total: filenames.length,
      ambiguous: 0,
      dmyProof: 0,             // Dates where day > 12 (must be DD-MM)
      mdyProof: 0,             // Dates where month > 12 (must be MM-DD)
      yearProof: 0,            // Dates with explicit 4-digit years
      consistentPattern: false,
      sameDirectoryFiles: 0    // Files in current directory
    }
  };

  // Helper to extract directory from filepath
  const getDirectory = (filepath) => {
    const lastSlash = Math.max(filepath.lastIndexOf('/'), filepath.lastIndexOf('\\'));
    return lastSlash > 0 ? filepath.substring(0, lastSlash) : '.';
  };

  // Prioritize files from the same directory if specified
  let priorityFilenames = filenames;
  if (currentDirectory) {
    const currentDirFiles = filenames.filter(f => {
      const dir = getDirectory(f);
      return dir === currentDirectory;
    });

    if (currentDirFiles.length >= 2) {
      // If we have enough files in the current directory, prioritize them
      priorityFilenames = currentDirFiles;
      analysis.stats.sameDirectoryFiles = currentDirFiles.length;
      analysis.evidence.push(`Prioritizing ${currentDirFiles.length} files from current directory`);
    }
  }

  // Track date components we see
  const dateComponents = [];
  const US_DATE_TYPES = ['US_DATE', 'COMPACT_US'];
  const EU_DATE_TYPES = ['EUROPEAN_DATE', 'COMPACT_EUROPEAN', 'EUROPEAN_COMPACT'];

  for (const filename of priorityFilenames) {
    // Check for ambiguous dates first (both values <= 12)
    const ambiguity = detectAmbiguity(filename);

    if (ambiguity) {
      analysis.stats.ambiguous++;

      // Check if the ambiguity itself provides proof
      // If first > 12, must be DD-MM format
      // If second > 12, must be MM-DD format
      if (ambiguity.first > 12 && ambiguity.second <= 12) {
        analysis.stats.dmyProof++;
        dateComponents.push({
          filename,
          first: ambiguity.first,
          second: ambiguity.second,
          proof: 'dmy'
        });
      } else if (ambiguity.second > 12 && ambiguity.first <= 12) {
        analysis.stats.mdyProof++;
        dateComponents.push({
          filename,
          first: ambiguity.first,
          second: ambiguity.second,
          proof: 'mdy'
        });
      } else {
        // Truly ambiguous (both <= 12)
        dateComponents.push({
          filename,
          first: ambiguity.first,
          second: ambiguity.second,
          ambiguous: true
        });
      }
    }

    // Use heuristic to detect format via type field
    // The heuristic returns 'US_DATE' for MM-DD and 'EUROPEAN_DATE' for DD-MM
    const timestamps = detectTimestampHeuristic(filename, { dateFormat: 'dmy' });
    for (const ts of timestamps) {
      if (ts.day && ts.month && ts.year && ts.year > 1000) {
        analysis.stats.yearProof++;

        // Check the type field to determine original format
        if (US_DATE_TYPES.includes(ts.type) && !ambiguity) {
          // Heuristic detected US format (MM-DD)
          analysis.stats.mdyProof++;
        } else if (EU_DATE_TYPES.includes(ts.type) && !ambiguity) {
          // Heuristic detected European format (DD-MM)
          analysis.stats.dmyProof++;
        }
        break; // Count once per file
      }
    }
  }

  // Analyze the evidence
  const dmyEvidence = analysis.stats.dmyProof;
  const mdyEvidence = analysis.stats.mdyProof;

  // Strong evidence: multiple proof dates in one direction
  if (dmyEvidence >= 3 && mdyEvidence === 0) {
    analysis.recommendation = 'dmy';
    analysis.confidence = Math.min(0.95, 0.7 + (dmyEvidence * 0.05));
    analysis.evidence.push(`Found ${dmyEvidence} dates with day > 12 (DD-MM format proven)`);
    analysis.evidence.push('No conflicting evidence for MM-DD format');
    analysis.stats.consistentPattern = true;
  } else if (mdyEvidence >= 3 && dmyEvidence === 0) {
    analysis.recommendation = 'mdy';
    analysis.confidence = Math.min(0.95, 0.7 + (mdyEvidence * 0.05));
    analysis.evidence.push(`Found ${mdyEvidence} dates with month > 12 (MM-DD format proven)`);
    analysis.evidence.push('No conflicting evidence for DD-MM format');
    analysis.stats.consistentPattern = true;
  } else if (dmyEvidence > mdyEvidence && dmyEvidence >= 1) {
    analysis.recommendation = 'dmy';
    analysis.confidence = 0.60 + (dmyEvidence * 0.05);
    analysis.evidence.push(`Found ${dmyEvidence} dates suggesting DD-MM format`);
    if (mdyEvidence > 0) {
      analysis.evidence.push(`Warning: ${mdyEvidence} dates suggest MM-DD (mixed formats?)`);
    }
  } else if (mdyEvidence > dmyEvidence && mdyEvidence >= 1) {
    analysis.recommendation = 'mdy';
    analysis.confidence = 0.60 + (mdyEvidence * 0.05);
    analysis.evidence.push(`Found ${mdyEvidence} dates suggesting MM-DD format`);
    if (dmyEvidence > 0) {
      analysis.evidence.push(`Warning: ${dmyEvidence} dates suggest DD-MM (mixed formats?)`);
    }
  } else if (analysis.stats.ambiguous > 0 && dmyEvidence === 0 && mdyEvidence === 0) {
    // Only ambiguous dates, no proof - default to DMY (European default)
    analysis.recommendation = 'dmy';
    analysis.confidence = 0.50;
    analysis.evidence.push(`Found ${analysis.stats.ambiguous} ambiguous dates`);
    analysis.evidence.push('No unambiguous dates to determine format');
    analysis.evidence.push('Defaulting to DD-MM (European standard)');
  }

  // Adjust confidence based on consistency
  if (analysis.stats.yearProof > filenames.length * 0.7) {
    analysis.confidence = Math.min(1.0, analysis.confidence + 0.1);
    analysis.evidence.push('High consistency: most dates have 4-digit years');
  }

  return analysis;
}

/**
 * Resolve ambiguous dates across a batch using contextual analysis
 * @param {object | string[]} analysisOrFilenames - Analysis result from analyzeContextualFormat() or array of filenames
 * @param {object} options - Resolution options
 * @param {string} options.defaultFormat - Default if no context ('dmy' or 'mdy')
 * @param {number} options.threshold - Minimum confidence to auto-apply (0.7)
 * @returns {object} - Resolution result
 */
export function resolveAmbiguitiesByContext(analysisOrFilenames, options = {}) {
  const {
    defaultFormat = 'dmy',
    threshold = 0.70,
    confidenceThreshold = threshold  // Backward compatibility
  } = options;

  // Support both analysis object and filenames array
  const analysis = Array.isArray(analysisOrFilenames)
    ? analyzeContextualFormat(analysisOrFilenames)
    : analysisOrFilenames;

  // Determine the format to use
  let format = defaultFormat;
  let autoResolved = false;

  if (analysis.recommendation && analysis.confidence >= confidenceThreshold) {
    format = analysis.recommendation;
    autoResolved = true;
  }

  // Build result
  const result = {
    format,
    autoResolved,
    confidence: analysis.confidence,
    analysis,
    shouldPromptUser: !autoResolved && analysis.stats.ambiguous > 0
  };

  return result;
}

/**
 * Get smart parsing options based on contextual analysis
 *
 * This is a convenience function that analyzes the batch and returns
 * parsing options that can be passed to parseTimestamp functions.
 * @param {string[]} filenames - Array of filenames to analyze
 * @param {object} options - Analysis options
 * @returns {object} - Parsing options with recommended dateFormat
 */
export function getContextualParsingOptions(filenames, options = {}) {
  const resolution = resolveAmbiguitiesByContext(filenames, options);

  return {
    dateFormat: resolution.format,
    confidence: resolution.confidence,
    autoResolved: resolution.autoResolved,
    evidence: resolution.analysis.evidence
  };
}

/**
 * Check if a batch has ambiguous dates that need resolution
 * @param {string[]} filenames - Array of filenames
 * @returns {boolean} - True if there are ambiguous dates
 */
export function hasAmbiguousDates(filenames) {
  for (const filename of filenames) {
    if (detectAmbiguity(filename)) {
      return true;
    }
  }
  return false;
}

/**
 * Get a summary report of date formats in a batch
 * @param {object | string[]} analysisOrFilenames - Analysis result from analyzeContextualFormat() or array of filenames
 * @returns {object} - Summary report
 */
export function getFormatSummary(analysisOrFilenames) {
  // Support both analysis object and filenames array
  const analysis = Array.isArray(analysisOrFilenames)
    ? analyzeContextualFormat(analysisOrFilenames)
    : analysisOrFilenames;

  const summary = {
    totalFiles: analysis.stats.total,
    filesWithDates: analysis.stats.yearProof + analysis.stats.ambiguous,
    ambiguousDates: analysis.stats.ambiguous,
    unambiguousDates: analysis.stats.dmyProof + analysis.stats.mdyProof,
    recommendation: analysis.recommendation,
    confidence: analysis.confidence,
    evidence: analysis.evidence,
    needsUserInput: analysis.confidence < 0.70 && analysis.stats.ambiguous > 0
  };

  return summary;
}
