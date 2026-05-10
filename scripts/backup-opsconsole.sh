#!/usr/bin/env bash
# Dump giornaliero del DB OpsConsole con retention 14gg.
# Esegui sul server (cron @ 03:30):
#   30 3 * * * /opt/opsconsole/scripts/backup-opsconsole.sh
set -euo pipefail
DEST="${OPS_BACKUP_DIR:-/var/backups/opsconsole}"
mkdir -p "$DEST"
TS=$(date +%Y%m%d_%H%M%S)
FILE="$DEST/opsconsole_${TS}.sql.gz"
docker exec opsconsole-postgres pg_dump -U opsconsole -d opsconsole | gzip -9 > "$FILE"
echo "Backup: $FILE ($(du -h "$FILE" | cut -f1))"

# Retention 14gg
find "$DEST" -name 'opsconsole_*.sql.gz' -mtime +14 -delete
