/**
 * Report generation orchestrator.
 * Curettes analytics, optionally generates AI summary, upserts to event_reports.
 */
import { logger } from '@/lib/logger';
import { getServiceClient } from '@/lib/supabase';
import { curateReport, REPORT_SCHEMA_VERSION, type CuratedReportPayload } from './curate';
import { generateAiSummary } from './ai-summary';

export type GenerateReportResult = {
  success: boolean;
  event_id: string;
  payload?: CuratedReportPayload;
  ai_summary?: string | null;
  error?: string;
};

export async function generateReport(eventId: string): Promise<GenerateReportResult> {
  const supabase = getServiceClient();

  try {
    const payload = await curateReport(supabase, eventId);
    const ai_summary = await generateAiSummary(payload);

    const { error: upsertError } = await supabase
      .from('event_reports')
      .upsert(
        {
          event_id: eventId,
          curated_payload: payload,
          ai_summary,
          schema_version: REPORT_SCHEMA_VERSION,
          generated_at: payload.generated_at,
        },
        { onConflict: 'event_id' }
      );

    if (upsertError) {
      logger.error('[GENERATE_REPORT] upsert error:', upsertError.message);
      return { success: false, event_id: eventId, error: upsertError.message };
    }

    logger.info(`[GENERATE_REPORT] Report generated for event ${eventId}`);
    return { success: true, event_id: eventId, payload, ai_summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[GENERATE_REPORT] error:', message);
    return { success: false, event_id: eventId, error: message };
  }
}
