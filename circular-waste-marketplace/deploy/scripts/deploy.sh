#!/bin/bash
# Zero-downtime deploy with rollback
set -euo pipefail

cd /opt/cwm
COMPOSE="docker compose -f docker-compose.prod.yml"

PREV_TAG=$(grep IMAGE_TAG .env | cut -d= -f2 || echo "latest")
NEW_TAG="${1:-$(git rev-parse --short HEAD)}"

echo "▶ Deploying IMAGE_TAG=$NEW_TAG (previous: $PREV_TAG)"

# Pull new images
IMAGE_TAG="$NEW_TAG" $COMPOSE pull

# Run migrations BEFORE swapping backend
echo "▶ Running migrations..."
IMAGE_TAG="$NEW_TAG" $COMPOSE run --rm backend alembic upgrade head

# Rolling update — backend first
IMAGE_TAG="$NEW_TAG" $COMPOSE up -d --no-deps --scale backend=2 backend
sleep 15

# Health check new backend
if ! curl -f http://localhost:8000/health >/dev/null 2>&1; then
    echo "❌ New backend unhealthy — rolling back"
    IMAGE_TAG="$PREV_TAG" $COMPOSE up -d --no-deps backend
    exit 1
fi

# Full swap
IMAGE_TAG="$NEW_TAG" $COMPOSE up -d

# Persist for next deploy
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$NEW_TAG/" .env

echo "✅ Deploy complete — $NEW_TAG is live"
$COMPOSE ps
