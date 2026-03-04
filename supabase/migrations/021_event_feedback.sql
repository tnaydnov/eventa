-- ═══════════════════════════════════════════
-- Migration 021: Event Feedback (anonymous post-event survey)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_feedback (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Step 1: Enjoyment (1-4)
  enjoyment     SMALLINT NOT NULL CHECK (enjoyment BETWEEN 1 AND 4),

  -- Step 2: Ease of use (1-4)
  ease_of_use   SMALLINT NOT NULL CHECK (ease_of_use BETWEEN 1 AND 4),

  -- Step 3: Usage level
  usage_level   TEXT NOT NULL CHECK (usage_level IN ('view_only', 'likes', 'matches', 'chat')),

  -- Step 4: Interaction result
  interaction_result TEXT NOT NULL CHECK (interaction_result IN ('messages', 'real_life', 'interesting', 'none')),

  -- Step 5: Favorite features (array of text)
  favorite_features TEXT[] NOT NULL DEFAULT '{}',

  -- Step 6: Improvement suggestion (optional, max 500 chars)
  improvement_text TEXT CHECK (improvement_text IS NULL OR char_length(improvement_text) <= 500),

  -- Step 7: Recommendation (1-4)
  recommendation SMALLINT NOT NULL CHECK (recommendation BETWEEN 1 AND 4),

  -- Step 8: Success story
  success_story      TEXT CHECK (success_story IN ('yes', 'maybe', 'no')),
  success_story_text TEXT CHECK (success_story_text IS NULL OR char_length(success_story_text) <= 500),
  allow_story_publish BOOLEAN NOT NULL DEFAULT false
);

-- Index for aggregation queries per event
CREATE INDEX IF NOT EXISTS idx_event_feedback_event_id ON event_feedback(event_id);

-- RLS: insert-only, no read access for anonymous users
ALTER TABLE event_feedback ENABLE ROW LEVEL SECURITY;

-- Allow inserts from any authenticated or anon connection (anonymous survey)
CREATE POLICY event_feedback_insert ON event_feedback
  FOR INSERT WITH CHECK (true);

-- No SELECT/UPDATE/DELETE for regular users - admin only via service role
