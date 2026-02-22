-- Migration 010: Fix REPLICA IDENTITY conflict with publication column lists
-- ============================================================================
-- ROOT CAUSE: Migration 008 added column lists to the supabase_realtime
-- publication for participants and events (to exclude fingerprints/join_code).
-- But these tables had REPLICA IDENTITY FULL, which requires the publication
-- to include ALL columns. PostgreSQL error 42P10:
--   "Column list used by the publication does not cover the replica identity."
--
-- This blocked ALL UPDATE and DELETE operations on participants and events -
-- even for service_role - because PostgreSQL checks publication compatibility
-- before allowing DML when logical replication is configured.
--
-- FIX: Change REPLICA IDENTITY to DEFAULT (primary key only) on these two
-- tables. The publication column lists already include the `id` primary key,
-- so they cover the DEFAULT replica identity. All other tables keep FULL
-- because they are published without column lists.
-- ============================================================================

-- participants: column-list publication → needs DEFAULT replica identity
ALTER TABLE participants REPLICA IDENTITY DEFAULT;

-- events: column-list publication → needs DEFAULT replica identity
ALTER TABLE events REPLICA IDENTITY DEFAULT;
