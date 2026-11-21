#!/usr/bin/env bash
# Redeploy script - run ON THE VPS from the repository root after the first-time setup.
#   bash deploy/deploy.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="/var/www/srls"

echo "==> Pulling latest code"
cd "$REPO_DIR"
git pull --ff-only

echo "==> Backend: install production dependencies"
cd "$REPO_DIR/backend"
npm ci --omit=dev

echo "==> Frontend: build"
cd "$REPO_DIR/frontend"
npm ci
npm run build

echo "==> Publishing frontend to $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "$REPO_DIR/frontend/dist/" "$WEB_ROOT/"

echo "==> Restarting API"
pm2 startOrReload "$REPO_DIR/deploy/ecosystem.config.cjs" --update-env
pm2 save

echo "==> Health check"
sleep 2
curl -fsS http://127.0.0.1:5000/api/health && echo && echo "Deploy OK"
