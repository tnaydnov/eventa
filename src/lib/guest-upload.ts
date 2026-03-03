/**
 * Guest list upload parsing and validation.
 *
 * Handles both Excel (.xlsx) and CSV (.csv) files.
 * Validates phone numbers (Israeli mobile only), detects duplicates,
 * and returns structured results with per-row errors.
 */
import { normalizePhone, isValidIsraeliMobile } from '@/lib/messaging/phone-utils';
import { sanitizeWithLimit } from '@/lib/sanitize';
import { MAX_GUEST_NAME_LENGTH } from '@/lib/config';

// ─── Types ──────────────────────────────────────────────

export interface UploadRowError {
  /** 1-based row number from the source file. */
  row: number;
  /** The raw phone value the user entered. */
  phone: string;
  /** Hebrew error message explaining the issue. */
  reason: string;
}

export interface UploadValidationResult {
  success: boolean;
  /** New numbers actually added. */
  added: number;
  /** Numbers already in the existing list (skipped). */
  duplicates: number;
  /** Numbers that failed validation (skipped). */
  invalid: number;
  /** Per-row error details. */
  errors: UploadRowError[];
  /** Parsed valid guest entries ready for DB insert. */
  validGuests: ParsedGuest[];
}

export interface ParsedGuest {
  /** E.164 normalized phone. */
  phone: string;
  /** Sanitized guest name or null. */
  guest_name: string | null;
}

// ─── Constants ──────────────────────────────────────────

/** Maximum rows per file upload. */
const MAX_UPLOAD_ROWS = 500;

/** Maximum file size in bytes (5 MB). */
export const MAX_UPLOAD_FILE_SIZE = 5 * 1024 * 1024;

/** Allowed file extensions. */
export const ALLOWED_UPLOAD_EXTENSIONS = ['.xlsx', '.csv'] as const;

/** Allowed MIME types for upload validation. */
export const ALLOWED_UPLOAD_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'text/plain', // some systems report CSV as text/plain
]);

// ─── File Type Detection ────────────────────────────────

/**
 * Determine if a filename has an allowed extension.
 */
export function isAllowedUploadFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// ─── Parsing ────────────────────────────────────────────

interface RawRow {
  phone: string;
  name?: string;
}

/**
 * Parse an Excel or CSV buffer into raw phone/name rows.
 * Auto-detects file format via XLSX library (loaded on demand).
 */
export async function parseGuestFile(buffer: Buffer, filename: string): Promise<{
  rows: RawRow[];
  error?: string;
}> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { rows: [], error: 'הקובץ ריק' };
    }

    const sheet = workbook.Sheets[sheetName];
    // Get raw JSON rows - header: 1 means first row is header
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false, // force string conversion
    });

    if (rawData.length === 0) {
      return { rows: [], error: 'הקובץ ריק - אין שורות נתונים' };
    }

    if (rawData.length > MAX_UPLOAD_ROWS) {
      return {
        rows: [],
        error: `מקסימום ${MAX_UPLOAD_ROWS} אורחים בהעלאה אחת. אפשר להעלות קבצים נוספים.`,
      };
    }

    // Detect phone and name columns from headers
    const headers = Object.keys(rawData[0]);
    const phoneCol = detectPhoneColumn(headers);
    const nameCol = detectNameColumn(headers);

    const rows: RawRow[] = [];
    for (const row of rawData) {
      const phoneVal = phoneCol ? String(row[phoneCol] ?? '').trim() : '';
      const nameVal = nameCol ? String(row[nameCol] ?? '').trim() : undefined;

      if (phoneVal) {
        rows.push({ phone: phoneVal, name: nameVal || undefined });
      }
    }

    return { rows };
  } catch {
    const isCSV = filename.toLowerCase().endsWith('.csv');
    return {
      rows: [],
      error: isCSV
        ? 'שגיאה בקריאת קובץ ה-CSV. ודאו שהקובץ בפורמט תקין.'
        : 'שגיאה בקריאת קובץ ה-Excel. ודאו שהקובץ בפורמט .xlsx תקין.',
    };
  }
}

/**
 * Detect which column header is the phone column.
 * Supports Hebrew and English headers.
 */
function detectPhoneColumn(headers: string[]): string | null {
  const phonePatterns = ['טלפון', 'phone', 'tel', 'mobile', 'מספר', 'נייד'];
  // Exact match first
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (phonePatterns.some((p) => lower === p)) return h;
  }
  // Contains match
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (phonePatterns.some((p) => lower.includes(p))) return h;
  }
  // Fallback: first column
  return headers[0] ?? null;
}

/**
 * Detect which column header is the name column.
 */
