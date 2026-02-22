import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { RETENTION_DAYS } from '@/lib/constants';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, jsonError } from '../_helpers';
import { evictEventStatusCache } from '@/lib/route-helpers';
import { adminAuditLog } from '@/lib/admin-auth';
import { logger } from '@/lib/logger';

/**
 * GET|POST /api/admin/auto-archive
 * Finds events that have ended more than RETENTION_DAYS ago
 * and are still in 'ended' status, then archives them one by one.
 *
 * Also auto-transitions active events past their ends_at to 'ended'.
 *
 * Auth: Admin cookie (POST from dashboard) OR CRON_SECRET bearer (GET from Vercel Cron).
 */
async function handler(req: NextRequest) {
  const denied = adminGuard(req, 'admin-auto-archive', RATE_LIMITS.strict);
  if (denied) return denied;

  // Dry-run mode: log what would be archived without actually changing anything
  const dryRun = req.nextUrl.searchParams.get('dry_run') === 'true';

  try {
    const supabase = getServiceClient();
    const now = new Date();

    // ── Step 1: Auto-end events past their ends_at ──
    const endCutoff = now.toISOString();
    const { data: endableEvents, error: endError } = await supabase
      .from('events')
      .select('id, name')
      .in('status', ['active', 'paused'])
      .lt('ends_at', endCutoff);

    if (endError) {
      logger.error('[AUTO_ARCHIVE] Failed to fetch endable events:', endError);
      return jsonError('Database error', 500);
    }

    let endedCount = 0;
    if (endableEvents && endableEvents.length > 0) {
      if (dryRun) {
        logger.info('[AUTO_ARCHIVE] DRY RUN - would end events', {
          count: endableEvents.length,
          names: endableEvents.map((e) => e.name),
        });
      } else {
        for (const ev of endableEvents) {
          await supabase
            .from('events')
            .update({ status: 'ended', is_active: false })
            .eq('id', ev.id);
          evictEventStatusCache(ev.id);
          endedCount++;
        }
      }
    }

    // ── Step 2: Find events eligible for archiving ──
    // Events in 'ended' status where ends_at + RETENTION_DAYS < now
    const archiveCutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: archivable, error: archiveError } = await supabase
      .from('events')
      .select('id, name')
      .eq('status', 'ended')
      .lt('ends_at', archiveCutoff);

    if (archiveError) {
      logger.error('[AUTO_ARCHIVE] Failed to fetch archivable events:', archiveError);
      return jsonError('Database error', 500);
    }

    let archivedCount = 0;
    const archived: string[] = [];
    const errors: string[] = [];

    if (archivable && archivable.length > 0) {
      if (dryRun) {
        const names = archivable.map((e) => e.name);
        logger.info('[AUTO_ARCHIVE] DRY RUN - would archive events', { count: archivable.length, names });
        return NextResponse.json({
          success: true,
          dryRun: true,
          wouldEnd: endableEvents?.length || 0,
          wouldEndNames: endableEvents?.map((e) => e.name) || [],
          wouldArchive: archivable.length,
          wouldArchiveNames: names,
        });
      }

      for (const ev of archivable) {
        try {
          // Call the archive endpoint internally - forward auth headers
          const archiveUrl = new URL(`/api/admin/events/${ev.id}/archive`, req.url);
          const headers: Record<string, string> = {};
          const cookie = req.headers.get('cookie');
          const auth = req.headers.get('authorization');
          if (cookie) headers['cookie'] = cookie;
          if (auth) headers['authorization'] = auth;
          const res = await fetch(archiveUrl.toString(), {
            method: 'POST',
            headers,
          });

          if (res.ok) {
            archivedCount++;
            archived.push(ev.name);
          } else {
            errors.push(`${ev.name}: ${(await res.json()).error || 'Unknown error'}`);
          }
        } catch (err) {
          errors.push(`${ev.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    adminAuditLog('AUTO_ARCHIVE', {
      endedCount,
      archivedCount,
      archived,
      errors,
    }, req);

    logger.info('[AUTO_ARCHIVE] complete', { endedCount, archivedCount, errors: errors.length });

    return NextResponse.json({
      success: true,
      ended: endedCount,
      archived: archivedCount,
      archivedNames: archived,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    logger.error('[AUTO_ARCHIVE] error:', err);
    return jsonError('Auto-archive failed', 500);
  }
}

// Vercel Cron sends GET - expose both methods
export { handler as GET, handler as POST };
