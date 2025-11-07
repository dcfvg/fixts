// Browser-friendly entry point for Fixts.
// Exposes only pure functions that do not rely on Node.js modules.
export { formatDate, extractAndFormat, generateNewName } from './src/core/formatter.js';
export {
  parseTimestamp,
  parseTimestampFromFilename,
  parseTimestampFromName,
  getDetectionInfo
} from './src/utils/timestampParser.js';

export {
  getBestTimestamp,
  formatTimestamp,
  timestampToDate
} from './src/utils/heuristicDetector.js';

export {
  createDate,
  parseDateString,
  parseEXIFDateTime
} from './src/utils/dateUtils.js';

// File metadata extraction (browser-safe - uses File API only, no Node.js deps)
export {
  parseTimestampFromEXIF,
  parseTimestampFromAudio
} from './src/utils/fileMetadataParser-browser.js';

export { applyCleaningPatterns } from './src/config/cleaningPatterns.js';

export {
  parseTimeShift,
  applyTimeShift,
  formatTimeShift,
  validateShiftedDate
} from './src/utils/timeShift.js';

export {
  getBasename,
  getDirname,
  getExtension,
  getNameWithoutExt,
  joinPaths,
  normalizePath,
  isAbsolute,
  getRelativePath,
  splitPath,
  splitBasename
} from './src/utils/path-utils.js';

// Ambiguity detection (browser-safe, no Node.js dependencies)
export { detectAmbiguity } from './src/utils/ambiguityDetector-browser.js';

export { detectPattern } from './src/utils/fileGrouper.js';

// Batch processing API (browser-safe, high-performance)
export {
  parseTimestampBatch,
  parseAndGroupByConfidence,
  getBatchStats,
  filterByTimestamp
} from './src/utils/batchProcessor.js';

// Context-aware ambiguity resolution (browser-safe)
export {
  analyzeContextualFormat,
  resolveAmbiguitiesByContext,
  getContextualParsingOptions,
  hasAmbiguousDates,
  getFormatSummary
} from './src/utils/contextualResolver.js';

// Custom pattern support (browser-safe, extensible API)
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
  PatternValidationError
} from './src/utils/customPatternManager.js';

// Unified metadata extraction (browser-safe subset)
export {
  extractTimestamp,
  extractTimestampBatch,
  compareTimestampSources,
  getSourceStatistics,
  suggestBestSource,
  SOURCE_TYPE,
  DEFAULT_PRIORITY
} from './src/utils/unifiedMetadataExtractor-browser.js';
