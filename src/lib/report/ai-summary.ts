/**
 * AI summary generation for post-event client reports.
 * Uses OpenAI gpt-4o-mini to generate a Hebrew-friendly summary.
 * Gracefully degrades — returns null if no API key or on any error.
 */
import { logger } from '@/lib/logger';
import type { CuratedReportPayload } from './curate';

/** Max tokens for the summary (≈ 400–600 Hebrew words). */
const MAX_TOKENS = 800;

const SYSTEM_PROMPT = `You are an analyst who writes post-event reports for a social speed-dating app called Eventa.
You receive aggregated event statistics in JSON form and produce a concise, professional summary in Hebrew (2–4 paragraphs).
Focus on: total participants, engagement highlights (likes, matches, messages), notable patterns, and 1–2 actionable insights for the event organizer.
Write warmly but professionally. Do not mention technical terms like "API", "JSON", or "funnel_events".`;

function buildUserPrompt(payload: CuratedReportPayload): string {
  const { engagement, funnel, network } = payload;
  return `Event analytics data:
- Participants: ${network.total_participants}
- Likes sent: ${engagement.total_likes}
- Mutual matches: ${engagement.mutual_likes}
- Conversations: ${engagement.total_conversations}
- Total messages: ${engagement.total_messages}
- Match rate: ${engagement.match_rate.toFixed(1)}%
- Funnel completion rate: ${funnel.steps.length > 0 ? ((funnel.steps[funnel.steps.length - 1]?.count ?? 0) / (funnel.steps[0]?.count || 1) * 100).toFixed(1) : 0}%
- Top funnel drop-off step: ${funnel.top_drop_off ?? 'N/A'}
- Participants with matches: ${network.participants_with_matches}
- Isolated participants (0 likes): ${network.isolated_participants}

Generate a professional post-event summary report in Hebrew for the event organizer.`;
}

export async function generateAiSummary(
  payload: CuratedReportPayload
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('[AI_SUMMARY] OPENAI_API_KEY not set — skipping AI summary');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(payload) },
        ],
      }),
    });

    if (!response.ok) {
      logger.warn('[AI_SUMMARY] OpenAI API returned non-200:', response.status);
      return null;
    }

    const result = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = result?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      logger.warn('[AI_SUMMARY] Empty response from OpenAI');
      return null;
    }

    return content;
  } catch (err) {
    logger.error('[AI_SUMMARY] error generating summary:', err);
    return null;
  }
}
