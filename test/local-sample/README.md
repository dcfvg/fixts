# Local Sample Testing Scripts

This directory contains **development and validation scripts** for testing on real-world file samples.

⚠️ **Note**: The `temp/` directory is gitignored and contains generated sample files.

## Purpose

These scripts are used for:
- **Real-world validation** on large document collections
- **Performance analysis** and edge case detection
- **Cleaning algorithm testing** on actual user files
- **False positive detection** and quality assurance

## Quick Start

### 1. Generate a sample

```bash
# Generate 2000 random files from ~/Documents
node generate-sample.js
# or
npm run test:local:generate

# Generate 500 files from a specific directory
node generate-sample.js ~/Desktop 500
# or
npm run test:local:generate -- ~/Desktop 500

# Generate 1000 files from current directory
node generate-sample.js . 1000
```

The sample is saved to `temp/sample-files.txt`.

### 2. Run analysis

```bash
# Comprehensive analysis with statistics
node analyze-all-documents.js
# or
npm run test:local

# Detailed inspection for manual review
node inspect-transformations.js
# or
npm run test:local:inspect

# Test false positive detection
node test-false-positives.js
# or
npm run test:local:false-positives
```

## Scripts

### Sample Generation

**`generate-sample.js [source_dir] [sample_size]`**
- Fast reservoir sampling (O(n) time, O(1) space)
- **Excludes**:
  - Version control: `.git`, `.svn`, `.hg`
  - Dependencies: `node_modules`, `bower_components`, `vendor`
  - Python: `.venv`, `venv`, `__pycache__`, `.pytest_cache`, `.tox`, `dist`, `build`, `*.egg-info`
  - IDE: `.vscode`, `.idea`, `.vs`, `.eclipse`
  - Build/Cache: `.cache`, `tmp`, `temp`, `.next`, `.nuxt`, `.output`
  - System: `Library`, `.Trash`, `.DS_Store`
  - Logs: `logs/`, `*.log`
  - Archives: `*.zip`, `*.tar`, `*.gz`, `*.rar`, `*.7z`, `*~`, `*.bak`, `*.swp`
  - Compiled: `*.pyc`, `*.so`, `*.o`, `*.dll`, `*.exe`, `*.class`, `*.jar`
  - Databases: `*.db`, `*.sqlite`
- Default: ~/Documents, 2000 files
- Output: `temp/sample-files.txt`

### Analysis Scripts

| Script | Description | npm command | Direct command |
|--------|-------------|-------------|----------------|
| `analyze-all-documents.js` | Analyze sample with detection statistics | `npm run test:local` | `node analyze-all-documents.js` |
| `inspect-transformations.js` | Detailed transformation review with warnings | `npm run test:local:inspect` | `node inspect-transformations.js` |
| `test-false-positives.js` | Test 10 false positives + 3 true positives | `npm run test:local:false-positives` | `node test-false-positives.js` |
| `generate-sample.js` | Generate random file sample | `npm run test:local:generate` | `node generate-sample.js [dir] [size]` |

## Key Results

**Detection Performance** (tested on multiple batches):
- Detection rate: **14-16%** on real files (after filtering system files)
- False positive rate: **0%** (14/14 test cases correct)
- Cleaning accuracy: **0% underscores, 0% technical suffixes**

**Heuristic-First Approach**:
- Default method: `DETECTION_METHOD.HEURISTIC`
- Anti-false-positive checks: 
  - UUID rejection
  - Repeating patterns (121212)
  - Sequential patterns (123456)
  - Index numbers (frame_2048, outline_302_idx2408)
- French time format support: `HHhMMmSSs` (e.g., `14h05m37s448`)
- Official tests: **97/97 pass**

## Requirements

- Node.js with ES modules support
- Access to filesystem for sample generation
- At least 2000 files in source directory for meaningful statistics

## Development Workflow

1. Generate sample from target directory
2. Run analysis scripts to identify issues
3. Fix issues in `src/`
4. Re-run analysis to validate
5. Run official tests: `npm test`
6. Commit changes (temp/ is gitignored)

## Notes

- Scripts use **real user data** - samples are kept local and gitignored
- Scripts may take 10-30 seconds to run on large datasets
- Use `| head -50` to limit output when needed
- All scripts work **only within the workspace** (no external file modifications)

## Official Test Suite

For the **official test suite** (committed to git), see:
- `test/*.test.js` - Unit tests (run with `npm test`)
- `test/integration/` - Integration tests with fixtures

---

*This directory is for local validation only. Generated samples in `temp/` are not committed to version control.*
