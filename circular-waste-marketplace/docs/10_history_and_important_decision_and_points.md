# Engineering Journal: History, Key Decisions & Pitch Strategy

**Project:** Circular Waste & Resource Marketplace  
**Document Code:** ENG-JOURNAL-001  
**Sprint Model:** Solo Developer â†’ Hackathon Delivery  
**Lead Solutions Architect & Developer:** Solo Full-Stack Engineer  
**Repository State:** Sprint Active  

---

# 10 â€” History & Important Decisions & Points

This document is the single source of truth for **why** the project looks the way it does. Every meaningful architectural decision, every "we almost did X but chose Y" moment, and every critical operating note lives here. Future contributors and AI agents read this file before touching the codebase.

Chronological. Newest at the bottom within each segment. Do not delete old entries â€” if a decision is reversed, add a new entry explaining the reversal and link back.

---

## Segment 1.1 â€” Docker & Project Setup

**Date:** _(fill date of completion, format YYYY-MM-DD)_
**Owner:** _(your name or agent handle)_
**Status:** âœ… Completed

### Goal (as originally stated)
One command brings Postgres, FastAPI, and React dev server up, healthy and reachable. This is the foundation â€” nothing else can be trusted if this isn't rock solid.

### What Was Delivered
- Root folder `circular-waste-marketplace/` created with the canonical subfolders `backend/`, `frontend/`, `database/`, `docs/`.
- `docker-compose.yml` orchestrating three services: Postgres, backend (FastAPI + Uvicorn), frontend (React + Vite).
- Named persistent volume for Postgres so data survives `docker compose down`.
- Health check on Postgres using `pg_isready`, health check on backend hitting `/health` inside the container.
- `backend/Dockerfile` based on Python 3.11-slim, Uvicorn bound to `0.0.0.0:8000`, dependency install ordered before code copy to maximize layer caching.
- `frontend/Dockerfile` based on Node LTS (Alpine), running Vite dev server bound to `0.0.0.0:5173`.
- Vite dev server configured with polling-based file watching (`usePolling: true`) to make HMR work reliably under Windows + WSL2 + Docker bind mounts.
- `.env.example` committed with every required variable documented and obviously placeholder values.
- `.env` is git-ignored; production secrets must never enter version control.
- Minimal `backend/app/main.py` exposing a root ping and a `/health` endpoint returning structured JSON.
- Minimal `frontend/` React + Vite scaffold, renders a placeholder page and confirms the dev server is alive.
- `README.md` includes Prerequisites, Quick Start, Service URLs, Common Commands, Troubleshooting, Folder Structure, and a "Not Yet Implemented" section.

### Important Decisions (and why)

1. **Pinned image versions everywhere (no `latest`).**
   *Why:* Reproducibility. A silently-updated base image can break builds overnight. Pinned tags let us control when we upgrade.

2. **Health checks with `depends_on: condition: service_healthy` for backend on Postgres.**
   *Why:* Without this, FastAPI starts before Postgres is ready and either crash-loops or silently fails to connect. The health condition makes startup deterministic.

3. **Named volume for Postgres data (not bind mount to host).**
   *Why:* Bind-mounting Postgres data directories across Windows/WSL2 host boundaries is a well-known source of permission and corruption bugs. Named volumes sidestep this entirely and are the Docker-native pattern.

4. **Vite polling-based file watching enabled for dev.**
   *Why:* Docker Desktop on Windows does not reliably forward inotify filesystem events from bind-mounted host folders. Without polling, hot module reload silently stops working and developers think Vite is broken. Polling trades a bit of CPU for predictable behavior. This is a **dev-only** setting â€” must be reconsidered for production builds.

5. **`.env.example` committed, `.env` ignored.**
   *Why:* New contributors need to know exactly which variables exist and what they do. Committing `.env` invites secret leakage; committing `.env.example` gives guidance without risk.

6. **No business logic, no models, no routers beyond `/` and `/health` in this segment.**
   *Why:* Segment 1.1 is about proving the infrastructure works. Mixing in domain code now would blur the checkpoint and make failures harder to diagnose. Later segments layer business logic on a proven foundation.

7. **`unless-stopped` restart policy for all services in dev.**
   *Why:* WSL2 restarts, laptop lids closing, and Docker Desktop updates are common. `unless-stopped` means the developer isn't manually resurrecting containers every morning, but `docker compose down` still respects an intentional stop.

8. **Uvicorn bound to `0.0.0.0`, not `127.0.0.1`.**
   *Why:* Containers must listen on all interfaces to be reachable from the host or other containers. Binding to loopback inside a container is a classic mistake that makes the service appear "up" inside but invisible outside.

9. **Single user-defined bridge network shared by backend and Postgres (frontend optional).**
   *Why:* Docker's embedded DNS resolves service names on the shared network, so the backend can connect to `postgres:5432` cleanly. This also isolates the project from other Docker projects on the same host.

### Operating Notes (for future maintainers)

- **Resetting the database:** `docker compose down -v` wipes the named volume and gives you a fresh Postgres on next `up`. Use deliberately.
- **Rebuilding after `requirements.txt` change:** `docker compose build backend` (or `--build` on `up`). Bind-mounted source doesn't need a rebuild; dependency changes do.
- **Reading logs per service:** `docker compose logs -f backend` / `postgres` / `frontend`.
- **Shelling in:** `docker compose exec backend bash`, `docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB`, `docker compose exec frontend sh`.
- **Port conflicts:** If 8000, 5173, or 5432 collide with local services on a developer machine, edit the host-side port mapping in `docker-compose.yml` only â€” the container-internal port must stay constant so service-to-service DNS works.

### Checkpoint Result (what was verified)

| Check | Result |
|---|---|
| `docker compose up --build` reaches healthy state | PASS |
| Three services running (postgres, backend, frontend) | PASS |
| `http://localhost:5173` renders React app | PASS |
| `http://localhost:8000/health` returns 200 | PASS |
| Postgres health check passes (`pg_isready`) | PASS |
| Data persists across `docker compose down` + `up` | PASS |
| No secrets in logs | PASS |
| Idempotent second `up --build` | PASS |

### Open Questions / Deferred Items
- _Add any_ â€” e.g., whether to adopt the `docker-compose.override.yml` pattern in later segments, whether to add a `Makefile`, whether to include a Postgres admin UI (e.g., pgAdmin) as a dev-only sidecar.
- **Next segment pointer:** _Segment 1.2 â€” (whatever comes next, fill this in when it begins)._

### Reversal / Supersede Log
- None yet.

---

## Segment 1.1 â€” Docker Build Repair + Full Requirements Install

**Date:** 2026-10-18
**Status:** âœ… Resolved

### What Was Broken
Docker build failed with "target stage 'development' could not be found". `docker-compose.yml` declared `target: development` but neither Dockerfile had a `FROM ... AS development` stage. 0/7 containers running.

### What Was Fixed
- Rewrote `backend/Dockerfile` â†’ 3 stages: `base` (installs ALL production requirements + `pip freeze > /tmp/installed-prod.txt`), `development` (dev reqs on top + `pip freeze`), `production` (slim, non-root, gunicorn).
- Rewrote `frontend/Dockerfile` â†’ 4 stages: `base`, `development`, `builder`, `production` (nginx).
- Rewrote `docker-compose.yml` â†’ 7 services (postgres, redis, minio, backend, celery-worker, celery-beat, frontend) with health checks, named volumes, `depends_on: condition: service_healthy`.
- Merged existing `requirements.txt` + baseline â†’ **no package dropped**. Fixed `anyio==4.6.2` (yanked) â†’ `4.7.0`.
- Added `backend/entrypoint.sh` with `pg_isready` wait + conditional alembic migration + optional MinIO bucket creation. LF endings enforced; stripped UTF-8 BOM.
- Added `vite.config.ts` polling file watching (Windows + WSL2 HMR fix), `frontend/nginx.conf` for prod.
- Celery app path confirmed: `app.workers.tasks:celery_app` (compose commands updated to match).
- Fixed MinIO image distribution to `cgr.dev/chainguard/minio:latest` (after official Docker Hub / Quay image restriction).
- Fixed `ALLOWED_ORIGINS` in `.env` to JSON array format required by `pydantic-settings` `EnvSettingsSource`.
- Corrected database credentials in `.env` (`cwm_dev_password`).

### Requirements Install Verification
| Check | Result |
|---|---|
| Existing requirements.txt parsed | 36 packages |
| Merged requirements.txt | no drops, anyio bumped |
| Host `pip install --dry-run` (prod + dev) | PASS |
| `docker compose build backend` pip stage | PASS |
| `ALL IMPORTS OK` inside container | PASS |
| Every declared package present in `pip list` | PASS |
| Backend tests still 37/37 | PASS |

### Full Verification
| Check | Result |
|---|---|
| `docker compose build --no-cache` | PASS |
| `docker compose ps` | 7/7 healthy |
| `GET /health` | 200 |
| OpenAPI endpoints | 37 |
| DB tables | 18 |
| Signup | PASS |
| Frontend `:5173` | 200 |
| Backend tests | 37/37 |

### Lessons
- Always verify pip installs **inside the built image** â€” version resolution can differ from host.
- Use `pip freeze` in every Docker stage for auditability.
- Keep `docker-compose.yml` `target:` in lockstep with Dockerfile `AS` names.
- Windows + WSL2 bind-mount HMR requires polling (`CHOKIDAR_USEPOLLING=true` + Vite `usePolling`).
- Gate migrations via `RUN_MIGRATIONS=true` so only `backend` runs them.
- `anyio==4.6.2` is yanked on PyPI â€” always check for yanked pins during dry-run.
- Shell scripts executed in Linux containers must not contain UTF-8 BOM (`\xef\xbb\xbf`) or Windows CRLF endings.
- Pydantic v2 `pydantic-settings` parses list-typed environment variables via `json.loads` by default.

---

## Segment 1.2 â€” FastAPI + PostgreSQL Foundation

**Date:** 2026-10-18
**Status:** âœ… COMPLETE â€” settings, DB layer, Alembic, health, CORS, logging all production-grade

### Goal
Wire FastAPI to PostgreSQL with a clean, reusable DB layer; make `/health` prove DB connectivity; lock schema lifecycle to Alembic; enforce CORS from settings; introduce structured logging and request IDs. No business logic, no new models, no auth endpoints â€” pure infrastructure hardening on top of the Segment 1.1 working stack.

### Pre-flight Audit Findings
`app/core/settings.py` existed with initial fields but lacked explicit aliases/properties (`jwt_secret`, `cors_origins`, `upload_dir`, `max_upload_mb`), fail-fast production security checks, and wildcard CORS guards; `app/db/` had `session.py` inlining engine creation without a dedicated `engine.py` or `__init__.py` re-exports; Alembic `env.py` and initial migration existed and were healthy; `/health` was a static 200 without DB ping or latency; `/ready` checked DB/Redis but not migration table state; CORS had no wildcard protection; request-ID middleware was not bound to structlog contextvars; `.env.example` was missing 54 settings keys.

### What Was Delivered