function detectNameColumn(headers: string[]): string | null {
  const namePatterns = ['שם', 'name', 'guest', 'אורח'];
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (namePatterns.some((p) => lower === p || lower.includes(p))) return h;
  }
  // If there are exactly 2 columns, second one is the name
  if (headers.length === 2) return headers[1];
  return null;
}

// ─── Validation Pipeline ────────────────────────────────

/**
 * Validate parsed rows against existing phone numbers.
 * Returns structured result with added/duplicate/invalid counts.
 */
export function validateGuestRows(
  rows: RawRow[],
  existingPhones: Set<string>
): UploadValidationResult {
  const errors: UploadRowError[] = [];
  const validGuests: ParsedGuest[] = [];
  const batchPhones = new Set<string>();
  let duplicates = 0;
  let invalid = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-based, +1 for header row

    // Smart parsing: if phone looks like a number (no leading zero), prepend '0'
    let rawPhone = row.phone;
    if (/^\d{8,9}$/.test(rawPhone) && !rawPhone.startsWith('0')) {
      rawPhone = '0' + rawPhone;
    }

    // Normalize
    const normalized = normalizePhone(rawPhone);
    if (!normalized) {
      invalid++;
      errors.push({
        row: rowNum,
        phone: row.phone,
        reason: `שורה ${rowNum}: "${row.phone}" - מספר לא תקין (רק סלולרי ישראלי)`,
      });
      continue;
    }

    // Validate Israeli mobile
    if (!isValidIsraeliMobile(rawPhone)) {
      invalid++;
      errors.push({
        row: rowNum,
        phone: row.phone,
        reason: `שורה ${rowNum}: "${row.phone}" - מספר לא תקין (רק סלולרי ישראלי)`,
      });
      continue;
    }

    // Duplicate check: against existing list
    if (existingPhones.has(normalized)) {
      duplicates++;
      continue;
    }

    // Duplicate check: against this batch
    if (batchPhones.has(normalized)) {
      duplicates++;
      continue;
    }

    batchPhones.add(normalized);

    // Sanitize name
    const guestName = row.name
      ? sanitizeWithLimit(row.name, MAX_GUEST_NAME_LENGTH)
      : null;

    validGuests.push({ phone: normalized, guest_name: guestName });
  }

  return {
    success: errors.length === 0,
    added: validGuests.length,
    duplicates,
    invalid,
    errors,
    validGuests,
  };
}

// ─── Convenience: Full Pipeline ─────────────────────────

/**
 * Full pipeline: parse file → validate → return results.
 */
export async function processGuestUpload(
  buffer: Buffer,
  filename: string,
  existingPhones: Set<string>
): Promise<UploadValidationResult & { parseError?: string }> {
  const { rows, error: parseError } = await parseGuestFile(buffer, filename);

  if (parseError) {
    return {
      success: false,
      added: 0,
      duplicates: 0,
      invalid: 0,
      errors: [],
      validGuests: [],
      parseError,
    };
  }

  if (rows.length === 0) {
    return {
      success: false,
      added: 0,
      duplicates: 0,
      invalid: 0,
      errors: [],
      validGuests: [],
      parseError: 'הקובץ ריק - אין מספרי טלפון',
    };
  }

  return { ...validateGuestRows(rows, existingPhones) };
}

// ─── Excel Template Generation ──────────────────────────

/**
 * Generate a downloadable Excel template (.xlsx) with Hebrew headers
 * and example rows for the guest upload portal.
 */
export async function generateGuestTemplate(): Promise<Buffer> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Main sheet: "אורחים"
  const guestData = [
    ['טלפון', 'שם (אופציונלי)'],
    ['0501234567', 'דנה כהן'],
    ['052-1234567', 'יוסי לוי'],
    ['0541234567', ''],
  ];
  const guestSheet = XLSX.utils.aoa_to_sheet(guestData);
  // Set column widths
  guestSheet['!cols'] = [{ wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, guestSheet, 'אורחים');

  // Instructions sheet: "הנחיות"
  const instructionsData = [
    ['הנחיות להעלאת רשימת אורחים'],
    [''],
    ['1. הזינו מספרי טלפון ישראליים (מתחילים ב-05)'],
    ['2. אפשר עם מקף (052-1234567) או בלי (0521234567) - שניהם תקינים'],
    ['3. עמודת השם היא אופציונלית - אפשר להשאיר ריק'],
    ['4. כל שורה = אורח/ת אחד/ת'],
    ['5. מקסימום 500 אורחים בקובץ'],
    ['6. מספרים כפולים יסוננו אוטומטית'],
    ['7. אפשר להעלות קבצים נוספים - הם יתווספו לרשימה הקיימת'],
  ];
  const instrSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instrSheet['!cols'] = [{ wch: 55 }];
  XLSX.utils.book_append_sheet(wb, instrSheet, 'הנחיות');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}
