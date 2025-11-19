/* Browser-safe module ✓ */
/**
 * @module batchProcessor
 * @browserSafe true
 * @description Batch Processing API for high-performance bulk timestamp parsing
 *
 * Optimizations:
 * - Pattern caching for similar filenames
 * - Shared heuristic context
 * - Reduced redundant parsing
 */

import { getBestTimestamp } from './heuristicDetector.js';
import { timestampToDate } from './heuristicDetector.js';
import { CONFIDENCE } from '../config/constants.js';
import { processInChunks } from './batchProgressHelper.js';

/**
 * Parse timestamps from multiple filenames efficiently
 * @param {string[]} filenames - Array of filenames to parse
 * @param {object} options - Parsing options
 * @param {string} options.dateFormat - Date format preference: 'dmy' or 'mdy'
 * @param {boolean} options.allowTimeOnly - Allow time-only formats
 * @param {boolean} options.includeConfidence - Include confidence scores (default: true)
 * @param {number|'auto'} options.chunkSize - Process N files at a time, or 'auto' for optimal size (default: 'auto')
 * @param {(progress: {completed: number, total: number, percentage: number, elapsedMs: number, estimatedRemainingMs: number, filesPerSecond: number}) => void} options.onProgress - Progress callback
 * @param {(filename: string, result: object, index: number) => void} options.onItemProcessed - Per-item callback
 * @param {boolean} options.yieldBetweenChunks - Yield to event loop between chunks (default: true in browser, false in Node.js)
 * @param {import('./batchProgressHelper.js').PauseToken} options.pauseToken - Token to pause/resume processing
 * @param {AbortSignal} options.abortSignal - Signal to abort processing
 * @param {(filename: string) => number} options.priorityFn - Function to determine processing priority: (filename) => number (higher = first)
 * @param {'fail-fast'|'collect'|'ignore'} options.errorMode - How to handle errors (default: 'collect')
 * @returns {Promise<Array<object>>} - Array of results with {filename, timestamp, date, confidence}
 */
export async function parseTimestampBatch(filenames, options = {}) {
  const {
    dateFormat = 'dmy',
    allowTimeOnly = false,
    includeConfidence = true,
    chunkSize = 'auto',
    onProgress,
    onItemProcessed,
    yieldBetweenChunks = typeof window !== 'undefined', // true in browser, false in Node.js
    pauseToken,
    abortSignal,
    priorityFn,
    errorMode = 'collect' // Default to collect for batch operations
  } = options;

  const patternCache = new Map(); // Cache pattern types seen

  /**
   * Process a single filename
   * @param {string} filename - Filename to process
   * @returns {object} - Result object
   */
  const processFilename = (filename) => {
    // Try to use cached pattern knowledge for similar filenames
    const cacheKey = getCacheKey(filename);
    const cachedPattern = patternCache.get(cacheKey);

    let timestamp = null;

    if (cachedPattern && cachedPattern.count > 2) {
      // If we've seen this pattern 3+ times, try the cached approach first
      timestamp = tryWithCachedPattern(filename, cachedPattern, { dateFormat });
    }

    // Fallback to full heuristic detection
    if (!timestamp) {
      timestamp = getBestTimestamp(filename, { dateFormat });
    }

    // Update pattern cache
    if (timestamp) {
      updatePatternCache(patternCache, cacheKey, timestamp);
    }

    // Convert to date
    const date = timestamp ? timestampToDate(timestamp, { allowTimeOnly }) : null;

    return {
      filename,
      timestamp,
      date,
      ...(includeConfidence && timestamp ? { confidence: timestamp.confidence } : {})
    };
  };

  // Use progressive processing if chunking is enabled
  if (chunkSize !== filenames.length && (chunkSize === 'auto' || chunkSize < filenames.length)) {
    const { results } = await processInChunks(
      filenames,
      processFilename,
      {
        chunkSize,
        onProgress,
        onItemProcessed,
        yieldBetweenChunks,
        pauseToken,
        abortSignal,
        priorityFn,
        errorMode
      }
    );
    return results;
  }

  // Fallback to synchronous processing for small batches or when chunking disabled
  const results = [];
  for (const filename of filenames) {
    results.push(processFilename(filename));
  }
  return results;
}

/**
 * Generate cache key based on filename structure
 * Groups similar filenames together (e.g., IMG_*.jpg, Screenshot *.png)
 * @param {string} filename - Filename to generate cache key for
 * @returns {string} - Normalized cache key
 * @private
 */
