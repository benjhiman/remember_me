#!/bin/bash
#
# Production Baseline Check Script
#
# Validates that production services are healthy and responding correctly.
# Exit code: 0 if all pass, !=0 if any fail.
#
# Usage:
#   ./scripts/prod-check.sh <api_url> <web_url>
#
# Example:
#   ./scripts/prod-check.sh https://api.iphonealcosto.com https://app.iphonealcosto.com
#
# Optional env vars:
#   SMOKE_TOKEN - Bearer token for authenticated smoke test (optional)
#   TIMEOUT - Request timeout in seconds (default: 10)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${1:-https://api.iphonealcosto.com}"
WEB_URL="${2:-https://app.iphonealcosto.com}"
TIMEOUT="${TIMEOUT:-10}"
SMOKE_TOKEN="${SMOKE_TOKEN:-}"

# Track results
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
log_info() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
  FAILED=$((FAILED + 1))
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
  WARNINGS=$((WARNINGS + 1))
}

check_http() {
  local url=$1
  local expected_status=${2:-200}
  local description=$3
  
  local response
  local status_code
  local body
  
  response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" "$url" || echo -e "\n000")
  body=$(echo "$response" | head -n -1)
  status_code=$(echo "$response" | tail -n 1)
  
  if [ "$status_code" = "$expected_status" ]; then
    log_info "$description (HTTP $status_code)"
    PASSED=$((PASSED + 1))
    return 0
  else
    log_error "$description (HTTP $status_code, expected $expected_status)"
    return 1
  fi
}

check_json() {
  local url=$1
  local field=$2
  local expected_value=$3
  local description=$4
  
  local response
  local value
  
  response=$(curl -s --max-time "$TIMEOUT" "$url" || echo "{}")
  
  # Check if response is valid JSON and extract field
  if ! echo "$response" | jq -e ".$field" > /dev/null 2>&1; then
    log_error "$description (invalid JSON or missing field: $field)"
    return 1
  fi
  
  value=$(echo "$response" | jq -r ".$field")
  
  if [ "$value" = "$expected_value" ]; then
    log_info "$description ($field=$value)"
    PASSED=$((PASSED + 1))
    return 0
  else
    log_error "$description ($field=$value, expected $expected_value)"
    return 1
  fi
}

# Check if jq is available
if ! command -v jq &> /dev/null; then
  log_warning "jq not found. JSON validation will be limited. Install with: brew install jq (macOS) or apt-get install jq (Linux)"
fi

echo "=========================================="
echo "Production Baseline Check"
echo "=========================================="
echo "API URL: $API_URL"
echo "Web URL: $WEB_URL"
echo "Timeout: ${TIMEOUT}s"
echo ""

# 1. API Health (Basic)
echo "1. Checking API Health (Basic)..."
if check_http "$API_URL/api/health" 200 "API /health endpoint"; then
  # Validate response structure if jq is available
  if command -v jq &> /dev/null; then
    response=$(curl -s --max-time "$TIMEOUT" "$API_URL/api/health")
    if echo "$response" | jq -e '.status == "ok"' > /dev/null 2>&1; then
      log_info "API /health response structure valid"
    else
      log_error "API /health response structure invalid (missing 'status: ok')"
    fi
  fi
fi

# 2. API Health (Extended)
echo ""
echo "2. Checking API Health (Extended)..."
if check_http "$API_URL/api/health/extended" 200 "API /health/extended endpoint"; then
  if command -v jq &> /dev/null; then
    # Check db status
    if check_json "$API_URL/api/health/extended" "db" "ok" "API database connection"; then
      true # Already logged
    fi
    
    # Check status
    if check_json "$API_URL/api/health/extended" "status" "ok" "API status"; then
      true # Already logged
    fi
    
    # Log additional info
    response=$(curl -s --max-time "$TIMEOUT" "$API_URL/api/health/extended")
    uptime=$(echo "$response" | jq -r '.uptime // "unknown"')
    version=$(echo "$response" | jq -r '.version // "unknown"')
    commit=$(echo "$response" | jq -r '.commit // "unknown"')
    env=$(echo "$response" | jq -r '.env // "unknown"')
    
    log_info "API uptime: ${uptime}s, version: $version, commit: $commit, env: $env"
  else
    log_warning "Skipping JSON validation (jq not available)"
  fi
fi

# 3. Web Health
echo ""
echo "3. Checking Web Health..."
if check_http "$WEB_URL" 200 "Web homepage"; then
  true # Already logged
fi

# Also check login page
if check_http "$WEB_URL/login" 200 "Web login page"; then
  true # Already logged
fi

# 4. Authenticated Request (Optional)
if [ -n "$SMOKE_TOKEN" ]; then
  echo ""
  echo "4. Checking Authenticated Request..."
  response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" \
    -H "Authorization: Bearer $SMOKE_TOKEN" \
    "$API_URL/api/users/me" || echo -e "\n000")
  status_code=$(echo "$response" | tail -n 1)
  
  if [ "$status_code" = "200" ]; then
    log_info "Authenticated request successful (HTTP 200)"
    PASSED=$((PASSED + 1))
    
    # Optional: Check ledger endpoint (requires ledger.read permission)
    echo ""
    echo "4a. Checking Ledger Endpoint (Optional)..."
    ledger_response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" \
      -H "Authorization: Bearer $SMOKE_TOKEN" \
      -H "X-Organization-Id: $(echo "$response" | head -n -1 | jq -r '.org.id // empty' 2>/dev/null || echo '')" \
      "$API_URL/api/ledger/accounts?limit=1" || echo -e "\n000")
    ledger_status=$(echo "$ledger_response" | tail -n 1)
    
    if [ "$ledger_status" = "200" ] || [ "$ledger_status" = "403" ]; then
      log_info "Ledger endpoint accessible (HTTP $ledger_status)"
      PASSED=$((PASSED + 1))
    else
      log_warning "Ledger endpoint check failed (HTTP $ledger_status) - may require permissions"
    fi
    
    # Optional: Check purchases list
    echo ""
    echo "4b. Checking Purchases Endpoint (Optional)..."
    purchases_response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" \
      -H "Authorization: Bearer $SMOKE_TOKEN" \
      -H "X-Organization-Id: $(echo "$response" | head -n -1 | jq -r '.org.id // empty' 2>/dev/null || echo '')" \
      "$API_URL/api/purchases?limit=1" || echo -e "\n000")
    purchases_status=$(echo "$purchases_response" | tail -n 1)
    
    if [ "$purchases_status" = "200" ] || [ "$purchases_status" = "403" ]; then
      log_info "Purchases endpoint accessible (HTTP $purchases_status)"
      PASSED=$((PASSED + 1))
    else
      log_warning "Purchases endpoint check failed (HTTP $purchases_status) - may require permissions"
    fi
  else
    log_error "Authenticated request failed (HTTP $status_code)"
  fi
else
  echo ""
  log_warning "Skipping authenticated request (SMOKE_TOKEN not set)"
fi

# Summary
echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
fi
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $FAILED${NC}"
  echo ""
  echo "❌ Production baseline check FAILED"
  exit 1
else
  echo ""
  echo "✅ Production baseline check PASSED"
  exit 0
fi
