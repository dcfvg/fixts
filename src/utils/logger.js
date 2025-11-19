/* Browser-safe module ✓ */
/**
 * @module logger
 * @browserSafe true
 * @description Centralized logging utility
 * Provides consistent logging with level control and formatting
 */

/**
 * Log levels
 */
export /**
        *
        */
const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Logger configuration
 * Browser-safe: checks for process existence before accessing
 */
const config = {
  level: (typeof process !== 'undefined' && process.env?.LOG_LEVEL) || LogLevel.INFO,
  silent: (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') || false,
  timestamp: false, // Default to false for cleaner CLI output
  cliMode: false     // Enable CLI-friendly output (no timestamps, no level prefix)
};

/**
 * Check if a log level should be output
 * @param {string} level - Log level to check
 * @returns {boolean} - True if should log
 */
function shouldLog(level) {
  if (config.silent) return false;

  const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
  const currentIndex = levels.indexOf(config.level);
  const requestedIndex = levels.indexOf(level);

  return requestedIndex <= currentIndex;
}

/**
 * Format log message
 * @param {string} level - Log level
 * @param {string} message - Message to log
 * @param {string|number|boolean|object|Error|null|undefined} context - Optional context data
 * @returns {string} - Formatted message
 */
function formatMessage(level, message, context) {
  // CLI mode: simple output without timestamps or level prefix
  if (config.cliMode) {
    if (context !== undefined) {
      return `${message} ${JSON.stringify(context, null, 2)}`;
    }
    return message;
  }

  // Standard mode: include timestamps and level
  const parts = [];

  if (config.timestamp) {
    parts.push(`[${new Date().toISOString()}]`);
  }

  parts.push(`[${level.toUpperCase()}]`);
  parts.push(message);

  if (context !== undefined) {
    parts.push(JSON.stringify(context, null, 2));
  }

  return parts.join(' ');
}

/**
 * Logger instance
 */
export /**
        *
        */
const logger = {
  /**
   * Log error message
   * @param {string} message - Error message
   * @param {string|number|boolean|object|Error|null|undefined} context - Optional context
   */
  error(message, context) {
    if (shouldLog(LogLevel.ERROR)) {
      console.error(formatMessage(LogLevel.ERROR, message, context));
    }
  },

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {string|number|boolean|object|Error|null|undefined} context - Optional context
   */
  warn(message, context) {
    if (shouldLog(LogLevel.WARN)) {
      console.warn(formatMessage(LogLevel.WARN, message, context));
    }
  },

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {string|number|boolean|object|Error|null|undefined} context - Optional context
   */
  info(message, context) {
    if (shouldLog(LogLevel.INFO)) {
      console.log(formatMessage(LogLevel.INFO, message, context));
    }
  },

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {string|number|boolean|object|Error|null|undefined} context - Optional context
   */
  debug(message, context) {
    if (shouldLog(LogLevel.DEBUG)) {
      console.log(formatMessage(LogLevel.DEBUG, message, context));
    }
  },

  /**
   * Configure logger
   * @param {object} options - Configuration options
   * @param {string} options.level - Log level
   * @param {boolean} options.silent - Silent mode
   * @param {boolean} options.timestamp - Include timestamp
   * @param {boolean} options.cliMode - Enable CLI-friendly output
   */
  configure(options) {
    Object.assign(config, options);
  },

  /**
   * Set verbosity for CLI usage
   * @param {boolean} verbose - Enable debug logging
   */
  setVerbose(verbose) {
    if (verbose) {
      config.level = LogLevel.DEBUG;
      config.cliMode = true;
    }
  },

  /**
   * Set quiet mode for CLI usage
   * @param {boolean} quiet - Suppress all output except errors
   */
  setQuiet(quiet) {
    if (quiet) {
      config.level = LogLevel.ERROR;
      config.cliMode = true;
    }
  },

  /**
   * Enable CLI mode (no timestamps, clean output)
   */
  enableCliMode() {
    config.cliMode = true;
    config.timestamp = false;
  }
};
