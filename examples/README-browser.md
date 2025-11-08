# Browser EXIF Extraction Demo

This demo shows how to use FixTS's `extractTimestampBatch()` function in a browser environment with File objects.

## What's New?

**v1.1.0** fixes a critical issue with browser-based EXIF extraction:

- ✅ **Before:** `extractTimestampBatch()` would fail in browsers when trying to extract EXIF data from File objects
- ✅ **After:** Now uses `exifr` library, which is optimized for browser environments and directly supports File objects

## Running the Demo

### Option 1: Simple Local Server

```bash
# From the examples/ directory
python3 -m http.server 8000

# Or use Node.js http-server
npx http-server -p 8000

# Then open: http://localhost:8000/browser-exif-extraction.html
```

### Option 2: Using VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click on `browser-exif-extraction.html`
3. Select "Open with Live Server"

## Using FixTS in Your Web App

### Installation

```bash
npm install fixts
```

### Usage

```javascript
// Import from the browser-safe entry point
import { extractTimestampBatch } from 'fixts/browser';

// Handle file input
document.querySelector('#fileInput').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  
  // Extract timestamps from File objects
  const results = await extractTimestampBatch(files, {
    includeConfidence: true,
    sources: ['exif', 'filename'] // Try EXIF first, then filename
  });
  
  results.forEach(({ filepath, result }) => {
    if (result) {
      console.log(`${filepath}: ${result.timestamp.toISOString()}`);
      console.log(`  Source: ${result.source}`);
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    }
  });
});
```

## What Works in the Browser

✅ **Available:**
- Filename timestamp parsing (heuristic detection)
- EXIF data extraction (photos) via `exifr`
- Audio metadata extraction via `music-metadata-browser`
- Batch processing
- Confidence scores
- Custom patterns

❌ **Not Available in Browser:**
- File system operations (reading from disk paths)
- File system metadata (mtime, birthtime)
- CLI operations

## Browser Support

The browser version requires:
- ES6 modules support
- File API
- ArrayBuffer support
- Modern browsers (Chrome 60+, Firefox 60+, Safari 11+, Edge 79+)

## Bundle Size Optimization

If you're using a bundler (Webpack, Vite, Rollup), make sure to:

1. **Use the browser entry point:** `import from 'fixts/browser'`
2. **Tree shake unused features:** Only import what you need
3. **Consider code splitting:** Load EXIF/audio parsers only when needed

Example with Vite:

```javascript
// Dynamic import for better code splitting
const { extractTimestampBatch } = await import('fixts/browser');
```

## Troubleshooting

### "File is not defined" error
Make sure you're importing from `fixts/browser`, not `fixts`.

### EXIF extraction returns null
- Check that the file is actually an image (`file.type.startsWith('image/')`)
- Some image formats don't support EXIF (e.g., GIF, BMP)
- The image might not have EXIF data

### Import errors with bundlers
If you get module resolution errors:
```javascript
// Make sure your bundler config includes:
resolve: {
  extensions: ['.js', '.mjs'],
  mainFields: ['browser', 'module', 'main']
}
```

## Performance Tips

1. **Use batch processing:** Process multiple files at once with `extractTimestampBatch()`
2. **Limit sources:** If you only need EXIF data, specify `sources: ['exif']`
3. **Cache options:** Reuse the same options object when processing multiple files
4. **Web Workers:** For large batches, consider running extraction in a Web Worker

## Example: Web Worker Usage

```javascript
// worker.js
import { extractTimestampBatch } from 'fixts/browser';

self.onmessage = async (e) => {
  const results = await extractTimestampBatch(e.data.files);
  self.postMessage(results);
};

// main.js
const worker = new Worker('./worker.js', { type: 'module' });
worker.postMessage({ files: Array.from(fileInput.files) });
worker.onmessage = (e) => {
  console.log('Results:', e.data);
};
```

## Learn More

- [Main README](../README.md)
- [API Documentation](../docs/api/)
- [Browser TypeScript Definitions](../browser.d.ts)
