#!/usr/bin/env bash
set -euo pipefail

# ── DnD Character Builder — Deploy Script ────────────────────────────────────
FRONTEND_BUCKET="hunkz-dnd"
REGION="us-west-1"
ROOT="$(cd "$(dirname "$0")" && pwd)"

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

echo ""
echo "  API URL: $API_URL"

# ── Frontend ──────────────────────────────────────────────────────────────────
echo ""
echo "► Building frontend..."
cd "$ROOT"

VITE_API_URL="$API_URL" npm run build

echo ""
echo "► Syncing frontend to s3://$FRONTEND_BUCKET..."
aws s3 sync dist/ "s3://$FRONTEND_BUCKET" --delete --region "$REGION"

echo ""
echo "► Ensuring S3 website SPA fallback..."
aws s3 website "s3://$FRONTEND_BUCKET" \
  --index-document index.html \
  --error-document index.html \
  --region "$REGION"

echo ""
echo "=== Deploy complete! ==="
echo "  Frontend: http://$FRONTEND_BUCKET.s3-website-$REGION.amazonaws.com"
echo "  API:      $API_URL"
echo ""
