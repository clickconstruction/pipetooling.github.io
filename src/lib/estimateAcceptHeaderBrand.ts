/** Per-estimate logo on the public acceptance document (maps to `public/brand/*.png`). */

export type EstimateAcceptHeaderBrand = 'elec' | 'plum'

export function parseAcceptHeaderBrand(raw: unknown): EstimateAcceptHeaderBrand | null {
  if (raw == null) return null
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (s === 'elec' || s === 'plum') return s
  return null
}

export function acceptHeaderBrandLabel(brand: EstimateAcceptHeaderBrand): string {
  return brand === 'elec' ? 'Electrical' : 'Plumbing'
}

/** URL path segment under `public/` (leading slash, no BASE_URL). */
export function acceptHeaderBrandPublicPath(brand: EstimateAcceptHeaderBrand): string {
  return brand === 'elec' ? '/brand/click-elec.png' : '/brand/click-plum.png'
}

/** Full URL for `<img src>` in the SPA (GitHub Pages subpath-safe). */
export function acceptHeaderBrandImageSrc(brand: EstimateAcceptHeaderBrand): string {
  const base = import.meta.env.BASE_URL ?? '/'
  const path = acceptHeaderBrandPublicPath(brand)
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  return normalizedBase + path
}
