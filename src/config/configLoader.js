/* Node.js-only module */
/**
 * @module configLoader
 * @browserSafe false
 * @requires fs
 * @description Configuration file loader with multiple search paths
 *
 * Configuration files are searched in the following order:
 * 1. --config <path> (CLI override)
 * 2. .fixtsrc (current directory)
 * 3. .fixtsrc.json (current directory)
 * 4. ~/.fixtsrc (user home directory)
 * 5. ~/.config/fixts/config.json (XDG config directory)
 *
 * @example
 * // .fixtsrc.json example:
 * {
 *   "format": "yyyy-mm-dd hh.MM.ss",
 *   "dryRun": false,
 *   "useMetadata": true,
 *   "metadataSource": "content",
 *   "resolution": "dd-mm-yyyy",
 *   "excludeExt": [".tmp", ".log"],
 *   "depth": 3
 * }
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

/**
 * Load configuration from file
 * Searches multiple locations in order of precedence
 *
 * @param {string|null} customPath - Custom config file path (highest priority)
 * @returns {Object} - Configuration object (empty if no config found)
 */
export function loadConfig(customPath = null) {
  const configPaths = customPath ? [customPath] : [
    '.fixtsrc',
    '.fixtsrc.json',
    join(homedir(), '.fixtsrc'),
    join(homedir(), '.fixtsrc.json'),
    join(homedir(), '.config', 'fixts', 'config.json'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8');
        const config = JSON.parse(content);
        
        logger.debug(`Loaded config from: ${configPath}`);
        return config;
      } catch (error) {
        logger.warn(`Warning: Invalid config file ${configPath}: ${error.message}`);
        // Continue searching other locations
      }
    }
  }

  return {};
}

/**
 * Merge configuration sources with proper precedence
 * Priority (highest to lowest): CLI args > config file > defaults
 *
 * @param {Object} defaults - Default configuration values
 * @param {Object} configFile - Configuration from file
 * @param {Object} cliArgs - Configuration from CLI arguments
 * @returns {Object} - Merged configuration
 */
export function mergeConfig(defaults, configFile, cliArgs) {
  // Start with defaults
  const merged = { ...defaults };

  // Apply config file (overrides defaults)
  for (const [key, value] of Object.entries(configFile)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  // Apply CLI args (overrides everything)
  for (const [key, value] of Object.entries(cliArgs)) {
    // Only override if explicitly set (not undefined)
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Validate configuration values
 *
 * @param {Object} config - Configuration to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateConfig(config) {
  const errors = [];

  // Validate metadataSource
  if (config.metadataSource && !['content', 'birthtime', 'mtime', 'earliest'].includes(config.metadataSource)) {
    errors.push(`Invalid metadataSource: ${config.metadataSource}. Must be one of: content, birthtime, mtime, earliest`);
  }

  // Validate resolution
  if (config.resolution && !['dd-mm-yyyy', 'mm-dd-yyyy', '2000s', '1900s'].includes(config.resolution)) {
    errors.push(`Invalid resolution: ${config.resolution}. Must be one of: dd-mm-yyyy, mm-dd-yyyy, 2000s, 1900s`);
  }

  // Validate depth
  if (config.depth !== undefined && (typeof config.depth !== 'number' || config.depth < 0)) {
    errors.push(`Invalid depth: ${config.depth}. Must be a non-negative number`);
  }

  // Validate boolean flags
  const booleanFlags = ['dryRun', 'copy', 'useMetadata', 'table', 'wizard', 'verbose', 'quiet', 'noRevert', 'copyFlat'];
  for (const flag of booleanFlags) {
    if (config[flag] !== undefined && typeof config[flag] !== 'boolean') {
      errors.push(`Invalid ${flag}: ${config[flag]}. Must be a boolean`);
    }
  }

  // Validate arrays
  if (config.includeExt && !Array.isArray(config.includeExt)) {
    errors.push('Invalid includeExt: must be an array');
  }
  if (config.excludeExt && !Array.isArray(config.excludeExt)) {
    errors.push('Invalid excludeExt: must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
