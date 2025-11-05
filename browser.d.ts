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
  heuristic: {
    detected: boolean;
    timestamp: TimestampInfo | null;
    date: Date | null;
    type: string | null;
    precision: string | null;
  };
}

export interface DefinedComponents {
  hasTime?: boolean;
  hasDay?: boolean;
  hasMonth?: boolean;
  hasYear?: boolean;
}

export interface ParseOptions {
  method?: 'heuristic' | 'auto';
  dateFormat?: 'dmy' | 'mdy';
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

export const DETECTION_METHOD: {
  HEURISTIC: 'heuristic';
  AUTO: 'auto';
};

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
