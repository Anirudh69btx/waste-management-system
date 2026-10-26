#!/bin/bash
# Nightly backup: Postgres dump + MinIO mirror to S3 (or local)
set -euo pipefail

BACKUP_DIR=/opt/cwm/backups
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d-%H%M%S)
COMPOSE="docker compose -f /opt/cwm/docker-compose.prod.yml"

# Postgres
echo "▶ Backing up Postgres..."
$COMPOSE exec -T postgres pg_dump -U cwm -d cwm -Fc | gzip > "$BACKUP_DIR/cwm-db-$DATE.dump.gz"

# Retention: keep last 30 days
find "$BACKUP_DIR" -name "cwm-db-*.dump.gz" -mtime +30 -delete

# Optional: sync to remote S3
# aws s3 sync "$BACKUP_DIR" s3://cwm-backups/db/ --storage-class STANDARD_IA

echo "✅ Backup complete: $BACKUP_DIR/cwm-db-$DATE.dump.gz"
