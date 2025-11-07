/**
 * Extract timestamps from file metadata (EXIF, audio tags, video metadata)
 * For filename parsing, use timestampParser.js instead
 *
 * Uses ExifReader for robust, well-tested EXIF parsing across platforms
 * Uses music-metadata for robust, well-tested audio metadata parsing across platforms
 */

import ExifReader from 'exifreader';
import { parseBlob, parseFile as parseAudioFile } from 'music-metadata';
import { parseEXIFDateTime } from './dateUtils.js';
import { logger } from './logger.js';

/**
 * Extract EXIF timestamp from image file using ExifReader library
 * Reads EXIF DateTimeOriginal, DateTime, or DateTimeDigitized tags
 *
 * Priority: DateTimeOriginal > DateTimeDigitized > DateTime
 *
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

    // Priority order: DateTimeOriginal > DateTimeDigitized > DateTime
    // DateTimeOriginal = when the photo was taken (most reliable)
    // DateTimeDigitized = when the photo was digitized/scanned
    // DateTime = when the file was last modified

    const exifTags = tags.exif || {};

    // Try DateTimeOriginal first (0x9003)
    if (exifTags.DateTimeOriginal && exifTags.DateTimeOriginal.description) {
      const date = parseEXIFDateTime(exifTags.DateTimeOriginal.description);
      if (date) return date;
    }

    // Try DateTimeDigitized (0x9004)
    if (exifTags.DateTimeDigitized && exifTags.DateTimeDigitized.description) {
      const date = parseEXIFDateTime(exifTags.DateTimeDigitized.description);
      if (date) return date;
    }

    // Try DateTime (0x0132)
    if (exifTags.DateTime && exifTags.DateTime.description) {
      const date = parseEXIFDateTime(exifTags.DateTime.description);
      if (date) return date;
    }

    // Fallback: try non-expanded tags
    if (tags.DateTimeOriginal && tags.DateTimeOriginal.description) {
      const date = parseEXIFDateTime(tags.DateTimeOriginal.description);
      if (date) return date;
    }

    if (tags.DateTime && tags.DateTime.description) {
      const date = parseEXIFDateTime(tags.DateTime.description);
      if (date) return date;
    }

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
 *
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

    // Priority 1: Recording date from tags (most reliable)
    // common.date format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS'
    if (metadata.common.date) {
      const date = new Date(metadata.common.date);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Priority 2: File creation time (when recorded/encoded)
    if (metadata.format.creationTime) {
      return metadata.format.creationTime;
    }

    // Priority 3: Modification time (last updated)
    if (metadata.format.modificationTime) {
      return metadata.format.modificationTime;
    }

    // Priority 4: Parse from year tag if available
    if (metadata.common.year) {
      // Return Jan 1 of that year as fallback
      return new Date(metadata.common.year, 0, 1);
    }

  } catch (error) {
    // music-metadata throws for non-audio files, which is expected
    logger.debug('No audio metadata found:', { error: error.message });
  }

  return null;
}

const api = {
  parseTimestampFromEXIF,
  parseTimestampFromAudio,
  parseEXIFDateTime, // re-exported from dateUtils
};

export {
  parseTimestampFromEXIF,
  parseTimestampFromAudio,
  parseEXIFDateTime, // re-exported from dateUtils
};

export default api;
