/* Node.js-only module - uses fs, path, url */
/**
 * @module unifiedMetadataExtractor
 * @browserSafe false
 * @requires node:fs
 * @requires node:path
 * @requires node:url
 * @description Unified Metadata Extractor
 *
 * Provides a single, consistent interface for extracting timestamps from multiple sources:
 * - Filename patterns
 * - EXIF data (photos)
 * - Audio metadata (MP3, M4A, etc.)
 * - File system metadata (mtime, birthtime)
 */

import { parseTimestampFromEXIF, parseTimestampFromAudio } from './fileMetadataParser.js';
import { basename, extname } from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { processInChunks } from './batchProgressHelper.js';
import { globalMetadataCache } from './metadataCache.js';

/**
 * Timestamp source types
 */
export /**
        *
        */
const SOURCE_TYPE = {
  FILENAME: 'filename',
  EXIF: 'exif',
  AUDIO: 'audio',
  MTIME: 'mtime',           // Modified time
  BIRTHTIME: 'birthtime',   // Creation time
  CUSTOM: 'custom'
};

/**
 * Default source priority (checked in this order)
 */
export /**
        *
        */
const DEFAULT_PRIORITY = [
  SOURCE_TYPE.FILENAME,
  SOURCE_TYPE.EXIF,
  SOURCE_TYPE.AUDIO,
  SOURCE_TYPE.BIRTHTIME,
  SOURCE_TYPE.MTIME
];

/**
 * Select primary source based on priority order
 * @param {Array} allSources - All available sources
 * @param {string[]} priority - Source priority order
 * @param {boolean} includeAll - Whether to include all sources in result
 * @returns {object | null} Selected result
 * @private
 */
function selectByPriority(allSources, priority, includeAll) {
  if (!allSources || allSources.length === 0) {
    return null;
  }

  // Sort by priority order
  const sorted = [...allSources].sort((a, b) => {
    const aIdx = priority.indexOf(a.source);
    const bIdx = priority.indexOf(b.source);

    // Sources not in priority list go last
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;

    return aIdx - bIdx;
  });

  if (includeAll) {
    return {
      primary: sorted[0],
      all: sorted
    };
  }

  return sorted[0];
}

/**
 * Extract timestamp from any available source
 * @param {string} filepath - Full path to file
 * @param {object} options - Extraction options
 * @param {string[]} options.sources - Source priority order (default: DEFAULT_PRIORITY)
 * @param {boolean} options.includeAll - Return all sources, not just first match (default: false)
 * @param {boolean} options.includeConfidence - Include confidence scores (default: true)
 * @param {boolean} options.useCache - Use metadata cache (default: true)
 * @param {boolean} options.cacheResults - Store results in cache (default: true)
 * @param {Function} options.onCacheHit - Callback when cache hit: (filepath, cached) => void
 * @param {object} options.parsingOptions - Options for filename parsing (dateFormat, allowTimeOnly, etc.)
 * @returns {object | null} - Extraction result or null if no timestamp found
 * @example
 * const result = await extractTimestamp('photo.jpg');
 * // {
 * //   timestamp: Date,
 * //   source: 'exif',
 * //   confidence: 0.95,
 * //   details: { ... }
 * // }
 * @example
 * // Get all available sources
 * const result = await extractTimestamp('photo.jpg', { includeAll: true });
 * // {
 * //   primary: { source: 'exif', timestamp: Date, confidence: 0.95 },
 * //   all: [
 * //     { source: 'filename', timestamp: Date, confidence: 0.70 },
 * //     { source: 'exif', timestamp: Date, confidence: 0.95 },
 * //     { source: 'mtime', timestamp: Date, confidence: 0.50 }
 * //   ]
 * // }
 * @example
 * // Use cache for better performance
 * const result = await extractTimestamp('photo.jpg', {
 *   useCache: true,
 *   onCacheHit: (fp, cached) => console.log('Cache hit!', fp)
 * });
 * @example
 * // Force re-extraction (bypass cache)
 * const fresh = await extractTimestamp('photo.jpg', { useCache: false });
 */
