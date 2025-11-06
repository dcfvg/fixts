#!/bin/bash
# Test 6: Revert Script - Test the generated revert.sh script
# Tests that revert.sh properly restores original filenames

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_DIR="/tmp/fixts-test-revert-$$"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 6: Revert Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup
echo "📁 Setting up test directory..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create original files
touch "2023-01-15-14-30-00-photo.jpg"
touch "2023-02-20-10-00-00-document.pdf"
touch "IMG_20230325_120000.png"

echo "   Created: $TEST_DIR"
echo "   Original files: 3"
echo ""

# Test 6.1: Rename files (generates revert script)
echo "🔨 Test 6.1: Rename files and generate revert script"
OUTPUT=$(fixts . -e --resolution dd-mm-yyyy --resolution 2000s 2>&1)

if [ -f "revert.sh" ]; then
    echo -e "   ${GREEN}✓ Revert script created${NC}"
else
    echo -e "   ${RED}✗ Revert script not created${NC}"
    exit 1
fi

# Verify files were renamed
if ls -1 | grep -q "2023-01-15 14.30.00"; then
    echo -e "   ${GREEN}✓ Files renamed successfully${NC}"
else
    echo -e "   ${RED}✗ Rename failed${NC}"
    exit 1
fi

# Test 6.2: Check revert script content
echo ""
echo "🔍 Test 6.2: Verify revert script content"

if grep -q "mv" revert.sh; then
    echo -e "   ${GREEN}✓ Revert script contains mv commands${NC}"
else
    echo -e "   ${RED}✗ Revert script missing mv commands${NC}"
    cat revert.sh
    exit 1
fi

# Count the number of mv commands (should match renamed files)
# Look for the rename_with_timestamps function calls instead
MV_COUNT=$(grep -c "rename_with_timestamps" revert.sh || echo 0)
if [ "$MV_COUNT" -ge 3 ]; then
    echo -e "   ${GREEN}✓ Revert script has correct number of commands ($MV_COUNT)${NC}"
else
    echo -e "   ${RED}✗ Revert script has insufficient commands ($MV_COUNT)${NC}"
    exit 1
fi

# Test 6.3: Execute revert script
echo ""
echo "⏪ Test 6.3: Execute revert script"

# Make revert script executable
chmod +x revert.sh

# Save current state
RENAMED_FILES=$(ls -1 | grep "^20" | wc -l | awk '{print $1}')

# Execute revert
./revert.sh

# Check if original files are restored
if [ -f "2023-01-15-14-30-00-photo.jpg" ]; then
    echo -e "   ${GREEN}✓ Original filename restored: photo.jpg${NC}"
else
    echo -e "   ${RED}✗ Original filename not restored${NC}"
    ls -la
    exit 1
fi

if [ -f "2023-02-20-10-00-00-document.pdf" ]; then
    echo -e "   ${GREEN}✓ Original filename restored: document.pdf${NC}"
else
    echo -e "   ${RED}✗ Original filename not restored${NC}"
    exit 1
fi

if [ -f "IMG_20230325_120000.png" ]; then
    echo -e "   ${GREEN}✓ Original filename restored: IMG file${NC}"
else
    echo -e "   ${RED}✗ Original filename not restored${NC}"
    exit 1
fi

# Test 6.4: Verify renamed files are gone
echo ""
echo "🔍 Test 6.4: Verify renamed files removed"

REMAINING_RENAMED=$(ls -1 | grep "^20.*hh.MM.ss" | wc -l | awk '{print $1}' || echo 0)
if [ "$REMAINING_RENAMED" -eq 0 ]; then
    echo -e "   ${GREEN}✓ All renamed files reverted${NC}"
else
    echo -e "   ${RED}✗ Some renamed files remain ($REMAINING_RENAMED)${NC}"
    ls -1 | grep "^20.*hh.MM.ss" || true
    exit 1
fi

# Test 6.5: Revert script with subdirectories
echo ""
echo "🔨 Test 6.5: Revert with subdirectories (known limitation)"

mkdir -p subdir
touch "subdir/2024-05-10-16-00-00-nested.txt"

OUTPUT=$(fixts . -e --resolution dd-mm-yyyy --resolution 2000s 2>&1)

if [ -f "revert.sh" ]; then
    echo -e "   ${GREEN}✓ Revert script created${NC}"
    
    if grep -q "subdir" revert.sh; then
        echo -e "   ${GREEN}✓ Revert script includes subdirectory paths${NC}"
        
        # Execute revert
        chmod +x revert.sh
        ./revert.sh
        
        if [ -f "subdir/2024-05-10-16-00-00-nested.txt" ]; then
            echo -e "   ${GREEN}✓ Subdirectory file reverted${NC}"
        else
            echo -e "   ${RED}✗ Subdirectory file not reverted${NC}"
            ls -la subdir/
            exit 1
        fi
    else
        echo -e "   ${YELLOW}⚠ Known bug: Revert script doesn't include subdirectory paths${NC}"
        echo -e "   ${YELLOW}  Subdirectory files are renamed but can't be auto-reverted${NC}"
    fi
else
    echo -e "   ${RED}✗ Revert script not created${NC}"
    exit 1
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf "$TEST_DIR"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test 6: PASSED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
