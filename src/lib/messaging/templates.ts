/**
 * Message templates - centralized Hebrew text for SMS messages.
 * No hardcoded message strings anywhere else in the codebase.
 */
import { APP_BASE_URL, OTP_EXPIRY_S } from '@/lib/config';
import type { EventMessagingConfig } from './types';

/** Build the join URL for an event */
export function buildJoinUrl(slug: string): string {
  return `${APP_BASE_URL}/${slug}`;
}

/** Build the feedback URL for an event */
export function buildFeedbackUrl(slug: string): string {
  return `${APP_BASE_URL}/${slug}/feedback`;
}

// ── SMS Templates (plain text) ──

export function otpSmsText(code: string): string {
  return `Eventa - קוד האימות שלך: ${code}\nתוקף: ${OTP_EXPIRY_S / 60} דקות`;
}

/** Build pre-event SMS text */
export function preEventSmsText(config: EventMessagingConfig): string {
  const joinUrl = buildJoinUrl(config.eventSlug);

באירוע תהיה לכם הזדמנות להצטרף לאפליקציית Eventa - ולראות את שאר הרווקים והרווקות שיהיו שם.

אל תדאגו - זו אפליקציה ייעודית רק לאירוע זה, וכל הנתונים שלכם יימחקו כשבוע לאחר האירוע. 🔒

כדאי לכם להיכנס כבר עכשיו ולבדוק את השטח…
אולי תשיגו משהו מעניין 😏

🔗 ${joinUrl}

נתראה באירוע! 🎉`;
}

/** Build welcome SMS text */
export function welcomeSmsText(config: EventMessagingConfig): string {
  const joinUrl = buildJoinUrl(config.eventSlug);

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
https://eventa.productions/

תודה רבה ונתראה! 💜`;
}

/** Notification SMS: someone liked you */
export function likeNotificationSmsText(eventName: string, eventSlug: string): string {
  return `✨ מישהו/י ב${eventName} חיבב אותך!
היכנס/י לאפליקציה כדי לגלות מי זה:
${APP_BASE_URL}/${eventSlug}`;
}

/** Notification SMS: you got a match */
export function matchNotificationSmsText(eventName: string, eventSlug: string): string {
  return `🎉 יש התאמה! גם אתם וגם ה-Match שלכם חיבבתם אחד את השני ב${eventName}!
פתחו שיחה עכשיו:
${APP_BASE_URL}/${eventSlug}`;
}

/** Notification SMS: new message received */
export function messageNotificationSmsText(eventName: string, eventSlug: string): string {
  return `💬 הודעה חדשה ממישהו/י ב${eventName}!
היכנס/י לאפליקציה כדי לקרוא:
${APP_BASE_URL}/${eventSlug}`;
}

/** Notification SMS: abandoned funnel - registered but didn't complete profile */
export function abandonedFunnelSmsText(eventName: string, eventSlug: string): string {
  return `היי! ראינו שנרשמת ל${eventName} אבל עדיין לא השלמת את הפרופיל שלך.
אל תפספס/י - השלם/י עכשיו ותתחיל/י לחפש:
${APP_BASE_URL}/${eventSlug}`;
}

/** Notification SMS: participant inactive for a while */
export function inactivitySmsText(eventName: string, eventSlug: string): string {
  return `עדיין לא מאוחר! ה${eventName} עדיין פעיל ומחכה לך.
חזור/י לאפליקציה ותראה/י מה התחדש:
${APP_BASE_URL}/${eventSlug}`;
}
