-- Add payment_status to events for tracking whether the event was paid for.
-- Values: 'unpaid' (default), 'paid', 'waived'
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

ALTER TABLE events
  ADD CONSTRAINT chk_event_payment_status
  CHECK (payment_status IN ('unpaid', 'paid', 'waived'));

-- Back-fill: events created via the payment callback have an associated
-- paid event_request. Mark those events as 'paid'.
UPDATE events e
SET payment_status = 'paid'
FROM event_requests r
WHERE r.approved_event_id = e.id
  AND r.payment_status = 'paid';
