-- ============================================
-- RLS Event-Scoping — P3 Security Hardening
-- ============================================
-- HOW IT WORKS:
--   The anon Supabase client sends an x-event-id header on every REST request
--   (set via setEventContext() in src/lib/supabase.ts).
--   RLS policies extract this header and restrict SELECT to matching event_id.
--
--   For Realtime (postgres_changes via WebSocket), there is no PostgREST
--   request context so we fall through to ALLOW — Realtime subscriptions
--   already scope by event_id in their filter clause.
--
--   Detection: current_setting('request.method', true) is non-NULL only
--   inside PostgREST. When NULL, we're in Realtime/replication context.
--
-- IMPORTANT: Run the 002_performance_indexes.sql migration BEFORE this one.
-- ============================================

-- Helper: safely extract event_id from PostgREST request headers
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

-- Helper: true when running inside PostgREST (REST query), false for Realtime
CREATE OR REPLACE FUNCTION public.is_postgrest_context()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.method', true) IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Drop old permissive policies ────────────────────────────────

DROP POLICY IF EXISTS "participants_select" ON participants;
DROP POLICY IF EXISTS "photos_select" ON participant_photos;
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "likes_select" ON likes;
DROP POLICY IF EXISTS "blocks_select" ON blocks;
DROP POLICY IF EXISTS "notifications_select" ON notifications;

-- ── New event-scoped policies ───────────────────────────────────
-- PostgREST: enforce event_id = header value
-- Realtime:  allow (subscription filter handles scoping)

CREATE POLICY "participants_select" ON participants FOR SELECT
  USING (
    NOT public.is_postgrest_context()
    OR event_id = public.get_request_event_id()
  );

CREATE POLICY "photos_select" ON participant_photos FOR SELECT
  USING (
    NOT public.is_postgrest_context()
    OR event_id = public.get_request_event_id()
  );

CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (
    NOT public.is_postgrest_context()
    OR event_id = public.get_request_event_id()
  );

CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (
    NOT public.is_postgrest_context()
    OR event_id = public.get_request_event_id()
  );

CREATE POLICY "likes_select" ON likes FOR SELECT
  USING (
    NOT public.is_postgrest_context()
    OR event_id = public.get_request_event_id()
  );

CREATE POLICY "blocks_select" ON blocks FOR SELECT
  USING (
    NOT public.is_postgrest_context()
    OR event_id = public.get_request_event_id()
  );

CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (
    NOT public.is_postgrest_context()
    OR event_id = public.get_request_event_id()
  );

-- events: keep open (lookup by slug before event_id is known)
-- No change needed — original "events_select" USING(true) stays.
