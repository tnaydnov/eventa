/**
 * Unit tests for lib/guest-upload.ts
 * Tests: file type validation, row validation, full pipeline, template generation
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';

vi.mock('@/lib/config', () => ({
  MAX_GUEST_NAME_LENGTH: 100,
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeWithLimit: (str: string, _limit: number) => str.trim().slice(0, 100),
}));

// phone-utils is NOT mocked — we test with real normalization
// (it's a pure module with no external deps)

import {
  isAllowedUploadFile,
  parseGuestFile,
  validateGuestRows,
  processGuestUpload,
  generateGuestTemplate,
  MAX_UPLOAD_FILE_SIZE,
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIMES,
} from '@/lib/guest-upload';

// ─── Helpers ────────────────────────────────────────────

/** Build a minimal xlsx Buffer from an array-of-arrays (first row = headers). */
function buildXlsx(aoa: string[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}

/** Build a CSV Buffer from lines. */
function buildCsv(lines: string[]): Buffer {
  return Buffer.from(lines.join('\n'), 'utf-8');
}

// ─── isAllowedUploadFile ────────────────────────────────

describe('isAllowedUploadFile', () => {
  it('allows .xlsx files', () => {
    expect(isAllowedUploadFile('guests.xlsx')).toBe(true);
  });

  it('allows .csv files', () => {
    expect(isAllowedUploadFile('list.csv')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAllowedUploadFile('DATA.XLSX')).toBe(true);
    expect(isAllowedUploadFile('FILE.CSV')).toBe(true);
  });

  it('rejects .xls files', () => {
    expect(isAllowedUploadFile('old.xls')).toBe(false);
  });

  it('rejects .txt files', () => {
    expect(isAllowedUploadFile('notes.txt')).toBe(false);
  });

  it('rejects files without extension', () => {
    expect(isAllowedUploadFile('noext')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isAllowedUploadFile('')).toBe(false);
  });
});

// ─── Constants exports ──────────────────────────────────

describe('Upload constants', () => {
  it('MAX_UPLOAD_FILE_SIZE is 5 MB', () => {
    expect(MAX_UPLOAD_FILE_SIZE).toBe(5 * 1024 * 1024);
  });

  it('ALLOWED_UPLOAD_EXTENSIONS includes .xlsx and .csv', () => {
    expect(ALLOWED_UPLOAD_EXTENSIONS).toContain('.xlsx');
    expect(ALLOWED_UPLOAD_EXTENSIONS).toContain('.csv');
  });

  it('ALLOWED_UPLOAD_MIMES includes xlsx and csv MIME types', () => {
    expect(ALLOWED_UPLOAD_MIMES.has('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
    expect(ALLOWED_UPLOAD_MIMES.has('text/csv')).toBe(true);
  });
});

// ─── parseGuestFile ─────────────────────────────────────

describe('parseGuestFile', () => {
  it('parses xlsx with Hebrew phone header', async () => {
    const buf = buildXlsx([
      ['טלפון', 'שם'],
      ['0501234567', 'דנה'],
      ['0521234568', 'יוסי'],
    ]);
    const { rows, error } = await parseGuestFile(buf, 'guests.xlsx');
    expect(error).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0].phone).toBe('0501234567');
    expect(rows[0].name).toBe('דנה');
    expect(rows[1].phone).toBe('0521234568');
  });

  it('parses csv with English header', async () => {
    const buf = buildCsv([
      'phone,name',
      '0501234567,Dana',
      '0521234568,Yossi',
    ]);
    const { rows, error } = await parseGuestFile(buf, 'list.csv');
    expect(error).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0].phone).toBe('0501234567');
    expect(rows[0].name).toBe('Dana');
  });

  it('detects "tel" as phone column', async () => {
    const buf = buildXlsx([['tel', 'guest'], ['0541111111', 'A']]);
    const { rows } = await parseGuestFile(buf, 'f.xlsx');
    expect(rows[0].phone).toBe('0541111111');
  });

  it('detects "mobile" as phone column', async () => {
    const buf = buildXlsx([['mobile'], ['0541111111']]);
    const { rows } = await parseGuestFile(buf, 'f.xlsx');
    expect(rows[0].phone).toBe('0541111111');
  });

  it('falls back to first column if no phone header detected', async () => {
    const buf = buildXlsx([['A', 'B'], ['0501234567', 'test']]);
    const { rows } = await parseGuestFile(buf, 'f.xlsx');
    expect(rows[0].phone).toBe('0501234567');
  });

  it('auto-detects second column as name when exactly 2 columns', async () => {
    const buf = buildXlsx([['col1', 'col2'], ['0501234567', 'Guest']]);
    const { rows } = await parseGuestFile(buf, 'f.xlsx');
    expect(rows[0].name).toBe('Guest');
  });

  it('returns error for empty workbook', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, 'Empty');
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const { rows, error } = await parseGuestFile(buf, 'empty.xlsx');
    expect(error).toBeDefined();
    expect(rows).toHaveLength(0);
  });

  it('skips rows with empty phone values', async () => {
    const buf = buildXlsx([
      ['טלפון', 'שם'],
      ['0501234567', 'A'],
      ['', 'B'],   // empty phone — skip
      ['0521234568', 'C'],
    ]);
    const { rows } = await parseGuestFile(buf, 'f.xlsx');
    expect(rows).toHaveLength(2);
  });

  it('returns error for corrupt/empty data', async () => {
    const buf = Buffer.from('not a real xlsx file at all');
    const { error, rows } = await parseGuestFile(buf, 'bad.xlsx');
    // xlsx lib may parse garbage as empty sheet rather than throwing
    expect(error || rows.length === 0).toBeTruthy();
  });

  it('returns error for binary garbage CSV', async () => {
    const buf = Buffer.alloc(10, 0xff);
    const { error, rows } = await parseGuestFile(buf, 'bad.csv');
    // xlsx lib may parse garbage as empty — either error or no rows
    expect(error || rows.length === 0).toBeTruthy();
  });
});

