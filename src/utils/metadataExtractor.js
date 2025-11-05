import { statSync, openSync, readSync, closeSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { formatDate } from '../core/formatter.js';
import { applyTimeShift } from './timeShift.js';
import {
  parseEXIFSegment,
  parseID3v2Timestamp,
  parseM4ATimestamp,
  parseOGGTimestamp,
  parseWAVTimestamp,
  parseAIFFTimestamp,
} from './metadataParsers.js';

/**
 * NOTE: This file is intentionally Node.js-specific for CLI usage.
 * It handles filesystem I/O and external tool integration (exiftool, mdls).
 *
 * Phase 3 architecture: The pure parsing logic (parseEXIFSegment, parseID3v2Timestamp, etc.)
 * is separated in metadataParsers.js and can be used in browser environments.
 *
 * For webapp usage: Use metadataParsers.js directly with File API / ArrayBuffer.
 * See fixts-webapp/src/lib/exif.ts for browser implementation example.
 */

const execAsync = promisify(exec);

// Cache for external tool availability (checked once per session)
let toolAvailability = null;

/**
 * Check which external metadata tools are available
 * @returns {Promise<Object>} - Object with { exiftool: boolean, mdls: boolean }
 */
async function checkToolAvailability() {
  if (toolAvailability !== null) {
    return toolAvailability;
  }

  const tools = {
    exiftool: false,
    mdls: false,
  };

  // Check exiftool
  try {
    await execAsync('exiftool -ver 2>/dev/null');
    tools.exiftool = true;
  } catch {
    // exiftool not available
  }

  // Check mdls (macOS only)
  if (process.platform === 'darwin') {
    try {
      await execAsync('which mdls 2>/dev/null');
      tools.mdls = true;
    } catch {
      // mdls not available
    }
  }

  toolAvailability = tools;
  return tools;
}

/**
 * Select the best date from available sources based on preference
 * @param {Array<Object>} dates - Array of date objects with {source, date, timestamp}
 * @param {string} preferredSource - Metadata source preference:
 *   - 'content': Embedded metadata from file content ONLY (EXIF for images, ID3 for audio, etc.) - NO fallback
 *   - 'birthtime': File creation time only - NO fallback
 *   - 'earliest': Earliest date found (embedded metadata OR creation time) - WITH fallback
 * @returns {Object|null} - Selected date object or null
 */
function selectDateByPreference(dates, preferredSource = 'content') {
  if (!dates || dates.length === 0) {
    return null;
  }

  switch (preferredSource) {
  case 'birthtime':
    // Strict: creation time only, no fallback
    return dates.find(d => d.source === 'creation time') || null;
  case 'content':
    // Strict: embedded metadata from file content only (EXIF/ID3/etc.), no fallback to filesystem timestamps
    return dates.find(d => !d.source.includes('time')) || null;
  case 'earliest':
  default:
    // Permissive: sort by timestamp and return earliest (includes both embedded metadata and creation time)
    return [...dates].sort((a, b) => a.timestamp - b.timestamp)[0];
  }
}

/**
 * Extract date from file metadata
 * Sources collected (when available):
 *   1. Creation time (birthtime) - filesystem timestamp
 *   2. Embedded content metadata:
 *      - Images: EXIF DateTimeOriginal (JPEG, PNG, TIFF, HEIC, RAW formats)
 *      - Audio: ID3v2 (MP3), M4A/AAC metadata, OGG/Vorbis comments, WAV RIFF, AIFF
 *
 * Note: Modification time (mtime) is NEVER collected to avoid false dates from file copies/edits
 *
 * @param {string} filePath - Path to the file
 * @param {Object} options - Extraction options
 * @param {string} [options.preferredSource='content'] - Source preference:
 *   - 'content': Embedded metadata ONLY (EXIF/ID3/etc.) - strict, no fallback
 *   - 'birthtime': Creation time only - strict, no fallback
 *   - 'earliest': Earliest date (embedded metadata OR creation time) - with fallback
 * @returns {Promise<Object|null>} - Object with { source, date, timestamp } or null
 */
export async function extractDateFromMetadata(filePath, options = {}) {
  const { preferredSource = 'content' } = options;
  const dates = [];

  try {
    const stats = statSync(filePath);

    // Get birth time (creation time) - ONLY this, NOT mtime
    if (stats.birthtime && stats.birthtime.getTime() > 0) {
      dates.push({
        source: 'creation time',
        date: stats.birthtime,
        timestamp: stats.birthtime.getTime(),
      });
    }

    // Try to extract EXIF/metadata from file content (PRIORITY)
    const contentDate = await extractContentDate(filePath);
    if (contentDate) {
      dates.push(contentDate);
    }

    // Select and return the best date based on preference
    return selectDateByPreference(dates, preferredSource);
  } catch {
    return null;
  }
}

/**
 * Read only the header portion of a file (optimized for large files)
 * @param {string} filePath - Path to the file
 * @param {number} maxBytes - Maximum bytes to read (default: 256KB for EXIF/ID3)
 * @returns {Buffer|null} - Buffer containing file header or null on error
 */
function readFileHeader(filePath, maxBytes = 256 * 1024) {
  try {
    const fd = openSync(filePath, 'r');
    const buffer = Buffer.allocUnsafe(maxBytes);
    const bytesRead = readSync(fd, buffer, 0, maxBytes, 0);
    closeSync(fd);
    return buffer.slice(0, bytesRead);
  } catch {
    return null;
  }
}

/**
 * Extract date from file content (EXIF, ID3, etc.)
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object|null>} - Object with { source, date, timestamp } or null
 */
async function extractContentDate(filePath) {
  const ext = filePath.toLowerCase().split('.').pop();

  // Try external tools first (faster and more reliable for images)
  const externalDate = await tryExternalTools(filePath, ext);
  if (externalDate) {
    return externalDate;
  }

  // Fallback to internal parsers
  try {
    // Read only the header portion (first 256KB) for metadata
    // This is much faster than reading entire large video/audio files
    const buffer = readFileHeader(filePath);
    if (!buffer) {
      return null;
    }

    const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Try image formats (JPEG EXIF)
    const imageExts = ['jpg', 'jpeg'];
    if (imageExts.includes(ext)) {
      const exifDate = parseEXIFSegment(dataView);
      if (exifDate) {
        return {
          source: 'EXIF (DateTimeOriginal)',
          date: exifDate,
          timestamp: exifDate.getTime(),
        };
      }
    }

    // Try audio formats
    const audioExts = {
      mp3: parseID3v2Timestamp,
      m4a: parseM4ATimestamp,
      aac: parseM4ATimestamp,
      ogg: parseOGGTimestamp,
      oga: parseOGGTimestamp,
      wav: parseWAVTimestamp,
      wave: parseWAVTimestamp,
      aif: parseAIFFTimestamp,
      aiff: parseAIFFTimestamp,
      aifc: parseAIFFTimestamp,
    };

    const parser = audioExts[ext];
    if (parser) {
      const audioDate = parser(dataView);
      if (audioDate) {
        return {
          source: `${ext.toUpperCase()} metadata`,
          date: audioDate,
          timestamp: audioDate.getTime(),
        };
      }
    }
  } catch {
    // Failed to read or parse file
  }

  return null;
}

/**
 * Try external tools for metadata extraction (exiftool, mdls)
 * @param {string} filePath - Path to the file
 * @param {string} ext - File extension
 * @returns {Promise<Object|null>} - Object with { source, date, timestamp } or null
 */
async function tryExternalTools(filePath, ext) {
  const imageExts = ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'heic', 'heif', 'raw', 'cr2', 'nef', 'arw'];

  if (!imageExts.includes(ext)) {
    return null;
  }

  // Check tool availability once
  const tools = await checkToolAvailability();

  // Try with exiftool if available
  if (tools.exiftool) {
    try {
      const { stdout } = await execAsync(`exiftool -DateTimeOriginal -d "%Y-%m-%d %H:%M:%S" "${filePath}" 2>/dev/null`);

      const match = stdout.match(/Date\/Time Original\s*:\s*(.+)/);
      if (match) {
        const dateStr = match[1].trim();
        const date = new Date(dateStr);

        if (!isNaN(date.getTime())) {
          return {
            source: 'EXIF (DateTimeOriginal)',
            date: date,
            timestamp: date.getTime(),
          };
        }
      }
    } catch {
      // exiftool failed
    }
  }

  // Try with mdls on macOS if available
  if (tools.mdls) {
    try {
      const { stdout } = await execAsync(`mdls -name kMDItemContentCreationDate "${filePath}" 2>/dev/null`);

      const match = stdout.match(/kMDItemContentCreationDate = (.+)/);
      if (match) {
        const dateStr = match[1].trim();
        const date = new Date(dateStr);

        if (!isNaN(date.getTime())) {
          return {
            source: 'EXIF (macOS metadata)',
            date: date,
            timestamp: date.getTime(),
          };
        }
      }
    } catch {
      // mdls failed
    }
  }

  return null;
}

