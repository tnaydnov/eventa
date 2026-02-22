-- ============================================
-- Migration 008: Event Requests Table
-- Stores wizard order submissions for admin approval.
-- ============================================

CREATE TABLE IF NOT EXISTS event_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Status: pending → approved / denied
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),

  -- Event type key (wedding, party, corporate, etc.)
  event_type TEXT NOT NULL,

  -- Event name (may be empty for some types)
  event_name TEXT NOT NULL DEFAULT '',

  -- Start/end timestamps
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,

  -- Background image (Supabase Storage path, set after approval upload)
  background_base64 TEXT,
  wants_custom_background BOOLEAN NOT NULL DEFAULT false,

  -- Poster choice
  poster_choice TEXT NOT NULL DEFAULT 'qr-only'
    CHECK (poster_choice IN ('template', 'qr-only')),
  selected_template_id TEXT,
  special_requests TEXT,

  -- Guest messages
  wants_guest_messages BOOLEAN NOT NULL DEFAULT false,

  -- Contact info
  contact_preference TEXT NOT NULL DEFAULT 'call-me'
    CHECK (contact_preference IN ('call-me', 'send-link')),
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,

  -- Admin processing
  admin_notes TEXT,
  approved_event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Index for admin listing (pending first, then by date)
CREATE INDEX IF NOT EXISTS idx_event_requests_status ON event_requests(status, created_at DESC);
