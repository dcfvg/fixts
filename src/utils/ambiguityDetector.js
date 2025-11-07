import readline from 'readline';
import { getBestTimestamp } from './heuristicDetector.js';

/**
 * Detect potential ambiguities in date parsing
 *
 * This function identifies dates that COULD be interpreted multiple ways,
 * even if the heuristic has already resolved them based on user preferences.
 * Useful for warnings, user prompts, or analysis.
 *
 * @param {string} filename - Filename to analyze
 * @param {Object} options - Detection options
 * @param {string} options.dateFormat - Date format preference: 'dmy' or 'mdy'
 * @returns {Object|null} - Ambiguity info or null if none detected
 */
export function detectAmbiguity(filename, options = {}) {
  const { dateFormat = 'dmy' } = options;

  // First, try heuristic detection for compact formats (truly ambiguous)
  const timestamp = getBestTimestamp(filename, { dateFormat });

  if (timestamp && timestamp.ambiguous && timestamp.type === 'COMPACT_AMBIGUOUS') {
    // Compact format ambiguity (e.g., 05062024)
    const alt1 = timestamp.alternatives[0]; // European
    const alt2 = timestamp.alternatives[1]; // US

    return {
      type: 'day-month-order',
      pattern: filename.substring(timestamp.start, timestamp.end),
      first: timestamp.day,   // Currently interpreted as day (DMY)
      second: timestamp.month, // Currently interpreted as month (DMY)
      filename,
      options: [
        { label: alt1.format, value: 'dmy' },
        { label: alt2.format, value: 'mdy' }
      ],
      heuristicInfo: timestamp
    };
  }

  // For separated formats, check if they WOULD be ambiguous
  // (even though heuristic resolves them via dateFormat option)
  // This is useful for warning users about their data
  const separatedPattern = /(\d{2})[-_/](\d{2})[-_/](\d{4})/;
  const match = filename.match(separatedPattern);

  if (match) {
    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);

    // Both could be valid days/months (1-12)
    if (first >= 1 && first <= 12 && second >= 1 && second <= 12) {
      return {
        type: 'day-month-order',
        pattern: match[0],
        first,
        second,
        filename,
        options: [
          { label: 'DD-MM-YYYY (European)', value: 'dmy' },
          { label: 'MM-DD-YYYY (US)', value: 'mdy' }
        ],
        note: 'Resolved by dateFormat option, but flagged for awareness'
      };
    }
  }

  return null;
}

/**
 * Prompt user to resolve ambiguity
 * @param {Object} ambiguity - Ambiguity info from detectAmbiguity
 * @returns {Promise<string>} - User's choice
 */
export async function promptAmbiguityResolution(ambiguity) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log(`\n⚠️  Ambiguous date format detected in: ${ambiguity.filename}`);
    console.log(`   Pattern: ${ambiguity.pattern}\n`);

    if (ambiguity.type === 'day-month-order') {
      console.log(`   Is "${ambiguity.first}-${ambiguity.second}" day-month or month-day?\n`);
    } else if (ambiguity.type === 'two-digit-year') {
      console.log(`   Is "${ambiguity.year}" from 19xx or 20xx?\n`);
    }

    ambiguity.options.forEach((option, index) => {
      console.log(`   ${index + 1}. ${option.label}`);
    });
    console.log('   s. Skip this file\n');

    rl.question('Your choice (1-2, s): ', (answer) => {
      rl.close();

      const trimmed = answer.trim().toLowerCase();

      if (trimmed === 's') {
        resolve('skip');
      } else {
        const choice = parseInt(trimmed, 10);
        if (choice >= 1 && choice <= ambiguity.options.length) {
          resolve(ambiguity.options[choice - 1].value);
        } else {
          resolve('skip');
        }
      }
    });
  });
}

/**
 * Batch process ambiguities for multiple files
 * In interactive mode, prompts once per ambiguity type and applies to all similar files
 * @param {Array<string>} filenames - List of filenames to check
 * @param {Object} presetResolutions - Optional preset resolutions {dateFormat: 'dd-mm-yyyy'|'mm-dd-yyyy', century: '2000s'|'1900s'}
 * @returns {Promise<Object>} - Map of filename -> resolution choice
 */
export async function resolveAmbiguities(filenames, presetResolutions = {}) {
  const resolutions = new Map();
  const ambiguitiesByType = new Map(); // Group ambiguities by type

  // Step 1: Group all ambiguities by type
  for (const filename of filenames) {
    const ambiguity = detectAmbiguity(filename);

    if (ambiguity) {
      if (!ambiguitiesByType.has(ambiguity.type)) {
        ambiguitiesByType.set(ambiguity.type, []);
      }
      ambiguitiesByType.get(ambiguity.type).push({ filename, ambiguity });
    }
  }

  // Step 2: For each ambiguity type, prompt once and apply to all
  for (const [type, items] of ambiguitiesByType.entries()) {
    // Check if we have a preset resolution for this ambiguity type
    let presetChoice = null;
    const firstAmbiguity = items[0].ambiguity;

    if (presetResolutions) {
      if (type === 'day-month-order' && presetResolutions.dateFormat) {
        // Map preset to option value
        const option = firstAmbiguity.options.find(opt =>
          (presetResolutions.dateFormat === 'dd-mm-yyyy' && opt.value === 'dmy') ||
          (presetResolutions.dateFormat === 'mm-dd-yyyy' && opt.value === 'mdy')
        );
        if (option) {
          presetChoice = option.value;
        }
      } else if (type === 'two-digit-year' && presetResolutions.century) {
        // Map preset to option value
        const option = firstAmbiguity.options.find(opt =>
          (presetResolutions.century === '2000s' && opt.label.includes('2000s')) ||
          (presetResolutions.century === '1900s' && opt.label.includes('1900s'))
        );
        if (option) {
          presetChoice = option.value;
        }
      }
    }

    // If we have a preset choice, apply to all items of this type
    if (presetChoice) {
      for (const { filename } of items) {
        resolutions.set(filename, presetChoice);
      }
      continue;
    }

    // No preset: prompt once for this ambiguity type
    console.log(`\n⚠️  Found ${items.length} file(s) with ambiguous ${type === 'day-month-order' ? 'date order' : 'year'} format.\n`);
    console.log('Example files:');
    items.slice(0, 3).forEach(({ filename }) => {
      console.log(`  - ${filename}`);
    });
    if (items.length > 3) {
      console.log(`  ... and ${items.length - 3} more\n`);
    } else {
      console.log('');
    }

    // Prompt using the first item as representative
    const choice = await promptAmbiguityResolution(firstAmbiguity);

    // Apply choice to all items of this type
    for (const { filename } of items) {
      resolutions.set(filename, choice);
    }

    if (choice !== 'skip') {
      console.log(`✓ Will apply this choice to all ${items.length} file(s) with this ambiguity\n`);
    }
  }

  return resolutions;
}
