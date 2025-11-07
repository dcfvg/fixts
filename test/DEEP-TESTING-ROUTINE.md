# 🔬 Deep Testing Checklist for AI Assistant

**Purpose**: Prompt for GitHub Copilot to perform comprehensive code validation

---

## When to Use This

Run this deep testing routine:
- After major code changes
- Before releases
- When bugs are reported
- Monthly maintenance

---

## Testing Sequence

### 1. **Fix the Reported Issue First**
- Understand the exact problem
- Identify root cause in code
- Implement the fix
- Test the specific case manually

### 2. **Run Full Test Suite**
```bash
npm test          # All unit tests must pass
npm run lint      # No errors or warnings
bash test/integration/run-all.sh  # All 9 integration tests pass
npm run test:local:false-positives  # 100% accuracy required
```

### 3. **Manual Inspection of Real Files**
Run local sample analysis and **MANUALLY REVIEW OUTPUT**:
```bash
npm run test:local
```

**Critical Review Points**:
- Check "NON DÉTECTÉS" section: Are actual timestamps being missed?
- Check "LONGNUMBERS" section: Are Instagram IDs preserved correctly?
- Check "CAMERAIDS" section: Verify time patterns like `11_10` are detected as time, not names
- Check "DUPLICATETIMESTAMPS": Instagram montages extract first timestamp correctly?

### 4. **Test Actual Renaming (Not Just Detection)**
Create test files and verify the ACTUAL RENAMED OUTPUT:
```bash
mkdir /tmp/dating-manual-test && cd /tmp/dating-manual-test

# Test problematic patterns found in analysis
touch "2022-05-22-11_10 - Verjat Benoit - DSC01470.jpg"
touch "montage-2024-11-03_14.30.00_1234567890123456789.jpg"
touch "2024-11-03-22.30.00-late.txt"

# DRY RUN - inspect output carefully
dating . -d

# EXECUTE - verify renamed files are correct
dating . -e --no-interactive

# CHECK RESULTS
ls -1
```

**Verify**:
- Time components ARE in output (not just dates)
- Special characters preserved
- Instagram IDs kept
- Phone numbers preserved
- No consecutive dots or spaces

### 5. **Edge Cases Manual Testing**
```bash
# Ambiguous dates
touch "photo-05-06-2023.jpg"  # Test with both --resolution dmy and mdy

# Time crossing midnight
touch "2024-11-03-22.30.00-late.txt"
dating . --shift +2h -d  # Should become 2024-11-04 00.30.00

# Metadata extraction
touch "document.pdf" && touch -t 202311031430 "document.pdf"
dating . -m earliest -d  # Should extract from creation time

# Special characters
touch "file[0](v2)+edit.txt"  # All should be preserved
```

### 6. **Code Review Checklist**

Check recent changes haven't broken:
- ✅ Heuristic detector handles all patterns (no regex fallback needed)
- ✅ Time components (HH_MM, HH.MM, HH:MM) detected after dates
- ✅ `combineDateTimeComponents` includes all time types
- ✅ `detectDefinedComponents` recognizes all time patterns
- ✅ Metadata workflows use options objects (not positional params)
- ✅ Single filesystem scan (no double scan in metadata mode)

### 7. **Performance Check**
```bash
# Should complete in < 1 second for 1000 files
time dating /path/to/large/directory -d --no-interactive
```

---

## Success Criteria

**Must Pass (Zero Tolerance)**:
- ✅ All unit tests pass (90+ tests)
- ✅ All integration tests pass (9/9)
- ✅ No lint errors/warnings
- ✅ False positive test: 100% accuracy
- ✅ No "undefined" errors in any output

**Manual Validation Required**:
- ✅ Time components appear in renamed files (not just dates)
- ✅ Special characters preserved
- ✅ Instagram IDs / phone numbers / camera IDs kept
- ✅ Ambiguous dates resolved correctly
- ✅ Time shifts calculate correctly (including midnight crossing)

---

## Common Pitfalls to Check

1. **Time Not Showing in Output**
   - Parser detects time? Check with `node -e "import { parseTimestamp } from './src/utils/timestampParser.js'; console.log(parseTimestamp('filename'))"`
   - `detectDefinedComponents` recognizes pattern? Add regex if missing
   - Time type included in `combineDateTimeComponents`? Add if missing

2. **Pattern Not Detected**
   - Check heuristic detector handles the separator combination
   - Context-aware detection: time after date should be recognized
   - Add to TIME_HM detection if valid hour/minute values

3. **Instagram/Phone Numbers Changed**
   - Verify `removeTimestampPatterns` uses position-based removal (not regex)
   - Check cleaning patterns don't over-match

---

## After Testing

If all checks pass:
- ✅ Commit changes with clear message
- ✅ Update CHANGELOG if user-facing changes
- ✅ Document any new patterns supported

If failures found:
- 🔧 Fix the root cause
- 🔧 Add regression test
- � Re-run full suite

---

**Remember**: This is about DEEP MANUAL INSPECTION, not just running automated tests!

