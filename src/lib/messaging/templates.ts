/**
 * Message templates — centralized Hebrew text and WA template names.
 * No hardcoded message strings anywhere else in the codebase.
 */
import { APP_BASE_URL } from '@/lib/config';
import type { EventMessagingConfig, WaTemplateParam } from './types';

/** Build the join URL for an event */
export function buildJoinUrl(slug: string, joinCode: string): string {
  return `${APP_BASE_URL}/dating/${slug}/join?k=${joinCode}`;
}

/** Build the feedback URL for an event */
export function buildFeedbackUrl(eventId: string): string {
  return `${APP_BASE_URL}/feedback/${eventId}`;
}

// ── SMS Templates (plain text) ──

export function otpSmsText(code: string): string {
  return `Eventa - קוד האימות שלך: ${code}\nתוקף: 5 דקות`;
}

// ── WhatsApp Template Names (registered in Meta dashboard) ──

export const WA_TEMPLATES = {
  PRE_EVENT: 'eventa_pre_event',
  WELCOME: 'eventa_welcome',
  FEEDBACK: 'eventa_feedback',
} as const;

/** Build WA template variables for pre-event message */
export function preEventVars(
  config: EventMessagingConfig,
  guestName?: string | null
): WaTemplateParam[] {
  return [
    { type: 'text', text: guestName || '' },
    { type: 'text', text: config.eventName },
    { type: 'text', text: buildJoinUrl(config.eventSlug, config.joinCode) },
  ];
}

/** Build WA template variables for welcome message */
export function welcomeVars(
  config: EventMessagingConfig
): WaTemplateParam[] {
  return [
    { type: 'text', text: config.eventName },
    { type: 'text', text: buildJoinUrl(config.eventSlug, config.joinCode) },
  ];
}

/** Build WA template variables for feedback message */
export function feedbackVars(
  config: EventMessagingConfig
): WaTemplateParam[] {
  return [
    { type: 'text', text: config.eventName },
    { type: 'text', text: buildFeedbackUrl(config.eventId) },
  ];
}
