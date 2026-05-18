/**
 * Moderation policy — auto-approval and auto-rejection thresholds.
 */

/** Score above which content is auto-rejected (hidden immediately). */
export const AUTO_REJECT_THRESHOLD = 0.85;

/** Score above which content is sent for human review (without hiding). */
export const HUMAN_REVIEW_THRESHOLD = 0.50;

/**
 * Determine the moderation status and whether to queue for human review.
 */
export function applyModerationPolicy(score: number, flagged: boolean): {
  status: 'approved' | 'rejected' | 'review';
  requiresHumanReview: boolean;
} {
  if (flagged && score >= AUTO_REJECT_THRESHOLD) {
    return { status: 'rejected', requiresHumanReview: false };
  }
  if (flagged || score >= HUMAN_REVIEW_THRESHOLD) {
    return { status: 'review', requiresHumanReview: true };
  }
  return { status: 'approved', requiresHumanReview: false };
}
