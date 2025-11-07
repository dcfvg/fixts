/* Browser-safe module ✓ */
/**
 * @module customPatternManager
 * @browserSafe true
 * @description Custom Pattern Manager
 *
 * Allows users to register custom timestamp patterns for their specific use cases.
 * Patterns are checked before the standard heuristic detection.
 *
 * @module customPatternManager
 */

/**
 * Registry of custom patterns
 * @private
 */
const customPatterns = [];

/**
 * Pattern validation errors
 */
export class PatternValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PatternValidationError';
  }
}

/**
 * Register a custom timestamp pattern
 *
 * @param {Object} pattern - Pattern definition
 * @param {string} pattern.name - Unique name for the pattern
 * @param {RegExp|string} pattern.regex - Regular expression to match
 * @param {Function|Object} pattern.extractor - Function or mapping to extract date components
 * @param {number} [pattern.priority=100] - Priority (lower = checked first, default: 100)
 * @param {string} [pattern.description] - Human-readable description
 * @returns {Object} - Registered pattern object
 *
 * @example
 * // Simple pattern with capture groups
 * registerPattern({
 *   name: 'project-code',
 *   regex: /PRJ(\d{4})(\d{2})(\d{2})-/,
 *   extractor: (match) => ({
 *     year: parseInt(match[1]),
 *     month: parseInt(match[2]),
 *     day: parseInt(match[3])
 *   }),
 *   description: 'Project code format: PRJ20240315-file.txt'
 * });
 *
 * @example
 * // Pattern with named capture groups
 * registerPattern({
 *   name: 'iso-underscore',
 *   regex: /(?<year>\d{4})_(?<month>\d{2})_(?<day>\d{2})/,
 *   extractor: 'named',  // Use named capture groups
 *   priority: 50
 * });
 *
 * @example
 * // Pattern with mapping object
 * registerPattern({
 *   name: 'custom-format',
 *   regex: /DATE_(\d{2})\.(\d{2})\.(\d{4})/,
 *   extractor: {
 *     day: 1,    // First capture group
 *     month: 2,  // Second capture group
 *     year: 3    // Third capture group
 *   }
 * });
 */
export function registerPattern(pattern) {
  // Validate required fields
  if (!pattern.name) {
    throw new PatternValidationError('Pattern must have a name');
  }

  if (!pattern.regex) {
    throw new PatternValidationError('Pattern must have a regex');
  }

  if (!pattern.extractor) {
    throw new PatternValidationError('Pattern must have an extractor');
  }

  // Check for duplicate names
  if (customPatterns.some(p => p.name === pattern.name)) {
    throw new PatternValidationError(`Pattern "${pattern.name}" already registered`);
  }

  // Convert string regex to RegExp
  let regex = pattern.regex;
  if (typeof regex === 'string') {
    try {
      regex = new RegExp(regex);
    } catch (error) {
      throw new PatternValidationError(`Invalid regex: ${error.message}`);
    }
  }

  // Validate regex is a RegExp
  if (!(regex instanceof RegExp)) {
    throw new PatternValidationError('Regex must be a RegExp or string');
  }

  // Build the pattern object
  const registeredPattern = {
    name: pattern.name,
    regex,
    extractor: pattern.extractor,
    priority: pattern.priority ?? 100,
    description: pattern.description || '',
    registered: new Date()
  };

  // Insert in priority order (lower priority first)
  const insertIndex = customPatterns.findIndex(p => p.priority > registeredPattern.priority);
  if (insertIndex === -1) {
    customPatterns.push(registeredPattern);
  } else {
    customPatterns.splice(insertIndex, 0, registeredPattern);
  }

  return registeredPattern;
}

/**
 * Unregister a custom pattern by name
 *
 * @param {string} name - Pattern name to unregister
 * @returns {boolean} - True if pattern was found and removed
 */
