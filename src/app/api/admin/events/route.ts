import { NextRequest, NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { createEventSchema } from '@/lib/validations';
import { adminAuditLog } from '@/lib/admin-auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient, generateShortCode } from '@/lib/supabase';
import { adminGuard, jsonError } from '../_helpers';
import { logger } from '@/lib/logger';
import { APP_BASE_URL } from '@/lib/config';
import { buildEventCreatedEmail } from '@/lib/email-templates';
import { getMailTransporter, getSmtpFrom } from '@/lib/mailer';
import { isReservedSlug } from '@/lib/slug';
import { phoneWriteFields, encryptPii, computeBlindIndex, decryptEventRow } from '@/lib/pii';

/** Default event duration when no end date is provided (24 hours). */
const DEFAULT_DURATION_MS = 86_400_000;

/** Generate a 4-char random hex suffix for unique slugs. */
function randomSuffix(): string {
  return crypto.randomBytes(2).toString('hex');
}

/**
 * GET /api/admin/events
 * Returns events with optional filtering, sorting, and search.
 *
 * Query params:
 *   status   - filter by status (active | paused | ended | archived | draft)
 *   type     - filter by event_type (wedding | party | ...)
 *   search   - case-insensitive search in name or slug
 *   sort     - sort field (created_at | starts_at | name) - default: created_at
 *   order    - asc | desc - default: desc
 */
export async function GET(req: NextRequest) {
  const denied = adminGuard(req, 'admin-events-get', RATE_LIMITS.standard);
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const search = url.searchParams.get('search');
    const sort = url.searchParams.get('sort') || 'created_at';
    const order = url.searchParams.get('order') || 'desc';

    const supabase = getServiceClient();
    let query = supabase.from('events').select('id, slug, name, event_type, status, description, starts_at, ends_at, is_active, background_image, archived_at, created_at, wa_messages_enabled, guest_list_uploaded, guest_list_uploaded_at, guest_list_count, qr_page_sent, client_name, client_name_enc, client_email, client_email_enc, client_phone, client_phone_enc, communication_preference, send_report_email, payment_status');

    // Status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Event type filter
    if (type) {
      query = query.eq('event_type', type);
    }

    // Search by name or slug (case-insensitive)
    // Strip all chars except alphanumeric, Hebrew, spaces, hyphens (prevents PostgREST filter injection)
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[^a-zA-Z0-9\u0590-\u05ff\s-]/g, '');
      if (escaped) {
        const term = `%${escaped}%`;
        query = query.or(`name.ilike.${term},slug.ilike.${term}`);
      }
    }

    // Sorting - whitelist fields to prevent injection
    const allowedSorts = ['created_at', 'starts_at', 'ends_at', 'name'];
    const sortField = allowedSorts.includes(sort) ? sort : 'created_at';
    query = query.order(sortField, { ascending: order === 'asc' });

    const { data: events, error } = await query;

    if (error) {
      logger.error('[ADMIN_EVENTS_GET] DB error:', error.message);
      return jsonError('Failed to load events', 500);
    }

    // Decrypt PII fields before returning to admin UI
    const decrypted = (events || []).map(decryptEventRow);
    return NextResponse.json({ events: decrypted });
  } catch (err) {
    logger.error('[ADMIN_EVENTS_GET] error:', err);
    return jsonError('Failed to load events', 500);
  }
}

/**
 * POST /api/admin/events
 * Create a new event with Zod-validated input.
 *
 * Slug is auto-generated from the name with a random suffix for uniqueness.
 * The client can override the slug, but if not provided it will be generated.
 * Supports event_type and description fields.
 */
