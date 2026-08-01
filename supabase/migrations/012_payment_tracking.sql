-- Migration 012: Payment tracking columns on event_requests
-- Adds payment lifecycle fields per design doc §27.7

-- Payment status enum values: not_applicable, pending_payment, payment_link_sent,
--                              paid, waived, expired
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (payment_status IN (
      'not_applicable', 'pending_payment', 'payment_link_sent',
      'paid', 'waived', 'expired'
    )),
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL
    CHECK (payment_method IS NULL OR payment_method IN (
      'bit', 'paybox', 'cash', 'bank_transfer', 'other'
    )),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_price INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_link_token TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_link_expires_at TIMESTAMPTZ DEFAULT NULL;

-- Unique partial index on payment_link_token (only non-null tokens)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_requests_payment_link_token
  ON event_requests (payment_link_token)
  WHERE payment_link_token IS NOT NULL;

-- Check: paid_at set only when status is 'paid'
ALTER TABLE event_requests
  ADD CONSTRAINT chk_paid_at_consistency
    CHECK (
      (payment_status = 'paid' AND paid_at IS NOT NULL)
      OR (payment_status != 'paid' AND paid_at IS NULL)
    );

-- Check: payment_method set only when status is 'paid'
ALTER TABLE event_requests
  ADD CONSTRAINT chk_payment_method_consistency
    CHECK (
      (payment_status = 'paid' AND payment_method IS NOT NULL)
      OR (payment_status != 'paid' AND payment_method IS NULL)
    );
