-- Migration 010: Fix table privileges for service_role
-- ============================================
-- PROBLEM: The service_role cannot UPDATE participants table (and potentially
-- other tables). This happens when tables were created before Supabase's
-- DEFAULT PRIVILEGES were applied, leaving the service_role without
-- INSERT/UPDATE/DELETE grants.
--
-- FIX: Explicitly grant ALL privileges on all public tables to service_role.
-- Also grant SELECT to anon and authenticated for RLS-protected reads.
-- Also set DEFAULT PRIVILEGES for any future tables.
-- ============================================

-- Grant ALL privileges to service_role on all existing public tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Grant SELECT + INSERT + UPDATE + DELETE to anon and authenticated
-- (RLS policies will restrict what they can actually access)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Set default privileges for FUTURE tables created in the public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON ROUTINES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO authenticated;