**Settings (`app/core/settings.py`)**
- pydantic-settings v2 `BaseSettings`, cached singleton via `@lru_cache`.
- Fields added/verified: `DATABASE_URL`, `DATABASE_URL_SYNC`, `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `CORS_ORIGINS` (parsed to `list[str]` via validator), `UPLOAD_DIR`, `MAX_UPLOAD_MB`, `APP_ENV`, `APP_DEBUG`, `LOG_LEVEL`, `API_V1_PREFIX`.
- Added backward-compatible properties/aliases (`secret_key`, `algorithm`, `allowed_origins`, `local_upload_dir`, `max_upload_file_size_mb`).
- Configured `protected_namespaces = ()` to resolve Pydantic model namespace warnings.
- Fail-fast: `APP_ENV=production` + default `JWT_SECRET` / `HMAC_SECRET_KEY` placeholder raises at construction.
- Enforced rejection of wildcard `*` in CORS origins when credentials are enabled.

**DB layer (`app/db/`)**
- `engine.py` â€” `create_async_engine` from `DATABASE_URL`, `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`, `pool_recycle=1800`, echo gated by `APP_DEBUG`.
- `session.py` â€” `async_session_maker`, `get_db` async-generator dependency (open â†’ yield â†’ rollback on error â†’ close), plus `get_db_context` (`async_session_context`) context-manager variant for background tasks / Celery.
- `base.py` â€” SQLAlchemy 2.x `DeclarativeBase` with `TimestampMixin`. All existing models inherit from it.
- `__init__.py` re-exports `Base`, `TimestampMixin`, `get_db`, `get_async_session`, `async_session_maker`, `AsyncSessionLocal`, `async_engine`, `engine`, `get_db_context`, `async_session_context`.

**Alembic**
- `env.py` wired to `Base.metadata` and `DATABASE_URL_SYNC`. Model imports registered before `target_metadata` so autogenerate sees every table.
- `compare_type=True` and `compare_server_default=True` enabled.
- Current head: `0001_initial_schema`.
- `alembic check` reports no drift ("No new upgrade operations detected.").
- `Base.metadata.create_all` removed from runtime path â€” schema is Alembic-only.

**App (`main.py`)**
- `lifespan` context manager: startup logs app name/version/env, runs `SELECT 1` on DB (warning in dev, raises in prod on failure); shutdown disposes engine pool (`await async_engine.dispose()`).
- CORS from `settings.cors_origins`; `allow_credentials=True`; not combined with `"*"` origin.
- All 12 domain routers registered under `settings.api_v1_prefix` (37 endpoints intact).
- Global exception handlers: `RequestValidationError â†’ 422`, `HTTPException â†’ standard shape`, catch-all `Exception â†’ 500` with `request_id`, no stack leak in prod.
- Request-ID middleware: UUID per request, `X-Request-ID` response header, bound to structlog contextvars.
- Docs URLs disabled when `APP_ENV=production`.

**Health & Ready**
- `GET /health` â€” structured JSON: `status`, `version`, `environment`, `database` (`ok`/`unreachable` + latency ms), `timestamp`. 200 when DB ok, 503 when unreachable.
- `GET /ready` â€” 200 only when DB reachable AND migrations at head (verified via `alembic_version` present).
- `GET /` â€” app metadata JSON (`name`, `version`, `environment`, `docs`, `health`).

**Logging (`app/core/logging.py`)**
- `structlog` configured once: JSON in prod, colored human-readable in dev.
- Every log line carries `timestamp`, `level`, `event`, `request_id`, `logger`.
- PII redaction: `password`, `token`, `authorization`, `cookie`, `secret`, `access_token`, `refresh_token` â†’ `***`.
- `print()` eliminated from `app/` (0 occurrences).

**Environment variables**
- `.env.example` updated to include all 75 settings variables + aliases. Scripted comparison returns 0 diff (`set()`).

**Tests**
- `tests/conftest.py` â€” `db_session` (transactional rollback), `async_client` (httpx ASGITransport), `auth_headers` stub.
- New tests: `/health` ok + degraded, `/ready` ok + 503, `/` shape, CORS allowed/blocked, `X-Request-ID` present, settings fail-fast, session closes/rollbacks on error.
- Test count: **50 passed** (was 37 â†’ delta +13).

### Important Decisions (and why)

1. **Alembic-only schema lifecycle â€” `create_all` removed.**
   *Why:* `create_all` silently diverges from migrations. Once it runs, autogenerate can no longer be trusted. Cutting it now (Segment 1.2) prevents a painful migration audit later.

2. **Two DB URLs: `DATABASE_URL` (async) and `DATABASE_URL_SYNC` (sync).**
   *Why:* Runtime uses async `asyncpg`. Alembic uses `psycopg2` for synchronous migration calls. Mixing them via a single async URL forces Alembic into awkward wrapping. Two URLs are the standard pattern.

3. **`/health` vs `/ready` split.**
   *Why:* `/health` answers "is the process alive and database responding?" `/ready` answers "can this instance serve traffic?" (DB reachable, migrations applied at head, cache online). Load balancers poll `/ready`; orchestrators poll `/health`. Merging them causes a DB hiccup to kill healthy containers during rolling deploys.

4. **Health check pings DB with latency measurement, not just `SELECT 1`.**
   *Why:* A DB that responds in 2ms vs 600ms are different operational signals. Surfacing latency in the health body lets alerts threshold on it without adding a custom metric.

5. **Request-ID middleware bound to log context.**
   *Why:* Every error log, every access log, every stack trace becomes searchable by a single UUID shared between the client's error report and the server's logs. Retrofitting this later means re-touching every log call.

6. **Structured logging (structlog) from day one of the API.**
   *Why:* `print()` and stdlib logging scattered across modules make production incident response impossible. Structlog forces key-value logs which are queryable in Loki/Datadog/CloudWatch without regex.

7. **Global catch-all exception handler with a generic 500 body.**
   *Why:* FastAPI's default leaks stack traces in debug mode. A custom handler ensures no stack trace or internal path escapes in production, while still logging the full trace server-side (tied to `request_id`).

8. **CORS `allow_credentials=True` forbids `allow_origins=["*"]` â€” enforced in settings validator.**
   *Why:* Browsers reject `*` + credentials. Allowing it silently in dev means production breaks. Rejecting at startup makes the misconfiguration impossible to ship.

9. **Settings fail-fast in production when `JWT_SECRET` is the placeholder.**
   *Why:* The single most common security incident in FastAPI projects is a dev secret reaching prod. Killing the process at boot is the cheapest fix.

10. **New tests target infrastructure only â€” no business logic tests.**
    *Why:* Business logic hasn't been built yet. Tests here prove that every future segment inherits a working DB, session, health, CORS, and logging foundation. Testing what doesn't exist yet dilutes the signal.

### Operating Notes (for future maintainers)

- **Adding a model:** create it in `app/models/`, ensure it inherits from `app.db.base.Base`, then run `alembic revision --autogenerate -m "add_<model>"`. Review the generated diff **line by line** â€” autogenerate is a suggestion, not truth. Rename hex revision IDs to human-readable names before commit.
- **Applying migrations in dev:** the `backend` container's entrypoint runs `alembic upgrade head` on startup when `RUN_MIGRATIONS=true`. Celery containers set it to `false` so they never race.
- **Applying migrations in prod:** run `alembic upgrade head` as a **separate one-shot job** (Kubernetes `Job`, ECS task, `docker compose run --rm backend alembic upgrade head`), not via the app process. Never let a rolling deploy with multiple replicas all run migrations.
- **Resetting the DB:** `docker compose down -v && docker compose up --build`. This wipes the volume â€” use deliberately.
- **Checking drift before commit:** `docker compose exec backend alembic check` must print "No new upgrade operations detected." If it prints drift, a model was changed without a migration â€” fix before merging.
- **Health monitoring:** poll `/health` at 10s, `/ready` at 30s. Alert on `/ready` returning non-200 for >2 minutes.

### Verification (raw evidence)

| Check | Result |
|---|---|
| `docker compose ps` | 7/7 healthy |
| `GET /health` | 200, `database=ok`, latency 1.55 ms |
| `GET /ready` | 200, `migrations=applied`, `alembic_version=0001_initial_schema` |
| `GET /` | metadata JSON (`Circular Waste Marketplace`, v1.0.0) |
| `GET /docs` | loads, 37 endpoints |
| CORS allowed origin | `access-control-allow-origin: http://localhost:5173` present |
| CORS disallowed origin | header absent |
| `X-Request-ID` on every response | PASS (`x-request-id` header present / echoed) |
| `alembic current` | head `0001_initial_schema` |
| `alembic check` | no drift ("No new upgrade operations detected.") |
| `alembic_version` in DB | matches head (`0001_initial_schema`) |
| Backend tests | 50 passed (was 37, delta +13) |
| Frontend `:5173` | 200 (no regression) |
| `grep -rn "print(" backend/app` | 0 matches |
| `grep -rn "create_all" backend/app` | 0 matches |
| `.env.example` coverage | empty diff vs settings attrs (0 missing) |

### Open Questions / Deferred Items
- **Auth endpoints NOT implemented in this segment.** JWT and password-hashing packages are installed and `JWT_SECRET` / `ACCESS_TOKEN_EXPIRE_MINUTES` are wired in settings, but `/auth/login`, `/auth/register`, `/auth/refresh` belong to Segment 1.3. Do not add them here.
- **Rate limiting** deferred to Segment 1.3 (auth) and Segment 1.4 (public endpoints). Infra packages (`slowapi`) not added yet.
- **Prometheus `/metrics`** â€” package is installed but endpoint not exposed. Add in Segment 1.4 alongside load-testing.
- **Next segment pointer:** Segment 1.3 â€” Auth (JWT + refresh + RBAC + tests).

### Reversal / Supersede Log
- **Reversed from Segment 1.1:** `Base.metadata.create_all()` removed from startup. Reason: violates Alembic-only schema discipline. Any references in old code were replaced with the lifespan assertion that `alembic_version` exists.
- **Reversed from Segment 1.1:** `/health` was a static 200. Now returns structured JSON with DB ping. Frontend and any external monitor hitting `/health` must be updated to parse the new shape (currently frontend does not, so no break).

---

## Segment 1.3 â€” Authentication & Authorization

**Date:** 2026-10-18
**Status:** âœ… COMPLETE â€” JWT + refresh rotation + RBAC + rate limiting, 95 tests passing

### Goal
Full production authentication & authorization spine: user registration, dual login (email or phone, accepting JSON and OAuth2 form-encoded data), database-backed refresh tokens with rotation and replay attack defense, idempotent logout (204), profile retrieval (`/me`), profile updates (`PATCH /me`), and password changes with user-wide token invalidation. RBAC dependency injectors gated by the `UserRole` enum (`GENERATOR`, `RECYCLER`, `LOGISTICS`, `ADMIN`), where `ADMIN` implicitly passes all gates, and database role claim divergence triggers 401. Auth endpoint rate limiting using `slowapi` backed by Redis DB 3 with memory fallback.

### Pre-flight Audit Findings
Pre-flight audit showed `Settings` had `JWT_SECRET` but lacked `REFRESH_TOKEN_SECRET` and rate-limit configuration; `app/core/security.py` only had primitive hashing without handling bcrypt's 72-byte truncation boundary; no `get_current_user` dependency existed to verify live database role claims against token claims; no `RefreshToken` model existed; registration route only returned `UserReadResponse` without token credentials; and 50 tests were passing with 0 end-to-end auth-flow tests.

### What Was Delivered

**Settings (`app/core/settings.py`) & Environment**
- Added `REFRESH_TOKEN_SECRET`, `AUTH_RATE_LIMIT_LOGIN` ("5/minute"), `AUTH_RATE_LIMIT_REGISTER` ("3/hour"), `AUTH_RATE_LIMIT_REFRESH` ("10/minute"), and `AUTH_RATE_LIMIT_STORAGE_URI` ("redis://redis:6379/3").
- Synced `.env.example` and `.env` with all new auth settings; automated check confirms 0 missing attributes.

**Database & Alembic Migration (`backend/alembic/versions/0002_auth_refresh_tokens.py`)**
- `User` model updated with `last_login_at: datetime | None` and `failed_login_count: int` (default 0).
- `RefreshToken` model created with columns: `id`, `user_id`, `jti`, `token_hash`, `expires_at`, `revoked_at`, `replaced_by_jti`, `user_agent`, `ip_address`, and `created_at`/`updated_at`.
- Compound indexes added: `ix_refresh_tokens_user_id_revoked_at` and `ix_refresh_tokens_jti`.
- Migration `0002_auth_refresh_tokens` executed and verified. `alembic current` reports `0002_auth_refresh_tokens (head)`, and `alembic check` reports "No new upgrade operations detected."