export async function extractTimestamp(filepath, options = {}) {
  const {
    sources = DEFAULT_PRIORITY,
    includeAll = false,
    includeConfidence = true,
    useCache = true,
    cacheResults = true,
    onCacheHit = null,
    parsingOptions = {}
  } = options;

  // Normalize path (handle file:// URLs)
  const normalizedPath = filepath.startsWith('file://')
    ? fileURLToPath(filepath)
    : filepath;

  // Get file stats (needed for cache key and filesystem times)
  let stats;
  try {
    stats = fs.statSync(normalizedPath);
  } catch {
    return null; // File doesn't exist or can't be accessed
  }

  // Check cache first
  if (useCache) {
    const cached = globalMetadataCache.get(normalizedPath, stats);
    if (cached) {
      // Notify caller about cache hit
      if (onCacheHit) {
        try {
          onCacheHit(normalizedPath, cached);
        } catch {
          // Ignore callback errors
        }
      }

      // Re-apply priority to cached results
      return selectByPriority(cached.allSources, sources, includeAll);
    }
  }

  // Cache miss - extract metadata from all requested sources
  const results = [];
  const filename = basename(normalizedPath);
  const ext = extname(normalizedPath).toLowerCase();

  // Try each source in priority order
  for (const source of sources) {
    let result = null;

    try {
      switch (source) {
      case SOURCE_TYPE.FILENAME:
        result = await extractFromFilename(filename, parsingOptions);
        break;

      case SOURCE_TYPE.EXIF:
        if (isImageFile(ext)) {
          result = await extractFromEXIF(normalizedPath);
        }
        break;

      case SOURCE_TYPE.AUDIO:
        if (isAudioFile(ext)) {
          result = await extractFromAudio(normalizedPath);
        }
        break;

      case SOURCE_TYPE.BIRTHTIME:
        result = await extractFromBirthtime(normalizedPath);
        break;

      case SOURCE_TYPE.MTIME:
        result = await extractFromMtime(normalizedPath);
        break;

      default:
        // Skip unknown sources
        continue;
      }

      if (result && result.timestamp) {
        results.push({
          source,
          ...result,
          confidence: includeConfidence ? result.confidence : undefined
        });

        // If not requesting all sources, return first match
        if (!includeAll) {
          return results[0];
        }
      }
    } catch {
      // Skip sources that error (file not found, permission denied, etc.)
      continue;
    }
  }

  if (results.length === 0) {
    return null;
  }

  // Store ALL sources in cache (regardless of includeAll setting)
  // This allows priority changes without re-reading files
  if (cacheResults) {
    globalMetadataCache.set(normalizedPath, stats, results);
  }

  // Return based on includeAll setting
  return selectByPriority(results, sources, includeAll);
}

/**
 * Extract timestamp from filename
 * @param basename
 * @param options
 * @private
 */
async function extractFromFilename(basename, options) {
  // Use getBestTimestamp to get full detection object with confidence
  const { getBestTimestamp, timestampToDate } = await import('./heuristicDetector.js');

  const detection = getBestTimestamp(basename, options);
  if (!detection) {
    return null;
  }

  const timestamp = timestampToDate(detection, options);
  if (!timestamp) {
    return null;
  }

  return {
    timestamp,
    confidence: detection.confidence || 0.70,
    details: {
      method: 'heuristic',
      type: detection.type,
      precision: detection.precision
    }
  };
}

/**
 * Extract timestamp from EXIF data
 * @param filepath
 * @private
 */
async function extractFromEXIF(filepath) {
  const timestamp = await parseTimestampFromEXIF(filepath);
  if (!timestamp) {
    return null;
  }

  return {
    timestamp,
    confidence: 0.95, // EXIF data is highly reliable
    details: {
      source: 'EXIF metadata'
    }
  };
}

/**
 * Extract timestamp from audio metadata
 * @param filepath
 * @private
 */
async function extractFromAudio(filepath) {
  const timestamp = await parseTimestampFromAudio(filepath);
  if (!timestamp) {
    return null;
  }

  return {
    timestamp,
    confidence: 0.90, // Audio metadata is reliable
    details: {
      source: 'Audio tags'
    }
  };
}

