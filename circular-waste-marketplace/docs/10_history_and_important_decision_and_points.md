# Engineering Journal: History, Key Decisions & Pitch Strategy

**Project:** Circular Waste & Resource Marketplace  
**Document Code:** ENG-JOURNAL-001  
**Sprint Model:** Solo Developer → Hackathon Delivery  
**Lead Solutions Architect & Developer:** Solo Full-Stack Engineer  
**Repository State:** Sprint Active  

---

# 10 — History & Important Decisions & Points

This document is the single source of truth for **why** the project looks the way it does. Every meaningful architectural decision, every "we almost did X but chose Y" moment, and every critical operating note lives here. Future contributors and AI agents read this file before touching the codebase.

Chronological. Newest at the bottom within each segment. Do not delete old entries — if a decision is reversed, add a new entry explaining the reversal and link back.

---

## Segment 1.1 — Docker & Project Setup

**Date:** _(fill date of completion, format YYYY-MM-DD)_
**Owner:** _(your name or agent handle)_
**Status:** ✅ Completed

### Goal (as originally stated)
One command brings Postgres, FastAPI, and React dev server up, healthy and reachable. This is the foundation — nothing else can be trusted if this isn't rock solid.

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
   *Why:* Docker Desktop on Windows does not reliably forward inotify filesystem events from bind-mounted host folders. Without polling, hot module reload silently stops working and developers think Vite is broken. Polling trades a bit of CPU for predictable behavior. This is a **dev-only** setting — must be reconsidered for production builds.

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
- **Port conflicts:** If 8000, 5173, or 5432 collide with local services on a developer machine, edit the host-side port mapping in `docker-compose.yml` only — the container-internal port must stay constant so service-to-service DNS works.

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
- _Add any_ — e.g., whether to adopt the `docker-compose.override.yml` pattern in later segments, whether to add a `Makefile`, whether to include a Postgres admin UI (e.g., pgAdmin) as a dev-only sidecar.
- **Next segment pointer:** _Segment 1.2 — (whatever comes next, fill this in when it begins)._

### Reversal / Supersede Log
- None yet.

---

## Segment 1.1 — Docker Build Repair + Full Requirements Install

**Date:** 2026-10-18
**Status:** ✅ Resolved

### What Was Broken
Docker build failed with "target stage 'development' could not be found". `docker-compose.yml` declared `target: development` but neither Dockerfile had a `FROM ... AS development` stage. 0/7 containers running.

### What Was Fixed
- Rewrote `backend/Dockerfile` → 3 stages: `base` (installs ALL production requirements + `pip freeze > /tmp/installed-prod.txt`), `development` (dev reqs on top + `pip freeze`), `production` (slim, non-root, gunicorn).
- Rewrote `frontend/Dockerfile` → 4 stages: `base`, `development`, `builder`, `production` (nginx).
- Rewrote `docker-compose.yml` → 7 services (postgres, redis, minio, backend, celery-worker, celery-beat, frontend) with health checks, named volumes, `depends_on: condition: service_healthy`.
- Merged existing `requirements.txt` + baseline → **no package dropped**. Fixed `anyio==4.6.2` (yanked) → `4.7.0`.
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
- Always verify pip installs **inside the built image** — version resolution can differ from host.
- Use `pip freeze` in every Docker stage for auditability.
- Keep `docker-compose.yml` `target:` in lockstep with Dockerfile `AS` names.
- Windows + WSL2 bind-mount HMR requires polling (`CHOKIDAR_USEPOLLING=true` + Vite `usePolling`).
- Gate migrations via `RUN_MIGRATIONS=true` so only `backend` runs them.
- `anyio==4.6.2` is yanked on PyPI — always check for yanked pins during dry-run.
- Shell scripts executed in Linux containers must not contain UTF-8 BOM (`\xef\xbb\xbf`) or Windows CRLF endings.
- Pydantic v2 `pydantic-settings` parses list-typed environment variables via `json.loads` by default.

---

## Segment 1.2 — FastAPI + PostgreSQL Foundation

**Date:** 2026-10-18
**Status:** ✅ COMPLETE — settings, DB layer, Alembic, health, CORS, logging all production-grade

### Goal
Wire FastAPI to PostgreSQL with a clean, reusable DB layer; make `/health` prove DB connectivity; lock schema lifecycle to Alembic; enforce CORS from settings; introduce structured logging and request IDs. No business logic, no new models, no auth endpoints — pure infrastructure hardening on top of the Segment 1.1 working stack.

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
- `engine.py` — `create_async_engine` from `DATABASE_URL`, `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`, `pool_recycle=1800`, echo gated by `APP_DEBUG`.
- `session.py` — `async_session_maker`, `get_db` async-generator dependency (open → yield → rollback on error → close), plus `get_db_context` (`async_session_context`) context-manager variant for background tasks / Celery.
- `base.py` — SQLAlchemy 2.x `DeclarativeBase` with `TimestampMixin`. All existing models inherit from it.
- `__init__.py` re-exports `Base`, `TimestampMixin`, `get_db`, `get_async_session`, `async_session_maker`, `AsyncSessionLocal`, `async_engine`, `engine`, `get_db_context`, `async_session_context`.

