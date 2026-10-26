# Production Deployment Guide — Circular Waste Marketplace

Deploy the complete Circular Waste Marketplace stack (FastAPI backend, React/Nginx frontend, PostgreSQL 15, Redis 7, MinIO S3 storage, Celery worker + beat, Nginx TLS reverse proxy, and Certbot automatic certificate renewal) to a fresh Ubuntu 22.04 LTS VPS in **under 30 minutes**.

---

## TL;DR — Under 30 Minutes

```bash
# 1. SSH into your fresh Ubuntu 22.04 VPS as root
ssh root@YOUR_VPS_IP

# 2. Clone the repository into /opt/cwm
git clone https://github.com/YOUR_ORG/waste-management-system.git /opt/cwm
cd /opt/cwm/circular-waste-marketplace

# 3. Copy the production env template and generate secrets
cp .env.prod.example .env
sed -i "s/CHANGE_ME_openssl_rand_hex_32/$(openssl rand -hex 32)/" .env
sed -i "s/CHANGE_ME_openssl_rand_hex_32_different_from_above/$(openssl rand -hex 32)/" .env
nano .env   # Fill in DOMAIN, POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, GITHUB_REPO_OWNER

# 4. Run one-time VPS & TLS bootstrap
chmod +x deploy/scripts/*.sh
DOMAIN=yourdomain.com ACME_EMAIL=ops@yourdomain.com ./deploy/scripts/first-time-setup.sh

# 5. Schedule nightly database backups (02:00 UTC)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/cwm/circular-waste-marketplace/deploy/scripts/backup.sh >> /var/log/cwm-backup.log 2>&1") | crontab -
```

---

## VPS Cost Estimate Table

| Provider | Plan | vCPU / RAM / Disk | Monthly Cost | Notes |
|---|---|---|---|---|
| **Hetzner Cloud (Recommended)** | CX22 / CPX11 | 2 vCPU / 4 GB RAM / 40 GB NVMe | **€4.35 / mo** (~$4.75) | Best price/performance; runs all 8 containers with ample headroom |
| **AWS Lightsail** | 2 GB Bundle | 2 vCPU / 2 GB RAM / 60 GB SSD | **$5.00 / mo** (first 3 mos free) | Simple fixed pricing inside AWS ecosystem + generous 3 TB transfer |
| **DigitalOcean** | Basic Droplet | 1 vCPU / 2 GB RAM / 50 GB SSD | **$6.00 / mo** ($12 for 2 vCPU) | Great developer UX, 1-click snapshots, Bangalore/Frankfurt regions |

---

## 1. Prerequisites

1. **VPS Requirements:**
   - **OS:** Ubuntu 22.04 LTS (x86_64 or ARM64)
   - **Minimum Specs:** 2 GB RAM, 1–2 vCPU, 20 GB SSD disk
   - **Recommended Specs:** 4 GB RAM, 2 vCPU, 40 GB NVMe SSD
   - **Network:** Public IPv4 address with ports `22` (SSH), `80` (HTTP), and `443` (HTTPS) open
2. **Domain Name:**
   - A registered domain name (e.g., `yourdomain.com`) with access to its DNS control panel (Cloudflare, Namecheap, Route53, etc.).
3. **GitHub Repository:**
   - GitHub Container Registry (GHCR) enabled (automatic for all GitHub repositories via GitHub Actions).

---

## 2. First-Time VPS Setup

The `deploy/scripts/first-time-setup.sh` script is idempotent and performs one-time host provisioning:
- Installs Docker Engine, Docker CLI, Buildx, and Docker Compose plugin from the official Docker apt repository
- Configures `ufw` firewall (`22/tcp`, `80/tcp`, `443/tcp`) and `fail2ban`
- Creates `/opt/cwm/deploy/certbot/{conf,www}` directories
- Requests a free Let's Encrypt TLS certificate for `$DOMAIN` and `www.$DOMAIN`
- Injects `$DOMAIN` into `deploy/nginx/conf.d/app.conf`
- Starts `docker-compose.prod.yml` in detached mode

Run it once after cloning the repo and configuring `.env` (see Sections 3 & 4 first):

```bash
cd /opt/cwm
chmod +x deploy/scripts/*.sh
DOMAIN=yourdomain.com ACME_EMAIL=ops@yourdomain.com ./deploy/scripts/first-time-setup.sh
```

