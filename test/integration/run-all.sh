#!/bin/bash
# Master test runner - Runs all CLI integration tests
# Usage: ./run-all.sh [test-number]
#   Without args: runs all tests
#   With number: runs specific test (e.g., ./run-all.sh 2)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCENARIOS_DIR="$SCRIPT_DIR/scenarios"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Banner
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                        ║${NC}"
echo -e "${BLUE}║   Fixts CLI Integration Test Suite    ║${NC}"
echo -e "${BLUE}║                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Setup fixtures first
echo "🔧 Setting up test fixtures..."
bash "$SCRIPT_DIR/setup-fixtures.sh"
echo ""

# Define tests
TESTS=(
    "test-basic-rename.sh:Basic Rename"
    "test-shift-feature.sh:Time Shift"
    "test-metadata.sh:Metadata Extraction (Legacy)"
    "test-metadata-modes.sh:Metadata Modes (Comprehensive)"
    "test-interactive-metadata.sh:Interactive Workflow with Metadata"
    "test-execute-no-confirm.sh:Execute without Confirmation"
    "test-formats.sh:Format Variations"
    "test-recursion.sh:Subdirectory Recursion"
    "test-revert.sh:Revert Script"
    "test-extension-filters.sh:Extension Filtering"
    "test-copy-modes.sh:Copy Modes (Structure & Flattening)"
)

PASSED=0
FAILED=0
SKIPPED=0

# Check if specific test requested
SPECIFIC_TEST=""
if [ $# -gt 0 ]; then
    SPECIFIC_TEST=$1
    echo -e "${YELLOW}ℹ️  Running only test #$SPECIFIC_TEST${NC}"
    echo ""
fi

# Run tests
for i in "${!TESTS[@]}"; do
    TEST_NUM=$((i + 1))
    IFS=':' read -r SCRIPT NAME <<< "${TESTS[$i]}"
    
    # Skip if specific test requested and this isn't it
    if [ -n "$SPECIFIC_TEST" ] && [ "$SPECIFIC_TEST" != "$TEST_NUM" ]; then
        continue
    fi
    
    TEST_PATH="$SCENARIOS_DIR/$SCRIPT"
    
    if [ ! -f "$TEST_PATH" ]; then
        echo -e "${YELLOW}⚠️  Test $TEST_NUM ($NAME) not found: $SCRIPT${NC}"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi
    
    # Make executable if not already
    chmod +x "$TEST_PATH"
    
    # Run test
    echo ""
    if bash "$TEST_PATH"; then
        PASSED=$((PASSED + 1))
    else
        echo ""
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}❌ Test $TEST_NUM: FAILED${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Test Suite Summary           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}✓ Passed:${NC}  $PASSED"
echo -e "  ${RED}✗ Failed:${NC}  $FAILED"
if [ $SKIPPED -gt 0 ]; then
    echo -e "  ${YELLOW}⊘ Skipped:${NC} $SKIPPED"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}║        ✅ ALL TESTS PASSED! ✅         ║${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                        ║${NC}"
    echo -e "${RED}║      ❌ SOME TESTS FAILED ❌          ║${NC}"
    echo -e "${RED}║                                        ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    echo ""
    exit 1
fi
