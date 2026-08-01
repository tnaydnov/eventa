/**
 * Image moderation orchestrator.
 *
 * Implements the two-stage flow from §14.5:
 * 1. OpenAI omni-moderation-latest - primary check (all uploads)
 * 2. Falconsai second-opinion - grey-band profile photos only
 *
 * Three outcomes per category per surface (§14.4):
 * - ALLOW  (score < allow_max): pass, log
 * - GREY   (allow_max ≤ score < block_min): photo/message goes live, shadow-review queue
 * - BLOCK  (score ≥ block_min): rejected, storage deleted
 *
 * Fail-open: any API error allows the content and logs a 'deferred' row.
 * A recheck cron (api/cron/recheck-moderation) processes deferred rows nightly.
 */
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { moderateImageUrl } from './moderator';
import { PROFILE_THRESHOLDS, CHAT_THRESHOLDS, type SurfaceThresholds } from './thresholds';
import { secondOpinion } from './falconsai';
import { alertCsamDetected } from '@/lib/security-alert';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const PHOTOS_BUCKET = 'photos';

function buildPublicUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${storagePath}`;
}

// ─── Core verdict engine ─────────────────────────────────────────

type Verdict = 'allowed' | 'blocked' | 'shadow_review' | 'deferred';

async function evaluateScores(
  scores: Record<string, number>,
  thresholds: SurfaceThresholds,
  imageUrl: string,
  surface: 'profile_photo' | 'chat_image',
): Promise<{ verdict: Verdict; reason: string | null; model: string; secondOpinionData: Record<string, number> | null }> {
  // 1. Hard categories - block immediately on BLOCK band, shadow_review on GREY band.
  for (const [cat, limits] of Object.entries(thresholds.hard)) {
    const score = scores[cat] ?? 0;
    if (score >= limits.block_min) {
      return { verdict: 'blocked', reason: cat, model: 'openai', secondOpinionData: null };
    }
    // CSAM grey band on profile: also auto-flags but doesn't need second opinion
    if (score >= limits.allow_max) {
      return { verdict: 'shadow_review', reason: cat, model: 'openai', secondOpinionData: null };
    }
  }

  // 2. Soft category (sexual on profile - skip on chat where allow_max = 1.01)
  if (surface === 'profile_photo') {
    const sexual = scores['sexual'] ?? 0;
    const { allow_max, block_min } = thresholds.soft.sexual;

    if (sexual >= block_min) {
      return { verdict: 'blocked', reason: 'sexual', model: 'openai', secondOpinionData: null };
    }

    if (sexual >= allow_max) {
      // Grey band - run second-opinion before blocking
      const opinion = await secondOpinion(imageUrl);
      const secondOpinionData = opinion !== null ? { confirmed: opinion ? 1 : 0 } : null;

      if (opinion === true) {
        // Both models agree - block
        return { verdict: 'blocked', reason: 'sexual', model: 'openai+falconsai', secondOpinionData };
      }
      // Falconsai disagrees or unavailable - shadow review only
      return { verdict: 'shadow_review', reason: 'sexual', model: 'openai', secondOpinionData };
    }
  }

  return { verdict: 'allowed', reason: null, model: 'openai', secondOpinionData: null };
}

// ─── Repeat-offender detection ───────────────────────────────────

const REPEAT_BLOCK_COUNT = 3;
const REPEAT_WINDOW_MS = 60 * 60 * 1_000; // 1 hour

async function checkRepeatOffender(participantId: string, eventId: string): Promise<void> {
  try {
    const supabase = getServiceClient();
    const windowStart = new Date(Date.now() - REPEAT_WINDOW_MS).toISOString();

    const { count } = await supabase
      .from('moderation_log')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', participantId)
      .eq('event_id', eventId)
      .eq('decision', 'blocked')
      .gte('created_at', windowStart);

    if ((count ?? 0) >= REPEAT_BLOCK_COUNT) {
      await supabase
        .from('participants')
        .update({ flagged_for_review: true, flagged_at: new Date().toISOString() })
        .eq('id', participantId)
        .eq('event_id', eventId);

      logger.warn(`[MODERATION] repeat-offender flagged: participant=${participantId} event=${eventId}`);
    }
  } catch (err) {
    logger.error('[MODERATION] checkRepeatOffender error:', err);
  }
}

// ─── Log helpers ─────────────────────────────────────────────────

async function writeModerationLog(params: {
  eventId: string | null;
  participantId: string | null;
  surface: 'profile_photo' | 'chat_image';
  storagePath: string;
  verdict: Verdict;
  reason: string | null;
  scores: Record<string, number>;
  secondOpinionData: Record<string, number> | null;
  model: string;
}): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from('moderation_log').insert({
    event_id: params.eventId,
    participant_id: params.participantId,
    surface: params.surface,
    storage_path: params.storagePath,
    decision: params.verdict,
    reason: params.reason,
    scores: params.scores,
    second_opinion: params.secondOpinionData,
    model: params.model,
  });
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Synchronous pre-upload moderation check.
 * Uses a SIGNED URL so the file is accessible immediately after upload
 * without waiting for CDN propagation of the public URL.
 * Returns { blocked: true } if the image violates content policy.
 * Fail-open: any error or missing API key returns { blocked: false }.
 */
export async function preModerationCheck(
  storagePath: string
): Promise<{ blocked: boolean }> {
  try {
    const supabase = getServiceClient();
    // Signed URL bypasses CDN propagation - immediately accessible after upload
    const { data: signedData, error: signedError } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrl(storagePath, 120); // 2-minute expiry
    const imageUrl = (!signedError && signedData?.signedUrl)
      ? signedData.signedUrl
      : buildPublicUrl(storagePath);

    const result = await moderateImageUrl(imageUrl);
    if (!result) return { blocked: false }; // fail-open
    const { verdict } = await evaluateScores(
      result.scores,
      PROFILE_THRESHOLDS,
      imageUrl,
      'profile_photo',
    );
    return { blocked: verdict === 'blocked' || verdict === 'shadow_review' };
  } catch {
    return { blocked: false }; // fail-open
  }
}

/**
 * Moderate a participant profile photo after upload.
 * Fire-and-forget safe - never throws.
 * On BLOCK: updates moderation_status to 'rejected' and queues for shadow review.
 * On GREY:  photo stays live, queued for shadow review.
 * On error: deferred - recheck cron will re-process.
 */
export async function moderateProfilePhoto(
  photoId: string,
  storagePath: string,
  participantId?: string,
  eventId?: string,
): Promise<void> {
  try {
    const imageUrl = buildPublicUrl(storagePath);
    const result = await moderateImageUrl(imageUrl);

    const supabase = getServiceClient();

    if (!result) {
      // API unavailable - defer for recheck cron
      await supabase
        .from('participant_photos')
        .update({ moderation_status: 'pending' })
        .eq('id', photoId);
      if (eventId) {
        await writeModerationLog({
          eventId: eventId ?? null,
          participantId: participantId ?? null,
          surface: 'profile_photo',
          storagePath,
          verdict: 'deferred',
          reason: 'api_error',
          scores: {},
          secondOpinionData: null,
          model: 'none',
        });
      }
      return;
    }

    const { verdict, reason, model, secondOpinionData } = await evaluateScores(
      result.scores,
      PROFILE_THRESHOLDS,
      imageUrl,
      'profile_photo',
    );

    // Map verdict to DB moderation_status
    const dbStatus: 'approved' | 'rejected' | 'review' =
      verdict === 'blocked' ? 'rejected' :
      verdict === 'shadow_review' ? 'review' :
      'approved';

    if (verdict === 'blocked') {
      // Hard block: delete from storage AND DB.
      // Skip if the photo was already approved by preModerationCheck (signed-URL check ran
      // synchronously before this async task; trust that result over this post-hoc check).
      const { data: existing } = await supabase
        .from('participant_photos')
        .select('moderation_status')
        .eq('id', photoId)
        .maybeSingle();
      if (existing?.moderation_status === 'approved') {
        // Pre-check already approved - don't delete. Just log for audit.
        logger.warn(`[MODERATION] post-check blocked but pre-check approved photo ${photoId} - keeping pre-check result`);
      } else {
        await Promise.all([
          supabase.storage.from('photos').remove([storagePath]),
          supabase.from('participant_photos').delete().eq('id', photoId),
        ]);
      }
    } else {
      await supabase
        .from('participant_photos')
        .update({
          moderation_score: result.score,
          moderation_scores: result.scores,
          moderation_label: result.label,
          moderation_status: dbStatus,
          moderation_reviewed_at: new Date().toISOString(),
        })
        .eq('id', photoId);
    }

    // Write full audit log
    await writeModerationLog({
      eventId: eventId ?? null,
      participantId: participantId ?? null,
      surface: 'profile_photo',
      storagePath,
      verdict,
      reason: reason ?? null,
      scores: result.scores,
      secondOpinionData,
      model,
    });

    if ((verdict === 'shadow_review' || verdict === 'blocked') && eventId) {
      // Add to the shadow-review queue for admin action
      await supabase.from('moderation_review_queue').insert({
        event_id: eventId,
        item_type: 'photo',
        photo_id: photoId,
        score: result.score,
        label: reason ?? result.label,
      });

      // Check for repeat-offender pattern
      if (verdict === 'blocked' && participantId && eventId) {
        await checkRepeatOffender(participantId, eventId);
        // Alert on CSAM hard blocks immediately
        if (reason && (reason.includes('csam') || reason.includes('child'))) {
          alertCsamDetected(participantId, eventId, storagePath);
        }
      }
    }

    logger.info(
      `[MODERATION] photo ${photoId}: verdict=${verdict} score=${result.score.toFixed(3)} ` +
      `label=${result.label} model=${model}`,
    );
  } catch (err) {
    logger.error('[MODERATION] moderateProfilePhoto error:', err);
    // Fail open - don't block the user
  }
}

/**
 * Moderate a chat image message after it is sent.
 * Fire-and-forget safe - never throws.
 * Chat is loose (§14.4) - only CSAM and extreme violence are enforced.
 */
export async function moderateChatImage(messageId: string, storagePath: string, eventId: string): Promise<void> {
  try {
    const imageUrl = buildPublicUrl(storagePath);
    const result = await moderateImageUrl(imageUrl);

    if (!result) return; // Graceful degradation

    const { verdict, reason, model } = await evaluateScores(
      result.scores,
      CHAT_THRESHOLDS,
      imageUrl,
      'chat_image',
    );

    const supabase = getServiceClient();

    if (verdict === 'blocked') {
      // Soft-delete the message immediately
      await supabase
        .from('messages')
        .update({ is_deleted: true, text: null, media_path: null })
        .eq('id', messageId);
    }

    if (verdict === 'shadow_review') {
      await supabase.from('moderation_review_queue').insert({
        event_id: eventId,
        item_type: 'message',
        message_id: messageId,
        score: result.score,
        label: reason ?? result.label,
      });
    }

    await writeModerationLog({
      eventId,
      participantId: null,
      surface: 'chat_image',
      storagePath,
      verdict,
      reason: reason ?? null,
      scores: result.scores,
      secondOpinionData: null,
      model,
    });

    logger.info(
      `[MODERATION] message ${messageId}: verdict=${verdict} score=${result.score.toFixed(3)} ` +
      `label=${result.label} model=${model}`,
    );
  } catch (err) {
    logger.error('[MODERATION] moderateChatImage error:', err);
    // Fail open - don't block the user
  }
}

export { moderateImageUrl } from './moderator';
export { applyModerationPolicy } from './policy';
export { PROFILE_THRESHOLDS, CHAT_THRESHOLDS } from './thresholds';

