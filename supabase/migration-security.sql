-- ============================================
-- Migration: Production Security Hardening
-- Run this against the live/dev Supabase database
-- ============================================

-- 1. Add missing indexes
CREATE INDEX IF NOT EXISTS idx_messages_event ON messages(event_id);
CREATE INDEX IF NOT EXISTS idx_compass_locations_participant ON compass_locations(participant_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

-- 2. Drop old wide-open RLS policies
DROP POLICY IF EXISTS "events_read" ON events;
DROP POLICY IF EXISTS "events_insert" ON events;
DROP POLICY IF EXISTS "events_update" ON events;
DROP POLICY IF EXISTS "events_delete" ON events;
DROP POLICY IF EXISTS "participants_all" ON participants;
DROP POLICY IF EXISTS "photos_all" ON participant_photos;
DROP POLICY IF EXISTS "conversations_all" ON conversations;
DROP POLICY IF EXISTS "messages_all" ON messages;
DROP POLICY IF EXISTS "likes_all" ON likes;
DROP POLICY IF EXISTS "blocks_all" ON blocks;
DROP POLICY IF EXISTS "notifications_all" ON notifications;
DROP POLICY IF EXISTS "compass_sessions_all" ON compass_sessions;
DROP POLICY IF EXISTS "compass_locations_all" ON compass_locations;

-- 3. Create new read-only policies for anon
-- Writes are denied by default (no INSERT/UPDATE/DELETE policy = deny)
-- service_role key used by API routes bypasses RLS entirely

CREATE POLICY "events_select" ON events FOR SELECT USING (true);
CREATE POLICY "participants_select" ON participants FOR SELECT USING (true);
CREATE POLICY "photos_select" ON participant_photos FOR SELECT USING (true);
CREATE POLICY "conversations_select" ON conversations FOR SELECT USING (true);
CREATE POLICY "messages_select" ON messages FOR SELECT USING (true);
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
CREATE POLICY "blocks_select" ON blocks FOR SELECT USING (true);
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (true);
CREATE POLICY "compass_sessions_select" ON compass_sessions FOR SELECT USING (true);
CREATE POLICY "compass_locations_select" ON compass_locations FOR SELECT USING (true);

-- 4. Set REPLICA IDENTITY FULL for realtime (if not already done)
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE likes REPLICA IDENTITY FULL;
ALTER TABLE blocks REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE compass_locations REPLICA IDENTITY FULL;
ALTER TABLE compass_sessions REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
