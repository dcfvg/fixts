#!/bin/bash
# Test 3: Metadata Extraction - Test extraction from file metadata (birthtime)
# Tests the --use-metadata option with -m earliest (fallback mode)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURE_DIR="$SCRIPT_DIR/../fixtures"
TEST_DIR="/tmp/fixts-test-metadata-$$"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 3: Metadata Extraction"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup
echo "📁 Setting up test directory..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create files without timestamps but with specific modification dates
touch "photo1.jpg"
touch "photo2.jpg"
touch "document.pdf"

touch -t 202301151430 "photo1.jpg"
touch -t 202112251845 "photo2.jpg"
touch -t 202006151200 "document.pdf"

echo "   Created: $TEST_DIR"
echo "   Files: 3 files with specific modification times"
echo ""

# Test 3.1: Metadata extraction dry run (using -m earliest for fallback)
echo "📋 Test 3.1: Metadata extraction with fallback (dry run)"
echo "   Command: fixts . -m earliest -d"
OUTPUT=$(fixts . -m earliest -d 2>&1)

if echo "$OUTPUT" | grep -q "Scanning file metadata"; then
    echo -e "   ${GREEN}✓ Metadata scanning initiated${NC}"
else
    echo -e "   ${RED}✗ Metadata scanning not detected${NC}"
    echo "$OUTPUT"
    exit 1
fi

if echo "$OUTPUT" | grep -q "Found dates in.*of.*file"; then
    echo -e "   ${GREEN}✓ Dates extracted from metadata${NC}"
else
    echo -e "   ${RED}✗ No dates found${NC}"
    echo "$OUTPUT"
    exit 1
fi

if echo "$OUTPUT" | grep -q "from creation time\|from EXIF"; then
    echo -e "   ${GREEN}✓ Metadata source detected${NC}"
else
    echo -e "   ${YELLOW}⚠ Source may not be shown in output${NC}"
fi

# Test 3.2: Verify extracted dates
echo ""
echo "🔍 Test 3.2: Verify extracted dates"

if echo "$OUTPUT" | grep -q "2023-01-15"; then
    echo -e "   ${GREEN}✓ Date 2023-01-15 extracted correctly${NC}"
else
    echo -e "   ${RED}✗ Date not extracted${NC}"
    exit 1
fi

# Test 3.3: Execute metadata rename with fallback
echo ""
echo "🔨 Test 3.3: Execute metadata rename with fallback"
echo "   Command: fixts . -m earliest -e"
OUTPUT=$(fixts . -m earliest -e 2>&1)

if echo "$OUTPUT" | grep -q "Successfully renamed.*using metadata"; then
    COUNT=$(echo "$OUTPUT" | grep -oE 'Successfully renamed [0-9]+' | grep -oE '[0-9]+')
    echo -e "   ${GREEN}✓ Renamed $COUNT files using metadata${NC}"
else
    echo -e "   ${RED}✗ Metadata rename failed${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Test 3.4: Verify files renamed
echo ""
echo "🔍 Test 3.4: Verify renamed files"
RENAMED_COUNT=$(ls -1 | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}' | wc -l | xargs)

if [ "$RENAMED_COUNT" -eq 3 ]; then
    echo -e "   ${GREEN}✓ All 3 files renamed with date prefix${NC}"
    ls -1 | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}' | sed 's/^/      /'
else
    echo -e "   ${RED}✗ Expected 3 renamed files, found $RENAMED_COUNT${NC}"
    exit 1
fi

# Test 3.5: Metadata + Time Shift
echo ""
echo "📋 Test 3.5: Metadata extraction with time shift"
# Reset
rm -f *.jpg *.pdf
touch "photo-shift.jpg"
touch -t 202301151430 "photo-shift.jpg"

OUTPUT=$(fixts . -m birthtime --shift +9h -d 2>&1)

if echo "$OUTPUT" | grep -q "Time Shift: +9h"; then
    echo -e "   ${GREEN}✓ Shift applied to metadata${NC}"
else
    echo -e "   ${RED}✗ Shift not applied${NC}"
    exit 1
fi

if echo "$OUTPUT" | grep -q "2023-01-15 23.30"; then
    echo -e "   ${GREEN}✓ Time calculation correct (14:30 + 9h = 23:30)${NC}"
else
    echo -e "   ${RED}✗ Time calculation incorrect${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf "$TEST_DIR"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test 3: PASSED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
