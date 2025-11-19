/* Node.js-only module - uses readline */
/**
 * Ambiguity detection with CLI prompts (Node.js only)
 *
 * This module provides interactive ambiguity resolution using Node.js readline.
 * For browser-safe ambiguity detection, use ambiguityDetector-browser.js
 * @module ambiguityDetector
 * @browserSafe false
 * @requires readline
 */

import readline from 'readline';
import { basename } from 'path';

// Import and re-export core detection logic
import { detectAmbiguity } from './ambiguityDetector-core.js';
export { detectAmbiguity };

/**
 * Prompt user to resolve ambiguity
 * @param {object} ambiguity - Ambiguity info from detectAmbiguity
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
 * @param {Array<string|{name?: string, path?: string, filename?: string}>} items - List of filenames (or objects with name/path)
 * @returns {Promise<object>} - Map of identifier -> resolution choice (paths when provided)
 */
function normalizeAmbiguityInputs(items) {
  return items.map((item, index) => {
    if (typeof item === 'string') {
      return {
        name: item,
        key: item,
        path: null,
      };
    }

    const inferredName = item.name || item.filename || (item.path ? basename(item.path) : `item-${index + 1}`);
    const key = item.path || `${inferredName}#${index}`;

    return {
      name: inferredName,
      key,
      path: item.path || null,
    };
  });
}

/**
 * Resolve ambiguities for multiple files interactively
 * @param {Array<string|object>} filenames - List of filenames or file objects
 * @param {object} presetResolutions - Optional preset resolutions
 * @returns {Promise<Map>} Map of filename/path to resolution choices
 */
export async function resolveAmbiguities(filenames, presetResolutions = {}) {
  const resolutions = new Map();
  const ambiguitiesByType = new Map(); // Group ambiguities by type
  const normalizedItems = normalizeAmbiguityInputs(filenames);

  // Step 1: Group all ambiguities by type
  for (const item of normalizedItems) {
    const ambiguity = detectAmbiguity(item.name);

    if (ambiguity) {
      if (!ambiguitiesByType.has(ambiguity.type)) {
        ambiguitiesByType.set(ambiguity.type, []);
      }
      ambiguitiesByType.get(ambiguity.type).push({ item, ambiguity });
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
      }
    }

    // If we have a preset choice, apply to all items of this type
    if (presetChoice) {
      for (const { item } of items) {
        resolutions.set(item.key, presetChoice);
      }
      continue;
    }

    // No preset: prompt once for this ambiguity type
    console.log(`\n⚠️  Found ${items.length} file(s) with ambiguous ${type === 'day-month-order' ? 'date order' : 'year'} format.\n`);
    console.log('Example files:');
    items.slice(0, 3).forEach(({ item }) => {
      console.log(`  - ${item.name}`);
    });
    if (items.length > 3) {
      console.log(`  ... and ${items.length - 3} more\n`);
    } else {
      console.log('');
    }

    // Prompt using the first item as representative
    const choice = await promptAmbiguityResolution(firstAmbiguity);

    // Apply choice to all items of this type
    for (const { item } of items) {
      resolutions.set(item.key, choice);
    }

    if (choice !== 'skip') {
      console.log(`✓ Will apply this choice to all ${items.length} file(s) with this ambiguity\n`);
    }
  }

  return resolutions;
}