**Security Layer (`app/core/security.py`)**
- Dual secrets: `JWT_SECRET` for short-lived access tokens (`type='access'`), `REFRESH_TOKEN_SECRET` for long-lived refresh tokens (`type='refresh'`).
- Pre-processing for passwords exceeding 72 bytes via SHA-256 pre-hash before bcrypt (work factor 12) prevents truncation bypass vulnerabilities.
- Cryptographic SHA-256 hashing for refresh tokens with constant-time verification `verify_token_hash` (`hmac.compare_digest`).
- Timing attack mitigation: `dummy_verify_password()` executed when a user lookup misses during login.
- Cross-secret mismatch detection: access tokens decoded with refresh secret (or vice versa) raise `TokenTypeMismatchError` (401).

**Rate Limiter (`app/core/limiter.py`)**
- Initialized `Limiter` with `key_func=get_user_or_ip_key` using Redis DB 3 storage with automated in-memory fallback.
- Mounted `app.state.limiter = limiter` with `_rate_limit_exceeded_handler` returning RFC-7807 429 `ProblemDetail` with `Retry-After` header.

**Repositories & Service Layer**
- `UserRepository`: Case-insensitive email lookup (`lower(email)`), phone number lookup, `increment_failed_login`, and `touch_last_login`.
- `RefreshTokenRepository`: `create`, `get_by_jti`, `revoke`, `revoke_all_for_user`, `list_active_for_user`, and `delete_expired`.
- `AuthService`:
  - `register`: Validates uniqueness, creates user and initial reward wallet, provisions token pair. Blocks self-registration for `ADMIN`.
  - `login`: Supports email OR phone, timing attack mitigation, increments failed logins, updates last login, issues token pair.
  - `refresh`: Decodes and verifies token against stored hash; detects token replay on already-revoked tokens and executes emergency `revoke_all_for_user` before raising `TokenReplayError`.
  - `logout`: Idempotent revocation (returns 204 even if already revoked or unmapped).
  - `me` & `update_me`: Safe profile read and update, enforcing unique phone numbers.
  - `change_password`: Validates old password, updates hash, immediately revokes all user refresh tokens.

**RBAC Dependencies (`app/dependencies/auth.py`)**
- `get_bearer_token`: Validates HTTP Bearer header.
- `get_current_user`: Decodes token, fetches live user from DB, and strictly verifies that token `role` matches current DB `role`. Claim divergence immediately returns 401.
- `get_current_active_user`: Ensures account is not deactivated (returns 403).
- `require_roles`: Dependency factory. Authorizes if user role matches allowed roles OR if user is `ADMIN` (implicit pass).

**Router (`app/routers/auth.py`)**
- Exposes 7 routes under `/api/v1/auth`:
  - `POST /register` (201 Created)
  - `POST /login` (200 OK, JSON or OAuth2 form-encoded)
  - `POST /refresh` (200 OK)
  - `POST /logout` (204 No Content)
  - `GET /me` (200 OK)
  - `PATCH /me` (200 OK)
  - `POST /change-password` (204 No Content)

**Test Suite & Coverage**
- Added comprehensive unit and integration suites:
  - `test_security_unit.py` (9 tests)
  - `test_auth_register.py` (6 tests)
  - `test_auth_login.py` (7 tests)
  - `test_auth_refresh.py` (6 tests)
  - `test_auth_logout.py` (3 tests)
  - `test_auth_me.py` (6 tests)
  - `test_auth_password_change.py` (2 tests)
  - `test_rate_limit.py` (2 tests)
  - `test_rbac.py` (4 tests)
  - Existing regression tests (50 tests)
- **Total Test Count: 95/95 PASSED (100% pass rate, delta +45 tests).**
- Auth Module Test Coverage:
  - `app/core/security.py`: **90%**
  - `app/services/auth_service.py`: **92%**
  - `app/dependencies/auth.py`: **81%**
  - `app/routers/auth.py`: **95%**
  - `app/schemas/auth.py`: **95%**
  - `app/repositories/user_repo.py`: **91%**

---

### Important Decisions (and why)

1. **Dual secret keys (`JWT_SECRET` and `REFRESH_TOKEN_SECRET`).**
   *Why:* Isolating access and refresh signing keys ensures that even if an access token secret is compromised, long-lived refresh tokens cannot be forged. Cross-verification ensures access tokens cannot be passed to `/refresh` and refresh tokens cannot be used to access API routes.

2. **Refresh token rotation with user-wide session invalidation on replay detection.**
   *Why:* If an already-rotated (revoked) refresh token is presented, either an attacker has intercepted an old token or a race condition occurred. Under zero-trust principles, presenting a spent token triggers immediate invalidation of all active sessions for that user (`revoke_all_for_user`), forcing a fresh credential login.

3. **Bcrypt 72-byte truncation pre-hashing via SHA-256.**
   *Why:* Bcrypt natively truncates passwords at 72 bytes. Passwords longer than 72 bytes that share the first 72 characters would evaluate as identical. Pre-hashing with SHA-256 before feeding into bcrypt guarantees that passwords of any length map uniquely into fixed 64-character hex strings without truncation.

4. **Timing attack defense on login via `dummy_verify_password()`.**
   *Why:* Checking passwords with bcrypt takes ~80-120ms. If non-existent users return immediately (1ms) while existing users take 100ms, an external adversary can accurately enumerate registered emails and phone numbers. Running a dummy bcrypt check on non-existent users neutralizes this side-channel.

5. **Blocking `ADMIN` self-registration at schema and service layers.**
   *Why:* The `ADMIN` role gives full access to every marketplace endpoint and role gate. Permitting public self-registration to `ADMIN` is a critical vulnerability. The `UserRegisterRequest` schema enum and `AuthService` explicitly reject `ADMIN` assignment.

6. **Database role claim divergence defense in `get_current_user`.**
   *Why:* If an administrator demotes or alters a compromised account's role in PostgreSQL, previously issued access tokens would otherwise retain escalated privileges until JWT expiration. Inspecting the live database role against the token claim invalidates compromised tokens immediately (401).

7. **Idempotent 204 response on logout.**
   *Why:* Logout should never fail or leak state. Whether the token is valid, already revoked, or nonexistent, the client's intent to terminate the session is satisfied without throwing errors.

8. **Redis DB 3 for rate limiting with memory fallback.**
   *Why:* Separating cache (DB 0), Celery broker (DB 1), Celery results (DB 2), and rate limits (DB 3) prevents namespace collisions and cache flushes from clearing rate limits. Fallback to memory prevents authentication outages if Redis experiences temporary downtime.

---

### Verification (raw evidence)

| Check | Result |
|---|---|
| `docker compose ps` | 7/7 containers UP and healthy |
| `alembic current` | `0002_auth_refresh_tokens (head)` |
| `alembic check` | Clean ("No new upgrade operations detected.") |
| Total test suite | **95 passed, 0 failed** (delta +45 from Segment 1.2) |
| `app/core/security.py` coverage | **90%** (target $\ge 75\%$) |
| `app/services/auth_service.py` coverage | **92%** (target $\ge 75\%$) |
| `app/dependencies/auth.py` coverage | **81%** (target $\ge 75\%$) |
| `app/routers/auth.py` coverage | **95%** |
| `app/schemas/auth.py` coverage | **95%** |
| `app/repositories/user_repo.py` coverage | **91%** |
| Replay defense test | PASS (`test_refresh_replay_defense_revokes_all_sessions`) |
| Rate limiting test | PASS (`test_rate_limiting_on_login`) |
| Admin role gate test | PASS (`test_rbac_admin_satisfies_all_role_gates`) |
| Role claim divergence test | PASS (`test_rbac_role_claim_divergence_rejected`) |
| Password truncation test | PASS (`test_password_hash_exceeding_72_bytes`) |
| Timing attack mitigation | PASS (`test_dummy_verify_password_runs`) |
| `.env.example` vs `Settings` diff | 0 missing variables |

---

### Operating Notes (for future maintainers)
- **Token Expiry**: Default access token TTL is 30 minutes; default refresh token TTL is 7 days.
- **Admin Accounts**: Must be provisioned directly via DB migration or CLI seed script; public registration will reject role `ADMIN` with 422/403.
- **Rate Limit Storage**: Ensure Redis instance `redis:6379` is reachable. If Redis is down, slowapi logs a warning and falls back to process memory.
- **Next segment pointer:** Segment 1.4 â€” React, Tailwind & Auth UI.

---

## Segment 1.4 â€” React, Tailwind & Auth UI

**Date:** 2026-10-19  
**Status:** âœ… COMPLETE â€” auth UI end-to-end, 25 frontend tests passing

### Goal
Wire the frontend to backend auth end-to-end: landing, register, login, logout, protected routes, dashboard placeholder, token refresh in interceptor, single-flight refresh race prevention. Lock the dark/green design system for all future segments. Document localStorage XSS trade-off and production cookie/BFF migration path.

### Pre-flight Audit Findings
Frontend had default initial scaffold from 1.1; axios, react-router-dom, zustand present but react-hot-toast, framer-motion, react-hook-form, zod, vitest, and testing-library all missing; tailwind.config lacked semantic token aliases and contrast guarantees; authStore had mock demo logins without JWT storage or me() verification; route guards, single-flight refresh, and RFC-7807 error normalization missing.

### What Was Delivered

**Dependencies added** (pinned):
- `axios`, `react-router-dom` (v6.27.0), `react-hot-toast` (v2.6.1), `framer-motion` (v11.18.2), `lucide-react` (v0.453.0), `react-hook-form` (v7.90.0), `zod` (v3.25.76), `@hookform/resolvers` (v3.10.0)
- Test stack: `vitest` (v2.1.9), `@testing-library/react` (v16.3.3), `@testing-library/user-event` (v14.6.8), `jsdom` (v25.0.1), `@testing-library/jest-dom` (v6.9.1)
- No existing packages removed or downgraded.

**Frontend environment (`frontend/.env.example`):**
- `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`, `VITE_APP_NAME`, `VITE_ENABLE_DEVTOOLS`
- Loud warning comment: Vite embeds VITE_* into bundle â†’ never put secrets.
- Root `docker-compose.yml` frontend service updated to pass all 4 vars from root `.env`.

**Design system (locked):**
- `tailwind.config.js` extended with semantic palette: `bg-base` (`#030712`), `bg-surface` (`#0f172a`), `bg-elevated` (`#1e293b`), `border-subtle`, `border-strong`, `text-primary` (`#f8fafc`), `text-secondary` (`#94a3b8`), `text-muted` (`#64748b`), `brand-50..950` (emerald family), `danger-*`, `success-*`, `warning-*`, `glow-brand`, `brand-gradient`.
- `index.css` with CSS vars, dark baseline, focus ring, WebKit + Firefox scrollbar styling, `prefers-reduced-motion` guard.
- Contrast verified: primary text on each background â‰¥4.5:1 (measured ratios: 19.27:1 on `bg-base`, 17.33:1 on `bg-surface`, 14.08:1 on `bg-elevated`).
- One sans (Inter/system stack) + one mono (JetBrains Mono/Fira Code) for ID display.

**API layer:**
- `api/client.ts` â€” axios instance from `VITE_API_BASE_URL`, 15s timeout, `withCredentials: false`.
- Request interceptor: attaches `Authorization: Bearer <access>` when token present; attaches `X-Request-ID` UUID per request.
- Response interceptor: on 401 (excluding login/register/refresh endpoints) â†’ **single-flight** token refresh â†’ retry original request once â†’ on second failure, clear auth + redirect to `/login` + toast "Session expired".
- RFC-7807 error body normalized into `{code, title, detail, requestId, fieldErrors, retryAfter}` for uniform UI handling.
- `api/auth.ts` â€” 7 typed functions: `register`, `login`, `refresh`, `logout`, `me`, `updateMe`, `changePassword`.
- `api/types.ts` â€” `User`, `TokenPair`, `Role`, request shapes. Role enum matches backend exactly: `GENERATOR | RECYCLER | LOGISTICS | ADMIN`.

**Auth store (`features/auth/store.ts`):**
- Zustand store: `{user, accessToken, refreshToken, status}` + actions `setAuth`, `clearAuth`, `setUser`, `setStatus`, `hydrate`.
- Tokens persist in `localStorage` under `cwm.accessToken`, `cwm.refreshToken`, `cwm.user`.
- Hydration on app boot: read localStorage â†’ call `me()` â†’ on 401 try refresh â†’ on failure clear auth. Full-page loader during hydration (max 3s, then force unauthenticated).

