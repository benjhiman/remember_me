#!/bin/bash

# Production Verification Script
# Tests critical endpoints after deployment

set -e

BASE_URL="https://app.iphonealcosto.com"
COOKIE_FILE="cookies.txt"

echo "=========================================="
echo "Production Verification Script"
echo "=========================================="
echo ""

# Test 1: Health endpoint (public)
echo "1. Testing /api/health (public)..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HEALTH_STATUS" = "200" ]; then
  echo "   ✓ Health endpoint OK (200)"
  echo "   Response: $HEALTH_BODY"
else
  echo "   ✗ Health endpoint FAILED ($HEALTH_STATUS)"
  echo "   Response: $HEALTH_BODY"
fi
echo ""

# Test 2: Login (requires credentials)
echo "2. Testing /api/auth/login..."
echo "   NOTE: Replace EMAIL and PASSWORD with actual credentials"
echo "   Command: curl -i -c ${COOKIE_FILE} -X POST ${BASE_URL}/api/auth/login \\"
echo "            -H 'Content-Type: application/json' \\"
echo "            -d '{\"email\":\"YOUR_EMAIL\",\"password\":\"YOUR_PASSWORD\"}'"
echo ""
echo "   After login, verify:"
echo "   - Response headers contain Set-Cookie: accessToken"
echo "   - Response headers contain Set-Cookie: refreshToken"
echo "   - ${COOKIE_FILE} contains both cookies"
echo ""

# Test 3: Debug cookies (dev only, will 404 in prod)
echo "3. Testing /api/_debug/cookies (dev only)..."
DEBUG_RESPONSE=$(curl -s -w "\n%{http_code}" -b "${COOKIE_FILE}" "${BASE_URL}/api/_debug/cookies" 2>/dev/null || echo -e "\n404")
DEBUG_STATUS=$(echo "$DEBUG_RESPONSE" | tail -n1)

if [ "$DEBUG_STATUS" = "404" ]; then
  echo "   ✓ Debug endpoint correctly disabled in production (404)"
else
  echo "   ⚠ Debug endpoint accessible (should be 404 in prod): $DEBUG_STATUS"
fi
echo ""

# Test 4: Stock seller-view (requires auth)
echo "4. Testing /api/stock/seller-view (requires auth)..."
if [ -f "${COOKIE_FILE}" ]; then
  STOCK_RESPONSE=$(curl -s -w "\n%{http_code}" -b "${COOKIE_FILE}" "${BASE_URL}/api/stock/seller-view")
  STOCK_STATUS=$(echo "$STOCK_RESPONSE" | tail -n1)
  STOCK_BODY=$(echo "$STOCK_RESPONSE" | head -n-1)

  if [ "$STOCK_STATUS" = "200" ]; then
    echo "   ✓ Stock seller-view OK (200)"
    echo "   Response preview: $(echo "$STOCK_BODY" | head -c 100)..."
  elif [ "$STOCK_STATUS" = "401" ]; then
    echo "   ⚠ Stock seller-view requires authentication (401)"
    echo "   Run login test first to set cookies"
  elif [ "$STOCK_STATUS" = "404" ]; then
    echo "   ✗ Stock seller-view NOT FOUND (404) - ROUTING ISSUE!"
    echo "   Response: $STOCK_BODY"
  else
    echo "   ✗ Stock seller-view FAILED ($STOCK_STATUS)"
    echo "   Response: $STOCK_BODY"
  fi
else
  echo "   ⚠ Skipping (no cookies file - run login test first)"
fi
echo ""

# Test 5: Verify no cross-origin requests
echo "5. Browser Network Check (manual):"
echo "   - Open https://app.iphonealcosto.com in DevTools"
echo "   - Go to Network tab"
echo "   - Filter by 'api.iphonealcosto.com'"
echo "   - Should be EMPTY (0 requests)"
echo "   - All requests should be to 'app.iphonealcosto.com/api/*'"
echo ""

# Test 6: Verify cookies in browser
echo "6. Browser Cookie Check (manual):"
echo "   - Open https://app.iphonealcosto.com in DevTools"
echo "   - Go to Application → Cookies → https://app.iphonealcosto.com"
echo "   - Should show: accessToken and refreshToken"
echo "   - Flags: httpOnly, secure, sameSite: Lax"
echo ""

echo "=========================================="
echo "Verification complete"
echo "=========================================="
