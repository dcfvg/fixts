#!/bin/bash
# Test: Copy Modes - Structure Preservation & Flattening
# Tests --copy (preserve subdirectories) and --copy-flat (flatten all to root)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_DIR="/tmp/fixts-test-copy-modes-$$"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test: Copy Modes (Structure & Flattening)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup
echo "📁 Setting up test directory with nested structure..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
mkdir -p "$TEST_DIR/subdir1"
mkdir -p "$TEST_DIR/subdir2/nested"

# Create files with timestamps in different directories
echo "file1" > "$TEST_DIR/20200130-file1.txt"
echo "file2" > "$TEST_DIR/subdir1/20200131-file2.txt"
echo "file3" > "$TEST_DIR/subdir2/20200201-file3.txt"
echo "file4" > "$TEST_DIR/subdir2/nested/20200202-file4.txt"

echo "   Created: $TEST_DIR"
echo "   Structure:"
echo "     - 20200130-file1.txt (root)"
echo "     - subdir1/20200131-file2.txt"
echo "     - subdir2/20200201-file3.txt"
echo "     - subdir2/nested/20200202-file4.txt"
echo ""

# Test 1: Default copy mode (preserve structure)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 1: Default --copy (preserve subdirectories)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

OUTPUT=$(fixts "$TEST_DIR" --copy --execute --depth Infinity --resolution dd-mm-yyyy 2>&1)

if echo "$OUTPUT" | grep -q "Successfully copied 4 item(s)"; then
    echo -e "   ${GREEN}✓ Copied 4 files${NC}"
else
    echo -e "   ${RED}✗ Copy failed${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Check _c directory exists
if [ -d "$TEST_DIR/_c" ]; then
    echo -e "   ${GREEN}✓ _c directory created${NC}"
else
    echo -e "   ${RED}✗ _c directory not found${NC}"
    exit 1
fi

# Check root level file
if [ -f "$TEST_DIR/_c/2020-01-30 - file1.txt" ]; then
    echo -e "   ${GREEN}✓ Root file copied${NC}"
else
    echo -e "   ${RED}✗ Root file not found${NC}"
    exit 1
fi

# Check subdirectory structure is preserved
if [ -f "$TEST_DIR/_c/subdir1/2020-01-31 - file2.txt" ]; then
    echo -e "   ${GREEN}✓ subdir1 structure preserved${NC}"
else
    echo -e "   ${RED}✗ subdir1 structure not preserved${NC}"
    exit 1
fi

if [ -f "$TEST_DIR/_c/subdir2/2020-02-01 - file3.txt" ]; then
    echo -e "   ${GREEN}✓ subdir2 structure preserved${NC}"
else
    echo -e "   ${RED}✗ subdir2 structure not preserved${NC}"
    exit 1
fi

if [ -f "$TEST_DIR/_c/subdir2/nested/2020-02-02 - file4.txt" ]; then
    echo -e "   ${GREEN}✓ nested structure preserved${NC}"
else
    echo -e "   ${RED}✗ nested structure not preserved${NC}"
    exit 1
fi

# Verify original files still exist
if [ -f "$TEST_DIR/20200130-file1.txt" ] && [ -f "$TEST_DIR/subdir1/20200131-file2.txt" ]; then
    echo -e "   ${GREEN}✓ Original files preserved${NC}"
else
    echo -e "   ${RED}✗ Original files not preserved${NC}"
    exit 1
fi

# Verify content
CONTENT=$(cat "$TEST_DIR/_c/2020-01-30 - file1.txt")
if [ "$CONTENT" = "file1" ]; then
    echo -e "   ${GREEN}✓ File content preserved${NC}"
else
    echo -e "   ${RED}✗ File content corrupted${NC}"
    exit 1
fi

echo ""

# Test 2: Flat copy mode
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 2: --copy-flat (flatten to _c root)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Clean previous _c directory
rm -rf "$TEST_DIR/_c"

OUTPUT=$(fixts "$TEST_DIR" --copy-flat --execute --depth Infinity --resolution dd-mm-yyyy 2>&1)

if echo "$OUTPUT" | grep -q "Successfully copied 4 item(s)"; then
    echo -e "   ${GREEN}✓ Copied 4 files${NC}"
else
    echo -e "   ${RED}✗ Copy failed${NC}"
    echo "$OUTPUT"
    exit 1
fi

# Check all files are in _c root (no subdirectories)
if [ -f "$TEST_DIR/_c/2020-01-30 - file1.txt" ]; then
    echo -e "   ${GREEN}✓ file1 in root${NC}"
else
    echo -e "   ${RED}✗ file1 not found${NC}"
    exit 1
fi

if [ -f "$TEST_DIR/_c/2020-01-31 - file2.txt" ]; then
    echo -e "   ${GREEN}✓ file2 flattened to root${NC}"
else
    echo -e "   ${RED}✗ file2 not found${NC}"
    exit 1
fi

if [ -f "$TEST_DIR/_c/2020-02-01 - file3.txt" ]; then
    echo -e "   ${GREEN}✓ file3 flattened to root${NC}"
else
    echo -e "   ${RED}✗ file3 not found${NC}"
    exit 1
fi

if [ -f "$TEST_DIR/_c/2020-02-02 - file4.txt" ]; then
    echo -e "   ${GREEN}✓ file4 flattened to root${NC}"
else
    echo -e "   ${RED}✗ file4 not found${NC}"
    exit 1
fi

# Verify NO subdirectories exist in _c
if [ -d "$TEST_DIR/_c/subdir1" ] || [ -d "$TEST_DIR/_c/subdir2" ]; then
    echo -e "   ${RED}✗ Subdirectories should not exist in flat mode${NC}"
    exit 1
else
    echo -e "   ${GREEN}✓ No subdirectories in _c (flat verified)${NC}"
fi

# Verify content in flat mode
CONTENT=$(cat "$TEST_DIR/_c/2020-01-31 - file2.txt")
if [ "$CONTENT" = "file2" ]; then
    echo -e "   ${GREEN}✓ Flat file content preserved${NC}"
else
    echo -e "   ${RED}✗ Flat file content corrupted${NC}"
    exit 1
fi

echo ""

# Cleanup
echo "🧹 Cleaning up..."
rm -rf "$TEST_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Test: PASSED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
