/* Browser-safe module ✓ */
/**
 * @module dateValidators
 * @browserSafe true
 * @description Centralized date/time validation functions
 * Provides consistent validation logic across the entire codebase
 */

import { DATE_LIMITS } from '../config/constants.js';

/**
 * Check if a year is a leap year
 * @param {number} year - Year to check
 * @returns {boolean} - True if leap year
 */
export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get the number of days in a specific month
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (for leap year calculation)
 * @returns {number} - Number of days in the month
 */
export function getDaysInMonth(month, year) {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (month < 1 || month > 12) {
    return 0;
  }

  if (month === 2 && isLeapYear(year)) {
    return 29;
  }

  return daysInMonth[month - 1];
}

/**
 * Validate a year value
 * @param {number} year - Year to validate
 * @param {Object} options - Validation options
 * @param {boolean} [options.allowTwoDigit=true] - Allow 2-digit years (00-99)
 * @returns {boolean} - True if valid
 */
export function isValidYear(year, options = {}) {
  const { allowTwoDigit = true } = options;

  if (!Number.isInteger(year)) {
    return false;
  }

  // Allow 2-digit years (will be converted later)
  if (allowTwoDigit && year >= 0 && year < 100) {
    return true;
  }

  return year >= DATE_LIMITS.MIN_YEAR && year <= DATE_LIMITS.MAX_YEAR;
}

/**
 * Validate a month value
 * @param {number} month - Month to validate (1-12)
 * @returns {boolean} - True if valid
 */
export function isValidMonth(month) {
  if (!Number.isInteger(month)) {
    return false;
  }

  return month >= DATE_LIMITS.MIN_MONTH && month <= DATE_LIMITS.MAX_MONTH;
}

/**
 * Validate a day value
 * @param {number} day - Day to validate (1-31)
 * @param {number} [month] - Month for accurate validation (optional)
 * @param {number} [year] - Year for leap year calculation (optional)
 * @returns {boolean} - True if valid
 */
export function isValidDay(day, month = null, year = null) {
  if (!Number.isInteger(day)) {
    return false;
  }

  if (day < DATE_LIMITS.MIN_DAY || day > DATE_LIMITS.MAX_DAY) {
    return false;
  }

  // If month and year provided, validate against actual days in that month
  if (month !== null && year !== null) {
    const maxDays = getDaysInMonth(month, year);
    return day <= maxDays;
  }

  return true;
}

/**
 * Validate hours value
 * @param {number} hours - Hours to validate (0-23)
 * @returns {boolean} - True if valid
 */
export function isValidHours(hours) {
  if (!Number.isInteger(hours)) {
    return false;
  }

  return hours >= 0 && hours < DATE_LIMITS.HOURS_PER_DAY;
}

/**
 * Validate minutes value
 * @param {number} minutes - Minutes to validate (0-59)
 * @returns {boolean} - True if valid
 */
export function isValidMinutes(minutes) {
  if (!Number.isInteger(minutes)) {
    return false;
  }

  return minutes >= 0 && minutes < DATE_LIMITS.MINUTES_PER_HOUR;
}

/**
 * Validate seconds value
 * @param {number} seconds - Seconds to validate (0-59)
 * @returns {boolean} - True if valid
 */
export function isValidSeconds(seconds) {
  if (!Number.isInteger(seconds)) {
    return false;
  }

  return seconds >= 0 && seconds < DATE_LIMITS.SECONDS_PER_MINUTE;
}

/**
 * Validate a complete date
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day (1-31)
 * @param {Object} options - Validation options
 * @param {boolean} [options.allowTwoDigitYear=true] - Allow 2-digit years
 * @returns {boolean} - True if valid date
 */
export function isValidDate(year, month, day, options = {}) {
  if (!isValidYear(year, options)) {
    return false;
  }

  if (!isValidMonth(month)) {
    return false;
  }

  // Convert 2-digit year to 4-digit for validation
  let fullYear = year;
  if (year < 100) {
    fullYear = year < DATE_LIMITS.TWO_DIGIT_YEAR_THRESHOLD
      ? 2000 + year
      : 1900 + year;
  }

  return isValidDay(day, month, fullYear);
}

/**
 * Validate a complete date-time
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day (1-31)
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @param {number} seconds - Seconds (0-59)
 * @param {Object} options - Validation options
 * @returns {boolean} - True if valid date-time
 */
export function isValidDateTime(year, month, day, hours, minutes, seconds, options = {}) {
  if (!isValidDate(year, month, day, options)) {
    return false;
  }

  if (!isValidHours(hours)) {
    return false;
  }

  if (!isValidMinutes(minutes)) {
    return false;
  }

  if (!isValidSeconds(seconds)) {
    return false;
  }

  return true;
}

/**
 * Normalize a 2-digit year to 4-digit year
 * Uses TWO_DIGIT_YEAR_THRESHOLD: < 70 = 20xx, >= 70 = 19xx
 * @param {number} year - Year (can be 2-digit or 4-digit)
 * @returns {number} - 4-digit year
 */
export function normalizeYear(year) {
  if (year < 100) {
    return year < DATE_LIMITS.TWO_DIGIT_YEAR_THRESHOLD
      ? 2000 + year
      : 1900 + year;
  }
  return year;
}

/**
 * Check if day and month combination could be ambiguous (DD-MM vs MM-DD)
 * @param {number} first - First number
 * @param {number} second - Second number
 * @returns {boolean} - True if ambiguous
 */
export function isAmbiguousDate(first, second) {
  // Both values must be valid as both day and month
  const firstValidAsMonth = isValidMonth(first);
  const firstValidAsDay = isValidDay(first);
  const secondValidAsMonth = isValidMonth(second);
  const secondValidAsDay = isValidDay(second);

  // Ambiguous if both could be either day or month
  // e.g., 01-12 could be Jan 12 or Dec 1
  return firstValidAsMonth && firstValidAsDay &&
         secondValidAsMonth && secondValidAsDay &&
         first <= 12 && second <= 12;
}

/**
 * Batch validation object for common validation needs
 */
export const validators = {
  year: isValidYear,
  month: isValidMonth,
  day: isValidDay,
  hours: isValidHours,
  minutes: isValidMinutes,
  seconds: isValidSeconds,
  date: isValidDate,
  dateTime: isValidDateTime,
};
