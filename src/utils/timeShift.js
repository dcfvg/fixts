/**
 * Time Shift Utilities
 *
 * Parse and apply time shifts to timestamps for correcting camera clock errors,
 * timezone issues, or daylight saving time problems.
 */

/**
 * Parse time shift string like "+2h30m", "-1d3h", "+45m"
 * @param {string} shiftStr - Shift string (e.g., "+2h30m", "-1d", "+45m30s")
 * @returns {number|null} - Milliseconds to add/subtract, or null if invalid
 *
 * Format: [+|-]<number><unit>...
 * Units: d=days, h=hours, m=minutes, s=seconds
 *
 * Examples:
 *   "+2h30m"  → 9000000 ms (2h 30m)
 *   "-1d3h"   → -97200000 ms (-1d -3h)
 *   "+45m"    → 2700000 ms (45m)
 *   "-30s"    → -30000 ms (-30s)
 */
export function parseTimeShift(shiftStr) {
  if (!shiftStr || typeof shiftStr !== 'string') {
    return null;
  }

  // Normalize input
  const normalized = shiftStr.trim().toLowerCase();

  // Match pattern: optional sign followed by number+unit combinations
  // Examples: +2h30m, -1d3h15m, 45m (no sign = positive)
  const regex = /^([+-]?)(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;
  const match = normalized.match(regex);

  if (!match) {
    return null;
  }

  const [, signStr, daysStr, hoursStr, minutesStr, secondsStr] = match;

  // At least one component must be present
  if (!daysStr && !hoursStr && !minutesStr && !secondsStr) {
    return null;
  }

  const sign = signStr === '-' ? -1 : 1;
  const days = parseInt(daysStr || '0', 10);
  const hours = parseInt(hoursStr || '0', 10);
  const minutes = parseInt(minutesStr || '0', 10);
  const seconds = parseInt(secondsStr || '0', 10);

  // Sanity check: limit to ±365 days to prevent typos
  const totalDays = days + (hours / 24) + (minutes / 1440) + (seconds / 86400);
  if (Math.abs(totalDays) > 365) {
    return null;
  }

  const totalMs = (
    days * 24 * 60 * 60 * 1000 +
    hours * 60 * 60 * 1000 +
    minutes * 60 * 1000 +
    seconds * 1000
  ) * sign;

  return totalMs;
}

/**
 * Apply time shift to a Date object
 * @param {Date} date - Original date
 * @param {number} shiftMs - Milliseconds to add/subtract
 * @returns {Date} - New Date with shift applied
 */
export function applyTimeShift(date, shiftMs) {
  if (!date || !(date instanceof Date) || !shiftMs) {
    return date;
  }

  return new Date(date.getTime() + shiftMs);
}

/**
 * Format shift milliseconds for human-readable display
 * @param {number} shiftMs - Milliseconds
 * @returns {string} - Human readable (e.g., "+2h 30m", "-1d 3h")
 */
export function formatTimeShift(shiftMs) {
  if (!shiftMs) return '0s';

  const sign = shiftMs >= 0 ? '+' : '-';
  const absMs = Math.abs(shiftMs);

  const days = Math.floor(absMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((absMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((absMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((absMs % (60 * 1000)) / 1000);

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);

  return sign + (parts.join(' ') || '0s');
}

/**
 * Validate that shifted date is reasonable (not too far in past/future)
 * @param {Date} shiftedDate - Date after shift applied
 * @returns {boolean} - True if date is reasonable
 */
export function validateShiftedDate(shiftedDate) {
  if (!shiftedDate || !(shiftedDate instanceof Date)) {
    return false;
  }

  const year = shiftedDate.getFullYear();

  // Allow dates between 1970 and 2100
  return year >= 1970 && year <= 2100;
}
