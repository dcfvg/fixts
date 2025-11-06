#!/bin/bash

# Integration test for file extension filtering

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test: Extension Filtering"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create test directory
TEST_DIR=$(mktemp -d /tmp/fixts-test-extensions-XXXXX)
echo "📁 Setting up test directory..."
echo "   Created: $TEST_DIR"

cd "$TEST_DIR"

# Create test files with different extensions
touch "2024-01-15-photo.jpg"
touch "2024-01-16-video.mp4"
touch "2024-01-17-document.pdf"
touch "2024-01-18-image.png"
touch "2024-01-19-text.txt"
touch "2024-01-20-archive.zip"

echo "   Files: 6 with various extensions"
echo ""

# Test 1: Include only image files
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 1: Include only images (-i jpg png)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

OUTPUT=$(fixts . -d -i jpg png 2>&1)

# Check that only jpg and png files are processed
if echo "$OUTPUT" | grep -q "2024-01-15-photo.jpg"; then
    echo -e "   ${GREEN}✓ jpg file included${NC}"
else
    echo -e "   ${RED}✗ jpg file not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

if echo "$OUTPUT" | grep -q "2024-01-18-image.png"; then
    echo -e "   ${GREEN}✓ png file included${NC}"
else
    echo -e "   ${RED}✗ png file not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

if ! echo "$OUTPUT" | grep -q "2024-01-16-video.mp4"; then
    echo -e "   ${GREEN}✓ mp4 file excluded${NC}"
else
    echo -e "   ${RED}✗ mp4 file should not be processed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

if ! echo "$OUTPUT" | grep -q "2024-01-17-document.pdf"; then
    echo -e "   ${GREEN}✓ pdf file excluded${NC}"
else
    echo -e "   ${RED}✗ pdf file should not be processed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 2: Exclude documents
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 2: Exclude documents (-x pdf txt)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

OUTPUT=$(fixts . -d -x pdf txt 2>&1)

# Check that pdf and txt files are excluded
if ! echo "$OUTPUT" | grep -q "2024-01-17-document.pdf"; then
    echo -e "   ${GREEN}✓ pdf file excluded${NC}"
else
    echo -e "   ${RED}✗ pdf file should not be processed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

if ! echo "$OUTPUT" | grep -q "2024-01-19-text.txt"; then
    echo -e "   ${GREEN}✓ txt file excluded${NC}"
else
    echo -e "   ${RED}✗ txt file should not be processed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Other files should be included
if echo "$OUTPUT" | grep -q "2024-01-15-photo.jpg"; then
    echo -e "   ${GREEN}✓ jpg file included${NC}"
else
    echo -e "   ${RED}✗ jpg file not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

if echo "$OUTPUT" | grep -q "2024-01-16-video.mp4"; then
    echo -e "   ${GREEN}✓ mp4 file included${NC}"
else
    echo -e "   ${RED}✗ mp4 file not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 3: Combine include and exclude
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 3: Combined filters (-i jpg png pdf -x pdf)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

OUTPUT=$(fixts . -d -i jpg png pdf -x pdf 2>&1)

# pdf should be excluded even though it's in include list
if ! echo "$OUTPUT" | grep -q "2024-01-17-document.pdf"; then
    echo -e "   ${GREEN}✓ pdf excluded (exclude takes priority)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "   ${RED}✗ pdf should be excluded${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# jpg and png should still be included
if echo "$OUTPUT" | grep -q "2024-01-15-photo.jpg"; then
    echo -e "   ${GREEN}✓ jpg file included${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "   ${RED}✗ jpg file not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 4: Subdirectories
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 4: Recursive filtering with subdirectories"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir subdir
touch "subdir/2024-01-21-sub-photo.jpg"
touch "subdir/2024-01-22-sub-video.mp4"

OUTPUT=$(fixts . -d -i jpg 2>&1)

# Check files from subdirectory
if echo "$OUTPUT" | grep -q "2024-01-21-sub-photo.jpg"; then
    echo -e "   ${GREEN}✓ jpg file in subdirectory included${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "   ${RED}✗ jpg file in subdirectory not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

if ! echo "$OUTPUT" | grep -q "2024-01-22-sub-video.mp4"; then
    echo -e "   ${GREEN}✓ mp4 file in subdirectory excluded${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "   ${RED}✗ mp4 file should not be processed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
cd /
rm -rf "$TEST_DIR"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Test: PASSED${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
else
    echo -e "${RED}❌ Test: FAILED${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "   Passed: $TESTS_PASSED"
    echo "   Failed: $TESTS_FAILED"
    exit 1
fi
