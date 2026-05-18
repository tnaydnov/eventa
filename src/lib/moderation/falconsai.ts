/**
 * Falconsai/nsfw_image_detection — second-opinion for grey-band profile photos.
 *
 * Calls a self-hosted endpoint (Fly.io / Modal / HuggingFace Inference API).
 * The endpoint URL is in the `FALCONSAI_ENDPOINT` env var.
 *
 * If FALCONSAI_ENDPOINT is unset (e.g. local dev, or when the service isn't yet
 * deployed), `secondOpinion()` returns `null` and the caller treats grey-band
 * calls as `shadow_review` — the safe default.
 *
 * Expected endpoint contract:
 *   POST { image_url: string }
 *   → { label: 'nsfw' | 'normal', score: number }
 *
 * Compatible with the HuggingFace Inference API (free tier):
 *   FALCONSAI_ENDPOINT=https://api-inference.huggingface.co/models/Falconsai/nsfw_image_detection
 *   (add HF token via Authorization header when using HF API)
 */

import { logger } from '@/lib/logger';

interface FalconsaiResponse {
  label: 'nsfw' | 'normal' | string;
  score: number;
}

/** Minimum Falconsai nsfw score to confirm a block. */
const FALCONSAI_BLOCK_THRESHOLD = 0.85;

/**
 * Ask Falconsai whether an image is NSFW.
 *
 * @returns `true` if Falconsai confirms NSFW with high confidence,
 *          `false` if it says the image is safe,
 *          `null`  on error or if the endpoint is not configured (caller should treat as unknown).
 */
export async function secondOpinion(imageUrl: string): Promise<boolean | null> {
  const endpoint = process.env.FALCONSAI_ENDPOINT;
  if (!endpoint) return null; // Not configured — safe fallback is shadow_review

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.FALCONSAI_TOKEN
          ? { Authorization: `Bearer ${process.env.FALCONSAI_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ image_url: imageUrl }),
      signal: AbortSignal.timeout(4_000), // 4 s — faster SLA than OpenAI
    });

    if (!res.ok) {
      logger.warn('[FALCONSAI] non-200 response:', res.status);
      return null;
    }

    const data = await res.json() as FalconsaiResponse | FalconsaiResponse[];

    // HuggingFace Inference API returns an array of { label, score }
    const first = Array.isArray(data) ? data[0] : data;
    if (!first) return null;

    // HuggingFace returns all labels; find the 'nsfw' entry.
    if (Array.isArray(data)) {
      const nsfw = (data as FalconsaiResponse[]).find((d) => d.label === 'nsfw');
      if (!nsfw) return null;
      return nsfw.score >= FALCONSAI_BLOCK_THRESHOLD;
    }

    return first.label === 'nsfw' && first.score >= FALCONSAI_BLOCK_THRESHOLD;
  } catch (err) {
    logger.warn('[FALCONSAI] second opinion failed:', err);
    return null; // On timeout/network error, fall through to shadow_review
  }
}
