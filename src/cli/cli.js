#!/usr/bin/env node

/* Node.js-only module - CLI entry point */
/**
 * @module cli
 * @browserSafe false
 * @requires fs
 * @requires path
 * @description CLI entry point
 * NOTE: This CLI entry point is Node.js-specific by design.
 * Phase 3 architecture: Core logic in ../core/ is execution-agnostic where possible.
 * FileSystemAdapter pattern available in ../adapters/ for future platform extensions.
 */

import { resolve, basename, dirname } from 'path';
import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { rename as renameFiles, renameUsingMetadata } from '../core/renamer.js';
import { groupByPattern, createSummary, displaySummary, displayGroup, detectPattern } from '../utils/fileGrouper.js';
import { generateNewName } from '../core/formatter.js';
import { parseTimeShift, formatTimeShift } from '../utils/timeShift.js';
import { promptConfirmation } from './prompts.js';
import { executeMetadataWorkflow, promptMetadataFallback } from './metadataWorkflow.js';
import { logger } from '../utils/logger.js';
import { loadConfig, mergeConfig, validateConfig } from '../config/configLoader.js';

// Parse command line arguments
function parseArgs(args) {
  const cliArgs = {
    path: null,
    configPath: null, // Custom config file path
    undo: false, // Execute revert script
    dryRun: true, // dry-run by default
    copy: false,
    format: 'yyyy-mm-dd hh.MM.ss', // default format
    useMetadata: false, // use file metadata when no timestamp in name
    metadataSource: 'content', // 'content' (EXIF priority), 'birthtime', 'earliest'
    table: false, // show detailed table format
    wizard: false, // Non-interactive mode by default
    help: false,
    verbose: false, // Enable debug logging
    quiet: false, // Suppress all but errors
    timeShift: null, // Time shift in milliseconds
    ambiguityResolution: {}, // Preset ambiguity resolutions
    includeExt: [], // Include only these extensions/directories
    excludeExt: [], // Exclude these extensions/directories
    noRevert: false, // Skip revert script generation
    copyFlat: false, // Flatten directory structure in copy mode
    depth: Infinity, // Recursion depth (Infinity = unlimited, 1 = root only)
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      cliArgs.help = true;
    } else if (arg === '--undo') {
      cliArgs.undo = true;
    } else if (arg === '--config') {
      if (i + 1 < args.length) {
        cliArgs.configPath = args[++i];
      } else {
        logger.error('❌ --config requires a file path');
        process.exit(1);
      }
    } else if (arg === '--wizard' || arg === '-w') {
      cliArgs.wizard = true;
    } else if (arg === '--verbose' || arg === '-v') {
      cliArgs.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      cliArgs.quiet = true;
    } else if (arg === '--no-revert') {
      cliArgs.noRevert = true;
    } else if (arg === '--dry-run' || arg === '-d') {
      cliArgs.dryRun = true;
    } else if (arg === '--execute' || arg === '-e') {
      cliArgs.dryRun = false;
    } else if (arg === '--copy' || arg === '-c') {
      cliArgs.copy = true;
    } else if (arg === '--copy-flat') {
      cliArgs.copy = true;
      cliArgs.copyFlat = true;
    } else if (arg === '--shift' || arg === '--delay') {
      if (i + 1 < args.length) {
        const shiftStr = args[++i];
        cliArgs.timeShift = parseTimeShift(shiftStr);
        if (cliArgs.timeShift === null) {
          logger.error(`❌ Invalid time shift format: ${shiftStr}`);
          logger.error('   Use format like: +2h30m, -1d3h, +45m, -30s');
          logger.error('   Examples: +2h (add 2 hours), -1d (remove 1 day), +30m (add 30 minutes)');
          process.exit(1);
        }
        // Force copy mode when using time shift (safety feature)
        cliArgs.copy = true;
      }
    } else if (arg === '--use-metadata' || arg === '-m') {
      cliArgs.useMetadata = true;
      // Check if next arg is a metadata source (not a flag or path)
      if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        const validSources = ['content', 'exif', 'birthtime', 'creation', 'earliest'];
        const lowerNext = nextArg.toLowerCase();

        if (validSources.includes(lowerNext)) {
          i++; // consume the source argument
          // Normalize aliases
          if (lowerNext === 'exif') {
            cliArgs.metadataSource = 'content';
          } else if (lowerNext === 'creation') {
            cliArgs.metadataSource = 'birthtime';
          } else {
            cliArgs.metadataSource = lowerNext;
          }
        }
      }
    } else if (arg === '--table' || arg === '-t') {
      cliArgs.table = true;
    } else if (arg === '--format' || arg === '-f') {
      if (i + 1 < args.length) {
        cliArgs.format = args[++i];
      }
    } else if (arg === '--resolution' || arg === '-r') {
      if (i + 1 < args.length) {
        const resolution = args[++i].toLowerCase();
        // Parse resolution values
        if (resolution === 'dd-mm-yyyy' || resolution === 'eu' || resolution === 'european') {
          cliArgs.ambiguityResolution.dateFormat = 'dd-mm-yyyy';
        } else if (resolution === 'mm-dd-yyyy' || resolution === 'us' || resolution === 'american') {
          cliArgs.ambiguityResolution.dateFormat = 'mm-dd-yyyy';
        } else if (resolution === '2000s' || resolution === '2000' || resolution === '20xx') {
          cliArgs.ambiguityResolution.century = '2000s';
        } else if (resolution === '1900s' || resolution === '1900' || resolution === '19xx') {
          cliArgs.ambiguityResolution.century = '1900s';
        } else {
          logger.error(`❌ Invalid resolution value: ${resolution}`);
          logger.error('   Valid values: dd-mm-yyyy, mm-dd-yyyy, 2000s, 1900s');
          logger.error('   Aliases: eu/european, us/american, 20xx, 19xx');
          process.exit(1);
        }
      }
    } else if (arg === '--include-ext' || arg === '-i') {
      // Collect all following non-flag arguments as extensions/directories
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        const value = args[++i];
        // If value has a dot, it's an extension (remove dot); otherwise it's a directory name
        cliArgs.includeExt.push(value.startsWith('.') ? value.slice(1).toLowerCase() : value);
      }
    } else if (arg === '--exclude-ext' || arg === '-x') {
      // Collect all following non-flag arguments as extensions/directories
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        const value = args[++i];
        // If value has a dot, it's an extension (remove dot); otherwise it's a directory name
        cliArgs.excludeExt.push(value.startsWith('.') ? value.slice(1).toLowerCase() : value);
      }
    } else if (arg === '--depth') {
      if (i + 1 < args.length) {
        const depthValue = parseInt(args[++i], 10);
        if (isNaN(depthValue) || depthValue < 1) {
          logger.error(`❌ Invalid depth value: ${args[i]}`);
          logger.error('   Depth must be a positive integer (1 = root only, 2 = root + 1 level, etc.)');
          process.exit(1);
        }
        cliArgs.depth = depthValue;
      }
    } else if (!cliArgs.path) {
      cliArgs.path = arg;
    }
  }

  return cliArgs;
}

