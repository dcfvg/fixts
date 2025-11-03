/**
 * Generic cleaning for filename composition artifacts
 * Philosophy: Remove ONLY technical artifacts, preserve semantic content
 * Avoid specific patterns - use heuristic rules instead
 */

/**
 * Apply generic cleaning to preserve original filename structure
 * Only removes composition artifacts from timestamp removal and
 * obvious technical metadata that adds no semantic value
 *
 * @param {string} filename - Filename remainder after timestamp removal
 * @returns {string} - Cleaned filename
 */
export function applyCleaningPatterns(filename) {
  let cleaned = filename;

  // 1. Convert underscores to spaces (common separator normalization)
  cleaned = cleaned.replace(/_+/g, ' ');

  // 2. Separate words from numbers that got joined (heuristic)
  // Only if there's a clear boundary: word(letters) + numbers(6+ digits)
  // Example: "Voix175528" → "Voix 175528", "Recording100658" → "Recording 100658"
  cleaned = cleaned.replace(/([a-zA-Z])(\d{6,})/g, '$1 $2');

  // Separate numbers from words when number comes first
  // Example: "100658Recording" → "100658 Recording"
  cleaned = cleaned.replace(/(\d{6,})([a-zA-Z])/g, '$1 $2');

  // 3. Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // 4. Remove leading/trailing separators and whitespace
  cleaned = cleaned
    .replace(/\.{2,}/g, '.')           // Collapse consecutive dots
    .replace(/^[-_\s.—]+/, '')         // Remove leading separators
    .replace(/[-_\s.—]+$/, '')         // Remove trailing separators
    .replace(/\s+-\s+/g, ' - ')        // Normalize separator spacing
    .trim();

  return cleaned;
}
