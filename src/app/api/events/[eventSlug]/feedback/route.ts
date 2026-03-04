import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError } from '@/lib/route-helpers';
import { logger } from '@/lib/logger';

const VALID_USAGE = ['view_only', 'likes', 'matches', 'chat'] as const;
const VALID_INTERACTION = ['messages', 'real_life', 'interesting', 'none'] as const;
const VALID_FEATURES = [
  'swipes', 'chat', 'see_likes', 'design', 'concept', 'vibe',
] as const;
const VALID_STORY = ['yes', 'maybe', 'no'] as const;

const feedbackSchema = z.object({
  enjoyment: z.number().int().min(1).max(4),
  easeOfUse: z.number().int().min(1).max(4),
  usageLevel: z.enum(VALID_USAGE),
  interactionResult: z.enum(VALID_INTERACTION),
  favoriteFeatures: z.array(z.enum(VALID_FEATURES)).min(1).max(6),
  improvement: z.string().max(500).optional().nullable(),
  recommendation: z.number().int().min(1).max(4),
  successStory: z.enum(VALID_STORY).optional().nullable(),
  successStoryText: z.string().max(500).optional().nullable(),
  allowStoryPublish: z.boolean().optional().default(false),
});

/**
 * POST /api/events/[eventSlug]/feedback
 * Submit anonymous feedback for an event.
 * No authentication required — survey is anonymous.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> },
) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`feedback:${ip}`, RATE_LIMITS.strict);
  if (!rl.allowed) {
    return jsonError('Too many requests', 429);
  }

  const { eventSlug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid feedback data', 400);
  }

  const data = parsed.data;

  try {
    const supabase = getServiceClient();

    // Look up event by slug — must exist and not be draft
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, status')
      .eq('slug', eventSlug)
      .maybeSingle();

    if (eventErr) {
      logger.error('[FEEDBACK] event lookup failed', { error: eventErr.message });
      return jsonError('Server error', 500);
    }

    if (!event) {
      return jsonError('Event not found', 404);
    }

    if (event.status === 'draft') {
      return jsonError('Event not available', 403);
    }

    // Insert anonymous feedback
    const { error: insertErr } = await supabase.from('event_feedback').insert({
      event_id: event.id,
      enjoyment: data.enjoyment,
      ease_of_use: data.easeOfUse,
      usage_level: data.usageLevel,
      interaction_result: data.interactionResult,
      favorite_features: data.favoriteFeatures,
      improvement_text: data.improvement || null,
      recommendation: data.recommendation,
      success_story: data.successStory || null,
      success_story_text: data.successStoryText || null,
      allow_story_publish: data.allowStoryPublish,
    });

    if (insertErr) {
      logger.error('[FEEDBACK] insert failed', { error: insertErr.message });
      return jsonError('Failed to save feedback', 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[FEEDBACK] unexpected error', err);
    return jsonError('Server error', 500);
  }
}
