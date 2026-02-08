#!/bin/bash
set -euo pipefail

# ── doc-store backup script ──────────────────────────────────────────
#
# Usage: ./scripts/backup.sh [backup_dir]
#
# Backs up:
#   1. PostgreSQL database (pg_dump)
#   2. Vault data directory (tar.gz)
#
# Default backup directory: ./backups/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BACKUP_DIR="${1:-$PROJECT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_SUBDIR="$BACKUP_DIR/$TIMESTAMP"

# Load environment variables if .env exists
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

DATABASE_URL="${DATABASE_URL:-postgresql://docstore:docstore_dev@localhost:5432/docstore}"
DATA_DIR="${DATA_DIR:-$PROJECT_DIR/data/vaults}"

echo "==> Starting backup at $TIMESTAMP"
mkdir -p "$BACKUP_SUBDIR"

# ── 1. Database backup ────────────────────────────────────────────────
echo "==> Backing up PostgreSQL database..."
DB_BACKUP="$BACKUP_SUBDIR/database_$TIMESTAMP.sql.gz"
pg_dump "$DATABASE_URL" | gzip > "$DB_BACKUP"
echo "    Database backup: $DB_BACKUP"

# ── 2. Vault data backup ────────────────────────────────────────────
if [ -d "$DATA_DIR" ]; then
  echo "==> Backing up vault data from $DATA_DIR..."
  VAULT_BACKUP="$BACKUP_SUBDIR/vaults_$TIMESTAMP.tar.gz"
  tar -czf "$VAULT_BACKUP" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
  echo "    Vault backup: $VAULT_BACKUP"
else
  echo "==> No vault data directory found at $DATA_DIR, skipping."
fi

# ── 3. Summary ────────────────────────────────────────────────────────
echo ""
echo "==> Backup complete!"
echo "    Location: $BACKUP_SUBDIR"
du -sh "$BACKUP_SUBDIR"

# ── 4. Optional: Clean up old backups (keep last 30 days) ───────────
DAYS_TO_KEEP=30
if [ -d "$BACKUP_DIR" ]; then
  OLD_BACKUPS=$(find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$DAYS_TO_KEEP -not -path "$BACKUP_DIR" 2>/dev/null || true)
  if [ -n "$OLD_BACKUPS" ]; then
    echo "==> Cleaning up backups older than $DAYS_TO_KEEP days..."
    echo "$OLD_BACKUPS" | while read -r dir; do
      echo "    Removing $dir"
      rm -rf "$dir"
    done
  fi
fi
