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
- 🎨 **Flexible Formatting** - Customize output format to your needs
- 🔄 **Safe Operations** - Preview changes before applying (dry-run by default)
- 📋 **Copy Mode** - Preserve originals in `_c/` directory
- ⏰ **Time Shifting** - Correct camera clock errors (e.g., wrong timezone)
- 🎯 **File Filtering** - Process only specific file types
- 📸 **Metadata Extraction** - Extract dates from EXIF, creation time, etc.
- 🧙 **Wizard Mode** - Interactive disambiguation for edge cases
- ↩️ **Revert Script** - Undo operations with generated scripts
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

FixTS can be used in browser environments for web applications! See the complete guide: [Browser Usage Documentation](./docs/BROWSER_USAGE.md)

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

For a complete migration guide from copied code to npm package, see: [diapaudio Migration Guide](./docs/DIAPAUDIO_MIGRATION.md)

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

