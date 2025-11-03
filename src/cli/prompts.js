import { createInterface } from 'readline';

/**
 * Prompt user for yes/no confirmation
 * @param {string} message - Question to ask
 * @returns {Promise<boolean>} - True if user confirmed (y/yes), false otherwise
 */
export async function promptConfirmation(message) {
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
