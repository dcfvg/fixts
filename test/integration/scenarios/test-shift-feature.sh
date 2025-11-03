#!/bin/bash
# Test 2: Time Shift Feature - Test positive and negative shifts
# Tests the --shift option with various time adjustments

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURE_DIR="$SCRIPT_DIR/../fixtures"
TEST_DIR="/tmp/dating-test-shift-$$"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 2: Time Shift Feature"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup
echo "📁 Setting up test directory..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

# Create specific test files with known timestamps
cd "$TEST_DIR"
touch "2024-01-01-22-30-00-late.txt"
touch "2024-01-01-02-30-00-early.txt"
touch "2024-06-15-12-00-00-noon.txt"

echo "   Created: $TEST_DIR"
echo "   Files: 3 test files with specific times"
echo ""

# Test 2.1: Positive shift (+2h)
echo "📋 Test 2.1: Positive shift (+2h)"
echo "   Command: dating . --shift +2h -d"
OUTPUT=$(dating . --shift +2h -d 2>&1)

if echo "$OUTPUT" | grep -q "Time Shift: +2h"; then
    echo -e "   ${GREEN}✓ Shift detected in output${NC}"
else
    echo -e "   ${RED}✗ Shift not shown${NC}"
    echo "$OUTPUT"
    exit 1
fi

if echo "$OUTPUT" | grep -q "2024-01-02 00.30.00"; then
    echo -e "   ${GREEN}✓ Midnight crossing works (22:30 + 2h = 00:30 next day)${NC}"
else
    echo -e "   ${RED}✗ Midnight crossing failed${NC}"
    echo "$OUTPUT"
    exit 1
fi

if echo "$OUTPUT" | grep -q "COPY"; then
    echo -e "   ${GREEN}✓ Copy mode auto-enabled${NC}"
else
    echo -e "   ${RED}✗ Copy mode not enabled${NC}"
    exit 1
fi

# Test 2.2: Negative shift (-3h)
echo ""
echo "📋 Test 2.2: Negative shift (-3h)"
echo "   Command: dating . --shift -3h -d"
OUTPUT=$(dating . --shift -3h -d 2>&1)

if echo "$OUTPUT" | grep -q "Time Shift: -3h"; then
    echo -e "   ${GREEN}✓ Negative shift detected${NC}"
else
    echo -e "   ${RED}✗ Negative shift not shown${NC}"
    exit 1
fi

if echo "$OUTPUT" | grep -q "2023-12-31 23.30.00"; then
    echo -e "   ${GREEN}✓ Backward midnight crossing works (02:30 - 3h = 23:30 prev day)${NC}"
else
    echo -e "   ${RED}✗ Backward midnight crossing failed${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Test 2.3: Execute with shift
echo ""
echo "🔨 Test 2.3: Execute with positive shift"
echo "   Command: dating . --shift +2h -e"
OUTPUT=$(dating . --shift +2h -e 2>&1)

if echo "$OUTPUT" | grep -q "Successfully copied"; then
    COUNT=$(echo "$OUTPUT" | grep -oE 'Successfully copied [0-9]+' | grep -oE '[0-9]+')
    echo -e "   ${GREEN}✓ Copied $COUNT files with shift${NC}"
else
    echo -e "   ${RED}✗ Copy with shift failed${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Verify _c directory exists
if [ -d "_c" ]; then
    echo -e "   ${GREEN}✓ Timed directory created${NC}"
    TIMED_COUNT=$(ls -1 _c/ | wc -l | xargs)
    echo "   Files in _c/: $TIMED_COUNT"
else
    echo -e "   ${RED}✗ Timed directory not created${NC}"
    exit 1
fi

# Test 2.4: Complex shift format
echo ""
echo "📋 Test 2.4: Complex shift (-1d3h30m)"
rm -rf _c/  # Clean previous test
OUTPUT=$(dating . --shift -1d3h30m -d 2>&1)

if echo "$OUTPUT" | grep -q "Time Shift:.*1d.*3h.*30m"; then
    echo -e "   ${GREEN}✓ Complex shift format parsed${NC}"
else
    echo -e "   ${RED}✗ Complex shift not parsed correctly${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf "$TEST_DIR"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test 2: PASSED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
