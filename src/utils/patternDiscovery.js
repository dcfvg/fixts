import { statSync, readdirSync } from 'fs';
import { join } from 'path';
import { getBestTimestamp } from './heuristicDetector.js';
import { detectAmbiguity } from './ambiguityDetector.js';

/**
 * Discover potential timestamp patterns in filenames (recursive)
 * @param {string} dirPath - Directory to scan
 * @returns {Object} - { knownPatterns: [], unknownPatterns: [], stats: {} }
 */
export function discoverPatterns(dirPath) {
  const patterns = new Map();
  const unknownPatterns = new Map();
  const stats = {
    totalFiles: 0,
    totalDirs: 0,
    filesWithTimestamp: 0,
    filesWithoutTimestamp: 0,
    unrecognizedPatterns: 0,
  };

  function scanDirectory(path) {
    try {
      const items = readdirSync(path);

      items.forEach((item) => {
        // Skip system files
        if (item === '.DS_Store' || item.startsWith('.')) return;

        const fullPath = join(path, item);
        try {
          const itemStats = statSync(fullPath);

          if (itemStats.isDirectory()) {
            stats.totalDirs++;
            // Analyze directory name
            analyzeFilename(item, patterns, unknownPatterns, stats);
            // Recursively scan subdirectories (no depth limit)
            scanDirectory(fullPath);
          } else {
            stats.totalFiles++;
            // Analyze file name
            analyzeFilename(item, patterns, unknownPatterns, stats);
          }
        } catch {
          // Skip files we can't access
        }
      });
    } catch (err) {
      console.error(`Error scanning directory: ${err.message}`);
    }
  }

  scanDirectory(dirPath);

  // Convert Maps to sorted arrays
  const knownPatterns = Array.from(patterns.values())
    .sort((a, b) => b.count - a.count);

  const unknownPatternsArray = Array.from(unknownPatterns.values())
    .sort((a, b) => b.count - a.count);

  return {
    knownPatterns,
    unknownPatterns: unknownPatternsArray,
    stats,
  };
}

/**
 * Analyze a filename for date/time patterns
 * Uses heuristic detection to identify timestamp patterns
 * @param {string} filename - Filename to analyze
 * @param {Map} patterns - Map to store known patterns
 * @param {Map} unknownPatterns - Map to store unrecognized patterns
 * @param {Object} stats - Statistics object
 */
function analyzeFilename(filename, patterns, unknownPatterns, stats) {
  // Try to detect with heuristics
  const timestamp = getBestTimestamp(filename);
  const ambiguity = detectAmbiguity(filename);

  if (timestamp) {
    // Timestamp detected
    stats.filesWithTimestamp++;
    const patternType = timestamp.type || 'UNKNOWN';
    const description = `${patternType} (precision: ${timestamp.precision})${ambiguity ? ' [ambiguous]' : ''}`;
    addPattern(patterns, description, filename, patternType);
  } else {
    // No timestamp - check if there are date-like sequences
    const hasDateLikeSequence = checkForUnknownPatterns(filename, unknownPatterns);

    if (hasDateLikeSequence) {
      stats.unrecognizedPatterns++;
    } else {
      stats.filesWithoutTimestamp++;
    }
  }
}

/**
 * Check for date-like sequences that aren't recognized by genericPatterns
 * @param {string} filename - Filename to analyze
 * @param {Map} unknownPatterns - Map to store unrecognized patterns
 * @returns {boolean} - True if unrecognized date-like pattern found
 */
function checkForUnknownPatterns(filename, unknownPatterns) {
  let foundUnknown = false;

  // Patterns that might be timestamps but aren't recognized
  const potentialPatterns = [
    // Unusual separators or formats
    {
      regex: /(\d{4})[_\-.](\d{2})[_\-.](\d{2})[_\-.](\d{2})[_\-.](\d{2})[_\-.](\d{2})/g,
      structure: 'yyyy?mm?dd?hh?MM?ss',
      description: 'Date-time with mixed/unusual separators',
    },
    {
      regex: /(\d{2})[_\-./](\d{2})[_\-./](\d{2})/g,
      structure: 'yy?mm?dd or dd?mm?yy',
      description: '2-digit date components (ambiguous)',
    },
    {
      regex: /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/g,
      structure: 'yyyymmddThhMMss',
      description: 'Compact ISO with T separator',
    },
    {
      regex: /\b(\d{13})\b/g,
      structure: 'Unix timestamp (milliseconds)',
      description: '13-digit Unix timestamp',
    },
    {
      regex: /\b(\d{16,})\b/g,
      structure: 'Very long number',
      description: 'Possible microsecond timestamp or ID',
    },
    // Month names
    {
      regex: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[_\-.\s]?(\d{1,2})[_\-.\s]?(\d{4}|\d{2})\b/gi,
      structure: 'Mon dd yyyy',
      description: 'Month name with day and year',
    },
    {
      regex: /\b(\d{1,2})[_\-.\s]?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[_\-.\s]?(\d{4}|\d{2})\b/gi,
      structure: 'dd Mon yyyy',
      description: 'Day with month name and year',
    },
    // Unusual formats from specific apps
    {
      regex: /\b([A-Z]{2,10})[_-](\d{6,8})[_-](\d{4,6})\b/gi,
      structure: 'PREFIX_date_time',
      description: 'Prefix with compact date/time',
    },
  ];

  potentialPatterns.forEach(({ regex, structure, description }) => {
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(filename)) !== null) {
      foundUnknown = true;
      const matchedText = match[0];
      const patternKey = `${structure} - ${description}`;
      addUnknownPattern(unknownPatterns, patternKey, filename, matchedText, structure);
    }
  });

  return foundUnknown;
}

