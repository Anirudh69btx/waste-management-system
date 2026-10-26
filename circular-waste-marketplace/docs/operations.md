# Operations Runbook — Circular Waste Marketplace

Production operational procedures for administering the Circular Waste Marketplace stack running under `docker-compose.prod.yml` at `/opt/cwm`.

---

## 1. Check Logs Per Service

All services log to `stdout`/`stderr` and are captured by the Docker JSON log driver.

```bash
cd /opt/cwm

# Stream logs for all containers
docker compose -f docker-compose.prod.yml logs -f --tail=100

# Check logs for a specific service
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend
docker compose -f docker-compose.prod.yml logs -f --tail=100 frontend
docker compose -f docker-compose.prod.yml logs -f --tail=100 nginx
docker compose -f docker-compose.prod.yml logs -f --tail=100 postgres
docker compose -f docker-compose.prod.yml logs -f --tail=100 redis
docker compose -f docker-compose.prod.yml logs -f --tail=100 minio
docker compose -f docker-compose.prod.yml logs -f --tail=100 celery-worker
docker compose -f docker-compose.prod.yml logs -f --tail=100 celery-beat
docker compose -f docker-compose.prod.yml logs -f --tail=100 certbot

# Filter backend logs for a specific X-Request-ID correlation token
docker compose -f docker-compose.prod.yml logs backend | grep "f4c9df5a-0fca-4aab-8ce0"
```

---

## 2. Restart a Single Service

Restart an individual service without disrupting the rest of the stack:

```bash
cd /opt/cwm

# Restart backend API
docker compose -f docker-compose.prod.yml restart backend

# Reload Nginx configuration gracefully (zero dropped connections)
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Recreate a single service after editing .env
docker compose -f docker-compose.prod.yml up -d --no-deps backend celery-worker celery-beat
```

---

## 3. Run a Manual Database Migration

Migrations run automatically during `./deploy/scripts/deploy.sh`, or can be executed manually:

```bash
cd /opt/cwm

# Check current migration head in database
docker compose -f docker-compose.prod.yml exec backend alembic current

# Apply all pending migrations up to head
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Roll back the most recent migration (use with caution)
docker compose -f docker-compose.prod.yml exec backend alembic downgrade -1
```

---

## 4. Restore From Backup

Nightly backups are stored as compressed custom-format dumps (`pg_dump -Fc | gzip`) in `/opt/cwm/backups/cwm-db-YYYYMMDD-HHMMSS.dump.gz`.

```bash
cd /opt/cwm

# 1. List available backup archives
ls -lh /opt/cwm/backups/

# 2. Stop backend and workers so no active connections write during restore
docker compose -f docker-compose.prod.yml stop backend celery-worker celery-beat

# 3. Decompress and restore into PostgreSQL (--clean drops existing objects before recreating)
gunzip -c /opt/cwm/backups/cwm-db-YYYYMMDD-HHMMSS.dump.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U cwm -d cwm --clean --if-exists

# 4. Restart application services and verify health
docker compose -f docker-compose.prod.yml start backend celery-worker celery-beat
curl -fsSL http://localhost:8000/health
```

---

## 5. Rotate JWT Secret

> **⚠️ WARNING:** Rotating `JWT_SECRET` or `REFRESH_TOKEN_SECRET` immediately invalidates all active user access tokens and refresh sessions across the platform. Users will be prompted to sign in again.

```bash
cd /opt/cwm

# 1. Generate new 64-character hex secrets
NEW_JWT_SECRET=$(openssl rand -hex 32)
NEW_REFRESH_SECRET=$(openssl rand -hex 32)

# 2. Update .env in-place
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" .env
sed -i "s/^REFRESH_TOKEN_SECRET=.*/REFRESH_TOKEN_SECRET=$NEW_REFRESH_SECRET/" .env

# 3. Optional: revoke all persisted refresh token rows in PostgreSQL
docker compose -f docker-compose.prod.yml exec -T postgres psql -U cwm -d cwm \
  -c "UPDATE refresh_tokens SET revoked_at = NOW() WHERE revoked_at IS NULL;"

# 4. Recreate backend and worker containers to load the new environment variables
docker compose -f docker-compose.prod.yml up -d --no-deps backend celery-worker
```

---

## 6. Scale Backend Replicas

Docker Compose's internal DNS round-robins `http://backend:8000` across all scaled `backend` containers behind `nginx`:

```bash
cd /opt/cwm

# Scale backend to 3 replicas
docker compose -f docker-compose.prod.yml up -d --no-deps --scale backend=3 backend

# Reload nginx so upstream DNS re-resolves all replica IPs
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Verify running replicas
docker compose -f docker-compose.prod.yml ps backend
```

---

## 7. Common Alerts & Remediation

### 7.1 Elevated Backend `5xx` Rate
- **Diagnosis:**
  ```bash
  docker compose -f docker-compose.prod.yml logs --tail=200 backend | grep '"status_code": 5'
  ```
- **Remediation:** Check if `postgres`, `redis`, or `minio` is unreachable (`docker compose -f docker-compose.prod.yml ps`). If caused by a bad code release, run `./deploy/scripts/deploy.sh <PREVIOUS_TAG>`.

### 7.2 Database Connection Pool Exhaustion (`QueuePool limit of size 20 overflow 30 reached`)
- **Diagnosis:** Check active connections inside PostgreSQL:
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U cwm -d cwm \
    -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"
  ```
- **Remediation:** Terminate stuck idle-in-transaction sessions or increase `max_connections` in Postgres alongside `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` in `.env`:
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U cwm -d cwm \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < NOW() - INTERVAL '5 minutes';"
  ```

### 7.3 Disk Full (`No space left on device`)
- **Diagnosis:**
  ```bash
  df -h
  docker system df
  ```
- **Remediation:** Prune unused Docker images, build cache, and old container logs:
  ```bash
  docker image prune -af --filter "until=168h"
  docker builder prune -af
  ```

### 7.4 TLS Certificate Expiry (< 14 Days Remaining)
- **Diagnosis:**
  ```bash
  docker compose -f docker-compose.prod.yml exec certbot certbot certificates
  ```
- **Remediation:** Force a manual renewal and reload Nginx:
  ```bash
  docker compose -f docker-compose.prod.yml exec certbot certbot renew --force-renewal
  docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
  ```
