import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { generateGuestTemplate } from '@/lib/guest-upload';

/**
 * GET /api/guest-portal/[token]/download-template
 * Download the guest upload Excel template (.xlsx).
 * Auth: token-based (same as portal).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Rate limit by token
  const rl = checkRateLimit(`portal-download:${token}`, RATE_LIMITS.upload);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const supabase = getServiceClient();

    // Validate token
    const { data, error } = await supabase
      .from('client_portal_tokens')
      .select('id, event_id, is_active')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        { status: 401 }
      );
    }

    // Update last_used_at
    await supabase
      .from('client_portal_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);

    // Check event hasn't started yet
    const { data: event } = await supabase
      .from('events')
      .select('id, status, starts_at')
      .eq('id', data.event_id)
      .maybeSingle();

    if (!event || event.status === 'archived') {
      return NextResponse.json({ error: 'האירוע הסתיים' }, { status: 400 });
    }

    if (event.starts_at && new Date(event.starts_at) <= new Date()) {
      return NextResponse.json({ error: 'האירוע כבר התחיל' }, { status: 400 });
    }

    // Generate the template
    const buffer = await generateGuestTemplate();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="guest-upload-template.xlsx"',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    logger.error('[PORTAL_DOWNLOAD_TEMPLATE] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