/**
 * Add an unknown pattern to the map
 * @param {Map} unknownPatterns - Map of unknown patterns
 * @param {string} patternKey - Pattern key
 * @param {string} filename - Example filename
 * @param {string} match - Matched string
 * @param {string} structure - Pattern structure
 */
function addUnknownPattern(unknownPatterns, patternKey, filename, match, structure) {
  if (!unknownPatterns.has(patternKey)) {
    unknownPatterns.set(patternKey, {
      pattern: patternKey,
      structure,
      count: 0,
      examples: [],
      matches: [],
    });
  }

  const pattern = unknownPatterns.get(patternKey);
  pattern.count++;

  // Keep examples and their matches
  if (pattern.examples.length < 5 && !pattern.examples.includes(filename)) {
    pattern.examples.push(filename);
    pattern.matches.push(match);
  }
}

/**
 * Add a pattern to the map
 * @param {Map} patterns - Map of patterns
 * @param {string} patternName - Name of the pattern
 * @param {string} filename - Example filename
 * @param {string} category - Pattern category from genericPatterns
 */
function addPattern(patterns, patternName, filename, category) {
  if (!patterns.has(patternName)) {
    patterns.set(patternName, {
      pattern: patternName,
      category,
      count: 0,
      examples: [],
    });
  }

  const pattern = patterns.get(patternName);
  pattern.count++;

  // Keep only a few unique examples
  if (pattern.examples.length < 5 && !pattern.examples.includes(filename)) {
    pattern.examples.push(filename);
  }
}

/**
 * Display discovered patterns with statistics
 * @param {Object} result - Result from discoverPatterns
 */
export function displayPatterns(result) {
  const { knownPatterns, unknownPatterns, stats } = result;

  console.log('\n📊 Directory Scan Results:\n');
  console.log(`   Total files scanned: ${stats.totalFiles}`);
  console.log(`   Total directories: ${stats.totalDirs}`);
  console.log(`   Files with known timestamps: ${stats.filesWithTimestamp}`);
  console.log(`   Files with unrecognized patterns: ${stats.unrecognizedPatterns}`);
  console.log(`   Files without timestamps: ${stats.filesWithoutTimestamp}`);

  if (knownPatterns.length > 0) {
    console.log('\n✅ Recognized Timestamp Patterns:\n');

    knownPatterns.forEach((p, index) => {
      console.log(`${index + 1}. ${p.pattern}`);
      console.log(`   Category: ${p.category}`);
      console.log(`   Found: ${p.count} time(s)`);
      console.log('   Examples:');
      p.examples.slice(0, 3).forEach(ex => {
        console.log(`     • ${ex}`);
      });
      console.log('');
    });
  }

  if (unknownPatterns.length > 0) {
    console.log('\n⚠️  Unrecognized Timestamp-Like Patterns:\n');
    console.log('These patterns look like timestamps but are not currently supported:\n');

    unknownPatterns.forEach((p, index) => {
      console.log(`${index + 1}. ${p.pattern}`);
      console.log(`   Structure: ${p.structure}`);
      console.log(`   Found: ${p.count} time(s)`);
      console.log('   Examples with matches:');
      p.examples.slice(0, 3).forEach((ex, i) => {
        console.log(`     • ${ex}`);
        console.log(`       Match: "${p.matches[i]}"`);
      });
      console.log('');
    });

    console.log('\n💡 Suggestions:\n');
    console.log('To add support for these patterns, you can:');
    console.log('1. Add them to `src/config/genericPatterns.js`');
    console.log('2. Update the regex patterns in `TIMESTAMP_PATTERNS` array');
    console.log('3. Test with: npm test -- test/genericPatterns.test.js');
    console.log('\nExample pattern entry:');
    console.log('```javascript');
    console.log('{');
    console.log('  category: PATTERN_CATEGORIES.YOUR_CATEGORY,');
    console.log('  name: "Pattern name",');
    console.log('  description: "Pattern description",');
    console.log('  regex: /your-regex-here/,');
    console.log('  hasTime: true/false,');
    console.log('  hasDate: true/false,');
    console.log('  precision: "second" | "day" | "month" | "year",');
    console.log('  icon: "🕐",');
    console.log('  priority: 10, // Lower = higher priority');
    console.log('}');
    console.log('```\n');
  }

  if (knownPatterns.length === 0 && unknownPatterns.length === 0) {
    console.log('\n❌ No timestamp patterns found in this directory.\n');
  } else {
    console.log(`\n📈 Summary: ${knownPatterns.length} known pattern(s), ${unknownPatterns.length} unrecognized pattern(s)\n`);
  }
}
