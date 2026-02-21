-- Migration 011: Fix PostgREST schema cache + add write RLS policies
-- ============================================
-- PROBLEM: Migration 010 granted ALL privileges to service_role, but
-- PostgREST caches its schema (including privilege info) and still
-- thinks service_role cannot UPDATE. Also, there are ZERO INSERT/UPDATE/DELETE
-- RLS policies — only SELECT policies exist.
--
-- FIX:
--   1. Re-apply GRANT ALL (idempotent, ensures grants are in place)
--   2. Add INSERT/UPDATE/DELETE RLS policies for service_role
--   3. Notify PostgREST to reload its schema cache
-- ============================================


-- ══════════════════════════════════════════════════════════════
-- 1. RE-APPLY GRANTS (idempotent)
-- ══════════════════════════════════════════════════════════════

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- 2. ADD WRITE RLS POLICIES (service_role targeted)
--    These ensure the service_role can INSERT/UPDATE/DELETE
--    even if BYPASSRLS is somehow not in effect.
-- ══════════════════════════════════════════════════════════════

-- participants
DO $$ BEGIN
  CREATE POLICY "service_role_insert_participants" ON participants
    FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_update_participants" ON participants
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_delete_participants" ON participants
    FOR DELETE TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- participant_photos
DO $$ BEGIN
  CREATE POLICY "service_role_insert_photos" ON participant_photos
    FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_update_photos" ON participant_photos
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_delete_photos" ON participant_photos
    FOR DELETE TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- conversations
DO $$ BEGIN
  CREATE POLICY "service_role_insert_conversations" ON conversations
    FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_update_conversations" ON conversations
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_delete_conversations" ON conversations
    FOR DELETE TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- messages
DO $$ BEGIN
  CREATE POLICY "service_role_insert_messages" ON messages
    FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_update_messages" ON messages
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_delete_messages" ON messages
    FOR DELETE TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- likes
DO $$ BEGIN
  CREATE POLICY "service_role_insert_likes" ON likes
    FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_update_likes" ON likes
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_delete_likes" ON likes
    FOR DELETE TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- blocks
DO $$ BEGIN
  CREATE POLICY "service_role_insert_blocks" ON blocks
    FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_delete_blocks" ON blocks
    FOR DELETE TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- notifications
DO $$ BEGIN
  CREATE POLICY "service_role_insert_notifications" ON notifications
    FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_delete_notifications" ON notifications
    FOR DELETE TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- activity_log
DO $$ BEGIN
  CREATE POLICY "service_role_insert_activity_log" ON activity_log
    FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_delete_activity_log" ON activity_log
    FOR DELETE TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- events
DO $$ BEGIN
  CREATE POLICY "service_role_insert_events" ON events
    FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_update_events" ON events
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_delete_events" ON events
    FOR DELETE TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- banned_devices
DO $$ BEGIN
  CREATE POLICY "service_role_all_banned_devices" ON banned_devices
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- event_analytics_snapshots
DO $$ BEGIN
  CREATE POLICY "service_role_all_analytics" ON event_analytics_snapshots
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- push_subscriptions
DO $$ BEGIN
  CREATE POLICY "service_role_all_push_subs" ON push_subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 3. FORCE PostgREST TO RELOAD SCHEMA CACHE
--    This makes PostgREST pick up the new GRANT privileges.
--    Without this, PostgREST rejects operations based on stale cache.
-- ══════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