---

## 3. DNS Configuration

An **A record** maps a domain or subdomain to an IPv4 address (e.g., `203.0.113.42`). Create the following records in your DNS provider before running `first-time-setup.sh` so Let's Encrypt can verify domain ownership over HTTP port 80:

| Type | Name / Host | Value / Target | TTL | Purpose |
|---|---|---|---|---|
| `A` | `@` | `YOUR_VPS_IPV4` | 300s (Auto) | Root domain (`yourdomain.com`) |
| `A` | `www` | `YOUR_VPS_IPV4` | 300s (Auto) | `www.yourdomain.com` |
| `A` | `api` | `YOUR_VPS_IPV4` | 300s (Auto) | API subdomain (`api.yourdomain.com`) |
| `A` | `storage` | `YOUR_VPS_IPV4` | 300s (Auto) | Optional MinIO public bucket domain |

Verify DNS propagation before running Certbot:

```bash
dig +short yourdomain.com A
dig +short www.yourdomain.com A
dig +short api.yourdomain.com A
```

---

## 4. Secrets Generation

Never reuse example secrets. Use `openssl rand` to generate cryptographically secure random strings:
- `openssl rand -hex 32` generates a 64-character hexadecimal string (256 bits of entropy), ideal for signing keys (`SECRET_KEY`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`).
- `openssl rand -base64 24` generates a URL/shell-friendly 32-character alphanumeric string, ideal for database and MinIO passwords.

### 4.1 Generate Server `.env` Secrets

```bash
cd /opt/cwm
cp .env.prod.example .env

echo "SECRET_KEY:           $(openssl rand -hex 32)"
echo "JWT_SECRET:           $(openssl rand -hex 32)"
echo "REFRESH_TOKEN_SECRET: $(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD:    $(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')"
echo "MINIO_ROOT_PASSWORD:  $(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')"
```

Update `.env` with those generated values, and ensure `DATABASE_URL` and `DATABASE_URL_SYNC` use the exact same `POSTGRES_PASSWORD`. Also add:

```dotenv
GITHUB_REPO_OWNER=your-github-username-or-org
IMAGE_TAG=latest
```

### 4.2 Configure GitHub Actions Secrets

In your GitHub repository, navigate to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret Name | Value |
|---|---|
| `VPS_HOST` | Public IPv4 or hostname of your VPS (e.g., `203.0.113.42`) |
| `VPS_USER` | SSH username on the VPS (e.g., `root` or `ubuntu`) |
| `VPS_SSH_KEY` | Private SSH key (`~/.ssh/id_ed25519`) authorized in `~/.ssh/authorized_keys` on the VPS |

---

## 5. First Deploy

Once DNS resolves to your VPS and `.env` is populated:

```bash
cd /opt/cwm
DOMAIN=yourdomain.com ACME_EMAIL=ops@yourdomain.com ./deploy/scripts/first-time-setup.sh
```

Verify that all containers are running and healthy:

```bash
docker compose -f docker-compose.prod.yml ps
curl -fsSL https://yourdomain.com/api/v1/health || curl -fsSL http://localhost:8000/health
```

---

## 6. Subsequent Deploys (Tag Push Flow)

Every push of a semantic version tag (`v*.*.*`) triggers `.github/workflows/deploy.yml`:
1. Builds production multi-stage Docker images (`backend` and `frontend`)
2. Pushes `ghcr.io/<owner>/cwm-backend:<tag>` and `ghcr.io/<owner>/cwm-frontend:<tag>`
3. SSHes into your VPS and executes `./deploy/scripts/deploy.sh <tag>`

To release a new version from your workstation:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Or trigger a manual deploy directly on the VPS:

```bash
cd /opt/cwm
./deploy/scripts/deploy.sh v1.0.1
```

---

## 7. Backups (Cron Setup)

`deploy/scripts/backup.sh` runs `pg_dump -Fc` inside the `postgres` container, compresses the dump with `gzip` into `/opt/cwm/backups/cwm-db-YYYYMMDD-HHMMSS.dump.gz`, and prunes backups older than 30 days.

Cron syntax uses 5 fields: `minute hour day-of-month month day-of-week`. For example, `0 2 * * *` runs every day at 02:00 AM server time.

Install the nightly cron job:

```bash
crontab -e
# Add this line at the bottom:
0 2 * * * /opt/cwm/deploy/scripts/backup.sh >> /var/log/cwm-backup.log 2>&1
```

Test the backup script manually right away:

```bash
/opt/cwm/deploy/scripts/backup.sh
ls -lh /opt/cwm/backups/
```

---

## 8. Monitoring

1. **External Uptime Probe:**
   - Configure a free probe on [UptimeRobot](https://uptimerobot.com) or [Better Stack](https://betterstack.com) polling `https://yourdomain.com/health` every 60 seconds.
   - Expected response: HTTP `200 OK` with `{"status": "healthy"}`.
2. **Error Tracking (Sentry):**
   - Create a project on [Sentry.io](https://sentry.io) and copy the DSN.
   - Set `SENTRY_DSN=https://...@o0.ingest.sentry.io/...` in `/opt/cwm/.env` and restart the backend:
     ```bash
     docker compose -f docker-compose.prod.yml up -d backend celery-worker
     ```

---

## 9. Rollback Procedure

`deploy/scripts/deploy.sh` automatically rolls back if the new `backend` container fails its `/health` check within 15 seconds.

To manually roll back to a known-good image tag (e.g., `v1.0.0`):

```bash
cd /opt/cwm
./deploy/scripts/deploy.sh v1.0.0
```

If a database migration must also be rolled back one step:

```bash
cd /opt/cwm
docker compose -f docker-compose.prod.yml exec backend alembic downgrade -1
```

---

## 10. Troubleshooting

### 10.1 Let's Encrypt / Certbot Fails During `first-time-setup.sh`
- **Symptom:** `Challenge failed for domain ...` or `Connection refused`.
- **Cause:** DNS `A` record hasn't propagated yet, or port 80 is blocked by a cloud firewall (e.g., AWS Security Group / Hetzner Firewall), or nginx isn't serving `/.well-known/acme-challenge/`.
- **Fix:**
  ```bash
  # Verify DNS points to this server's public IP
  curl -4 ifconfig.me
  dig +short yourdomain.com
  # Ensure nothing else is occupying port 80
  ss -tulpn | grep :80
  ```

### 10.2 Backend Cannot Connect to PostgreSQL (`InvalidPasswordError` or `ConnectionRefusedError`)
- **Symptom:** `backend` container restarts repeatedly; `docker compose -f docker-compose.prod.yml logs backend` shows database auth failure.
- **Cause:** `POSTGRES_PASSWORD` in `.env` does not match the password embedded in `DATABASE_URL` and `DATABASE_URL_SYNC`, or `pgdata` volume was initialized with an older password.
- **Fix:** Ensure `POSTGRES_PASSWORD`, `DATABASE_URL`, and `DATABASE_URL_SYNC` all match in `.env`, or update the role password inside Postgres:
  ```bash
  docker compose -f docker-compose.prod.yml exec postgres psql -U cwm -d cwm -c "ALTER USER cwm WITH PASSWORD 'YOUR_NEW_PASSWORD';"
  ```

### 10.3 Out Of Memory (OOM) on 1 GB VPS
- **Symptom:** Containers exit with code `137` (`SIGKILL`).
- **Cause:** Running 8 containers without swap on a 1 GB RAM instance.
- **Fix:** Use at least a 2 GB RAM VPS, and add a 2 GB swapfile on the host:
  ```bash
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ```

---

## 11. Alternative Deploy Paths (PaaS Comparison)

If you prefer managed PaaS over a single Docker Compose VPS:

| Platform | Estimated Cost | Pros | Cons / Trade-offs |
|---|---|---|---|
| **Single VPS + Docker Compose (Default)** | **$4.75–$6 / mo** | Lowest cost; full control; runs Postgres, Redis, MinIO, Celery worker/beat, and Nginx in one place | You manage OS security updates and disk backups |
| **Railway.app** | **$15–$25 / mo** | Native multi-service repo support; easy Redis & Postgres plugins; zero SSH config | Usage-based billing scales up quickly with Celery beat + worker + MinIO |
| **Render.com** | **$21–$35 / mo** | Declarative `render.yaml` Blueprints; managed Postgres + Redis | Free Postgres expires after 90 days; separate charges for web service + background worker |
| **Fly.io** | **$12–$20 / mo** | Global edge routing; fast Firecracker microVMs; built-in TLS | Requires separate `fly.toml` per process group (`app`, `worker`, `beat`) and external S3 |
