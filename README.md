# fixTS

**Fix TimeStamps** - A CLI tool to normalize filenames with timestamps.

Automatically detects timestamps in filenames (e.g., `IMG_20241103_143045.jpg`, `2023.11.15-document.pdf`) and standardizes them to a consistent, sortable format.

---

## What it does

fixts (fix timestamps) scans your files and folders, detects various timestamp formats, and renames them to a standardized format like `2024-11-03 14.30.45 - IMG.jpg`. It uses heuristic detection to recognize timestamps from cameras, phones, messaging apps, and manual naming conventions.

---

## ✨ Features

- 🔍 **Smart Detection** - Recognizes 50+ timestamp formats automatically
- 📁 **Bulk Processing** - Handle entire directories recursively
- 🚀 **Batch API** - Process 1000+ files efficiently (250,000 files/s)
- 🎯 **Confidence Scoring** - Know which detections are reliable (0.0-1.0)
- 🧠 **Context-Aware Format Detection** - Auto-determine DD-MM vs MM-DD from batch analysis
- 🎨 **Custom Patterns** - Register your own patterns for organization-specific naming conventions
- � **Unified Metadata API** - Extract timestamps from any source (filename, EXIF, audio, file system)
- ⚡ **Metadata Caching** - 500x faster priority changes with intelligent caching (v1.2.0)
- �🔧 **Flexible Formatting** - Customize output format to your needs
- 🔄 **Safe Operations** - Preview changes before applying (dry-run by default)
- 📋 **Copy Mode** - Preserve originals in `_c/` directory
- ⏰ **Time Shifting** - Correct camera clock errors (e.g., wrong timezone)
- 🎯 **File Filtering** - Process only specific file types
- 📸 **Metadata Extraction** - Extract dates from EXIF, creation time, etc.
- 🧙 **Wizard Mode** - Interactive disambiguation for edge cases
- ⚙️ **Config File Support** - Save preferences in `.fixtsrc` files
- ↩️ **Undo Command** - One-command revert with `--undo`
- 🔄 **Revert Scripts** - Auto-generated bash scripts to undo operations
- 🌐 **Browser Support** - Use in web apps via `fixts/browser` entry point

---

## 🚀 Quick Start 

```bash
# Run directly without installing
npx fixts ./photos

# Works with any option
npx fixts ./documents --execute
```

## Installation

### Global installation

```bash
npm install -g fixts
```

### Local development

```bash
git clone <repository>
cd fixts
npm install
npm link
```

## Usage

### Basic operations

```bash
# Preview changes (dry-run, default)
fixts ./documents

# Apply changes
fixts ./documents --execute

# Copy mode (preserves originals in _c/ with subdirectory structure)
fixts ./photos --copy --execute

# Flatten all files to _c/ root (useful for merging folders)
fixts ./photos --copy-flat --execute

# Custom format
fixts ./files --format "yyyy-mm-dd" --execute

# Interactive mode for ambiguous dates
fixts ./mixed-files --wizard
```

### Time shifting

Correct camera clock errors:

```bash
# Add 2 hours
fixts ./photos --shift +2h --execute

# Subtract 1 day
fixts ./vacation --shift -1d --execute

# Complex shifts
fixts ./files --shift -1d3h30m --execute
```

### File filtering

```bash
# Process only images
fixts ./media -i jpg png jpeg --execute

# Exclude documents
fixts ./downloads -x pdf docx txt --execute

# Combine filters (exclude takes priority)
fixts ./files -i jpg png -x thumbnail --execute

# Exclude directories by name
fixts ./project -X node_modules .git temp --execute

# Process only root level (no subdirectories)
fixts ./photos -D 1 --execute

# Process root + 1 level of subdirectories
fixts ./documents -D 2 --execute
```

### Metadata extraction

```bash
# Try EXIF first, fallback to creation time
fixts ./photos -m earliest --execute

# Use only creation time
fixts ./documents -m birthtime --execute

# Use only embedded metadata (EXIF/ID3)
fixts ./media -m content --execute
```

### Ambiguity resolution

For ambiguous dates (e.g., `01-02-2023` could be Jan 2 or Feb 1):

