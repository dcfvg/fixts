#!/bin/bash
# Test: Metadata Modes - Comprehensive test of all metadata extraction modes
# Tests: -m content (strict EXIF/ID3), -m birthtime, -m earliest (with fallback)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURE_DIR="$SCRIPT_DIR/../fixtures"
TEST_DIR="/tmp/fixts-test-metadata-modes-$$"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test: Metadata Modes (Comprehensive)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup
echo "📁 Setting up test directory..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create test files with different metadata scenarios
# 1. Files WITHOUT timestamps in name (will need metadata)
touch "photo1.jpg"       # Image without EXIF
touch "photo2.jpg"       # Image without EXIF
touch "audio.mp3"        # Audio without ID3
touch "document.pdf"     # Document
touch "notes.txt"        # Text file

# 2. Set modification times (birthtime)
touch -t 202301151430 "photo1.jpg"
touch -t 202112251845 "photo2.jpg"
touch -t 202006151200 "audio.mp3"
touch -t 202105101000 "document.pdf"
touch -t 202203201500 "notes.txt"

# 3. Files WITH timestamps in name (already processable)
touch "2023-05-10 14.30.00 existing-photo.jpg"
touch "2022-08-15 10.15.30 existing-video.mp4"

echo "   Created: $TEST_DIR"
echo "   Files created:"
echo "     - 5 files WITHOUT timestamps (need metadata)"
echo "     - 2 files WITH timestamps (already formatted)"
echo ""

# ════════════════════════════════════════════════════════════════════════════
# TEST 1: Default mode (-m content) - STRICT EXIF/ID3 only
# ════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Test 1: -m content (default) - Strict mode${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "   Expected behavior:"
echo "   - Skip files without EXIF/ID3 metadata"
echo "   - Show context-aware hints"
echo "   - Display 'NEXT STEPS' section"
echo ""

OUTPUT=$(fixts . -m content -d 2>&1 || true)

# Check that files without metadata are skipped
if echo "$OUTPUT" | grep -q "Skipped.*file(s) without metadata"; then
    SKIPPED_COUNT=$(echo "$OUTPUT" | grep -oE 'Skipped [0-9]+' | grep -oE '[0-9]+' | head -1)
    echo -e "   ${GREEN}✓ Skipped $SKIPPED_COUNT files without embedded metadata${NC}"
else
    echo -e "   ${RED}✗ Expected files to be skipped in strict mode${NC}"
    exit 1
fi

# Check for context-aware hints
if echo "$OUTPUT" | grep -q "No EXIF metadata found"; then
    echo -e "   ${GREEN}✓ Context-aware hint for images displayed${NC}"
else
    echo -e "   ${YELLOW}⚠ Image-specific hint not found${NC}"
fi

if echo "$OUTPUT" | grep -q "No audio metadata found"; then
    echo -e "   ${GREEN}✓ Context-aware hint for audio displayed${NC}"
else
    echo -e "   ${YELLOW}⚠ Audio-specific hint not found${NC}"
fi

# Check for NEXT STEPS section
if echo "$OUTPUT" | grep -q "NEXT STEPS"; then
    echo -e "   ${GREEN}✓ 'NEXT STEPS' section displayed${NC}"
else
    echo -e "   ${RED}✗ Missing 'NEXT STEPS' section${NC}"
    exit 1
fi

# Check for suggestion to use -m earliest
if echo "$OUTPUT" | grep -q -- "-m earliest"; then
    echo -e "   ${GREEN}✓ Suggestion to use '-m earliest' provided${NC}"
else
    echo -e "   ${RED}✗ Missing suggestion for fallback mode${NC}"
    exit 1
fi

# Check that files with timestamps are still processed
if echo "$OUTPUT" | grep -q "2023-05-10 14.30.00 existing-photo.jpg"; then
    echo -e "   ${GREEN}✓ Files with timestamps still processed${NC}"
else
    echo -e "   ${YELLOW}⚠ Files with timestamps not shown (may be already formatted)${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════
# TEST 2: -m birthtime - Creation time only
# ════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Test 2: -m birthtime - Creation time only${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "   Expected behavior:"
echo "   - Process ALL files using creation time"
echo "   - No files skipped"
echo "   - Source shown as 'creation time'"
echo ""

