/* Browser-safe module ✓ */
/**
 * @module batchProgressHelper
 * @browserSafe true
 * @description Helper utilities for progressive batch processing with progress tracking
 */

/**
 * PauseToken for controlling batch processing
 */
export class PauseToken {
  constructor() {
    this._paused = false;
    this._pausePromise = null;
    this._resumeCallback = null;
  }

  /**
   * Pause batch processing
   */
  pause() {
    if (!this._paused) {
      this._paused = true;
      this._pausePromise = new Promise(resolve => {
        this._resumeCallback = resolve;
      });
    }
  }

  /**
   * Resume batch processing
   */
  resume() {
    if (this._paused) {
      this._paused = false;
      if (this._resumeCallback) {
        this._resumeCallback();
        this._resumeCallback = null;
        this._pausePromise = null;
      }
    }
  }

  /**
   * Check if processing is paused
   * @returns {boolean}
   */
  isPaused() {
    return this._paused;
  }

  /**
   * Wait if paused
   * @returns {Promise<void>}
   */
  async waitIfPaused() {
    if (this._paused && this._pausePromise) {
      await this._pausePromise;
    }
  }
}

/**
 * Custom error class for aborted operations
 */
export class AbortError extends Error {
  constructor(message = 'Operation aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

/**
 * Calculate optimal chunk size based on file count and environment
 * @param {number} fileCount - Total number of files to process
 * @param {boolean} isBrowser - Whether running in browser environment
 * @returns {number} - Optimal chunk size
 */
export function getOptimalChunkSize(fileCount, isBrowser = typeof window !== 'undefined') {
  // Small batches: process all at once
  if (fileCount < 50) {
    return fileCount;
  }

  // Browser needs smaller chunks for UI responsiveness
  if (isBrowser) {
    if (fileCount < 200) return 50;
    if (fileCount < 1000) return 100;
    if (fileCount < 5000) return 150;
    return 200; // Cap at 200 for very large sets
  }

  // Node.js can handle larger chunks (better throughput)
  if (fileCount < 500) return 100;
  if (fileCount < 2000) return 250;
  if (fileCount < 10000) return 500;
  return 1000; // Cap at 1000 for massive batches
}

/**
 * Progress tracker for batch operations
 */
export class BatchProgressTracker {
  /**
   * @param {number} total - Total items to process
   * @param {Function} onProgress - Progress callback
   */
  constructor(total, onProgress) {
    this.total = total;
    this.completed = 0;
    this.onProgress = onProgress;
    this.startTime = Date.now();
    this.lastReportTime = this.startTime;
    this.processedSinceLastReport = 0;
    this.currentRate = 0;
  }

  /**
   * Report progress for completed items
   * @param {number} count - Number of items completed in this update
   * @param {*} currentItem - Current item being processed (optional)
   * @param {*} result - Result of current item (optional)
   */
  report(count = 1, currentItem = null, result = null) {
    this.completed += count;
    this.processedSinceLastReport += count;

    const now = Date.now();
    const elapsedMs = now - this.startTime;

    // Calculate processing rate (files per second)
    const timeSinceLastReport = now - this.lastReportTime;
    if (timeSinceLastReport >= 100) { // Update rate every 100ms
      this.currentRate = (this.processedSinceLastReport / timeSinceLastReport) * 1000;
      this.lastReportTime = now;
      this.processedSinceLastReport = 0;
    }

    // Calculate ETA
    const filesPerSecond = this.completed / (elapsedMs / 1000);
    const remaining = this.total - this.completed;
    const estimatedRemainingMs = filesPerSecond > 0
      ? Math.round((remaining / filesPerSecond) * 1000)
      : null;

    const percentage = this.total > 0 ? (this.completed / this.total) : 0;

    // Determine current file - handle both simple values and result objects
    let currentFile = currentItem;
    if (result && typeof result === 'object' && result.filepath) {
      // If result has a filepath property, use that instead
      currentFile = result.filepath;
    }

    if (this.onProgress) {
      this.onProgress({
        completed: this.completed,
        total: this.total,
        percentage,
        currentFile,
        currentResult: result,
        elapsedMs: Math.round(elapsedMs),
        estimatedRemainingMs,
        filesPerSecond: Math.round(filesPerSecond * 10) / 10 // One decimal place
      });
    }
  }

  /**
   * Get final statistics
   * @returns {Object} - Final processing statistics
   */
  getFinalStats() {
    const elapsedMs = Date.now() - this.startTime;
    const filesPerSecond = this.completed / (elapsedMs / 1000);

    return {
      total: this.total,
      completed: this.completed,
      durationMs: Math.round(elapsedMs),
      filesPerSecond: Math.round(filesPerSecond * 10) / 10
    };
  }
}

/**
 * Yield to the event loop to keep UI responsive
 * @returns {Promise<void>}
 */
export function yieldToEventLoop() {
  return new Promise(resolve => {
    // Use setImmediate in Node.js (more efficient), setTimeout in browser
    if (typeof globalThis !== 'undefined' && typeof globalThis.setImmediate !== 'undefined') {
      globalThis.setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Process items in chunks with progress reporting
 * @template T, R
 * @param {T[]} items - Items to process
 * @param {Function} processItem - Function to process each item: (item) => Promise<R>
 * @param {Object} options - Processing options
 * @param {number|'auto'} options.chunkSize - Chunk size or 'auto' for automatic
 * @param {Function} options.onProgress - Progress callback
 * @param {Function} options.onItemProcessed - Callback invoked after each item is processed: (item, result, index) => void
 * @param {boolean} options.yieldBetweenChunks - Yield to event loop between chunks (default: true)
 * @param {PauseToken} options.pauseToken - Token to pause/resume processing
 * @param {AbortSignal} options.abortSignal - Signal to abort processing
 * @param {Function} options.priorityFn - Function to determine processing priority: (item) => number (higher = first)
 * @param {'fail-fast'|'collect'|'ignore'} options.errorMode - How to handle errors (default: 'fail-fast')
 * @returns {Promise<{results: R[], errors: Array<{item: T, error: Error}>}>} - Results and errors
 */
export async function processInChunks(items, processItem, options = {}) {
  const {
    chunkSize = 'auto',
    onProgress,
    onItemProcessed,
    yieldBetweenChunks = true,
    pauseToken,
    abortSignal,
    priorityFn,
    errorMode = 'fail-fast'
  } = options;

  // Apply priority sorting if provided
  let itemsToProcess = items;
  if (priorityFn) {
    itemsToProcess = [...items].sort((a, b) => {
      const priorityA = priorityFn(a);
      const priorityB = priorityFn(b);
      return priorityB - priorityA; // Higher priority first
    });
  }

  // Calculate chunk size
  const actualChunkSize = chunkSize === 'auto'
    ? getOptimalChunkSize(itemsToProcess.length)
    : chunkSize;

  const results = [];
  const errors = [];
  const tracker = onProgress ? new BatchProgressTracker(itemsToProcess.length, onProgress) : null;

  // Process in chunks
  for (let i = 0; i < itemsToProcess.length; i += actualChunkSize) {
    // Check for abort
    if (abortSignal?.aborted) {
      throw new AbortError('Batch processing aborted');
    }

    // Wait if paused
    if (pauseToken) {
      await pauseToken.waitIfPaused();
    }

    const chunk = itemsToProcess.slice(i, Math.min(i + actualChunkSize, itemsToProcess.length));

    // Process chunk items
    for (let j = 0; j < chunk.length; j++) {
      const item = chunk[j];
      const itemIndex = i + j; // Global index in original array

      // Check abort between items
      if (abortSignal?.aborted) {
        throw new AbortError('Batch processing aborted');
      }

      // Wait if paused
      if (pauseToken) {
        await pauseToken.waitIfPaused();
      }

      try {
        const result = await processItem(item);
        results.push(result);

        // Call onItemProcessed callback (errors in callback don't stop processing)
        if (onItemProcessed) {
          try {
            onItemProcessed(item, result, itemIndex);
          } catch (callbackError) {
            // Log callback errors but don't stop processing
            if (typeof console !== 'undefined' && console.error) {
              console.error('Error in onItemProcessed callback:', callbackError);
            }
          }
        }

        // Report progress after each item
        if (tracker) {
          tracker.report(1, item, result);
        }
      } catch (error) {
        if (errorMode === 'fail-fast') {
          // Throw immediately on first error
          throw error;
        } else if (errorMode === 'collect') {
          // Collect error and continue
          errors.push({ item, error });
          results.push(null); // Push null to maintain index alignment

          // Call onItemProcessed with null result for failed items
          if (onItemProcessed) {
            try {
              onItemProcessed(item, null, itemIndex);
            } catch (callbackError) {
              if (typeof console !== 'undefined' && console.error) {
                console.error('Error in onItemProcessed callback:', callbackError);
              }
            }
          }

          // Still report progress for failed items
          if (tracker) {
            tracker.report(1, item, null);
          }
        } else if (errorMode === 'ignore') {
          // Skip error silently
          results.push(null);

          // Call onItemProcessed with null result
          if (onItemProcessed) {
            try {
              onItemProcessed(item, null, itemIndex);
            } catch (callbackError) {
              if (typeof console !== 'undefined' && console.error) {
                console.error('Error in onItemProcessed callback:', callbackError);
              }
            }
          }

          // Still report progress
          if (tracker) {
            tracker.report(1, item, null);
          }
        }
      }
    }

    // Yield to event loop between chunks (except after last chunk)
    if (yieldBetweenChunks && i + actualChunkSize < itemsToProcess.length) {
      await yieldToEventLoop();
    }
  }

  // Return results with errors if in collect mode
  if (errorMode === 'collect') {
    return { results, errors };
  }

  // For fail-fast and ignore modes, just return results
  return { results, errors: [] };
}
