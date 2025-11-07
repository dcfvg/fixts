import { parseTimestampFromName } from '../utils/timestampParser.js';
import { applyCleaningPatterns } from '../config/cleaningPatterns.js';
import { FILE_EXTENSIONS } from '../config/constants.js';
import { applyTimeShift } from '../utils/timeShift.js';
import { getBestTimestamp } from '../utils/heuristicDetector.js';

/**
 * Format a date according to the given template, only including defined components
 * @param {Date} date - The date to format
 * @param {string} template - Format template (e.g., "yyyy-mm-dd hh.MM.ss")
 * @param {Object} definedComponents - Which components are defined in the original
 * @returns {string} - Formatted date string
 */
export function formatDate(date, template = 'yyyy-mm-dd hh.MM.ss', definedComponents = {}) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }

  const pad = (num, size = 2) => String(num).padStart(size, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  let formatted = template;

  // Replace placeholders - order matters! Replace longer patterns first
  formatted = formatted.replace(/yyyy/g, String(year));
  formatted = formatted.replace(/MM/g, minutes); // Minutes BEFORE mm (months)
  formatted = formatted.replace(/mm/g, month);
  formatted = formatted.replace(/dd/g, day);
  formatted = formatted.replace(/hh/g, hours);
  formatted = formatted.replace(/ss/g, seconds);
  formatted = formatted.replace(/yy/g, String(year).slice(-2)); // After yyyy

  // Remove parts that weren't in the original filename
  // This keeps only the precision level of the original
  if (!definedComponents.hasTime) {
    // Remove time portion
    formatted = formatted.split(' ')[0] || formatted.split('_')[0] || formatted;
  }

  if (!definedComponents.hasDay && !definedComponents.hasTime) {
    // Remove day portion, keep only year-month
    const parts = formatted.split('-');
    if (parts.length >= 2) {
      formatted = `${parts[0]}-${parts[1]}`;
    }
  }

  if (!definedComponents.hasMonth && !definedComponents.hasDay && !definedComponents.hasTime) {
    // Keep only year
    const parts = formatted.split('-');
    formatted = parts[0];
  }

  return formatted;
}

/**
 * Extract timestamp from filename and format it
 * @param {string} filename - Original filename
 * @param {string} template - Format template
 * @param {Object} options - Parsing options (e.g., { dateFormat: 'dmy', timeShiftMs: number })
 * @returns {Object|null} - { timestamp: Date, formatted: string, definedComponents: Object } or null
 */
export function extractAndFormat(filename, template = 'yyyy-mm-dd hh.MM.ss', options = {}) {
  const timestamp = parseTimestampFromName(filename, options);

  if (!timestamp) {
    return null;
  }

  // Apply time shift if provided
  const adjustedTimestamp = options.timeShiftMs
    ? applyTimeShift(timestamp, options.timeShiftMs)
    : timestamp;

  // Detect which components are defined in the original filename
  const definedComponents = detectDefinedComponents(filename);

  const formatted = formatDate(adjustedTimestamp, template, definedComponents);

  return {
    timestamp: adjustedTimestamp,
    formatted,
    definedComponents,
  };
}

/**
 * Detect which date/time components are defined in the filename
 * Uses the actual heuristic detector to determine precision instead of regex patterns
 * @param {string} filename - Filename to analyze
 * @returns {Object} - Object indicating which components are present
 */
function detectDefinedComponents(filename) {
  // Use the actual heuristic detector to get accurate component information
  const detected = getBestTimestamp(filename);

  if (!detected) {
    // No timestamp detected, return minimal components
    return {
      hasTime: false,
      hasDay: false,
      hasMonth: false,
      hasYear: false,
    };
  }

  // Determine which components are present based on detection precision
  const precision = detected.precision;
  const hasTime = ['hour', 'minute', 'second', 'millisecond'].includes(precision);
  const hasDay = ['day', 'hour', 'minute', 'second', 'millisecond'].includes(precision);
  const hasMonth = precision !== 'year'; // All precisions except 'year' include month

  return {
    hasTime,
    hasDay,
    hasMonth,
    hasYear: true, // Always true if we detected a timestamp
  };
}

/**
 * Extract file extension from filename
 * @param {string} filename - Filename to process
 * @returns {Object} - { nameWithoutExt: string, extension: string }
 */
function splitExtension(filename) {
  const extensionMatch = filename.match(FILE_EXTENSIONS.PATTERN);
  const extension = extensionMatch ? extensionMatch[1] : '';
  const nameWithoutExt = extension
    ? filename.replace(new RegExp(extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '')
    : filename;

  return { nameWithoutExt, extension };
}

/**
 * Remove timestamp patterns from filename while preserving semantic content
 * Uses heuristic detection to identify and remove timestamps
 * @param {string} filename - Filename without extension
 * @returns {string} - Cleaned filename
 */
function removeTimestampPatterns(filename) {
  let cleaned = filename;

  // Use heuristic detection to find the timestamp
  const timestampInfo = getBestTimestamp(filename);
  if (timestampInfo && timestampInfo.start !== undefined && timestampInfo.end !== undefined) {
    // Remove the detected timestamp substring
    const before = filename.slice(0, timestampInfo.start);
    const after = filename.slice(timestampInfo.end);
    cleaned = (before + after).replace(/^[-_\s]+|[-_\s]+$/g, '').trim();

    // If the entire filename was just the timestamp, return empty
    if (cleaned.length === 0) {
      return '';
    }

    return cleaned;
  }

  // No timestamp detected
  return cleaned;
}

/**
 * Build the final filename with formatted date and cleaned name
 * @param {string} formattedDate - Formatted date string
 * @param {string} cleanedName - Cleaned filename (without timestamp)
 * @param {string} extension - File extension
 * @returns {string} - Final filename
 */
function buildFinalName(formattedDate, cleanedName, extension) {
  const trimmed = cleanedName.trim();

  if (trimmed) {
    return `${formattedDate} - ${trimmed}${extension}`;
  }

  return `${formattedDate}${extension}`;
}

/**
 * Generate new filename with formatted timestamp
 * @param {string} originalName - Original filename or folder name
 * @param {string} template - Format template
 * @param {Object} options - Parsing options (e.g., { dateFormat: 'dmy' or 'mdy' })
 * @returns {string|null} - New name or null if no timestamp found
 */
export function generateNewName(originalName, template = 'yyyy-mm-dd hh.MM.ss', options = {}) {
  // Step 1: Extract and format the timestamp
  const result = extractAndFormat(originalName, template, options);
  if (!result) {
    return null;
  }

  // Step 2: Separate extension
  const { nameWithoutExt, extension } = splitExtension(originalName);

  // Step 3: Remove timestamp patterns
  const withoutTimestamp = removeTimestampPatterns(nameWithoutExt);

  // Step 4: Apply general cleaning patterns
  const cleaned = applyCleaningPatterns(withoutTimestamp);

  // Step 5: Build final name
  return buildFinalName(result.formatted, cleaned, extension);
}
