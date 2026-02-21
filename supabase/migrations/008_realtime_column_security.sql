-- Migration 008: Restrict Realtime publication columns for privacy
--
-- PROBLEM: With REPLICA IDENTITY FULL, Supabase Realtime sends ALL columns
-- in change payloads to every subscribed client. This leaks:
--   - participants.device_fingerprint, participants.hardware_fingerprint
--   - events.join_code (the secret code users need to join)
--
-- FIX: Use PostgreSQL 15+ column lists on the publication so that
-- only safe columns are included in realtime change events.
-- This is transparent to the client — the Realtime API still delivers
-- INSERT/UPDATE/DELETE events, just without the excluded columns.
--
-- IMPORTANT: This does NOT affect service_role queries, RLS, or
-- direct SELECT queries. Only the Realtime WebSocket payloads.

-- ═══════════════════════════════════════════════
-- 1. Restrict participants columns (exclude fingerprints)
-- ═══════════════════════════════════════════════

-- Remove and re-add with explicit column list
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS participants;
ALTER PUBLICATION supabase_realtime ADD TABLE participants (
  id, event_id, display_name, gender, attracted_to, bio, age, city,
  looking_for, is_banned, last_seen_at, created_at
);
-- Excluded: device_fingerprint, hardware_fingerprint

-- ═══════════════════════════════════════════════
-- 2. Restrict events columns (exclude join_code)
-- ═══════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS events;
ALTER PUBLICATION supabase_realtime ADD TABLE events (
  id, slug, name, event_type, status, description, starts_at, ends_at,
  is_active, background_image, archived_at, created_at
);
-- Excluded: join_code