**Alembic**
- `env.py` wired to `Base.metadata` and `DATABASE_URL_SYNC`. Model imports registered before `target_metadata` so autogenerate sees every table.
- `compare_type=True` and `compare_server_default=True` enabled.
- Current head: `0001_initial_schema`.
- `alembic check` reports no drift ("No new upgrade operations detected.").
- `Base.metadata.create_all` removed from runtime path — schema is Alembic-only.

**App (`main.py`)**
- `lifespan` context manager: startup logs app name/version/env, runs `SELECT 1` on DB (warning in dev, raises in prod on failure); shutdown disposes engine pool (`await async_engine.dispose()`).
- CORS from `settings.cors_origins`; `allow_credentials=True`; not combined with `"*"` origin.
- All 12 domain routers registered under `settings.api_v1_prefix` (37 endpoints intact).
- Global exception handlers: `RequestValidationError → 422`, `HTTPException → standard shape`, catch-all `Exception → 500` with `request_id`, no stack leak in prod.
- Request-ID middleware: UUID per request, `X-Request-ID` response header, bound to structlog contextvars.
- Docs URLs disabled when `APP_ENV=production`.

**Health & Ready**
- `GET /health` — structured JSON: `status`, `version`, `environment`, `database` (`ok`/`unreachable` + latency ms), `timestamp`. 200 when DB ok, 503 when unreachable.
- `GET /ready` — 200 only when DB reachable AND migrations at head (verified via `alembic_version` present).
- `GET /` — app metadata JSON (`name`, `version`, `environment`, `docs`, `health`).

**Logging (`app/core/logging.py`)**
- `structlog` configured once: JSON in prod, colored human-readable in dev.
- Every log line carries `timestamp`, `level`, `event`, `request_id`, `logger`.
- PII redaction: `password`, `token`, `authorization`, `cookie`, `secret`, `access_token`, `refresh_token` → `***`.
- `print()` eliminated from `app/` (0 occurrences).

**Environment variables**
- `.env.example` updated to include all 75 settings variables + aliases. Scripted comparison returns 0 diff (`set()`).

**Tests**
- `tests/conftest.py` — `db_session` (transactional rollback), `async_client` (httpx ASGITransport), `auth_headers` stub.
- New tests: `/health` ok + degraded, `/ready` ok + 503, `/` shape, CORS allowed/blocked, `X-Request-ID` present, settings fail-fast, session closes/rollbacks on error.
- Test count: **50 passed** (was 37 → delta +13).

### Important Decisions (and why)

1. **Alembic-only schema lifecycle — `create_all` removed.**
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

8. **CORS `allow_credentials=True` forbids `allow_origins=["*"]` — enforced in settings validator.**
   *Why:* Browsers reject `*` + credentials. Allowing it silently in dev means production breaks. Rejecting at startup makes the misconfiguration impossible to ship.

9. **Settings fail-fast in production when `JWT_SECRET` is the placeholder.**
   *Why:* The single most common security incident in FastAPI projects is a dev secret reaching prod. Killing the process at boot is the cheapest fix.

10. **New tests target infrastructure only — no business logic tests.**
    *Why:* Business logic hasn't been built yet. Tests here prove that every future segment inherits a working DB, session, health, CORS, and logging foundation. Testing what doesn't exist yet dilutes the signal.

### Operating Notes (for future maintainers)

- **Adding a model:** create it in `app/models/`, ensure it inherits from `app.db.base.Base`, then run `alembic revision --autogenerate -m "add_<model>"`. Review the generated diff **line by line** — autogenerate is a suggestion, not truth. Rename hex revision IDs to human-readable names before commit.
- **Applying migrations in dev:** the `backend` container's entrypoint runs `alembic upgrade head` on startup when `RUN_MIGRATIONS=true`. Celery containers set it to `false` so they never race.
- **Applying migrations in prod:** run `alembic upgrade head` as a **separate one-shot job** (Kubernetes `Job`, ECS task, `docker compose run --rm backend alembic upgrade head`), not via the app process. Never let a rolling deploy with multiple replicas all run migrations.
- **Resetting the DB:** `docker compose down -v && docker compose up --build`. This wipes the volume — use deliberately.
- **Checking drift before commit:** `docker compose exec backend alembic check` must print "No new upgrade operations detected." If it prints drift, a model was changed without a migration — fix before merging.
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
- **Prometheus `/metrics`** — package is installed but endpoint not exposed. Add in Segment 1.4 alongside load-testing.
- **Next segment pointer:** Segment 1.3 — Auth (JWT + refresh + RBAC + tests).

### Reversal / Supersede Log
- **Reversed from Segment 1.1:** `Base.metadata.create_all()` removed from startup. Reason: violates Alembic-only schema discipline. Any references in old code were replaced with the lifespan assertion that `alembic_version` exists.
- **Reversed from Segment 1.1:** `/health` was a static 200. Now returns structured JSON with DB ping. Frontend and any external monitor hitting `/health` must be updated to parse the new shape (currently frontend does not, so no break).

---

## Segment 1.3 — Authentication & Authorization

**Date:** 2026-10-18
**Status:** ✅ COMPLETE — JWT + refresh rotation + RBAC + rate limiting, 95 tests passing

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
- **Next segment pointer:** Segment 1.4 — Waste Categories & Pricing Engine (Dynamic formula calculation, seed data, and category management).



