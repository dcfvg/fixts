import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MetadataCache } from '../src/utils/metadataCache.js';
import {
  reapplyPriority,
  canReapplyPriority,
  clearMetadataCache,
  getMetadataCacheStats
} from '../src/utils/unifiedMetadataExtractor.js';

describe('Metadata Cache - Basic Tests', () => {
  describe('MetadataCache', () => {
    it('should cache and retrieve metadata', () => {
      const cache = new MetadataCache();
      const filepath = '/path/to/file.jpg';
      const stats = { size: 1024, mtimeMs: 1699444800000 };
      const allSources = [
        { source: 'exif', timestamp: new Date('2024-01-01'), confidence: 0.95 }
      ];

      cache.set(filepath, stats, allSources);
      const cached = cache.get(filepath, stats);

      assert.ok(cached);
      assert.strictEqual(cached.filepath, filepath);
      assert.strictEqual(cached.allSources.length, 1);
    });

    it('should invalidate cache when file changes', () => {
      const cache = new MetadataCache();
      const filepath = '/path/to/file.jpg';
      const stats1 = { size: 1024, mtimeMs: 1699444800000 };
      const stats2 = { size: 2048, mtimeMs: 1699444800000 }; // Size changed
      const allSources = [{ source: 'exif', timestamp: new Date(), confidence: 0.95 }];

      cache.set(filepath, stats1, allSources);
      const cached = cache.get(filepath, stats2); // Different stats

      assert.strictEqual(cached, null); // Cache miss
    });

    it('should track cache statistics', () => {
      const cache = new MetadataCache();
      const filepath = '/path/to/file.jpg';
      const stats = { size: 1024, mtimeMs: 1699444800000 };
      const allSources = [{ source: 'exif', timestamp: new Date(), confidence: 0.95 }];

      cache.set(filepath, stats, allSources);
      cache.get(filepath, stats); // Hit
      cache.get('/other.jpg', stats); // Miss

      const cacheStats = cache.getStats();
      assert.strictEqual(cacheStats.hits, 1);
      assert.strictEqual(cacheStats.misses, 1);
      assert.strictEqual(cacheStats.size, 1);
    });
  });

  describe('reapplyPriority', () => {
    it('should re-sort sources based on new priority', () => {
      const sources = [
        { source: 'filename', timestamp: new Date('2024-01-01'), confidence: 0.70 },
        { source: 'exif', timestamp: new Date('2024-01-02'), confidence: 0.95 },
        { source: 'mtime', timestamp: new Date('2024-01-03'), confidence: 0.50 }
      ];

      const batchResults = [{
        filepath: '/file1.jpg',
        result: { primary: sources[0], all: sources }
      }];

      const newPriority = ['exif', 'filename', 'mtime'];
      const updated = reapplyPriority(batchResults, newPriority);

      assert.strictEqual(updated[0].result.primary.source, 'exif');
      assert.strictEqual(updated[0].result.all[0].source, 'exif');
      assert.strictEqual(updated[0].result.all[1].source, 'filename');
    });

    it('should handle results without "all" sources', () => {
      const batchResults = [{
        filepath: '/file1.jpg',
        result: {
          timestamp: new Date(),
          source: 'exif',
          confidence: 0.95
          // No "all" property
        }
      }];

      const updated = reapplyPriority(batchResults, ['filename', 'exif']);

      // Should return unchanged since no "all" sources
      assert.strictEqual(updated[0].filepath, batchResults[0].filepath);
      assert.strictEqual(updated[0].result.source, 'exif');
    });

    it('should throw on invalid input', () => {
      assert.throws(() => reapplyPriority(null, ['exif']), TypeError);
      assert.throws(() => reapplyPriority([], []), TypeError);
    });
  });

  describe('canReapplyPriority', () => {
    it('should return true for results with "all" sources', () => {
      const batchResults = [{
        filepath: '/file1.jpg',
        result: {
          primary: { source: 'exif', timestamp: new Date(), confidence: 0.95 },
          all: [{ source: 'exif', timestamp: new Date(), confidence: 0.95 }]
        }
      }];

      assert.strictEqual(canReapplyPriority(batchResults), true);
    });

    it('should return false for results without "all" sources', () => {
      const batchResults = [{
        filepath: '/file1.jpg',
        result: { timestamp: new Date(), source: 'exif', confidence: 0.95 }
      }];

      assert.strictEqual(canReapplyPriority(batchResults), false);
    });

    it('should return false for empty array', () => {
      assert.strictEqual(canReapplyPriority([]), false);
    });
  });

  describe('cache control API', () => {
    it('should clear metadata cache', () => {
      const stats = clearMetadataCache();
      assert.ok(stats);
      assert.ok('hits' in stats);
      assert.ok('misses' in stats);
    });

    it('should get cache statistics', () => {
      const stats = getMetadataCacheStats();
      assert.ok(stats);
      assert.ok('hits' in stats);
      assert.ok('misses' in stats);
      assert.ok('size' in stats);
      assert.ok('hitRate' in stats);
    });
  });
});