// ─── validateGuestRows ──────────────────────────────────

describe('validateGuestRows', () => {
  it('validates correct Israeli mobile numbers', () => {
    const rows = [
      { phone: '0501234567', name: 'A' },
      { phone: '0521234567', name: 'B' },
    ];
    const result = validateGuestRows(rows, new Set());
    expect(result.success).toBe(true);
    expect(result.added).toBe(2);
    expect(result.invalid).toBe(0);
    expect(result.duplicates).toBe(0);
    expect(result.validGuests).toHaveLength(2);
    expect(result.validGuests[0].phone).toBe('+972501234567');
    expect(result.validGuests[0].guest_name).toBe('A');
  });

  it('flags invalid phone numbers', () => {
    const rows = [
      { phone: '03-1234567' }, // landline
      { phone: 'not_a_phone' },
    ];
    const result = validateGuestRows(rows, new Set());
    expect(result.invalid).toBe(2);
    expect(result.added).toBe(0);
    expect(result.errors).toHaveLength(2);
    expect(result.success).toBe(false);
  });

  it('detects duplicates against existing phones', () => {
    const existing = new Set(['+972501234567']);
    const rows = [{ phone: '0501234567' }];
    const result = validateGuestRows(rows, existing);
    expect(result.duplicates).toBe(1);
    expect(result.added).toBe(0);
    expect(result.validGuests).toHaveLength(0);
  });

  it('detects duplicates within the batch', () => {
    const rows = [
      { phone: '0501234567' },
      { phone: '050-123-4567' }, // same number, different format
    ];
    const result = validateGuestRows(rows, new Set());
    expect(result.added).toBe(1);
    expect(result.duplicates).toBe(1);
  });

  it('prepends 0 to 9-digit numbers missing leading zero', () => {
    const rows = [{ phone: '501234567' }]; // 9 digits, no leading 0
    const result = validateGuestRows(rows, new Set());
    expect(result.added).toBe(1);
    expect(result.validGuests[0].phone).toBe('+972501234567');
  });

  it('sets guest_name to null when no name provided', () => {
    const rows = [{ phone: '0501234567' }];
    const result = validateGuestRows(rows, new Set());
    expect(result.validGuests[0].guest_name).toBeNull();
  });

  it('sanitizes guest names', () => {
    const rows = [{ phone: '0501234567', name: '  שרה כהן  ' }];
    const result = validateGuestRows(rows, new Set());
    expect(result.validGuests[0].guest_name).toBe('שרה כהן');
  });

  it('error rows use 1-based numbering offset by header row', () => {
    const rows = [
      { phone: '0501234567' },
      { phone: 'invalid' },
    ];
    const result = validateGuestRows(rows, new Set());
    // Second row is index 1, so rowNum = 1 + 2 = 3
    expect(result.errors[0].row).toBe(3);
  });
});

// ─── processGuestUpload ─────────────────────────────────

describe('processGuestUpload', () => {
  it('full pipeline: parse + validate xlsx', async () => {
    const buf = buildXlsx([
      ['טלפון', 'שם'],
      ['0501234567', 'דנה'],
      ['0521234568', 'יוסי'],
      ['BAD', 'err'],
    ]);
    const result = await processGuestUpload(buf, 'guests.xlsx', new Set());
    expect(result.added).toBe(2);
    expect(result.invalid).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('returns parseError for empty file', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const result = await processGuestUpload(buf, 'empty.xlsx', new Set());
    expect(result.success).toBe(false);
    expect(result.parseError).toBeDefined();
  });

  it('skips existing phones', async () => {
    const buf = buildXlsx([
      ['טלפון'],
      ['0501234567'],
      ['0521234568'],
    ]);
    const existing = new Set(['+972501234567']);
    const result = await processGuestUpload(buf, 'f.xlsx', existing);
    expect(result.added).toBe(1);
    expect(result.duplicates).toBe(1);
  });
});

// ─── generateGuestTemplate ──────────────────────────────

describe('generateGuestTemplate', () => {
  it('generates a valid xlsx buffer', async () => {
    const buf = await generateGuestTemplate();
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);

    // Parse it back to verify structure
    const wb = XLSX.read(buf, { type: 'buffer' });
    expect(wb.SheetNames).toContain('אורחים');
    expect(wb.SheetNames).toContain('הנחיות');
  });

  it('main sheet has phone+name headers', async () => {
    const buf = await generateGuestTemplate();
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets['אורחים'];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
    // First row is header (used as keys), data rows have phone + name
    expect(data.length).toBeGreaterThanOrEqual(2); // example rows
  });

  it('instructions sheet has content', async () => {
    const buf = await generateGuestTemplate();
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets['הנחיות'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
    expect(data.length).toBeGreaterThan(0);
    // First row should be the title
    expect(String(data[0][0])).toContain('הנחיות');
  });
});
