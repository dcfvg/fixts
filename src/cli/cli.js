#!/usr/bin/env node

import { resolve, basename } from 'path';
import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { rename as renameFiles, renameUsingMetadata } from '../core/renamer.js';
import { groupByPattern, createSummary, displaySummary, displayGroup, detectPattern } from '../utils/fileGrouper.js';
import { generateNewName } from '../core/formatter.js';
import { parseTimeShift, formatTimeShift } from '../utils/timeShift.js';
import { promptConfirmation } from './prompts.js';
import { executeMetadataWorkflow, promptMetadataFallback } from './metadataWorkflow.js';

// Parse command line arguments
function parseArgs(args) {
  const options = {
    path: null,
    dryRun: true, // dry-run by default
    copy: false,
    format: 'yyyy-mm-dd hh.MM.ss', // default format
    useMetadata: false, // use file metadata when no timestamp in name
    metadataSource: 'content', // 'content' (EXIF priority), 'birthtime', 'earliest'
    table: false, // show detailed table format
    wizard: false, // Non-interactive mode by default
    help: false,
    timeShift: null, // Time shift in milliseconds
    ambiguityResolution: {}, // Preset ambiguity resolutions
    includeExt: [], // Include only these extensions
    excludeExt: [], // Exclude these extensions
    noRevert: false, // Skip revert script generation
    copyFlat: false, // Flatten directory structure in copy mode
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--wizard' || arg === '-w') {
      options.wizard = true;
    } else if (arg === '--no-revert') {
      options.noRevert = true;
    } else if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--execute' || arg === '-e') {
      options.dryRun = false;
    } else if (arg === '--copy' || arg === '-c') {
      options.copy = true;
    } else if (arg === '--copy-flat') {
      options.copy = true;
      options.copyFlat = true;
    } else if (arg === '--shift' || arg === '--delay') {
      if (i + 1 < args.length) {
        const shiftStr = args[++i];
        options.timeShift = parseTimeShift(shiftStr);
        if (options.timeShift === null) {
          console.error(`❌ Invalid time shift format: ${shiftStr}`);
          console.error('   Use format like: +2h30m, -1d3h, +45m, -30s');
          console.error('   Examples: +2h (add 2 hours), -1d (remove 1 day), +30m (add 30 minutes)');
          process.exit(1);
        }
        // Force copy mode when using time shift (safety feature)
        options.copy = true;
      }
    } else if (arg === '--use-metadata' || arg === '-m') {
      options.useMetadata = true;
      // Check if next arg is a metadata source (not a flag or path)
      if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        const validSources = ['content', 'exif', 'birthtime', 'creation', 'earliest'];
        const lowerNext = nextArg.toLowerCase();

        if (validSources.includes(lowerNext)) {
          i++; // consume the source argument
          // Normalize aliases
          if (lowerNext === 'exif') {
            options.metadataSource = 'content';
          } else if (lowerNext === 'creation') {
            options.metadataSource = 'birthtime';
          } else {
            options.metadataSource = lowerNext;
          }
        }
      }
    } else if (arg === '--table' || arg === '-t') {
      options.table = true;
    } else if (arg === '--format' || arg === '-f') {
      if (i + 1 < args.length) {
        options.format = args[++i];
      }
    } else if (arg === '--resolution' || arg === '-r') {
      if (i + 1 < args.length) {
        const resolution = args[++i].toLowerCase();
        // Parse resolution values
        if (resolution === 'dd-mm-yyyy' || resolution === 'eu' || resolution === 'european') {
          options.ambiguityResolution.dateFormat = 'dd-mm-yyyy';
        } else if (resolution === 'mm-dd-yyyy' || resolution === 'us' || resolution === 'american') {
          options.ambiguityResolution.dateFormat = 'mm-dd-yyyy';
        } else if (resolution === '2000s' || resolution === '2000' || resolution === '20xx') {
          options.ambiguityResolution.century = '2000s';
        } else if (resolution === '1900s' || resolution === '1900' || resolution === '19xx') {
          options.ambiguityResolution.century = '1900s';
        } else {
          console.error(`❌ Invalid resolution value: ${resolution}`);
          console.error('   Valid values: dd-mm-yyyy, mm-dd-yyyy, 2000s, 1900s');
          console.error('   Aliases: eu/european, us/american, 20xx, 19xx');
          process.exit(1);
        }
      }
    } else if (arg === '--include-ext' || arg === '-i') {
      // Collect all following non-flag arguments as extensions
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options.includeExt.push(args[++i].toLowerCase().replace(/^\./, ''));
      }
    } else if (arg === '--exclude-ext' || arg === '-x') {
      // Collect all following non-flag arguments as extensions
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options.excludeExt.push(args[++i].toLowerCase().replace(/^\./, ''));
      }
    } else if (!options.path) {
      options.path = arg;
    }
  }

  return options;
}

