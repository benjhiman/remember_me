#!/bin/bash

# Bump Deploy Trigger Script
# Updates DEPLOY_TRIGGER.txt with current timestamp and commit hash
# This file is used to invalidate Docker cache on Railway

set -e

DEPLOY_TRIGGER_FILE="apps/api/DEPLOY_TRIGGER.txt"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_SHORT=$(git rev-parse --short HEAD)

cat > "$DEPLOY_TRIGGER_FILE" <<EOF
${TIMESTAMP} - Target commit: ${COMMIT_HASH} (${COMMIT_SHORT})
Last updated: ${TIMESTAMP}
Purpose: Force Railway rebuild to deploy latest API changes
EOF

echo "✅ Updated $DEPLOY_TRIGGER_FILE"
echo "   Commit: ${COMMIT_SHORT}"
echo "   Timestamp: ${TIMESTAMP}"
