#!/bin/bash

# Backend Analysis System Testing Script
# This script tests all the newly implemented analysis endpoints

# Configuration
BASE_URL="http://localhost:5000"
API_BASE="${BASE_URL}/api/obd2"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Test 1: Create a test session
test_create_session() {
    print_header "TEST 1: Creating Test Session"
    
    RESPONSE=$(curl -s -X POST "${API_BASE}/sessions" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "test_user_123",
            "vehicleId": "test_vehicle_456",
            "sessionName": "Test Analysis Session",
            "vehicleInfo": {
                "make": "Toyota",
                "model": "Camry",
                "year": 2020
            }
        }')
    
    SESSION_ID=$(echo "$RESPONSE" | grep -o '"sessionId":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$SESSION_ID" ]; then
        print_success "Session created: $SESSION_ID"
        echo "$SESSION_ID" > /tmp/test_session_id.txt
        return 0
    else
        print_error "Failed to create session"
        echo "$RESPONSE"
        return 1
    fi
}

# Test 2: Add sample data to session
test_add_data() {
    print_header "TEST 2: Adding Sample OBD2 Data"
    
    SESSION_ID=$(cat /tmp/test_session_id.txt)
    
    print_info "Adding 10 sample data points..."
    
    for i in {1..10}; do
        RESPONSE=$(curl -s -X POST "${API_BASE}/sessions/${SESSION_ID}/data" \
            -H "Content-Type: application/json" \
            -d "{
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\",
                \"rpm\": $((1500 + RANDOM % 2000)),
                \"speed\": $((30 + RANDOM % 50)),
                \"engineTemp\": $((180 + RANDOM % 40)),
                \"throttlePosition\": $((10 + RANDOM % 40)),
                \"engineLoad\": $((20 + RANDOM % 50)),
                \"fuelRate\": $(echo "scale=2; 0.5 + ($RANDOM % 100) / 100" | bc),
                \"maf\": $(echo "scale=2; 10 + ($RANDOM % 50) / 10" | bc)
            }")
        
        if echo "$RESPONSE" | grep -q '"success":true'; then
            echo -n "."
        else
            print_error "Failed to add data point $i"
            echo "$RESPONSE"
            return 1
        fi
        
        sleep 0.5
    done
    
    echo ""
    print_success "Added 10 data points to session"
    return 0
}

# Test 3: Try to analyze empty session (should fail)
test_analyze_empty_session() {
    print_header "TEST 3: Analyzing Empty Session (Should Fail)"
    
    # Create empty session
    EMPTY_SESSION=$(curl -s -X POST "${API_BASE}/sessions" \
        -H "Content-Type: application/json" \
        -d '{"userId": "test", "vehicleId": "test"}' | \
        grep -o '"sessionId":"[^"]*' | cut -d'"' -f4)
    
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${API_BASE}/sessions/${EMPTY_SESSION}/analyze" \
        -H "Content-Type: application/json" \
        -d '{
            "analysisType": "comprehensive",
            "includeVisualization": true
        }')
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
    
    if [ "$HTTP_STATUS" = "400" ] && echo "$BODY" | grep -q "No data available"; then
        print_success "Correctly rejected empty session (HTTP 400)"
        echo "$BODY" | grep -o '"message":"[^"]*' | cut -d'"' -f4
    else
        print_error "Should have rejected empty session with 400"
        echo "HTTP Status: $HTTP_STATUS"
        echo "$BODY"
        return 1
    fi
}

# Test 4: Analyze session with data
test_analyze_session() {
    print_header "TEST 4: Analyzing Session With Data"
    
    SESSION_ID=$(cat /tmp/test_session_id.txt)
    
    print_info "Waiting for data to flush..."
    sleep 6  # Wait for DataAggregator to flush
    
    print_info "Sending analysis request..."
    
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${API_BASE}/sessions/${SESSION_ID}/analyze" \
        -H "Content-Type: application/json" \
        -d '{
            "analysisType": "comprehensive",
            "includeVisualization": true
        }')
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
    
    if [ "$HTTP_STATUS" = "200" ] && echo "$BODY" | grep -q '"success":true'; then
        print_success "Analysis completed successfully"
        
        # Check if analysis was persisted
        if echo "$BODY" | grep -q '"analysis"'; then
            print_success "Analysis results included in response"
        fi
        
        # Save for next test
        echo "$BODY" > /tmp/test_analysis_result.json
        
        return 0
    else
        print_error "Analysis failed"
        echo "HTTP Status: $HTTP_STATUS"
        echo "$BODY"
        return 1
    fi
}