// Display help message
function displayHelp() {
  logger.info(`
fixts - Normalize filenames and folders with timestamps

Usage:
  fixts <path> [options]

Arguments:
  <path>                Path to file or directory to process

Options:
  --config <path>      Load configuration from specified file
                       If not specified, searches for:
                       • .fixtsrc, .fixtsrc.json (current directory)
                       • ~/.fixtsrc, ~/.config/fixts/config.json (user directory)
  --undo               Undo the last renaming operation by executing revert.sh
                       Looks for revert.sh in the target directory
                       Restores original filenames with timestamps preserved
  --dry-run            Show changes without applying them (default)
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
  -i, --include-ext <items...>  Include only specified items (extensions and/or 'dir')
                       Use 'dir' keyword to include directories in processing
                       Examples:
                         -i jpg png jpeg    Include only .jpg, .png, .jpeg files
                         -i dir             Include only directories (no files)
                         -i jpg dir pdf     Include .jpg, .pdf files AND directories
  -x, --exclude-ext <items...>  Exclude specified items (extensions and/or 'dir')
                       Use 'dir' keyword to exclude all directories
                       Examples:
                         -x pdf docx        Exclude .pdf and .docx files
                         -x dir             Exclude all directories (files only)
                         -x mp3 dir txt     Exclude .mp3, .txt files AND directories
                       Note: Exclusion takes priority over inclusion
  -d, --depth <n>      Maximum recursion depth (default: unlimited)
                       Examples:
                         -d 1               Process only root level (no subdirectories)
                         -d 2               Process root + 1 level of subdirectories
                         -d 3               Process root + 2 levels of subdirectories
  -w, --wizard         Enable wizard mode with prompts for ambiguities
  --no-revert          Skip revert script generation (faster for large batches)
  -v, --verbose        Enable debug logging (show detailed processing information)
  -q, --quiet          Suppress all output except errors
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
  fixts ./photos --shift +2h --execute        # Correct camera clock error
  fixts ./files --shift -1d --execute         # Remove 1 day from all dates
  fixts ./images -i jpg png jpeg --execute    # Process only image files
  fixts ./docs -x pdf docx --execute          # Exclude documents
  fixts ./project -x dir --execute            # Process files only (no directories)
  fixts ./folders -i dir --execute            # Process directories only (no files)
  fixts ./mixed -i jpg dir pdf --execute      # Process .jpg, .pdf AND directories
  fixts ./deep-folder -d 2 --execute          # Process only 2 levels deep

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
  logger.info(topBorder);
  if (showSource) {
    logger.info(`│ ${'Original File'.padEnd(maxOldName)} │ ${'Source'.padEnd(maxSource)} │ ${'New Name'.padEnd(maxNewName)} │`);
  } else {
    logger.info(`│ ${'Original File'.padEnd(maxOldName)} │ ${'New Name'.padEnd(maxNewName)} │`);
  }
  logger.info(separator);

  // Rows
  results.forEach((item, index) => {
    const oldName = truncate(item.oldName, maxOldName);
    const displayNewName = (copyMode ? '_c/' : '') + item.newName;
    const newName = truncate(displayNewName, maxNewName);

    if (showSource) {
      const source = truncate(item.source || 'timestamp', maxSource);
      logger.info(`│ ${oldName} │ ${source} │ ${newName} │`);
    } else {
      logger.info(`│ ${oldName} │ ${newName} │`);
    }

    // Add separator every 10 rows for readability (but not after last row)
    if ((index + 1) % 10 === 0 && index !== results.length - 1) {
      logger.info(separator);
    }
  });

  logger.info(bottomBorder);
}

/**
 * Interactive workflow with pattern analysis and step-by-step confirmation
 * @param {string} targetPath - Path to directory to process
 * @param {Object} options - CLI options
 */
async function interactiveWorkflow(targetPath, options) {
  logger.info('\n🔍 Step 1: Scanning directory...\n');

  // Read all files from directory (excluding system files)
  const allFiles = readdirSync(targetPath)
    .filter(f => !f.startsWith('.') && f !== 'Thumbs.db')
    .map(f => join(targetPath, f));

  if (allFiles.length === 0) {
    logger.info('No files found in directory.');
    return;
  }

  logger.info(`Found ${allFiles.length} files\n`);

  // Step 2: Group files by pattern
  logger.info('📊 Step 2: Analyzing timestamp patterns...\n');
  const fileObjects = allFiles.map(f => ({ name: basename(f), path: f }));
  const groups = groupByPattern(fileObjects);
  const summary = createSummary(groups);
  displaySummary(summary);

  // Show details for each group
  logger.info('\n📋 Pattern Details:\n');
  for (const [, group] of groups.entries()) {
    displayGroup(group, 3);
  }

  // Step 3: Handle ambiguous dates
  if (summary.hasAmbiguous) {
    logger.info('\n⚠️  Step 3: Resolving ambiguous dates...\n');

    // Check if we have preset resolutions
    const hasPresetResolutions = options.ambiguityResolution &&
      (options.ambiguityResolution.dateFormat || options.ambiguityResolution.century);

    if (hasPresetResolutions) {
      logger.info('✓ Using preset ambiguity resolutions:');
      if (options.ambiguityResolution.dateFormat) {
        logger.info(`  - Date format: ${options.ambiguityResolution.dateFormat}`);
      }
      if (options.ambiguityResolution.century) {
        logger.info(`  - Two-digit years: ${options.ambiguityResolution.century}`);
      }
      logger.info('');
    } else if (options.wizard) {
      logger.info('Some files have ambiguous date formats (e.g., 01-12-2023 could be Jan 12 or Dec 1).');
      logger.info('The system will prompt you for clarification when processing these files.\n');

      const continueAmbiguous = await promptConfirmation('Continue with ambiguity resolution?');
      if (!continueAmbiguous) {
        logger.info('Operation cancelled.');
        return;
      }
    } else {
      logger.info('⚠️  Warning: Ambiguous dates detected but no resolution provided.');
      logger.info('   Use --resolution flags to specify how to handle ambiguous dates.');
      logger.info('   Examples: --resolution eu --resolution 2000s\n');
    }
  }

  // Step 4: Handle files without timestamps
  if (summary.needsMetadata) {
    logger.info('\n📅 Step 4: Files without timestamps detected\n');
    const noTimestampGroup = groups.get('NO_TIMESTAMP');
    if (noTimestampGroup) {
      logger.info(`Found ${noTimestampGroup.count} file(s) without timestamps:`);
      displayGroup(noTimestampGroup, 5);
      logger.info('\nThese files will be renamed using metadata (EXIF, mtime, birthtime).');
      logger.info(`Metadata source: ${options.metadataSource || 'earliest'}\n`);
    }
  } else {
    logger.info('\n✅ Step 4: All files have timestamps in filename\n');
  }

  // Step 5: Generate rename proposals and show summary
  logger.info('📝 Step 5: Generating rename proposals...\n');

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
    logger.info('Extracting metadata from files without timestamps...');
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
  logger.info('\n📊 Rename Summary by Pattern:\n');

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
    logger.info(`\n${icon} ${patternInfo.description} (${proposals.length} file${proposals.length > 1 ? 's' : ''})`);
    logger.info('─'.repeat(60));

    proposals.slice(0, 3).forEach(p => {
      logger.info(`  ${p.oldName}`);
      logger.info(`  → ${options.copy ? '_c/' : ''}${p.newName}\n`);
    });

    if (proposals.length > 3) {
      logger.info(`  ... and ${proposals.length - 3} more file(s)\n`);
    }
  }

  if (metadataResults.length > 0) {
    logger.info('\n📅 Files renamed using metadata:');
    logger.info('─'.repeat(60));
    metadataResults.slice(0, 3).forEach(r => {
      logger.info(`  ${r.oldName}`);
      logger.info(`  → ${options.copy ? '_c/' : ''}${r.newName} (${r.source})\n`);
    });

    if (metadataResults.length > 3) {
      logger.info(`  ... and ${metadataResults.length - 3} more file(s)\n`);
    }
  }

  const totalChanges = renameProposals.length + metadataResults.length;
  logger.info(`\nTotal files to rename: ${totalChanges}`);

  if (totalChanges === 0) {
    logger.info('\nNo changes needed. All files are already properly formatted.');
    return;
  }

  // Step 6: Final confirmation
  logger.info('\n✅ Step 6: Ready to execute\n');

  let executeNow = true;
  if (options.wizard) {
    executeNow = await promptConfirmation('Execute renaming now?');
  }

  if (!executeNow) {
    logger.info('Operation cancelled. No files were renamed.');
    return;
  }

  // Execute renaming
  logger.info('\n🚀 Executing renaming...\n');

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
      includeExt: options.includeExt,
      excludeExt: options.excludeExt,
      depth: options.depth,
    });

    const successful = result.results.filter((r) => !r.error).length;
    const failed = result.results.filter((r) => r.error).length;

    logger.info(`\n✅ Successfully renamed ${successful} file(s)`);
    if (failed > 0) {
      logger.info(`❌ Failed to rename ${failed} file(s)`);
    }

    // Show revert script info
    if (result.revertScriptPath && !options.copy) {
      logger.info(`\n💾 Revert script created: ${result.revertScriptPath}`);
      logger.info('   Run this script to undo the renaming while preserving timestamps');
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

    logger.info(`✅ Successfully renamed ${successful} file(s) using metadata`);
    if (failed > 0) {
      logger.info(`❌ Failed to rename ${failed} file(s)`);
    }
  }

  logger.info('\n✨ Interactive workflow completed!\n');
}

// Main function
async function main() {
  const cliArgs = parseArgs(process.argv);

  // Load and merge configuration
  const configFile = loadConfig(cliArgs.configPath);
  const defaults = {
    dryRun: true,
    copy: false,
    format: 'yyyy-mm-dd hh.MM.ss',
    useMetadata: false,
    metadataSource: 'content',
    table: false,
    wizard: false,
    verbose: false,
    quiet: false,
    noRevert: false,
    copyFlat: false,
    depth: Infinity,
    includeExt: [],
    excludeExt: [],
  };

  const options = mergeConfig(defaults, configFile, cliArgs);

  // Validate merged config
  const validation = validateConfig(options);
  if (!validation.valid) {
    logger.error('❌ Configuration validation failed:');
    validation.errors.forEach(error => logger.error(`   ${error}`));
    process.exit(1);
  }

  // Configure logger for CLI mode
  logger.enableCliMode();
  if (options.verbose) {
    logger.setVerbose(true);
  } else if (options.quiet) {
    logger.setQuiet(true);
  }

  if (options.help) {
    displayHelp();
    process.exit(0);
  }

  if (!options.path) {
    logger.error('Error: Path argument is required');
    logger.info('Run "fixts --help" for usage information');
    process.exit(1);
  }

  const targetPath = resolve(options.path);

  if (!existsSync(targetPath)) {
    logger.error(`Error: Path does not exist: ${targetPath}`);
    process.exit(1);
  }

  const stats = statSync(targetPath);
  const isDirectory = stats.isDirectory();

  // Handle undo command
  if (options.undo) {
    const { execSync } = await import('child_process');
    const revertScriptPath = isDirectory
      ? join(targetPath, 'revert.sh')
      : join(dirname(targetPath), 'revert.sh');

    if (!existsSync(revertScriptPath)) {
      logger.error(`❌ No revert script found at: ${revertScriptPath}`);
      logger.error('   Revert scripts are created when you execute renaming operations.');
      logger.error('   Make sure you\'re in the correct directory where the renaming was performed.');
      process.exit(1);
    }

    logger.info('\n🔄 Undoing previous renaming operation...');
    logger.info(`Revert script: ${revertScriptPath}\n`);

    // Prompt for confirmation
    const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
    if (isInteractive) {
      const confirmed = await promptConfirmation(
        'Are you sure you want to undo the previous renaming? This will restore original filenames.'
      );

      if (!confirmed) {
        logger.info('Undo operation cancelled.');
        process.exit(0);
      }
    }

    try {
      // Execute the revert script
      logger.info('Executing revert script...\n');
      execSync(`bash "${revertScriptPath}"`, {
        stdio: 'inherit',
        cwd: isDirectory ? targetPath : dirname(targetPath)
      });

      logger.info('\n✅ Successfully restored original filenames!');
      logger.info(`\n💡 The revert script has been kept at: ${revertScriptPath}`);
      logger.info('   You can delete it manually if no longer needed.');
    } catch (error) {
      logger.error(`\n❌ Failed to execute revert script: ${error.message}`);
      logger.error('   You can try running the script manually:');
      logger.error(`   bash "${revertScriptPath}"`);
      process.exit(1);
    }

    process.exit(0);
  }

  // Handle interactive mode
  if (options.wizard) {
    if (!isDirectory) {
      logger.error('Error: --interactive mode requires a directory');
      process.exit(1);
    }

    await interactiveWorkflow(targetPath, options);
    process.exit(0);
  }

  logger.info(`\nProcessing: ${basename(targetPath)}`);
  logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'EXECUTE'}${options.copy ? ' (COPY)' : ''}`);
  logger.info(`Format: ${options.format}`);
  if (options.timeShift) {
    logger.info(`⏱️  Time Shift: ${formatTimeShift(options.timeShift)}`);
    if (options.dryRun) {
      logger.info('    (Preview mode - shows what timestamps will become after shift)');
    }
  }
  logger.info('');

  // Progress tracking for large batches
  let lastProgressUpdate = Date.now();
  const categories = {
    detected: 0,
    alreadyFormatted: 0,
    noTimestamp: 0,
  };

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
      depth: options.depth,
      noRevert: options.noRevert,
      // Phase 1: Progress reporting
      onProgress: (info) => {
        const now = Date.now();
        // Update every 100ms to avoid spam
        if (now - lastProgressUpdate > 100) {
          const percentage = Math.round(info.percentage * 100);
          const speed = Math.round(info.filesPerSecond);
          process.stdout.write(
            `\r   📊 Processing: ${info.completed}/${info.total} ` +
            `(${percentage}%) • ${speed} files/s`
          );
          lastProgressUpdate = now;
        }

        // Clear line when done
        if (info.completed === info.total) {
          process.stdout.write('\r' + ' '.repeat(80) + '\r');
        }
      },
      // Phase 2: Real-time categorization
      onItemProcessed: (filename, result, _index) => {
        if (result && result.timestamp) {
          categories.detected++;
        } else {
          categories.noTimestamp++;
        }

        // Verbose mode: show per-file output
        if (options.verbose) {
          const status = (result && result.timestamp) ? '✓' : '✗';
          const detail = (result && result.timestamp)
            ? ` → ${result.newName || 'processing...'}`
            : ' (no timestamp)';
          logger.info(`   ${status} ${filename}${detail}`);
        }
      },
    });

    const { results, alreadyFormatted, noTimestamp, withoutTimestamp, skippedAmbiguous, smartStats } = result;

    // Check if no timestamps found at all
    if (noTimestamp) {
      logger.info('No files or folders with timestamps found.');

      // Propose to use metadata
      if (!options.useMetadata && !options.dryRun) {
        const result = await promptMetadataFallback(targetPath, {
          format: options.format,
          metadataSource: options.metadataSource,
          timeShiftMs: options.timeShift,
          preview: options.table,
          interactive: options.wizard !== false,
        });

        if (result.declined) {
          process.exit(0);
        }

        process.exit(result.success ? 0 : 1);
      }

      if (options.useMetadata) {
        const result = await executeMetadataWorkflow(targetPath, {
          format: options.format,
          metadataSource: options.metadataSource,
          timeShiftMs: options.timeShift,
          preview: options.dryRun || options.table,
          interactive: options.wizard !== false,
        });

        process.exit(result.success ? 0 : 1);
      }

      process.exit(0);
    }

    // Check if all files are already formatted
    if (results.length === 0 && alreadyFormatted > 0) {
      logger.info(`✓ All ${alreadyFormatted} file(s) and folder(s) are already in the correct format.`);

      // Inform about files without timestamps
      if (withoutTimestamp > 0) {
        logger.info(`\nℹ️  Found ${withoutTimestamp} file(s) without timestamps in their names.`);

        // If user explicitly requested metadata scanning, process files without timestamps
        if (options.useMetadata) {
          const result = await executeMetadataWorkflow(targetPath, {
            format: options.format,
            metadataSource: options.metadataSource,
            timeShiftMs: options.timeShift,
            preview: options.dryRun || options.table,
            interactive: options.wizard !== false,
          });

          process.exit(result.success ? 0 : 1);
        } else {
          // Offer to scan metadata
          logger.info('💡 Tip: Use --use-metadata to extract dates from file metadata (EXIF, modification time, etc.)');
        }
      }

      process.exit(0);
    }

    // Display changes
    logger.info(`Found ${results.length} item(s) to rename:`);
    if (alreadyFormatted > 0) {
      logger.info(`(${alreadyFormatted} already in correct format)\n`);
    } else {
      logger.info('');
    }

    // Display in table format if --table, otherwise traditional format
    if (options.table) {
      const validResults = results.filter(r => !r.error);
      const errorResults = results.filter(r => r.error);

      if (validResults.length > 0) {
        displayResultsTable(validResults, false, options.copy);
      }

      if (errorResults.length > 0) {
        logger.info('\n❌ Errors:');
        errorResults.forEach((item) => {
          logger.info(`✗ ${item.oldName} - ERROR: ${item.error}`);
        });
      }
    } else {
      results.forEach((item) => {
        if (item.error) {
          logger.info(`✗ ${item.oldName} - ERROR: ${item.error}`);
        } else {
          logger.info(`  ${item.oldName}`);
          logger.info(`→ ${options.copy ? '_c/' : ''}${item.newName}\n`);
        }
      });
    }

    // Display skipped ambiguous files if any
    if (skippedAmbiguous && skippedAmbiguous.length > 0) {
      logger.info(`\n⚠️  Skipped ${skippedAmbiguous.length} file(s) with ambiguous dates:\n`);

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

        logger.info(`  ${type === 'day-month-order' ? 'Day-Month ambiguity' : 'Two-digit year ambiguity'}: ${items.length} file(s)`);
        logger.info(`  ${resolutionHint}`);

        items.slice(0, 3).forEach(item => {
          // Show smart suggestion if available
          if (item.smart && item.smart.confidence && item.smart.suggestion) {
            const confidenceIcon = item.smart.confidence >= 70 ? '🟢' : item.smart.confidence >= 50 ? '🟡' : '🔴';
            logger.info(`    ${confidenceIcon} ${item.name} (${item.smart.confidence}% confidence)`);
            logger.info(`       💡 ${item.smart.suggestion}`);
          } else {
            logger.info(`    - ${item.name}`);
          }
        });

        if (items.length > 3) {
          logger.info(`    ... and ${items.length - 3} more`);
        }
        logger.info('');
      }
    }

    // If dry run, show summary and next steps
    if (options.dryRun) {
      // Process files without timestamps if --use-metadata is enabled (preview only)
      let metadataFilesFound = 0;
      if (options.useMetadata && withoutTimestamp > 0) {
        logger.info(`\n📅 Processing ${withoutTimestamp} file(s) without timestamps using metadata...`);
        const metadataResult = await executeMetadataWorkflow(targetPath, {
          format: options.format,
          metadataSource: options.metadataSource,
          timeShiftMs: options.timeShift,
          preview: true,
          copy: options.copy,
          interactive: false, // Don't prompt in dry-run mode
        });

        if (metadataResult.results && metadataResult.results.length > 0) {
          metadataFilesFound = metadataResult.results.length;
          logger.info(`\n✓ Found ${metadataFilesFound} file(s) that can be renamed using metadata\n`);
        }
      }

      logger.info('\n' + '─'.repeat(60));
      logger.info('📋 SUMMARY');
      logger.info('─'.repeat(60));

      // Calculate total files that can be renamed (filename + metadata)
      const totalToRename = results.length + metadataFilesFound;
      const remainingWithoutTimestamp = withoutTimestamp - metadataFilesFound;

      logger.info(`  ✅ Files to rename: ${totalToRename}`);
      if (results.length > 0) {
        logger.info(`     • From filename: ${results.length}`);
      }
      if (metadataFilesFound > 0) {
        logger.info(`     • From metadata: ${metadataFilesFound}`);
      }
      if (alreadyFormatted > 0) {
        logger.info(`  ✓  Already formatted: ${alreadyFormatted}`);
      }
      if (smartStats && smartStats.autoResolved > 0) {
        logger.info(`  🤖 Auto-resolved (smart): ${smartStats.autoResolved}`);
      }
      if (skippedAmbiguous && skippedAmbiguous.length > 0) {
        logger.info(`  ⚠️  Skipped (ambiguous): ${skippedAmbiguous.length}`);
      }
      if (remainingWithoutTimestamp > 0) {
        logger.info(`  ℹ️  Without timestamps: ${remainingWithoutTimestamp}`);
      }

      // Next steps section
      if ((skippedAmbiguous && skippedAmbiguous.length > 0) || remainingWithoutTimestamp > 0 || totalToRename > 0) {
        logger.info('\n' + '─'.repeat(60));
        logger.info('🚀 NEXT STEPS');
        logger.info('─'.repeat(60));

        if (totalToRename > 0) {
          logger.info('  To apply these changes:');
          logger.info(`    fixts "${basename(targetPath)}" --use-metadata --execute`);
          logger.info('');
        }

        if (skippedAmbiguous && skippedAmbiguous.length > 0) {
          const hasDayMonth = skippedAmbiguous.some(item => item.ambiguity.type === 'day-month-order');
          const hasYear = skippedAmbiguous.some(item => item.ambiguity.type === 'two-digit-year');

          logger.info('  To process ambiguous files:');
          if (hasDayMonth) {
            logger.info(`    fixts "${basename(targetPath)}" --resolution dd-mm-yyyy --execute  # For DD-MM-YYYY`);
            logger.info(`    fixts "${basename(targetPath)}" --resolution mm-dd-yyyy --execute  # For MM-DD-YYYY`);
          }
          if (hasYear) {
            logger.info(`    fixts "${basename(targetPath)}" --resolution 2000s --execute`);
            logger.info(`    fixts "${basename(targetPath)}" --resolution 1900s --execute`);
          }
          logger.info('  Or use interactive mode:');
          logger.info(`    fixts "${basename(targetPath)}" --wizard --execute`);
          logger.info('');
        }

        if (remainingWithoutTimestamp > 0 && !options.useMetadata) {
          logger.info('  To process files without timestamps (using metadata):');
          logger.info(`    fixts "${basename(targetPath)}" --use-metadata --execute`);
          logger.info('');
        }

        logger.info('─'.repeat(60));
      }

      process.exit(0);
    }

    // Prompt for confirmation in execute mode
    // Skip confirmation if no TTY (non-interactive environment like tests)
    let confirmed = true;
    const isInteractive = process.stdin.isTTY && process.stdout.isTTY;

    if (isInteractive && options.wizard !== false) {
      confirmed = await promptConfirmation(
        '\nApply these changes?'
      );
    } else if (!isInteractive) {
      // In non-interactive environments (CI, tests, pipes), auto-confirm
      logger.info('Non-interactive mode detected - applying changes automatically');
    }

    if (!confirmed) {
      logger.info('Operation cancelled.');
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
      depth: options.depth,
      noRevert: options.noRevert,
    });

    const applyResults = applyResult.results;
    const revertScriptPath = applyResult.revertScriptPath;

    // Show results
    const successful = applyResults.filter((r) => r.success && !r.error).length;
    const failed = applyResults.filter((r) => r.error).length;

    logger.info(`\n✓ Successfully ${options.copy ? 'copied' : 'renamed'} ${successful} item(s)`);
    if (failed > 0) {
      logger.info(`✗ Failed: ${failed} item(s)`);
    }

    // Show revert script info
    if (revertScriptPath && !options.copy) {
      logger.info(`\n💾 Revert script created: ${revertScriptPath}`);
      logger.info('   Run this script to undo the renaming while preserving timestamps');
    }

    // Process files without timestamps if --use-metadata is enabled
    if (options.useMetadata && withoutTimestamp > 0) {
      logger.info(`\n📅 Processing ${withoutTimestamp} file(s) without timestamps using metadata...`);
      const metadataResult = await executeMetadataWorkflow(targetPath, {
        format: options.format,
        metadataSource: options.metadataSource,
        timeShiftMs: options.timeShift,
        preview: options.dryRun || options.table,
        copy: options.copy,
        interactive: options.wizard !== false,
      });

      if (metadataResult.success) {
        logger.info('✓ Metadata processing completed');
      }
    }
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
