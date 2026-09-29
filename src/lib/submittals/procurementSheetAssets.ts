import { loadBrandMarkDataUrl, payQrSvgMarkup } from '../billing/payQr'

/**
 * What the printed procurement log needs besides its rows (v2.4122): the plumbing logo as a
 * data URL and the review room's code as SVG. Both are fetched once the panel mounts, not at
 * print time — `printHtmlInNewWindow` has to open its window inside the click (Safari blocks a
 * popup after an await), so the sheet is built synchronously from what is already here.
 */
export const PROCUREMENT_SHEET_LOGO = 'brand/click-plum.png'

export type ProcurementSheetAssets = { logoDataUrl: string | null; roomQrSvg: string | null }

export const PROCUREMENT_SHEET_QR_PX = 72

const imageCache = new Map<string, Promise<string | null>>()

/** A public image as a data URL, fetched once per session; null when it cannot be read. */
export function loadPublicImageDataUrl(path: string, base: string = import.meta.env.BASE_URL ?? '/'): Promise<string | null> {
  const url = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  let p = imageCache.get(url)
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(url)
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
    imageCache.set(url, p)
  }
  return p
}

export async function loadProcurementSheetAssets(roomUrl: string | null): Promise<ProcurementSheetAssets> {
  const [logoDataUrl, roomQrSvg] = await Promise.all([
    loadPublicImageDataUrl(PROCUREMENT_SHEET_LOGO),
    roomUrl ? loadBrandMarkDataUrl().then((mark) => payQrSvgMarkup(roomUrl, PROCUREMENT_SHEET_QR_PX, mark)).catch(() => null) : Promise.resolve(null),
  ])
  return { logoDataUrl, roomQrSvg }
}
