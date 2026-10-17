/**
 * What Google's Share copies (v2.5604, punch list #117): the place's name, its address on one or
 * two lines, and a short link (`maps.app.goo.gl/…`), or just the link. One paste fills the
 * company block and sets the source; the link is a double key, since the same place is the same
 * company. Pure.
 */
export interface MapsShare {
  name: string
  address: string
  url: string
}

export const MAPS_SOURCE = 'Google Maps'

const MAPS_HOSTS = /^(https?:\/\/)?(www\.)?(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+|google\.[a-z.]+\/maps|g\.co\/kgs|share\.google)/i

export function isMapsUrl(text: string): boolean {
  return MAPS_HOSTS.test(text.trim())
}

/** The share block as a name, an address and the link; null without a Maps link. */
export function parseMapsShare(text: string): MapsShare | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const urlLine = lines.find((l) => isMapsUrl(l) || (/^https?:\/\//i.test(l) && /maps/i.test(l)))
  if (!urlLine) return null
  const url = urlLine.replace(/^(?!https?:\/\/)/, 'https://')
  const rest = lines.filter((l) => l !== urlLine && !/^https?:\/\//i.test(l))
  return { name: rest[0] ?? '', address: rest.slice(1).join(', '), url }
}

/** The link as the double reads it: no protocol, no query, no trailing slash, lower case. */
export function mapsKey(url: string | null | undefined): string | null {
  const u = (url ?? '').trim()
  if (!u) return null
  return u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[?#]/)[0]!.replace(/\/+$/, '').toLowerCase() || null
}
