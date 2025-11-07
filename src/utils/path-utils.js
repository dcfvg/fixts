/* Browser-safe module ✓ */
/**
 * @module path-utils
 * @browserSafe true
 * @description Pure JavaScript Path Utilities
 * Browser-safe alternatives to Node.js 'path' module
 *
 * These utilities work in any JavaScript environment (Node.js, browsers, Deno, Bun)
 * without requiring platform-specific modules.
 */

/**
 * Get the base name from a file path
 * Works with both forward slashes (/) and backslashes (\)
 *
 * @param {string} filepath - File path
 * @returns {string} - Base name (filename with extension)
 * @example
 *   getBasename('/path/to/file.txt') // 'file.txt'
 *   getBasename('C:\\Users\\file.txt') // 'file.txt'
 */
export function getBasename(filepath) {
  if (!filepath || typeof filepath !== 'string') {
    return '';
  }
  return filepath.split(/[/\\]/).pop() || '';
}

/**
 * Get the directory name from a file path
 *
 * @param {string} filepath - File path
 * @returns {string} - Directory path
 * @example
 *   getDirname('/path/to/file.txt') // '/path/to'
 *   getDirname('C:\\Users\\file.txt') // 'C:\\Users'
 */
export function getDirname(filepath) {
  if (!filepath || typeof filepath !== 'string') {
    return '.';
  }
  const parts = filepath.split(/[/\\]/);
  parts.pop();
  return parts.join('/') || '.';
}

/**
 * Get the file extension from a filename
 *
 * @param {string} filename - File name
 * @returns {string} - Extension including the dot, or empty string
 * @example
 *   getExtension('file.txt') // '.txt'
 *   getExtension('archive.tar.gz') // '.gz'
 *   getExtension('noext') // ''
 */
export function getExtension(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  const lastDot = filename.lastIndexOf('.');
  const lastSlash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));

  // Only return extension if dot is after last slash and not the first character
  if (lastDot > lastSlash && lastDot > 0) {
    return filename.slice(lastDot);
  }
  return '';
}

/**
 * Get filename without extension
 *
 * @param {string} filename - File name
 * @returns {string} - Filename without extension
 * @example
 *   getNameWithoutExt('file.txt') // 'file'
 *   getNameWithoutExt('archive.tar.gz') // 'archive.tar'
 */
export function getNameWithoutExt(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  const ext = getExtension(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

/**
 * Join path segments
 *
 * @param {...string} parts - Path segments to join
 * @returns {string} - Joined path
 * @example
 *   joinPaths('path', 'to', 'file.txt') // 'path/to/file.txt'
 *   joinPaths('/root', 'subdir', 'file') // '/root/subdir/file'
 */
export function joinPaths(...parts) {
  if (!parts || parts.length === 0) {
    return '';
  }

  // Filter out empty strings and join with forward slash
  return parts
    .filter(p => p && typeof p === 'string')
    .join('/')
    .replace(/\/+/g, '/') // Replace multiple slashes with single
    .replace(/\/$/, ''); // Remove trailing slash
}

/**
 * Normalize path separators to forward slashes
 *
 * @param {string} filepath - File path
 * @returns {string} - Normalized path
 * @example
 *   normalizePath('C:\\Users\\file.txt') // 'C:/Users/file.txt'
 */
export function normalizePath(filepath) {
  if (!filepath || typeof filepath !== 'string') {
    return '';
  }
  return filepath.replace(/\\/g, '/');
}

/**
 * Check if path is absolute
 *
 * @param {string} filepath - File path
 * @returns {boolean} - True if absolute path
 * @example
 *   isAbsolute('/path/to/file') // true
 *   isAbsolute('C:\\Users\\file') // true
 *   isAbsolute('relative/path') // false
 */
export function isAbsolute(filepath) {
  if (!filepath || typeof filepath !== 'string') {
    return false;
  }
  // Unix absolute path starts with /
  // Windows absolute path starts with drive letter (C:) or UNC (\\)
  return /^([a-zA-Z]:)?[/\\]/.test(filepath);
}

/**
 * Get relative path from one path to another
 * Simple implementation that works for basic cases
 *
 * @param {string} from - From path
 * @param {string} to - To path
 * @returns {string} - Relative path
 */
export function getRelativePath(from, to) {
  if (!from || !to) {
    return to || '';
  }

  const fromParts = normalizePath(from).split('/').filter(Boolean);
  const toParts = normalizePath(to).split('/').filter(Boolean);

  // Find common prefix
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++;
  }

  // Build relative path
  const upCount = fromParts.length - i;
  const upPath = '../'.repeat(upCount);
  const downPath = toParts.slice(i).join('/');

  return upPath + downPath || '.';
}

/**
 * Split path into directory and basename
 *
 * @param {string} filepath - File path
 * @returns {{dir: string, base: string}} - Directory and basename
 * @example
 *   splitPath('/path/to/file.txt') // { dir: '/path/to', base: 'file.txt' }
 */
export function splitPath(filepath) {
  return {
    dir: getDirname(filepath),
    base: getBasename(filepath)
  };
}

/**
 * Split basename into name and extension
 *
 * @param {string} filename - File name
 * @returns {{name: string, ext: string}} - Name and extension
 * @example
 *   splitBasename('file.txt') // { name: 'file', ext: '.txt' }
 */
export function splitBasename(filename) {
  return {
    name: getNameWithoutExt(filename),
    ext: getExtension(filename)
  };
}
