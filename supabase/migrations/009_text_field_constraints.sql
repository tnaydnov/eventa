-- Migration 009: Text field length CHECK constraints (defense-in-depth)
--
-- Zod validates on the server, but a compromised service_role key or
-- direct SQL access could bypass application-layer validation.
-- These DB-level constraints enforce the same limits as constants.ts:
--   MAX_NAME_LENGTH = 30, MAX_BIO_LENGTH = 200,
--   MAX_CITY_LENGTH = 50, MAX_MESSAGE_LENGTH = 2000
--
-- Also adds basic range checks for numeric fields (age, order_index).
-- All constraints are idempotent (wrapped in exception handlers).

-- ═══════════════════════════════════════════════
-- 1. Participants text & numeric field limits
-- ═══════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════
-- 2. Messages text length limit
-- ═══════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT chk_message_text_length
    CHECK (text IS NULL OR char_length(text) <= 2000);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ═══════════════════════════════════════════════
-- 3. Events text field limits
-- ═══════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════
-- 4. Photo order_index range
-- ═══════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE participant_photos ADD CONSTRAINT chk_order_index_range
    CHECK (order_index >= 0 AND order_index <= 20);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

