#!/usr/bin/env node

/**
 * Fast sample generation using reservoir sampling
 * Much faster than find | sort | head on large directories
 *
 * Usage:
 *   node generate-sample.js [source_dir] [sample_size]
 *
 * Examples:
 *   node generate-sample.js ~/Documents 2000
 *   node generate-sample.js . 500
 *   node generate-sample.js  # defaults to ~/Documents, 2000 files
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse arguments
const args = process.argv.slice(2);
const sourceDir = args[0] ? args[0].replace(/^~/, homedir()) : join(homedir(), 'Documents');
const sampleSize = args[1] ? parseInt(args[1], 10) : 2000;

// Output to temp directory inside local-tests
const tempDir = join(__dirname, 'temp');
const outputFile = join(tempDir, 'sample-files.txt');

// Create temp directory if it doesn't exist
mkdirSync(tempDir, { recursive: true });

console.log(`🔍 Generating sample from: ${sourceDir}`);
console.log(`   Sample size: ${sampleSize} files`);
console.log(`   Output: ${outputFile}`);
console.log('');

const reservoir = [];
let count = 0;

const find = spawn('find', [
  sourceDir,
  '-type', 'f',
  // Version control
  '-not', '-path', '*/.git/*',
  '-not', '-path', '*/.svn/*',
  '-not', '-path', '*/.hg/*',

  // Dependencies
  '-not', '-path', '*/node_modules/*',
  '-not', '-path', '*/bower_components/*',
  '-not', '-path', '*/vendor/*',

  // Python
  '-not', '-path', '*/.venv/*',
  '-not', '-path', '*/venv/*',
  '-not', '-path', '*/__pycache__/*',
  '-not', '-path', '*/.pytest_cache/*',
  '-not', '-path', '*/.tox/*',
  '-not', '-path', '*/dist/*',
  '-not', '-path', '*/build/*',
  '-not', '-path', '*/*.egg-info/*',

  // IDE & Editor
  '-not', '-path', '*/.vscode/*',
  '-not', '-path', '*/.idea/*',
  '-not', '-path', '*/.vs/*',
  '-not', '-path', '*/.eclipse/*',

  // Build & Cache
  '-not', '-path', '*/.cache/*',
  '-not', '-path', '*/tmp/*',
  '-not', '-path', '*/temp/*',
  '-not', '-path', '*/.next/*',
  '-not', '-path', '*/.nuxt/*',
  '-not', '-path', '*/.output/*',

  // System
  '-not', '-path', '*/Library/*',
  '-not', '-path', '*/.Trash/*',
  '-not', '-path', '*/.DS_Store',

  // Logs
  '-not', '-path', '*/logs/*',
  '-not', '-name', '*.log',

  // Archives & Backups
  '-not', '-name', '*.zip',
  '-not', '-name', '*.tar',
  '-not', '-name', '*.tar.gz',
  '-not', '-name', '*.tgz',
  '-not', '-name', '*.rar',
  '-not', '-name', '*.7z',
  '-not', '-name', '*~',
  '-not', '-name', '*.bak',
  '-not', '-name', '*.swp',

  // Compiled/Binary
  '-not', '-name', '*.pyc',
  '-not', '-name', '*.pyo',
  '-not', '-name', '*.so',
  '-not', '-name', '*.o',
  '-not', '-name', '*.a',
  '-not', '-name', '*.dylib',
  '-not', '-name', '*.dll',
  '-not', '-name', '*.exe',
  '-not', '-name', '*.class',
  '-not', '-name', '*.jar',

  // Databases
  '-not', '-name', '*.db',
  '-not', '-name', '*.sqlite',
  '-not', '-name', '*.sqlite3',
], {
  stdio: ['ignore', 'pipe', 'ignore']
});

let buffer = '';

find.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line

  for (const line of lines) {
    if (!line.trim()) continue;

    count++;

    // Reservoir sampling: maintain random sample of sampleSize
    if (reservoir.length < sampleSize) {
      reservoir.push(line);
    } else {
      const j = Math.floor(Math.random() * count);
      if (j < sampleSize) {
        reservoir[j] = line;
      }
    }

    // Progress indicator every 10k files
    if (count % 10000 === 0) {
      process.stdout.write(`\r   Scanned: ${count} files...`);
    }
  }
});

find.on('close', () => {
  if (count > 0) {
    process.stdout.write(`\r   Scanned: ${count} files    \n`);
  }

  // Write reservoir to file
  writeFileSync(outputFile, reservoir.join('\n') + '\n');

  console.log('');
  console.log(`✅ Generated ${outputFile}`);
  console.log(`   Sample: ${reservoir.length} files (from ${count} total)`);
  console.log('');
  console.log('📊 Sample (first 5 lines):');
  reservoir.slice(0, 5).forEach(line => console.log('  ', line));
  console.log('');
  console.log('Now you can run analysis scripts like:');
  console.log('  node test/local-sample/analyze-all-documents.js');
});

find.on('error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
