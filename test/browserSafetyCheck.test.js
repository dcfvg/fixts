/**
 * Browser Safety Verification Test
 *
 * Ensures that all modules marked as "Browser-safe module ✓" do not import
 * any Node.js-specific modules that would break in a browser environment.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const NODEJS_IMPORTS = [
  /import\s+.*from\s+['"]node:/,           // node:fs, node:path, etc.
  /import\s+.*from\s+['"]fs['"]/,          // import ... from 'fs'
  /import\s+.*from\s+['"]path['"]/,        // import ... from 'path'
  /import\s+.*from\s+['"]readline['"]/,    // import ... from 'readline'
  /import\s+.*from\s+['"]child_process['"]/,
  /import\s+.*from\s+['"]util['"]/,
  /import\s+.*from\s+['"]url['"]/,
  /import\s+.*from\s+['"]os['"]/,
  /import\s+.*from\s+['"]crypto['"]/,
  /require\(['"]node:/,                     // require('node:...')
  /require\(['"]fs['"]/,
  /require\(['"]path['"]/,
  /require\(['"]readline['"]/,
];

/**
 * Recursively find all JavaScript files in a directory
 * @param {string} dir - Directory to search
 * @param {string[]} files - Accumulator array for file paths
 * @returns {string[]} Array of JavaScript file paths
 */
function findJavaScriptFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findJavaScriptFiles(fullPath, files);
    } else if (entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a file is marked as browser-safe
 * @param {string} filePath - Path to file to check
 * @returns {boolean} True if file is marked browser-safe
 */
function isBrowserSafe(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  // Check first 3 lines (to handle shebangs)
  return lines.slice(0, 3).some(line => line.includes('/* Browser-safe module ✓ */'));
}

/**
 * Check if file contains Node.js imports
 * @param {string} filePath - Path to file to check
 * @returns {boolean} True if file contains Node.js imports
 */
function hasNodeJsImports(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  for (const pattern of NODEJS_IMPORTS) {
    if (pattern.test(content)) {
      return { has: true, pattern: pattern.toString(), match: content.match(pattern)?.[0] };
    }
  }

  return { has: false };
}

test('Browser-safe modules should not import Node.js dependencies', () => {
  const srcDir = join(process.cwd(), 'src');
  const allFiles = findJavaScriptFiles(srcDir);
  const browserSafeFiles = allFiles.filter(isBrowserSafe);

  console.log(`\nFound ${browserSafeFiles.length} browser-safe modules:`);
  browserSafeFiles.forEach(file => {
    console.log(`  ✓ ${relative(process.cwd(), file)}`);
  });

  const violations = [];

  for (const file of browserSafeFiles) {
    const result = hasNodeJsImports(file);
    if (result.has) {
      violations.push({
        file: relative(process.cwd(), file),
        pattern: result.pattern,
        match: result.match
      });
    }
  }

  if (violations.length > 0) {
    console.error('\n❌ Browser-safe modules with Node.js imports:');
    violations.forEach(v => {
      console.error(`\n  File: ${v.file}`);
      console.error(`  Pattern: ${v.pattern}`);
      console.error(`  Match: ${v.match}`);
    });
  }

  assert.strictEqual(
    violations.length,
    0,
    `Found ${violations.length} browser-safe module(s) with Node.js imports`
  );
});

test('Browser-safe modules should have @browserSafe true JSDoc tag', () => {
  const srcDir = join(process.cwd(), 'src');
  const allFiles = findJavaScriptFiles(srcDir);
  const browserSafeFiles = allFiles.filter(isBrowserSafe);

  const missingTag = [];

  for (const file of browserSafeFiles) {
    const content = readFileSync(file, 'utf-8');
    if (!content.includes('@browserSafe true')) {
      missingTag.push(relative(process.cwd(), file));
    }
  }

  if (missingTag.length > 0) {
    console.error('\n⚠️  Browser-safe modules missing @browserSafe true tag:');
    missingTag.forEach(f => console.error(`  - ${f}`));
  }

  assert.strictEqual(
    missingTag.length,
    0,
    `Found ${missingTag.length} browser-safe module(s) without @browserSafe true tag`
  );
});

test('Node.js-only modules should have @browserSafe false JSDoc tag', () => {
  const srcDir = join(process.cwd(), 'src');
  const allFiles = findJavaScriptFiles(srcDir);
  const nodeJsOnlyFiles = allFiles.filter(file => {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    // Check first 3 lines (to handle shebangs)
    return lines.slice(0, 3).some(line => line.includes('/* Node.js-only module'));
  });

  console.log(`\nFound ${nodeJsOnlyFiles.length} Node.js-only modules:`);
  nodeJsOnlyFiles.forEach(file => {
    console.log(`  ⚙️  ${relative(process.cwd(), file)}`);
  });

  const missingTag = [];

  for (const file of nodeJsOnlyFiles) {
    const content = readFileSync(file, 'utf-8');
    if (!content.includes('@browserSafe false')) {
      missingTag.push(relative(process.cwd(), file));
    }
  }

  if (missingTag.length > 0) {
    console.error('\n⚠️  Node.js-only modules missing @browserSafe false tag:');
    missingTag.forEach(f => console.error(`  - ${f}`));
  }

  assert.strictEqual(
    missingTag.length,
    0,
    `Found ${missingTag.length} Node.js-only module(s) without @browserSafe false tag`
  );
});

test('All source modules should have platform markers', () => {
  const srcDir = join(process.cwd(), 'src');
  const allFiles = findJavaScriptFiles(srcDir);

  const unmarked = allFiles.filter(file => {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    // Check first 3 lines (to handle shebangs)
    const hasMarker = lines.slice(0, 3).some(line =>
      line.includes('/* Browser-safe module ✓ */') ||
      line.includes('/* Node.js-only module')
    );
    return !hasMarker;
  });

  if (unmarked.length > 0) {
    console.warn('\n⚠️  Modules without platform markers:');
    unmarked.forEach(f => console.warn(`  - ${relative(process.cwd(), f)}`));
  }

  // This is a warning, not a failure (some files like index.js might not need it)
  console.log(`\n📊 Coverage: ${allFiles.length - unmarked.length}/${allFiles.length} modules marked`);
});
