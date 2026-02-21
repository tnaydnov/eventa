import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

/**
 * GET /api/health/db-diag
 * Diagnostic endpoint to debug PostgREST UPDATE permission issues.
 * Returns detailed info about the service role's privileges.
 * TEMPORARY — remove after debugging.
 */
export async function GET() {
  const results: Record<string, unknown> = {};
  const sb = getServiceClient();

  // 1. Test SELECT on participants (should always work)
  try {
    const { data, error } = await sb
      .from('participants')
      .select('id')
      .limit(1);
    results.select_participants = error
      ? { ok: false, error: error.message, code: error.code, hint: error.hint, details: error.details }
      : { ok: true, count: data?.length ?? 0 };
  } catch (e) {
    results.select_participants = { ok: false, exception: String(e) };
  }

  // 2. Test UPDATE on participants (this is what's failing)
  // We'll try a no-op update on a non-existent ID to see if the OPERATION is allowed
  try {
    const { data, error } = await sb
      .from('participants')
      .update({ display_name: 'diag-test' })
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    results.update_participants = error
      ? { ok: false, error: error.message, code: error.code, hint: error.hint, details: error.details }
      : { ok: true, matched: data?.length ?? 0 };
  } catch (e) {
    results.update_participants = { ok: false, exception: String(e) };
  }

  // 3. Test INSERT on participants (to compare)
  // We don't actually insert — we'll use a transaction trick
  // Instead, just test if the operation type is allowed by trying an upsert with impossible data
  try {
    const { error } = await sb
      .from('participants')
      .insert({ id: '00000000-0000-0000-0000-000000000000', event_id: '00000000-0000-0000-0000-000000000000', display_name: 'diag' })
      .select();
    // This WILL fail because event_id FK doesn't exist, but the error tells us if INSERT is allowed
    results.insert_participants = error
      ? { ok: false, error: error.message, code: error.code, hint: error.hint, details: error.details }
      : { ok: true };
  } catch (e) {
    results.insert_participants = { ok: false, exception: String(e) };
  }

  // 4. Test DELETE on participants
  try {
    const { data, error } = await sb
      .from('participants')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    results.delete_participants = error
      ? { ok: false, error: error.message, code: error.code, hint: error.hint, details: error.details }
      : { ok: true, matched: data?.length ?? 0 };
  } catch (e) {
    results.delete_participants = { ok: false, exception: String(e) };
  }

  // 5. Check the service role key's JWT claims
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    // Decode JWT payload (base64url)
    const parts = serviceKey.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      results.jwt_role = payload.role;
      results.jwt_iss = payload.iss;
      // Don't expose the full JWT
    } else {
      results.jwt_role = 'INVALID_JWT_FORMAT';
    }
  } catch (e) {
    results.jwt_role = `ERROR: ${String(e)}`;
  }

  // 6. Try a raw RPC call (to test if RPC works at all)
  try {
    const { data, error } = await sb.rpc('service_update', {
      p_table_name: 'participants',
      p_set_data: { display_name: 'diag-test' },
      p_where_conditions: { id: '00000000-0000-0000-0000-000000000000' },
    });
    results.rpc_service_update = error
      ? { ok: false, error: error.message, code: error.code, hint: error.hint, details: error.details }
      : { ok: true, matched: Array.isArray(data) ? data.length : 0 };
  } catch (e) {
    results.rpc_service_update = { ok: false, exception: String(e) };
  }

  // 7. Check if UPDATE works on other tables (events)
  try {
    const { data, error } = await sb
      .from('events')
      .update({ name: 'diag-test' })
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    results.update_events = error
      ? { ok: false, error: error.message, code: error.code, hint: error.hint, details: error.details }
      : { ok: true, matched: data?.length ?? 0 };
  } catch (e) {
    results.update_events = { ok: false, exception: String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
