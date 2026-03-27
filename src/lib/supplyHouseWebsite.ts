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