export function unregisterPattern(name) {
  const index = customPatterns.findIndex(p => p.name === name);
  if (index !== -1) {
    customPatterns.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Get all registered patterns
 *
 * @returns {Array} - Array of registered patterns (sorted by priority)
 */
export function getRegisteredPatterns() {
  return [...customPatterns];
}

/**
 * Clear all registered patterns
 */
export function clearPatterns() {
  customPatterns.length = 0;
}

/**
 * Check if a pattern is registered
 *
 * @param {string} name - Pattern name
 * @returns {boolean} - True if pattern exists
 */
export function hasPattern(name) {
  return customPatterns.some(p => p.name === name);
}

/**
 * Get a specific pattern by name
 *
 * @param {string} name - Pattern name
 * @returns {Object|null} - Pattern object or null if not found
 */
export function getPattern(name) {
  return customPatterns.find(p => p.name === name) || null;
}

/**
 * Apply custom patterns to a filename
 *
 * @param {string} filename - Filename to parse
 * @param {Object} [_options] - Parsing options (reserved for future use)
 * @returns {Object|null} - Parsed timestamp or null if no match
 */
export function applyCustomPatterns(filename, _options = {}) {
  for (const pattern of customPatterns) {
    const match = filename.match(pattern.regex);
    if (!match) continue;

    try {
      const timestamp = extractComponents(match, pattern.extractor, filename);
      if (timestamp && isValidTimestamp(timestamp)) {
        // Ensure precision is set
        if (!timestamp.precision) {
          timestamp.precision = determinePrecision(timestamp);
        }

        return {
          ...timestamp,
          type: 'CUSTOM',
          customPattern: pattern.name,
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.85  // Custom patterns get high confidence
        };
      }
    } catch {
      // Invalid extraction, try next pattern
      continue;
    }
  }

  return null;
}

/**
 * Extract date/time components from regex match
 *
 * @private
 * @param {RegExpMatchArray} match - Regex match result
 * @param {Function|Object|string} extractor - Extraction method
 * @param {string} filename - Original filename (for context)
 * @returns {Object} - Extracted timestamp components
 */
function extractComponents(match, extractor, filename) {
  if (typeof extractor === 'function') {
    // Function extractor
    return extractor(match, filename);
  } else if (extractor === 'named') {
    // Named capture groups
    if (!match.groups) {
      throw new Error('Pattern has no named capture groups');
    }
    return convertToTimestamp(match.groups);
  } else if (typeof extractor === 'object') {
    // Mapping object: { year: 1, month: 2, day: 3 }
    const components = {};
    for (const [key, index] of Object.entries(extractor)) {
      if (match[index] !== undefined) {
        components[key] = match[index];
      }
    }
    return convertToTimestamp(components);
  } else {
    throw new Error('Invalid extractor type');
  }
}

/**
 * Determine precision from timestamp components
 *
 * @private
 * @param {Object} timestamp - Timestamp object
 * @returns {string} - Precision level
 */
function determinePrecision(timestamp) {
  if (timestamp.second !== undefined) {
    return 'second';
  } else if (timestamp.minute !== undefined) {
    return 'minute';
  } else if (timestamp.hour !== undefined) {
    return 'hour';
  } else if (timestamp.day !== undefined) {
    return 'day';
  } else if (timestamp.month !== undefined) {
    return 'month';
  } else if (timestamp.year !== undefined) {
    return 'year';
  }
  return 'year'; // Default
}

/**
 * Convert extracted components to timestamp object
 *
 * @private
 * @param {Object} components - Raw extracted components
 * @returns {Object} - Normalized timestamp object
 */
function convertToTimestamp(components) {
  const timestamp = {};

  // Parse year
  if (components.year !== undefined) {
    timestamp.year = parseInt(components.year);
    // Handle 2-digit years
    if (timestamp.year < 100) {
      timestamp.year += timestamp.year < 50 ? 2000 : 1900;
    }
  }

  // Parse month
  if (components.month !== undefined) {
    timestamp.month = parseInt(components.month);
  }

  // Parse day
  if (components.day !== undefined) {
    timestamp.day = parseInt(components.day);
  }

  // Parse time components
  if (components.hour !== undefined) {
    timestamp.hour = parseInt(components.hour);
  }

  if (components.minute !== undefined) {
    timestamp.minute = parseInt(components.minute);
  }

  if (components.second !== undefined) {
    timestamp.second = parseInt(components.second);
  }

  // Determine precision
  timestamp.precision = determinePrecision(timestamp);

  return timestamp;
}

/**
 * Validate timestamp components
 *
 * @private
 * @param {Object} timestamp - Timestamp to validate
 * @returns {boolean} - True if valid
 */
function isValidTimestamp(timestamp) {
  // Must have at least year
  if (!timestamp.year) return false;

  // Validate ranges
  if (timestamp.year < 1900 || timestamp.year > 2100) return false;
  if (timestamp.month !== undefined && (timestamp.month < 1 || timestamp.month > 12)) return false;
  if (timestamp.day !== undefined && (timestamp.day < 1 || timestamp.day > 31)) return false;
  if (timestamp.hour !== undefined && (timestamp.hour < 0 || timestamp.hour > 23)) return false;
  if (timestamp.minute !== undefined && (timestamp.minute < 0 || timestamp.minute > 59)) return false;
  if (timestamp.second !== undefined && (timestamp.second < 0 || timestamp.second > 59)) return false;

  return true;
}

/**
 * Export patterns to JSON
 *
 * @returns {string} - JSON string of registered patterns
 */
export function exportPatterns() {
  const exportData = customPatterns.map(p => ({
    name: p.name,
    regex: p.regex.source,
    flags: p.regex.flags,
    extractor: typeof p.extractor === 'function'
      ? '/* Function extractor - cannot be serialized */'
      : p.extractor,
    priority: p.priority,
    description: p.description
  }));

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import patterns from JSON
 *
 * @param {string} json - JSON string of patterns
 * @returns {Array} - Array of imported pattern names
 */
export function importPatterns(json) {
  const patterns = JSON.parse(json);
  const imported = [];

  for (const p of patterns) {
    // Skip if function extractor (can't be serialized)
    if (typeof p.extractor === 'string' && p.extractor.includes('Function')) {
      continue;
    }

    try {
      const regex = new RegExp(p.regex, p.flags || '');
      registerPattern({
        name: p.name,
        regex,
        extractor: p.extractor,
        priority: p.priority,
        description: p.description
      });
      imported.push(p.name);
    } catch {
      // Skip invalid patterns
      continue;
    }
  }

  return imported;
}
