/** Normalize user-entered URL for storage; empty clears. Prepends https:// when no scheme. */
export function normalizeSupplyHouseWebsiteUrlForStorage(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

/** Returns a usable href for openInExternalBrowser, or null if empty. */
export function supplyHouseWebsiteHref(stored: string | null | undefined): string | null {
  return normalizeSupplyHouseWebsiteUrlForStorage(stored ?? '')
}

/**
 * True when the href is a Google Maps (or Goo.gl maps short) navigation URL, not a supplier order portal.
 * Used to avoid misleading "Open website" / invoice links when staff stored a map link in website_url.
 */
export function isUrlLikelyMapsOrDirectionsPortal(href: string): boolean {
  let u: URL
  try {
    u = new URL(href)
  } catch {
    return false
  }
  const host = u.hostname.toLowerCase()
  const path = (u.pathname + u.search).toLowerCase()
  if (host === 'maps.google.com') return true
  if (host === 'maps.app.goo.gl') return true
  if (host === 'goo.gl' || host === 'www.goo.gl') {
    return path.includes('/maps')
  }
  if (host === 'google.com' || host === 'www.google.com') {
    if (u.pathname.toLowerCase().startsWith('/maps')) return true
  }
  return false
}

/** Normalized href for UIs that mean "supplier website / order portal" — excludes map links. */
export function supplyHouseWebsitePortalHref(stored: string | null | undefined): string | null {
  const h = supplyHouseWebsiteHref(stored)
  if (!h) return null
  if (isUrlLikelyMapsOrDirectionsPortal(h)) return null
  return h
}
