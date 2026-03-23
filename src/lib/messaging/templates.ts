/**
 * Message templates - centralized Hebrew text for SMS messages.
 * No hardcoded message strings anywhere else in the codebase.
 */
import { APP_BASE_URL, OTP_EXPIRY_S } from '@/lib/config';
import type { EventMessagingConfig } from './types';

/** Build the join URL for an event */
export function buildJoinUrl(slug: string, joinCode: string): string {
  return `${APP_BASE_URL}/dating/${slug}/join?k=${joinCode}`;
}

/** Build the feedback URL for an event */
export function buildFeedbackUrl(slug: string): string {
  return `${APP_BASE_URL}/dating/${slug}/feedback`;
}

// ── SMS Templates (plain text) ──

export function otpSmsText(code: string): string {
  return `Eventa - קוד האימות שלך: ${code}\nתוקף: ${OTP_EXPIRY_S / 60} דקות`;
}

/** Build pre-event SMS text */
export function preEventSmsText(config: EventMessagingConfig): string {
  const joinUrl = buildJoinUrl(config.eventSlug, config.joinCode);
  return `מגיע/ה ל${config.eventName}? את/ה רווק/ה? 💍

באירוע תהיה לכם הזדמנות להצטרף לאפליקציית Eventa - ולראות את שאר הרווקים והרווקות שיהיו שם.

אל תדאגו - זו אפליקציה ייעודית רק לאירוע זה, וכל הנתונים שלכם יימחקו כשבוע לאחר האירוע. 🔒

כדאי לכם להיכנס כבר עכשיו ולבדוק את השטח…
אולי תשיגו משהו מעניין 😏

🔗 ${joinUrl}

נתראה באירוע! 🎉`;
}

/** Build welcome SMS text */
export function welcomeSmsText(config: EventMessagingConfig): string {
  const joinUrl = buildJoinUrl(config.eventSlug, config.joinCode);
  return `ברוכים הבאים ל${config.eventName}! 🎉

ההרשמה שלך בוצעה בהצלחה ✅

עכשיו אפשר להיכנס לאפליקציה, לבנות פרופיל ולראות מי עוד מגיע לאירוע 👀

🔗 ${joinUrl}

💡 אל תדאגו - תוך 7 ימים מסיום האירוע, הפרופיל וכל הנתונים שלכם נמחקים אוטומטית. 🔒`;
}

/** Build feedback SMS text */
export function feedbackSmsText(config: EventMessagingConfig): string {
  const feedbackUrl = buildFeedbackUrl(config.eventSlug);
  return `תודה שהשתתפתם ב${config.eventName}! 🙏

עשיתם Match? מקווים שזה הולך לכיוונים טובים! ❤️

נשמח לשמוע איך היה - מלאו משוב קצר של דקה:
${feedbackUrl}

💫 אם אתם מארגנים אירוע בעצמכם - Eventa תמיד כאן:
https://eventa.productions/dating

תודה רבה ונתראה! 💜`;
}
