/**
 * OpenAI omni-moderation-latest image moderator.
 * Gracefully degrades - returns null on any error or missing API key.
 */
import { logger } from '@/lib/logger';

export type ModerationResult = {
  flagged: boolean;
  /** Per-category scores from OpenAI (0–1 per category). */
  scores: Record<string, number>;
  /** The highest-scoring category name. */
  label: string;
  /** The highest single-category score (convenience field). */
  score: number;
};

type OmniModerationResponse = {
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
  }>;
};

/**
 * Moderate a single image URL using OpenAI omni-moderation-latest.
 * Returns null if moderation cannot be run (graceful degradation).
 */
export async function moderateImageUrl(imageUrl: string): Promise<ModerationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null; // Graceful degradation - no API key
  }

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [{ type: 'image_url', image_url: { url: imageUrl } }],
      }),
      signal: AbortSignal.timeout(6_000),
    });

    if (!response.ok) {
      logger.warn('[MODERATOR] OpenAI API returned non-200:', response.status);
      return null;
    }

    const result = await response.json() as OmniModerationResponse;
    const item = result?.results?.[0];
    if (!item) return null;

    const scores = item.category_scores ?? {};

    // Find the highest-scoring category for convenience reporting
    let maxScore = 0;
    let maxLabel = 'none';
    for (const [label, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxLabel = label;
      }
    }

    return {
      flagged: item.flagged ?? false,
      scores,
      score: maxScore,
      label: maxLabel,
    };
  } catch (err) {
    logger.error('[MODERATOR] error:', err);
    return null;
  }
}