// Display help message
function displayHelp() {
  console.log(`
fixts - Normalize filenames and folders with timestamps

Usage:
  fixts <path> [options]

Arguments:
  <path>                Path to file or directory to process

Options:
  -d, --dry-run        Show changes without applying them (default)
  -e, --execute        Execute the renaming (requires confirmation)
  -c, --copy           Copy files/folders to '_c' directory instead of renaming
  --copy-flat          Flatten directory structure when copying (all files in _c root)
  -f, --format <fmt>   Date format template (default: "yyyy-mm-dd hh.MM.ss")
  -m, --use-metadata [source]  Use file metadata when no timestamp in filename
                       Optional source (default: content):
                       
                       • content: Metadata from file content (format-specific, strict)
                         Supported formats:
                         - Images: EXIF (DateTimeOriginal) - JPEG, PNG, TIFF, HEIC, RAW, CR2, NEF, ARW
                         - Audio:  ID3v2 (MP3), M4A/AAC metadata, OGG/Vorbis, WAV, AIFF
                       
                       • birthtime: File creation time only
                         Uses filesystem creation timestamp (birthtime)
                       
                       • earliest: Earliest date found (content OR creation time)
                         Priority: embedded metadata (EXIF/ID3/etc.) > creation time
                         ✓  Always succeeds (falls back to creation time if no embedded metadata)
                       
                       Examples:
                         fixts -m .              (default: content - strict EXIF/ID3)
                         fixts -m content .      (same as above)
                         fixts -m birthtime .    (creation time only)
                         fixts -m earliest .     (EXIF preferred, fallback to creation time)
                       
                       Note: Modification time (mtime) is NEVER used to avoid false dates
  --shift <duration>   Shift all timestamps by duration (forces copy mode for safety)
                       Format: [+|-]<N>d<H>h<M>m<S>s (d=days, h=hours, m=minutes, s=seconds)
                       Examples:
                         --shift +2h          Add 2 hours
                         --shift -1d3h        Subtract 1 day and 3 hours
                         --shift +30m         Add 30 minutes
                         --shift -45s         Subtract 45 seconds
  -r, --resolution <value>  Pre-set ambiguity resolution (can be used multiple times)
                       Values:
                         dd-mm-yyyy, eu, european    European date format (day-month-year)
                         mm-dd-yyyy, us, american    US date format (month-day-year)
                         2000s, 20xx                 Two-digit years are 20xx
                         1900s, 19xx                 Two-digit years are 19xx
                       Examples:
                         --resolution eu --resolution 2000s
                         --resolution us --resolution 1900s
  -t, --table          Show detailed table format with metadata sources
  -i, --include-ext <ext...>  Include only files with these extensions
                       Examples:
                         -i jpg png jpeg    Include only image files
                         -i mp4 mov avi     Include only video files
  -x, --exclude-ext <ext...>  Exclude files with these extensions
                       Examples:
                         -x pdf docx        Exclude documents
                         -x txt md          Exclude text files
  -w, --wizard         Enable wizard mode with prompts for ambiguities
  --no-revert          Skip revert script generation (faster for large batches)
  -h, --help           Show this help message

Note: Non-wizard mode is default. Use --wizard for prompts and fine-grained control.
Note: --shift automatically enables --copy mode to avoid accidental data loss.

Format placeholders:
  yyyy    4-digit year
  yy      2-digit year
  mm      2-digit month
  dd      2-digit day
  hh      2-digit hours (24h)
  MM      2-digit minutes
  ss      2-digit seconds

Examples:
  fixts ./documents --dry-run
  fixts ./photos --execute --copy
  fixts ./file.pdf --format "yyyy-mm-dd" --execute
  fixts . --format "dd-mm-yyyy hh.MM.ss"
  fixts ./mixed-files --wizard
  fixts ./photos --shift +2h --execute     # Correct camera clock error
  fixts ./files --shift -1d --execute      # Remove 1 day from all dates
  fixts ./images -i jpg png jpeg --execute  # Process only image files
  fixts ./docs -x pdf docx --execute       # Exclude documents

Time Shift Use Cases:
  - Camera clock was wrong (timezone, wrong date set)
  - Daylight saving time correction
  - Synchronize files from different time zones
  - Fix batch of files with systematic time error

Wizard Mode:
  Step 1: Scan directory and analyze timestamp patterns
  Step 2: Group files by pattern (ISO, Camera, WhatsApp, etc.)
  Step 3: Resolve ambiguous dates (e.g., 01-12-2023)
  Step 4: Identify files needing metadata extraction
  Step 5: Show summary by pattern with rename proposals
  Step 6: Confirm and execute renaming

Supported input formats:
  - 2025-10-10 my-folder/
  - 2025-10-06 13.50.17 document.pdf
  - 2025-04-01 02.47.15.mp4
  - IMG_20240815_092345.jpg
  - Screenshot_2025-01-20-10-30-45.png
  - And many more...
`);
}

