#!/bin/bash
# Fresh VPS setup for Circular Waste Marketplace
# Tested on: Ubuntu 22.04 LTS
set -euo pipefail

DOMAIN="${DOMAIN:-}"
ACME_EMAIL="${ACME_EMAIL:-}"

if [[ -z "$DOMAIN" ]] || [[ -z "$ACME_EMAIL" ]]; then
    echo "ERROR: DOMAIN and ACME_EMAIL env vars required."
    echo "Usage: DOMAIN=example.com ACME_EMAIL=ops@example.com ./first-time-setup.sh"
    exit 1
fi

echo "▶ Installing Docker..."
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release ufw fail2ban
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "▶ Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "▶ Setting up certbot webroot..."
mkdir -p /opt/cwm/deploy/certbot/conf /opt/cwm/deploy/certbot/www

echo "▶ Copying compose + nginx from repo..."
# Assumes repo is at /opt/cwm (git clone)
cd /opt/cwm

echo "▶ Obtaining initial TLS certificate..."
docker run --rm \
    -v /opt/cwm/deploy/certbot/conf:/etc/letsencrypt \
    -v /opt/cwm/deploy/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --email "$ACME_EMAIL" \
    --agree-tos --non-interactive

echo "▶ Symlinking cert for nginx..."
# nginx.conf references DOMAIN — replace in a real deploy
sed -i "s/DOMAIN/$DOMAIN/g" deploy/nginx/conf.d/app.conf

echo "▶ Starting stack..."
docker compose -f docker-compose.prod.yml up -d

echo "▶ Waiting for health..."
sleep 30
docker compose -f docker-compose.prod.yml ps

echo "✅ First-time setup complete."
echo "   Next: run ./deploy/scripts/deploy.sh to update."
