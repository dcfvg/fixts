/**
 * @module metadataCache
 * @browserSafe false
 * @requires node:fs
 * @description Metadata caching system for fixTS
 *
 * Provides intelligent caching of extracted metadata to avoid re-reading files
 * when only the priority order changes. Cache automatically invalidates when
 * files are modified (based on size + mtime).
 *
 * @example
 * import { globalMetadataCache } from './metadataCache.js';
 *
 * // Cache is used transparently
 * const cached = globalMetadataCache.get(filepath, stats);
 * if (!cached) {
 *   const results = await extractAllSources(filepath);
 *   globalMetadataCache.set(filepath, stats, results);
 * }
 */

/**
 * Cache for extracted metadata results
 *
 * Cache key includes file path, size, and modification time to automatically
 * invalidate when files change. This ensures cache is always fresh without
 * manual invalidation.
 *
 * @class MetadataCache
 */
export class MetadataCache {
  constructor() {
    /** @private */
    this.cache = new Map();

    /** @private */
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Generate cache key from file info
   *
   * Uses filepath, size, and mtime to detect file changes automatically.
   * If any of these change, the cache key changes and old entry is ignored.
   *
   * @param {string} filepath - Full path to file
   * @param {Object} stats - File stats from fs.statSync()
   * @param {number} stats.size - File size in bytes
   * @param {number} stats.mtimeMs - Last modified time in milliseconds
   * @returns {string} Cache key
   * @private
   */
  getKey(filepath, stats) {
    return `${filepath}:${stats.size}:${stats.mtimeMs}`;
  }

  /**
   * Get cached metadata for a file
   *
   * @param {string} filepath - Full path to file
   * @param {Object} stats - File stats from fs.statSync()
   * @returns {Object|null} Cached result or null if not found
   *
   * @example
   * const cached = cache.get('/path/to/photo.jpg', stats);
   * if (cached) {
   *   console.log('Cache hit!', cached.allSources);
   * }
   */
  get(filepath, stats) {
    const key = this.getKey(filepath, stats);
    const cached = this.cache.get(key);

    if (cached) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Store metadata in cache
   *
   * @param {string} filepath - Full path to file
   * @param {Object} stats - File stats from fs.statSync()
   * @param {Array} allSources - All extracted sources with timestamps
   *
   * @example
   * cache.set('/path/to/photo.jpg', stats, [
   *   { source: 'exif', timestamp: new Date(), confidence: 0.95 },
   *   { source: 'filename', timestamp: new Date(), confidence: 0.70 }
   * ]);
   */
  set(filepath, stats, allSources) {
    const key = this.getKey(filepath, stats);
    this.cache.set(key, {
      filepath,
      allSources,
      cachedAt: Date.now(),
      fileSize: stats.size,
      fileMtime: stats.mtimeMs
    });
  }

  /**
   * Check if file is cached
   *
   * @param {string} filepath - Full path to file
   * @param {Object} stats - File stats from fs.statSync()
   * @returns {boolean} True if cached
   */
  has(filepath, stats) {
    const key = this.getKey(filepath, stats);
    return this.cache.has(key);
  }

  /**
   * Clear entire cache or specific file
   *
   * @param {string|null} filepath - Optional: clear only this file (all versions)
   * @returns {number} Number of entries cleared
   *
   * @example
   * // Clear entire cache
   * const cleared = cache.clear();
   * console.log(`Cleared ${cleared} entries`);
   *
   * @example
   * // Clear specific file (all versions)
   * cache.clear('/path/to/photo.jpg');
   */
  clear(filepath = null) {
    if (filepath === null) {
      const size = this.cache.size;
      this.cache.clear();
      this.stats.evictions += size;
      return size;
    }

    // Clear all entries for this filepath (any version)
    let cleared = 0;
    for (const [key, value] of this.cache.entries()) {
      if (value.filepath === filepath) {
        this.cache.delete(key);
        cleared++;
      }
    }
    this.stats.evictions += cleared;
    return cleared;
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Statistics object
   * @returns {number} return.hits - Number of cache hits
   * @returns {number} return.misses - Number of cache misses
   * @returns {number} return.evictions - Number of evicted entries
   * @returns {number} return.size - Current cache size
   * @returns {number} return.hitRate - Cache hit rate (0-1)
   *
   * @example
   * const stats = cache.getStats();
   * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
   * console.log(`Cache size: ${stats.size} entries`);
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Reset statistics (but keep cached data)
   *
   * Useful for testing or measuring cache performance over specific period.
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Get all cached filepaths
   *
   * @returns {string[]} Array of cached filepaths
   */
  getCachedFiles() {
    const files = new Set();
    for (const value of this.cache.values()) {
      files.add(value.filepath);
    }
    return Array.from(files);
  }
}

/**
 * Global metadata cache instance
 *
 * Used by extractTimestamp() and related functions when caching is enabled.
 * Can be accessed directly for cache control operations.
 *
 * @type {MetadataCache}
 *
 * @example
 * import { globalMetadataCache } from './metadataCache.js';
 *
 * // Check cache stats
 * const stats = globalMetadataCache.getStats();
 * console.log(`Cache hit rate: ${stats.hitRate}`);
 *
 * // Clear cache
 * globalMetadataCache.clear();
 */
export const globalMetadataCache = new MetadataCache();