**Route guards (`features/auth/guards.tsx`):**
- `<RequireAuth>` â€” redirects unauth to `/login` with `state.from` for redirect-after-login.
- `<PublicOnly>` â€” redirects authed away from `/login` and `/register`.
- `<RequireRole>` â€” client-side UX gate; renders 403 page for wrong role. Comment on every guard: **"Client-side guards are UX only. Backend RBAC is the real control."**

**Pages:**
- `<LandingPage>` (`/`) â€” hero, brand gradient, tagline, two CTAs (Get started / Sign in), 3 feature cards with lucide icons, footer.
- `<LoginPage>` (`/login`) â€” email/phone toggle, password with show/hide, remember-me, RHF+zod validation, 429 countdown, navigate to `state.from ?? /dashboard`.
- `<RegisterPage>` (`/register`) â€” full_name, email, phone (optional), password, confirm, role selector limited to **GENERATOR | RECYCLER | LOGISTICS** (ADMIN not in UI), organization_name (label varies by role), terms checkbox, password strength hint.
- `<DashboardPlaceholderPage>` (`/dashboard`) â€” welcome + role badge + logout + "domain features coming soon".
- `<NotFoundPage>` (404), `<ForbiddenPage>` (403), `<AdminOnlyPage>` (/admin-only role test).

**Shared components (`components/`):**
- `<TextField>`, `<PasswordField>`, `<CheckboxField>`, `<SelectField>`, `<Button>` â€” with label, aria-invalid, aria-describedby, error slot.

**Toasts & loading:**
- `<Toaster>` mounted at app root, top-right, dark themed.
- Success 3s, error 5s (with `requestId` for 500s).
- Inline button spinners for form submits (no loading toasts).

**Form parity with backend:**
- zod schemas mirror backend rules: password â‰¥8 chars + â‰¥1 letter + â‰¥1 digit, email `EmailStr`, phone E.164 if provided, full_name 2â€“120, role enum with 3 public roles, confirm matches.
- Parity verified; all validations resolved in exact parity with backend rules.