export async function POST(req: NextRequest) {
  const denied = adminGuard(req, 'admin-events-post', RATE_LIMITS.standard);
  if (denied) return denied;

  try {
    const body = await req.json();

    // Auto-generate slug if not provided
    if (!body.slug && body.name) {
      const base = body.name
        .toLowerCase()
        .replace(/[^a-z0-9\u0590-\u05ff]+/g, '-')
        .replace(/[\u0590-\u05ff]+/g, '')  // strip Hebrew chars from slug
        .replace(/^-+|-+$/g, '')           // strip all leading/trailing hyphens
        .replace(/-{2,}/g, '-');
      body.slug = `${base || 'event'}-${randomSuffix()}`;
    }

    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      // Build a human-readable summary of which fields failed
      const fieldLabels: Record<string, string> = {
        name: 'שם אירוע',
        slug: 'כתובת',
        event_type: 'סוג אירוע',
        starts_at: 'תחילת אירוע',
        ends_at: 'סיום אירוע',
        client_name: 'שם לקוח',
        client_email: 'אימייל',
        client_phone: 'טלפון',
        communication_preference: 'העדפת תקשורת',
      };
      const summary = Object.entries(fieldErrors)
        .filter(([, msgs]) => msgs?.length)
        .map(([f, msgs]) => `${fieldLabels[f] ?? f}: ${msgs![0]}`)
        .join('; ');
      logger.warn('[ADMIN_EVENTS_POST] Validation failed', { fields: Object.keys(fieldErrors) });
      return NextResponse.json(
        { error: summary || 'Invalid input', details: fieldErrors },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Reject reserved slugs
    if (isReservedSlug(parsed.data.slug)) {
      return NextResponse.json(
        { error: 'כתובת זו שמורה למערכת ולא ניתן להשתמש בה', details: { slug: ['Reserved slug'] } },
        { status: 400 }
      );
    }

    // Ensure slug uniqueness - if collision, append extra suffix
    let slug = parsed.data.slug;
    const { data: existing, error: slugErr } = await supabase
      .from('events')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (slugErr) {
      logger.error('[ADMIN_EVENTS_POST] slug check error:', slugErr.message);
      return jsonError('Failed to create event', 500);
    }

    if (existing) {
      slug = `${slug}-${randomSuffix()}`;
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        name: parsed.data.name,
        slug,
        event_type: parsed.data.event_type || 'wedding',
        status: 'active',
        description: parsed.data.description || null,
        starts_at: parsed.data.starts_at || new Date().toISOString(),
        ends_at: parsed.data.ends_at || new Date(Date.now() + DEFAULT_DURATION_MS).toISOString(),
        is_active: true,
        wa_messages_enabled: parsed.data.wa_messages_enabled || false,
        client_name: parsed.data.client_name || null,
        client_name_enc: encryptPii(parsed.data.client_name || null),
        client_email: parsed.data.client_email || null,
        client_email_enc: encryptPii(parsed.data.client_email || null),
        client_email_bi: computeBlindIndex(parsed.data.client_email || null),
        client_phone: parsed.data.client_phone || null,
        client_phone_enc: encryptPii(parsed.data.client_phone || null),
        client_phone_bi: computeBlindIndex(parsed.data.client_phone || null),
        communication_preference: parsed.data.communication_preference || 'email',
        send_report_email: parsed.data.send_report_email ?? true,
      })
      .select()
      .single();

    if (error) {
      logger.error('[ADMIN_EVENTS_POST] DB error:', error.message);
      return jsonError('Failed to create event', 500);
    }

    adminAuditLog('EVENT_CREATE', { eventId: data.id, slug, eventType: parsed.data.event_type }, req);

    // ── Auto-setup for messaging addon ──
    let portalUrl: string | undefined;
    if (data.wa_messages_enabled) {
      try {
        const portalToken = generateShortCode(6);
        await supabase
          .from('client_portal_tokens')
          .insert({ event_id: data.id, token: portalToken, is_active: true });

        portalUrl = `${APP_BASE_URL}/portal/${portalToken}`;
        logger.info('[ADMIN_EVENTS_POST] Auto-created portal token', { eventId: data.id });
      } catch (portalErr) {
        logger.warn('[ADMIN_EVENTS_POST] Failed to auto-create portal token:', portalErr);
      }
    }

    // ── Defer email sending to run AFTER the response is returned ──
    after(async () => {
      if (!data.client_email) return;
      try {
        const eventUrl = `${APP_BASE_URL}/${data.slug}`;

        const email = buildEventCreatedEmail({
          contactName: data.client_name || '',
          eventName: data.name,
          eventType: data.event_type || 'wedding',
          startsAt: data.starts_at,
          endsAt: data.ends_at,
          wantsGuestMessages: data.wa_messages_enabled || false,
          eventUrl,
          portalUrl,
        });

        await getMailTransporter().sendMail({
          from: getSmtpFrom(),
          to: data.client_email,
          subject: email.subject,
          html: email.html,
        });

        // Log to message_log
        const bgSupabase = getServiceClient();
        await bgSupabase.from('message_log').insert({
          event_id: data.id,
          channel: 'email',
          message_type: 'event_created',
          recipient_email: data.client_email,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });

        logger.info('[ADMIN_EVENTS_POST] Sent event-created email (C4b)', {
          eventId: data.id,
        });
      } catch (emailErr) {
        logger.warn('[ADMIN_EVENTS_POST] Failed to send event-created email:', emailErr);
      }
    });

    return NextResponse.json({ event: data });
  } catch (err) {
    logger.error('[ADMIN_EVENTS_POST] error:', err);
    return jsonError('Server error', 500);
  }
}
