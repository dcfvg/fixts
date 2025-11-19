/**
 * @typedef {object} FixtsConfig
 * @property {'dmy' | 'mdy'} [dateFormat] - The preferred date format for ambiguous dates.
 * @property {string[]} [sourcePriority] - The order of sources to check for timestamps.
 * @property {boolean} [allowTimeOnly] - Whether to allow timestamps with only a time component.
 * @property {string} [outputFormat] - The format for the output filename.
 * @property {boolean} [dryRun] - If true, don't actually rename files.
 * @property {boolean} [interactive] - If true, prompt for user input.
 * @property {boolean} [revert] - If true, run in revert mode.
 * @property {string[]} [files] - The list of files to process.
 */

/**
 * @typedef {object} RenameOptions
 * @property {boolean} [dryRun=false] - If true, don't perform the rename.
 * @property {boolean} [copy=false] - If true, copy instead of moving.
 * @property {boolean} [createRevertScript=false] - If true, create a revert script.
 * @property {string} [dateFormat='dmy'] - The date format to use.
 * @property {boolean} [preserveTimestamps=true] - If true, preserve file atime and mtime.
 */

/**
 * @typedef {object} TimestampParseOptions
 * @property {'dmy' | 'mdy' | 'auto'} [dateFormat] - The preferred date format for ambiguous dates.
 * @property {number} [contextYear] - Preferred year (corpus hint) to break ties.
 * @property {boolean} [allowTimeOnly] - Whether to allow timestamps with only a time component.
 * @property {Date} [defaultDate] - Default date to use for time-only parsing when allowTimeOnly is true.
 */
