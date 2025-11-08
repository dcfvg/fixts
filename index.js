// Main entry point for programmatic usage
export { formatDate, extractAndFormat, generateNewName } from './src/core/formatter.js';
export { rename } from './src/core/renamer.js';

// Timestamp parsing (heuristic)
export {
  parseTimestamp,
  parseTimestampFromFilename,
  parseTimestampFromName,
  getDetectionInfo,
} from './src/utils/timestampParser.js';

// Low-level heuristic detection (with confidence scores)
export {
  getBestTimestamp,
  detectTimestampHeuristic,
  formatTimestamp,
  timestampToDate,
} from './src/utils/heuristicDetector.js';

// File metadata extraction (EXIF, audio tags)
export {
  parseTimestampFromEXIF,
  parseTimestampFromAudio,
} from './src/utils/fileMetadataParser.js';

// Date utilities
export {
  parseEXIFDateTime,
} from './src/utils/dateUtils.js';

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
  reapplyPriority,
  canReapplyPriority,
  clearMetadataCache,
  getMetadataCacheStats,
  SOURCE_TYPE,
  DEFAULT_PRIORITY,
} from './src/utils/unifiedMetadataExtractor.js';
