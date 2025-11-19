/* Node.js-only module - uses fs */
/**
 * @module smartAmbiguityResolver
 * @browserSafe false
 * @requires fs
 * @description Smart ambiguity resolution using file metadata
 * NOTE: This file uses statSync for file metadata, Node.js-specific.
 * Core ambiguity resolution logic could be separated for browser use if needed.
 */

import { statSync } from 'fs';
import { detectAmbiguity } from './ambiguityDetector.js';
import { logger } from './logger.js';

/**
 * Calculate confidence score for a date interpretation based on file mtime
 * @param {Date} interpretedDate - The interpreted date
 * @param {Date} mtime - File modification time
 * @returns {number} - Confidence score (0-100)
 * @private
 */
function calculateConfidence(interpretedDate, mtime) {
  // Calculate difference in days
  const diffMs = Math.abs(interpretedDate.getTime() - mtime.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Confidence decreases as difference increases
  // Perfect match (0 days): 100%
  // 30 days: 90%
  // 90 days: 70%
  // 180 days: 50%
  // 365 days: 30%
  // >730 days: 10%

  if (diffDays === 0) return 100;
  if (diffDays <= 7) return 95;
  if (diffDays <= 30) return 90;
  if (diffDays <= 90) return 70;
  if (diffDays <= 180) return 50;
  if (diffDays <= 365) return 30;
  if (diffDays <= 730) return 20;
  return 10;
}

/**
 * Resolve day-month ambiguity using mtime heuristic
 * @param {string} filePath - Path to file
 * @param {object} ambiguity - Ambiguity object from detectAmbiguity
 * @returns {object} - { resolution: 'dmy'|'mdy', confidence: number, suggestion: string }
 * @private
 */
function resolveDayMonthAmbiguity(filePath, ambiguity) {
  try {
    const stats = statSync(filePath);
    const mtime = stats.mtime;

    // Extract year from pattern (e.g., "01-12-2024" -> 2024)
    const yearMatch = ambiguity.pattern.match(/(\d{4})/);
    if (!yearMatch) {
      return { resolution: null, confidence: 50, suggestion: null };
    }
    const year = parseInt(yearMatch[1], 10);

    // Try both interpretations
    const dmyDate = new Date(year, ambiguity.second - 1, ambiguity.first); // DD-MM-YYYY
    const mdyDate = new Date(year, ambiguity.first - 1, ambiguity.second); // MM-DD-YYYY

    // Calculate confidence for each
    const dmyConfidence = calculateConfidence(dmyDate, mtime);
    const mdyConfidence = calculateConfidence(mdyDate, mtime);

    // Choose interpretation with higher confidence
    if (dmyConfidence > mdyConfidence) {
      return {
        resolution: 'dmy',
        confidence: dmyConfidence,
        suggestion: `File mtime (${mtime.toISOString().split('T')[0]}) suggests DD-MM-YYYY (${ambiguity.first} ${getMonthName(ambiguity.second)})`,
        alternativeConfidence: mdyConfidence,
      };
    } else {
      return {
        resolution: 'mdy',
        confidence: mdyConfidence,
        suggestion: `File mtime (${mtime.toISOString().split('T')[0]}) suggests MM-DD-YYYY (${getMonthName(ambiguity.first)} ${ambiguity.second})`,
        alternativeConfidence: mdyConfidence,
      };
    }
  } catch (error) {
    // If we can't read file stats, return neutral
    logger.debug('Could not read file stats for ambiguity resolution:', { filePath, error: error.message });
    return { resolution: null, confidence: 50, suggestion: null };
  }
}

/**
 * Resolve two-digit year ambiguity using mtime heuristic
 * @param {string} filePath - Path to file
 * @param {object} ambiguity - Ambiguity object from detectAmbiguity
 * @returns {object} - { resolution: '2000s'|'1900s', confidence: number, suggestion: string }
 * @private
 */
function resolveTwoDigitYearAmbiguity(filePath, ambiguity) {
  try {
    const stats = statSync(filePath);
    const mtime = stats.mtime;
    const mtimeYear = mtime.getFullYear();

    // Extract month and day from pattern (e.g., "241103_143045")
    const match = ambiguity.pattern.match(/(\d{2})(\d{2})(\d{2})/);
    if (!match) {
      return { resolution: null, confidence: 50, suggestion: null };
    }

    const yy = parseInt(match[1], 10);
    const mm = parseInt(match[2], 10);
    const dd = parseInt(match[3], 10);

    // Try both interpretations
    const date2000s = new Date(2000 + yy, mm - 1, dd);
    const date1900s = new Date(1900 + yy, mm - 1, dd);

    // Calculate confidence for each
    const confidence2000s = calculateConfidence(date2000s, mtime);
    const confidence1900s = calculateConfidence(date1900s, mtime);

    // Choose interpretation with higher confidence
    if (confidence2000s > confidence1900s) {
      return {
        resolution: '2000s',
        confidence: confidence2000s,
        suggestion: `File mtime (${mtimeYear}) suggests 20${String(yy).padStart(2, '0')}`,
        alternativeConfidence: confidence1900s,
      };
    } else {
      return {
        resolution: '1900s',
        confidence: confidence1900s,
        suggestion: `File mtime (${mtimeYear}) suggests 19${String(yy).padStart(2, '0')}`,
        alternativeConfidence: confidence2000s,
      };
    }
  } catch (error) {
    // If we can't read file stats, return neutral
    logger.debug('Could not read file stats for year ambiguity resolution:', { filePath, error: error.message });
    return { resolution: null, confidence: 50, suggestion: null };
  }
}

/**
 * Get month name from month number
 * @param {number} month - Month number (1-12)
 * @returns {string} - Month name
 * @private
 */
function getMonthName(month) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month - 1] || '';
}

