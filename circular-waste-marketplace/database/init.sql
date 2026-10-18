-- =============================================================================
-- Circular Waste Marketplace — Database Initialization Script
-- =============================================================================
-- This script runs once when the PostgreSQL container is first created.
-- It enables required extensions and sets up performance settings.
-- Alembic handles schema creation — this file only configures extensions.
-- =============================================================================

-- Enable PostGIS for geospatial queries (pickup location queries, radius search)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable UUID generation (UUIDs generated in Python but this is a safety net)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fast ILIKE full-text search on listing titles
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable btree_gist for exclusion constraints on time ranges
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Performance settings for OLTP workload
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = '100';
ALTER SYSTEM SET random_page_cost = '1.1';  -- SSD-optimized

SELECT pg_reload_conf();

-- Create application user (matches docker-compose environment)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cwm') THEN
        -- The superuser creates the cwm role only in local dev
        -- In production, IAM-managed service account is used
        RAISE NOTICE 'Role cwm already exists (created by POSTGRES_USER env var)';
    END IF;
END $$;
