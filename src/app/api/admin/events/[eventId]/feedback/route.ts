import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, validateEventId, jsonError } from '../../../_helpers';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/events/[eventId]/feedback
 * Returns all feedback responses + aggregate stats for an event.
 * Admin-only (cookie or cron auth).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const denied = await adminGuard(req, 'admin-feedback', RATE_LIMITS.standard);
  if (denied) return denied;

  const { eventId } = await params;
  const invalid = validateEventId(eventId);
  if (invalid) return invalid;

  try {
    const supabase = getServiceClient();

    // Verify event exists
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, slug')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr) {
      logger.error('[ADMIN_FEEDBACK] event lookup error', { error: eventErr.message });
      return jsonError('Failed to fetch event', 500);
    }
    if (!event) {
      return jsonError('Event not found', 404);
    }

    // Fetch all feedback rows
    const { data: rows, error: rowsErr } = await supabase
      .from('event_feedback')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (rowsErr) {
      logger.error('[ADMIN_FEEDBACK] feedback query error', { error: rowsErr.message });
      return jsonError('Failed to fetch feedback', 500);
    }

    const responses = rows ?? [];
    const total = responses.length;

    // ── Aggregate stats ──
    const enjoymentAvg = total ? responses.reduce((s, r) => s + r.enjoyment, 0) / total : 0;
    const easeOfUseAvg = total ? responses.reduce((s, r) => s + r.ease_of_use, 0) / total : 0;
    const recommendationAvg = total ? responses.reduce((s, r) => s + r.recommendation, 0) / total : 0;

    // Usage level distribution
    const usageLevels: Record<string, number> = {};
    for (const r of responses) {
      usageLevels[r.usage_level] = (usageLevels[r.usage_level] || 0) + 1;
    }

    // Interaction result distribution
    const interactionResults: Record<string, number> = {};
    for (const r of responses) {
      interactionResults[r.interaction_result] = (interactionResults[r.interaction_result] || 0) + 1;
    }

    // Favorite features frequency
    const featureFrequency: Record<string, number> = {};
    for (const r of responses) {
      if (Array.isArray(r.favorite_features)) {
        for (const f of r.favorite_features) {
          featureFrequency[f] = (featureFrequency[f] || 0) + 1;
        }
      }
    }

    // Success story counts
    const successStories: Record<string, number> = { yes: 0, maybe: 0, no: 0 };
    for (const r of responses) {
      if (r.success_story && r.success_story in successStories) {
        successStories[r.success_story]++;
      }
    }

    // Enjoyment distribution (1-4)
    const enjoymentDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const r of responses) enjoymentDist[r.enjoyment]++;

    // Recommendation distribution (1-4)
    const recommendationDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const r of responses) recommendationDist[r.recommendation]++;

    // Responses with improvement text
    const improvementCount = responses.filter(r => r.improvement_text?.trim()).length;

    // Responses with success story text
    const successStoryTexts = responses
      .filter(r => r.success_story_text?.trim())
      .map(r => ({
        text: r.success_story_text,
        allowPublish: r.allow_story_publish,
        createdAt: r.created_at,
      }));

    return NextResponse.json({
      slug: event.slug,
      totalResponses: total,
      aggregates: {
        enjoymentAvg: Math.round(enjoymentAvg * 100) / 100,
        easeOfUseAvg: Math.round(easeOfUseAvg * 100) / 100,
        recommendationAvg: Math.round(recommendationAvg * 100) / 100,
        enjoymentDist,
        recommendationDist,
        usageLevels,
        interactionResults,
        featureFrequency,
        successStories,
        improvementCount,
        successStoryTexts,
      },
      responses: responses.map(r => ({
        id: r.id,
        createdAt: r.created_at,
        enjoyment: r.enjoyment,
        easeOfUse: r.ease_of_use,
        usageLevel: r.usage_level,
        interactionResult: r.interaction_result,
        favoriteFeatures: r.favorite_features,
        improvementText: r.improvement_text,
        recommendation: r.recommendation,
        successStory: r.success_story,
        successStoryText: r.success_story_text,
        allowStoryPublish: r.allow_story_publish,
      })),
    });
  } catch (err) {
    logger.error('[ADMIN_FEEDBACK] unexpected error', { error: String(err) });
    return jsonError('Internal server error', 500);
  }
}
