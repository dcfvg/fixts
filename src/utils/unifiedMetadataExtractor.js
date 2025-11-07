/**
 * Unified Metadata Extractor
 *
 * Provides a single, consistent interface for extracting timestamps from multiple sources:
 * - Filename patterns
 * - EXIF data (photos)
 * - Audio metadata (MP3, M4A, etc.)
 * - File system metadata (mtime, birthtime)
 *
 * @module unifiedMetadataExtractor
 */

import { parseTimestampFromEXIF, parseTimestampFromAudio } from './fileMetadataParser.js';
import { getBasename, getExtension } from './path-utils.js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Timestamp source types
 */
export const SOURCE_TYPE = {
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
export const DEFAULT_PRIORITY = [
  SOURCE_TYPE.FILENAME,
  SOURCE_TYPE.EXIF,
  SOURCE_TYPE.AUDIO,
  SOURCE_TYPE.BIRTHTIME,
  SOURCE_TYPE.MTIME
];

/**
 * Extract timestamp from any available source
 *
 * @param {string} filepath - Full path to file
 * @param {Object} options - Extraction options
 * @param {string[]} options.sources - Source priority order (default: DEFAULT_PRIORITY)
 * @param {boolean} options.includeAll - Return all sources, not just first match (default: false)
 * @param {boolean} options.includeConfidence - Include confidence scores (default: true)
 * @param {Object} options.parsingOptions - Options for filename parsing (dateFormat, allowTimeOnly, etc.)
 * @returns {Object|null} - Extraction result or null if no timestamp found
 *
 * @example
 * const result = await extractTimestamp('photo.jpg');
 * // {
 * //   timestamp: Date,
 * //   source: 'exif',
 * //   confidence: 0.95,
 * //   details: { ... }
 * // }
 *
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
 */
export async function extractTimestamp(filepath, options = {}) {
  const {
    sources = DEFAULT_PRIORITY,
    includeAll = false,
    includeConfidence = true,
    parsingOptions = {}
  } = options;

  // Normalize path (handle file:// URLs)
  const normalizedPath = filepath.startsWith('file://')
    ? fileURLToPath(filepath)
    : filepath;

  const results = [];
  const basename = getBasename(normalizedPath);
  const ext = getExtension(normalizedPath).toLowerCase();

  // Try each source in priority order
  for (const source of sources) {
    let result = null;

    try {
      switch (source) {
      case SOURCE_TYPE.FILENAME:
        result = await extractFromFilename(basename, parsingOptions);
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

  if (includeAll) {
    return {
      primary: results[0],
      all: results
    };
  }

  return results[0];
}

/**
 * Extract timestamp from filename
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
 * @private
 */
function isImageFile(ext) {
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tif', '.tiff', '.webp', '.heic', '.heif'];
  return imageExts.includes(ext);
}

/**
 * Check if file extension is an audio format
 * @private
 */
function isAudioFile(ext) {
  const audioExts = ['.mp3', '.m4a', '.ogg', '.flac', '.wav', '.aiff', '.aif'];
  return audioExts.includes(ext);
}

/**
 * Batch extract timestamps from multiple files
 *
 * @param {string[]} filepaths - Array of file paths
 * @param {Object} options - Extraction options (same as extractTimestamp)
 * @returns {Promise<Array>} - Array of extraction results
 *
 * @example
 * const results = await extractTimestampBatch(['photo1.jpg', 'photo2.jpg']);
 * results.forEach(r => {
 *   console.log(`${r.filepath}: ${r.result?.source} - ${r.result?.timestamp}`);
 * });
 */
export async function extractTimestampBatch(filepaths, options = {}) {
  const results = await Promise.all(
    filepaths.map(async (filepath) => ({
      filepath,
      result: await extractTimestamp(filepath, options)
    }))
  );

  return results;
}

/**
 * Compare timestamps from different sources and detect discrepancies
 *
 * @param {string} filepath - Full path to file
 * @param {Object} options - Comparison options
 * @param {number} options.thresholdSeconds - Max difference before warning (default: 60)
 * @returns {Promise<Object>} - Comparison result with warnings
 *
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
 *
 * @param {string[]} filepaths - Array of file paths
 * @returns {Promise<Object>} - Statistics about sources used
 *
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
 *
 * @param {string} filepath - Full path to file
 * @returns {Promise<Object>} - Suggestion with reasoning
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