**Security baseline:**
- CSP meta tag in `index.html` (dev-permissive, prod plan documented).
- `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- Grep verified: 0 `dangerouslySetInnerHTML`, 0 `eval(`, 0 `new Function`.
- `console.log` on auth paths: 0 (only `import.meta.env.DEV`-gated logs remain).
- `autocomplete="email"`, `current-password`, `new-password` set correctly.
- localStorage XSS risk documented in README + this history entry.

**Frontend tests (`features/**/__tests__` and `api/__tests__`):**
- Store: setAuth/clearAuth/hydrate/roles â€” 5 tests.
- Guards: RequireAuth redirect/render, PublicOnly redirect, RequireRole wrong role, ADMIN bypass â€” 7 tests.
- Login: renders, validation errors, successful login mocks API, failed shows toast, 429 countdown â€” 5 tests.
- Register: renders all fields, ADMIN absent from role list, password mismatch error, weak password error, successful register stores tokens + redirects â€” 4 tests.
- Axios client: bearer attached, single-flight refresh (3 concurrent 401s â†’ 1 refresh call), refresh failure clears auth â€” 4 tests.
- **Total: 25 frontend tests passing** (was 0 â†’ delta +25).

**Backend untouched:** `git diff --stat backend/` empty. Backend still 95/95 passing.

### Important Decisions (and why)

1. **localStorage for tokens in Segment 1.4 (demo acceptable).**
   *Why:* Spec explicitly permits it for demo. Cookie/BFF migration is a distinct architectural change that needs CSRF strategy, cookie signing, and backend changes â€” bundling it into 1.4 would balloon scope. Documented trade-off and mitigation (CSP, no dangerouslySetInnerHTML, refresh rotation, replay defense) in README.

2. **Single-flight refresh interceptor.**
   *Why:* The naive interceptor that fires a refresh on every 401 causes a thundering herd on app boot (hydration triggers 3â€“5 parallel requests). Without single-flight, 5 refreshes fire, 4 lose the rotation race, backend replay defense revokes ALL sessions, user logged out for no reason. This is a subtle and costly bug â€” fixing it now saves Segment 1.5 from a mystery logout bug.

3. **`withCredentials: false` (bearer-only auth).**
   *Why:* No cookies yet. When we migrate to HttpOnly cookie auth, this flips to `true` AND a CSRF token gets added. Documented in history so future migration doesn't forget.

4. **Route guards are UX only.**
   *Why:* Client can be tampered with via devtools. If a user forges `user.role = "ADMIN"` in localStorage and reloads, guards will let them into admin UI â€” but every admin API call will 401 because backend checks role claim against DB. Guards improve UX; backend enforces security. Every guard has a comment stating this so it's never forgotten.

5. **Role selector excludes ADMIN in the UI.**
   *Why:* Backend already blocks ADMIN self-registration (Segment 1.3, schema + service layers). But surfacing ADMIN as a disabled option in the UI just invites social engineering ("why can't I pick admin?"). Hide entirely. Admins are created by other admins or via seed scripts.

6. **Password strength hint is UX-only.**
   *Why:* Backend's validator is authoritative. Hint helps users avoid the 422 roundtrip by showing strength live. It must NOT block submit â€” the submit button is disabled only by the zod schema, which matches backend rules.

7. **`state.from` redirect-after-login.**
   *Why:* Nothing worse than a user being bounced from `/dashboard` to `/login`, then landing on a generic home page after login. Storing the origin in `state.from` and navigating back is a 5-line pattern that dramatically improves perceived quality.

8. **Toast on 429 shows exact `Retry-After` countdown, button disabled.**
   *Why:* Backend returns `Retry-After` header. Ignoring it produces an unhelpful "Too many requests" toast with no path forward. A live countdown tells the user exactly when to retry â€” turns a frustrating error into a clear wait.

9. **`react-hot-toast` chosen over `sonner`.**
   *Why:* Spec permits either. Picking one prevents accidentally pulling in both and bloating the bundle. `react-hot-toast` provides clean standalone positioning and custom styling options with low footprint.

10. **`X-Request-ID` generated client-side per request, echoed from backend responses.**
    *Why:* When a user reports "I got a weird error", the requestId in the toast + the requestId in backend logs match. This single field turns a 30-minute debug into a 30-second debug. Cheap to add now, expensive to retrofit.

11. **Landing page exists even for a hackathon demo.**
    *Why:* First impression. Users judge a product's quality in 3 seconds on the landing page. It also gives unauthenticated users a clear entry (register/login) instead of dropping them on a `/login` wall with no context.

12. **`prefers-reduced-motion` respected on all animations.**
    *Why:* Accessibility requirement. framer-motion animations that ignore this break the experience for users with vestibular disorders. Cheap to respect, expensive to retrofit into a large motion system.

### Operating Notes (for future maintainers)

- **Adding a protected page:** wrap the route element in `<RequireAuth>` (and `<RequireRole>` if role-gated). Never rely on hiding the link â€” always guard the route.
- **Adding a public-only page** (e.g., forgot-password): wrap in `<PublicOnly>`.
- **New API endpoint wiring:** add a typed function in `api/<domain>.ts`, add types in `api/types.ts` if new, use the axios client (never raw fetch).
- **New form:** use `react-hook-form` + zod resolver. Extract reusable field components from `components/` before inlining a new input.
- **New color:** add to `tailwind.config.js` semantic palette, verify contrast â‰¥4.5:1, update `index.css` var, never hardcode hex in components.
- **Logout during network failure:** `logout()` is fire-and-forget. Local state clears regardless. Backend session expires on refresh token TTL (7 days). User's access token still works until 30min expiry â€” acceptable for demo, revisit at cookie migration.
- **Testing auth flows locally:** use the demo credentials printed in README, or register a fresh account. Rate limit is 3/hour on register, 5/min on login â€” hitting it during dev is annoying. Segment 1.5 will add a `DEV_DISABLE_RATE_LIMIT` env flag for dev only.
- **Bundle size watch:** run `npm run build` after every segment. Target <350KB gzipped. Segment 1.4 lands at 271.06 KB gzipped.
- **Frontend Docker rebuild:** `docker compose build frontend && docker compose up -d frontend` after dependency changes. Source code changes hot-reload via the bind mount (Segment 1.1 polling config).

### Verification (raw evidence)

| Check | Result |
|---|---|
| Landing page loads at `:5173` | PASS â€” hero + CTAs render |
| Register with role=GENERATOR | PASS â€” lands on `/dashboard`, tokens stored |
| Register role dropdown excludes ADMIN | PASS â€” only 3 public roles |
| Login wrong password | PASS â€” inline error toast with RFC-7807 detail |
| Refresh browser on `/dashboard` | PASS â€” hydration keeps session |
| Logout | PASS â€” storage cleared, redirected to `/login` |
| Unauthenticated `/dashboard` access | PASS â€” redirected to `/login?from=/dashboard` |
| Post-login redirect | PASS â€” back to `/dashboard` |
| 6 rapid logins â†’ 6th | PASS â€” 429 with countdown |
| Access token expiry â†’ silent refresh | PASS â€” mock-verified in test |
| Role guard block | PASS â€” 403 page rendered |
| Single-flight refresh (3 concurrent 401s) | PASS â€” 1 refresh call |
| Frontend tests | 25 passed |
| Backend tests | 95 passed (unchanged) |
| Lighthouse a11y `/login`, `/register` | â‰¥90 both |
| Contrast primary text/background | â‰¥4.5:1 all pairs (19.27:1 on base, 17.33:1 on surface, 14.08:1 on elevated) |
| No `dangerouslySetInnerHTML` / `eval` / `new Function` | 0 matches |
| No auth `console.log` | 0 unguarded |
| Backend diff | empty (`git diff backend/app backend/alembic` 0 diff) |
| Containers | 7/7 healthy |
| `.env.example` VITE_* vars | 4 present, 0 secrets |

### Open Questions / Deferred Items
- **Cookie/BFF migration** â€” HttpOnly tokens, CSRF double-submit, BFF proxy. Segment 1.8+.
- **Forgot password / email verification** â€” no UI yet. Segment 1.5.
- **Session listing / per-device revoke** â€” backend repo method exists (Segment 1.3), UI deferred.
- **Light theme** â€” `[data-theme="light"]` scaffold exists in `index.css` but no toggle. Segment 1.6+.
- **i18n / Hindi support** â€” deferred. Consider `react-i18next` when scope grows.
- **`DEV_DISABLE_RATE_LIMIT` env flag** â€” for local dev ergonomics. Segment 1.5.
- **Backend CORS** â€” currently allows `http://localhost:5173`, `http://localhost:3000`. Prod origins added at deploy time (Segment 1.9).
- **Next segment pointer:** Segment 1.5 â€” Waste Categories, Supplier Intake & Pricing Engine.

### Reversal / Supersede Log
- **Supersedes the Segment 1.1 statement** that frontend was "minimal scaffold only." As of Segment 1.4, frontend is auth-complete with design system, guards, and API layer. The "Not Yet Implemented" list in README has been updated.
- **No reversals from 1.2 or 1.3** â€” backend remains untouched.

---

## Segment 2.1b â€” Waste Consignment Manifest Intake & QR Generation UI

**Date:** 2026-10-20  
**Status:** âœ… COMPLETE â€” supplier onboarding modal, intake submission page with image uploader, manifest success page with QR display and print/download, 41 frontend tests passing (16 new for 2.1b), 95 backend tests passing.

### Goal
Implement the end-to-end frontend waste submission workflow for GENERATOR roles:
- Auto-detect supplier profile via `GET /api/v1/suppliers/me` and prompt onboarding modal on 404 (`POST /api/v1/suppliers/profile`).
- File evidence photo upload with magic-byte validation, client-side size caps, and preview thumbnail management.
- Batch intake submission (`POST /api/v1/intake/create`) via multipart/form-data with progress tracking and idempotency key headers.
- Success manifest display (`GET /api/v1/intake/{id}`, `GET /api/v1/intake/{id}/qr`) with direct base64 QR rendering and print stylesheet.

### Key Architectural Decisions & Contract Points
1. **Contract Endpoints & Payloads:**
   - `GET /api/v1/suppliers/me` (returns 404 if profile unconfigured).
   - `POST /api/v1/suppliers/profile` (JSON: `business_name`, `registration_number`, `facility_address`, `latitude`, `longitude`, `contact_phone`).
   - `POST /api/v1/intake/create` (multipart/form-data: `category_id` (INT), `purity_grade` (STR), `declared_weight_kg` (FLOAT), `notes` (optional STR), `images` (file[])).
   - `GET /api/v1/intake/{id}` & `GET /api/v1/intake/{id}/qr` (`qr_code_data_url` as direct `data:image/png;base64,...`).
2. **Canonical Category IDs:**
   - Seeded in PostgreSQL with fixed IDs 33-40:
     - 33: `ORGANIC_BIOMASS`
     - 34: `PLASTIC_PET`
     - 35: `PAPER_CARDBOARD`
     - 36: `FERROUS_METAL`
     - 37: `GLASS`
     - 38: `E_WASTE`
     - 39: `HAZARDOUS`
     - 40: `TEXTILE`
   - Bound via `src/constants/wasteCategories.ts` with instant pricing and biogas calculation logic preserved.
3. **Routing Preservation:**
   - Existing route kept as `/intake` (wrapped in `<RequireAuth>` + `<RequireRole roles={["GENERATOR"]}>`).
   - Added `/intake/success/:intakeId` route.
4. **QR Manifest Rendering (Direct Base64):**
   - Directly loaded into `<img src={qr.qr_code_data_url} alt="Batch QR" />` without blob URL conversion.
   - Print stylesheet optimizes manifest card (`#print-region`) for printing while hiding buttons and navigation (`print:hidden`).
5. **Supplier Address & Pickup Semantics:**
   - Supplier facility address displayed as read-only card (`Pickup from: {supplier.facility_address}`).
   - Explicitly excluded any pickup request buttons (dispatch/logistics occurs in subsequent lifecycle stages).
6. **Robust Magic-Byte Image Validation:**
   - Client-side sniffing supports `file.arrayBuffer()` with FileReader fallback to validate JPEG (`FF D8 FF`), PNG (`89 50 4E 47 0D 0A 1A 0A`), and WebP (`RIFF` + `WEBP`) magic numbers.

### Verification Results
| Layer / Metric | Status | Evidence |
|---|---|---|
| Frontend TypeScript check | PASS | `npx tsc --noEmit -p tsconfig.json` 0 errors |
| Frontend Test Suite | PASS | 41 passed across 10 test files (16 new tests in 2.1b) |
| Backend Test Suite | PASS | 95 passed, 0 failed in 16.33s |
| Backend Git Diff | PASS | Unchanged (no new modifications in backend logic) |
| Container Health | PASS | 7/7 containers running and healthy |






---

## Segment 2.2a - Pickup Requests, Weight Tickets, and Batch List (Backend)

**Date:** 2026-10-20
**Owner:** AI Pair-Programmer (Antigravity)
**Status:** COMPLETE

### Goal (as originally stated)
Deliver 8 endpoints + 2 models (PickupRequest, WeightTicket) + 20 tests, unblocking the Segment 2.2 frontend dashboard. No frontend changes. No new pip packages.

### What Was Delivered

**New Models**
- PickupRequest (app/models/pickup.py) - 8-state FSM with FK to waste_intakes and optional driver FK to users.
- WeightTicket (app/models/weight_ticket.py) - Physical scale measurement. Server computes net_weight_kg = gross - tare. Stores discrepancy flag (>15% delta from declared weight), photo paths, supplier confirmation and dispute notes.

**New Repositories**
- PickupRepository - CRUD + FSM transitions, per-role filtered list queries.
- WeightTicketRepository - Create, get-by-id, get-by-intake (latest ticket).

**New Services**
- PickupService - Create (ownership + status guards), assign driver (ADMIN only), update status (role-aware FSM transitions), list (role-filtered), get-by-id (404-masked).
- WeightService - Record weight (GENERATOR forbidden; Decimal net compute), acknowledge (dispute_notes >=10 chars if confirmed=false), get ticket.

**Extended IntakeService**: added list_intakes - role-filtered paginated list with ?status= and ?category_id= filters.

**New Endpoints (8+1 total)**

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/v1/intake | ALL | Paginated, role-filtered intake list |
| POST | /api/v1/intake/{id}/weight-ticket | LOGISTICS, RECYCLER, ADMIN | Record scale weight |
| GET | /api/v1/intake/{id}/weight-ticket | ALL | Get latest weight ticket |
| POST | /api/v1/intake/{id}/weight-ticket/acknowledge | GENERATOR, ADMIN | Confirm or dispute weight |
| POST | /api/v1/pickups | GENERATOR, ADMIN | Schedule a pickup |
| GET | /api/v1/pickups | GENERATOR, LOGISTICS, ADMIN | List pickups (role-filtered) |
| GET | /api/v1/pickups/{id} | GENERATOR, LOGISTICS, ADMIN | Get pickup detail |
| PATCH | /api/v1/pickups/{id}/status | GENERATOR, LOGISTICS, ADMIN | FSM status transition |
| PATCH | /api/v1/pickups/{id}/assign | ADMIN | Assign logistics driver |

**Migrations:** 0003_pickup_requests.py, 0004_weight_tickets.py, 0005_intake_status_extend.py

**Tests (49 new)**
- test_segment_2_2a_pickups.py - 26 tests (5 classes) covering all pickup endpoints.
- test_segment_2_2a_weight_tickets.py - 23 tests (4 classes) covering weight ticket and intake list endpoints.

### Important Decisions (and why)

1. **from __future__ import annotations removed from all router modules.**
   Why: FastAPI + slowapi @limiter.limit() + Pydantic v2 type introspection fails with NameError: name uuid is not defined when future annotations are enabled. The string-evaluation path breaks UUID forward-ref resolution in rate limiter decorators.

2. **extra=forbid on WeightTicketCreate schema.**
   Why: Prevents client from submitting a falsified net_weight_kg. The 422 is enforced at schema layer before the service even runs - fraud-prevention by design.

3. **Server-side net_weight_kg via Decimal, not float.**
   Why: Float arithmetic rounding errors are unacceptable on legal weight tickets. Decimal(str(value)) eliminates 100.1 - 10.05 != 90.05 class of bugs. Stored as NUMERIC in Postgres.

4. **Discrepancy flag threshold = 15%.**
   Why: Industry standard for mass-balance reconciliation in waste logistics is +-10-20%. 15% flags genuine measurement problems without over-triggering on legitimate transport variance.

5. **404-masking for ownership violations (privacy by default).**
   Why: Returning 403 confirms the resource exists. A GENERATOR asking for another suppliers resource gets 404. ADMIN sees everything.

6. **Cancellation/failure require reason - enforced in service, not schema.**
   Why: The FSM reason field is optional in Pydantic (otherwise it 422s for non-cancel/fail transitions), but the service validates it contextually only for terminal states.

7. **TimestampMixin client-side defaults (default=lambda: datetime.now(timezone.utc)).**
   Why: Pydantic validates freshly-created SQLAlchemy objects before DB flush, when created_at is None. Client-side defaults ensure the field is set at construction time.

### Verification Results

| Layer / Metric | Status | Evidence |
|---|---|---|
| New tests (2.2a) | PASS | 49 new tests, 49 passed |
| Full backend suite | PASS | 144 passed, 0 failed in 16.23s |
| Zero regressions | PASS | Pre-existing 95 tests all still pass |
| Alembic state | PASS | alembic check clean |
| Container Health | PASS | 7/7 containers running and healthy |
| New models | PASS | PickupRequest, WeightTicket, PickupStatus, WeightMethod exported from app.models |
| Routers mounted | PASS | /api/v1/pickups, /api/v1/weight-tickets, and intake sub-routes all registered in main.py |


---

## Segment 3.1 — Fleet & Live Map

**Date:** 2026-10-24
**Status:** ? COMPLETE — vehicle/trip/GPS + live map + driver workflow + simulated GPS + route suggestion

### Delivered

**Backend (new):**
- Models: Vehicle, Trip, TripStop, GpsPing
- Migrations: 4 (vehicles, trips, trip_stops, gps_pings)
- Schemas: 4 files (ehicle_schemas, 	rip_schemas, gps_schemas, 
oute_schemas)
- Repositories: 4 files (VehicleRepository, TripRepository, TripStopRepository, GpsRepository) + IntakeRepository.get_by_ids extension
- Services: leet_service, gps_service, 
oute_service, simulation_service
- Celery tasks: gps_simulation_tick (10s), gps_ping_cleanup (daily 3am)
- Routers: 17 endpoints under /api/v1/fleet
- waste_streams.py matrix + geo.py haversine
- Reuses existing GET /api/v1/intake/scan/{batch_code} and POST /api/v1/intake/{id}/weight-ticket — no duplicate endpoints

**Frontend (new):**
- Packages: leaflet@^1.9.4, 
eact-leaflet@^4.2.1 (only new deps — approved exception)
- LiveMap component (OSM tiles, custom icons, polylines, attribution)
- AdminFleetPage (/admin/fleet) + TripCreateModal
- DriverTripPage (/driver/trip) + DriverStopDetailModal
- useGpsPolling hook (10s)

### Important Decisions

1. **Trip has multiple stops, one per PickupRequest.**
2. **3 waste stream classes** (DRY_RECYCLABLE, ORGANIC, HAZARDOUS_SPECIAL). Cross-class mixing forbidden (backend 422 + frontend UI disables incompatible).
3. **Simulated GPS is honest:** source="simulated" in DB, prominent amber banner in UI. Real device ping immediately overrides last_ping_source to device.
4. **Route suggestion is nearest-neighbor, not TSP.** MVP scope. Documented.
5. **Reuse existing scan + weight endpoints, no duplicates.**
6. **PickupRequest.assigned_driver_user_id deprecated but not removed** (data migration deferred to 3.2). New code uses Trip.driver_user_id.
7. **No WebSocket for GPS in MVP — 10s polling.** WebSocket push is 3.2+.
8. **Trip creation sets vehicle to in_use immediately** (prevents double-booking).
9. **ctual_distance_km computed on trip end** (not live).
10. **Map tiles via OSM public server for demo.** Production swaps to Mapbox/Google via env var.
11. **Stop completion requires WeightTicket first** (422 "Record weight before completing stop.").
12. **Only leaflet + 
eact-leaflet new npm packages.** No QR library (native BarcodeDetector + manual fallback). No new pip packages.

### Verification

| Check | Result |
|---|---|
| 4 migrations applied, alembic check clean | PASS |
| 4 tables created | PASS |
| 17 fleet endpoints live | PASS |
| Trip with mixed streams ? 422 | PASS |
| Trip exceeding capacity ? 422 | PASS |
| Complete stop without weight ? 422 | PASS |
| Simulated ping ? is_simulated=true | PASS |
| Route suggestion returns ordered IDs + reasoning | PASS |
| /admin/fleet renders map + stats | PASS |
| /driver/trip renders stops + simulated badge | PASS |
| Backend tests | 192 passed, 0 failed (genuine — baseline was earlier inflated by a synthetic-user test workaround; two RBAC tests were fixed with a real-user fixture, and a batch-code collision bug in `services/intake.py` was fixed in commit 2e86477) |
| Frontend tests | 93 passed (was 68) |
| Coverage new services | =75% |
| Containers | 7/7 healthy |
| No PII in logs | grep=0 |

### Open Questions / Deferred

- WebSocket GPS push — 3.2
- PickupRequest.assigned_driver_user_id removal — 3.2 data migration
- TSP multi-stop optimization — 3.2 if scale demands
- Trip cancel with partial completion cleanup — 3.2
- Production map provider swap — deployment prep
- Marker clustering for >20 stops — 3.2

### Reversal / Supersede

- Deprecates PickupRequest.assigned_driver_user_id (retained for backward compat, removal in 3.2)
- Overrides 2.2a's individual pickup assumption — trips can now group multiple pickups
- Introduces leaflet + 
eact-leaflet as approved exception to "no new npm packages" rule (interactive maps have no viable zero-dep option)

---

## Segment 3.2a — Sorter Console + Marketplace Browse (frontend)

**Date:** 2026-10-25
**Status:** ✅ COMPLETE — 111 frontend tests (was 93, +18)

### Goal
Deliver the sorter-facing and buyer-facing frontend for the 3.2 backend: sorter console to process weighed intakes into inventory lots, marketplace browse with filters, listing detail with bid/buy-now actions, buyer order list with payment confirmation. No backend changes.

### What Was Delivered

**API layer:**
- `src/api/sorting.ts` — `processSorting`, `listSortingRecords`, `getSortingRecord`
- `src/api/marketplace.ts` — `listListings`, `getListing`, `placeBid`, `buyNow`, `listMyOrders`, `confirmPayment`, `completeOrder`, `listInventoryLots`, `createListing`
- `src/api/traceability.ts` — `getBatchTimeline`
- 15 new interfaces in `src/api/types.ts`: `SortingRecordRead/Create`, `InventoryLotRead/Create`, `MarketplaceListingRead`, `ListingListResponse`, `BidCreate/Read`, `BuyNowRequest`, `PurchaseOrderRead`, `OrderListResponse`, `TraceabilityEventRead`, `TraceabilityTimelineResponse`

**Sorter Console (`/sorter/console`):**
- Lists weighed intakes waiting to be sorted (`listIntakes({ status: "weighed" })`)
- Recent sorting records table (last 5)
- Role-gated: RECYCLER + ADMIN only
- "Sort now" opens `SortIntakeModal`

**SortIntakeModal:**
- Weight breakdown: input / sorted / rejected with `sorted + rejected <= input` validation
- Quality: sort grade (A/B/C), contamination %, moisture %, notes
- **Multi-lot creation**: each intake produces N inventory lots. Live running-sum check against `sorted_weight_kg`.
- **Stream-compatibility gate**: lot categories disabled if not in the intake's stream class (DRY_RECYCLABLE / ORGANIC / HAZARDOUS_SPECIAL) — matches backend `waste_streams.py` matrix
- Submit → `processSorting` → toast + refresh

**Marketplace Browse (`/marketplace`):**
- Card grid (3/2/1 responsive), category + grade badges, `available_kg / total_kg`, price per kg, seller initial avatar
- Filters: category, grade, price range, sort order
- Pagination

**Listing Detail (`/marketplace/:id`):**
- 2-column layout — details + action card
- Action card: quantity input, live total, Buy Now, Place Bid
- Seller cannot buy own listing (button hidden, `seller_id === user.id` check)
- Sold/inactive listings: action buttons disabled
- Bid minimum = 70% of asking (matches backend rule) — live hint shows "Minimum ₹X"

**BuyNowModal + BidModal:**
- Buy Now → `buyNow(listingId, { quantity_kg })` → redirect to `/marketplace/orders`
- Bid → `placeBid` with price/quantity/message; validation on min price + available qty

**MyOrdersPage (`/marketplace/orders`):**
- `listMyOrders({ role: "buyer" })`
- Status badges (pending_payment=grey, escrow_held=blue, completed=green, cancelled=red)
- Actions: "Confirm payment" for `pending_payment`, "Mark received" for `escrow_held`

**Routes added (4):**
- `/sorter/console` (RECYCLER + ADMIN)
- `/marketplace` (all authed)
- `/marketplace/orders` (RECYCLER + ADMIN) — placed BEFORE `/marketplace/:id` in router
- `/marketplace/:id` (all authed)

### Important Decisions

1. **Sorter workflow uses a modal, not a dedicated page.**
   *Why:* One action per intake. Modal keeps the console list visible underneath. Fewer routes to maintain. When the sorter finishes, the row updates in place.

2. **Multi-lot creation is where the sorting value lives.**
   *Why:* One 100kg mixed intake produces 60kg plastic + 30kg paper + 10kg rejected, each with its own grade/contamination. The modal is the only place in the app where one input fans out to N outputs. Live sum validation prevents allocating more than the sorted weight.

3. **Stream-compatibility enforced client-side AND server-side.**
   *Why:* Backend already rejects cross-stream (3.2a backend commit `b0f21b8`). Frontend disables incompatible categories in the lot dropdown with tooltip. UX prevents the round-trip 422, backend catches bypass attempts. Defense in depth.

4. **Bid minimum = 70% of asking price, shown live in modal.**
   *Why:* Backend rejects bids below 70% (`marketplace_service.py`). Frontend shows "Minimum ₹X" so users know before submitting. Reduces failed bid attempts.

5. **Seller-cannot-buy-own-listing is a UX gate, not a security gate.**
   *Why:* Backend rejects self-bid in `place_bid` (422). Frontend hides the buttons when `user.id === listing.seller_id`. This is UX polish — the backend is the real control.

6. **Route order matters: `/marketplace/orders` before `/marketplace/:id`.**
   *Why:* React Router matches in declaration order. If `:id` comes first, navigating to `/marketplace/orders` treats "orders" as a listing ID → 404 from the listing fetch.

7. **No new npm packages.**
   *Why:* All UI needs (grid, badges, modals, pagination) are achievable with Tailwind + the existing Framer Motion + Lucide + TanStack Query stack. Native SVG for any charting in future segments.

8. **Bid rejection/cancellation UI deferred to 3.2b.**
   *Why:* Backend supports `status="cancelled"` but no UI control yet. Buyer-side cancellation flow is a seller-console feature (accept/reject bids), which is the next sub-segment. Ship the create-bid flow now, manage-bid flow in 3.2b.

### Operating Notes (for future maintainers)

- **Adding a new lot field:** update `InventoryLotCreate` in `types.ts`, add to `SortIntakeModal` lot row, backend schema update first (backend is source of truth).
- **Bid minimum change:** 70% is defined in `marketplace_service.place_bid`. Frontend hardcodes `0.7` in `BidModal` — if backend changes, update both. Consider a `GET /marketplace/config` endpoint in 3.3 to fetch limits.
- **Route ordering:** any new nested marketplace route (e.g., `/marketplace/favorites`) must be declared before `/marketplace/:id`.
- **Order status flow:** `pending_payment → escrow_held → completed`. Payment confirmation is currently a mock endpoint (immediate `escrow_held`). Real Stripe/Razorpay integration is 3.3.
- **Traceability API exists but not wired into any page yet.** `getBatchTimeline` is available for 3.2b's batch detail enhancement.
- **`createListing` API function exists but no UI.** Seller console in 3.2b uses it to turn inventory lots into marketplace listings.

### Verification

| Check | Result |
|---|---|
| tsc | 0 errors |
| Frontend tests | 111 passed (was 93, +18) |
| Backend unchanged | `git status` clean for `backend/` |
| Containers | 7/7 healthy |
| Forbidden patterns (`dangerouslySetInnerHTML`, `eval`, `new Function`) | 0 |
| New npm packages | 0 |
| Route order (`/marketplace/orders` before `/marketplace/:id`) | Correct |
| Stream gate enforced client + server | PASS |
| Bid min 70% enforced client + server | PASS |
| Seller cannot buy own listing | PASS |

### Open Questions / Deferred to 3.2b

- **Seller inventory dashboard** (`/seller/inventory`) — RECYCLER acting as seller views their inventory lots
- **Seller listings management** (`/seller/listings`) — create/edit/archive listings from lots (uses `createListing` API already delivered)
- **Seller bids received** (`/seller/bids`) — accept/reject bids (backend `accept_bid` endpoint)
- **Seller orders received** (`/seller/orders`) — fulfill orders, mark shipped/delivered
- **Traceability timeline embed** — `getBatchTimeline` exists; needs UI component in `SupplierBatchDetailPage`
- **Bid rejection/cancellation UI** — backend supports it; no UI yet
- **Real escrow** — currently mock; Stripe integration is 3.3
- **Listing expiry cron** — listings stay active indefinitely; 3.3 housekeeping
- **Analytics per category** (sold weight, revenue, CO₂e saved) — 3.3

### Reversal / Supersede

- **No backend changes.** Extends 3.1 patterns (modal + table + card grid + role-guarded routes).
- **Extends `SupplierBatchDetailPage` scope** — that page currently shows supplier's intake view only; sorter console is a separate entry point for the same intake object. Future consolidation: `SupplierBatchDetailPage` and sorter/seller detail views may share a common "batch overview" component in 3.3.

---

## Segment 3.2b — Seller Dashboard + Traceability Timeline

**Date:** 2026-10-26
**Status:** ✅ COMPLETE — 202 backend tests (was 192, +10), 125 frontend tests (was 111, +14)

### Goal
Deliver seller-facing marketplace workflows (inventory lot inspection, listing creation modal, listings management with cancellation, bid review with accept/reject, order fulfillment with shipment) and the consignment traceability timeline embedded in batch & listing detail pages. Minimal conditional backend additions for seller operations and traceability event emission.

### What Was Delivered

**Backend API additions (committed in 65020c7):**
- `GET /inventory/lots` & `GET /inventory/lots/{id}` — seller inventory endpoint (RECYCLER/ADMIN), with category/grade/status filters and auto-calculated metrics
- `PATCH /listings/{id}` — cancel listing with listing.cancelled traceability event
- `POST /listings/{id}/bids/{bid_id}/reject` — reject bid with bid.rejected traceability event
- `PATCH /orders/{id}/ship` — fulfill order by recording tracking details and carrier, status -> shipped, order.shipped traceability event
- `PATCH /orders/{id}/deliver` — mark order delivered, status -> delivered, order.delivered traceability event
- `POST /orders/{id}/complete` — updated to allow transition from `delivered` or `escrow_held`
- `GET /traceability/batch/{batch_id}` — convenience alias for batch journey
- 10 new backend tests in `test_marketplace_3_2b.py` (202 passed)

**Frontend API & Types:**
- `src/api/types.ts` — extended with `BidActionRequest`, `OrderShipRequest`, `OrderDeliverRequest`, `ListingCancelRequest`, `SellerInventoryStats`, `TraceabilityEventDisplay`, `CreateListingFromLotPayload`
- `src/api/seller.ts` — complete seller API client (`getSellerInventoryStats`, `getSellerInventoryLots`, `getSellerListings`, `cancelListing`, `getSellerBids`, `rejectBid`, `getSellerOrders`, `shipOrder`, `deliverOrder`)
- `src/api/traceability.ts` — extended with `mapEventToDisplay` helper for icons, badges, and readable event descriptions

**Frontend Components & Pages:**
- `TraceabilityTimeline.tsx` — interactive, animated timeline with status badges, actor info, metadata chips, expandable JSON details, and compact mode for sidebars
- Embedded `TraceabilityTimeline` in `SupplierBatchDetailPage` (`Batch Journey`) and `ListingDetailPage` (compact mode)
- `SellerInventoryPage.tsx` (`/seller/inventory`) — inventory metrics overview, filterable lot table, "Create Listing" action
- `CreateListingModal.tsx` — creates marketplace listing directly from an inventory lot with price calculation, grade pre-selection, and unit pricing
- `SellerListingsPage.tsx` (`/seller/listings`) — grid of seller listings, active/sold metrics, cancel listing confirmation modal
- `SellerBidsPage.tsx` (`/seller/bids`) — received bids grouped by listing, accept & reject modals with custom seller notes
- `SellerOrdersPage.tsx` (`/seller/orders`) — seller orders table with tracking number modal for shipping fulfillment
- Role-guarded routes in `App.tsx` and sidebar navigation items in `Sidebar.tsx` for RECYCLER and ADMIN roles

**Frontend Tests (14 new tests, 125 total passing across 33 test suites):**
- `TraceabilityTimeline.test.tsx` (3 tests)
- `SellerInventoryPage.test.tsx` (3 tests)
- `CreateListingModal.test.tsx` (2 tests)
- `SellerListingsPage.test.tsx` (2 tests)
- `SellerBidsPage.test.tsx` (2 tests)
- `SellerOrdersPage.test.tsx` (2 tests)

### Verification

| Check | Result |
|---|---|
| tsc | 0 errors |
| Frontend tests | 125 passed (was 111, +14) |
| Backend tests | 202 passed (was 192, +10) |
| Vite build | Production build clean (dist/ generated) |
| Forbidden patterns (`dangerouslySetInnerHTML`, `eval`, `new Function`) | 0 |
| New npm packages | 0 |
| Containers | Healthy |
| Role guards | RECYCLER + ADMIN on all /seller/* routes |

---

## Segment 3.3a — Analytics Dashboards

**Date:** 2026-10-26
**Status:** ✅ COMPLETE — supplier/seller/admin analytics, native SVG charts, 137 frontend + 210 backend tests

### Delivered

**Backend:**
- `analytics_repository.py` — 17 SQL aggregation functions (async, parameterized)
- `analytics_service.py` — 3 role-gated methods
- `analytics.py` router — 3 endpoints (`/analytics/supplier|seller|admin`)
- `analytics_schemas.py` — 4 response schemas
- `seed_analytics.py` — idempotent 90-day historical seed (dev-only, marker-tagged)
- 8 new tests → **210 total backend**

**Frontend:**
- 5 native SVG chart components: `StatCard`, `AnimatedCounter`, `LineChart`, `BarChart`, `DonutChart`
- 2 shared analytics components: `PeriodSelector`, `AnalyticsPageShell`
- `/dashboard/analytics` — supplier view (4 cards, kg-by-day area, status donut, category bars, impact stats)
- `/seller/analytics` — seller view (revenue card, revenue-by-day, order donut, kg-by-category, ops summary)
- `/admin/analytics` — **hero page** with giant animated CO₂e counter, kg diverted, GMV, households served; trend charts, distributions, top suppliers/sellers leaderboards, quick links
- Sidebar updated: "Analytics" in supplier section, "Analytics" in seller section, "Platform Analytics" in admin section
- 12 new tests → **137 total frontend**

### Important Decisions

1. **Native SVG charts, no recharts/chart.js.**
   *Why:* Chart libraries add 200-500KB to bundle and lock design. Native SVG (`<path>`, `<circle>`, `<rect>`) gives full control, zero dependencies, animates smoothly. `<title>` inside SVG shapes gives native hover tooltips. All 5 charts total ~400 lines.

2. **Backend SQL aggregation, not frontend rollup.**
   *Why:* Frontend would need to fetch every intake/order row and aggregate client-side — O(n) network + O(n) memory. With 2500 intakes and 1200 orders from the seed, that's ~5MB JSON per page load. Backend aggregations return ~2KB. Also correct-by-construction (SQL `group by` never lies about sums).

3. **Default period: last 30 days.**
   *Why:* Matches common dashboard conventions. Weekly is too sparse (charts look empty), quarterly hides recent activity. 30 days shows trend + magnitude. Period selector lets user jump to 7d/90d.

4. **CO₂e uses `verified_weight_kg`, not `declared_weight_kg`.**
   *Why:* Declared is supplier's guess. Verified is physical measurement at pickup. Only verified kg is "actually diverted". Admin/supplier dashboards claim real impact, so use verified.

5. **`total_households_served` = distinct suppliers with ≥1 verified intake.**
   *Why:* Not distinct users (multiple users per supplier org). Not total intakes (that's batches, not entities). Distinct suppliers with completed transactions is the honest metric for pitch ("X households and businesses served").

6. **90-day seed spread with realistic status distribution.**
   *Why:* Empty charts during demo are death. Seeded 60% completed, 20% weighed, 10% picked_up, 5% cancelled reflects real product mix. 90 days lets "90d" period toggle show meaningful data.

7. **Seed script refuses to run in `APP_ENV=production`.**
   *Why:* Seed data is fake. Shipping it to prod corrupts analytics forever. Hard guard: `sys.exit` if production. Also idempotent (skips existing seeded rows) + `--reset` flag for dev cleanup.

8. **Admin analytics is the "hero" page.**
   *Why:* Judges/investors want 3-second comprehension of impact. Giant animated counters (CO₂e saved, kg diverted, ₹ GMV, households) at the top are the pitch. Everything below is supporting evidence.

9. **Route order: `/dashboard/analytics` doesn't conflict with `/dashboard/batches/:id`.**
   *Why:* Verified in Section M before writing. Different path segments — no collision. Only `/marketplace/orders` vs `/marketplace/:id` needed special handling (from 3.2a).

10. **No LOGISTICS analytics page.**
    *Why:* Drivers don't do analytics — they do trips. A trip stats page (km driven, hours active, pickups completed) is a Segment 3.3b concern. This segment focuses on the three money/impact views.

### Operating Notes

- **Adding a metric:** extend `Supplier/Seller/AdminAnalyticsResponse` schema → add repo function → wire in service → add chart on frontend. New metric appears immediately.
- **Changing seed volume:** edit ranges in `seed_analytics.py`, run with `--reset`. Admin dashboard totals adjust on refresh.
- **CO₂e factor tuning:** values in `waste_categories` table (per-category `carbon_offset_factor`). Update via SQL, all dashboards reflect immediately.
- **Chart performance:** SVG charts render ~100 points max. For 90-day daily series (90 points), fine. For 365d (if added), downsample to weekly.
- **GMV definition:** sum of orders in `[escrow_held, shipped, delivered, completed]` — excludes pending_payment (not yet money) and cancelled/refunded.
- **Period selector default resets on page navigation** — no persistence. Fine for demo. Persist via URL query param in 3.3b if needed.

### Verification

| Check | Result |
|---|---|
| tsc | 0 errors |
| Frontend tests | 137 (was 125, +12) |
| Backend tests | 210 (was 202, +8) |
| Prod build | succeeds (`✓ built in 24.88s`) |
| Containers | 7/7 healthy |
| Forbidden patterns | grep=0 |
| New npm packages | 0 |
| Supplier analytics renders with data | PASS |
| Seller analytics renders with data | PASS |
| Admin hero counters animate | PASS |
| Period toggle re-fetches | PASS |
| Sidebar nav shows correct links per role | PASS |

### Deferred to 3.3b/3.3c
- Rewards system (points, streaks, vouchers, leaderboard)
- Admin user management + moderation queue
- Real Stripe/Razorpay escrow integration
- Email/notification system
- Trip stats analytics for LOGISTICS
- Export CSV / PDF report for ESG compliance
- Custom date range picker (currently preset periods only)
- Real-time counters (currently on page load only)

### Reversal / Supersede
- No breaking changes to any prior route or component.
- Adds 3 new routes, 5 chart components, 2 shared analytics shells.
- Sidebar gets new "Analytics" links in 3 role sections.

---

## Segment 3.3b — Rewards System

**Date:** 2026-10-26
**Status:** ✅ COMPLETE — points engine, streaks, vouchers, leaderboard, 145 frontend + 220 backend tests

### What Was Delivered

**Pre-flight fixes (Phase 1):**
- 3.3a frontend committed (`2311a5e`, was uncommitted)
- Frontend test count verified as 137 across 39 test files (Case TEST-A)
- `reward_wallets` deduped from 5,656 → 18 (one per user)

**Backend (Phase 2):**
- `RewardWallet`, `RewardTransaction` extended with `last_submission_date`, `transaction_type`, `reference_type`, `reference_id`, `metadata`
- `EcoStoreProduct.points_cost` column added
- `rewards_service.py` — points engine + streak tracking + idempotent award transactions
- `leaderboard_service.py` — week/month/all-time rankings with PII masking
- 7 endpoints under `/api/v1/rewards/*`
- Wiring: `weight_service.on_intake_weighed`, `pickup_service.on_pickup_completed`, `marketplace_service.on_order_completed` call rewards
- 10 eco-products seeded (vouchers + impact certificate)
- 10 new tests → 220 backend total

**Frontend (Phase 2):**
- `api/rewards.ts` — 6 functions
- `/rewards` — balance hero, streak badge, voucher grid, transactions, redemptions
- `/rewards/leaderboard` — week/month/all-time with rank badges
- `WalletBadge` component in sidebar
- +8 tests → 145 frontend total

### Important Decisions

1. **Award idempotency via (reference_type, reference_id, transaction_type) tuple.**
   *Why:* `on_intake_weighed` might be called twice if weight is corrected. Transaction ledger must not double-credit. Unique constraint on the tuple plus `SELECT ... WHERE NOT EXISTS` pattern prevents duplicates.

2. **Streak computed from `last_submission_date`, not from scanning all intakes.**
   *Why:* O(1) update per weigh event. Scanning would be O(n) per check and break at scale. Wallet stores `streak_days` + `last_submission_date`; comparing to today/yesterday determines increment/reset. Milestones (7/14/30) award bonus only once via `lifetime_points` or transaction-type lookup.

3. **Points economy: 10 pts/kg submitted, 50 pts/pickup, 5 pts/kg sold, streak bonuses 100/250/500.**
   *Why:* 100kg batch = 1000 pts. Small voucher (notebook, 200 pts) reachable in 1-2 intakes. Bigger vouchers (compost bag, 500 pts) require sustained engagement. Encourages quality (verified weight drives points) without over-rewarding.

4. **Voucher redemption decrements stock AND deducts points atomically.**
   *Why:* Rollback on stock conflict. If two users race on last stock item, one wins, one gets 422. Points not deducted on failure.

5. **Leaderboard masks PII (first initial + last name only).**
   *Why:* Public leaderboard exposing full emails = privacy leak. `Ramesh Kumar` → `R. Kumar`. Users still recognize themselves. Optional: opt-in for full name display is a 3.3c enhancement.

6. **Impact certificate (10 trees, 1000 pts) in voucher catalog.**
   *Why:* Not all rewards need physical delivery. A digital "tree plantation certificate" adds narrative impact with zero logistics. Pitch-friendly.

7. **No new npm packages.** Leaderboard is a table, vouchers are cards, transactions are a list — all Tailwind + existing components.

8. **Rewards are wired into existing services, not duplicated.**
   *Why:* If weight_service creates a ticket but doesn't award points, two code paths drift. Single source: every `on_*` trigger runs exactly once per state transition, hooked into the service that owns the transition.

### Operating Notes

- **Tuning points:** edit `EARN_RATES` in `rewards_service.py`. Redeploy. No data migration needed (existing transactions stay as-is).
- **Adding a voucher:** insert into `eco_products` with `points_cost > 0`. Appears in `/rewards` immediately.
- **Streak reset edge case:** if a user submits at 23:59 day 1 and 00:01 day 2 → streak counts as 2 (two calendar dates). This is intentional and matches Duolingo/GitHub streak semantics.
- **Refunding points on order cancel:** not implemented. Cancelled eco orders keep points deducted. Future: `admin_adjust` can refund.
- **Leaderboard performance:** with 5,656 → 18 wallets after dedup, sorting is trivial. If scaled to 10k+ users, add materialized view.
- **Manual point adjustments:** `POST /rewards/admin/adjust` for demo/bug-fix scenarios. Logs to transaction ledger with `transaction_type="admin_adjust"`.

### Verification

| Check | Result |
|---|---|
| tsc | 0 errors |
| Frontend tests | 145 (was 137 after Phase 1 fix, +8) |
| Backend tests | 220 (was 210, +10) |
| Containers | 7/7 healthy |
| No new npm/pip | PASS |
| reward_wallets count | 18 (deduped from 5,656) |
| eco_products count | 10 |
| Points awarded on weigh | PASS |
| Streak increments correctly | PASS |
| Voucher redemption flow | PASS |
| Leaderboard masks PII | PASS |

### Deferred to 3.3c/4.0
- Order cancellation refunds
- Real product shipping/delivery tracking for physical vouchers
- Email notifications on reward milestone
- Admin dashboard for user moderation
- Real Stripe integration

### Reversal / Supersede
- Fixes 3.3a uncommitted frontend (committed now).
- Fixes wallet duplication from seed (deduped).
- Adds rewards system on top of existing eco_products + wallets.

---

## Segment 4.0 — Deployment Preparation

**Date:** 2026-10-26
**Status:** ✅ COMPLETE — prod compose, CI/CD, TLS, backups, runbooks

### What Was Delivered

**Infra (Commit 1):**
- `docker-compose.prod.yml` — pull-based (no build), nginx in front, certbot sidecar
- `.env.prod.example` — 50+ vars documented with `CHANGE_ME` placeholders
- `deploy/nginx/nginx.conf` + `deploy/nginx/conf.d/app.conf` — HTTP→HTTPS redirect, TLS 1.2/1.3, gzip, security headers, WebSocket proxy, static cache
- `deploy/scripts/first-time-setup.sh` — Ubuntu 22.04 bootstrap (Docker, firewall, certbot initial cert)
- `deploy/scripts/deploy.sh` — pull, migrate, health-check, rolling backend swap, rollback on failure
- `deploy/scripts/backup.sh` — nightly pg_dump, 30-day retention
- `.github/workflows/ci.yml` — backend (ruff + pytest) + frontend (tsc + vitest + build) on every PR
- `.github/workflows/deploy.yml` — tag → GHCR images → SSH deploy with `deploy.sh`

**Docs (Commit 2):**
- `docs/deploy.md` — 30-min VPS guide + DNS + secrets + rollback + VPS cost comparison (Hetzner/DigitalOcean/AWS Lightsail)
- `docs/operations.md` — logs, restarts, migrations, backup restore, secret rotation, scaling, alerts
- `README.md` — Deployment section + architecture diagram

### Important Decisions

1. **Nginx in front, certbot sidecar.**
   *Why:* Certbot renews automatically via sidecar loop. Nginx reloads every 6h to pick up renewed certs. Zero manual intervention after first-time setup.

2. **Pull-based prod compose, no local build.**
   *Why:* Building on the VPS burns CPU (blocks other containers) and requires source access. GHCR images are pre-built, small, cacheable. Deploy becomes `docker compose pull && up -d`.

3. **Zero-downtime deploy with rollback.**
   *Why:* `deploy.sh` runs migrations, spins up a second backend replica, health-checks it, THEN swaps. If health fails, rolls back to previous tag. No 500s during deploy.

4. **Two-commit split: infra + docs.**
   *Why:* Infra and docs land independently. If docs need fixing, no need to touch infra. Easier to cherry-pick to main.

5. **First-time-setup runs ONCE, deploy.sh runs FOREVER.**
   *Why:* Ubuntu apt install of Docker, firewall setup, initial cert — these are bootstrapping steps that must not re-run. `deploy.sh` is safe to run repeatedly.

6. **`.env.prod.example` uses `CHANGE_ME_...` for every secret.**
   *Why:* Obvious what to change. `openssl rand -hex 32` documented in comments. Reviewer can diff `.env.prod.example` against `.env` and see no leaks.

7. **Backup script dumps to local disk by default, S3 sync commented.**
   *Why:* Not everyone has S3 configured at deploy time. Local dump works out-of-the-box. Uncomment S3 line when bucket exists.

8. **CI on every PR, deploy only on version tags.**
   *Why:* PRs get full test coverage before merge. Tag push (v1.0.0) triggers deploy. No surprise deployments on merge.

9. **Hetzner €4/mo recommended as primary.**
   *Why:* Best price/performance for a hackathon-scale app. 2GB RAM runs all 8 containers. DigitalOcean $6 also fine. AWS Lightsail $5 as third option. Docs include comparison table.

10. **`.env` never committed, `.env.prod.example` is.**
    *Why:* Pre-flight checked this. If `.env` ever gets tracked, `git rm --cached .env` + force rotation. New check in CI could add `git ls-files .env` assertion — flagged as 4.0b enhancement.

### Operating Notes

- **VPS specs needed:** 2GB RAM minimum, 2GB recommended. 20GB disk (postgres + minio + images). Any provider works.
- **DNS records required:** A record `@` → VPS IP, A record `www` → VPS IP, A record `api` → VPS IP (or CNAME to `@`).
- **Secret rotation:** see `docs/operations.md` "Rotate JWT secret". Warning: invalidates all active sessions.
- **CI secrets:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`. Add in GitHub Settings → Secrets.
- **Monitoring:** uptime probe on `https://yourdomain.com/health` (Better Stack / UptimeRobot free tier). Sentry DSN is optional but recommended.
- **First deployment risk:** certbot needs port 80 accessible during ACME challenge. Make sure no other webserver is running on 80 before `first-time-setup.sh`.

### Verification

| Check | Result |
|---|---|
| docker-compose.prod.yml valid | PASS (`docker compose config`) |
| Backend production image builds | PASS |
| Frontend production image builds | PASS |
| Backend imports in prod image | PASS |
| Frontend nginx config valid | PASS |
| .env.prod.example has 50+ vars | PASS |
| No secrets committed | PASS (grep clean) |
| App code unchanged | PASS (`git diff --stat backend/app/ frontend/src/` empty) |
| Backend tests | 220 passed |
| Frontend tests | 145 passed |

### Deferred to 4.0b/4.1
- Cloudflare CDN layer (DNS + DDoS protection)
- Multi-region deployment (only if scaling beyond demo)
- Real Stripe integration (mocked escrow currently fine for demo)
- Email notifications via SendGrid/Postmark
- Database read replicas
- Automated SSL renewal monitoring (currently certbot sidecar handles it silently)
- CI check to prevent `.env` from being committed
- Prometheus + Grafana monitoring stack (currently Sentry optional)

### Reversal / Supersede
- No app code changed. All infrastructure additions.
- Extends `docker-compose.yml` (dev) with a production sibling that pulls from GHCR.
- README updated with deployment section but preserves all dev instructions.

---

## Segment 3.3c — Admin Dashboard

**Date:** 2026-10-26
**Status:** ✅ COMPLETE — user management, dispute resolution, activity feed, 155 frontend + 228 backend tests

### What Was Delivered

**Backend (Commit 1):**
- `User` extended: `last_role_change_by_user_id`, `last_role_change_at`, `deactivated_by_user_id`, `deactivation_reason`
- `WeightTicket` extended: `dispute_resolution`, `dispute_resolved_by_user_id`, `dispute_resolved_at`, `dispute_resolution_note`
- Migration `3302_admin_dashboard.py` (8 new columns, all nullable)
- `admin_repository.py` — user list/filter, dispute list/filter, activity feed queries
- `admin_service.py` — 6 methods, all role-gated, with audit column writes
- `admin.py` router — 6 endpoints
- Safeguards: cannot change own role, cannot deactivate last active ADMIN, cannot resolve already-resolved dispute
- 8 new tests → 228 backend

**Frontend (Commit 2):**
- `api/admin.ts` — 6 functions
- 8 new types in `types.ts`
- `/admin/users` — searchable, filterable user table with role-change + deactivate modals
- `/admin/disputes` — pending/upheld/rejected tabs + resolve modal
- `/admin/activity` — traceability event feed, day-grouped, 30s auto-refresh
- 3 modals: `RoleChangeModal`, `DeactivateModal`, `ResolveDisputeModal`
- Sidebar: 3 new links in admin section
- 10 new tests → 155 frontend

### Important Decisions

1. **Audit columns, not separate audit log table.**
   *Why:* Adding `admin_audit_log` table would be another migration + service + retention policy. Column-based audit (`last_role_change_by_user_id`, `dispute_resolved_by_user_id`) covers "who did what, when" for the 3 admin actions. A separate table is future 4.1 scope if admin actions proliferate.

2. **Cannot change own role.**
   *Why:* Admin promotes themselves to... ADMIN (no-op). Admin demotes themselves to GENERATOR → locked out, other admins (if any) must fix. Prevents accidental self-lockout. 422 with "Cannot change your own role."

3. **Cannot deactivate last active admin.**
   *Why:* Same reason — if the only admin deactivates themselves, no one can reactivate. Service counts active admins before allowing deactivation. If count == 1 and target is that admin → 422.

4. **Dispute resolution is final (no undo).**
   *Why:* Disputes settle money (verified weight drives pricing). Reversing a resolution after payment is complex. Keep it simple: resolution is irreversible, admin can manually adjust weight later if genuinely wrong (rare). Warning shown in modal.

5. **Activity feed auto-refreshes every 30s.**
   *Why:* Real-time streaming via WebSocket would be ideal but adds complexity. Polling every 30s for an admin-monitoring page is fine — admin can manually refresh if urgent. Reduces server load vs 5s polling.

6. **Activity feed shows traceability_events, not admin_actions.**
   *Why:* Traceability events cover batch lifecycle (submitted → weighed → sorted → listed → sold). Admin action audit is column-based (see above). Merging both into one feed would need UNION + type coercion — deferred to 4.1.

7. **No moderation of listings in this segment.**
   *Why:* Sellers already self-cancel listings (3.2b). Buyers can't report spam yet. Moderation queue without reports = unused feature. Defer until buyer reporting exists (4.1).

8. **Dispute resolution doesn't auto-adjust verified_weight.**
   *Why:* The `WeightTicket.verified_weight_kg` is a physical measurement. If dispute is upheld, an admin should manually issue a corrected ticket — the original stays for audit. This segment only marks the dispute resolved (with note). Future 4.1: auto-reverse payment + adjust.

9. **User list excludes sensitive fields (hashed_password, refresh tokens).**
   *Why:* Backend `AdminUserListItem` schema only exposes what admin needs for support. Password hashes never leave the DB, never appear in API responses. Enforced by Pydantic schema.

10. **Search is ILIKE on email OR full_name.**
    *Why:* Admins search by "Anirudh" (name) or "anirudh@..." (email). Both matter. ILIKE is case-insensitive. No full-text index needed at current user count (~50). Add GIN index if users > 10k.

### Operating Notes

- **Adding a new admin action:** add endpoint, add service method, add audit column to affected model (if not already). If audit columns grow > 4, promote to `admin_audit_log` table.
- **Dispute resolution flow:** supplier marks dispute at `/dashboard/batches/:id` weight panel (from 2.2) → admin reviews at `/admin/disputes` → resolve → supplier sees resolution badge on their batch page.
- **Activity feed performance:** queries `traceability_events` DESC LIMIT 50. With 90-day seed (~10k events), query < 50ms. Add `(event_type, created_at DESC)` composite index if filtering becomes slow.
- **Role change cascade:** changing GENERATOR → RECYCLER does NOT auto-create Supplier or recycler-specific records. User keeps their existing Supplier row (if any), just gains/loses role-gated access. Documented but not automated.
- **Deactivation cascade:** deactivated user cannot log in (auth check blocks), existing access tokens remain valid for up to 30min (JWT TTL). On next refresh, refresh-token rotation blocks (user inactive check). Max 30min tail window — acceptable.
- **Admin account creation:** only via seed or another admin. No self-registration for ADMIN (from 1.3, still enforced).

### Verification

| Check | Result |
|---|---|
| tsc | 0 errors |
| Frontend tests | 155 (was 145, +10) |
| Backend tests | 228 (was 220, +8) |
| Containers | 7/7 healthy |
| No new npm/pip packages | PASS |
| Cannot change own role | PASS |
| Cannot deactivate last admin | PASS |
| Dispute resolution audited | PASS |
| Activity feed auto-refreshes | PASS |
| Search + filter user list | PASS |
| Modals prevent invalid actions | PASS |

### Deferred to 4.1
- Admin audit log table (promote from column-based)
- Buyer reporting → listing moderation queue
- Automated weight adjustment on dispute upheld
- Email notification to user on role change / deactivation / dispute resolved
- Bulk user operations (import, export CSV)
- Admin action WebSocket stream (replace 30s polling)
- User impersonation for support debugging

### Reversal / Supersede
- No breaking changes to existing routes or models.
- Extends User and WeightTicket models (all columns nullable, no backfill needed).
- Sidebar admin section now has 5 links (fleet, analytics, users, disputes, activity).

---


