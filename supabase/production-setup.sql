-- ============================================
-- Eventa - FULL PRODUCTION SETUP
-- Run this entire file in Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste → Run)
-- ============================================


-- ════════════════════════════════════════════
-- 1. EXTENSIONS
-- ════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ════════════════════════════════════════════
-- 2. ENUMS
-- ════════════════════════════════════════════
DO $$ BEGIN CREATE TYPE gender AS ENUM ('male', 'female', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE attracted_to AS ENUM ('men', 'women', 'all'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE message_type AS ENUM ('text', 'image', 'system'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('like_received', 'new_message'); EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ════════════════════════════════════════════
-- 3. TABLES
-- ════════════════════════════════════════════

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'wedding',
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 day'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  background_image TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participants
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  device_fingerprint TEXT,
  hardware_fingerprint TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  gender gender NOT NULL DEFAULT 'male',
  attracted_to attracted_to NOT NULL DEFAULT 'all',
  bio TEXT,
  age INTEGER,
  city TEXT,
  looking_for TEXT,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participant Photos
CREATE TABLE IF NOT EXISTS participant_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  a_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  b_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT NULL,
  a_last_read_at TIMESTAMPTZ,
  b_last_read_at TIMESTAMPTZ,
  UNIQUE (event_id, a_participant_id, b_participant_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  type message_type NOT NULL DEFAULT 'text',
  text TEXT,
  media_path TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Likes
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  to_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ,
  UNIQUE (event_id, from_participant_id, to_participant_id)
);

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  blocker_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  had_like BOOLEAN NOT NULL DEFAULT false,
  had_conversation BOOLEAN NOT NULL DEFAULT false,
  had_match BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, blocker_id, blocked_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  to_participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

-- Banned Devices
CREATE TABLE IF NOT EXISTS banned_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, device_fingerprint)
);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Analytics Snapshots
CREATE TABLE IF NOT EXISTS event_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);


