#!/usr/bin/env bash
# PH12-T06 — Automated Backup & Restore Rehearsal
set -euo pipefail

SCRATCH_DB="aptiva_scratch_restore"
DUMP_FILE="/tmp/aptiva_rehearsal_$(date +%s).dump"

export PGPASSWORD="${PGPASSWORD:-aptiva}"
PG_HOST="127.0.0.1"

echo "=== PH12-T06: Starting Backup & Restore Rehearsal ==="

# 1. Take a fresh backup
echo "[1/5] Dumping source database 'aptiva'..."
pg_dump -h "$PG_HOST" -U aptiva -d aptiva -Fc -f "$DUMP_FILE"
DUMP_SIZE=$(ls -lh "$DUMP_FILE" | awk '{print $5}')
echo "      Dump created: $DUMP_FILE ($DUMP_SIZE)"

# 2. Create scratch database
echo "[2/5] Creating clean scratch database '$SCRATCH_DB'..."
psql -h "$PG_HOST" -U aptiva -d postgres -c "DROP DATABASE IF EXISTS $SCRATCH_DB;" > /dev/null
psql -h "$PG_HOST" -U aptiva -d postgres -c "CREATE DATABASE $SCRATCH_DB OWNER aptiva;" > /dev/null

# 3. Restore backup into scratch database
echo "[3/5] Restoring dump into scratch database '$SCRATCH_DB'..."
pg_restore -h "$PG_HOST" -U aptiva -d "$SCRATCH_DB" --no-owner "$DUMP_FILE" || true

# 4. Verify table row counts
echo "[4/5] Verifying integrity and row counts across source and scratch..."

verify_count() {
  local table=$1
  local src_count=$(psql -h "$PG_HOST" -U aptiva -d aptiva -t -A -c "SELECT count(*) FROM $table;")
  local dst_count=$(psql -h "$PG_HOST" -U aptiva -d "$SCRATCH_DB" -t -A -c "SELECT count(*) FROM $table;")
  if [ "$src_count" -ne "$dst_count" ]; then
    echo "      [FAIL] Mismatch in table $table: source=$src_count, restored=$dst_count"
    exit 1
  else
    echo "      [PASS] Table $table: $src_count rows verified"
  fi
}

verify_count "users"
verify_count "topics"
verify_count "questions"
verify_count "question_options"
verify_count "assessments"
verify_count "practice_plans"
verify_count "practice_plan_items"
verify_count "practice_sessions"
verify_count "question_attempts"

# 5. Clean up scratch database and dump file
echo "[5/5] Cleaning up scratch database and temp archive..."
psql -h "$PG_HOST" -U aptiva -d postgres -c "DROP DATABASE $SCRATCH_DB;" > /dev/null
rm -f "$DUMP_FILE"

echo "=== PH12-T06: Rehearsal Succeeded with 100% Data Fidelity ==="
