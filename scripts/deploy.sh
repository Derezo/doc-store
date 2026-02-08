#!/bin/bash
set -euo pipefail

# ── doc-store production deployment script ──────────────────────────────
#
# Usage: ./scripts/deploy.sh
#
# Prerequisites:
#   - Node.js 20+
#   - PM2 installed globally (npm install -g pm2)
#   - PostgreSQL running with DATABASE_URL configured in .env
#   - .env file in project root with production values

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Deploying doc-store from $PROJECT_DIR"
cd "$PROJECT_DIR"

# ── 1. Pull latest code ──────────────────────────────────────────────
echo "==> Pulling latest code..."
git pull --ff-only origin main

# ── 2. Install dependencies ──────────────────────────────────────────
echo "==> Installing dependencies..."
npm ci --production=false

# ── 3. Build all packages ────────────────────────────────────────────
echo "==> Building all packages..."
npm run build

# ── 4. Run database migrations ───────────────────────────────────────
echo "==> Running database migrations..."
npm run db:migrate -w packages/api

# ── 5. Restart PM2 processes ─────────────────────────────────────────
echo "==> Restarting PM2 processes..."
if pm2 list | grep -q "doc-store"; then
  pm2 reload ecosystem.config.cjs
else
  pm2 start ecosystem.config.cjs
fi

# ── 6. Save PM2 process list (survives reboot) ──────────────────────
pm2 save

echo "==> Deployment complete!"
echo "    API: http://localhost:4000/api/v1/health"
echo "    Web: http://localhost:3000"
