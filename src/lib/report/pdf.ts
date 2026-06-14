/**
 * Post-event report PDF - dark-themed branded document matching the admin dashboard.
 *
 * Rendered server-side with jsPDF + an embedded Noto Sans Hebrew font. The layout and
 * color palette mirror the dark admin "דוח לקוח" dashboard so the email attachment
 * looks identical to what the admin sees.
 *
 * If jsPDF generation ever fails, we fall back to a minimal ASCII PDF so the report email
 * can still ship an attachment rather than nothing.
 */
import { jsPDF } from 'jspdf';
import type { CuratedReportPayload } from './curate';
import { NOTO_HEBREW_REGULAR_B64, NOTO_HEBREW_BOLD_B64 } from './fonts/noto-hebrew';

const FONT = 'NotoHebrew';

type RGB = [number, number, number];

/* ── Dark dashboard palette ── */
const COL = {
  bg: [14, 13, 24] as RGB,           // #0e0d18 - page background
  cardBg: [22, 21, 42] as RGB,        // #16152a - card background
  cardBgAlt: [28, 27, 52] as RGB,     // slightly lighter card
  headerBg: [10, 9, 18] as RGB,       // header band
  white: [255, 255, 255] as RGB,
  muted: [160, 155, 200] as RGB,      // muted text
  dim: [90, 85, 130] as RGB,          // very dim text
  divider: [35, 33, 65] as RGB,       // divider lines
  // KPI accent colours (matching dashboard)
  green: [52, 211, 153] as RGB,       // matches/התאמות
  teal: [45, 212, 191] as RGB,        // conversations/שיחות
  pink: [236, 72, 153] as RGB,        // likes/לייקים
  purple: [139, 92, 246] as RGB,      // participants/משתתפים
  orange: [249, 115, 22] as RGB,      // messages/הודעות
  gold: [234, 179, 8] as RGB,         // avg messages
  brand: [212, 165, 154] as RGB,      // #D4A59A - Eventa brand accent
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

  // Use a custom-height page (wider than A4 to fit dashboard density)
  const W = 595;
  const doc = new jsPDF({ unit: 'pt', format: [W, 1050], orientation: 'portrait' });
  doc.addFileToVFS('NotoHebrew-Regular.ttf', NOTO_HEBREW_REGULAR_B64);
  doc.addFont('NotoHebrew-Regular.ttf', FONT, 'normal');
  doc.addFileToVFS('NotoHebrew-Bold.ttf', NOTO_HEBREW_BOLD_B64);
  doc.addFont('NotoHebrew-Bold.ttf', FONT, 'bold');

  const H = doc.internal.pageSize.getHeight();
  const M = 24;
  const right = W - M;

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const heR = (t: string, x: number, yy: number, size: number, color: RGB, bold = false) => {
    doc.setFont(FONT, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setText(color);
    doc.text(rtl(t), x, yy, { align: 'right' });
  };
  const heC = (t: string, x: number, yy: number, size: number, color: RGB, bold = false) => {
    doc.setFont(FONT, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setText(color);
    doc.text(rtl(t), x, yy, { align: 'center' });
  };
  const ltrL = (t: string, x: number, yy: number, size: number, color: RGB, bold = false) => {
    doc.setFont(FONT, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setText(color);
    doc.text(t, x, yy, { align: 'left' });
  };
  const ltrC = (t: string, x: number, yy: number, size: number, color: RGB, bold = false) => {
    doc.setFont(FONT, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setText(color);
    doc.text(t, x, yy, { align: 'center' });
  };

  // ── Page background ──
  setFill(COL.bg);
  doc.rect(0, 0, W, H, 'F');

  // ── Header ──
  setFill(COL.headerBg);
  doc.rect(0, 0, W, 70, 'F');
  // Thin brand accent line at bottom of header
  setFill(COL.brand);
  doc.rect(0, 68, W, 2, 'F');

  doc.setFont(FONT, 'bold');
  doc.setFontSize(20);
  setText(COL.white);
  doc.text('EVENTA', M, 36);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  setText(COL.muted);
  doc.text(rtl('פלטפורמת הכרויות לאירועים'), M, 52);

  // Event name (RTL) + date
  heR(eventName, right, 32, 15, COL.white, true);
  const dateStr = fmtHebrewDate(eventDate || payload.generated_at);
  if (dateStr) heR(dateStr, right, 50, 9, COL.brand);

  let y = 90;

  // ── Helper: draw a dark KPI card ──
  const kpiCard = (
    x: number, cardY: number, cW: number, cH: number,
    value: string, label: string, color: RGB,
    sub?: string,
  ) => {
    setFill(COL.cardBg);
    doc.roundedRect(x, cardY, cW, cH, 6, 6, 'F');
    // Top accent stripe
    setFill(color);
    doc.roundedRect(x, cardY, cW, 3, 2, 2, 'F');
    doc.rect(x, cardY + 1, cW, 2, 'F'); // square bottom of stripe
    // Value (number)
    ltrC(value, x + cW / 2, cardY + cH * 0.52, 22, color, true);
    // Label
    heC(label, x + cW / 2, cardY + cH * 0.76, 8.5, COL.muted);
    // Sub-label (e.g. percentage)
    if (sub) heC(sub, x + cW / 2, cardY + cH * 0.91, 7.5, color);
  };

  // ── Row 1: 4 main KPI cards ──
  const gap = 10;
  const row1H = 80;
  const cW4 = (W - 2 * M - 3 * gap) / 4;

  const matchPct = network.total_participants > 0
    ? `${Math.round((network.participants_with_matches / network.total_participants) * 100)}%`
    : '0%';

  kpiCard(M, y, cW4, row1H, String(network.total_participants), 'משתתפים', COL.purple);
  kpiCard(M + cW4 + gap, y, cW4, row1H, String(engagement.total_likes), 'לייקים', COL.pink);
  kpiCard(M + 2 * (cW4 + gap), y, cW4, row1H,
    String(engagement.mutual_likes), 'התאמות הדדיות', COL.green, matchPct + ' התאמות');
  kpiCard(M + 3 * (cW4 + gap), y, cW4, row1H,
    String(engagement.total_conversations), 'שיחות', COL.teal);
  y += row1H + 10;

  // ── Row 2: 4 secondary KPI cards ──
  const row2H = 80;
  const deepPct = engagement.total_conversations > 0
    ? `${Math.round((engagement.conversations_with_3plus_messages / engagement.total_conversations) * 100)}%`
    : '0%';

  kpiCard(M, y, cW4, row2H,
    String(engagement.total_messages), 'הודעות', COL.gold);
  kpiCard(M + cW4 + gap, y, cW4, row2H,
    String(engagement.avg_messages_per_conversation?.toFixed?.(1) ?? engagement.avg_messages_per_conversation), 'ממוצע הודעות לשיחה', COL.orange);
  kpiCard(M + 2 * (cW4 + gap), y, cW4, row2H,
    String(engagement.conversations_with_3plus_messages), 'שיחות עמוקות (+3)', COL.pink, deepPct + ' מהשיחות');
  kpiCard(M + 3 * (cW4 + gap), y, cW4, row2H,
    String(network.isolated_participants), 'ללא פעילות', COL.dim);
  y += row2H + 16;

  // ── Helper: section header ──
  const sectionHeader = (label: string) => {
    heR(label, right, y, 11, COL.brand, true);
    y += 5;
    setFill(COL.divider);
    doc.rect(M, y, W - 2 * M, 1, 'F');
    y += 12;
  };

  // ── Gender + Network split (two panels side by side) ──
  const men = sumGender(crosstabs?.gender_distribution, 'male');
  const women = sumGender(crosstabs?.gender_distribution, 'female');
  const total = network.total_participants || 1;
  const menPct = Math.round((men / total) * 100);
  const womenPct = Math.round((women / total) * 100);

  const panelW = (W - 2 * M - gap) / 2;
  const panelY = y;
  const panelH = 110;

  // Left panel: Gender
  setFill(COL.cardBg);
  doc.roundedRect(M, panelY, panelW, panelH, 6, 6, 'F');
  heR('חלוקה מגדרית', M + panelW, panelY + 18, 10, COL.muted, true);

  // Gender bars
  const barY1 = panelY + 32;
  const barY2 = panelY + 58;
  const barW = panelW - 24;
  // Men bar
  setFill(COL.divider);
  doc.roundedRect(M + 12, barY1, barW, 14, 3, 3, 'F');
  setFill(COL.purple);
  doc.roundedRect(M + 12 + barW - Math.max((menPct / 100) * barW, 4), barY1,
    Math.max((menPct / 100) * barW, 4), 14, 3, 3, 'F');
  heR(`גברים  ${men}`, M + panelW - 4, barY1 + 10, 8.5, COL.muted);
  ltrL(`${menPct}%`, M + 14, barY1 + 10, 8, COL.purple, true);

  // Women bar
  setFill(COL.divider);
  doc.roundedRect(M + 12, barY2, barW, 14, 3, 3, 'F');
  setFill(COL.pink);
  doc.roundedRect(M + 12 + barW - Math.max((womenPct / 100) * barW, 4), barY2,
    Math.max((womenPct / 100) * barW, 4), 14, 3, 3, 'F');
  heR(`נשים  ${women}`, M + panelW - 4, barY2 + 10, 8.5, COL.muted);
  ltrL(`${womenPct}%`, M + 14, barY2 + 10, 8, COL.pink, true);

  // Gender total label
  heR(`${total} משתתפים סה״כ`, M + panelW - 4, panelY + panelH - 12, 8, COL.dim);

  // Right panel: Network stats
  const rxStart = M + panelW + gap;
  setFill(COL.cardBg);
  doc.roundedRect(rxStart, panelY, panelW, panelH, 6, 6, 'F');
  heR('חיבורי רשת משתתפים', rxStart + panelW, panelY + 18, 10, COL.muted, true);

  const netStats = [
    { label: 'קיבלו התאמה לפחות אחת', value: `${String(network.participants_with_matches)} (${Math.round((network.participants_with_matches / total) * 100)}%)`, color: COL.green },
    { label: 'שלחו או קיבלו הודעות', value: `${String(network.participants_with_messages)} (${Math.round((network.participants_with_messages / total) * 100)}%)`, color: COL.teal },
    { label: 'ללא אינטראקציה כלל', value: `${String(network.isolated_participants)} (${Math.round((network.isolated_participants / total) * 100)}%)`, color: COL.dim },
    { label: 'ממוצע לייקים שנשלחו', value: String(typeof network.avg_likes_sent === 'number' ? network.avg_likes_sent.toFixed(1) : '–'), color: COL.pink },
  ];
  netStats.forEach((s, i) => {
    const ry = panelY + 30 + i * 18;
    heR(s.label, rxStart + panelW - 4, ry, 8, COL.muted);
    ltrL(s.value, rxStart + 8, ry, 8.5, s.color, true);
  });

  y = panelY + panelH + 16;

  // ── Funnel ──
  sectionHeader('משפך הצטרפות');
  const steps = (funnel?.steps ?? []).slice(0, 6);
  const maxCount = steps.reduce((m, s) => Math.max(m, s.count), 0) || 1;
  const fBarLeft = M;
  const fBarRight = right - 140;
  const fBarW = fBarRight - fBarLeft;

  for (const step of steps) {
    const pct = step.count / maxCount;
    heR(FUNNEL_HE[step.step] ?? step.step, right, y, 9, COL.muted);
    setFill(COL.divider);
    doc.roundedRect(fBarLeft, y - 8, fBarW, 11, 2, 2, 'F');
    const fw = Math.max(pct * fBarW, step.count > 0 ? 4 : 0);
    setFill(COL.brand);
    doc.roundedRect(fBarRight - fw, y - 8, fw, 11, 2, 2, 'F');
    ltrL(String(step.count), fBarLeft, y, 9, COL.brand, true);
    y += 18;
  }
  if (funnel?.top_drop_off) {
    heR(`נקודת הנשירה הגדולה: ${FUNNEL_HE[funnel.top_drop_off] ?? funnel.top_drop_off}`, right, y, 8, COL.dim);
    y += 14;
  }
  y += 8;

  // ── Conversation depth ──
  sectionHeader('שיחות ומעורבות');
  const convRows = [
    { label: 'סך שיחות', value: String(engagement.total_conversations), color: COL.teal },
    { label: 'שיחות קצרות (1-2 הודעות)', value: String(engagement.total_conversations - engagement.conversations_with_3plus_messages), color: COL.muted },
    { label: 'שיחות עמוקות (3+ הודעות)', value: String(engagement.conversations_with_3plus_messages), color: COL.green },
    { label: 'ממוצע הודעות לשיחה', value: String(engagement.avg_messages_per_conversation?.toFixed?.(1) ?? '–'), color: COL.orange },
    { label: 'סך הודעות', value: String(engagement.total_messages), color: COL.gold },
  ];
  const colW2 = (W - 2 * M - 16) / 2;
  for (let i = 0; i < convRows.length; i += 2) {
    const ry = y;
    const a = convRows[i];
    const b = convRows[i + 1];
    heR(a.label, right, ry, 9, COL.muted);
    ltrL(a.value, right - colW2 + 4, ry, 10, a.color, true);
    if (b) {
      heR(b.label, M + colW2, ry, 9, COL.muted);
      ltrL(b.value, M, ry, 10, b.color, true);
    }
    y = ry + 17;
  }
  y += 8;

  // ── Safety ──
  sectionHeader('בטיחות');
  const safetyRows = [
    { label: 'חסימות', value: String(safety.total_blocks), color: COL.orange },
    { label: 'משתתפים שהוסרו', value: String(safety.deleted_participants ?? 0), color: COL.dim },
  ];
  const ry0 = y;
  heR(safetyRows[0].label, right, ry0, 9, COL.muted);
  ltrL(safetyRows[0].value, right - colW2 + 4, ry0, 10, safetyRows[0].color, true);
  heR(safetyRows[1].label, M + colW2, ry0, 9, COL.muted);
  ltrL(safetyRows[1].value, M, ry0, 10, safetyRows[1].color, true);
  y += 20;

  // ── AI Summary ──
  if (aiSummary && aiSummary.trim() && y < H - 80) {
    sectionHeader('סיכום');
    setFill(COL.cardBgAlt);
    const summaryBoxY = y - 4;
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9.5);
    setText(COL.muted);
    const wrapped = doc.splitTextToSize(aiSummary.trim(), W - 2 * M - 24) as string[];
    const lineH = 14;
    const maxLines = Math.max(0, Math.floor((H - 50 - y) / lineH));
    const visibleLines = wrapped.slice(0, maxLines);
    const boxH = visibleLines.length * lineH + 16;
    doc.roundedRect(M, summaryBoxY, W - 2 * M, boxH, 5, 5, 'F');
    for (const line of visibleLines) {
      doc.text(rtl(line), right - 8, y + 8, { align: 'right' });
      y += lineH;
    }
    y += 20;
  }

  // ── Footer ──
  setFill(COL.divider);
  doc.rect(M, H - 28, W - 2 * M, 1, 'F');
  setText(COL.dim);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(8);
  doc.text(`\u00A9 Eventa ${new Date().getFullYear()}`, W / 2, H - 14, { align: 'center' });
  heR(rtl('כל הזכויות שמורות'), right, H - 14, 8, COL.dim);

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
