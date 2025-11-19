/* Node.js-only module - uses renamer and prompts */
/**
 * @module metadataWorkflow
 * @browserSafe false
 * @description CLI workflow for metadata-based renaming
 * @see module:renamer
 * @see module:prompts
 */

import { renameUsingMetadata } from '../core/renamer.js';
import { promptConfirmation } from './prompts.js';

/**
 * Display metadata extraction results
 * @param {Array} results - Metadata extraction results
 * @param {object} options - Display options
 */
function displayMetadataResults(results, options = {}) {
  const { showSource = true } = options;

  results.forEach((item) => {
    console.log(`  ${item.oldName}`);
    console.log(`→ ${item.newName}`);
    if (showSource && item.source) {
      console.log(`  (from ${item.source})\n`);
    } else {
      console.log('');
    }
  });
}

/**
 * Execute metadata-based renaming workflow
 * @param {string} targetPath - Path to scan
 * @param {object} options - Workflow options
 * @returns {Promise<object>} - Execution result with stats
 */
export async function executeMetadataWorkflow(targetPath, options = {}) {

  const {
    format = 'yyyy-mm-dd hh.MM.ss',
    metadataSource = 'content',
    timeShiftMs = null,
    preview = false,
    interactive = true,
    onProgress = null,
    includeExt = [],
    excludeExt = [],
    excludeDir = [],
    depth = 1,
  } = options;

  console.log('\n🔍 Scanning file metadata...\n');

  // Step 1: Dry-run scan to preview changes and extract metadata
  const scanResult = await renameUsingMetadata(targetPath, {
    format,
    dryRun: true,
    execute: false,
    metadataSource,
    timeShiftMs,
    onProgress: onProgress || ((current, total) => {
      process.stdout.write(`\r   Scanning: ${current}/${total} files...`);
      if (current === total) {
        process.stdout.write('\n');
      }
    }),
    includeExt,
    excludeExt,
    excludeDir,
    depth,
  });

  const { results: metadataResults, filesScanned, datesFound, metadataMap, skippedNoMetadata } = scanResult;

  // Step 2: Check if any dates were found
  if (metadataResults.length === 0) {
    console.log(`Scanned ${filesScanned} file(s) but no dates found in metadata.`);

    // Show skipped files if any
    if (skippedNoMetadata && skippedNoMetadata.length > 0) {
      console.log(`\n⚠️  Skipped ${skippedNoMetadata.length} file(s) without metadata:\n`);
      skippedNoMetadata.slice(0, 5).forEach(item => {
        console.log(`  - ${item.name}`);
        console.log(`    💡 ${item.reason}\n`);
      });
      if (skippedNoMetadata.length > 5) {
        console.log(`  ... and ${skippedNoMetadata.length - 5} more file(s)\n`);
      }

      // Show next steps suggestion
      console.log('\n' + '─'.repeat(60));
      console.log('🚀 NEXT STEPS');
      console.log('─'.repeat(60));
      console.log('  To process these files with fallback to creation time:');
      console.log(`    fixts "${targetPath}" -m earliest --execute`);
      console.log('');
      console.log('  Or to use only creation time:');
      console.log(`    fixts "${targetPath}" -m birthtime --execute`);
      console.log('─'.repeat(60));
    }

    return {
      success: false,
      filesScanned,
      datesFound: 0,
      renamed: 0,
      failed: 0,
      skippedNoMetadata: skippedNoMetadata?.length || 0,
    };
  }

  console.log(`Found dates in ${datesFound} of ${filesScanned} file(s):\n`);

  // Step 3: Display proposed changes
  displayMetadataResults(metadataResults, { showSource: true });

  // Show skipped files if any (partial success case)
  if (skippedNoMetadata && skippedNoMetadata.length > 0) {
    console.log(`\n⚠️  Skipped ${skippedNoMetadata.length} file(s) without metadata:\n`);
    skippedNoMetadata.slice(0, 3).forEach(item => {
      console.log(`  - ${item.name}`);
      console.log(`    💡 ${item.reason}\n`);
    });
    if (skippedNoMetadata.length > 3) {
      console.log(`  ... and ${skippedNoMetadata.length - 3} more file(s)\n`);
    }

    // Show next steps suggestion
    console.log('─'.repeat(60));
    console.log('🚀 NEXT STEPS');
    console.log('─'.repeat(60));
    console.log('  To process skipped files with fallback to creation time:');
    console.log(`    fixts "${targetPath}" -m earliest --execute`);
    console.log('');
    console.log('  Or to use only creation time:');
    console.log(`    fixts "${targetPath}" -m birthtime --execute`);
    console.log('─'.repeat(60) + '\n');
  }

  // Step 4: If preview mode, stop here
  if (preview) {
    return {
      success: true,
      filesScanned,
      datesFound,
      renamed: 0,
      failed: 0,
      preview: true,
    };
  }

  // Step 5: Prompt for confirmation (unless non-interactive)
  let confirmed = true;
  if (interactive) {
    confirmed = await promptConfirmation('Apply these changes?');
  }

  if (!confirmed) {
    console.log('Operation cancelled.');
    return {
      success: false,
      filesScanned,
      datesFound,
      renamed: 0,
      failed: 0,
      cancelled: true,
    };
  }

  // Step 6: Apply changes using cached metadata (no re-scan)
  const applyResult = await renameUsingMetadata(targetPath, {
    format,
    dryRun: false,
    execute: true,
    metadataSource,
    timeShiftMs,
    cachedMetadata: metadataMap, // Reuse extracted metadata
    onProgress: onProgress || ((current, total) => {
      process.stdout.write(`\r   Processing: ${current}/${total} files...`);
      if (current === total) {
        process.stdout.write('\n');
      }
    }),
    includeExt,
    excludeExt,
    excludeDir,
    depth,
  });

  const applyResults = applyResult.results;

  // Step 7: Calculate and display results
  const successful = applyResults.filter((r) => !r.error).length;
  const failed = applyResults.filter((r) => r.error).length;

  console.log(`\n✓ Successfully renamed ${successful} file(s) using metadata`);
  if (failed > 0) {
    console.log(`✗ Failed: ${failed} file(s)`);
    applyResults.filter((r) => r.error).forEach((r) => {
      console.log(`  ${r.oldName}: ${r.error}`);
    });
  }

  if (applyResult.revertScriptPath) {
    console.log(`\n💾 Revert script created: ${applyResult.revertScriptPath}`);
    console.log('   Run this script to undo the renaming while preserving timestamps');
  }

  return {
    success: true,
    filesScanned,
    datesFound,
    renamed: successful,
    failed,
    results: applyResults,
    revertScriptPath: applyResult.revertScriptPath || null,
  };
}

/**
 * Prompt user to try metadata extraction (for when no timestamps found)
 * @param {string} targetPath - Path to scan
 * @param {object} options - Workflow options
 * @returns {Promise<object>} - Execution result
 */
export async function promptMetadataFallback(targetPath, options = {}) {
  const {
    format = 'yyyy-mm-dd hh.MM.ss',
    metadataSource = 'content',
    timeShiftMs = null,
    preview = false,
    interactive = true,
    includeExt = [],
    excludeExt = [],
    excludeDir = [],
    depth = 1,
  } = options;

  if (!interactive) {
    // Non-interactive mode, don't prompt
    return {
      success: false,
      declined: true,
    };
  }

  const useMetadata = await promptConfirmation(
    '\nWould you like to try extracting dates from file metadata (EXIF, creation time, etc.)?'
  );

  if (!useMetadata) {
    return {
      success: false,
      declined: true,
    };
  }

  return await executeMetadataWorkflow(targetPath, {
    format,
    metadataSource,
    timeShiftMs,
    preview,
    interactive,
    includeExt,
    excludeExt,
    excludeDir,
    depth,
  });
}
