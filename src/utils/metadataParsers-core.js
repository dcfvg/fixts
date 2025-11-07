/* Browser-safe module ✓ */
/**
 * Core metadata parsing logic (platform-agnostic)
 *
 * This module contains shared logic for extracting dates from EXIF and audio metadata.
 * It works with parsed metadata objects (not file loading).
 *
 * Platform-specific file loading is handled by:
 * - fileMetadataParser.js (Node.js with fs.readFile)
 * - fileMetadataParser-browser.js (browser with File API)
 *
 * @module metadataParsers-core
 * @browserSafe true
 */

import { parseEXIFDateTime } from './dateUtils.js';

/**
 * Extract date from EXIF tags object
 * Priority: DateTimeOriginal > DateTimeDigitized > DateTime
 *
 * @param {Object} tags - Parsed EXIF tags object from ExifReader
 * @returns {Date|null} - Extracted date or null
 */
export function extractDateFromEXIFTags(tags) {
  if (!tags) {
    return null;
  }

  const exifTags = tags.exif || {};

  // Try DateTimeOriginal first (0x9003) - when photo was taken
  if (exifTags.DateTimeOriginal && exifTags.DateTimeOriginal.description) {
    const date = parseEXIFDateTime(exifTags.DateTimeOriginal.description);
    if (date) return date;
  }

  // Try DateTimeDigitized (0x9004) - when photo was digitized/scanned
  if (exifTags.DateTimeDigitized && exifTags.DateTimeDigitized.description) {
    const date = parseEXIFDateTime(exifTags.DateTimeDigitized.description);
    if (date) return date;
  }

  // Try DateTime (0x0132) - when file was last modified
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

  return null;
}

/**
 * Extract date from audio metadata object
 * Priority: common.date > format.creationTime > format.modificationTime > common.year
 *
 * @param {Object} metadata - Parsed audio metadata from music-metadata
 * @returns {Date|null} - Extracted date or null
 */
export function extractDateFromAudioMetadata(metadata) {
  if (!metadata) {
    return null;
  }

  // Priority 1: Recording date from tags (most reliable)
  // common.date format: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS'
  if (metadata.common && metadata.common.date) {
    const date = new Date(metadata.common.date);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Priority 2: File creation time (when recorded/encoded)
  if (metadata.format && metadata.format.creationTime) {
    return metadata.format.creationTime;
  }

  // Priority 3: Modification time (last updated)
  if (metadata.format && metadata.format.modificationTime) {
    return metadata.format.modificationTime;
  }

  // Priority 4: Parse from year tag if available
  if (metadata.common && metadata.common.year) {
    // Return Jan 1 of that year as fallback
    return new Date(metadata.common.year, 0, 1);
  }

  return null;
}
