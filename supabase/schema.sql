-- ============================================
-- Eventa - Full Database Schema
-- Execute this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================
DO $$ BEGIN
  CREATE TYPE gender AS ENUM ('male', 'female', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE attracted_to AS ENUM ('men', 'women', 'all');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'image', 'system');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('like_received', 'new_message');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLES
-- ============================================

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qr_page_sent BOOLEAN NOT NULL DEFAULT false
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

CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_participants_fingerprint ON participants(event_id, device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_participants_hw_fingerprint ON participants(event_id, hardware_fingerprint) WHERE hardware_fingerprint IS NOT NULL;

-- Participant Photos
CREATE TABLE IF NOT EXISTS participant_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_participant ON participant_photos(participant_id);

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

CREATE INDEX IF NOT EXISTS idx_conversations_event ON conversations(event_id);
CREATE INDEX IF NOT EXISTS idx_conversations_a ON conversations(a_participant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_b ON conversations(b_participant_id);

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

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_event ON messages(event_id);

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

CREATE INDEX IF NOT EXISTS idx_likes_to ON likes(event_id, to_participant_id);
CREATE INDEX IF NOT EXISTS idx_likes_from ON likes(event_id, from_participant_id);

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

CREATE INDEX IF NOT EXISTS idx_blocks_event ON blocks(event_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

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

CREATE INDEX IF NOT EXISTS idx_notifications_to ON notifications(to_participant_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

-- Banned Devices
CREATE TABLE IF NOT EXISTS banned_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_banned_devices_event ON banned_devices(event_id, device_fingerprint);

-- Activity Log (for usage timeline analytics)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_event_time ON activity_log(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_participant ON activity_log(participant_id);

-- Event Analytics Snapshots (preserved after archiving)
CREATE TABLE IF NOT EXISTS event_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

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

-- STRATEGY:
--   SELECT: allowed for anon (data is scoped by client queries)
--   INSERT/UPDATE/DELETE: denied for anon (no policy = deny by default)
--   service_role key bypasses RLS entirely (used by API routes)

-- Events: read-only for anon (admin writes via service_role)
CREATE POLICY "events_select" ON events FOR SELECT USING (true);

-- Participants: read-only for anon
CREATE POLICY "participants_select" ON participants FOR SELECT USING (true);

-- Photos: read-only for anon
CREATE POLICY "photos_select" ON participant_photos FOR SELECT USING (true);

-- Conversations: read-only for anon
CREATE POLICY "conversations_select" ON conversations FOR SELECT USING (true);

-- Messages: read-only for anon
CREATE POLICY "messages_select" ON messages FOR SELECT USING (true);

-- Likes: read-only for anon
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);

-- Blocks: read-only for anon
CREATE POLICY "blocks_select" ON blocks FOR SELECT USING (true);

-- Notifications: read-only for anon
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (true);

-- Banned Devices: no anon access (service_role only)
-- No SELECT policy = denied for anon

-- ============================================
-- STORAGE
-- ============================================
-- Run these in Supabase Dashboard → Storage:
-- 1. Create bucket 'photos' (public)
-- 2. Add policy: allow all uploads for anon users
-- 
-- Or via SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('backgrounds', 'backgrounds', true);

-- ============================================
-- REALTIME
-- ============================================
-- Enable realtime for key tables
-- Run in Supabase Dashboard → Database → Replication:
-- Enable messages, likes, blocks, conversations, notifications

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;
ALTER PUBLICATION supabase_realtime ADD TABLE blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
