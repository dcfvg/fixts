#!/bin/bash
# Quick smoke test - Minimal test to verify basic CLI functionality
# Run this anytime from chat to quickly verify the tool works

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

TEST_DIR="/tmp/fixts-smoke-test-$$"

echo "🔥 Fixts CLI - Quick Smoke Test"
echo "=================================="
echo ""

# Setup
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "1️⃣  Testing basic rename..."
touch "2023-01-15-14-30-00-document.txt"
OUTPUT=$(fixts . -e 2>&1)

if ls -1 | grep -q "2023-01-15 14.30.00"; then
    echo -e "   ${GREEN}✓ Basic rename works${NC}"
else
    echo -e "   ${RED}✗ Basic rename failed${NC}"
    exit 1
fi

# Test 2: Time shift
echo ""
echo "2️⃣  Testing time shift (+2h)..."
cd "$TEST_DIR"
rm -rf *
touch "2024-01-01-22-00-00-test.txt"
OUTPUT=$(fixts . --shift +2h -e 2>&1)

if [ -d "_c" ] && ls _c/ | grep -q "2024-01-02 00.00.00"; then
    echo -e "   ${GREEN}✓ Time shift works (crosses midnight)${NC}"
else
    echo -e "   ${RED}✗ Time shift failed${NC}"
    ls -la _c/ 2>/dev/null || echo "No _c directory"
    exit 1
fi

# Test 3: Metadata
cd "$TEST_DIR"
rm -rf * 
touch "photo.jpg"
touch -t 202112251430 "photo.jpg"
echo ""
echo "3️⃣  Testing metadata extraction..."
OUTPUT=$(fixts . --use-metadata -e 2>&1)

if ls -1 | grep -q "2021-12-25"; then
    echo -e "   ${GREEN}✓ Metadata extraction works${NC}"
else
    echo -e "   ${RED}✗ Metadata extraction failed${NC}"
    ls -la
    exit 1
fi

# Cleanup
cd /tmp
rm -rf "$TEST_DIR"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ ALL SMOKE TESTS PASSED ✅   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════╝${NC}"
echo ""
echo "✨ Basic CLI functionality verified!"