// Prompt user for confirmation
/**
 * Display results in a table format
 * @param {Array} results - Array of result objects
 * @param {boolean} showSource - Whether to show metadata source column
 * @param {boolean} copyMode - Whether files are being copied to _c/ directory
 */
function displayResultsTable(results, showSource = false, copyMode = false) {
  if (results.length === 0) {
    return;
  }

  // Calculate column widths
  const maxOldName = Math.max(12, ...results.map(r => r.oldName.length));
  // Add 3 chars for '_c/' prefix if in copy mode
  const maxNewName = Math.max(12, ...results.map(r => (copyMode ? '_c/' : '') + r.newName).map(n => n.length));
  const maxSource = showSource ? Math.max(15, ...results.map(r => (r.source || '').length)) : 0;

  // Truncate long names
  const truncate = (str, maxLen) => {
    if (str.length <= maxLen) return str.padEnd(maxLen);
    return str.substring(0, maxLen - 3) + '...';
  };

  // Table borders
  const topBorder = showSource
    ? `┌─${'─'.repeat(maxOldName)}─┬─${'─'.repeat(maxSource)}─┬─${'─'.repeat(maxNewName)}─┐`
    : `┌─${'─'.repeat(maxOldName)}─┬─${'─'.repeat(maxNewName)}─┐`;

  const separator = showSource
    ? `├─${'─'.repeat(maxOldName)}─┼─${'─'.repeat(maxSource)}─┼─${'─'.repeat(maxNewName)}─┤`
    : `├─${'─'.repeat(maxOldName)}─┼─${'─'.repeat(maxNewName)}─┤`;

  const bottomBorder = showSource
    ? `└─${'─'.repeat(maxOldName)}─┴─${'─'.repeat(maxSource)}─┴─${'─'.repeat(maxNewName)}─┘`
    : `└─${'─'.repeat(maxOldName)}─┴─${'─'.repeat(maxNewName)}─┘`;

  // Header
  console.log(topBorder);
  if (showSource) {
    console.log(`│ ${'Original File'.padEnd(maxOldName)} │ ${'Source'.padEnd(maxSource)} │ ${'New Name'.padEnd(maxNewName)} │`);
  } else {
    console.log(`│ ${'Original File'.padEnd(maxOldName)} │ ${'New Name'.padEnd(maxNewName)} │`);
  }
  console.log(separator);

  // Rows
  results.forEach((item, index) => {
    const oldName = truncate(item.oldName, maxOldName);
    const displayNewName = (copyMode ? '_c/' : '') + item.newName;
    const newName = truncate(displayNewName, maxNewName);

    if (showSource) {
      const source = truncate(item.source || 'timestamp', maxSource);
      console.log(`│ ${oldName} │ ${source} │ ${newName} │`);
    } else {
      console.log(`│ ${oldName} │ ${newName} │`);
    }

    // Add separator every 10 rows for readability (but not after last row)
    if ((index + 1) % 10 === 0 && index !== results.length - 1) {
      console.log(separator);
    }
  });

  console.log(bottomBorder);
}

