-- 041_event_requests_rls.sql
-- Close an RLS coverage gap (SECURITY_HARDENING_PLAN §9).
--
-- `event_requests` (created in 008) was never given RLS. Supabase grants the anon /
-- authenticated roles default access to public tables and relies on RLS to restrict
-- them, so a table with RLS disabled is potentially readable via the anon key + PostgREST.
-- This table holds lead/order PII (contact_name, contact_phone, contact_email,
-- special_requests, payment fields), so that exposure is unacceptable.
--
-- All application access to event_requests is server-side via the service_role key
-- (admin, order, and payment routes), which bypasses RLS. Enabling RLS with NO policies
-- therefore denies anon/authenticated entirely while leaving server routes unaffected.

ALTER TABLE event_requests ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth: also revoke any default table grants from the public-facing roles.
-- (RLS already denies them; this removes the grant as well.)
REVOKE ALL ON event_requests FROM anon, authenticated;

COMMENT ON TABLE event_requests IS
  'Lead/order submissions. Server-only (service_role); RLS enabled with no policies = anon/authenticated denied.';
