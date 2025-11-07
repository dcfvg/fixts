// Main entry point for programmatic usage
export { formatDate, extractAndFormat, generateNewName } from './src/core/formatter.js';
export { rename } from './src/core/renamer.js';

// Timestamp parsing (heuristic + regex)
export {
  parseTimestamp,
  parseTimestampFromFilename,
  parseTimestampFromName,
  getDetectionInfo,
  DETECTION_METHOD,
} from './src/utils/timestampParser.js';

// File metadata extraction (EXIF, audio tags)
export {
  parseTimestampFromEXIF,
  parseTimestampFromAudio,
  parseEXIFDateTime,
} from './src/utils/fileMetadataParser.js';

// Batch processing API (high-performance bulk operations)
export {
  parseTimestampBatch,
  parseAndGroupByConfidence,
  getBatchStats,
  filterByTimestamp,
} from './src/utils/batchProcessor.js';

// Context-aware ambiguity resolution
export {
  analyzeContextualFormat,
  resolveAmbiguitiesByContext,
  getContextualParsingOptions,
  hasAmbiguousDates,
  getFormatSummary,
} from './src/utils/contextualResolver.js';

// Custom pattern support
export {
  registerPattern,
  unregisterPattern,
  getRegisteredPatterns,
  clearPatterns,
  hasPattern,
  getPattern,
  applyCustomPatterns,
  exportPatterns,
  importPatterns,
  PatternValidationError,
} from './src/utils/customPatternManager.js';

// Unified metadata extraction (all sources)
export {
  extractTimestamp,
  extractTimestampBatch,
  compareTimestampSources,
  getSourceStatistics,
  suggestBestSource,
  SOURCE_TYPE,
  DEFAULT_PRIORITY,
} from './src/utils/unifiedMetadataExtractor.js';
