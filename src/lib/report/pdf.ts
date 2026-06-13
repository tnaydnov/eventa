/**
 * Post-event report PDF - a clean, branded, single-page Hebrew document.
 *
 * Rendered server-side with jsPDF + an embedded Noto Sans Hebrew font, so the PDF shows
 * real Hebrew (the previous implementation used an ASCII-only core font that stripped all
 * Hebrew). The layout mirrors the brand language of the client report ("דוח לקוח"):
 * cream background, dark header, KPI cards, accent colour, all data inline - and NO link
 * (everything the client needs is in the PDF itself).
 *
 * If jsPDF generation ever fails, we fall back to a minimal ASCII PDF so the report email
 * can still ship an attachment rather than nothing.
 */
import { jsPDF } from 'jspdf';
import type { CuratedReportPayload } from './curate';
import { NOTO_HEBREW_REGULAR_B64, NOTO_HEBREW_BOLD_B64 } from './fonts/noto-hebrew';

const FONT = 'NotoHebrew';

type RGB = [number, number, number];

/* ── Brand palette (matches the email templates) ── */
const COL = {
  ink: [30, 30, 30] as RGB,
  muted: [107, 107, 107] as RGB,
  dim: [153, 153, 153] as RGB,
  accent: [176, 141, 126] as RGB,   // #b08d7e
  accentBg: [250, 246, 244] as RGB, // #faf6f4
  card: [255, 255, 255] as RGB,
  bg: [245, 243, 240] as RGB,       // #f5f3f0
  dark: [10, 10, 10] as RGB,        // header band
  line: [236, 231, 228] as RGB,
};

/** Hebrew funnel-step labels (mirrors the admin report). */
const FUNNEL_HE: Record<string, string> = {
  qr_scan: 'סריקת QR',
  join_page_view: 'צפייה בדף הצטרפות',
  otp_requested: 'בקשת קוד SMS',
  otp_verified: 'אימות קוד',
  setup_started: 'התחלת פרופיל',
  profile_complete: 'השלמת פרופיל',
};

/**
 * Re-order a logical string into visual order for RTL display. jsPDF draws glyphs
 * left-to-right with no bidi support, so Hebrew must be reversed while embedded
 * Latin/number runs stay intact. Good enough for report labels + short sentences.
 */
