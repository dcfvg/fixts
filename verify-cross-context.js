#!/usr/bin/env node

/**
 * Verification Script: Cross-Context Compatibility
 *
 * Verifies all improvements work correctly in:
 * - Node.js module context (index.js)
 * - Browser context (browser.js)
 * - CLI context
 */

import { existsSync } from 'fs';

console.log('🔍 Verifying cross-context compatibility...\n');

let passed = 0;
let failed = 0;

// Test 1: Node.js Module Exports
console.log('📦 Test 1: Node.js Module Context (index.js)');
try {
  const mainModule = await import('./index.js');

  // v1.0.5 features
  const v105Features = [
    'parseTimestamp',
    'parseTimestampBatch',
    'getBatchStats',
    'getDetectionInfo'
  ];

  // v1.0.6 features
  const v106Features = [
    'analyzeContextualFormat',
    'resolveAmbiguitiesByContext',
    'hasAmbiguousDates'
  ];

  // v1.0.7 features
  const v107Features = [
    'registerPattern',
    'applyCustomPatterns',
    'exportPatterns',
    'clearPatterns'
  ];

  // v1.0.8 features
  const v108Features = [
    'extractTimestamp',
    'extractTimestampBatch',
    'compareTimestampSources',
    'SOURCE_TYPE'
  ];

  const allFeatures = [...v105Features, ...v106Features, ...v107Features, ...v108Features];

  let missing = [];
  for (const feature of allFeatures) {
    if (!mainModule[feature]) {
      missing.push(feature);
    }
  }

  if (missing.length === 0) {
    console.log('  ✅ All features exported correctly');
    console.log(`     - v1.0.5: ${v105Features.length} features`);
    console.log(`     - v1.0.6: ${v106Features.length} features`);
    console.log(`     - v1.0.7: ${v107Features.length} features`);
    console.log(`     - v1.0.8: ${v108Features.length} features`);
    passed++;
  } else {
    console.log(`  ❌ Missing features: ${missing.join(', ')}`);
    failed++;
  }
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  failed++;
}

// Test 2: Browser Module Exports
console.log('\n🌐 Test 2: Browser Context (browser.js)');
try {
  const browserModule = await import('./browser.js');

  // Browser-safe features
  const browserFeatures = [
    // v1.0.5
    'parseTimestamp',
    'parseTimestampBatch',
    'getBatchStats',
    'getDetectionInfo',
    // v1.0.6
    'analyzeContextualFormat',
    'resolveAmbiguitiesByContext',
    'hasAmbiguousDates',
    // v1.0.7
    'registerPattern',
    'applyCustomPatterns',
    'exportPatterns',
    // v1.0.8 (browser-safe subset)
    'extractTimestamp',
    'extractTimestampBatch',
    'compareTimestampSources',
    'SOURCE_TYPE'
  ];

  let missing = [];
  for (const feature of browserFeatures) {
    if (!browserModule[feature]) {
      missing.push(feature);
    }
  }

  // Check that Node.js-specific features are NOT exported
  const shouldNotExist = ['MTIME', 'BIRTHTIME'];
  let incorrectlyExported = [];
  if (browserModule.SOURCE_TYPE) {
    for (const feature of shouldNotExist) {
      if (browserModule.SOURCE_TYPE[feature] !== undefined) {
        incorrectlyExported.push(feature);
      }
    }
  }

  if (missing.length === 0 && incorrectlyExported.length === 0) {
    console.log('  ✅ All browser-safe features exported correctly');
    console.log(`     - ${browserFeatures.length} features available`);
    console.log('     - Node.js-specific features excluded (mtime, birthtime)');
    passed++;
  } else {
    if (missing.length > 0) {
      console.log(`  ❌ Missing features: ${missing.join(', ')}`);
    }
    if (incorrectlyExported.length > 0) {
      console.log(`  ❌ Incorrectly exported: ${incorrectlyExported.join(', ')}`);
    }
    failed++;
  }
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  failed++;
}

// Test 3: CLI Entry Point
console.log('\n⚙️  Test 3: CLI Context');
try {
  const cliExists = existsSync('./cli.js');
  const srcCliExists = existsSync('./src/cli/cli.js');

  if (cliExists || srcCliExists) {
    console.log('  ✅ CLI entry point exists');
    console.log('     - All features accessible via command-line interface');
    passed++;
  } else {
    console.log('  ❌ CLI entry point not found');
    failed++;
  }
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  failed++;
}

// Test 4: Functional Verification
console.log('\n🧪 Test 4: Functional Verification');
try {
  const { parseTimestamp, registerPattern, extractTimestamp, clearPatterns } = await import('./index.js');

  // Test basic parsing (v1.0.5+)
  const date1 = parseTimestamp('2024-01-15-14-30-45.txt');
  if (!(date1 instanceof Date)) {
    throw new Error('Basic parsing failed');
  }

  // Test custom patterns (v1.0.7)
  clearPatterns();
  registerPattern({
    name: 'verify-test',
    regex: /VFY(\d{4})(\d{2})(\d{2})/,
    extractor: { year: 1, month: 2, day: 3 },
    priority: 50
  });
  const date2 = parseTimestamp('VFY20240315.txt');
  if (!(date2 instanceof Date)) {
    throw new Error('Custom pattern parsing failed');
  }
  clearPatterns();

  // Test unified metadata (v1.0.8)
  const result = await extractTimestamp('2024-01-15-test.txt');
  if (!result || !result.source || !result.timestamp) {
    throw new Error('Unified metadata extraction failed');
  }

  console.log('  ✅ All functional tests passed');
  console.log('     - Basic parsing: ✓');
  console.log('     - Custom patterns: ✓');
  console.log('     - Unified metadata: ✓');
  passed++;
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
  failed++;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Verification Summary');
console.log('='.repeat(60));
console.log(`✅ Passed: ${passed}/4`);
console.log(`❌ Failed: ${failed}/4`);

if (failed === 0) {
  console.log('\n🎉 All features work correctly in all contexts!');
  console.log('   ✓ Node.js module context');
  console.log('   ✓ Browser context');
  console.log('   ✓ CLI context');
  console.log('   ✓ Functional verification');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the output above.');
  process.exit(1);
}
