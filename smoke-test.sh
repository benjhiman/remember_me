#!/bin/bash

# Smoke Test - Auth + Multi-Org Flow
# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:4000/api"
EMAIL="test-$(date +%s)@example.com"
PASSWORD="TestPassword123"
ORG_NAME="Test Organization"

echo -e "${BLUE}=== Smoke Test: Auth + Multi-Org Flow ===${NC}\n"

# 1. Register
echo -e "${BLUE}[1/7] Registering user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"name\": \"Test User\",
    \"organizationName\": \"${ORG_NAME}\"
  }")

echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"
ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.accessToken' 2>/dev/null)
REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.refreshToken' 2>/dev/null)
ORG_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.organizationId' 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
  echo -e "${RED}❌ Register failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Register successful${NC}\n"
echo "Organization ID: $ORG_ID"
echo "Access Token: ${ACCESS_TOKEN:0:50}...\n"

# 2. Login (should return tokens directly since only 1 org)
echo -e "${BLUE}[2/7] Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\"
  }")

echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken' 2>/dev/null)
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.refreshToken' 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}\n"

# 3. Create second organization
echo -e "${BLUE}[3/7] Creating second organization...${NC}"
CREATE_ORG_RESPONSE=$(curl -s -X POST "${BASE_URL}/organizations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "{
    \"name\": \"Second Organization\",
    \"slug\": \"second-org-$(date +%s)\"
  }")

echo "$CREATE_ORG_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_ORG_RESPONSE"
SECOND_ORG_ID=$(echo "$CREATE_ORG_RESPONSE" | jq -r '.id' 2>/dev/null)

if [ -z "$SECOND_ORG_ID" ] || [ "$SECOND_ORG_ID" == "null" ]; then
  echo -e "${RED}❌ Create organization failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Second organization created${NC}\n"

# 4. Login again (should require org selection)
echo -e "${BLUE}[4/7] Logging in again (should require org selection)...${NC}"
LOGIN_RESPONSE2=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\"
  }")

echo "$LOGIN_RESPONSE2" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE2"
REQUIRES_SELECTION=$(echo "$LOGIN_RESPONSE2" | jq -r '.requiresOrgSelection' 2>/dev/null)
TEMP_TOKEN=$(echo "$LOGIN_RESPONSE2" | jq -r '.tempToken' 2>/dev/null)

if [ "$REQUIRES_SELECTION" != "true" ] || [ -z "$TEMP_TOKEN" ] || [ "$TEMP_TOKEN" == "null" ]; then
  echo -e "${RED}❌ Expected org selection requirement, but got direct login${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Org selection required (as expected)${NC}\n"

# 5. Select organization
echo -e "${BLUE}[5/7] Selecting organization...${NC}"
SELECT_ORG_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/select-organization" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TEMP_TOKEN}" \
  -d "{
    \"organizationId\": \"${ORG_ID}\"
  }")

echo "$SELECT_ORG_RESPONSE" | jq '.' 2>/dev/null || echo "$SELECT_ORG_RESPONSE"
ACCESS_TOKEN=$(echo "$SELECT_ORG_RESPONSE" | jq -r '.accessToken' 2>/dev/null)
REFRESH_TOKEN=$(echo "$SELECT_ORG_RESPONSE" | jq -r '.refreshToken' 2>/dev/null)
FINAL_ORG_ID=$(echo "$SELECT_ORG_RESPONSE" | jq -r '.user.organizationId' 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
  echo -e "${RED}❌ Select organization failed${NC}"
  exit 1
fi

if [ "$FINAL_ORG_ID" != "$ORG_ID" ]; then
  echo -e "${RED}❌ Selected org ID doesn't match${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Organization selected successfully${NC}\n"

# 6. Test protected endpoint with @CurrentOrganization
echo -e "${BLUE}[6/7] Testing protected endpoint with @CurrentOrganization...${NC}"
TEST_ORG_RESPONSE=$(curl -s -X GET "${BASE_URL}/test-org" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "$TEST_ORG_RESPONSE" | jq '.' 2>/dev/null || echo "$TEST_ORG_RESPONSE"
RESPONSE_ORG_ID=$(echo "$TEST_ORG_RESPONSE" | jq -r '.organizationId' 2>/dev/null)

if [ -z "$RESPONSE_ORG_ID" ] || [ "$RESPONSE_ORG_ID" == "null" ] || [ "$RESPONSE_ORG_ID" != "$ORG_ID" ]; then
  echo -e "${RED}❌ Test org endpoint failed or org ID mismatch${NC}"
  echo "Expected: $ORG_ID, Got: $RESPONSE_ORG_ID"
  exit 1
fi

echo -e "${GREEN}✅ @CurrentOrganization decorator working correctly${NC}\n"

# 7. Test organizations endpoint
echo -e "${BLUE}[7/7] Testing organizations endpoint...${NC}"
ORGS_RESPONSE=$(curl -s -X GET "${BASE_URL}/organizations" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "$ORGS_RESPONSE" | jq '.' 2>/dev/null || echo "$ORGS_RESPONSE"
ORG_COUNT=$(echo "$ORGS_RESPONSE" | jq '. | length' 2>/dev/null)

if [ -z "$ORG_COUNT" ] || [ "$ORG_COUNT" == "null" ] || [ "$ORG_COUNT" -lt 2 ]; then
  echo -e "${RED}❌ Organizations endpoint failed or returned less than 2 orgs${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Organizations endpoint working (found ${ORG_COUNT} organizations)${NC}\n"

echo -e "${GREEN}=== All tests passed! ===${NC}"
echo "Email used: $EMAIL"
echo "Organization ID: $ORG_ID"
