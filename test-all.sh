#!/bin/bash

# TrainingPulse Comprehensive Test Suite Runner
# This script runs all tests for the TrainingPulse application

set -e  # Exit on error

echo "========================================="
echo "TrainingPulse Comprehensive Test Suite"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests with colored output
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo "----------------------------------------"
    
    if eval $test_command; then
        echo -e "${GREEN}✓ $test_name passed${NC}\n"
        return 0
    else
        echo -e "${RED}✗ $test_name failed${NC}\n"
        return 1
    fi
}

# Track failed tests
FAILED_TESTS=()

# 1. Backend Unit Tests
echo "1. BACKEND UNIT TESTS"
echo "====================="
cd backend
if ! run_test "Backend Unit Tests" "npm test -- --run"; then
    FAILED_TESTS+=("Backend Unit Tests")
fi
cd ..

# 2. Frontend Unit Tests
echo "2. FRONTEND UNIT TESTS"
echo "======================"
cd frontend
if ! run_test "Frontend Unit Tests" "npm test -- --run"; then
    FAILED_TESTS+=("Frontend Unit Tests")
fi
cd ..

# 3. Integration Tests
echo "3. INTEGRATION TESTS"
echo "===================="
cd frontend
if ! run_test "Integration Tests" "npm test -- --run src/__tests__/integration"; then
    FAILED_TESTS+=("Integration Tests")
fi
cd ..

# 4. API Tests
echo "4. API ENDPOINT TESTS"
echo "====================="
cd backend
if ! run_test "API Tests" "npm run test:api"; then
    FAILED_TESTS+=("API Tests")
fi
cd ..

# 5. Database Tests
echo "5. DATABASE TESTS"
echo "================="
cd backend
if ! run_test "Database Tests" "npm run test:db"; then
    FAILED_TESTS+=("Database Tests")
fi
cd ..

# 6. E2E Tests (if Playwright is installed)
if [ -d "e2e-tests" ]; then
    echo "6. END-TO-END TESTS"
    echo "==================="
    cd e2e-tests
    if ! run_test "E2E Tests" "npx playwright test"; then
        FAILED_TESTS+=("E2E Tests")
    fi
    cd ..
fi

# 7. Linting
echo "7. CODE QUALITY CHECKS"
echo "======================"

# Frontend linting
cd frontend
if ! run_test "Frontend Linting" "npm run lint"; then
    FAILED_TESTS+=("Frontend Linting")
fi
cd ..

# Backend linting
cd backend
if ! run_test "Backend Linting" "npm run lint"; then
    FAILED_TESTS+=("Backend Linting")
fi
cd ..

# 8. Type Checking (if TypeScript is used)
echo "8. TYPE CHECKING"
echo "================"
cd frontend
if [ -f "tsconfig.json" ]; then
    if ! run_test "TypeScript Check" "npm run type-check"; then
        FAILED_TESTS+=("TypeScript Check")
    fi
fi
cd ..

# 9. Build Tests
echo "9. BUILD TESTS"
echo "=============="

# Frontend build
cd frontend
if ! run_test "Frontend Build" "npm run build"; then
    FAILED_TESTS+=("Frontend Build")
fi
cd ..

# Backend build (if applicable)
cd backend
if [ -f "package.json" ] && grep -q "\"build\"" package.json; then
    if ! run_test "Backend Build" "npm run build"; then
        FAILED_TESTS+=("Backend Build")
    fi
fi
cd ..

# 10. Security Audit
echo "10. SECURITY AUDIT"
echo "=================="

# Frontend security audit
cd frontend
if ! run_test "Frontend Security Audit" "npm audit --audit-level=high"; then
    FAILED_TESTS+=("Frontend Security Audit")
fi
cd ..

# Backend security audit
cd backend
if ! run_test "Backend Security Audit" "npm audit --audit-level=high"; then
    FAILED_TESTS+=("Backend Security Audit")
fi
cd ..

# Test Summary
echo ""
echo "========================================="
echo "TEST SUMMARY"
echo "========================================="

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed successfully!${NC}"
    exit 0
else
    echo -e "${RED}✗ The following tests failed:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  ${RED}- $test${NC}"
    done
    exit 1
fi