import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
  symlinkSync,
  utimesSync,
  readFileSync,
} from 'fs';
import { basename, join, resolve } from 'path';
import { rename, renameUsingMetadata } from '../src/core/renamer.js';

const TEST_DIR = join(process.cwd(), 'test-temp-robustness');

function resetTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
}

describe('robustness safeguards', () => {
  beforeEach(resetTestDir);

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('resolves duplicate ambiguous filenames independently', async () => {
    const root = join(TEST_DIR, 'duplicates');
    const euroDir = join(root, 'european');
    const usDir = join(root, 'american');
    mkdirSync(euroDir, { recursive: true });
    mkdirSync(usDir, { recursive: true });
    const fileName = 'trip 05-06-2024.jpg';
    const euroFile = join(euroDir, fileName);
    const usFile = join(usDir, fileName);
    writeFileSync(euroFile, 'euro');
    writeFileSync(usFile, 'us');

    const juneFifth = new Date('2024-06-05T12:00:00Z');
    const maySixth = new Date('2024-05-06T12:00:00Z');
    utimesSync(euroFile, juneFifth, juneFifth);
    utimesSync(usFile, maySixth, maySixth);

    const result = await rename(root, { dryRun: true, execute: false, depth: Infinity });
    const renamed = result.results.filter(entry => entry.oldName === fileName);

    assert.strictEqual(renamed.length, 2, 'both files should be processed');
    const formattedNames = renamed.map(entry => basename(entry.newPath));
    assert.ok(formattedNames.some(name => name.startsWith('2024-06-05')), 'european file should use DD-MM interpretation');
    assert.ok(formattedNames.some(name => name.startsWith('2024-05-06')), 'american file should use MM-DD interpretation');
  });

  it('skips symlinked directories to avoid recursion', async () => {
    const root = join(TEST_DIR, 'symlink-check');
    const photosDir = join(root, 'photos');
    mkdirSync(photosDir, { recursive: true });
    const filePath = join(photosDir, 'IMG_2024-01-01.jpg');
    writeFileSync(filePath, 'photo');
    symlinkSync('../photos', join(photosDir, 'loop'));

    const result = await rename(root, { dryRun: true, execute: false, depth: Infinity });
    assert.strictEqual(result.results.length, 1);
    assert.ok(result.results.every(entry => !entry.oldPath.includes('loop')));
  });

  it('respects metadata depth and extension filters', async () => {
    const depthDir = join(TEST_DIR, 'metadata-depth');
    const nestedDir = join(depthDir, 'nested');
    mkdirSync(nestedDir, { recursive: true });
    const nestedFile = join(nestedDir, 'photo.jpg');
    writeFileSync(nestedFile, 'nested');

    const depthResult = await renameUsingMetadata(depthDir, {
      metadataSource: 'birthtime',
      dryRun: true,
      execute: false,
      depth: 1,
    });
    assert.strictEqual(depthResult.filesScanned, 0, 'depth=1 should avoid nested files');

    const filtersDir = join(TEST_DIR, 'metadata-filters');
    mkdirSync(filtersDir, { recursive: true });
    const photoFile = join(filtersDir, 'photo.jpg');
    const noteFile = join(filtersDir, 'note.txt');
    writeFileSync(photoFile, 'photo');
    writeFileSync(noteFile, 'note');

    const filterResult = await renameUsingMetadata(filtersDir, {
      metadataSource: 'birthtime',
      dryRun: true,
      execute: false,
      includeExt: ['jpg'],
    });
    assert.strictEqual(filterResult.filesScanned, 1);
    assert.strictEqual(filterResult.results.length, 1);
    assert.strictEqual(filterResult.results[0].oldName, 'photo.jpg');
  });

  it('supports copy mode when extracting metadata', async () => {
    const root = join(TEST_DIR, 'metadata-copy');
    mkdirSync(root, { recursive: true });
    const filePath = join(root, 'untagged photo.jpg');
    writeFileSync(filePath, 'photo');

    const result = await renameUsingMetadata(root, {
      metadataSource: 'birthtime',
      dryRun: false,
      execute: true,
      copy: true,
    });

    const copiedEntry = result.results.find(entry => entry.oldPath === filePath);
    assert.ok(copiedEntry, 'metadata copy result should include original file');
    assert.ok(copiedEntry.newPath.includes(join(root, '_c')));
    assert.ok(existsSync(copiedEntry.newPath), 'copied file should exist');
    assert.ok(existsSync(filePath), 'original file should remain when copying');
  });

  it('generates revert scripts that enforce the base directory', async () => {
    const root = join(TEST_DIR, 'revert');
    mkdirSync(root, { recursive: true });
    const filePath = join(root, 'photo 2024-01-02.txt');
    writeFileSync(filePath, 'data');

    const result = await rename(root, { dryRun: false, execute: true });
    assert.ok(result.revertScriptPath);
    const scriptContent = readFileSync(result.revertScriptPath, 'utf8');
    const resolvedRoot = resolve(root);
    assert.ok(scriptContent.includes(`BASE_DIR="${resolvedRoot}`));
    assert.ok(scriptContent.includes('cd "$BASE_DIR"'));
  });
});
