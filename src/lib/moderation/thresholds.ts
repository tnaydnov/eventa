/**
 * Moderation thresholds — per-surface, per-category.
 *
 * Three bands per category:
 * - ALLOW  (score <  allow_max): immediate pass, just log.
 * - GREY   (allow_max <= score < block_min): photo goes live, admin shadow-review queue, triggers
 *           second-opinion on profile-photo surface.
 * - BLOCK  (score >= block_min): blocked outright, storage deleted, 422 returned.
 *
 * Calibrated against published omni-moderation-latest score distributions.
 * Change these values here only — all pipeline code reads from this module.
 */

export interface CategoryThreshold {
  allow_max: number;
  block_min: number;
}

export interface SurfaceThresholds {
  /** Categories checked with hard enforcement (auto-block in grey band too if flagged). */
  hard: Record<string, CategoryThreshold>;
  /** The `sexual` category on profile uses soft enforcement with second-opinion in grey band. */
  soft: {
    sexual: CategoryThreshold;
  };
}

/**
 * Profile photo thresholds — STRICT.
 *
 * swimwear/cleavage ≈ 0.15–0.40, lingerie ≈ 0.40–0.60,
 * partial nudity ≈ 0.55–0.80, explicit nudity ≈ 0.85+
 */
export const PROFILE_THRESHOLDS: SurfaceThresholds = {
  hard: {
    'sexual/minors': { allow_max: 0.02, block_min: 0.05 },  // Hard floor — any grey here auto-flags participant
    'violence/graphic': { allow_max: 0.40, block_min: 0.70 },
    'self-harm': { allow_max: 0.30, block_min: 0.60 },
    'illicit/violent': { allow_max: 0.40, block_min: 0.70 },
  },
  soft: {
    sexual: { allow_max: 0.55, block_min: 0.85 },
  },
};

/**
 * Chat image thresholds — LOOSE.
 *
 * Adult content between matched participants is allowed.
 * Only CSAM and extreme violence are enforced.
 */
export const CHAT_THRESHOLDS: SurfaceThresholds = {
  hard: {
    'sexual/minors': { allow_max: 0.02, block_min: 0.05 },
    'violence/graphic': { allow_max: 0.50, block_min: 0.85 },
    'self-harm': { allow_max: 0.40, block_min: 0.75 },
    'illicit/violent': { allow_max: 0.50, block_min: 0.85 },
  },
  soft: {
    // Sexual content is NOT enforced in chat — set allow_max to 1.01 to never enter grey band.
    sexual: { allow_max: 1.01, block_min: 1.01 },
  },
};
