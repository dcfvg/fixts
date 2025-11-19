import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEST_DIR_PREFIX = 'fixts-test-';

/**
 * Creates a temporary test directory.
 * @param {string} [name] - A unique name for the test directory (default: 'default').
 * @returns {string} The absolute path to the created directory.
 */
export function setupTestDirectory(name = 'default') {
  const dir = join(process.cwd(), `${TEST_DIR_PREFIX}${name}`);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Cleans up a temporary test directory.
 * @param {string} [name] - The unique name of the test directory to clean up (default: 'default').
 */
export function cleanupTestDirectory(name = 'default') {
  const dir = join(process.cwd(), `${TEST_DIR_PREFIX}${name}`);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Creates a test file with optional content.
 * @param {string} dir - The directory to create the file in.
 * @param {string} filename - The name of the file.
 * @param {string} [content] - The content to write to the file (default: '').
 * @returns {string} The full path to the created file.
 */
export function createTestFile(dir, filename, content = '') {
  const filePath = join(dir, filename);
  writeFileSync(filePath, content);
  return filePath;
}
