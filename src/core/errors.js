/* Browser-safe module ✓ */
/**
 * @module errors
 * @browserSafe true
 * @description Custom error classes for the fixts library. Browser-safe as they only extend native Error class.
 */

/**
 * @class FixtsError
 * @augments Error
 * @description Base class for all fixts-specific errors.
 */
export class FixtsError extends Error {
  /**
   * Create a new FixtsError
   * @param {string} message - Error message
   */
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * @class TimestampNotFoundError
 * @augments FixtsError
 * @description Thrown when no timestamp can be found in a filename.
 */
export class TimestampNotFoundError extends FixtsError {
  /**
   * Create a TimestampNotFoundError
   * @param {string} filename - Name of the file where timestamp was not found
   */
  constructor(filename) {
    super(`No timestamp found in: ${filename}`);
    this.filename = filename;
  }
}

/**
 * @class FileAccessError
 * @augments FixtsError
 * @description Thrown when a file system operation fails.
 */
export class FileAccessError extends FixtsError {
  /**
   * @param {string} operation - The failed operation (e.g., 'read', 'write', 'rename').
   * @param {string} path - The file path involved.
   * @param {Error} originalError - The original error from the fs module.
   */
  constructor(operation, path, originalError) {
    super(`File access error during '${operation}' on path '${path}': ${originalError.message}`);
    this.operation = operation;
    this.path = path;
    this.originalError = originalError;
  }
}

/**
 * @class AmbiguityError
 * @augments FixtsError
 * @description Thrown when an ambiguous timestamp is detected and cannot be resolved.
 */
export class AmbiguityError extends FixtsError {
  /**
   * @param {string} filename - The name of the file with the ambiguous timestamp.
   * @param {object} ambiguityDetails - Details about the ambiguity.
   */
  constructor(filename, ambiguityDetails) {
    super(`Ambiguous timestamp detected in "${filename}". Cannot proceed without explicit resolution.`);
    this.filename = filename;
    this.ambiguityDetails = ambiguityDetails;
  }
}