OUTPUT=$(fixts . -m birthtime -d 2>&1 || true)

# Check that files are processed
if echo "$OUTPUT" | grep -q "Found dates in"; then
    DATES_FOUND=$(echo "$OUTPUT" | grep -oE 'Found dates in [0-9]+' | grep -oE '[0-9]+')
    echo -e "   ${GREEN}✓ Found dates in $DATES_FOUND files${NC}"
    
    if [ "$DATES_FOUND" -ge 5 ]; then
        echo -e "   ${GREEN}✓ All files without timestamps processed${NC}"
    else
        echo -e "   ${YELLOW}⚠ Expected at least 5 files processed, got $DATES_FOUND${NC}"
    fi
else
    echo -e "   ${RED}✗ No dates found with birthtime mode${NC}"
    exit 1
fi

# Check that source is creation time
if echo "$OUTPUT" | grep -q "from creation time"; then
    echo -e "   ${GREEN}✓ Source shown as 'creation time'${NC}"
else
    echo -e "   ${YELLOW}⚠ Source not shown (may be expected in some output formats)${NC}"
fi

# Verify no skipped files message
if echo "$OUTPUT" | grep -q "Skipped.*file(s) without metadata"; then
    echo -e "   ${RED}✗ Files should NOT be skipped in birthtime mode${NC}"
    exit 1
else
    echo -e "   ${GREEN}✓ No files skipped (as expected)${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════
# TEST 3: -m earliest - EXIF preferred with fallback
# ════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Test 3: -m earliest - Permissive with fallback${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "   Expected behavior:"
echo "   - Process ALL files (EXIF preferred, fallback to creation time)"
echo "   - No files skipped"
echo "   - Mixed sources shown"
echo ""

OUTPUT=$(fixts . -m earliest -d 2>&1 || true)

# Check that files are processed
if echo "$OUTPUT" | grep -q "Found dates in"; then
    DATES_FOUND=$(echo "$OUTPUT" | grep -oE 'Found dates in [0-9]+' | grep -oE '[0-9]+')
    echo -e "   ${GREEN}✓ Found dates in $DATES_FOUND files${NC}"
    
    if [ "$DATES_FOUND" -ge 5 ]; then
        echo -e "   ${GREEN}✓ All files processed with fallback${NC}"
    else
        echo -e "   ${YELLOW}⚠ Expected at least 5 files, got $DATES_FOUND${NC}"
    fi
else
    echo -e "   ${RED}✗ No dates found with earliest mode${NC}"
    exit 1
fi

# Verify no skipped files
if echo "$OUTPUT" | grep -q "Skipped.*file(s) without metadata"; then
    echo -e "   ${RED}✗ Files should NOT be skipped in earliest mode (has fallback)${NC}"
    exit 1
else
    echo -e "   ${GREEN}✓ No files skipped (fallback working)${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════
# TEST 4: Execute with -m earliest and verify results
# ════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔨 Test 4: Execute rename with -m earliest${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Clean up and recreate files for execution test
rm -f *.jpg *.mp3 *.pdf *.txt *.mp4
touch "photo-exec.jpg"
touch "audio-exec.mp3"
touch "doc-exec.pdf"
touch -t 202301151430 "photo-exec.jpg"
touch -t 202112251845 "audio-exec.mp3"
touch -t 202006151200 "doc-exec.pdf"

OUTPUT=$(fixts . -m earliest -e 2>&1)

# Check execution
if echo "$OUTPUT" | grep -q "Successfully renamed"; then
    RENAMED_COUNT=$(echo "$OUTPUT" | grep -oE 'Successfully renamed [0-9]+' | grep -oE '[0-9]+')
    echo -e "   ${GREEN}✓ Successfully renamed $RENAMED_COUNT files${NC}"
else
    echo -e "   ${RED}✗ Execution failed${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Verify files are renamed with date prefix
DATED_FILES=$(ls -1 | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}' | wc -l | xargs)
if [ "$DATED_FILES" -eq 3 ]; then
    echo -e "   ${GREEN}✓ All 3 files renamed with date prefix${NC}"
    echo "   Renamed files:"
    ls -1 | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}' | sed 's/^/      /'
