import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseTimestamp, getDetectionInfo, DETECTION_METHOD } from '../src/utils/timestampParser.js';

describe('Heuristic Detection on Fixtures', () => {
  const fixturesDir = join(process.cwd(), 'test/integration/fixtures');
  const files = readdirSync(fixturesDir).filter((f) => !f.endsWith('.sh'));

  describe('AUTO mode (heuristic + fallback)', () => {
    it('should detect timestamps in most fixture files', () => {
      let detected = 0;
      let notDetected = 0;

      files.forEach((filename) => {
        const result = parseTimestamp(filename, { method: DETECTION_METHOD.AUTO });
        if (result) {
          detected++;
        } else {
          notDetected++;
        }
      });

      const detectionRate = ((detected / files.length) * 100).toFixed(1);
      console.log(`\n  AUTO mode: ${detected}/${files.length} detected (${detectionRate}%)`);
      console.log(`  Not detected: ${notDetected} files`);

      // Should detect most files (adjusted threshold based on real data)
      assert.ok(detectionRate >= 90, `Detection rate ${detectionRate}% is below 90%`);
    });
  });

  describe('HEURISTIC mode (pure heuristic)', () => {
    it('should detect timestamps in numeric date files', () => {
      let detected = 0;
      let notDetected = 0;
      const notDetectedFiles = [];

      files.forEach((filename) => {
        const result = parseTimestamp(filename, { method: DETECTION_METHOD.HEURISTIC });
        if (result) {
          detected++;
        } else {
          notDetected++;
          notDetectedFiles.push(filename);
        }
      });

      const detectionRate = ((detected / files.length) * 100).toFixed(1);
      console.log(`\n  HEURISTIC mode: ${detected}/${files.length} detected (${detectionRate}%)`);
      console.log(`  Not detected: ${notDetected} files`);
      if (notDetectedFiles.length > 0 && notDetectedFiles.length <= 10) {
        console.log('  Files not detected:', notDetectedFiles.slice(0, 5).join(', '));
      }

      // Heuristic should detect at least 89% (won't detect month names, and rejects false positives like frame_YYYY)
      // Note: threshold lowered from 90% to 89% after adding anti-false-positive checks for index numbers
      assert.ok(detectionRate >= 89, `Heuristic detection rate ${detectionRate}% is below 89%`);
    });
  });

  describe('REGEX mode (legacy)', () => {
    it('should detect timestamps including month names', () => {
      let detected = 0;
      let notDetected = 0;

      files.forEach((filename) => {
        const result = parseTimestamp(filename, { method: DETECTION_METHOD.REGEX });
        if (result) {
          detected++;
        } else {
          notDetected++;
        }
      });

      const detectionRate = ((detected / files.length) * 100).toFixed(1);
      console.log(`\n  REGEX mode: ${detected}/${files.length} detected (${detectionRate}%)`);
      console.log(`  Not detected: ${notDetected} files`);

      // Regex should detect close to 90% (may miss NO_TIMESTAMP and some edge cases)
      assert.ok(detectionRate >= 85, `Regex detection rate ${detectionRate}% is below 85%`);
    });
  });

  describe('Detection comparison', () => {
    it('should show heuristic detection statistics', () => {
      let detected = 0;
      let notDetected = 0;

      files.forEach((filename) => {
        const info = getDetectionInfo(filename);

        if (info.heuristic.detected) {
          detected++;
        } else {
          notDetected++;
        }
      });

      const detectionRate = ((detected / files.length) * 100).toFixed(1);

      console.log('\n  Detection Statistics:');
      console.log(`    Detected: ${detected} files`);
      console.log(`    Not detected: ${notDetected} files`);
      console.log(`    Detection rate: ${detectionRate}%`);

      // Heuristic should detect at least 90% of test fixtures
      assert.ok(detected >= files.length * 0.9, `Detection rate ${detectionRate}% is below 90%`);
    });
  });

  describe('Specific format improvements', () => {
    it('should handle 2-digit years correctly', () => {
      // Test files with 2-digit years (24-11-02 format)
      const twoDigitYearFiles = files.filter((f) => /\b\d{2}-\d{2}-\d{2}\b/.test(f));

      if (twoDigitYearFiles.length === 0) {
        console.log('  No 2-digit year files found in fixtures');
        return;
      }

      let heuristicCorrect = 0;

      twoDigitYearFiles.forEach((filename) => {
        const hResult = parseTimestamp(filename, { method: DETECTION_METHOD.HEURISTIC });

        // Assuming files are from recent years (2020+)
        if (hResult && hResult.getFullYear() >= 2020) heuristicCorrect++;
      });

      console.log('\n  2-digit year handling:');
      console.log(`    Heuristic: ${heuristicCorrect}/${twoDigitYearFiles.length} correct (2020+)`);

      // Heuristic should handle 2-digit years correctly (at least 80%)
      assert.ok(
        heuristicCorrect >= twoDigitYearFiles.length * 0.8,
        'Heuristic should handle 2-digit years correctly'
      );
    });

    it('should detect compact datetime formats', () => {
      // Test files with compact datetime (YYYYMMDD_HHMMSS)
      const compactFiles = files.filter((f) => /\d{8}[_-]?\d{6}/.test(f));

      if (compactFiles.length === 0) {
        console.log('  No compact datetime files found in fixtures');
        return;
      }

      let detected = 0;
      let withTime = 0;

      compactFiles.forEach((filename) => {
        const result = parseTimestamp(filename, { method: DETECTION_METHOD.HEURISTIC });
        if (result) {
          detected++;
          // Check if time components are detected
          if (result.getHours() !== 0 || result.getMinutes() !== 0) {
            withTime++;
          }
        }
      });

      console.log(`\n  Compact datetime: ${detected}/${compactFiles.length} detected`);
      console.log(`    With time: ${withTime}/${detected}`);

      assert.ok(detected > 0, 'Should detect compact datetime formats');
    });

    it('should detect WhatsApp format with "at" separator', () => {
      // Test WhatsApp-style format
      const testFile = 'WhatsApp Image 2021-08-01 at 13.15.13.jpeg';
      const result = parseTimestamp(testFile, { method: DETECTION_METHOD.HEURISTIC });

      if (result) {
        console.log('\n  WhatsApp format: ✅ Detected');
        console.log(`    Date: ${result.toISOString().slice(0, 10)}`);
        console.log(`    Time: ${result.getHours()}:${result.getMinutes()}:${result.getSeconds()}`);

        assert.strictEqual(result.getFullYear(), 2021);
        assert.strictEqual(result.getMonth(), 7); // August
        assert.strictEqual(result.getDate(), 1);
        assert.strictEqual(result.getHours(), 13);
        assert.strictEqual(result.getMinutes(), 15);
        assert.strictEqual(result.getSeconds(), 13);
      } else {
        console.log('  WhatsApp format: ❌ Not detected');
        assert.fail('WhatsApp format should be detected');
      }
    });
  });

  describe('Performance indicators', () => {
    it('should measure detection speed', () => {
      const sampleSize = Math.min(100, files.length);
      const sampleFiles = files.slice(0, sampleSize);

      // Heuristic timing
      const hStart = Date.now();
      sampleFiles.forEach((f) => parseTimestamp(f, { method: DETECTION_METHOD.HEURISTIC }));
      const hTime = Date.now() - hStart;

      // Regex timing
      const rStart = Date.now();
      sampleFiles.forEach((f) => parseTimestamp(f, { method: DETECTION_METHOD.REGEX }));
      const rTime = Date.now() - rStart;

      console.log(`\n  Performance (${sampleSize} files):`);
      console.log(`    Heuristic: ${hTime}ms (${(hTime / sampleSize).toFixed(2)}ms/file)`);
      console.log(`    Regex: ${rTime}ms (${(rTime / sampleSize).toFixed(2)}ms/file)`);
      console.log(`    Speedup: ${(rTime / hTime).toFixed(2)}x`);

      // Just informational, no assertion
      assert.ok(true);
    });
  });
});
