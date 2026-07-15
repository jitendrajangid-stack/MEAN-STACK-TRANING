#!/usr/bin/env bash
# Deploy Code.gs to the SAME Apps Script web-app /exec URL, using a REPO-LOCAL
# "ongraph" clasp profile — this repo's auth lives in ./.clasp-profile/ only and
# never touches your global ~/.clasprc.json.
#
# One-time setup (see README "Automated Apps Script deploy"):
#   1) Enable Apps Script API: https://script.google.com/home/usersettings
#   2) ./deploy-gs.sh login          # signs in with the ongraph account into ./.clasp-profile
#   3) .clasp.json holds this script's id (already set)
#   4) export GS_DEPLOYMENT_ID=AKfyc...   (the code in your /exec URL) — or edit below
#
# Then: ./deploy-gs.sh   (push Code.gs + redeploy, same URL)
set -euo pipefail
cd "$(dirname "$0")"

# Repo-scoped clasp home: clasp reads/writes ~/.clasprc.json, and os.homedir() follows $HOME.
export HOME="$PWD/.clasp-profile"
mkdir -p "$HOME"
CLASP="clasp"

if [ "${1:-}" = "login" ]; then
  echo "→ Signing in the ongraph profile (stored in ./.clasp-profile only)…"
  $CLASP login
  echo "✔ Profile ready. Now run ./deploy-gs.sh"
  exit 0
fi

if [ ! -f "$HOME/.clasprc.json" ]; then
  echo "No ongraph profile yet. Run once:  ./deploy-gs.sh login"
  exit 1
fi

DEPLOYMENT_ID="${GS_DEPLOYMENT_ID:-PASTE_DEPLOYMENT_ID_HERE}"
if [ "$DEPLOYMENT_ID" = "PASTE_DEPLOYMENT_ID_HERE" ]; then
  echo "Set GS_DEPLOYMENT_ID (the code in your /exec URL), or edit this file."
  echo "List them with:  HOME=\"$HOME\" $CLASP deployments"
  exit 1
fi

echo "→ Pushing Code.gs (ongraph profile)…"
$CLASP push -f
echo "→ Redeploying web app (same /exec URL)…"
$CLASP deploy -i "$DEPLOYMENT_ID" -d "auto-deploy"
echo "✔ Done. /exec URL unchanged."
