#!/usr/bin/env bash
# PH12-T06 — Production Database Backup Script
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_FILE="${BACKUP_DIR}/aptiva_backup_${TIMESTAMP}.dump"

DB_URL="${DATABASE_URL:-postgresql://aptiva:aptiva@localhost:5432/aptiva}"

echo "[INFO] Starting database backup at ${TIMESTAMP}..."
pg_dump --format=custom --compress=9 --no-owner --no-privileges --dbname="$DB_URL" --file="$BACKUP_FILE"

# Compute sha256 checksum
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"
fi

BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "[SUCCESS] Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"

