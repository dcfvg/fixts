/**
 * Input validation utilities
 * Provides clear, user-friendly error messages for invalid inputs
 */

import { existsSync, statSync } from 'fs';
import { Result } from './result.js';
import { FILE_LIMITS } from '../config/constants.js';

/**
 * Validation error class with context
 */
export class ValidationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ValidationError';
    this.context = context;
  }
}

/**
 * Validate a file system path
 * @param {string} path - Path to validate
 * @returns {Result} - Result.ok(path) or Result.err(ValidationError)
 */
export function validatePath(path) {
  if (!path) {
    return Result.err(new ValidationError(
      'Path is required',
      { field: 'path', value: path }
    ));
  }

  if (typeof path !== 'string') {
    return Result.err(new ValidationError(
      'Path must be a string',
      { field: 'path', value: path, type: typeof path }
    ));
  }

  if (path.trim().length === 0) {
    return Result.err(new ValidationError(
      'Path cannot be empty',
      { field: 'path', value: path }
    ));
  }

  if (path.length > FILE_LIMITS.MAX_PATH_LENGTH) {
    return Result.err(new ValidationError(
      `Path too long (max ${FILE_LIMITS.MAX_PATH_LENGTH} characters)`,
      { field: 'path', length: path.length, max: FILE_LIMITS.MAX_PATH_LENGTH }
    ));
  }

  if (!existsSync(path)) {
    return Result.err(new ValidationError(
      'Path does not exist',
      { field: 'path', value: path }
    ));
  }

  return Result.ok(path);
}

/**
 * Validate a filename
 * @param {string} filename - Filename to validate
 * @returns {Result} - Result.ok(filename) or Result.err(ValidationError)
 */
export function validateFilename(filename) {
  if (!filename) {
    return Result.err(new ValidationError(
      'Filename is required',
      { field: 'filename', value: filename }
    ));
  }

  if (typeof filename !== 'string') {
    return Result.err(new ValidationError(
      'Filename must be a string',
      { field: 'filename', value: filename, type: typeof filename }
    ));
  }

  if (filename.trim().length === 0) {
    return Result.err(new ValidationError(
      'Filename cannot be empty',
      { field: 'filename', value: filename }
    ));
  }

  if (filename.length > FILE_LIMITS.MAX_FILENAME_LENGTH) {
    return Result.err(new ValidationError(
      `Filename too long (max ${FILE_LIMITS.MAX_FILENAME_LENGTH} characters)`,
      { field: 'filename', length: filename.length, max: FILE_LIMITS.MAX_FILENAME_LENGTH }
    ));
  }

  // Check for invalid characters (OS-specific, but these are generally problematic)
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"|?*\x00-\x1F]/;
  if (invalidChars.test(filename)) {
    return Result.err(new ValidationError(
      'Filename contains invalid characters',
      { field: 'filename', value: filename, pattern: invalidChars.toString() }
    ));
  }

  return Result.ok(filename);
}

/**
 * Validate a date format template
 * @param {string} template - Template to validate
 * @returns {Result} - Result.ok(template) or Result.err(ValidationError)
 */
export function validateTemplate(template) {
  if (!template) {
    return Result.err(new ValidationError(
      'Template is required',
      { field: 'template', value: template }
    ));
  }

  if (typeof template !== 'string') {
    return Result.err(new ValidationError(
      'Template must be a string',
      { field: 'template', value: template, type: typeof template }
    ));
  }

  if (template.trim().length === 0) {
    return Result.err(new ValidationError(
      'Template cannot be empty',
      { field: 'template', value: template }
    ));
  }

  // Check if template contains valid placeholders
  const validPlaceholders = ['yyyy', 'yy', 'mm', 'dd', 'hh', 'MM', 'ss'];
  const hasValidPlaceholder = validPlaceholders.some(ph => template.includes(ph));

  if (!hasValidPlaceholder) {
    return Result.err(new ValidationError(
      'Template must contain at least one valid placeholder',
      { field: 'template', value: template, validPlaceholders }
    ));
  }

  return Result.ok(template);
}

/**
 * Validate rename options
 * @param {Object} options - Options to validate
 * @returns {Result} - Result.ok(options) or Result.err(ValidationError)
 */
export function validateRenameOptions(options) {
  if (!options || typeof options !== 'object') {
    return Result.err(new ValidationError(
      'Options must be an object',
      { field: 'options', value: options, type: typeof options }
    ));
  }

  // Validate format if provided
  if (options.format !== undefined) {
    const formatResult = validateTemplate(options.format);
    if (formatResult.isErr()) {
      return formatResult;
    }
  }

  // Validate boolean options
  const booleanOptions = ['dryRun', 'execute', 'copy'];
  for (const opt of booleanOptions) {
    if (options[opt] !== undefined && typeof options[opt] !== 'boolean') {
      return Result.err(new ValidationError(
        `Option '${opt}' must be a boolean`,
        { field: opt, value: options[opt], type: typeof options[opt] }
      ));
    }
  }

  // Validate dateFormat if provided
  if (options.dateFormat !== undefined) {
    if (!['dmy', 'mdy'].includes(options.dateFormat)) {
      return Result.err(new ValidationError(
        "Option 'dateFormat' must be 'dmy' or 'mdy'",
        { field: 'dateFormat', value: options.dateFormat, valid: ['dmy', 'mdy'] }
      ));
    }
  }

  return Result.ok(options);
}

/**
 * Validate that a path is a directory
 * @param {string} path - Path to check
 * @returns {Result} - Result.ok(path) or Result.err(ValidationError)
 */
export function validateIsDirectory(path) {
  const pathResult = validatePath(path);
  if (pathResult.isErr()) {
    return pathResult;
  }

  try {
    const stats = statSync(path);
    if (!stats.isDirectory()) {
      return Result.err(new ValidationError(
        'Path is not a directory',
        { field: 'path', value: path }
      ));
    }
  } catch (error) {
    return Result.err(new ValidationError(
      `Cannot stat path: ${error.message}`,
      { field: 'path', value: path, error: error.message }
    ));
  }

  return Result.ok(path);
}

/**
 * Validate that a path is a file
 * @param {string} path - Path to check
 * @returns {Result} - Result.ok(path) or Result.err(ValidationError)
 */
export function validateIsFile(path) {
  const pathResult = validatePath(path);
  if (pathResult.isErr()) {
    return pathResult;
  }

  try {
    const stats = statSync(path);
    if (!stats.isFile()) {
      return Result.err(new ValidationError(
        'Path is not a file',
        { field: 'path', value: path }
      ));
    }
  } catch (error) {
    return Result.err(new ValidationError(
      `Cannot stat path: ${error.message}`,
      { field: 'path', value: path, error: error.message }
    ));
  }

  return Result.ok(path);
}
