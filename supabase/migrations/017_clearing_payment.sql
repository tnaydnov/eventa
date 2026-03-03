-- ============================================
-- Migration 017: Clearing Payment Integration
-- Adds Invoice4U Clearing API fields for card
-- tokenization + deferred charging flow.
-- ============================================

-- 1. Extend payment_status CHECK to include new flow states
--    Drop the inline check added in migration 012
ALTER TABLE event_requests
  DROP CONSTRAINT IF EXISTS event_requests_payment_status_check;

ALTER TABLE event_requests
  ADD CONSTRAINT event_requests_payment_status_check
    CHECK (payment_status IN (
      'not_applicable',
      'pending_payment',
      'payment_link_sent',
      'awaiting_payment',   -- order submitted, user navigating to payment iframe
      'card_captured',      -- card tokenised but NOT charged yet (awaiting admin approval)
      'paid',
      'waived',
      'expired',
      'charge_failed'       -- admin tried to charge but clearing failed
    ));

-- 2. Extend payment_method CHECK to include 'credit_card'
ALTER TABLE event_requests
  DROP CONSTRAINT IF EXISTS event_requests_payment_method_check;

ALTER TABLE event_requests
  ADD CONSTRAINT event_requests_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN (
      'bit', 'paybox', 'cash', 'bank_transfer', 'credit_card', 'other'
    ));

-- 3. Relax paid_at consistency constraint
--    (paid_at may be NULL even for non-paid statuses - no change needed,
--     but the original constraint forced paid_at IS NULL for non-paid.
--     We keep that but must recreate it so it compiles with new status values.)
ALTER TABLE event_requests
  DROP CONSTRAINT IF EXISTS chk_paid_at_consistency;

ALTER TABLE event_requests
  ADD CONSTRAINT chk_paid_at_consistency
    CHECK (
      (payment_status = 'paid' AND paid_at IS NOT NULL)
      OR (payment_status != 'paid')
    );

-- 4. Relax payment_method consistency - allow NULL for non-paid statuses
ALTER TABLE event_requests
  DROP CONSTRAINT IF EXISTS chk_payment_method_consistency;

-- (no replacement - payment_method is already nullable and the check above covers it)

-- 5. Extend contact_preference CHECK to include 'pay-now'
ALTER TABLE event_requests
  DROP CONSTRAINT IF EXISTS event_requests_contact_preference_check;

ALTER TABLE event_requests
  ADD CONSTRAINT event_requests_contact_preference_check
    CHECK (contact_preference IN ('call-me', 'send-link', 'pay-now'));

-- 6. Add Invoice4U Clearing-specific columns
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS clearing_log_id       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clearing_payment_id   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clearing_trace_id     TEXT DEFAULT NULL;

-- 6. Index for looking up requests by clearing_payment_id
CREATE INDEX IF NOT EXISTS idx_event_requests_clearing_payment
  ON event_requests (clearing_payment_id)
  WHERE clearing_payment_id IS NOT NULL;