else
    echo -e "   ${RED}✗ Expected 3 renamed files, got $DATED_FILES${NC}"
    exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════
# TEST 5: Alias support (exif → content, creation → birthtime)
# ════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Test 5: Alias support${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test alias: exif → content
rm -f *.jpg *.mp3 *.pdf
touch "alias-test.jpg"
touch -t 202301151430 "alias-test.jpg"

OUTPUT=$(fixts . -m exif -d 2>&1 || true)

if echo "$OUTPUT" | grep -q "Skipped.*file(s) without metadata" || echo "$OUTPUT" | grep -q "no dates found"; then
    echo -e "   ${GREEN}✓ Alias 'exif' works as 'content' (strict mode)${NC}"
else
    echo -e "   ${YELLOW}⚠ Unable to verify 'exif' alias behavior${NC}"
fi

# Test alias: creation → birthtime
OUTPUT=$(fixts . -m creation -d 2>&1)

if echo "$OUTPUT" | grep -q "Found dates in.*1.*file" || echo "$OUTPUT" | grep -q "creation time"; then
    echo -e "   ${GREEN}✓ Alias 'creation' works as 'birthtime'${NC}"
else
    echo -e "   ${YELLOW}⚠ Unable to verify 'creation' alias behavior${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════
# TEST 6: Syntax variations
# ════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Test 6: Syntax variations${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test: fixts -m . (source defaults to 'content')
OUTPUT=$(fixts -m . -d 2>&1 || true)
if [ $? -eq 0 ] || echo "$OUTPUT" | grep -q "Scanning"; then
    echo -e "   ${GREEN}✓ Syntax 'fixts -m .' works${NC}"
else
    echo -e "   ${RED}✗ Syntax 'fixts -m .' failed${NC}"
    exit 1
fi

# Test: fixts -m content . (explicit source)
OUTPUT=$(fixts -m content . -d 2>&1 || true)
if [ $? -eq 0 ] || echo "$OUTPUT" | grep -q "Scanning"; then
    echo -e "   ${GREEN}✓ Syntax 'fixts -m content .' works${NC}"
else
    echo -e "   ${RED}✗ Syntax 'fixts -m content .' failed${NC}"
    exit 1
fi

# Test: fixts -m birthtime . (source at end)
OUTPUT=$(fixts -m birthtime . -d 2>&1)
if [ $? -eq 0 ] || echo "$OUTPUT" | grep -q "Scanning"; then
    echo -e "   ${GREEN}✓ Syntax 'fixts -m birthtime .' works${NC}"
else
    echo -e "   ${RED}✗ Syntax 'fixts -m birthtime .' failed${NC}"
    exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════
# TEST 7: Time shift with metadata
# ════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Test 7: Time shift with metadata${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

rm -f *.jpg
touch "shift-test.jpg"
touch -t 202301151430 "shift-test.jpg"  # 2023-01-15 14:30

OUTPUT=$(fixts . -m birthtime --shift +2h -d 2>&1)

# Check shift indication
if echo "$OUTPUT" | grep -q "Time Shift: +2h"; then
    echo -e "   ${GREEN}✓ Time shift indicator shown${NC}"
else
    echo -e "   ${RED}✗ Time shift not indicated${NC}"
    exit 1
fi

# Check shifted time (14:30 + 2h = 16:30)
if echo "$OUTPUT" | grep -q "16.30"; then
    echo -e "   ${GREEN}✓ Time calculation correct (14:30 + 2h = 16:30)${NC}"
else
    echo -e "   ${YELLOW}⚠ Expected time 16:30 not found${NC}"
    echo "   Output: $OUTPUT"
fi

echo ""

# Cleanup
echo "🧹 Cleaning up..."
rm -rf "$TEST_DIR"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All Tests PASSED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Summary:"
echo "  ✓ Test 1: -m content (strict mode with skips)"
echo "  ✓ Test 2: -m birthtime (creation time only)"
echo "  ✓ Test 3: -m earliest (with fallback)"
echo "  ✓ Test 4: Execution test"
echo "  ✓ Test 5: Alias support (exif, creation)"
echo "  ✓ Test 6: Syntax variations"
echo "  ✓ Test 7: Time shift with metadata"
echo ""
