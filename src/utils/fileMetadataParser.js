/* Node.js-only module - uses fs and music-metadata */
/**
 * Extract timestamps from file metadata (EXIF, audio tags, video metadata)
 * For filename parsing, use timestampParser.js instead
 *
 * Uses ExifReader for robust, well-tested EXIF parsing across platforms
 * Uses music-metadata for robust, well-tested audio metadata parsing across platforms
 * @module fileMetadataParser
 * @browserSafe false
 * @description Node.js-only module for parsing file metadata (EXIF, audio tags)
 */

import ExifReader from 'exifreader';
import { parseBlob, parseFile as parseAudioFile } from 'music-metadata';
import { extractDateFromEXIFTags, extractDateFromAudioMetadata } from './metadataParsers-core.js';
import { logger } from './logger.js';

/**
 * Extract EXIF timestamp from image file using ExifReader library
 * Reads EXIF DateTimeOriginal, DateTime, or DateTimeDigitized tags
 *
 * Priority: DateTimeOriginal > DateTimeDigitized > DateTime
 * @param {string} file - Image file path (Node.js usage - string paths only)
 * @returns {Promise<Date|null>} - Promise resolving to Date or null
 *
 * Note: The File object branch exists for internal use but is not part of the
 * public Node.js API. For browser usage with File objects, use fixts/browser.
 */
async function parseTimestampFromEXIF(file) {
  if (!file) {
    return null;
  }

  try {
    let tags;

    // Handle File object (browser) or file path (Node.js)
    if (typeof file === 'string') {
      // Node.js: file path
      const fs = await import('node:fs');
      const fileBuffer = await fs.promises.readFile(file);
      tags = ExifReader.load(fileBuffer, { expanded: true });
    } else if (typeof File !== 'undefined' && file instanceof File) {
      // Browser: File object
      if (!file.type.startsWith('image/')) {
        return null;
      }
      const arrayBuffer = await file.arrayBuffer();
      tags = ExifReader.load(arrayBuffer, { expanded: true });
    } else {
      return null;
    }

    // Use core logic to extract date
    return extractDateFromEXIFTags(tags);
  } catch (error) {
    // ExifReader throws for non-EXIF files, which is expected
    logger.debug('No EXIF data found:', { error: error.message });
  }

  return null;
}

/**
 * Extract timestamp from audio file metadata using music-metadata library
 * Supports MP3, M4A, OGG, FLAC, WAV, AIFF, and many more formats
 *
 * Priority: common.date > format.creationTime > format.modificationTime > common.year
 * @param {string} file - Audio file path (Node.js usage - string paths only)
 * @returns {Promise<Date|null>} - Promise resolving to Date or null
 *
 * Note: The File object branch exists for internal use but is not part of the
 * public Node.js API. For browser usage with File objects, use fixts/browser.
 */
async function parseTimestampFromAudio(file) {
  if (!file) {
    return null;
  }

  try {
    let metadata;

    // Handle File object (browser) or file path (Node.js)
    if (typeof file === 'string') {
      // Node.js: Use parseFile (renamed to parseAudioFile to avoid conflict)
      metadata = await parseAudioFile(file);
    } else if (typeof File !== 'undefined' && file instanceof File) {
      // Browser: Use parseBlob
      // Only process audio files in browser
      if (!file.type.startsWith('audio/')) {
        return null;
      }
      metadata = await parseBlob(file);
    } else {
      return null;
    }

    // Use core logic to extract date
    return extractDateFromAudioMetadata(metadata);
  } catch (error) {
    logger.debug('Audio metadata error:', { error: error.message });
  }

  return null;
}

const api = {
  parseTimestampFromEXIF,
  parseTimestampFromAudio,
};

export {
  parseTimestampFromEXIF,
  parseTimestampFromAudio,
};

export default api;