-- ════════════════════════════════════════════
-- 4. CHECK CONSTRAINTS (idempotent)
-- ════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT chk_event_type
    CHECK (event_type IN ('wedding','party','corporate','meetup','other'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT chk_event_status
    CHECK (status IN ('draft','active','paused','ended','archived'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Text field length constraints (defense-in-depth, matches Zod/constants.ts)
DO $$ BEGIN
  ALTER TABLE participants ADD CONSTRAINT chk_display_name_length
    CHECK (char_length(display_name) <= 30);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE participants ADD CONSTRAINT chk_bio_length
    CHECK (bio IS NULL OR char_length(bio) <= 200);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE participants ADD CONSTRAINT chk_city_length
    CHECK (city IS NULL OR char_length(city) <= 50);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE participants ADD CONSTRAINT chk_age_range
    CHECK (age IS NULL OR (age >= 16 AND age <= 120));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT chk_message_text_length
    CHECK (text IS NULL OR char_length(text) <= 2000);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT chk_event_name_length
    CHECK (char_length(name) <= 100);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT chk_event_slug_length
    CHECK (char_length(slug) <= 100);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT chk_event_description_length
    CHECK (description IS NULL OR char_length(description) <= 500);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE participant_photos ADD CONSTRAINT chk_order_index_range
    CHECK (order_index >= 0 AND order_index <= 20);
EXCEPTION WHEN duplicate_object THEN null;
END $$;


-- ════════════════════════════════════════════
-- 5. INDEXES
-- ════════════════════════════════════════════

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_participants_fingerprint ON participants(event_id, device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_photos_participant ON participant_photos(participant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_event ON conversations(event_id);
CREATE INDEX IF NOT EXISTS idx_conversations_a ON conversations(a_participant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_b ON conversations(b_participant_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_event ON messages(event_id);
CREATE INDEX IF NOT EXISTS idx_likes_to ON likes(event_id, to_participant_id);
CREATE INDEX IF NOT EXISTS idx_likes_from ON likes(event_id, from_participant_id);
CREATE INDEX IF NOT EXISTS idx_blocks_event ON blocks(event_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_notifications_to ON notifications(to_participant_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_banned_devices_event ON banned_devices(event_id, device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_time ON activity_log(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_participant ON activity_log(participant_id);

-- Performance indexes (migration 002)
CREATE INDEX IF NOT EXISTS idx_conversations_event_last_msg ON conversations(event_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_event_active ON participants(event_id, is_banned) WHERE is_banned = false;
CREATE INDEX IF NOT EXISTS idx_messages_conversation_desc ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocks_event_blocker ON blocks(event_id, blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_event_blocked ON blocks(event_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_notifications_participant_unread ON notifications(to_participant_id, created_at DESC) WHERE is_read = false;


-- ════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper functions for event-scoped RLS
CREATE OR REPLACE FUNCTION public.get_request_event_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    current_setting('request.headers', true)::json->>'x-event-id'
  )::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_postgrest_context()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.method', true) IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Events: open select (lookup by slug before event_id is known)
CREATE POLICY "events_select" ON events FOR SELECT USING (true);

-- Event-scoped select policies (PostgREST: enforce event_id header; Realtime: allow)
CREATE POLICY "participants_select" ON participants FOR SELECT
  USING (NOT public.is_postgrest_context() OR event_id = public.get_request_event_id());

CREATE POLICY "photos_select" ON participant_photos FOR SELECT
  USING (NOT public.is_postgrest_context() OR event_id = public.get_request_event_id());

CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (NOT public.is_postgrest_context() OR event_id = public.get_request_event_id());

CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (NOT public.is_postgrest_context() OR event_id = public.get_request_event_id());

CREATE POLICY "likes_select" ON likes FOR SELECT
  USING (NOT public.is_postgrest_context() OR event_id = public.get_request_event_id());

CREATE POLICY "blocks_select" ON blocks FOR SELECT
  USING (NOT public.is_postgrest_context() OR event_id = public.get_request_event_id());

CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (NOT public.is_postgrest_context() OR event_id = public.get_request_event_id());

-- banned_devices, activity_log, event_analytics_snapshots: NO select policy = denied for anon (service_role only)


-- ════════════════════════════════════════════
-- 7. REPLICA IDENTITY (for Realtime)
-- ════════════════════════════════════════════

ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE likes REPLICA IDENTITY FULL;
ALTER TABLE blocks REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
-- participants & events use DEFAULT (not FULL) because section 8 uses
-- column-list publications on them. FULL requires the publication to
-- include ALL columns, which conflicts with the column exclusions.
ALTER TABLE participants REPLICA IDENTITY DEFAULT;
ALTER TABLE events REPLICA IDENTITY DEFAULT;


-- ════════════════════════════════════════════
-- 8. REALTIME PUBLICATION
-- ════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;
ALTER PUBLICATION supabase_realtime ADD TABLE blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- Participants: exclude fingerprint columns from realtime payloads
ALTER PUBLICATION supabase_realtime ADD TABLE participants (
  id, event_id, display_name, gender, attracted_to, bio, age, city,
  looking_for, is_banned, last_seen_at, created_at
);
-- Events: exclude join_code from realtime payloads
ALTER PUBLICATION supabase_realtime ADD TABLE events (
  id, slug, name, event_type, status, description, starts_at, ends_at,
  is_active, background_image, archived_at, created_at
);


-- ════════════════════════════════════════════
-- 9. STORAGE BUCKETS
-- ════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('backgrounds', 'backgrounds', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies:
-- READ: anon can read photos and backgrounds (public buckets, needed for image display)
-- WRITE: all uploads use signed URLs generated by service_role via /api/secure/upload-url
--        all deletes are done server-side with service_role
--        → anon does NOT need INSERT/UPDATE/DELETE access

CREATE POLICY "storage_read" ON storage.objects FOR SELECT
  USING (bucket_id IN ('photos', 'backgrounds'));


-- ════════════════════════════════════════════
-- ✅ DONE! Your production database is ready.
-- ════════════════════════════════════════════
