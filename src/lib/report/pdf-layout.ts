/**
 * PDF page layout utilities — single-page guarantee.
 *
 * Two strategies are exported:
 *
 * 1. calcPdfLayout   — fit canvas INTO a fixed-size page (e.g. standard A4).
 *    Works when content is shorter than A4; if taller, content is scaled down.
 *
 * 2. calcSinglePage  — make the PAGE exactly fit the canvas (content-sized page).
 *    The page width is fixed (210 mm) and the height is derived from the canvas
 *    aspect ratio. Because page dimensions == image dimensions, overflow is
 *    structurally impossible regardless of content length.
 *
 * handleDownloadPdf uses calcSinglePage so the PDF is ALWAYS exactly 1 page.
 */

export interface PdfImageLayout {
  /** Image width in mm to pass to jsPDF.addImage */
  imgW: number;
  /** Image height in mm to pass to jsPDF.addImage */
  imgH: number;
  /** Horizontal offset (mm) to centre image when narrower than page */
  xOffset: number;
  /** Whether content was tall enough to require height-based scaling */
  wasScaled: boolean;
}

/**
 * Strategy 1 — fit canvas into a fixed page (e.g. A4 297mm).
 * Content is scaled down if it would overflow the page height.
 */
export function calcPdfLayout(
  canvasWidth: number,
  canvasHeight: number,
  pageW = 210,
  pageH = 297,
): PdfImageLayout {
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    throw new RangeError('Canvas dimensions must be positive');
  }

  const aspect = canvasHeight / canvasWidth;

  let imgW = pageW;
  let imgH = imgW * aspect;
  let wasScaled = false;

  if (imgH > pageH) {
    imgH = pageH;
    imgW = imgH / aspect;
    wasScaled = true;
  }

  const xOffset = (pageW - imgW) / 2;

  return { imgW, imgH, xOffset, wasScaled };
}

// ─────────────────────────────────────────────────────────────────────────────

export interface SinglePageDimensions {
  /** PDF page width in mm (fixed at pageWidth param, default 210) */
  pageW: number;
  /**
   * PDF page height in mm — derived from canvas aspect ratio so the page is
   * exactly as tall as the content.  No overflow is possible because
   * page height == image height.
   */
  pageH: number;
}

/**
 * Strategy 2 — content-sized page (the correct approach for "always 1 page").
 *
 * Creates a custom-sized page whose height matches the canvas aspect ratio.
 * Pass pageW and pageH as the jsPDF `format` option AND as the addImage
 * width/height — the page is the image; there is no room to overflow.
 *
 * @param canvasWidth  Canvas pixel width  (must be > 0)
 * @param canvasHeight Canvas pixel height (must be > 0)
 * @param pageWidth    Fixed page width in mm (default 210 — A4 width)
 */
export function calcSinglePage(
  canvasWidth: number,
  canvasHeight: number,
  pageWidth = 210,
): SinglePageDimensions {
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    throw new RangeError('Canvas dimensions must be positive');
  }
  // Round to 3 decimal places to avoid floating-point jitter in jsPDF
  const pageH = Math.round((canvasHeight / canvasWidth) * pageWidth * 1000) / 1000;
  return { pageW: pageWidth, pageH };
}