/**
 * Extract timestamp from file birthtime (creation time)
 * @param filepath
 * @private
 */
async function extractFromBirthtime(filepath) {
  try {
    const stats = await fs.promises.stat(filepath);
    if (!stats.birthtime || stats.birthtime.getTime() === 0) {
      return null;
    }

    return {
      timestamp: stats.birthtime,
      confidence: 0.60, // File system metadata is less reliable
      details: {
        source: 'File creation time'
      }
    };
  } catch {
    return null;
  }
}

/**
 * Extract timestamp from file mtime (modification time)
 * @param filepath
 * @private
 */
async function extractFromMtime(filepath) {
  try {
    const stats = await fs.promises.stat(filepath);
    if (!stats.mtime) {
      return null;
    }

    return {
      timestamp: stats.mtime,
      confidence: 0.50, // Modified time is least reliable
      details: {
        source: 'File modification time'
      }
    };
  } catch {
    return null;
  }
}

/**
 * Check if file extension is an image format
 * @param ext
 * @private
 */
function isImageFile(ext) {
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tif', '.tiff', '.webp', '.heic', '.heif'];
  return imageExts.includes(ext);
}

/**
 * Check if file extension is an audio format
 * @param ext
 * @private
 */
function isAudioFile(ext) {
  const audioExts = ['.mp3', '.m4a', '.ogg', '.flac', '.wav', '.aiff', '.aif'];
  return audioExts.includes(ext);
}

/**
 * Batch extract timestamps from multiple files
 * @param {string[]} filepaths - Array of file paths
 * @param {object} options - Extraction options (same as extractTimestamp)
 * @param {number|'auto'} options.chunkSize - Process N files at a time, or 'auto' for optimal size (default: 'auto')
 * @param {Function} options.onProgress - Progress callback: ({completed, total, percentage, elapsedMs, estimatedRemainingMs, filesPerSecond}) => void
 * @param {boolean} options.yieldBetweenChunks - Yield to event loop between chunks (default: false in Node.js)
 * @param {import('./batchProgressHelper.js').PauseToken} options.pauseToken - Token to pause/resume processing
 * @param {AbortSignal} options.abortSignal - Signal to abort processing
 * @param {Function} options.priorityFn - Function to determine processing priority: (filepath) => number (higher = first)
 * @param {'fail-fast'|'collect'|'ignore'} options.errorMode - How to handle errors (default: 'collect')
 * @returns {Promise<Array>} - Array of {filepath, result} objects
 * @example
 * const results = await extractTimestampBatch(['photo1.jpg', 'photo2.jpg'], {
 *   chunkSize: 100,
 *   onProgress: (info) => console.log(`${info.completed}/${info.total}`)
 * });
 * results.forEach(r => {
 *   console.log(`${r.filepath}: ${r.result?.source} - ${r.result?.timestamp}`);
 * });
 */
