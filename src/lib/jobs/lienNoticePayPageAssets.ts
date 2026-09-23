/**
 * The codes on the pay page (v2.3758), built in the browser: one SVG per payable bill for the
 * printed packet and the preview, and its PNG for the emailed PDF (jsPDF takes a raster). The
 * mark is fetched once and inlined so a print window and a rasterised SVG can draw it.
 */
import { payLinkUrl } from '../billing/payLink'
import { loadBrandMarkDataUrl, payQrSvgMarkup, svgMarkupToPngDataUrl } from '../billing/payQr'
import type { PayPageAssets, PayPageRow } from './lienNoticePayPage'

/** The code's side on the page, in CSS px (≈ 1.25 in). */
export const PAY_PAGE_QR_PX = 120
/** The PNG's side for the PDF — four times the page size, so 32 mm prints crisp. */
const PAY_PAGE_PNG_PX = 480

export async function buildPayPageAssets(rows: readonly PayPageRow[], opts: { png?: boolean } = {}): Promise<PayPageAssets> {
  const payable = rows.filter((r) => r.payable)
  if (payable.length === 0) return {}
  const mark = await loadBrandMarkDataUrl()
  const out: Record<string, { svg: string; png: string | null }> = {}
  await Promise.all(
    payable.map(async (r) => {
      const svg = await payQrSvgMarkup(payLinkUrl(r.invoiceId), PAY_PAGE_QR_PX, mark)
      let png: string | null = null
      if (opts.png !== false) {
        try {
          png = await svgMarkupToPngDataUrl(svg, PAY_PAGE_PNG_PX)
        } catch {
          png = null
        }
      }
      out[r.invoiceId] = { svg, png }
    }),
  )
  return out
}
