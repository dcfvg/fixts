/* Browser-safe module ✓ */
/**
 * Browser-safe ambiguity detection (no Node.js dependencies)
 *
 * This module detects POTENTIAL ambiguities for warning/prompting purposes.
 * The heuristic detector resolves these automatically based on dateFormat option.
 *
 * For CLI prompts, use ambiguityDetector.js instead
 *
 * @module ambiguityDetector-browser
 * @browserSafe true
 */

// Re-export core functionality
export { detectAmbiguity } from './ambiguityDetector-core.js';