/**
 * Analyze ambiguous file using mtime heuristic
 * @param {string} filePath - Path to file
 * @param {string} filename - Filename (optional, defaults to basename of filePath)
 * @returns {object | null} - Smart resolution or null if not ambiguous
 */
export function analyzeAmbiguousFile(filePath, filename = null) {
  const name = filename || filePath.split('/').pop();
  const ambiguity = detectAmbiguity(name);

  if (!ambiguity) {
    return null;
  }

  if (ambiguity.type === 'day-month-order') {
    return {
      ...ambiguity,
      smart: resolveDayMonthAmbiguity(filePath, ambiguity),
    };
  } else if (ambiguity.type === 'two-digit-year') {
    return {
      ...ambiguity,
      smart: resolveTwoDigitYearAmbiguity(filePath, ambiguity),
    };
  }

  return { ...ambiguity, smart: { resolution: null, confidence: 50, suggestion: null } };
}

/**
 * Batch analyze ambiguous files with smart resolution
 * @param {Array<{path: string, name: string}>} files - Array of file objects
 * @param {number} autoResolveThreshold - Confidence threshold for auto-resolution (default: 80)
 * @returns {object} - { autoResolved: Map, needsPrompt: Array, stats: Object }
 */
export function batchAnalyzeAmbiguousFiles(files, autoResolveThreshold = 80) {
  const autoResolved = new Map();
  const needsPrompt = [];
  const stats = {
    total: files.length,
    autoResolved: 0,
    needsPrompt: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
  };

  for (const file of files) {
    const analysis = analyzeAmbiguousFile(file.path, file.name);

    if (!analysis || !analysis.smart) {
      continue;
    }

    const { smart } = analysis;
    const confidence = smart.confidence || 50;

    // Categorize by confidence
    if (confidence >= 80) stats.highConfidence++;
    else if (confidence >= 60) stats.mediumConfidence++;
    else stats.lowConfidence++;

    // Auto-resolve if confidence is high enough
    if (smart.resolution && confidence >= autoResolveThreshold) {
      autoResolved.set(file.path, smart.resolution);
      stats.autoResolved++;
    } else {
      needsPrompt.push({
        ...file,
        analysis,
      });
      stats.needsPrompt++;
    }
  }

  return { autoResolved, needsPrompt, stats };
}
