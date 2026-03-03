-- ============================================
-- Migration 016: Invoice Tracking
-- Adds Invoice4U document tracking to event_requests
-- and creates a dedicated invoices table for full history.
-- ============================================

-- Add Invoice4U tracking columns to event_requests
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS invoice4u_customer_id INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice4u_doc_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice4u_doc_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice4u_doc_type INTEGER DEFAULT NULL;

-- Index for looking up requests by Invoice4U document
CREATE INDEX IF NOT EXISTS idx_event_requests_invoice4u_doc
  ON event_requests (invoice4u_doc_id)
  WHERE invoice4u_doc_id IS NOT NULL;

-- Dedicated invoices table for full document history
-- (a single request may have multiple documents: invoice, receipt, credit note)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to event_request (nullable - some docs may be standalone)
  event_request_id UUID REFERENCES event_requests(id) ON DELETE SET NULL,

  -- Invoice4U fields
  invoice4u_doc_id TEXT NOT NULL,         -- Invoice4U's internal document ID
  invoice4u_doc_number TEXT,              -- Human-readable document number
  invoice4u_doc_type INTEGER NOT NULL,    -- DocumentType enum (1=Invoice, 2=Receipt, 3=InvoiceReceipt, etc.)
  invoice4u_customer_id INTEGER,          -- Invoice4U customer ID
  invoice4u_doc_url TEXT,                 -- Direct URL to view/download the document

  -- Document details (cached locally for quick display)
  doc_type_label TEXT NOT NULL,           -- Hebrew label: 'חשבונית', 'קבלה', etc.
  customer_name TEXT,
  customer_email TEXT,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ILS',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled')),

  -- Metadata
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- If this is a credit note, link to the original document
  original_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_request ON invoices(event_request_id);
CREATE INDEX IF NOT EXISTS idx_invoices_doc_id ON invoices(invoice4u_doc_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);

-- RLS: admin-only access (service_role bypasses, no public access)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- No public policies = only service_role can access
