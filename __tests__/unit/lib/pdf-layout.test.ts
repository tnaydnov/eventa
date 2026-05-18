/**
 * @vitest-environment node
 *
 * Unit tests for pdf-layout utilities — single-page PDF guarantee.
 */

import { describe, expect, it } from 'vitest';
import { calcPdfLayout, calcSinglePage } from '@/lib/report/pdf-layout';

const A4_W = 210;
const A4_H = 297;
const EPS  = 0.001; // floating-point tolerance

describe('calcPdfLayout — single-page guarantee', () => {

  // ──────────────────────────────────────────────
  // Core invariant: output MUST always fit A4
  // ──────────────────────────────────────────────

  it.each([
    [800,  1200],   // compact report
    [800,  1600],   // report with many sections
    [800,  2400],   // long report
    [800,  4000],   // extreme — very long content
    [1600,  800],   // wide/landscape screenshot
    [2100, 2970],   // exact A4 aspect ratio
    [1,    99999],  // degenerate — ultra-tall
    [99999, 1],     // degenerate — ultra-wide
  ] as [number, number][])(
    'imgW and imgH always fit A4 for canvas %ix%i',
    (cw, ch) => {
      const { imgW, imgH } = calcPdfLayout(cw, ch);
      expect(imgW).toBeLessThanOrEqual(A4_W + EPS);
      expect(imgH).toBeLessThanOrEqual(A4_H + EPS);
    },
  );

  // ──────────────────────────────────────────────
  // Normal tall canvas: fills page width
  // ──────────────────────────────────────────────

  it('fills full page width for canvas with aspect < A4 aspect', () => {
    // 1000x1200: aspect 1.2 < A4 aspect 1.414 → width-constrained, no scaling
    const { imgW, imgH, xOffset, wasScaled } = calcPdfLayout(1000, 1200);
    expect(imgW).toBeCloseTo(A4_W);
    expect(imgH).toBeCloseTo(1200 / (1000 / A4_W));
    expect(xOffset).toBe(0);
    expect(wasScaled).toBe(false);
  });

  // ──────────────────────────────────────────────
  // Very tall canvas: must scale down to fit height
  // ──────────────────────────────────────────────

  it('scales down extremely tall canvas so imgH does not exceed A4_H', () => {
    const { imgH, imgW, wasScaled } = calcPdfLayout(1000, 6000);
    expect(wasScaled).toBe(true);
    expect(imgH).toBeCloseTo(A4_H);
    expect(imgW).toBeCloseTo(A4_H / (6000 / 1000));
    expect(imgH).toBeLessThanOrEqual(A4_H + EPS);
  });

  // ──────────────────────────────────────────────
  // Centering: narrow scaled image must be centred
  // ──────────────────────────────────────────────

  it('centres image horizontally when height-constrained', () => {
    const { imgW, xOffset } = calcPdfLayout(500, 5000);
    expect(xOffset).toBeGreaterThan(0);
    expect(xOffset).toBeCloseTo((A4_W - imgW) / 2);
  });

  it('has xOffset = 0 when image is width-constrained', () => {
    // aspect 1.2 < A4 aspect → fills full width, no horizontal offset
    const { xOffset } = calcPdfLayout(1000, 1200);
    expect(xOffset).toBe(0);
  });

  // ──────────────────────────────────────────────
  // Exact A4 aspect ratio
  // ──────────────────────────────────────────────

  it('maps canvas with exact A4 aspect to full-page dimensions', () => {
    const { imgW, imgH, wasScaled } = calcPdfLayout(2100, 2970);
    expect(imgW).toBeCloseTo(A4_W);
    expect(imgH).toBeCloseTo(A4_H);
    expect(wasScaled).toBe(false);
  });

  // ──────────────────────────────────────────────
  // Landscape canvas
  // ──────────────────────────────────────────────

  it('handles wide/short landscape canvas without overflow', () => {
    const { imgW, imgH } = calcPdfLayout(2000, 800);
    expect(imgW).toBeLessThanOrEqual(A4_W + EPS);
    expect(imgH).toBeLessThanOrEqual(A4_H + EPS);
  });

  // ──────────────────────────────────────────────
  // Custom page dimensions
  // ──────────────────────────────────────────────

  it('respects custom page dimensions', () => {
    const { imgW, imgH } = calcPdfLayout(1000, 2000, 100, 150);
    expect(imgW).toBeLessThanOrEqual(100 + EPS);
    expect(imgH).toBeLessThanOrEqual(150 + EPS);
  });

  // ──────────────────────────────────────────────
  // Error cases
  // ──────────────────────────────────────────────

  it('throws RangeError for zero canvas width', () => {
    expect(() => calcPdfLayout(0, 1000)).toThrow(RangeError);
  });

  it('throws RangeError for zero canvas height', () => {
    expect(() => calcPdfLayout(1000, 0)).toThrow(RangeError);
  });

  it('throws RangeError for negative dimensions', () => {
    expect(() => calcPdfLayout(-100, 1000)).toThrow(RangeError);
    expect(() => calcPdfLayout(1000, -100)).toThrow(RangeError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('calcSinglePage — content-sized page guarantee', () => {

  // The key invariant: pageW == imgW and pageH == imgH so jsPDF
  // can NEVER produce a second page regardless of content length.

  it.each([
    [800,  1200],   // compact report
    [800,  1600],   // report with many sections
    [800,  2400],   // long report
    [800,  4000],   // extreme — very long content
    [1600,  800],   // wide/landscape screenshot
    [2100, 2970],   // exact A4 aspect
    [1,    99999],  // degenerate — ultra-tall
    [99999,    1],  // degenerate — ultra-wide
  ] as [number, number][])(
    'page dimensions always positive for canvas %ix%i',
    (cw, ch) => {
      const { pageW, pageH } = calcSinglePage(cw, ch);
      expect(pageW).toBeGreaterThan(0);
      expect(pageH).toBeGreaterThan(0);
    },
  );

  it('preserves exact canvas aspect ratio in the page dimensions', () => {
    const cw = 1000, ch = 2000;
    const { pageW, pageH } = calcSinglePage(cw, ch);
    expect(pageH / pageW).toBeCloseTo(ch / cw, 5);
  });

  it('page width equals the requested fixed width (210 mm by default)', () => {
    const { pageW } = calcSinglePage(800, 2000);
    expect(pageW).toBe(210);
  });

  it('uses custom page width when supplied', () => {
    const { pageW, pageH } = calcSinglePage(1000, 3000, 100);
    expect(pageW).toBe(100);
    expect(pageH).toBeCloseTo(300);
  });

  it('result is rounded to 3 decimal places (no floating-point jitter)', () => {
    const { pageH } = calcSinglePage(3, 1); // non-trivial division
    const decimals = (pageH.toString().split('.')[1] ?? '').length;
    expect(decimals).toBeLessThanOrEqual(3);
  });

  it('throws RangeError for zero or negative dimensions', () => {
    expect(() => calcSinglePage(0, 1000)).toThrow(RangeError);
    expect(() => calcSinglePage(1000, 0)).toThrow(RangeError);
    expect(() => calcSinglePage(-1, 1000)).toThrow(RangeError);
    expect(() => calcSinglePage(1000, -1)).toThrow(RangeError);
  });
});
