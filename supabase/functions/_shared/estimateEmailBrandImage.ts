/** Public estimate email HTML: centered header image URLs match `public/brand/` on the static app. */

export type EstimateSendEmailBrand = 'elec' | 'plum'

export function normalizePublicOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '')
}

export function acceptHeaderBrandPublicPath(brand: EstimateSendEmailBrand): string {
  return brand === 'elec' ? '/brand/click-elec.png' : '/brand/click-plum.png'
}

export function brandImageAbsoluteUrl(origin: string, brand: EstimateSendEmailBrand): string {
  return normalizePublicOrigin(origin) + acceptHeaderBrandPublicPath(brand)
}

export function parseAcceptHeaderBrandForEmail(raw: unknown): EstimateSendEmailBrand | null {
  if (raw == null) return null
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (s === 'elec' || s === 'plum') return s
  return null
}

export function acceptHeaderBrandImageAlt(brand: EstimateSendEmailBrand): string {
  return brand === 'elec' ? 'Electrical' : 'Plumbing'
}

export function escapeHtmlForEmail(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtmlAttributeValue(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * Builds HTML body: optional centered logo, then escaped plain body with newlines as `<br>`.
 */
export function buildEstimateEmailHtml(
  bodyPlain: string,
  opts?: { imageUrl: string; imageAlt: string },
): string {
  const bodyHtml = escapeHtmlForEmail(bodyPlain).replace(/\n/g, '<br>')
  if (!opts?.imageUrl?.trim()) return bodyHtml
  const src = escapeHtmlAttributeValue(opts.imageUrl.trim())
  const alt = escapeHtmlAttributeValue(opts.imageAlt.trim() || 'Logo')
  const header =
    `<div style="text-align:center;margin-bottom:1rem">` +
    `<img src="${src}" alt="${alt}" width="140" style="max-width:140px;height:auto;display:inline-block;border:0" />` +
    `</div>`
  return header + bodyHtml
}