/**
 * Interactive workflow with pattern analysis and step-by-step confirmation
 * @param {string} targetPath - Path to directory to process
 * @param {Object} options - CLI options
 */
async function interactiveWorkflow(targetPath, options) {
  console.log('\n🔍 Step 1: Scanning directory...\n');

  // Read all files from directory (excluding system files)
  const allFiles = readdirSync(targetPath)
    .filter(f => !f.startsWith('.') && f !== 'Thumbs.db')
    .map(f => join(targetPath, f));

  if (allFiles.length === 0) {
    console.log('No files found in directory.');
    return;
  }

  console.log(`Found ${allFiles.length} files\n`);

  // Step 2: Group files by pattern
  console.log('📊 Step 2: Analyzing timestamp patterns...\n');
  const fileObjects = allFiles.map(f => ({ name: basename(f), path: f }));
  const groups = groupByPattern(fileObjects);
  const summary = createSummary(groups);
  displaySummary(summary);

  // Show details for each group
  console.log('\n📋 Pattern Details:\n');
  for (const [, group] of groups.entries()) {
    displayGroup(group, 3);
  }

  // Step 3: Handle ambiguous dates
  if (summary.hasAmbiguous) {
    console.log('\n⚠️  Step 3: Resolving ambiguous dates...\n');

    // Check if we have preset resolutions
    const hasPresetResolutions = options.ambiguityResolution &&
      (options.ambiguityResolution.dateFormat || options.ambiguityResolution.century);

    if (hasPresetResolutions) {
      console.log('✓ Using preset ambiguity resolutions:');
      if (options.ambiguityResolution.dateFormat) {
        console.log(`  - Date format: ${options.ambiguityResolution.dateFormat}`);
      }
      if (options.ambiguityResolution.century) {
        console.log(`  - Two-digit years: ${options.ambiguityResolution.century}`);
      }
      console.log('');
    } else if (options.wizard) {
      console.log('Some files have ambiguous date formats (e.g., 01-12-2023 could be Jan 12 or Dec 1).');
      console.log('The system will prompt you for clarification when processing these files.\n');

      const continueAmbiguous = await promptConfirmation('Continue with ambiguity resolution?');
      if (!continueAmbiguous) {
        console.log('Operation cancelled.');
        return;
      }
    } else {
      console.log('⚠️  Warning: Ambiguous dates detected but no resolution provided.');
      console.log('   Use --resolution flags to specify how to handle ambiguous dates.');
      console.log('   Examples: --resolution eu --resolution 2000s\n');
    }
  }

  // Step 4: Handle files without timestamps
  if (summary.needsMetadata) {
    console.log('\n📅 Step 4: Files without timestamps detected\n');
    const noTimestampGroup = groups.get('NO_TIMESTAMP');
    if (noTimestampGroup) {
      console.log(`Found ${noTimestampGroup.count} file(s) without timestamps:`);
      displayGroup(noTimestampGroup, 5);
      console.log('\nThese files will be renamed using metadata (EXIF, mtime, birthtime).');
      console.log(`Metadata source: ${options.metadataSource || 'earliest'}\n`);
    }
  } else {
    console.log('\n✅ Step 4: All files have timestamps in filename\n');
  }

  // Step 5: Generate rename proposals and show summary
  console.log('📝 Step 5: Generating rename proposals...\n');

  const renameProposals = [];

  // Process files with timestamps
  const filesWithTimestamps = allFiles.filter(f => {
    const patternInfo = detectPattern(basename(f));
    return patternInfo.pattern !== 'NO_TIMESTAMP';
  });

  if (filesWithTimestamps.length > 0) {
    for (const filePath of filesWithTimestamps) {
      const oldName = basename(filePath);
      const parsingOptions = options.timeShift ? { timeShiftMs: options.timeShift } : {};
      const newName = generateNewName(oldName, options.format, parsingOptions);

      if (newName && newName !== oldName) {
        const patternInfo = detectPattern(oldName);
        renameProposals.push({
          oldName,
          newName,
          pattern: patternInfo.pattern,
          filePath
        });
      }
    }
  }

  // Process files without timestamps (if useMetadata)
  const filesWithoutTimestamps = allFiles.filter(f => {
    const patternInfo = detectPattern(basename(f));
    return patternInfo.pattern === 'NO_TIMESTAMP';
  });

  let metadataResults = [];
  let _metadataSkipped = [];
  if (filesWithoutTimestamps.length > 0 && options.useMetadata) {
    console.log('Extracting metadata from files without timestamps...');
    const metadataRenameResult = await renameUsingMetadata(targetPath, {
      format: options.format,
      metadataSource: options.metadataSource,
      dryRun: true,
      execute: false,
      timeShiftMs: options.timeShift,
    });
    metadataResults = metadataRenameResult.results || [];
    _metadataSkipped = metadataRenameResult.skippedNoMetadata || [];
  }

  // Display summary by pattern
  console.log('\n📊 Rename Summary by Pattern:\n');

  const byPattern = {};
  for (const proposal of renameProposals) {
    if (!byPattern[proposal.pattern]) {
      byPattern[proposal.pattern] = [];
    }
    byPattern[proposal.pattern].push(proposal);
  }

  for (const [, proposals] of Object.entries(byPattern)) {
    const patternInfo = detectPattern(proposals[0].oldName);
    const icon = patternInfo.hasTime ? '🕐' : patternInfo.hasDate ? '📅' : '❓';
    console.log(`\n${icon} ${patternInfo.description} (${proposals.length} file${proposals.length > 1 ? 's' : ''})`);
    console.log('─'.repeat(60));

    proposals.slice(0, 3).forEach(p => {
      console.log(`  ${p.oldName}`);
      console.log(`  → ${options.copy ? '_c/' : ''}${p.newName}\n`);
    });

    if (proposals.length > 3) {
      console.log(`  ... and ${proposals.length - 3} more file(s)\n`);
    }
  }

  if (metadataResults.length > 0) {
    console.log('\n📅 Files renamed using metadata:');
    console.log('─'.repeat(60));
    metadataResults.slice(0, 3).forEach(r => {
      console.log(`  ${r.oldName}`);
      console.log(`  → ${options.copy ? '_c/' : ''}${r.newName} (${r.source})\n`);
    });

    if (metadataResults.length > 3) {
      console.log(`  ... and ${metadataResults.length - 3} more file(s)\n`);
    }
  }

  const totalChanges = renameProposals.length + metadataResults.length;
  console.log(`\nTotal files to rename: ${totalChanges}`);

  if (totalChanges === 0) {
    console.log('\nNo changes needed. All files are already properly formatted.');
    return;
  }

  // Step 6: Final confirmation
  console.log('\n✅ Step 6: Ready to execute\n');

  let executeNow = true;
  if (options.wizard) {
    executeNow = await promptConfirmation('Execute renaming now?');
  }

  if (!executeNow) {
    console.log('Operation cancelled. No files were renamed.');
    return;
  }

  // Execute renaming
  console.log('\n🚀 Executing renaming...\n');

  // Rename files with timestamps
  if (renameProposals.length > 0) {
    const result = await renameFiles(targetPath, {
      format: options.format,
      dryRun: false,
      execute: true,
      copy: options.copy,
      copyFlat: options.copyFlat,
      timeShiftMs: options.timeShift,
      ambiguityResolution: options.ambiguityResolution,
      interactive: true, // Interactive workflow always uses interactive mode
    });

    const successful = result.results.filter((r) => !r.error).length;
    const failed = result.results.filter((r) => r.error).length;

    console.log(`\n✅ Successfully renamed ${successful} file(s)`);
    if (failed > 0) {
      console.log(`❌ Failed to rename ${failed} file(s)`);
    }

    // Show revert script info
    if (result.revertScriptPath && !options.copy) {
      console.log(`\n💾 Revert script created: ${result.revertScriptPath}`);
      console.log('   Run this script to undo the renaming while preserving timestamps');
    }
  }

  // Rename files using metadata
  if (metadataResults.length > 0) {
    const metadataRenameResult = await renameUsingMetadata(targetPath, {
      format: options.format,
      metadataSource: options.metadataSource,
      dryRun: false,
      execute: true,
      timeShiftMs: options.timeShift,
      copy: options.copy,
    });

    const successful = metadataRenameResult.results.filter(r => !r.error).length;
    const failed = metadataRenameResult.results.filter(r => r.error).length;

    console.log(`✅ Successfully renamed ${successful} file(s) using metadata`);
    if (failed > 0) {
      console.log(`❌ Failed to rename ${failed} file(s)`);
    }
  }

  console.log('\n✨ Interactive workflow completed!\n');
}

