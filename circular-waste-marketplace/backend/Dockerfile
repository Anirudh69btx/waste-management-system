# syntax=docker/dockerfile:1.6
# =============================================================================
# Circular Waste Marketplace — Backend Dockerfile
# =============================================================================
# Stages:
#   base        — Python 3.11-slim + ALL production requirements (shared layer)
#   development — base + dev requirements, hot-reload via uvicorn --reload
#   production  — base, non-root user, gunicorn multi-worker
# =============================================================================

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System dependencies: build tools, libpq, curl (healthcheck), pg_isready
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# ── Install ALL production requirements ─────────────────────────────────────
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip \
    && pip install -r /app/requirements.txt \
    && pip freeze > /tmp/installed-prod.txt \
    && echo "── Installed production packages ──" \
    && cat /tmp/installed-prod.txt


# =============================================================================
# development stage — used by docker-compose dev workflow
# =============================================================================
FROM base AS development

ENV APP_ENV=development

# ── Install ALL dev requirements on top of prod requirements ─────────────────
COPY requirements-dev.txt /app/requirements-dev.txt
RUN pip install -r /app/requirements-dev.txt \
    && pip freeze > /tmp/installed-dev.txt \
    && echo "── Installed dev packages ──" \
    && cat /tmp/installed-dev.txt

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Source is bind-mounted in docker-compose dev; COPY here for standalone builds
COPY . /app/

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]


# =============================================================================
# production stage — slim, non-root, gunicorn
# =============================================================================
FROM base AS production

ENV APP_ENV=production

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

COPY app /app/app
COPY ai_engine /app/ai_engine
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic

RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000", "--timeout", "120", "app.main:app"]