export async function extractTimestampBatch(filepaths, options = {}) {
  const {
    chunkSize = 'auto',
    onProgress,
    onItemProcessed,
    yieldBetweenChunks = false, // Default: false in Node.js for better throughput
    pauseToken,
    abortSignal,
    priorityFn,
    errorMode = 'collect', // Default to collect for batch operations
    ...extractOptions
  } = options;

  // Use progressive processing with chunking and progress tracking
  const { results } = await processInChunks(
    filepaths,
    async (filepath) => ({
      filepath,
      result: await extractTimestamp(filepath, extractOptions)
    }),
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

/**
 * Compare timestamps from different sources and detect discrepancies
 * @param {string} filepath - Full path to file
 * @param {object} options - Comparison options
 * @param {number} options.thresholdSeconds - Max difference before warning (default: 60)
 * @returns {Promise<object>} - Comparison result with warnings
 * @example
 * const comparison = await compareTimestampSources('photo.jpg');
 * if (comparison.hasDiscrepancy) {
 *   console.log(`Warning: ${comparison.discrepancies[0].message}`);
 * }
 */
export async function compareTimestampSources(filepath, options = {}) {
  const { thresholdSeconds = 60 } = options;

  // Extract from all sources
  const result = await extractTimestamp(filepath, {
    includeAll: true,
    includeConfidence: true
  });

  if (!result || result.all.length < 2) {
    return {
      hasDiscrepancy: false,
      sources: result?.all || [],
      discrepancies: []
    };
  }

  const sources = result.all;
  const discrepancies = [];

  // Compare each pair of sources
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const source1 = sources[i];
      const source2 = sources[j];

      const diff = Math.abs(
        source1.timestamp.getTime() - source2.timestamp.getTime()
      ) / 1000; // Convert to seconds

      if (diff > thresholdSeconds) {
        discrepancies.push({
          source1: source1.source,
          source2: source2.source,
          difference: diff,
          message: `${source1.source} and ${source2.source} differ by ${Math.round(diff)} seconds`
        });
      }
    }
  }

  return {
    hasDiscrepancy: discrepancies.length > 0,
    sources,
    discrepancies,
    recommendation: discrepancies.length > 0
      ? `Use ${sources[0].source} (highest confidence: ${sources[0].confidence.toFixed(2)})`
      : 'All sources agree'
  };
}

/**
 * Get statistics about timestamp sources in a batch of files
 * @param {string[]} filepaths - Array of file paths
 * @returns {Promise<object>} - Statistics about sources used
 * @example
 * const stats = await getSourceStatistics(['photo1.jpg', 'photo2.jpg', 'song.mp3']);
 * console.log(`EXIF: ${stats.sourceDistribution.exif} files`);
 * console.log(`Average confidence: ${stats.avgConfidence}`);
 */
export async function getSourceStatistics(filepaths) {
  const results = await extractTimestampBatch(filepaths);

  const stats = {
    total: results.length,
    detected: 0,
    sourceDistribution: {},
    avgConfidence: 0,
    confidenceBySource: {}
  };

  let totalConfidence = 0;
  const confidenceBySource = {};

  for (const { result } of results) {
    if (result) {
      stats.detected++;

      // Count source usage
      const source = result.source;
      stats.sourceDistribution[source] = (stats.sourceDistribution[source] || 0) + 1;

      // Track confidence by source
      if (!confidenceBySource[source]) {
        confidenceBySource[source] = [];
      }
      confidenceBySource[source].push(result.confidence);

      totalConfidence += result.confidence;
    }
  }

  // Calculate average confidence per source
  for (const [source, confidences] of Object.entries(confidenceBySource)) {
    const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    stats.confidenceBySource[source] = Number(avg.toFixed(2));
  }

  stats.avgConfidence = stats.detected > 0
    ? Number((totalConfidence / stats.detected).toFixed(2))
    : 0;

  return stats;
}

/**
 * Suggest best timestamp source for a file
 * @param {string} filepath - Full path to file
 * @returns {Promise<object>} - Suggestion with reasoning
 */
export async function suggestBestSource(filepath) {
  const result = await extractTimestamp(filepath, {
    includeAll: true,
    includeConfidence: true
  });

  if (!result || result.all.length === 0) {
    return {
      suggestion: null,
      reason: 'No timestamp sources available'
    };
  }

  const sources = result.all;
  const best = sources[0]; // Highest priority and confidence

  // Check for discrepancies
  const comparison = await compareTimestampSources(filepath);

  return {
    suggestion: best.source,
    confidence: best.confidence,
    timestamp: best.timestamp,
    alternatives: sources.slice(1),
    hasDiscrepancy: comparison.hasDiscrepancy,
    discrepancies: comparison.discrepancies,
    reason: comparison.hasDiscrepancy
      ? `Use ${best.source} (highest confidence), but verify due to discrepancies`
      : `${best.source} is reliable and consistent with other sources`
  };
}

