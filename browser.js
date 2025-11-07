// Browser-friendly entry point for Fixts.
// Exposes only pure functions that do not rely on Node.js modules.
export { formatDate, extractAndFormat, generateNewName } from './src/core/formatter.js';
export {
  parseTimestamp,
  parseTimestampFromFilename,
  parseTimestampFromName,
  getDetectionInfo,
  DETECTION_METHOD
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

// File metadata extraction (requires File API - browser File objects)
export {
  parseTimestampFromEXIF,
  parseTimestampFromAudio
} from './src/utils/fileMetadataParser.js';

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

export { detectAmbiguity } from './src/utils/ambiguityDetector.js';

export { detectPattern } from './src/utils/fileGrouper.js';
