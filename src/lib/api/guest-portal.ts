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
    waMessagesEnabled: boolean;
  };
  guests: PortalGuest[];
  total: number;
  page: number;
  totalPages: number;
  uploadStatus: 'empty' | 'uploaded' | 'sent' | 'archived';
  isReadOnly: boolean;
}

export interface UploadResult {
  success: boolean;
  added: number;
  duplicates: number;
  invalid: number;
  errors: UploadRowError[];
  totalInList: number;
}

export interface AddPhoneResult {
  success: boolean;
  totalInList: number;
  error?: string;
}

// ─── API Functions ──────────────────────────────────────

const portalUrl = (token: string) => `/api/guest-portal/${token}`;

/** Fetch portal data with paginated guest list. */
export async function getPortalData(
  token: string,
  page = 1,
  search = ''
): Promise<PortalData> {
  const params = new URLSearchParams({ page: String(page) });
  if (search.trim()) params.set('search', search.trim());
  const res = await fetch(`${portalUrl(token)}?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'שגיאה בטעינת הנתונים');
  }
  return res.json();
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

  if (!res.ok && res.status !== 200) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'שגיאה בהעלאת הקובץ');
  }
  return res.json();
}

/** Add a single phone number to the guest list. */
export async function addGuestPhone(
  token: string,
  phone: string,
  name?: string
): Promise<AddPhoneResult> {
  const res = await fetch(portalUrl(token), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, name: name || undefined }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      totalInList: 0,
      error: body.error || 'שגיאה בהוספת המספר',
    };
  }

  return { success: true, totalInList: body.totalInList };
}

/** Remove a phone from the guest list by ID. */
export async function removeGuestPhone(
  token: string,
  phoneId: string
): Promise<{ success: boolean; totalInList: number; error?: string }> {
  const res = await fetch(portalUrl(token), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneId }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { success: false, totalInList: 0, error: body.error || 'שגיאה בהסרת המספר' };
  }

  return { success: true, totalInList: body.totalInList };
}

/** Get download URL for the guest template Excel file. */
export function getTemplateDownloadUrl(token: string): string {
  return `/api/guest-portal/${token}/download-template`;
}
