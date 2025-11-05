/**
 * Node.js FileSystem Adapter
 * Implementation of FileSystemAdapter for Node.js environments
 */

import { readdirSync, readFileSync, statSync, renameSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { FileSystemAdapter } from './file-system-adapter.js';

/**
 * Node.js implementation of FileSystemAdapter
 * Uses standard Node.js fs module
 */
export class NodeFsAdapter extends FileSystemAdapter {
  /**
   * Read directory contents
   * @param {string} path - Directory path
   * @returns {Promise<Array<{name: string, path: string, isDirectory: boolean}>>}
   */
  async readDirectory(path) {
    try {
      const entries = readdirSync(path, { withFileTypes: true });
      return entries.map(entry => ({
        name: entry.name,
        path: join(path, entry.name),
        isDirectory: entry.isDirectory()
      }));
    } catch (error) {
      throw new Error(`Failed to read directory ${path}: ${error.message}`);
    }
  }

  /**
   * Read file as Buffer
   * @param {string} path - File path
   * @returns {Promise<Buffer>}
   */
  async readFile(path) {
    try {
      return readFileSync(path);
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error.message}`);
    }
  }

  /**
   * Get file stats
   * @param {string} path - File path
   * @returns {Promise<{size: number, mtime: Date, atime: Date, birthtime: Date, isDirectory: boolean, isFile: boolean}>}
   */
  async stat(path) {
    try {
      const stats = statSync(path);
      return {
        size: stats.size,
        mtime: stats.mtime,
        atime: stats.atime,
        birthtime: stats.birthtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
    } catch (error) {
      throw new Error(`Failed to stat ${path}: ${error.message}`);
    }
  }

  /**
   * Rename/move a file
   * @param {string} oldPath - Current path
   * @param {string} newPath - New path
   * @returns {Promise<void>}
   */
  async rename(oldPath, newPath) {
    try {
      renameSync(oldPath, newPath);
    } catch (error) {
      throw new Error(`Failed to rename ${oldPath} to ${newPath}: ${error.message}`);
    }
  }

  /**
   * Check if path exists
   * @param {string} path - Path to check
   * @returns {Promise<boolean>}
   */
  async exists(path) {
    return existsSync(path);
  }

  /**
   * Create directory
   * @param {string} path - Directory path
   * @param {Object} options - Options (recursive, etc.)
   * @returns {Promise<void>}
   */
  async mkdir(path, options = {}) {
    try {
      mkdirSync(path, { recursive: true, ...options });
    } catch (error) {
      throw new Error(`Failed to create directory ${path}: ${error.message}`);
    }
  }
}
