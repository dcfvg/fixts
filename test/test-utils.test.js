import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { setupTestDirectory, cleanupTestDirectory, createTestFile } from './test-utils.js';

const TEST_DIR_NAME = 'test-utils-test';

describe('test-utils', () => {
  afterEach(() => {
    // Ensure cleanup happens even if a test fails
    cleanupTestDirectory(TEST_DIR_NAME);
  });

  it('should create a test directory with setupTestDirectory', () => {
    const dirPath = setupTestDirectory(TEST_DIR_NAME);
    assert.ok(existsSync(dirPath), 'Directory should be created');
    assert.ok(dirPath.endsWith(TEST_DIR_NAME), 'Directory path should have the correct name');
  });

  it('should remove the test directory with cleanupTestDirectory', () => {
    const dirPath = setupTestDirectory(TEST_DIR_NAME);
    assert.ok(existsSync(dirPath), 'Pre-condition: Directory should exist');

    cleanupTestDirectory(TEST_DIR_NAME);
    assert.strictEqual(existsSync(dirPath), false, 'Directory should be removed');
  });

  it('should create a file with content using createTestFile', () => {
    const dirPath = setupTestDirectory(TEST_DIR_NAME);
    const filename = 'sample.txt';
    const content = 'Hello, world!';

    const filePath = createTestFile(dirPath, filename, content);

    assert.ok(existsSync(filePath), 'File should be created');
    assert.strictEqual(filePath, join(dirPath, filename), 'Should return the correct file path');

    const fileContent = readFileSync(filePath, 'utf-8');
    assert.strictEqual(fileContent, content, 'File content should match');
  });

  it('should create an empty file if no content is provided', () => {
    const dirPath = setupTestDirectory(TEST_DIR_NAME);
    const filename = 'empty.txt';

    const filePath = createTestFile(dirPath, filename);

    assert.ok(existsSync(filePath), 'Empty file should be created');
    const fileContent = readFileSync(filePath, 'utf-8');
    assert.strictEqual(fileContent, '', 'File content should be empty');
  });

  it('should handle repeated setup and cleanup calls gracefully', () => {
    let dirPath = setupTestDirectory(TEST_DIR_NAME);
    assert.ok(existsSync(dirPath), 'Directory should exist after first setup');

    // Calling setup again should effectively reset the directory
    dirPath = setupTestDirectory(TEST_DIR_NAME);
    assert.ok(existsSync(dirPath), 'Directory should still exist after second setup');

    cleanupTestDirectory(TEST_DIR_NAME);
    assert.strictEqual(existsSync(dirPath), false, 'Directory should be removed');

    // Calling cleanup again should not throw an error
    assert.doesNotThrow(() => {
      cleanupTestDirectory(TEST_DIR_NAME);
    });
  });
});
