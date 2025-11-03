// Main entry point for programmatic usage
export { formatDate, extractAndFormat, generateNewName } from './src/core/formatter.js';
export { rename } from './src/core/renamer.js';

// Timestamp parsing (heuristic + regex)
export {
  parseTimestamp,
  parseTimestampFromFilename,
  parseTimestampFromName,
  detectPatternInFilename,
  getDetectionInfo,
  DETECTION_METHOD,
} from './src/utils/timestampParser.js';

// File metadata extraction (EXIF, audio tags)
export {
  parseTimestampFromEXIF,
  parseTimestampFromAudio,
  parseEXIFDateTime,
} from './src/utils/fileMetadataParser.js';
