/**
 * Browser-safe metadata parser - ONLY handles File API
 * No Node.js dependencies (no node:fs, no music-metadata parseFile)
 *
 * This module is safe to bundle with Vite/Webpack for browser usage.
 * For Node.js usage, import from fileMetadataParser.js instead.
 */

import ExifReader from 'exifreader';
import { parseBlob } from 'music-metadata-browser';
import { parseEXIFDateTime } from './dateUtils.js';
import { logger } from './logger.js';

/**
 * Extract EXIF timestamp from image File object (browser only)
 * @param {File} file - Image File object from browser File API
 * @returns {Promise<Date|null>} - Promise resolving to Date or null
 */
export async function parseTimestampFromEXIF(file) {
  if (!file || typeof File === 'undefined' || !(file instanceof File)) {
    return null;
  }

  try {
    // Only process image files
    if (!file.type.startsWith('image/')) {
      return null;
    }

    const arrayBuffer = await file.arrayBuffer();
    const tags = ExifReader.load(arrayBuffer, { expanded: true });

    // Priority order: DateTimeOriginal > DateTimeDigitized > DateTime
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

    return null;
  } catch (error) {
    logger.debug('EXIF parsing failed (browser):', error.message);
    return null;
  }
}

/**
 * Extract timestamp from audio File object metadata (browser only)
 * @param {File} file - Audio File object from browser File API
 * @returns {Promise<Date|null>} - Promise resolving to Date or null
 */
export async function parseTimestampFromAudio(file) {
  if (!file || typeof File === 'undefined' || !(file instanceof File)) {
    return null;
  }

  try {
    // Only process audio files
    if (!file.type.startsWith('audio/')) {
      return null;
    }

    const metadata = await parseBlob(file);

    // Priority 1: Recording date from tags
    if (metadata.common.date) {
      const date = new Date(metadata.common.date);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Priority 2: File creation time
    if (metadata.format.creationTime) {
      return metadata.format.creationTime;
    }

    // Priority 3: Modification time
    if (metadata.format.modificationTime) {
      return metadata.format.modificationTime;
    }

    // Priority 4: Parse from year tag
    if (metadata.common.year) {
      return new Date(metadata.common.year, 0, 1);
    }

    return null;
  } catch (error) {
    logger.debug('Audio metadata parsing failed (browser):', error.message);
    return null;
  }
}
