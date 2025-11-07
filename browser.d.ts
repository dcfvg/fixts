// Type declarations for fixts browser-safe exports

export interface TimestampInfo {
  type?: string;
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  precision?: 'year' | 'month' | 'day' | 'minute' | 'second' | 'millisecond';
  ambiguous?: boolean;
  alternatives?: Array<{
    format: string;
    year: number;
    month: number;
    day: number;
  }>;
  start?: number;
  end?: number;
  [key: string]: unknown;
}

export interface DetectionInfo {
  custom: {
    detected: boolean;
    timestamp: TimestampInfo | null;
    date: Date | null;
    pattern?: string;
    type?: string;
    precision?: string;
  };
  heuristic: {
    detected: boolean;
    timestamp: TimestampInfo | null;
    date: Date | null;
    type?: string;
    precision?: string;
  };
}

export interface DefinedComponents {
  hasTime?: boolean;
  hasDay?: boolean;
  hasMonth?: boolean;
  hasYear?: boolean;
}

export interface ParseOptions {
  dateFormat?: 'dmy' | 'mdy';
  allowTimeOnly?: boolean;
  customOnly?: boolean;
  timeShiftMs?: number;
}

// Core formatting functions
export function formatDate(
  date: Date,
  template?: string,
  definedComponents?: DefinedComponents
): string | null;

export function extractAndFormat(
  filename: string,
  template?: string,
  options?: ParseOptions
): {
  timestamp: Date;
  formatted: string;
  definedComponents: DefinedComponents;
} | null;

export function generateNewName(
  originalName: string,
  template?: string,
  options?: ParseOptions
): string | null;

// Timestamp parsing
export function parseTimestamp(
  filename: string,
  options?: ParseOptions
): Date | null;

export function parseTimestampFromFilename(
  filename: string,
  options?: ParseOptions
): Date | null;

export function parseTimestampFromName(
  filename: string,
  options?: ParseOptions
): Date | null;

export function getDetectionInfo(filename: string): DetectionInfo;

// Heuristic detection
export function getBestTimestamp(
  filename: string,
  options?: { dateFormat?: 'dmy' | 'mdy' }
): TimestampInfo | null;

export function formatTimestamp(timestamp: TimestampInfo | null): string | null;

export function timestampToDate(timestamp: TimestampInfo | null): Date | null;

// Date utilities
export function createDate(
  year: number,
  month: number,
  day: number,
  hours?: number,
  minutes?: number,
  seconds?: number,
  milliseconds?: number
): Date | null;

export function parseDateString(dateStr: string): Date | null;

export function parseEXIFDateTime(dateTimeStr: string): Date | null;

// Cleaning patterns
export function applyCleaningPatterns(filename: string): string;

// Time shift utilities
export function parseTimeShift(shiftStr: string): number | null;
export function applyTimeShift(date: Date, shiftMs: number): Date;
export function formatTimeShift(shiftMs: number): string;
export function validateShiftedDate(shiftedDate: Date): boolean;

// Path utilities (browser-safe)
export function getBasename(filepath: string): string;
export function getDirname(filepath: string): string;
export function getExtension(filename: string): string;
export function getNameWithoutExt(filename: string): string;
export function joinPaths(...parts: string[]): string;
export function normalizePath(filepath: string): string;
export function isAbsolute(filepath: string): boolean;
export function getRelativePath(from: string, to: string): string;
export function splitPath(filepath: string): { dir: string; base: string };
export function splitBasename(filename: string): { name: string; ext: string };

// Ambiguity detection (browser-safe)
export interface AmbiguityInfo {
  type: 'day-month-order' | 'two-digit-year';
  pattern: string;
  first?: number;
  second?: number;
  filename: string;
  options?: Array<{ label: string; value: string }>;
}

export function detectAmbiguity(filename: string): AmbiguityInfo | null;

// Pattern detection (browser-safe)
export interface PatternInfo {
  pattern: string;
  description: string;
  hasTime: boolean;
  hasDate: boolean;
  precision: string | null;
  icon: string;
  ambiguous: boolean;
}

export function detectPattern(filename: string): PatternInfo;

// File metadata parsing (requires File API in browser)
export function parseTimestampFromEXIF(file: File | string): Promise<Date | null>;
export function parseTimestampFromAudio(file: File | string): Promise<Date | null>;

// Batch processing API
export interface BatchResult {
  filename: string;
  timestamp: Date | null;
  confidence?: number;
  type?: string;
  precision?: string;
}

export interface ConfidenceGroups {
  high: BatchResult[];
  medium: BatchResult[];
  low: BatchResult[];
  none: BatchResult[];
}

export interface BatchStats {
  total: number;
  detected: number;
  notDetected: number;
  detectionRate: number;
  averageConfidence: number;
  typeDistribution: Record<string, number>;
  ambiguous: number;
}