```bash
# European format (DD-MM-YYYY)
fixts ./files --resolution dd-mm-yyyy --execute

# US format (MM-DD-YYYY)
fixts ./files --resolution mm-dd-yyyy --execute

# For 2-digit years
fixts ./old-photos --resolution 2000s --execute
```

### Configuration files

Save your preferred settings in a `.fixtsrc` file:

```bash
# Create a config file in your project
cat > .fixtsrc << EOF
{
  "format": "yyyy-mm-dd hh.MM.ss",
  "resolution": {
    "dateFormat": "dd-mm-yyyy",
    "century": "2000s"
  },
  "excludeExt": ["tmp", "cache"],
  "verbose": false
}
EOF

# Use default config (auto-detected)
fixts ./photos --execute

# Use custom config file
fixts ./photos --config ./my-config.json --execute
```

**Config file locations** (searched in order):
1. Path specified with `--config`
2. `.fixtsrc` or `.fixtsrc.json` (current directory)
3. `~/.fixtsrc` (user home directory)
4. `~/.config/fixts/config.json` (XDG config directory)

**Config options**: All CLI flags can be set in config files. CLI arguments override config file settings.

See [.fixtsrc.example](./.fixtsrc.example) for a complete example.

### Undo operations

Easily undo the last renaming operation:

```bash
# Rename files
fixts ./photos --execute

# Oops, made a mistake! Undo it
fixts ./photos --undo

# Files are restored with timestamps preserved
```

The `--undo` command:
- Automatically finds and executes the `revert.sh` script
- Prompts for confirmation before restoring
- Preserves file timestamps during restoration
- Works with both renamed and copied files

---

## Supported Formats

### Camera & Phone
- `IMG_20241103_143045.jpg` → `2024-11-03 14.30.45 - IMG.jpg`
- `VID_20231225_120000.mp4` → `2023-12-25 12.00.00 - VID.mp4`
- `PXL_20240101_180000.jpg` → `2024-01-01 18.00.00 - PXL.jpg`

### ISO & Standard
- `2024-11-03-document.pdf` → `2024-11-03 - document.pdf`
- `2023_12_25_notes.txt` → `2023-12-25 - notes.txt`
- `20241103_file.docx` → `2024-11-03 - file.docx`

### European
- `03.11.2024-report.pdf` → `2024-11-03 - report.pdf`
- `15.12.23 photo.jpg` → `2023-12-15 - photo.jpg`

### Messaging Apps
- `WhatsApp Image 2024-11-03 at 14.30.45.jpg` → `2024-11-03 14.30.45 - WhatsApp Image.jpg`
- `IMG-20241103-WA0012.jpg` → `2024-11-03 - IMG-WA0012.jpg`

