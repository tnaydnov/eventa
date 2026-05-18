/**
 * Computes the image dimensions and position to fit an html2canvas capture
 * onto a SINGLE PDF page without any cropping.
 *
 * This is the single source of truth for the "always 1 page" guarantee:
 * because we only ever call pdf.addImage() once, with dimensions that are
 * mathematically bounded by (pageW, pageH), jsPDF can never produce a second page.
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
 * @param canvasWidth  - Canvas pixel width  (must be > 0)
 * @param canvasHeight - Canvas pixel height (must be > 0)
 * @param pageW        - PDF page width  in mm (default 210 — A4 portrait)
 * @param pageH        - PDF page height in mm (default 297 — A4 portrait)
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

  // Default: fill full page width
  let imgW = pageW;
  let imgH = imgW * aspect;
  let wasScaled = false;

  // If the content is too tall, constrain by height instead
  if (imgH > pageH) {
    imgH = pageH;
    imgW = imgH / aspect;
    wasScaled = true;
  }

  const xOffset = (pageW - imgW) / 2;

  return { imgW, imgH, xOffset, wasScaled };
}
