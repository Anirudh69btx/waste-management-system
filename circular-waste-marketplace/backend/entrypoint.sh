#!/bin/sh
set -e

echo "[entrypoint] Starting backend (APP_ENV=)"

if [ -n "$DATABASE_URL_SYNC" ]; then
  echo "[entrypoint] Waiting for Postgres..."
  ATTEMPTS=0
  MAX_ATTEMPTS=30
  until pg_isready -d "$DATABASE_URL_SYNC" >/dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS+1))
    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
      echo "[entrypoint] ERROR: Postgres unreachable after ${MAX_ATTEMPTS} attempts" >&2
      exit 1
    fi
    echo "[entrypoint] ...postgres not ready (attempt ${ATTEMPTS}/${MAX_ATTEMPTS})"
    sleep 2
  done
  echo "[entrypoint] Postgres is ready."
fi

if [ "${RUN_MIGRATIONS}" = "true" ] && [ -f "alembic.ini" ]; then
  echo "[entrypoint] Running migrations..."
  alembic upgrade head || {
    echo "[entrypoint] WARNING: alembic upgrade failed. Continuing anyway." >&2
  }
  echo "[entrypoint] Migrations complete."
fi

if [ "${STORAGE_BACKEND}" = "minio" ] && [ -n "$S3_BUCKET" ]; then
  python - <<'PY' || true
import os, sys
try:
    from minio import Minio
    client = Minio(
        os.environ["S3_ENDPOINT"].replace("http://", "").replace("https://", ""),
        access_key=os.environ["S3_ACCESS_KEY"],
        secret_key=os.environ["S3_SECRET_KEY"],
        secure=False,
    )
    bucket = os.environ["S3_BUCKET"]
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
        print(f"[entrypoint] Created bucket '{bucket}'")
    else:
        print(f"[entrypoint] Bucket '{bucket}' exists")
except Exception as e:
    print(f"[entrypoint] MinIO bucket init skipped: {e}", file=sys.stderr)
PY
fi

echo "[entrypoint] Handing off to: $*"
exec "$@"