import { DATE_LIMITS } from '../config/constants.js';
import {
  isValidYear,
  isValidMonth,
  isValidDay,
  isValidHours,
  isValidMinutes,
  isValidSeconds,
  normalizeYear
} from './dateValidators.js';

/**
 * Create a date with validation
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day (1-31)
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @param {number} seconds - Seconds (0-59)
 * @param {number} milliseconds - Milliseconds (0-999)
 * @returns {Date|null} - Valid date or null
 */
export function createDate(year, month, day, hours = 0, minutes = 0, seconds = 0, milliseconds = 0) {
  // Normalize 2-digit years
  const fullYear = normalizeYear(year);

  // Validate using centralized validators
  if (!isValidYear(year, { allowTwoDigit: true })) {
    return null;
  }

  if (!isValidMonth(month)) {
    return null;
  }

  if (!isValidDay(day, month, fullYear)) {
    return null;
  }

  if (!isValidHours(hours)) {
    return null;
  }

  if (!isValidMinutes(minutes)) {
    return null;
  }

  if (!isValidSeconds(seconds)) {
    return null;
  }

  // Create the date object
  const date = new Date(fullYear, month - 1, day, hours, minutes, seconds, milliseconds);

  // Validate that the date is what we expect (catches invalid dates like Feb 31)
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Parse a date string in various formats
 * @param {string} dateStr - Date string
 * @returns {Date|null} - Parsed date or null
 */
export function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const str = dateStr.trim();

  // Try ISO 8601 format: YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS
  const isoMatch = str.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const hours = isoMatch[4] ? Number(isoMatch[4]) : 0;
    const minutes = isoMatch[5] ? Number(isoMatch[5]) : 0;
    const seconds = isoMatch[6] ? Number(isoMatch[6]) : 0;

    return createDate(year, month, day, hours, minutes, seconds);
  }

  // Try YYYY format (year only)
  const yearMatch = str.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return createDate(year, 1, 1);
  }

  // Try Date.parse as fallback
  const timestamp = Date.parse(str);
  if (!Number.isNaN(timestamp)) {
    const date = new Date(timestamp);
    if (date.getFullYear() >= DATE_LIMITS.MIN_YEAR &&
        date.getFullYear() <= DATE_LIMITS.MAX_YEAR) {
      return date;
    }
  }

  return null;
}

/**
 * Parse EXIF DateTime string (format: "YYYY:MM:DD HH:MM:SS")
 * @param {string} dateTimeStr - EXIF date/time string
 * @returns {Date|null} - Parsed date or null
 */
export function parseEXIFDateTime(dateTimeStr) {
  if (!dateTimeStr || typeof dateTimeStr !== 'string') {
    return null;
  }

  // EXIF format: "YYYY:MM:DD HH:MM:SS"
  const match = dateTimeStr.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const seconds = Number(match[6]);

  return createDate(year, month, day, hours, minutes, seconds);
}