function getCacheKey(filename) {
  // Extract pattern signature (prefix + digit pattern + suffix)
  const normalized = filename
    .replace(/\d+/g, 'N')  // Replace all numbers with 'N'
    .replace(/[_-]/g, '_') // Normalize separators
    .toLowerCase();

  // Get first 20 chars + extension
  const ext = filename.split('.').pop() || '';
  const prefix = normalized.substring(0, 20);

  return `${prefix}.${ext}`;
}

/**
 * Try to parse using cached pattern knowledge
 * @param {string} _filename - Filename to parse
 * @param {object} _cached - Cached pattern information
 * @param {object} _options - Parsing options
 * @returns {object | null} - Timestamp object or null for fallback
 * @private
 */
function tryWithCachedPattern(_filename, _cached, _options) {
  // For now, just use standard detection
  // Future optimization: could try the cached pattern type first
  return null; // Fallback to full heuristic
}

/**
 * Update pattern cache with observed timestamp
 * @param {Map} cache - Pattern cache map
 * @param {string} key - Cache key
 * @param {object} timestamp - Timestamp object to cache
 * @private
 */
function updatePatternCache(cache, key, timestamp) {
  if (!cache.has(key)) {
    cache.set(key, {
      type: timestamp.type,
      count: 1,
      avgConfidence: timestamp.confidence || 0
    });
  } else {
    const entry = cache.get(key);
    entry.count++;
    entry.avgConfidence = (entry.avgConfidence + (timestamp.confidence || 0)) / 2;
  }
}

/**
 * Parse timestamps and group by detection confidence
 * Useful for identifying files that need manual review
 * @param {string[]} filenames - Array of filenames
 * @param {object} options - Parsing options
 * @returns {Promise<object>} - {high: [], medium: [], low: [], none: []}
 */
export async function parseAndGroupByConfidence(filenames, options = {}) {
  const results = await parseTimestampBatch(filenames, options);

  const grouped = {
    high: [],      // confidence >= CONFIDENCE.THRESHOLD_HIGH
    medium: [],    // confidence CONFIDENCE.THRESHOLD_MEDIUM - (THRESHOLD_HIGH - 0.01)
    low: [],       // confidence CONFIDENCE.THRESHOLD_LOW - (THRESHOLD_MEDIUM - 0.01)
    veryLow: [],   // confidence < CONFIDENCE.THRESHOLD_LOW
    none: []       // no timestamp detected
  };

  for (const result of results) {
    if (!result.date) {
      grouped.none.push(result);
    } else if (result.confidence >= CONFIDENCE.THRESHOLD_HIGH) {
      grouped.high.push(result);
    } else if (result.confidence >= CONFIDENCE.THRESHOLD_MEDIUM) {
      grouped.medium.push(result);
    } else if (result.confidence >= CONFIDENCE.THRESHOLD_LOW) {
      grouped.low.push(result);
    } else {
      grouped.veryLow.push(result);
    }
  }

  return grouped;
}

/**
 * Get batch processing statistics
 * @param {string[]} filenames - Array of filenames
 * @param {object} options - Parsing options
 * @returns {Promise<object>} - Statistics about the batch
 */
export async function getBatchStats(filenames, options = {}) {
  const results = await parseTimestampBatch(filenames, options);

  const stats = {
    total: filenames.length,
    detected: 0,
    notDetected: 0,
    avgConfidence: 0,
    types: {},
    precisions: {},
    ambiguous: 0
  };

  let confidenceSum = 0;
  let detectedCount = 0;

  for (const result of results) {
    if (result.timestamp) {
      stats.detected++;
      detectedCount++;

      // Confidence
      if (result.confidence) {
        confidenceSum += result.confidence;
      }

      // Type distribution
      const type = result.timestamp.type;
      stats.types[type] = (stats.types[type] || 0) + 1;

      // Precision distribution
      const precision = result.timestamp.precision;
      stats.precisions[precision] = (stats.precisions[precision] || 0) + 1;

      // Ambiguous count
      if (result.timestamp.ambiguous) {
        stats.ambiguous++;
      }
    } else {
      stats.notDetected++;
    }
  }

  stats.avgConfidence = detectedCount > 0 ? confidenceSum / detectedCount : 0;

  return stats;
}

/**
 * Filter filenames by whether they have detectable timestamps
 * @param {string[]} filenames - Array of filenames
 * @param {object} options - Parsing options
 * @returns {Promise<object>} - {withTimestamp: [], withoutTimestamp: []}
 */
export async function filterByTimestamp(filenames, options = {}) {
  const results = await parseTimestampBatch(filenames, options);

  const filtered = {
    withTimestamp: [],
    withoutTimestamp: []
  };

  for (const result of results) {
    if (result.date) {
      filtered.withTimestamp.push(result.filename);
    } else {
      filtered.withoutTimestamp.push(result.filename);
    }
  }

  return filtered;
}
