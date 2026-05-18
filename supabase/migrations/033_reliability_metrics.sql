-- Migration: 033_reliability_metrics.sql
-- Stores runtime reliability signals (realtime disconnects, delivery path ratio).

CREATE TABLE IF NOT EXISTS event_reliability_metrics (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        REFERENCES events(id) ON DELETE CASCADE,
  metric_type text        NOT NULL,
  source      text,
  value       float8,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_reliability_created
  ON event_reliability_metrics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_reliability_event
  ON event_reliability_metrics(event_id, created_at DESC)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_reliability_type
  ON event_reliability_metrics(metric_type, created_at DESC);

ALTER TABLE event_reliability_metrics ENABLE ROW LEVEL SECURITY;