// Main function
async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    displayHelp();
    process.exit(0);
  }

  if (!options.path) {
    console.error('Error: Path argument is required');
    console.log('Run "fixts --help" for usage information');
    process.exit(1);
  }

  const targetPath = resolve(options.path);

  if (!existsSync(targetPath)) {
    console.error(`Error: Path does not exist: ${targetPath}`);
    process.exit(1);
  }

  const stats = statSync(targetPath);
  const isDirectory = stats.isDirectory();

  // Handle interactive mode
  if (options.wizard) {
    if (!isDirectory) {
      console.error('Error: --interactive mode requires a directory');
      process.exit(1);
    }

    await interactiveWorkflow(targetPath, options);
    process.exit(0);
  }

  console.log(`\nProcessing: ${basename(targetPath)}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'EXECUTE'}${options.copy ? ' (COPY)' : ''}`);
  console.log(`Format: ${options.format}`);
  if (options.timeShift) {
    console.log(`⏱️  Time Shift: ${formatTimeShift(options.timeShift)}`);
    if (options.dryRun) {
      console.log('    (Preview mode - shows what timestamps will become after shift)');
    }
  }
  console.log('');

  try {
    const result = await renameFiles(targetPath, {
      format: options.format,
      copy: options.copy,
      copyFlat: options.copyFlat,
      dryRun: true, // Always preview first
      timeShiftMs: options.timeShift,
      execute: false, // Don't execute on first pass
      ambiguityResolution: options.ambiguityResolution,
      interactive: options.wizard,
      includeExt: options.includeExt,
      excludeExt: options.excludeExt,
      noRevert: options.noRevert,
    });

    const { results, alreadyFormatted, noTimestamp, withoutTimestamp, skippedAmbiguous, smartStats } = result;

    // Check if no timestamps found at all
    if (noTimestamp) {
      console.log('No files or folders with timestamps found.');

      // Propose to use metadata
      if (!options.useMetadata && !options.dryRun) {
        const result = await promptMetadataFallback(targetPath, {
          format: options.format,
          metadataSource: options.metadataSource,
          timeShiftMs: options.timeShift,
          preview: options.table,
          interactive: options.wizard !== false,
        });

        if (result.success || result.declined) {
          process.exit(result.success ? 0 : 0);
        }
      }

      if (options.useMetadata) {
        const result = await executeMetadataWorkflow(targetPath, {
          format: options.format,
          metadataSource: options.metadataSource,
          timeShiftMs: options.timeShift,
          preview: options.dryRun || options.table,
          interactive: options.wizard !== false,
        });

        process.exit(result.success ? 0 : 0);
      }

      process.exit(0);
    }

    // Check if all files are already formatted
    if (results.length === 0 && alreadyFormatted > 0) {
      console.log(`✓ All ${alreadyFormatted} file(s) and folder(s) are already in the correct format.`);

      // Inform about files without timestamps
      if (withoutTimestamp > 0) {
        console.log(`\nℹ️  Found ${withoutTimestamp} file(s) without timestamps in their names.`);

        // If user explicitly requested metadata scanning, process files without timestamps
        if (options.useMetadata) {
          const result = await executeMetadataWorkflow(targetPath, {
            format: options.format,
            metadataSource: options.metadataSource,
            timeShiftMs: options.timeShift,
            preview: options.dryRun || options.table,
            interactive: options.wizard !== false,
          });

          process.exit(result.success ? 0 : 0);
        } else {
          // Offer to scan metadata
          console.log('💡 Tip: Use --use-metadata to extract dates from file metadata (EXIF, modification time, etc.)');
        }
      }

      process.exit(0);
    }

    // Display changes
    console.log(`Found ${results.length} item(s) to rename:`);
    if (alreadyFormatted > 0) {
      console.log(`(${alreadyFormatted} already in correct format)\n`);
    } else {
      console.log('');
    }

    // Display in table format if --table, otherwise traditional format
    if (options.table) {
      const validResults = results.filter(r => !r.error);
      const errorResults = results.filter(r => r.error);

      if (validResults.length > 0) {
        displayResultsTable(validResults, false, options.copy);
      }

      if (errorResults.length > 0) {
        console.log('\n❌ Errors:');
        errorResults.forEach((item) => {
          console.log(`✗ ${item.oldName} - ERROR: ${item.error}`);
        });
      }
    } else {
      results.forEach((item) => {
        if (item.error) {
          console.log(`✗ ${item.oldName} - ERROR: ${item.error}`);
        } else {
          console.log(`  ${item.oldName}`);
          console.log(`→ ${options.copy ? '_c/' : ''}${item.newName}\n`);
        }
      });
    }

    // Display skipped ambiguous files if any
    if (skippedAmbiguous && skippedAmbiguous.length > 0) {
      console.log(`\n⚠️  Skipped ${skippedAmbiguous.length} file(s) with ambiguous dates:\n`);

      // Group by ambiguity type for clearer display
      const byType = {};
      skippedAmbiguous.forEach(item => {
        const type = item.ambiguity.type;
        if (!byType[type]) {
          byType[type] = [];
        }
        byType[type].push(item);
      });

      // Display each group with its resolution command
      for (const [type, items] of Object.entries(byType)) {
        const resolutionHint = type === 'day-month-order'
          ? 'Use --resolution dd-mm-yyyy (DD-MM-YYYY) or --resolution mm-dd-yyyy (MM-DD-YYYY)'
          : 'Use --resolution 2000s or --resolution 1900s';

        console.log(`  ${type === 'day-month-order' ? 'Day-Month ambiguity' : 'Two-digit year ambiguity'}: ${items.length} file(s)`);
        console.log(`  ${resolutionHint}`);

        items.slice(0, 3).forEach(item => {
          // Show smart suggestion if available
          if (item.smart && item.smart.confidence && item.smart.suggestion) {
            const confidenceIcon = item.smart.confidence >= 70 ? '🟢' : item.smart.confidence >= 50 ? '🟡' : '🔴';
            console.log(`    ${confidenceIcon} ${item.name} (${item.smart.confidence}% confidence)`);
            console.log(`       💡 ${item.smart.suggestion}`);
          } else {
            console.log(`    - ${item.name}`);
          }
        });

        if (items.length > 3) {
          console.log(`    ... and ${items.length - 3} more`);
        }
        console.log('');
      }
    }

    // If dry run, show summary and next steps
    if (options.dryRun) {
      // Process files without timestamps if --use-metadata is enabled (preview only)
      if (options.useMetadata && withoutTimestamp > 0) {
        console.log(`\n📅 Processing ${withoutTimestamp} file(s) without timestamps using metadata...`);
        const metadataResult = await executeMetadataWorkflow(targetPath, {
          format: options.format,
          metadataSource: options.metadataSource,
          timeShiftMs: options.timeShift,
          preview: true,
          copy: options.copy,
          interactive: false, // Don't prompt in dry-run mode
        });

        if (metadataResult.results && metadataResult.results.length > 0) {
          console.log(`\n✓ Found ${metadataResult.results.length} file(s) that can be renamed using metadata\n`);
        }
      }

      console.log('\n' + '─'.repeat(60));
      console.log('📋 SUMMARY');
      console.log('─'.repeat(60));
      console.log(`  ✅ Files to rename: ${results.length}`);
      if (alreadyFormatted > 0) {
        console.log(`  ✓  Already formatted: ${alreadyFormatted}`);
      }
      if (smartStats && smartStats.autoResolved > 0) {
        console.log(`  🤖 Auto-resolved (smart): ${smartStats.autoResolved}`);
      }
      if (skippedAmbiguous && skippedAmbiguous.length > 0) {
        console.log(`  ⚠️  Skipped (ambiguous): ${skippedAmbiguous.length}`);
      }
      if (withoutTimestamp > 0) {
        console.log(`  ℹ️  Without timestamps: ${withoutTimestamp}`);
      }

      // Next steps section
      if ((skippedAmbiguous && skippedAmbiguous.length > 0) || withoutTimestamp > 0 || results.length > 0) {
        console.log('\n' + '─'.repeat(60));
        console.log('🚀 NEXT STEPS');
        console.log('─'.repeat(60));

        if (results.length > 0) {
          console.log('  To apply these changes:');
          console.log(`    fixts "${basename(targetPath)}" --execute`);
          console.log('');
        }

        if (skippedAmbiguous && skippedAmbiguous.length > 0) {
          const hasDayMonth = skippedAmbiguous.some(item => item.ambiguity.type === 'day-month-order');
          const hasYear = skippedAmbiguous.some(item => item.ambiguity.type === 'two-digit-year');

          console.log('  To process ambiguous files:');
          if (hasDayMonth) {
            console.log(`    fixts "${basename(targetPath)}" --resolution dd-mm-yyyy --execute  # For DD-MM-YYYY`);
            console.log(`    fixts "${basename(targetPath)}" --resolution mm-dd-yyyy --execute  # For MM-DD-YYYY`);
          }
          if (hasYear) {
            console.log(`    fixts "${basename(targetPath)}" --resolution 2000s --execute`);
            console.log(`    fixts "${basename(targetPath)}" --resolution 1900s --execute`);
          }
          console.log('  Or use interactive mode:');
          console.log(`    dating "${basename(targetPath)}" --interactive --execute`);
          console.log('');
        }

        if (withoutTimestamp > 0 && !options.useMetadata) {
          console.log('  To process files without timestamps (using metadata):');
          console.log(`    dating "${basename(targetPath)}" --use-metadata --execute`);
          console.log('');
        }

        console.log('─'.repeat(60));
      }

      process.exit(0);
    }

    // Prompt for confirmation in execute mode
    let confirmed = true;
    if (options.wizard !== false) {
      confirmed = await promptConfirmation(
        '\nApply these changes?'
      );
    }

    if (!confirmed) {
      console.log('Operation cancelled.');
      process.exit(0);
    }

    // Apply changes
    const applyResult = await renameFiles(targetPath, {
      format: options.format,
      copy: options.copy,
      copyFlat: options.copyFlat,
      dryRun: false,
      execute: true,
      timeShiftMs: options.timeShift,
      ambiguityResolution: options.ambiguityResolution,
      interactive: options.wizard,
      includeExt: options.includeExt,
      excludeExt: options.excludeExt,
      noRevert: options.noRevert,
    });

    const applyResults = applyResult.results;
    const revertScriptPath = applyResult.revertScriptPath;

    // Show results
    const successful = applyResults.filter((r) => r.success && !r.error).length;
    const failed = applyResults.filter((r) => r.error).length;

    console.log(`\n✓ Successfully ${options.copy ? 'copied' : 'renamed'} ${successful} item(s)`);
    if (failed > 0) {
      console.log(`✗ Failed: ${failed} item(s)`);
    }

    // Show revert script info
    if (revertScriptPath && !options.copy) {
      console.log(`\n💾 Revert script created: ${revertScriptPath}`);
      console.log('   Run this script to undo the renaming while preserving timestamps');
    }

    // Process files without timestamps if --use-metadata is enabled
    if (options.useMetadata && withoutTimestamp > 0) {
      console.log(`\n📅 Processing ${withoutTimestamp} file(s) without timestamps using metadata...`);
      const metadataResult = await executeMetadataWorkflow(targetPath, {
        format: options.format,
        metadataSource: options.metadataSource,
        timeShiftMs: options.timeShift,
        preview: options.dryRun || options.table,
        copy: options.copy,
        interactive: options.wizard !== false,
      });

      if (metadataResult.success) {
        console.log('✓ Metadata processing completed');
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
