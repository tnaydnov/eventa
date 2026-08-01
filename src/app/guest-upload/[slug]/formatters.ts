const hebrewDateTimeFmt = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const hebrewFullFmt = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

const hebrewTimeFmt = new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
});

/** "3 ביוני 2025, 18:00" */
export function formatDate(iso: string): string {
  try {
    return hebrewDateTimeFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

/** "יום שלישי, 3 ביוני, 18:00" */
export function formatFullDate(iso: string): string {
  return hebrewFullFmt.format(new Date(iso));
}

/** "18:00" */
export function formatTime(iso: string): string {
  return hebrewTimeFmt.format(new Date(iso));
}

/** SMS send time = 3 hours before event */
export function formatSendTime(startsAt: string): string {
  const sendTime = new Date(new Date(startsAt).getTime() - 3 * 60 * 60 * 1000);
  return hebrewFullFmt.format(sendTime);
}

/** Upload deadline = 5 hours before event (2h before send) */
export function formatDeadline(startsAt: string): string {
  const deadline = new Date(new Date(startsAt).getTime() - 5 * 60 * 60 * 1000);
  return hebrewFullFmt.format(deadline);
}
