#!/bin/bash
# Test 4: Format Variations - Test different output format options
# Tests the --format option with various date/time formats

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_DIR="/tmp/fixts-test-formats-$$"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 4: Format Variations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup
echo "📁 Setting up test directory..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create test file
touch "2024-01-15-14-30-45-document.txt"

echo "   Created: $TEST_DIR"
echo "   Test file: 2024-01-15-14-30-45-document.txt"
echo ""

# Test 4.1: Default format (yyyy-mm-dd hh.MM.ss)
echo "📋 Test 4.1: Default format"
OUTPUT=$(fixts . -d 2>&1)

if echo "$OUTPUT" | grep -q "2024-01-15 14.30.45"; then
    echo -e "   ${GREEN}✓ Default format works (yyyy-mm-dd hh.MM.ss)${NC}"
else
    echo -e "   ${RED}✗ Default format incorrect${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Test 4.2: Compact format (yyyymmdd_hhMMss)
echo ""
echo "📋 Test 4.2: Compact format"
OUTPUT=$(fixts . --format yyyymmdd_hhMMss -d 2>&1)

if echo "$OUTPUT" | grep -q "20240115_143045"; then
    echo -e "   ${GREEN}✓ Compact format works${NC}"
else
    echo -e "   ${RED}✗ Compact format incorrect${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Test 4.3: ISO format (yyyy-mm-ddThh:MM:ss)
echo ""
echo "📋 Test 4.3: ISO format"
OUTPUT=$(fixts . --format "yyyy-mm-ddThh:MM:ss" -d 2>&1)

if echo "$OUTPUT" | grep -q "2024-01-15T14:30:45"; then
    echo -e "   ${GREEN}✓ ISO format works${NC}"
else
    echo -e "   ${RED}✗ ISO format incorrect${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Test 4.4: Date only (yyyy-mm-dd)
echo ""
echo "📋 Test 4.4: Date only format"
OUTPUT=$(fixts . --format yyyy-mm-dd -d 2>&1)

if echo "$OUTPUT" | grep -q "2024-01-15 -"; then
    echo -e "   ${GREEN}✓ Date-only format works${NC}"
else
    echo -e "   ${RED}✗ Date-only format incorrect${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Test 4.5: Custom format with text
echo ""
echo "📋 Test 4.5: Custom format with separators"
OUTPUT=$(fixts . --format "yyyy_mm_dd-hh_MM_ss" -d 2>&1)

if echo "$OUTPUT" | grep -q "2024_01_15-14_30_45"; then
    echo -e "   ${GREEN}✓ Custom separator format works${NC}"
else
    echo -e "   ${RED}✗ Custom format incorrect${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Test 4.6: Execute with format
echo ""
echo "🔨 Test 4.6: Execute with custom format"
OUTPUT=$(fixts . --format yyyymmdd_hhMMss -e --resolution dd-mm-yyyy --resolution 2000s 2>&1)

if ls -1 | grep -q "20240115_143045"; then
    echo -e "   ${GREEN}✓ Format applied in execute mode${NC}"
    ls -1 | grep "20240115_143045" | sed 's/^/      /'
else
    echo -e "   ${RED}✗ Execute with format failed${NC}"
    ls -la
    exit 1
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf "$TEST_DIR"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test 4: PASSED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
