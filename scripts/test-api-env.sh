#!/bin/bash
# Script de prueba para verificar que el API carga las variables de entorno correctamente
# Ejecutar desde la raíz del monorepo

set -e

API_URL="${1:-http://localhost:4000/api}"

echo "=========================================="
echo "Testing API Environment Configuration"
echo "=========================================="
echo "API URL: $API_URL"
echo ""

# 1. Verificar endpoint de diagnóstico (público)
echo "1. Testing /api/debug/config (public endpoint)..."
RESPONSE=$(curl -s "${API_URL}/debug/config")
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Verificar que hasJwtSecret es true
if echo "$RESPONSE" | grep -q '"hasJwtSecret":true'; then
  echo "✅ JWT_SECRET is loaded correctly"
else
  echo "❌ JWT_SECRET is NOT loaded - check apps/api/.env"
  exit 1
fi

# 2. Verificar health endpoint (público)
echo "2. Testing /api/health (public endpoint)..."
curl -s "${API_URL}/health" | jq '.' 2>/dev/null || curl -s "${API_URL}/health"
echo ""

# 3. Crear usuario de prueba y obtener token
echo "3. Testing auth flow (register + login)..."
REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-env@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }')

echo "Register response:"
echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""

# Login
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-env@example.com",
    "password": "TestPassword123!"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken' 2>/dev/null || echo "")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get access token from login"
  echo "Login response:"
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful, token obtained"
echo ""

# 4. Probar endpoint protegido con token
echo "4. Testing protected endpoint with Bearer token..."
PROTECTED_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${API_URL}/test-org")

echo "Protected endpoint response:"
echo "$PROTECTED_RESPONSE" | jq '.' 2>/dev/null || echo "$PROTECTED_RESPONSE"
echo ""

if echo "$PROTECTED_RESPONSE" | grep -q "organizationId"; then
  echo "✅ Protected endpoint works correctly with JWT token"
else
  echo "❌ Protected endpoint failed - check JWT_SECRET configuration"
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ All tests passed!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Environment variables loaded: ✅"
echo "  - JWT_SECRET configured: ✅"
echo "  - Public endpoints work: ✅"
echo "  - Auth flow works: ✅"
echo "  - Protected endpoints work: ✅"
