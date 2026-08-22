#!/bin/bash

# Cross-Browser Test Runner
# Runs Playwright tests across all three browsers and generates a summary

set -e

echo "=================================="
echo "Cross-Browser E2E Test Suite"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
declare -A results
browsers=("chromium" "firefox" "webkit")

# Run tests for each browser
for browser in "${browsers[@]}"; do
    echo "Running tests on ${YELLOW}${browser}${NC}..."
    echo "-----------------------------------"
    
    if npx playwright test --project="$browser" --reporter=list; then
        results[$browser]="PASSED"
        echo -e "${GREEN}✓ ${browser} tests passed${NC}"
    else
        results[$browser]="FAILED"
        echo -e "${RED}✗ ${browser} tests failed${NC}"
    fi
    echo ""
done

# Summary
echo "=================================="
echo "Test Results Summary"
echo "=================================="
for browser in "${browsers[@]}"; do
    status="${results[$browser]}"
    if [ "$status" = "PASSED" ]; then
        echo -e "${GREEN}✓${NC} ${browser}: ${status}"
    else
        echo -e "${RED}✗${NC} ${browser}: ${status}"
    fi
done
echo ""

# Check if all passed
all_passed=true
for browser in "${browsers[@]}"; do
    if [ "${results[$browser]}" != "PASSED" ]; then
        all_passed=false
        break
    fi
done

if [ "$all_passed" = true ]; then
    echo -e "${GREEN}All browsers passed!${NC} ✓"
    exit 0
else
    echo -e "${RED}Some browsers failed.${NC} ✗"
    echo ""
    echo "To debug failures:"
    for browser in "${browsers[@]}"; do
        if [ "${results[$browser]}" = "FAILED" ]; then
            echo "  npx playwright test --project=$browser --debug"
        fi
    done
    exit 1
fi
