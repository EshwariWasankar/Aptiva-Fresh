#!/usr/bin/env bash
# PH12-T06 — Production Database Restore Script
set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_DB_URL="${2:-${DATABASE_URL:-postgresql://aptiva:aptiva@localhost:5432/aptiva}}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: ./tools/db-restore.sh <backup_file.dump> [target_database_url]"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[ERROR] Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[INFO] Restoring $BACKUP_FILE into target database..."
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$TARGET_DB_URL" "$BACKUP_FILE"

echo "[SUCCESS] Database restored successfully."