/**
 * Extract dates from all files in an array
 * @param {Array<string>} filePaths - Array of file paths
 * @param {Object} options - Extraction options
 * @param {number} [options.concurrency=5] - Number of files to process in parallel
 * @param {string} [options.preferredSource='content'] - Metadata source preference:
 *   - 'content': Embedded metadata only (EXIF for images, ID3 for audio, etc.)
 *   - 'birthtime': File creation time only
 *   - 'earliest': Earliest date (embedded metadata OR creation time)
 * @param {Function} [options.onProgress] - Progress callback (current, total)
 * @returns {Promise<Map>} - Map of filePath -> metadata object (only files where date was found)
 */
export async function extractDatesFromFiles(filePaths, options = {}) {
  const { concurrency = 5, preferredSource = 'content', onProgress } = options;
  const results = new Map();

  // Process files in batches for better performance
  for (let i = 0; i < filePaths.length; i += concurrency) {
    const batch = filePaths.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        try {
          const metadata = await extractDateFromMetadata(filePath, { preferredSource });
          return { filePath, metadata };
        } catch (error) {
          // Log error but continue processing
          return { filePath, metadata: null, error };
        }
      })
    );

    // Add successful results to map
    batchResults.forEach(({ filePath, metadata }) => {
      if (metadata) {
        results.set(filePath, metadata);
      }
    });

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + concurrency, filePaths.length), filePaths.length);
    }
  }

  return results;
}

/**
 * Format metadata date to standard format
 * @param {Object} metadata - Metadata object with date
 * @param {string} format - Date format template
 * @returns {string} - Formatted date string
 */
export function formatMetadataDate(metadata, format = 'yyyy-mm-dd hh.MM.ss', timeShiftMs = null) {
  let date = metadata.date;

  // Apply time shift if provided
  if (timeShiftMs) {
    date = applyTimeShift(date, timeShiftMs);
  }

  // Reuse the existing formatDate function for consistency
  return formatDate(date, format, {
    hasYear: true,
    hasMonth: true,
    hasDay: true,
    hasTime: true,  // This flag is critical - without it, time is stripped!
    hasHours: true,
    hasMinutes: true,
    hasSeconds: true,
  });
}