/**
 * Re-apply priority to existing batch results without re-reading files
 *
 * IMPORTANT: Only works if original extraction used `includeAll: true`
 *
 * This is useful when user changes the metadata source priority in the UI.
 * Instead of re-extracting metadata from all files (expensive I/O), we just
 * re-sort the cached results based on the new priority.
 * @param {Array} batchResults - Results from extractTimestampBatch()
 * @param {string[]} newPriority - New source priority order
 * @returns {Array} Updated results with new priority applied
 * @throws {TypeError} If batchResults is not an array or newPriority is invalid
 * @example
 * // Original extraction with ALL sources
 * const results = await extractTimestampBatch(files, {
 *   sources: ['filename', 'exif', 'audio'],
 *   includeAll: true  // REQUIRED for reapplyPriority!
 * });
 *
 * // User changes priority in UI - instant update!
 * const updated = reapplyPriority(results, ['exif', 'filename', 'audio']);
 * // No file I/O! Just re-sorts existing results (~0ms for 1000 files)
 * @example
 * // Check if results can be re-prioritized first
 * if (canReapplyPriority(results)) {
 *   const updated = reapplyPriority(results, newPriority);
 * } else {
 *   console.warn('Results missing "all" sources - must re-extract');
 * }
 */
export function reapplyPriority(batchResults, newPriority) {
  if (!Array.isArray(batchResults)) {
    throw new TypeError('batchResults must be an array');
  }

  if (!Array.isArray(newPriority) || newPriority.length === 0) {
    throw new TypeError('newPriority must be a non-empty array');
  }

  return batchResults.map(item => {
    const { filepath, result } = item;

    // No result or no 'all' sources - can't reapply
    if (!result || !result.all) {
      return item;
    }

    // Re-sort sources by new priority
    const sorted = [...result.all].sort((a, b) => {
      const aIdx = newPriority.indexOf(a.source);
      const bIdx = newPriority.indexOf(b.source);

      // Sources not in priority list go last
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;

      return aIdx - bIdx;
    });

    return {
      filepath,
      result: {
        primary: sorted[0],
        all: sorted
      }
    };
  });
}

/**
 * Check if batch results can be re-prioritized (have 'all' sources)
 *
 * Validates that results have the required structure for reapplyPriority()
 * to work. Results must have been extracted with `includeAll: true`.
 * @param {Array} batchResults - Results to check
 * @returns {boolean} True if reapplyPriority() will work
 * @example
 * if (canReapplyPriority(results)) {
 *   // Safe to call reapplyPriority
 *   const updated = reapplyPriority(results, newPriority);
 * } else {
 *   // Need to re-extract with includeAll: true
 *   console.log('Cannot reapply - missing source data');
 * }
 */
export function canReapplyPriority(batchResults) {
  if (!Array.isArray(batchResults) || batchResults.length === 0) {
    return false;
  }

  // Check if at least one result has the 'all' sources
  return batchResults.some(item => item.result && item.result.all);
}

/**
 * Clear metadata cache
 *
 * Useful for testing, memory management, or forcing re-extraction.
 * Returns statistics about the cache before clearing.
 * @param {string} [filepath] - Optional: clear only this file (all versions)
 * @returns {object} Cache statistics before clearing
 * @example
 * // Clear entire cache
 * const stats = clearMetadataCache();
 * console.log(`Cleared ${stats.size} cached entries`);
 * console.log(`Cache had ${stats.hitRate * 100}% hit rate`);
 * @example
 * // Clear specific file only
 * clearMetadataCache('/path/to/photo.jpg');
 */
export function clearMetadataCache(filepath = null) {
  const stats = globalMetadataCache.getStats();
  globalMetadataCache.clear(filepath);
  return stats;
}

/**
 * Get metadata cache statistics
 *
 * Returns current cache performance metrics. Useful for monitoring
 * and optimization.
 * @returns {object} Cache statistics
 * @returns {number} return.hits - Number of cache hits
 * @returns {number} return.misses - Number of cache misses
 * @returns {number} return.size - Current number of cached entries
 * @returns {number} return.hitRate - Cache hit rate (0-1)
 * @example
 * const stats = getMetadataCacheStats();
 * console.log(`Cache size: ${stats.size} entries`);
 * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
 * console.log(`${stats.hits} hits, ${stats.misses} misses`);
 */
export function getMetadataCacheStats() {
  return globalMetadataCache.getStats();
}
