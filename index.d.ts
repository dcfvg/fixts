// Type declarations for fixts Node.js exports (main entry point)
// For browser-safe types, see browser.d.ts

// Re-export all browser-safe types
export * from './browser.d.ts';

// Node.js-specific: File system renaming
export interface RenameOptions {
  template?: string;
  dateFormat?: 'dmy' | 'mdy';
  timeShiftMs?: number;
  dryRun?: boolean;
  execute?: boolean;
  includeDirectories?: boolean;
  depth?: number;
  excludeDir?: string[];
  includeExt?: string[];
  excludeExt?: string[];
  useMetadata?: boolean;
  metadataMode?: 'content' | 'birthtime' | 'earliest';
  metadataPriority?: string[];
  copy?: boolean;
  copyFlat?: boolean;
  noRevert?: boolean;
}

export interface RenameResult {
  results: Array<{
    oldPath: string;
    newPath: string;
    success: boolean;
    error?: string;
  }>;
  alreadyFormatted: number;
  noTimestamp: string[];
  withoutTimestamp: number;
  revertScriptPath: string | null;
  skippedAmbiguous: Array<{
    name: string;
    path: string;
    ambiguity: any;
    message: string;
    smart: any;
  }>;
  smartStats: any;
}

// Main rename function (matches actual export from renamer.js)
export function rename(
  targetPath: string,
  options?: RenameOptions
): Promise<RenameResult>;

// Node.js-specific: File metadata extraction with file paths
// Note: Runtime accepts string paths only in Node.js context
export function parseTimestampFromEXIF(filePath: string): Promise<Date | null>;
export function parseTimestampFromAudio(filePath: string): Promise<Date | null>;

// Unified metadata extractor (Node.js version with file system access)
export interface NodeExtractOptions {
  sources?: Array<'filename' | 'exif' | 'audio' | 'file_system'>;
  priority?: Array<'filename' | 'exif' | 'audio' | 'file_system'>;
  includeAll?: boolean;
  includeConfidence?: boolean;
  parsingOptions?: import('./browser.d.ts').ParseOptions;
  // Progressive batch processing options (Phase 1)
  chunkSize?: number | 'auto';
  onProgress?: (info: import('./browser.d.ts').BatchProgressInfo) => void;
  onItemProcessed?: import('./browser.d.ts').OnItemProcessedCallback<string, NodeBatchExtractResult>;
  yieldBetweenChunks?: boolean;
  // Advanced batch control options (Phase 2)
  pauseToken?: import('./browser.d.ts').PauseToken;
  abortSignal?: AbortSignal;
  priorityFn?: (filepath: string) => number;
  errorMode?: import('./browser.d.ts').ErrorMode;
}

export interface NodeExtractResult {
  source: string;
  timestamp: Date;
  confidence: number;
  details?: {
    method?: string;
    source?: string;
  };
}

export interface NodeExtractResultAll {
  primary: NodeExtractResult;
  all: NodeExtractResult[];
}

// extractTimestampBatch returns {filepath, result} objects
export interface NodeBatchExtractResult {
  filepath: string;
  result: NodeExtractResult | null;
}

export interface NodeSourceComparison {
  hasDiscrepancy: boolean;
  sources: Array<{
    source: string;
    timestamp: Date;
    confidence: number;
  }>;
  discrepancies: Array<{
    source1: string;
    source2: string;
    difference: number;
    message: string;
  }>;
  recommendation: string;
}

export interface NodeSourceStatistics {
  total: number;
  detected: number;
  sourceDistribution: Record<string, number>;
  avgConfidence: number;
  confidenceBySource: Record<string, number>;
}

export interface NodeBestSourceSuggestion {
  suggestion: string | null;
  confidence: number;
  timestamp?: Date;
  alternatives?: Array<{
    source: string;
    timestamp: Date;
    confidence: number;
  }>;
  hasDiscrepancy: boolean;
  discrepancies: Array<{
    source1: string;
    source2: string;
    difference: number;
    message: string;
  }>;
  reason: string;
}

export function extractTimestamp(
  filePath: string,
  options?: NodeExtractOptions
): Promise<NodeExtractResult | NodeExtractResultAll | null>;

// Returns array of {filepath, result} objects
export function extractTimestampBatch(
  filePaths: string[],
  options?: NodeExtractOptions
): Promise<NodeBatchExtractResult[]>;

export function compareTimestampSources(
  filePath: string,
  options?: { thresholdSeconds?: number }
): Promise<NodeSourceComparison>;

// Accepts array of file paths (string[]), not result objects
export function getSourceStatistics(
  filePaths: string[]
): Promise<NodeSourceStatistics>;

// Accepts single file path, not array
export function suggestBestSource(
  filePath: string
): Promise<NodeBestSourceSuggestion>;

// Cache control functions (v1.2.0)
export function reapplyPriority(
  batchResults: NodeBatchExtractResult | NodeBatchExtractResult[],
  newPriority: string[] | string
): NodeBatchExtractResult | NodeBatchExtractResult[];

export function canReapplyPriority(
  batchResults: NodeBatchExtractResult | NodeBatchExtractResult[]
): boolean;

export function clearMetadataCache(
  filepath?: string
): {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  evictions: number;
};

export function getMetadataCacheStats(): {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  evictions: number;
};

export const SOURCE_TYPE: {
  FILENAME: 'filename';
  EXIF: 'exif';
  AUDIO: 'audio';
  MTIME: 'mtime';
  BIRTHTIME: 'birthtime';
  CUSTOM: 'custom';
};

export const DEFAULT_PRIORITY: string[];