export function parseTimestampBatch(
  filenames: string[],
  options?: ParseOptions & { includeConfidence?: boolean }
): BatchResult[];

export function parseAndGroupByConfidence(
  filenames: string[],
  options?: ParseOptions
): ConfidenceGroups;

export function getBatchStats(results: BatchResult[]): BatchStats;

export function filterByTimestamp(
  filenames: string[]
): { withTimestamp: string[]; withoutTimestamp: string[] };

// Context-aware ambiguity resolution
export interface ContextAnalysis {
  suggestedFormat: 'dmy' | 'mdy';
  confidence: number;
  reasoning: string[];
  needsUserInput: boolean;
}

export interface ResolutionResult {
  action: 'auto-resolve' | 'prompt-user';
  format?: 'dmy' | 'mdy';
  confidence?: number;
  reasoning?: string[];
}

export interface FormatSummary {
  totalFiles: number;
  ambiguousFiles: number;
  suggestedFormat: 'dmy' | 'mdy' | null;
  confidence: number;
  needsUserInput: boolean;
  details: string;
}

export function analyzeContextualFormat(
  filenames: string[],
  options?: { currentDir?: string }
): ContextAnalysis;

export function resolveAmbiguitiesByContext(
  filenames: string[],
  options?: { threshold?: number; currentDir?: string }
): ResolutionResult;

export function getContextualParsingOptions(filenames: string[]): ParseOptions;

export function hasAmbiguousDates(filenames: string[]): boolean;

export function getFormatSummary(filenames: string[]): FormatSummary;

// Custom pattern management
export class PatternValidationError extends Error {
  constructor(message: string);
}

export interface CustomPattern {
  name: string;
  regex: RegExp | string;
  priority?: number;
  extractor: ((match: RegExpMatchArray, filename: string) => TimestampInfo | null) | Record<string, string>;
}

export function registerPattern(pattern: CustomPattern): void;

export function unregisterPattern(name: string): boolean;

export function getRegisteredPatterns(): CustomPattern[];

export function clearPatterns(): void;

export function hasPattern(name: string): boolean;

export function getPattern(name: string): CustomPattern | null;

export function applyCustomPatterns(filename: string): TimestampInfo | null;

export function exportPatterns(): string;

export function importPatterns(json: string): void;

// Unified metadata extraction (browser-safe)
// Note: Browser version does NOT include MTIME/BIRTHTIME (no file system access)
export const SOURCE_TYPE: {
  FILENAME: 'filename';
  EXIF: 'exif';
  AUDIO: 'audio';
  CUSTOM: 'custom';
};

export const DEFAULT_PRIORITY: ['filename', 'exif', 'audio'];

export interface TimestampSource {
  type: string;
  timestamp: Date;
  confidence: number;
}

export interface ExtractOptions {
  sources?: string[];
  priority?: string[];
  includeAll?: boolean;
  includeConfidence?: boolean;
  parsingOptions?: ParseOptions;
}

export interface ExtractResult {
  source: string;
  timestamp: Date;
  confidence: number;
  details?: {
    method?: string;
    source?: string;
  };
}

export interface ExtractResultAll {
  primary: ExtractResult;
  all: ExtractResult[];
}

export interface BatchExtractResult {
  filepath: string;
  result: ExtractResult | null;
}

export interface SourceComparison {
  hasDiscrepancy: boolean;
  sources: TimestampSource[];
  discrepancies: Array<{
    source1: string;
    source2: string;
    difference: number;
    message: string;
  }>;
  recommendation: string;
}

export interface SourceStats {
  total: number;
  detected: number;
  sourceDistribution: Record<string, number>;
  avgConfidence: number;
  confidenceBySource: Record<string, number>;
}

export interface BestSourceSuggestion {
  suggestion: string | null;
  confidence: number;
  timestamp?: Date;
  alternatives?: ExtractResult[];
  hasDiscrepancy: boolean;
  discrepancies: Array<{
    source1: string;
    source2: string;
    difference: number;
    message: string;
  }>;
  reason: string;
}

// Browser version only accepts File objects (no string paths - no file system access)
export function extractTimestamp(
  file: File | string,
  options?: ExtractOptions
): Promise<ExtractResult | ExtractResultAll | null>;

export function extractTimestampBatch(
  files: Array<File | string>,
  options?: ExtractOptions
): Promise<BatchExtractResult[]>;

export function compareTimestampSources(
  file: File | string,
  options?: { thresholdSeconds?: number }
): Promise<SourceComparison>;

// These accept filepaths/Files, not pre-extracted results
export function getSourceStatistics(
  filepaths: Array<File | string>
): Promise<SourceStats>;

export function suggestBestSource(
  filepath: File | string
): Promise<BestSourceSuggestion>;
