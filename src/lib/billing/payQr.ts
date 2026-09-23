/**
 * Pay codes (punch list #35): the QR code that carries a bill's pay link, with the company
 * mark in the middle. One set of props feeds the on-screen component (View bill's QR modal),
 * the print markup (the lien notice's pay page, the modal's half-sheet) and the PNG the
 * emailed PDF and the clipboard need — so every code for a bill is the same code.
 *
 * Level Q: the code survives losing a quarter of its modules and the mark covers about a
 * twentieth, so a coffee ring on the letter does not kill it; for the pay address that is
 * 41 × 41 modules (plain level M would be 37, level H 49) — coarse enough to scan at an inch.
 * `qrcode.react` is already in the bundle for the portal cards; `excavate` carves the modules
 * out under the mark instead of drawing over them.
 */
import { createElement } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { payLinkDisplay, payLinkUrl } from './payLink'

export const PAY_QR_LEVEL = 'Q' as const
/** The mark's side as a share of the code's — about 5% of the modules at level Q's 25% tolerance. */
export const PAY_QR_MARK_RATIO = 0.22
/** Quiet zone in modules; the spec's four is for 1990s scanners, two prints cleanly on a letter. */
export const PAY_QR_QUIET_MODULES = 2
export const PAY_QR_INK = '#111111'
export const PAY_QR_PAPER = '#ffffff'

/** The square hand-and-wrench mark (`public/brand/click-mark.png`, cropped from the plumbing logo). */
export function brandMarkPath(base: string = import.meta.env.BASE_URL ?? '/'): string {
  return `${base.replace(/\/+$/, '')}/brand/click-mark.png`
}

export type PayQrImageSettings = { src: string; height: number; width: number; excavate: boolean }

export function payQrImageSettings(size: number, src: string): PayQrImageSettings {
  const px = Math.max(8, Math.round(size * PAY_QR_MARK_RATIO))
  return { src, height: px, width: px, excavate: true }
}

export type PayQrProps = {
  value: string
  size: number
  level: typeof PAY_QR_LEVEL
  bgColor: string
  fgColor: string
  marginSize: number
  imageSettings?: PayQrImageSettings
}

/** The exact props the component and the print markup share; `markSrc` null draws a plain code. */
export function payQrProps(url: string, size: number, markSrc: string | null): PayQrProps {
  return {
    value: url,
    size,
    level: PAY_QR_LEVEL,
    bgColor: PAY_QR_PAPER,
    fgColor: PAY_QR_INK,
    marginSize: PAY_QR_QUIET_MODULES,
    ...(markSrc ? { imageSettings: payQrImageSettings(size, markSrc) } : {}),
  }
}

let markDataUrlPromise: Promise<string | null> | null = null

/**
 * The mark as a data URL, fetched once per session. Print windows and rasterised SVGs cannot
 * load an external image, so the markup inlines it; null (a fetch that failed) draws the
 * code without the mark rather than nothing.
 */
export function loadBrandMarkDataUrl(): Promise<string | null> {
  if (!markDataUrlPromise) {
    markDataUrlPromise = (async () => {
      try {
        const res = await fetch(brandMarkPath())
        if (!res.ok) return null
        const blob = await res.blob()
        return await new Promise<string | null>((resolve) => {
          const r = new FileReader()
          r.onload = () => resolve(typeof r.result === 'string' ? r.result : null)
          r.onerror = () => resolve(null)
          r.readAsDataURL(blob)
        })
      } catch {
        return null
      }
    })()
  }
  return markDataUrlPromise
}

/** The code as an SVG string — for a print window or a PDF; `markDataUrl` from `loadBrandMarkDataUrl`. */
export async function payQrSvgMarkup(url: string, size: number, markDataUrl: string | null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(createElement(QRCodeSVG, payQrProps(url, size, markDataUrl)))
}

/** Rasterise an SVG string at `px` square (browser only): the PNG the clipboard, a download and jsPDF take. */
export function svgMarkupToPngDataUrl(svg: string, px: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = px
      canvas.height = px
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no canvas'))
      ctx.fillStyle = PAY_QR_PAPER
      ctx.fillRect(0, 0, px, px)
      ctx.drawImage(img, 0, 0, px, px)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('svg did not load'))
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
  })
}

/** The bill's code as a PNG data URL, mark inlined — for Copy image, Download PNG and the emailed PDF. */
export async function payQrPngDataUrl(invoiceId: string, px: number): Promise<string> {
  const svg = await payQrSvgMarkup(payLinkUrl(invoiceId), px, await loadBrandMarkDataUrl())
  return svgMarkupToPngDataUrl(svg, px)
}

export type PayQrSheetInput = {
  company: string
  /** "Invoice #1025-2609180905" or "Bill" when the number is not known. */
  billLabel: string
  jobName: string
  /** "$4,660.00" — what is still owed, when known; '' hides the line. */
  amountLabel: string
  invoiceId: string
  /** From `payQrSvgMarkup`. */
  svg: string
}

/** The half-sheet View bill prints: the mark's code, what it pays, the address in words. Light on purpose — it is paper. */
export function payQrSheetHtml(i: PayQrSheetInput): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Scan to pay — ${esc(i.billLabel)}</title>
<style>
  body { margin: 0; background: #fff; color: #1a1a1a; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  .sheet { width: 5.5in; margin: 0.6in auto; text-align: center; }
  .co { font-weight: 800; font-size: 15px; letter-spacing: 0.02em; }
  .scan { font-size: 26px; font-weight: 800; margin: 10px 0 2px; }
  .what { font-size: 13px; color: #555; }
  .amt { font-size: 22px; font-weight: 800; margin: 6px 0 10px; }
  .code svg { width: 2.6in; height: 2.6in; display: block; margin: 0 auto; }
  .addr { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #555; margin-top: 8px; word-break: break-all; }
  .fine { font-size: 10.5px; color: #777; margin-top: 10px; line-height: 1.45; }
  @media print { .sheet { margin: 0.4in auto; } }
</style></head><body><div class="sheet">
  <div class="co">${esc(i.company)}</div>
  <div class="scan">Scan to pay</div>
  <div class="what">${esc([i.billLabel, i.jobName].filter(Boolean).join(' · '))}</div>
  ${i.amountLabel ? `<div class="amt">${esc(i.amountLabel)}</div>` : ''}
  <div class="code">${i.svg}</div>
  <div class="addr">${esc(payLinkDisplay(i.invoiceId))}</div>
  <div class="fine">Point your phone's camera at the code, or type the address. It opens the bill's secure payment page (Stripe): card or bank transfer. The address stays good until the bill is paid.</div>
</div></body></html>`
}
