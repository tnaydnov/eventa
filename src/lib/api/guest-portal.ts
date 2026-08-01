import type { UploadRowError } from '@/lib/guest-upload';

// ─── Types ──────────────────────────────────────────────

export interface PortalGuest {
  id: string;
  phone: string;
  name: string | null;
  sent: boolean;
  createdAt: string;
}

export interface PortalData {
  event: {
    id: string;
    name: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    status: string;
    messagesEnabled: boolean;
  };
  guests: PortalGuest[];
  total: number;
  page: number;
  totalPages: number;
  uploadStatus: 'empty' | 'uploaded' | 'sent' | 'started' | 'archived';
  isReadOnly: boolean;
  /** Timestamp the customer confirmed authorization to provide guest numbers, or null. */
  guestPhoneConsentAt: string | null;
}

export interface UploadResult {
  success: boolean;
  added: number;
  duplicates: number;
  invalid: number;
  errors: UploadRowError[];
  totalInList: number;
}

export interface MutationResult {
  totalInList: number;
}

// ─── Helpers ────────────────────────────────────────────

const portalUrl = (token: string) => `/api/guest-portal/${token}`;

async function parseBody(res: Response): Promise<Record<string, unknown>> {
  return res.json().catch(() => ({}));
}

async function ensureOk(res: Response, fallback: string): Promise<Record<string, unknown>> {
  const body = await parseBody(res);
  if (!res.ok) throw new Error((body.error as string) || fallback);
  return body;
}

// ─── API Functions ──────────────────────────────────────

/** Fetch portal data with paginated guest list. */
export async function getPortalData(
  token: string,
  page = 1,
  search = ''
): Promise<PortalData> {
  const params = new URLSearchParams({ page: String(page) });
  if (search.trim()) params.set('search', search.trim());
  const res = await fetch(`${portalUrl(token)}?${params}`);
  const body = await ensureOk(res, 'שגיאה בטעינת הנתונים');
  return body as unknown as PortalData;
}

/** Record the customer's authorization to provide guest phone numbers. Throws on failure. */
export async function recordGuestConsent(token: string): Promise<{ guestPhoneConsentAt: string }> {
  const res = await fetch(portalUrl(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true }),
  });

  const body = await ensureOk(res, 'שגיאה בשמירת האישור');
  return { guestPhoneConsentAt: (body.guestPhoneConsentAt as string) ?? new Date().toISOString() };
}

/** Upload a guest phone file (Excel / CSV). */
export async function uploadGuestFile(
  token: string,
  file: File
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(portalUrl(token), {
    method: 'POST',
    body: formData,
  });

  const body = await ensureOk(res, 'שגיאה בהעלאת הקובץ');
  return body as unknown as UploadResult;
}

/** Add a single phone number to the guest list. Throws on failure. */
export async function addGuestPhone(
  token: string,
  phone: string,
  name?: string
): Promise<MutationResult> {
  const res = await fetch(portalUrl(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, name: name || undefined }),
  });

  const body = await ensureOk(res, 'שגיאה בהוספת המספר');
  return { totalInList: (body.totalInList as number) ?? 0 };
}

/** Remove a phone from the guest list by ID. Throws on failure. */
export async function removeGuestPhone(
  token: string,
  phoneId: string
): Promise<MutationResult> {
  const res = await fetch(portalUrl(token), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneId }),
  });

  const body = await ensureOk(res, 'שגיאה בהסרת המספר');
  return { totalInList: (body.totalInList as number) ?? 0 };
}

/** Get download URL for the guest template Excel file. */
export function getTemplateDownloadUrl(token: string): string {
  return `/api/guest-portal/${token}/download-template`;
}
