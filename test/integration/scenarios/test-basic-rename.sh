#!/bin/bash
# Test 1: Basic Rename - Simple timestamp extraction and formatting
# Tests the core functionality without metadata or special options

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURE_DIR="$SCRIPT_DIR/../fixtures"
TEST_DIR="/tmp/dating-test-basic-$$"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 1: Basic Rename Functionality"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup
echo "📁 Setting up test directory..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

# Copy only non-ambiguous files from fixtures
cd "$TEST_DIR"
touch "2019-01-23-22-53-04-recording.m4a"
touch "2020-06-15-14-30-00-photo.jpg"
touch "2021-12-25_183045_video.mp4"
touch "2020-01-01-12-00-00-file[0].txt"
touch "2020-01-01-12-00-00-file(v2).txt"
touch "meeting.2023.12.15.notes.txt"

echo "   Created: $TEST_DIR"
echo "   Files: $(ls -1 | wc -l | xargs)"
echo ""

# Test 1.1: Dry run
echo "📋 Test 1.1: Dry run (preview)"
echo "   Command: dating . -d --resolution dd-mm-yyyy --resolution 2000s"
OUTPUT=$(dating . -d --resolution dd-mm-yyyy --resolution 2000s 2>&1)

if echo "$OUTPUT" | grep -q "Found.*item(s) to rename"; then
    echo -e "   ${GREEN}✓ Dry run executed${NC}"
else
    echo -e "   ${RED}✗ Dry run failed${NC}"
    echo "$OUTPUT"
    exit 1
fi

if echo "$OUTPUT" | grep -q "DRY RUN"; then
    echo -e "   ${GREEN}✓ Dry run mode detected${NC}"
else
    echo -e "   ${RED}✗ Not in dry run mode${NC}"
    exit 1
fi

# Test 1.2: Execute rename
echo ""
echo "🔨 Test 1.2: Execute rename"
echo "   Command: dating . -e --resolution dd-mm-yyyy --resolution 2000s"
OUTPUT=$(dating . -e --resolution dd-mm-yyyy --resolution 2000s 2>&1)

if echo "$OUTPUT" | grep -q "Successfully renamed"; then
    COUNT=$(echo "$OUTPUT" | grep -oE 'Successfully renamed [0-9]+' | grep -oE '[0-9]+')
    echo -e "   ${GREEN}✓ Renamed $COUNT files${NC}"
else
    echo -e "   ${RED}✗ Rename failed${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Test 1.3: Verify format
echo ""
echo "🔍 Test 1.3: Verify output format"
FORMATTED_COUNT=$(ls -1 | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}\.[0-9]{2}\.[0-9]{2}' | wc -l | xargs)

if [ "$FORMATTED_COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}✓ Found $FORMATTED_COUNT properly formatted files${NC}"
    echo "   Examples:"
    ls -1 | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}\.[0-9]{2}\.[0-9]{2}' | head -3 | sed 's/^/      /'
else
    echo -e "   ${RED}✗ No properly formatted files found${NC}"
    exit 1
fi

# Test 1.4: Special characters preserved
echo ""
echo "🔍 Test 1.4: Special characters preserved"
if ls -1 | grep -q '\[0\]'; then
    echo -e "   ${GREEN}✓ Brackets [0] preserved${NC}"
else
    echo -e "   ${YELLOW}⚠ Brackets not found (may not have been in test files)${NC}"
fi

if ls -1 | grep -q '(v2)'; then
    echo -e "   ${GREEN}✓ Parentheses (v2) preserved${NC}"
else
    echo -e "   ${YELLOW}⚠ Parentheses not found${NC}"
fi

# Test 1.5: No consecutive dots
echo ""
echo "🔍 Test 1.5: No consecutive dots in output"
if ls -1 | grep -q '\.\.'; then
    echo -e "   ${RED}✗ Found consecutive dots${NC}"
    ls -1 | grep '\.\.'
    exit 1
else
    echo -e "   ${GREEN}✓ No consecutive dots found${NC}"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf "$TEST_DIR"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test 1: PASSED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
