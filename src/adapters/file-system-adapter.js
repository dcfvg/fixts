/**
 * Abstract FileSystem Adapter Interface
 *
 * Provides an execution-context agnostic interface for file operations.
 * Implementations can be provided for Node.js, browsers, Deno, Bun, etc.
 */

/**
 * Base FileSystem Adapter
 * All methods return Promises to support async operations
 */
export class FileSystemAdapter {
  /**
   * Read directory contents
   * @param {string} _path - Directory path
   * @returns {Promise<Array<{name: string, path: string, isDirectory: boolean}>>}
   */
  async readDirectory(_path) {
    throw new Error('FileSystemAdapter.readDirectory() must be implemented');
  }

  /**
   * Read file as ArrayBuffer
   * @param {string} _path - File path
   * @returns {Promise<ArrayBuffer>}
   */
  async readFile(_path) {
    throw new Error('FileSystemAdapter.readFile() must be implemented');
  }

  /**
   * Get file stats
   * @param {string} _path - File path
   * @returns {Promise<{size: number, mtime: Date, atime: Date, birthtime: Date}>}
   */
  async stat(_path) {
    throw new Error('FileSystemAdapter.stat() must be implemented');
  }

  /**
   * Rename/move a file
   * @param {string} _oldPath - Current path
   * @param {string} _newPath - New path
   * @returns {Promise<void>}
   */
  async rename(_oldPath, _newPath) {
    throw new Error('FileSystemAdapter.rename() must be implemented');
  }

  /**
   * Check if path exists
   * @param {string} _path - Path to check
   * @returns {Promise<boolean>}
   */
  async exists(_path) {
    throw new Error('FileSystemAdapter.exists() must be implemented');
  }

  /**
   * Create directory
   * @param {string} _path - Directory path
   * @param {Object} _options - Options (recursive, etc.)
   * @returns {Promise<void>}
   */
  async mkdir(_path, _options = {}) {
    throw new Error('FileSystemAdapter.mkdir() must be implemented');
  }
}

/**
 * File metadata interface
 * @typedef {Object} FileMetadata
 * @property {string} name - File name
 * @property {string} path - Full path
 * @property {boolean} isDirectory - Whether it's a directory
 * @property {number} size - File size in bytes
 * @property {Date} mtime - Modified time
 * @property {Date} atime - Access time
 * @property {Date} birthtime - Birth time
 */

/**
 * Rename operation result
 * @typedef {Object} RenameResult
 * @property {string} oldPath - Original path
 * @property {string} newPath - New path
 * @property {boolean} success - Whether rename succeeded
 * @property {string} [error] - Error message if failed
 */
