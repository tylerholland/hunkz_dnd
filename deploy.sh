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
# sam deploy exits non-zero when the stack is already up to date; tolerate only
# that case — any real failure must abort the deploy, or the frontend would
# ship against a backend that never landed (this bit us on 2026-07-18).
#
# samconfig.toml sets confirm_changeset = true, so sam deploy prompts
# "Deploy this changeset? [y/N]:" interactively. Piping through `tee` keeps
# that prompt visible on the real terminal (a plain $(...) capture swallows
# it into the variable, which looks like a hang and silently answers N when
# you press Enter — this bit us on 2026-07-20) while still letting us
# capture the output for the "No changes to deploy" check below.
set +e
SAM_LOG="$(mktemp)"
sam deploy --parameter-overrides "DmPasswordHash=$DM_HASH" 2>&1 | tee "$SAM_LOG"
SAM_EXIT=${PIPESTATUS[0]}
set -e
SAM_OUTPUT="$(cat "$SAM_LOG")"
rm -f "$SAM_LOG"
unset DM_HASH
if [ "$SAM_EXIT" -ne 0 ] && ! echo "$SAM_OUTPUT" | grep -qi "No changes to deploy"; then
  echo "✗ sam deploy failed (exit $SAM_EXIT) — aborting before frontend sync." >&2
  exit "$SAM_EXIT"
fi

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
if [ -n "$BROADCAST_RELOAD_FN" ]; then
  aws lambda invoke \
    --function-name "$BROADCAST_RELOAD_FN" \
    --region "$REGION" \
    /dev/null > /dev/null
else
  echo "  (skipped — BroadcastReloadFunctionName stack output not found; clients will pick up the new version on their next poll)"
fi

echo ""
echo "=== Deploy complete! ==="
echo "  Frontend: http://$FRONTEND_BUCKET.s3-website-$REGION.amazonaws.com"
echo "  API:      $API_URL"
echo "  Version:  $VERSION"
echo ""
