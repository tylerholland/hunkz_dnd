#!/usr/bin/env bash
set -euo pipefail

# ── DnD Character Builder — Deploy Script ────────────────────────────────────
FRONTEND_BUCKET="hunkz-dnd"
REGION="us-west-1"
TABLE_NAME="dnd-characters"
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Story 36b — stale-client auto-refresh. Embedded in the frontend build as
# VITE_BUILD_VERSION and written to the app-meta sentinel after the S3 sync
# so open tabs can detect + self-reload onto the freshly synced bundle.
VERSION=$(git rev-parse --short HEAD)

echo ""
echo "=== DnD Character Builder Deploy ==="
echo ""

# ── Backend ───────────────────────────────────────────────────────────────────
echo "► Building SAM backend..."
cd "$ROOT/backend"
sam build

echo ""
echo "► Deploying SAM backend..."
DM_HASH=$(aws ssm get-parameter --name "/dnd/dm-password-hash" --region "$REGION" --query "Parameter.Value" --output text)
sam deploy --parameter-overrides "DmPasswordHash=$DM_HASH" || true
unset DM_HASH

API_URL=$(aws cloudformation describe-stacks \
  --stack-name dnd-character-builder \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

WS_URL=$(aws cloudformation describe-stacks \
  --stack-name dnd-character-builder \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='WsUrl'].OutputValue" \
  --output text)

BROADCAST_RELOAD_FN=$(aws cloudformation describe-stacks \
  --stack-name dnd-character-builder \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='BroadcastReloadFunctionName'].OutputValue" \
  --output text)

echo ""
echo "  API URL: $API_URL"
echo "  WS URL:  $WS_URL"
echo "  Version: $VERSION"

# ── Frontend ──────────────────────────────────────────────────────────────────
echo ""
echo "► Building frontend..."
cd "$ROOT"

VITE_API_URL="$API_URL" VITE_WS_URL="$WS_URL" VITE_BUILD_VERSION="$VERSION" npm run build

echo ""
echo "► Syncing frontend to s3://$FRONTEND_BUCKET..."
aws s3 sync dist/ "s3://$FRONTEND_BUCKET" --delete --region "$REGION"

echo ""
echo "► Ensuring S3 website SPA fallback..."
aws s3 website "s3://$FRONTEND_BUCKET" \
  --index-document index.html \
  --error-document index.html \
  --region "$REGION"

# Story 36b — stale-client auto-refresh. Must run AFTER the S3 sync above so
# a reloading client always finds the new bundle already in place: write the
# app-meta version stamp, then broadcast an immediate reload push to any
# already-connected clients (Story 36 WebSocket). Poll-only clients pick up
# the new buildVersion on their next tick regardless.
echo ""
echo "► Writing app-meta version stamp..."
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
aws dynamodb put-item \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  --item "{\"slug\": {\"S\": \"app-meta\"}, \"buildVersion\": {\"S\": \"$VERSION\"}, \"deployedAt\": {\"S\": \"$DEPLOYED_AT\"}}"

echo ""
echo "► Broadcasting reload to connected clients..."
aws lambda invoke \
  --function-name "$BROADCAST_RELOAD_FN" \
  --region "$REGION" \
  /dev/null > /dev/null

echo ""
echo "=== Deploy complete! ==="
echo "  Frontend: http://$FRONTEND_BUCKET.s3-website-$REGION.amazonaws.com"
echo "  API:      $API_URL"
echo "  Version:  $VERSION"
echo ""