function rtl(input: string): string {
  if (!input) return '';
  const isHeb = (ch: string) => {
    const c = ch.codePointAt(0)!;
    return c >= 0x0590 && c <= 0x05ff;
  };
  // Neutrals (spaces + common punctuation) attach to the surrounding run.
  const isNeutral = (ch: string) => /[\s,.!?:;%\-/+()'"\u2013\u2014\u00b7]/.test(ch);

  type Run = { rtl: boolean; chars: string[] };
  const runs: Run[] = [];
  let cur: boolean | null = null;
  for (const ch of input) {
    let r: boolean;
    if (isHeb(ch)) r = true;
    else if (isNeutral(ch)) r = cur ?? false;
    else r = false;
    if (cur === null || r !== cur) {
      runs.push({ rtl: r, chars: [ch] });
      cur = r;
    } else {
      runs[runs.length - 1].chars.push(ch);
    }
  }
  const out: string[] = [];
  for (let i = runs.length - 1; i >= 0; i--) {
    const run = runs[i];
    out.push(run.rtl ? run.chars.slice().reverse().join('') : run.chars.join(''));
  }
  return out.join('');
}

function fmtHebrewDate(iso: string | undefined | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function sumGender(dist: { label: string; count: number }[] | undefined, label: string): number {
  if (!dist) return 0;
  return dist.filter((d) => d.label === label).reduce((a, d) => a + d.count, 0);
}

export function toReportPdfFilename(eventName: string): string {
  const base = eventName
    .replace(/[^\x20-\x7E]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'event';
  return `eventa-report-${base}.pdf`;
}

export interface ReportPdfParams {
  eventName: string;
  eventId: string;
  payload: CuratedReportPayload;
  aiSummary?: string | null;
  /** Event date (ISO). Falls back to the report generation date. */
  eventDate?: string | null;
}

export function generateReportPdf(params: ReportPdfParams): Buffer {
  try {
    return buildStyledPdf(params);
  } catch {
    // Defensive fallback so the email can still attach *something* if jsPDF fails.
    return buildAsciiFallback(params);
  }
}

function buildStyledPdf(params: ReportPdfParams): Buffer {
  const { eventName, payload, aiSummary, eventDate } = params;
  const { engagement, network, funnel, safety, crosstabs } = payload;

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  doc.addFileToVFS('NotoHebrew-Regular.ttf', NOTO_HEBREW_REGULAR_B64);
  doc.addFont('NotoHebrew-Regular.ttf', FONT, 'normal');
  doc.addFileToVFS('NotoHebrew-Bold.ttf', NOTO_HEBREW_BOLD_B64);
  doc.addFont('NotoHebrew-Bold.ttf', FONT, 'bold');

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;            // page margin
  const right = W - M;     // right edge for RTL text

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const heR = (t: string, x: number, yy: number, size: number, color: RGB, bold = false) => {
    doc.setFont(FONT, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setText(color);
    doc.text(rtl(t), x, yy, { align: 'right' });
  };
  const ltrL = (t: string, x: number, yy: number, size: number, color: RGB, bold = false) => {
    doc.setFont(FONT, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setText(color);
    doc.text(t, x, yy, { align: 'left' });
  };

  // Page background
  setFill(COL.bg);
  doc.rect(0, 0, W, H, 'F');

  // Header band
  setFill(COL.dark);
  doc.rect(0, 0, W, 84, 'F');
  doc.setFont(FONT, 'bold');
  doc.setFontSize(22);
  setText([255, 255, 255]);
  doc.text('EVENTA', W / 2, 46, { align: 'center' });
  doc.setFont(FONT, 'normal');
  doc.setFontSize(11);
  setText([200, 200, 200]);
  doc.text(rtl('דוח סיכום אירוע'), W / 2, 66, { align: 'center' });

  let y = 124;

  // Event title + date
  heR(eventName, right, y, 20, COL.ink, true);
  y += 22;
  const dateStr = fmtHebrewDate(eventDate || payload.generated_at);
  if (dateStr) heR(dateStr, right, y, 11, COL.muted);
  y += 26;

  // ── KPI cards ──
  const kpis: { value: string; label: string }[] = [
    { value: String(network.total_participants), label: 'משתתפים' },
    { value: String(engagement.mutual_likes), label: 'התאמות' },
    { value: `${Math.round(engagement.match_rate)}%`, label: 'אחוז התאמות' },
  ];
  const gap = 12;
  const cardW = (W - 2 * M - 2 * gap) / 3;
  const cardH = 72;
  kpis.forEach((k, i) => {
    // Right-to-left order: first KPI is the rightmost card.
    const x = right - cardW - i * (cardW + gap);
    setFill(COL.accentBg);
    doc.roundedRect(x, y, cardW, cardH, 8, 8, 'F');
    setFill(COL.accent);
    doc.rect(x, y, cardW, 3, 'F'); // top accent strip
    doc.setFont(FONT, 'bold');
    doc.setFontSize(26);
    setText(COL.accent);
    doc.text(k.value, x + cardW / 2, y + 40, { align: 'center' });
    doc.setFont(FONT, 'normal');
    doc.setFontSize(11);
    setText(COL.muted);
    doc.text(rtl(k.label), x + cardW / 2, y + 60, { align: 'center' });
  });
  y += cardH + 28;

  // ── Section title with underline ──
  const sectionTitle = (t: string) => {
    heR(t, right, y, 13, COL.ink, true);
    y += 8;
    doc.setDrawColor(COL.line[0], COL.line[1], COL.line[2]);
    doc.setLineWidth(1);
    doc.line(M, y, right, y);
    y += 18;
  };

  // Two-column "label : value" rows (label RTL on the right, number LTR on the left).
  const rowPairs = (pairs: { label: string; value: string }[]) => {
    const colW = (W - 2 * M - 24) / 2;
    for (let i = 0; i < pairs.length; i += 2) {
      const rowYStart = y;
      const drawPair = (p: { label: string; value: string }, colRight: number) => {
        heR(p.label, colRight, y, 11, COL.muted);
        ltrL(p.value, colRight - colW, y, 12, COL.ink, true);
      };
      drawPair(pairs[i], right);
      if (pairs[i + 1]) drawPair(pairs[i + 1], right - colW - 24);
      y = rowYStart + 20;
    }
  };

  // ── Engagement ──
  sectionTitle('מדדי מעורבות');
  rowPairs([
    { label: 'לייקים', value: String(engagement.total_likes) },
    { label: 'הודעות', value: String(engagement.total_messages) },
    { label: 'שיחות', value: String(engagement.total_conversations) },
    { label: 'שיחות עם 3+ הודעות', value: String(engagement.conversations_with_3plus_messages) },
    { label: 'ממוצע הודעות לשיחה', value: String(engagement.avg_messages_per_conversation) },
    { label: 'משתתפים עם התאמה', value: String(network.participants_with_matches) },
  ]);
  y += 8;

  // ── Participants split ──
  const men = sumGender(crosstabs?.gender_distribution, 'male');
  const women = sumGender(crosstabs?.gender_distribution, 'female');
  sectionTitle('פילוח משתתפים');
  rowPairs([
    { label: 'גברים', value: String(men) },
    { label: 'נשים', value: String(women) },
    { label: 'השתתפו בשיחות', value: String(network.participants_with_messages) },
    { label: 'ללא פעילות', value: String(network.isolated_participants) },
  ]);
  y += 8;

  // ── Funnel ──
  sectionTitle('משפך הצטרפות');
  const steps = (funnel.steps ?? []).slice(0, 6);
  const maxCount = steps.reduce((m, s) => Math.max(m, s.count), 0) || 1;
  const barLeft = M;
  const barRight = right - 150;
  const barFullW = barRight - barLeft;
  for (const step of steps) {
    heR(FUNNEL_HE[step.step] ?? step.step, right, y, 11, COL.muted);
    setFill(COL.line);
    doc.roundedRect(barLeft, y - 9, barFullW, 12, 3, 3, 'F');
    const w = Math.max((step.count / maxCount) * barFullW, step.count > 0 ? 4 : 0);
    setFill(COL.accent);
    doc.roundedRect(barRight - w, y - 9, w, 12, 3, 3, 'F'); // grows from the right (RTL)
    ltrL(String(step.count), barLeft, y, 10, COL.muted, true);
    y += 20;
  }
  if (funnel.top_drop_off) {
    heR(`נקודת הנשירה הגדולה ביותר: ${FUNNEL_HE[funnel.top_drop_off] ?? funnel.top_drop_off}`, right, y, 10, COL.dim);
    y += 18;
  }
  y += 6;

  // ── Safety ──
  sectionTitle('בטיחות');
  rowPairs([
    { label: 'חסימות', value: String(safety.total_blocks) },
    { label: 'משתתפים שהוסרו', value: String(safety.deleted_participants ?? 0) },
  ]);
  y += 10;

  // ── AI summary (Hebrew) ──
  if (aiSummary && aiSummary.trim() && y < H - 150) {
    sectionTitle('סיכום');
    doc.setFont(FONT, 'normal');
    doc.setFontSize(11);
    setText(COL.ink);
    const wrapped = doc.splitTextToSize(aiSummary.trim(), W - 2 * M) as string[];
    const maxLines = Math.max(0, Math.floor((H - 60 - y) / 16));
    for (const line of wrapped.slice(0, maxLines)) {
      doc.text(rtl(line), right, y, { align: 'right' });
      y += 16;
    }
  }

  // Footer
  setText(COL.dim);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(10);
  doc.text(`Eventa \u00A9 ${new Date().getFullYear()}`, W / 2, H - 28, { align: 'center' });

  const ab = doc.output('arraybuffer');
  return Buffer.from(new Uint8Array(ab));
}

/* ── Minimal ASCII fallback (only used if jsPDF throws) ── */
function buildAsciiFallback(params: ReportPdfParams): Buffer {
  const { eventId, payload } = params;
  const { engagement, network, safety } = payload;
  const lines = [
    'Eventa Post-Event Report',
    `Event ID: ${eventId}`,
    `Generated: ${payload.generated_at}`,
    '',
    `Participants: ${network.total_participants}`,
    `Total likes: ${engagement.total_likes}`,
    `Mutual likes (matches): ${engagement.mutual_likes}`,
    `Match rate: ${engagement.match_rate}%`,
    `Conversations: ${engagement.total_conversations}`,
    `Messages: ${engagement.total_messages}`,
    `Blocks: ${safety.total_blocks}`,
  ];
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let stream = 'BT\n/F1 12 Tf\n1 0 0 1 50 780 Tm\n';
  lines.forEach((l, i) => {
    if (i > 0) stream += '0 -16 Td\n';
    stream += `(${esc(l)}) Tj\n`;
  });
  stream += 'ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
