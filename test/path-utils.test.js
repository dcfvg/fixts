import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getBasename,
  getDirname,
  getExtension,
  getNameWithoutExt,
  joinPaths,
  normalizePath,
  isAbsolute,
  getRelativePath,
  splitPath,
  splitBasename
} from '../src/utils/path-utils.js';

describe('path-utils', () => {
  describe('getBasename', () => {
    it('should extract basename from unix path', () => {
      assert.strictEqual(getBasename('/path/to/file.txt'), 'file.txt');
    });

    it('should extract basename from windows path', () => {
      assert.strictEqual(getBasename('C:\\Users\\file.txt'), 'file.txt');
    });

    it('should handle filename without path', () => {
      assert.strictEqual(getBasename('file.txt'), 'file.txt');
    });

    it('should handle empty string', () => {
      assert.strictEqual(getBasename(''), '');
    });
  });

  describe('getDirname', () => {
    it('should extract directory from unix path', () => {
      assert.strictEqual(getDirname('/path/to/file.txt'), '/path/to');
    });

    it('should extract directory from windows path', () => {
      assert.strictEqual(getDirname('C:\\Users\\file.txt'), 'C:/Users');
    });

    it('should return . for filename without path', () => {
      assert.strictEqual(getDirname('file.txt'), '.');
    });
  });

  describe('getExtension', () => {
    it('should extract simple extension', () => {
      assert.strictEqual(getExtension('file.txt'), '.txt');
    });

    it('should extract last extension from compound', () => {
      assert.strictEqual(getExtension('archive.tar.gz'), '.gz');
    });

    it('should return empty for no extension', () => {
      assert.strictEqual(getExtension('noext'), '');
    });

    it('should ignore dot at start', () => {
      assert.strictEqual(getExtension('.hidden'), '');
    });

    it('should handle path with extension', () => {
      assert.strictEqual(getExtension('/path/to/file.txt'), '.txt');
    });
  });

  describe('getNameWithoutExt', () => {
    it('should remove extension', () => {
      assert.strictEqual(getNameWithoutExt('file.txt'), 'file');
    });

    it('should remove only last extension', () => {
      assert.strictEqual(getNameWithoutExt('archive.tar.gz'), 'archive.tar');
    });

    it('should return full name if no extension', () => {
      assert.strictEqual(getNameWithoutExt('noext'), 'noext');
    });
  });

  describe('joinPaths', () => {
    it('should join path segments', () => {
      assert.strictEqual(joinPaths('path', 'to', 'file.txt'), 'path/to/file.txt');
    });

    it('should handle absolute path', () => {
      assert.strictEqual(joinPaths('/root', 'subdir', 'file'), '/root/subdir/file');
    });

    it('should collapse multiple slashes', () => {
      assert.strictEqual(joinPaths('path/', '/to/', '/file'), 'path/to/file');
    });

    it('should filter empty strings', () => {
      assert.strictEqual(joinPaths('path', '', 'file'), 'path/file');
    });

    it('should return empty for no args', () => {
      assert.strictEqual(joinPaths(), '');
    });
  });

  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      assert.strictEqual(normalizePath('C:\\Users\\file.txt'), 'C:/Users/file.txt');
    });

    it('should leave forward slashes unchanged', () => {
      assert.strictEqual(normalizePath('/path/to/file'), '/path/to/file');
    });
  });

  describe('isAbsolute', () => {
    it('should detect unix absolute path', () => {
      assert.strictEqual(isAbsolute('/path/to/file'), true);
    });

    it('should detect windows absolute path with drive', () => {
      assert.strictEqual(isAbsolute('C:\\Users\\file'), true);
    });

    it('should detect windows absolute path forward slash', () => {
      assert.strictEqual(isAbsolute('C:/Users/file'), true);
    });

    it('should detect relative path', () => {
      assert.strictEqual(isAbsolute('relative/path'), false);
    });

    it('should detect relative path starting with dot', () => {
      assert.strictEqual(isAbsolute('./relative'), false);
    });
  });

  describe('getRelativePath', () => {
    it('should compute relative path with common ancestor', () => {
      const result = getRelativePath('/path/to/dir', '/path/to/file.txt');
      assert.strictEqual(result, '../file.txt');
    });

    it('should compute relative path going deeper', () => {
      const result = getRelativePath('/path/to', '/path/to/dir/file.txt');
      assert.strictEqual(result, 'dir/file.txt');
    });

    it('should return . for same path', () => {
      const result = getRelativePath('/path/to', '/path/to');
      assert.strictEqual(result, '.');
    });
  });

  describe('splitPath', () => {
    it('should split path into dir and base', () => {
      const result = splitPath('/path/to/file.txt');
      assert.deepStrictEqual(result, {
        dir: '/path/to',
        base: 'file.txt'
      });
    });
  });

  describe('splitBasename', () => {
    it('should split basename into name and ext', () => {
      const result = splitBasename('file.txt');
      assert.deepStrictEqual(result, {
        name: 'file',
        ext: '.txt'
      });
    });

    it('should handle no extension', () => {
      const result = splitBasename('noext');
      assert.deepStrictEqual(result, {
        name: 'noext',
        ext: ''
      });
    });
  });
});
