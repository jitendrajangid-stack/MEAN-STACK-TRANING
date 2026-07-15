#!/usr/bin/env bash
# Deploy Code.gs to the SAME Apps Script web-app /exec URL (no URL change).
#
# One-time setup (see README "Automated Apps Script deploy"):
#   1) Enable Apps Script API: https://script.google.com/home/usersettings
#   2) npx --yes @google/clasp@2 login            # your Google account, once
#   3) Create .clasp.json with this script's ID   # (git-excluded)
#   4) Put the web-app deployment id below or export GS_DEPLOYMENT_ID
#
# Then just run:  ./deploy-gs.sh
set -euo pipefail
cd "$(dirname "$0")"

DEPLOYMENT_ID="${GS_DEPLOYMENT_ID:-PASTE_DEPLOYMENT_ID_HERE}"
if [ "$DEPLOYMENT_ID" = "PASTE_DEPLOYMENT_ID_HERE" ]; then
  echo "Set GS_DEPLOYMENT_ID (or edit this file). Find it with: npx @google/clasp@2 deployments"
  exit 1
fi

echo "→ Pushing Code.gs…"
npx --yes @google/clasp@2 push -f
echo "→ Redeploying web app (same /exec URL)…"
npx --yes @google/clasp@2 deploy -i "$DEPLOYMENT_ID" -d "auto-deploy"
echo "✔ Done. The /exec URL is unchanged."
