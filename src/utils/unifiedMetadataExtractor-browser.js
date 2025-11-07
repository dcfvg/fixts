/**
 * Unified Metadata Extractor (Browser-Safe)
 *
 * Provides a single, consistent interface for extracting timestamps from multiple sources:
 * - Filename patterns
 * - EXIF data (photos) - requires File API
 * - Audio metadata (MP3, M4A, etc.) - requires File API
 *
 * Note: File system metadata (mtime, birthtime) not available in browser
 *
 * @module unifiedMetadataExtractor-browser
 */

import { parseTimestamp } from './timestampParser.js';
import { parseTimestampFromEXIF, parseTimestampFromAudio } from './fileMetadataParser-browser.js';
import { getBasename, getExtension } from './path-utils.js';

/**
 * Timestamp source types (browser-safe subset)
 */
export const SOURCE_TYPE = {
  FILENAME: 'filename',
  EXIF: 'exif',
  AUDIO: 'audio',
  CUSTOM: 'custom'
};

/**
 * Default source priority (browser-safe)
 */
export const DEFAULT_PRIORITY = [
  SOURCE_TYPE.FILENAME,
  SOURCE_TYPE.EXIF,
  SOURCE_TYPE.AUDIO
];

/**
 * Extract timestamp from any available source (browser-safe)
 *
 * @param {string|File} filepath - Filename string or File object
 * @param {Object} options - Extraction options
 * @param {string[]} options.sources - Source priority order (default: DEFAULT_PRIORITY)
 * @param {boolean} options.includeAll - Return all sources, not just first match (default: false)
 * @param {boolean} options.includeConfidence - Include confidence scores (default: true)
 * @param {Object} options.parsingOptions - Options for filename parsing (dateFormat, allowTimeOnly, etc.)
 * @returns {Object|null} - Extraction result or null if no timestamp found
 */
export async function extractTimestamp(filepath, options = {}) {
  const {
    sources = DEFAULT_PRIORITY,
    includeAll = false,
    includeConfidence = true,
    parsingOptions = {}
  } = options;

  // Handle File objects or filename strings
  // Guard File check for Node.js/SSR compatibility
  const isFileObject = typeof File !== 'undefined' && filepath instanceof File;
  const basename = isFileObject ? filepath.name : getBasename(filepath);
  const ext = getExtension(basename).toLowerCase();

  const results = [];

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
          result = await extractFromEXIF(filepath, isFileObject);
        }
        break;

      case SOURCE_TYPE.AUDIO:
        if (isAudioFile(ext)) {
          result = await extractFromAudio(filepath, isFileObject);
        }
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
      // Skip sources that error
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
  const timestamp = parseTimestamp(basename, options);
  if (!timestamp) {
    return null;
  }

  // Get confidence from detection info
  const { parseTimestampFromName } = await import('./timestampParser.js');
  const parsed = parseTimestampFromName(basename, options);

  return {
    timestamp,
    confidence: parsed?.confidence || 0.70,
    details: {
      method: 'heuristic'
    }
  };
}

/**
 * Extract timestamp from EXIF data
 * @private
 */
async function extractFromEXIF(filepath, isFileObject) {
  if (!isFileObject) {
    // In browser, can only parse File objects
    return null;
  }

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
async function extractFromAudio(filepath, isFileObject) {
  if (!isFileObject) {
    // In browser, can only parse File objects
    return null;
  }

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
 * Batch extract timestamps from multiple files/filenames
 *
 * @param {Array<string|File>} filepaths - Array of file paths or File objects
 * @param {Object} options - Extraction options (same as extractTimestamp)
 * @returns {Promise<Array>} - Array of extraction results
 */
export async function extractTimestampBatch(filepaths, options = {}) {
  const results = await Promise.all(
    filepaths.map(async (filepath) => ({
      filepath: typeof File !== 'undefined' && filepath instanceof File ? filepath.name : filepath,
      result: await extractTimestamp(filepath, options)
    }))
  );

  return results;
}

/**
 * Compare timestamps from different sources and detect discrepancies
 *
 * @param {string|File} filepath - Filename string or File object
 * @param {Object} options - Comparison options
 * @param {number} options.thresholdSeconds - Max difference before warning (default: 60)
 * @returns {Promise<Object>} - Comparison result with warnings
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
 * @param {Array<string|File>} filepaths - Array of file paths or File objects
 * @returns {Promise<Object>} - Statistics about sources used
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
 * @param {string|File} filepath - Filename string or File object
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
