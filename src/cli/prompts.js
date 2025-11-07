/* Node.js-only module - uses readline */
/**
 * @module prompts
 * @browserSafe false
 * @requires readline
 * @description User prompts for CLI
 */

import { createInterface } from 'readline';

/**
 * Prompt user for yes/no confirmation
 * @param {string} message - Question to ask
 * @returns {Promise<boolean>} - True if user confirmed (y/yes), false otherwise
 */
export async function promptConfirmation(message) {
  // Auto-confirm in non-interactive environments (CI, tests, pipes)
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(`${message} (auto-confirmed in non-interactive mode)`);
    return true;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