And many more! See [full format list](./DOCUMENTATION.md#supported-formats).

---

## Safety features

- Dry-run by default (always preview before changes)
- Automatic revert script generation
- Copy mode to preserve originals
- File modification time preservation
- Duplicate filename detection

---

## Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help |
| `--execute` | `-e` | Apply changes (default: dry-run) |
| `--dry-run` | `-d` | Preview mode (default) |
| `--copy` | `-c` | Copy to `_c/` instead of rename (preserves subdirectory structure) |
| `--copy-flat` | | Flatten structure when copying (all files in `_c/` root) |
| `--table` | `-t` | Show changes in table format |
| `--wizard` | `-w` | Interactive mode for ambiguities |
| `--format` | `-f` | Output format (default: `yyyy-mm-dd hh.MM.ss`) |
| `--shift` | | Time shift (e.g., `+2h`, `-1d3h30m`) |
| `--use-metadata` | `-m` | Extract dates from metadata |
| `--include-ext` | `-i` | Include only these extensions |
| `--exclude-ext` | `-x` | Exclude these extensions (priority over include) |
| `--exclude-dir` | `-X` | Exclude directories by name |
| `--depth` | `-D` | Max recursion depth (default: unlimited) |
| `--resolution` | | Resolve ambiguities (`dd-mm-yyyy`, `mm-dd-yyyy`, `2000s`, `1900s`) |
| `--no-revert` | | Skip revert script generation (faster for large batches) |

---

## Format templates

The output format can be customized using the `--format` option with the following placeholders:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `yyyy` | 4-digit year | `2024` |
| `yy` | 2-digit year | `24` |
| `mm` | 2-digit month | `11` |
| `dd` | 2-digit day | `03` |
| `hh` | 2-digit hour (24h) | `14` |
| `MM` | 2-digit minute | `30` |
| `ss` | 2-digit second | `45` |

**Default format:** `yyyy-mm-dd hh.MM.ss`  
**Example output:** `2024-11-03 14.30.45 - file.jpg`

### Custom format examples

```bash
# Date only
fixts ./files --format "yyyy-mm-dd" --execute
# Output: 2024-11-03 - file.jpg

# Compact format
fixts ./files --format "yyyymmdd_hhMMss" --execute
# Output: 20241103_143045 - file.jpg

# European format
fixts ./files --format "dd-mm-yyyy hh.MM.ss" --execute
# Output: 03-11-2024 14.30.45 - file.jpg

# With slashes
fixts ./files --format "yyyy/mm/dd" --execute
# Output: 2024/11/03 - file.jpg
```

---

## Examples

### Organizing photos

```bash
# Preview changes
fixts ~/Pictures/Vacation2024

# Apply with copy mode (preserves subdirectories)
fixts ~/Pictures/Vacation2024 --copy --execute

# Flatten all files to _c/ root (useful for merging folders)
fixts ~/Pictures/Vacation2024 --copy-flat --execute

# Fix camera clock error
fixts ~/Pictures/Vacation2024 --shift +5h --execute
```

### Processing downloads

```bash
# Process only PDFs
fixts ~/Downloads -i pdf --execute

# Exclude temporary files
fixts ~/Downloads -x tmp temp --execute

# Exclude system folders
fixts ~/Downloads -X .Spotlight-V100 .Trashes --execute
```

### Batch processing

```bash
# Process entire directory tree
fixts ~/Documents --execute

# Process only root level (no subdirectories)
fixts ~/Documents -D 1 --execute

# Process with limited depth
fixts ~/Documents -D 3 --execute

# With custom format
fixts ~/Archive --format "yyyy-mm-dd" --execute
```

---

## Browser Usage

### Quick Example

```javascript
import {
  parseTimestampFromName,
  parseTimestampFromEXIF,
  parseTimestampFromAudio
} from 'fixts/browser';

// Parse from filename
const date = parseTimestampFromName('IMG_20240315_143025.jpg');

// Parse from image EXIF (requires File API)
const imageFile = document.querySelector('input[type="file"]').files[0];
const exifDate = await parseTimestampFromEXIF(imageFile);

// Parse from audio metadata (requires File API)
const audioFile = document.querySelector('input[type="file"]').files[0];
const audioDate = await parseTimestampFromAudio(audioFile);
```

**What works in browsers:**
- ✅ Filename timestamp parsing
- ✅ EXIF metadata extraction (JPEG, PNG, HEIC, etc.)
- ✅ Audio metadata extraction (MP3, M4A, OGG, WAV, AIFF)
- ✅ Date formatting and validation
- ✅ Name generation utilities

**Browser limitations:**
- ❌ No file system access (can't recursively scan directories)
- ❌ Can't rename files on disk (can only suggest new names)

---

## Batch Processing API

Process thousands of files efficiently with the Batch API! 🚀

**Performance:** 250,000+ files/second on typical hardware.

### Basic Usage

```javascript
import {
  parseTimestampBatch,
  parseAndGroupByConfidence,
  getBatchStats,
  filterByTimestamp
} from 'fixts';

// Parse 1000 files at once (all functions now async)
const results = await parseTimestampBatch(filenames);

// Group by confidence (high/medium/low)
const grouped = await parseAndGroupByConfidence(filenames);
console.log(`${grouped.high.length} high-confidence files`);
console.log(`${grouped.medium.length} may need review`);

// Get statistics
const stats = await getBatchStats(filenames);
console.log(`Detected: ${stats.detected}/${stats.total}`);
console.log(`Avg confidence: ${stats.avgConfidence.toFixed(2)}`);

// Filter files
const filtered = await filterByTimestamp(filenames);
console.log(`${filtered.withTimestamp.length} files ready to process`);
```

### Progressive Processing (NEW in v1.2.0) 🚀

For large file sets (3000+ files), use progressive processing to keep the UI responsive:

```javascript
import { extractTimestampBatch } from 'fixts/browser';

// Process with real-time progress updates
const results = await extractTimestampBatch(fileInputs, {
  // Optional: Auto-calculated if not specified
  // Browser: 50-200, Node.js: 100-1000
  chunkSize: 'auto',
  
  // Optional: Get real-time progress
  onProgress: (info) => {
    console.log(`Progress: ${(info.percentage * 100).toFixed(1)}%`);
    console.log(`Completed: ${info.completed}/${info.total}`);
    console.log(`Processing: ${info.currentFile}`);
    console.log(`Rate: ${info.filesPerSecond.toFixed(0)} files/sec`);
    console.log(`ETA: ${Math.round(info.estimatedRemainingMs / 1000)}s`);
    
    // Update UI
    progressBar.style.width = `${info.percentage * 100}%`;
    statusText.textContent = `${info.completed}/${info.total}`;
  },
  
  // Optional: Yield to event loop between chunks (default: true in browser)
  yieldBetweenChunks: true
});
```

**Browser example with progress bar:**

```javascript
// In your web app
const fileInput = document.querySelector('input[type="file"]');
const progressBar = document.querySelector('.progress-bar');
const statusText = document.querySelector('.status');

async function processFiles() {
  const files = Array.from(fileInput.files);
  
  const results = await extractTimestampBatch(files, {
    chunkSize: 'auto',  // Optimal for browser (50-200)
    onProgress: ({ percentage, completed, total, filesPerSecond, estimatedRemainingMs }) => {
      // Update UI in real-time
      progressBar.style.width = `${percentage * 100}%`;
      statusText.textContent = `${completed}/${total} files (${Math.round(filesPerSecond)} files/s, ETA: ${Math.round(estimatedRemainingMs / 1000)}s)`;
    }
  });
  
  console.log(`Processed ${results.length} files`);
}
```

**Chunk size options:**

```javascript
// Auto-calculated (recommended)
await parseTimestampBatch(files, { chunkSize: 'auto' });

// Specific chunk size
await parseTimestampBatch(files, { chunkSize: 100 });

// No chunking (process all at once)
await parseTimestampBatch(files, { chunkSize: Infinity });
```

**Performance characteristics:**

| File Count | Chunk Size (Browser) | Chunk Size (Node.js) | UI Impact |
|------------|---------------------|---------------------|-----------|
| < 100 | 50 | 100 | Minimal |
| 100-500 | 100 | 500 | Smooth |
| 500-2000 | 150 | 750 | Responsive |
| 2000+ | 200 | 1000 | Fluid updates |

**Benefits:**
- ✅ UI remains responsive during large batch operations
- ✅ Real-time progress feedback with accurate ETA
- ✅ Processing rate monitoring (files/second)
- ✅ Maintains 250,000+ files/second throughput
- ✅ Automatic chunk size optimization

**Use cases:**
- Bulk photo organization (process entire folders at once)
- Quality assurance reports (analyze detection quality)
- Archive migration (preserve timestamps across systems)
- Pre-flight checks (validate before batch processing)
- **Web applications** (keep browser responsive while processing)

Try the demo: `node examples/batch-demo.js` or open `examples/browser-exif-extraction.html`

### Advanced Batch Control (NEW in v1.2.0) 🎮

Take full control of batch processing with pause/resume, abort, priority queues, and error handling.

#### Pause/Resume Processing ⏸️

```javascript
import { parseTimestampBatch, PauseToken } from 'fixts';

const pauseToken = new PauseToken();

// Start processing
const processingPromise = parseTimestampBatch(files, {
  pauseToken,
  onProgress: (info) => {
    console.log(`Progress: ${info.percentage * 100}%`);
    
    // User can pause/resume via UI
    pauseButton.onclick = () => pauseToken.pause();
    resumeButton.onclick = () => pauseToken.resume();
  }
});

const results = await processingPromise;
```

**Use cases:**
- User-controlled batch operations
- Resource management (pause during high CPU usage)
- Debugging and inspection

#### Abort Processing 🛑

```javascript
import { extractTimestampBatch, AbortError } from 'fixts/browser';

const controller = new AbortController();

// Start processing
const processingPromise = extractTimestampBatch(files, {
  abortSignal: controller.signal,
  onProgress: (info) => {
    // User clicks cancel button
    cancelButton.onclick = () => controller.abort();
  }
});

try {
  const results = await processingPromise;
} catch (error) {
  if (error instanceof AbortError) {
    console.log('User cancelled the operation');
  }
}
```

**Use cases:**
- Cancel buttons in UI
- Timeout mechanisms
- User-initiated cancellation

#### Priority Queue Processing 🎯

```javascript
import { parseTimestampBatch } from 'fixts';

// Process smaller files first (faster feedback)
const results = await parseTimestampBatch(files, {
  priorityFn: (filename) => -filename.length,
  onProgress: (info) => {
    console.log(`Processing: ${info.currentFile}`);
  }
});

// Process files from specific directory first
const results2 = await parseTimestampBatch(files, {
  priorityFn: (filename) => {
    return filename.includes('/important/') ? 1000 : 0;
  }
});

// Process newest files first (based on timestamp in filename)
const results3 = await parseTimestampBatch(files, {
  priorityFn: (filename) => {
    const match = filename.match(/(\d{8})/);
    return match ? parseInt(match[1]) : 0; // Higher date = higher priority
  }
});
```

**Use cases:**
- Process important files first
- Show quick results (process small files first)
- Optimize for user workflow

#### Error Handling Modes 🛡️

```javascript
import { extractTimestampBatch } from 'fixts/browser';

// Fail-fast: Stop on first error (default for critical operations)
try {
  const results = await extractTimestampBatch(files, {
    errorMode: 'fail-fast'
  });
} catch (error) {
  console.error('Processing failed:', error);
}

// Collect: Continue processing, collect all errors (best for batch operations)
const { results, errors } = await extractTimestampBatch(files, {
  errorMode: 'collect'
});

console.log(`Processed: ${results.filter(r => r).length}`);
console.log(`Failed: ${errors.length}`);
errors.forEach(({ item, error }) => {
  console.error(`Failed to process ${item}:`, error.message);
});

// Ignore: Skip errors silently (use with caution)
const results2 = await extractTimestampBatch(files, {
  errorMode: 'ignore'
});
```

**Use cases:**
- Batch operations: Use `'collect'` to process as many as possible
- Critical operations: Use `'fail-fast'` to ensure data integrity
- Logging operations: Use `'ignore'` for non-critical tasks

#### Per-Item Result Callbacks 🎨

Get results as soon as each file is processed, enabling real-time UI updates and progressive rendering.

```javascript
import { extractTimestampBatch } from 'fixts/browser';

const categories = { exif: [], filename: [], unknown: [] };

await extractTimestampBatch(photos, {
  chunkSize: 'auto',
  
  // Global progress (for progress bar)
  onProgress: (info) => {
    updateProgressBar(info.percentage);
    showETA(info.estimatedRemainingMs);
  },
  
  // Per-item results (for real-time UI updates)
  onItemProcessed: (file, result, index) => {
    // Update UI immediately when file is processed
    if (result?.result?.source === 'exif') {
      categories.exif.push(file);
      renderPhotoInGroup('exif', file, result.result.timestamp);
    } else if (result?.result?.source === 'filename') {
      categories.filename.push(file);
      renderPhotoInGroup('filename', file, result.result.timestamp);
    } else {
      categories.unknown.push(file);
      renderPhotoInGroup('unknown', file);
    }
    
    // Update category counts in real-time
    updateCategoryCounts(categories);
  }
});

console.log('Final categories:', categories);
```

**Real-world example: Quality analysis dashboard**

```javascript
const stats = { high: 0, medium: 0, low: 0 };

await extractTimestampBatch(files, {
  onItemProcessed: (file, result) => {
    // Update statistics in real-time
    const confidence = result?.result?.confidence || 0;
    
    if (confidence > 0.85) stats.high++;
    else if (confidence > 0.60) stats.medium++;
    else stats.low++;
    
    // Live chart updates as files are processed
    updateQualityChart(stats);
  }
});
```

**Early abort on errors:**

```javascript
let errorCount = 0;
const controller = new AbortController();

await extractTimestampBatch(files, {
  abortSignal: controller.signal,
  onItemProcessed: (file, result) => {
    if (!result || !result.result) {
      errorCount++;
      if (errorCount > 100) {
        // More than 100 failures - abort early
        controller.abort();
        showAlert('Too many failures - please check file format');
      }
    }
  }
});
```

**Use cases:**
- Progressive UI updates (show results as they come)
- Real-time categorization (move files to groups)
- Early validation (abort if quality is poor)
- Live statistics (build charts progressively)
- Incremental rendering (reduce memory pressure)

#### Combining Features 🚀

```javascript
import { parseTimestampBatch, PauseToken } from 'fixts';

const pauseToken = new PauseToken();
const controller = new AbortController();

const results = await parseTimestampBatch(largeFileSet, {
  // Progressive processing
  chunkSize: 'auto',
  onProgress: (info) => {
    updateUI(info);
    
    // Auto-pause if CPU usage high
    if (getCPUUsage() > 80) pauseToken.pause();
    if (getCPUUsage() < 50) pauseToken.resume();
  },
  yieldBetweenChunks: true,
  
  // Advanced control
  pauseToken,
  abortSignal: controller.signal,
  priorityFn: (f) => f.includes('/VIP/') ? 1000 : 0,
  errorMode: 'collect'
});

console.log(`Success: ${results.filter(r => r).length}`);
```

---

## Context-Aware Date Format Resolution

Automatically determine whether files use DD-MM or MM-DD format! 🧠

**How it works:** Analyzes your files to detect format patterns, using unambiguous dates (like 15-03 which must be DD-MM) as evidence. Provides confidence scores so you know when to trust auto-detection vs. when to prompt the user.

```javascript
import {
  analyzeContextualFormat,
  resolveAmbiguitiesByContext,
  getContextualParsingOptions,
  parseTimestampBatch
} from 'fixts';

// Analyze a batch of files
const files = [
  'photo_15-03-2024.jpg',  // day=15 > 12, must be DD-MM
  'video_20-06-2024.mp4',  // day=20 > 12, must be DD-MM
  'doc_08-04-2024.pdf'     // ambiguous (both ≤12)
];

const analysis = analyzeContextualFormat(files);
console.log(analysis.recommendation);  // 'dmy'
console.log(analysis.confidence);      // 0.95 (high!)
console.log(analysis.evidence);        // Why this recommendation

// Auto-resolve if confidence is high
const resolution = resolveAmbiguitiesByContext(analysis);
if (resolution.autoResolved) {
  console.log(`Format: ${resolution.format}`);
} else if (resolution.shouldPromptUser) {
  // Low confidence - ask user
  const format = await promptUserForFormat();
}

// Get parsing options for batch processing
const options = getContextualParsingOptions(files);
const results = parseTimestampBatch(files, options);
```

**Directory prioritization:** Files in the same folder more likely share naming conventions:

```javascript
const analysis = analyzeContextualFormat(files, {
  currentDirectory: '/project/europe'
});
// Prioritizes files from /project/europe for format detection
```

**Confidence levels:**
- **High (≥0.85):** Multiple unambiguous dates, consistent pattern → auto-resolve
- **Medium (0.70-0.84):** Some evidence, minor conflicts → auto-resolve with caution
- **Low (<0.70):** Only ambiguous dates or major conflicts → prompt user

Try the demo: `node examples/contextAwareResolution.js`

---

## Custom Pattern Support

Register your own timestamp patterns for organization-specific naming conventions! 🎨

**Why custom patterns?** While fixTS recognizes 50+ common formats, every organization has unique conventions. Custom patterns make fixTS extensible for any naming scheme.

```javascript
import { registerPattern, parseTimestamp } from 'fixts';

// Example 1: Simple function extractor
registerPattern({
  name: 'project-code',
  regex: /PRJ(\d{4})(\d{2})(\d{2})-/,
  extractor: (match) => ({
    year: parseInt(match[1]),
    month: parseInt(match[2]),
    day: parseInt(match[3])
  }),
  description: 'Internal project code format'
});

const date = parseTimestamp('PRJ20240315-budget-report.xlsx');
// → Fri Mar 15 2024

// Example 2: Named capture groups (cleaner!)
registerPattern({
  name: 'log-format',
  regex: /LOG_(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})_(?<hour>\d{2})(?<minute>\d{2})/,
  extractor: 'named',
  priority: 50  // Lower priority = checked first
});

// Example 3: Mapping object (simple!)
registerPattern({
  name: 'backup',
  regex: /BACKUP-(\d{2})\.(\d{2})\.(\d{4})-(\d{2})h(\d{2})/,
  extractor: {
    day: 1,      // First capture group
    month: 2,    // Second capture group
    year: 3,     // Third capture group
    hour: 4,
    minute: 5
  }
});
```

**Pattern Priority:** Patterns are checked in priority order (lower value first). Custom patterns are checked before the built-in heuristic, so they can override standard detection for your specific formats.

**Export/Import:**
```javascript
import { exportPatterns, importPatterns } from 'fixts';

// Save your patterns
const json = exportPatterns();
fs.writeFileSync('patterns.json', json);

// Load patterns
const json = fs.readFileSync('patterns.json', 'utf-8');
importPatterns(json);
```

**API Functions:**
- `registerPattern(pattern)` - Register a new pattern
- `unregisterPattern(name)` - Remove a pattern
- `getRegisteredPatterns()` - List all patterns
- `clearPatterns()` - Remove all patterns
- `hasPattern(name)` / `getPattern(name)` - Check and retrieve
- `exportPatterns()` / `importPatterns(json)` - Save and load

Try the demo: `node examples/customPatterns.js`

---

## Unified Metadata API

Extract timestamps from **any source** with a single interface! 🔗

**Why unified metadata?** Files contain timestamps in multiple places: filename, EXIF data, audio tags, file creation time. The unified API automatically finds and prioritizes the best source.

```javascript
import { extractTimestamp, SOURCE_TYPE } from 'fixts';

// Example 1: Extract from best available source
const result = await extractTimestamp('photo.jpg');
console.log(result.source);      // 'exif'
console.log(result.timestamp);   // Date object
console.log(result.confidence);  // 0.95

// Example 2: Get all available sources
const all = await extractTimestamp('photo.jpg', { includeAll: true });
console.log(all.primary);        // Best source
console.log(all.all);            // All sources (filename, exif, mtime, etc.)

// Example 3: Custom source priority
const custom = await extractTimestamp('file.txt', {
  sources: [SOURCE_TYPE.MTIME, SOURCE_TYPE.FILENAME]
});

// Example 4: Batch processing
import { extractTimestampBatch } from 'fixts';

const results = await extractTimestampBatch([
  'photo1.jpg',
  'photo2.jpg',
  'document.pdf'
]);

results.forEach(({ filepath, result }) => {
  console.log(`${filepath}: ${result?.source} - ${result?.timestamp}`);
});

// Example 5: Compare sources and detect discrepancies
import { compareTimestampSources } from 'fixts';

const comparison = await compareTimestampSources('photo.jpg');
if (comparison.hasDiscrepancy) {
  console.log('Warning: Sources disagree!');
  comparison.discrepancies.forEach(d => console.log(d.message));
}
console.log(`Recommendation: ${comparison.recommendation}`);

// Example 6: Get statistics for batch
import { getSourceStatistics } from 'fixts';

const stats = await getSourceStatistics(['photo1.jpg', 'photo2.jpg']);
console.log(`Average confidence: ${stats.avgConfidence}`);
console.log(`Source distribution:`, stats.sourceDistribution);
// { filename: 10, exif: 45, mtime: 5 }

// Example 7: Get best source suggestion
import { suggestBestSource } from 'fixts';

const suggestion = await suggestBestSource('photo.jpg');
console.log(`Use ${suggestion.suggestion} (${suggestion.confidence})`);
console.log(`Reason: ${suggestion.reason}`);
```

**Source Types & Confidence:**
- `filename`: 70% - Heuristic detection from filename
- `exif`: 95% - Camera EXIF metadata (images)
- `audio`: 90% - Audio file tags (MP3, M4A, etc.)
- `birthtime`: 60% - File creation time
- `mtime`: 50% - File modification time
- `custom`: Variable - Custom pattern extractors

**Default Priority:** filename → exif → audio → birthtime → mtime

**API Functions:**
- `extractTimestamp(filepath, options)` - Extract from single file
- `extractTimestampBatch(filepaths, options)` - Batch processing
- `compareTimestampSources(filepath, options)` - Detect discrepancies
- `getSourceStatistics(filepaths)` - Analyze batch statistics
- `suggestBestSource(filepath)` - Get best source recommendation
- `reapplyPriority(batchResults, newPriority)` - Instantly change priority without re-reading files (v1.2.0)
- `canReapplyPriority(batchResults)` - Check if priority can be reapplied (v1.2.0)
- `clearMetadataCache(filepath?)` - Clear metadata cache (all or specific file) (v1.2.0)
- `getMetadataCacheStats()` - Get cache statistics (hits, misses, hitRate) (v1.2.0)
- `SOURCE_TYPE` - Source type constants
- `DEFAULT_PRIORITY` - Default source order

Try the demo: `node examples/unifiedMetadata.js`

---

### ⚡ Metadata Caching (v1.2.0)

**Performance Boost:** 500x faster when changing priorities! Re-sort cached results in ~0ms instead of re-reading files.

**Automatic Caching:** Metadata is cached transparently with auto-invalidation when files change.

```javascript
import { 
  extractTimestamp, 
  reapplyPriority, 
  clearMetadataCache,
  getMetadataCacheStats 
} from 'fixts';

// 1. First extraction - reads from disk and caches metadata
const result1 = await extractTimestamp('photo.jpg', {
  priority: ['exif', 'filename'],
  includeAll: true  // Cache all sources for later re-prioritization
});
console.log(result1.source); // 'exif'

// 2. Second extraction - instant! Uses cached metadata
const result2 = await extractTimestamp('photo.jpg', {
  priority: ['filename', 'exif'],
  includeAll: true
});
console.log(result2.source); // 'filename' (different priority, same file)

// 3. Instant priority changes without re-reading files
const newPriority = ['mtime', 'exif', 'filename'];
const result3 = reapplyPriority(result2, newPriority);
console.log(result3.source); // 'mtime' (re-sorted in ~0ms!)

// 4. Monitor cache performance
const stats = getMetadataCacheStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
// Cache hit rate: 66.7%

// 5. Cache control
clearMetadataCache('photo.jpg');  // Clear specific file
clearMetadataCache();              // Clear entire cache
```

**Cache Options:**

```javascript
// Disable caching for specific extraction
const result = await extractTimestamp('file.jpg', {
  useCache: false,        // Don't use cached data
  cacheResults: false     // Don't cache this result
});

// Get notified on cache hits
const result = await extractTimestamp('file.jpg', {
  onCacheHit: (filepath) => {
    console.log(`Cache hit for ${filepath}!`);
  }
});
```

**How it works:**
- Cache key: `filepath + filesize + modificationTime`
- Auto-invalidation: Cache cleared when file is modified or deleted
- Stores ALL sources: Even with `includeAll: false`, all sources are cached for later re-prioritization
- Node.js only: Browser version doesn't include caching (use with caution in memory-constrained environments)

**Use Cases:**
- **Web apps:** Users changing priority dropdowns → instant updates
- **Batch processing:** Process once, try different priorities instantly
- **Interactive tools:** Real-time priority experimentation

---

## Cross-Context Compatibility

All features work in **Node.js**, **Browser**, and **CLI** contexts! 🎯

### Quick Reference

| Context | Entry Point | Features |
|---------|-------------|----------|
| **Node.js** | `import from 'fixts'` | All features (full API) |
| **Browser** | `import from 'fixts/browser'` | Browser-safe subset |
| **CLI** | `fixts` command | All features via flags |

### Browser Usage

```javascript
import { parseTimestamp, extractTimestamp } from 'fixts/browser';

// Works with File objects or filename strings
const result = await extractTimestamp(fileInput.files[0]);
console.log(`Extracted from: ${result.source}`);
```

**Note:** Browser version excludes Node.js-specific sources (mtime, birthtime) but includes filename, EXIF, and audio metadata extraction.

**Verify:** Run `node verify-cross-context.js` to verify all features work in all contexts.

---

## Testing

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Lint check
npm run lint

# Full verification
npm run verify
```

---

## License

GNU General Public License v3.0 or later - see [LICENSE](./LICENSE) file for details.

