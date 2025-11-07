/* Browser-safe module ✓ */
/**
 * Browser-safe metadata parser - ONLY handles File API
 * No Node.js dependencies (no node:fs, no music-metadata parseFile)
 *
 * This module is safe to bundle with Vite/Webpack for browser usage.
 * For Node.js usage, import from fileMetadataParser.js instead.
 *
 * @module fileMetadataParser-browser
 * @browserSafe true
 */

import ExifReader from 'exifreader';
import { parseBlob } from 'music-metadata-browser';
import { extractDateFromEXIFTags, extractDateFromAudioMetadata } from './metadataParsers-core.js';
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

    // Use core logic to extract date
    return extractDateFromEXIFTags(tags);
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

    // Use core logic to extract date
    return extractDateFromAudioMetadata(metadata);
  } catch (error) {
    logger.debug('Audio metadata parsing failed (browser):', error.message);
    return null;
  }
}
