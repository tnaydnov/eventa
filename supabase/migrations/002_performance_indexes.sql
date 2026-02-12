-- ============================================
-- Performance Indexes — Added for P2 optimization
-- ============================================

-- Chat list: conversations sorted by last_message_at DESC per event
-- Speeds up: getConversations() ORDER BY last_message_at DESC
CREATE INDEX IF NOT EXISTS idx_conversations_event_last_msg
  ON conversations(event_id, last_message_at DESC);

-- Grid: participants filtered by event + not banned
-- Speeds up: getGridParticipants() WHERE event_id = X AND is_banned = false
CREATE INDEX IF NOT EXISTS idx_participants_event_active
  ON participants(event_id, is_banned) WHERE is_banned = false;

-- Messages: explicit DESC order for keyset pagination
-- Speeds up: getMessagesBefore() WHERE conversation_id = X AND created_at < cursor ORDER BY created_at DESC
-- (existing idx_messages_conversation is ASC — backward scan works but explicit DESC is optimal)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_desc
  ON messages(conversation_id, created_at DESC);

-- Blocks: composite indexes with event_id for scoped lookups
-- Speeds up: getBlockedIds() WHERE event_id = X AND (blocker_id = Y OR blocked_id = Y)
CREATE INDEX IF NOT EXISTS idx_blocks_event_blocker
  ON blocks(event_id, blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_event_blocked
  ON blocks(event_id, blocked_id);

-- Compass: session lookups by participant
-- Speeds up: compass request queries WHERE participant_a_id = X OR participant_b_id = X
CREATE INDEX IF NOT EXISTS idx_compass_sessions_a
  ON compass_sessions(participant_a_id, status);
CREATE INDEX IF NOT EXISTS idx_compass_sessions_b
  ON compass_sessions(participant_b_id, status);

-- Notifications: unread per participant (for badge counts)
CREATE INDEX IF NOT EXISTS idx_notifications_participant_unread
  ON notifications(to_participant_id, created_at DESC) WHERE is_read = false;