# Test 5: Retrieve cached analysis
test_get_cached_analysis() {
    print_header "TEST 5: Retrieving Cached Analysis"
    
    SESSION_ID=$(cat /tmp/test_session_id.txt)
    
    print_info "Requesting cached analysis..."
    
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${API_BASE}/sessions/${SESSION_ID}/analysis")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "Retrieved cached analysis (HTTP 200)"
        
        # Verify response structure
        if echo "$BODY" | grep -q '"analysisResults"' || echo "$BODY" | grep -q '"analysis"'; then
            print_success "Analysis results present in response"
        fi
        
        if echo "$BODY" | grep -q '"analysisTimestamp"'; then
            TIMESTAMP=$(echo "$BODY" | grep -o '"analysisTimestamp":"[^"]*' | cut -d'"' -f4)
            print_success "Analysis timestamp: $TIMESTAMP"
        fi
        
        if echo "$BODY" | grep -q '"analysisMetadata"'; then
            print_success "Analysis metadata present"
        fi
        
        return 0
    else
        print_error "Failed to retrieve cached analysis"
        echo "HTTP Status: $HTTP_STATUS"
        echo "$BODY"
        return 1
    fi
}

# Test 6: Try to get analysis for session without analysis
test_get_nonexistent_analysis() {
    print_header "TEST 6: Getting Analysis for Session Without Analysis (Should Fail)"
    
    # Create session without analysis
    NO_ANALYSIS_SESSION=$(curl -s -X POST "${API_BASE}/sessions" \
        -H "Content-Type: application/json" \
        -d '{"userId": "test", "vehicleId": "test"}' | \
        grep -o '"sessionId":"[^"]*' | cut -d'"' -f4)
    
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${API_BASE}/sessions/${NO_ANALYSIS_SESSION}/analysis")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
    
    if [ "$HTTP_STATUS" = "404" ] && echo "$BODY" | grep -q "No analysis results available"; then
        print_success "Correctly returned 404 for non-existent analysis"
        echo "$BODY" | grep -o '"message":"[^"]*' | cut -d'"' -f4
        return 0
    else
        print_error "Should have returned 404"
        echo "HTTP Status: $HTTP_STATUS"
        echo "$BODY"
        return 1
    fi
}

# Test 7: Test invalid session ID format
test_invalid_session_id() {
    print_header "TEST 7: Testing Invalid Session ID Format (Should Fail)"
    
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${API_BASE}/sessions/invalid-id-format/analysis")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
    
    if [ "$HTTP_STATUS" = "400" ] && echo "$BODY" | grep -q "Invalid session ID format"; then
        print_success "Correctly rejected invalid session ID format"
        return 0
    else
        print_error "Should have rejected invalid session ID"
        echo "HTTP Status: $HTTP_STATUS"
        echo "$BODY"
        return 1
    fi
}

# Test 8: Verify session data in database
test_verify_database() {
    print_header "TEST 8: Verifying Database Storage"
    
    SESSION_ID=$(cat /tmp/test_session_id.txt)
    
    print_info "Session ID: $SESSION_ID"
    print_info "To verify in MongoDB, run:"
    echo ""
    echo "  mongosh"
    echo "  use your_database_name"
    echo "  db.diagnosticsessions.findOne({ _id: ObjectId('$SESSION_ID') })"
    echo ""
    print_info "Expected fields:"
    echo "  - analysisResults"
    echo "  - analysisTimestamp"
    echo "  - analysisType"
    echo "  - analysisMetadata.dataPointsAnalyzed"
    echo "  - analysisMetadata.visualizationsGenerated"
    echo "  - analysisMetadata.analysisVersion"
    
    return 0
}

# Cleanup
cleanup() {
    print_header "Cleaning Up"
    
    if [ -f /tmp/test_session_id.txt ]; then
        SESSION_ID=$(cat /tmp/test_session_id.txt)
        print_info "Test session ID: $SESSION_ID"
        print_info "To clean up, you can delete the session using:"
        echo "  curl -X DELETE ${API_BASE}/sessions/${SESSION_ID}"
    fi
    
    rm -f /tmp/test_session_id.txt /tmp/test_analysis_result.json
}

# Main execution
main() {
    print_header "Backend Analysis System Tests"
    echo "Testing URL: $API_BASE"
    echo ""
    
    TESTS_PASSED=0
    TESTS_FAILED=0
    
    # Run all tests
    test_create_session && ((TESTS_PASSED++)) || ((TESTS_FAILED++))
    test_add_data && ((TESTS_PASSED++)) || ((TESTS_FAILED++))
    test_analyze_empty_session && ((TESTS_PASSED++)) || ((TESTS_FAILED++))
    test_analyze_session && ((TESTS_PASSED++)) || ((TESTS_FAILED++))
    test_get_cached_analysis && ((TESTS_PASSED++)) || ((TESTS_FAILED++))
    test_get_nonexistent_analysis && ((TESTS_PASSED++)) || ((TESTS_FAILED++))
    test_invalid_session_id && ((TESTS_PASSED++)) || ((TESTS_FAILED++))
    test_verify_database
    
    # Summary
    print_header "Test Summary"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "All tests passed! 🎉"
        cleanup
        exit 0
    else
        print_error "Some tests failed"
        cleanup
        exit 1
    fi
}

# Check if curl is installed
if ! command -v curl &> /dev/null; then
    print_error "curl is required but not installed"
    exit 1
fi

# Check if bc is installed (for floating point math)
if ! command -v bc &> /dev/null; then
    print_error "bc is required but not installed (needed for generating test data)"
    exit 1
fi

# Run tests
main

