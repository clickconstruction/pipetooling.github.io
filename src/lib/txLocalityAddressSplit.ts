/**
 * Central Texas localities for splitting one-line job addresses (Jobs display + lien prefill).
 * Keep in sync with usage in formatAddressTwoLines (Jobs) and splitJobAddressForPrefill.
 */
export const TX_JOB_ADDRESS_LOCALITY_KEYWORDS = [
  'San Antonio',
  'Seguin',
  'Wimberley',
  'Marion',
  'Helotes',
  'Taylor',
  'Austin',
  'New Braunfels',
  'Schertz',
  'Kingsbury',
  'Bastrop',
  'Canyon Lake',
  'Hondo',
  'Castroville',
  'Shavano Park',
  'Blanco',
  'Converse',
  'Universal City',
  'Live Oak',
  'Cibolo',
  'Boerne',
  'Leon Valley',
  // v2.2323: cities with real jobs whose addresses weren't splitting.
  'Round Rock',
  'Liberty Hill',
] as const

/**
 * Org-added city names on top of the built-in list (v2.1186). Module state so the
 * split functions stay pure-sync in render paths; hydrated once per session from
 * `app_settings.job_address_extra_localities_v1` (see jobAddressLocalitySettings.ts)
 * and re-applied immediately after a dev saves the Settings block.
 */
let extraTxLocalityKeywords: string[] = []

export function setExtraTxLocalityKeywords(list: string[]): void {
  extraTxLocalityKeywords = list
}

export function getExtraTxLocalityKeywords(): string[] {
  return extraTxLocalityKeywords
}

/**
 * Parse the dev-entered extras text (one city per line; commas also accepted) into a
 * clean list: trimmed, no empties, case-insensitively deduped, built-ins dropped.
 */
export function parseExtraTxLocalitiesText(text: string): string[] {
  const builtins = new Set(TX_JOB_ADDRESS_LOCALITY_KEYWORDS.map((k) => k.toLowerCase()))
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[\n,]+/)) {
    const city = raw.trim()
    if (!city) continue
    const lower = city.toLowerCase()
    if (builtins.has(lower) || seen.has(lower)) continue
    seen.add(lower)
    out.push(city)
  }
  return out
}

/** Start index in `original` of the earliest matching locality, or -1. */
export function findEarliestTxLocalityIndex(original: string): number {
  const a = original
  const lower = a.toLowerCase()
  let bestIdx = -1
  for (const kw of [...TX_JOB_ADDRESS_LOCALITY_KEYWORDS, ...extraTxLocalityKeywords]) {
    const idx = lower.indexOf(kw.toLowerCase())
    if (idx === -1) continue
    if (kw === 'Blanco') {
      const after = a.slice(idx + 6)
      if (/^\s+Rd(\s|\.|$)/i.test(after) || /^\s+Road(\s|\.|$)/i.test(after)) continue
    }
    if (bestIdx === -1 || idx < bestIdx) bestIdx = idx
  }
  return bestIdx
}

const TRAILING_STATE_ZIP_RE = /\b([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\b/g

function lastTrailingStateZip(full: string): { index: number; state: string; zip: string } | null {
  TRAILING_STATE_ZIP_RE.lastIndex = 0
  let m: RegExpExecArray | null
  let last: RegExpExecArray | null = null
  while ((m = TRAILING_STATE_ZIP_RE.exec(full)) !== null) {
    last = m
  }
  if (!last) return null
  return { index: last.index, state: last[1]!.toUpperCase(), zip: last[2]! }
}

/**
 * Split US-style job addresses into street / city / state / zip.
 * 1) Strict comma form: Street, City, ST ZIP
 * 2) Trailing ST ZIP + optional TX locality or last comma segment for city
 */
export function splitJobAddressForPrefill(full: string): {
  street: string
  city: string
  state: string
  zip: string
} {
  const t = full.trim()
  if (!t) return { street: '', city: '', state: '', zip: '' }

  const parts = t.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!
    const stateZip = last.match(/^([A-Za-z]{2})\s+([\d-]+)$/)
    if (stateZip && parts.length >= 3) {
      return {
        street: parts.slice(0, -2).join(', '),
        city: parts[parts.length - 2]!,
        state: stateZip[1]!.toUpperCase(),
        zip: stateZip[2]!,
      }
    }
  }

  const tail = lastTrailingStateZip(t)
  if (!tail) {
    return { street: t, city: '', state: '', zip: '' }
  }

  const leftRemainder = t.slice(0, tail.index).trim().replace(/,\s*$/, '')
  let city = ''
  let street = ''

  const locIdx = findEarliestTxLocalityIndex(leftRemainder)
  if (locIdx >= 0) {
    if (locIdx > 0) {
      // "400 River Rd, Boerne" splits at the locality — drop the comma the
      // street segment would otherwise keep trailing.
      street = leftRemainder.slice(0, locIdx).trim().replace(/,\s*$/, '')
      city = leftRemainder.slice(locIdx).trim()
    } else {
      city = leftRemainder
    }
  } else if (leftRemainder.includes(',')) {
    const segs = leftRemainder
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (segs.length >= 2) {
      city = segs[segs.length - 1]!
      street = segs.slice(0, -1).join(', ')
    } else {
      street = leftRemainder
    }
  } else {
    street = leftRemainder
  }

  if (!street && !city && leftRemainder) {
    street = leftRemainder
  }

  return {
    street,
    city,
    state: tail.state,
    zip: tail.zip,
  }
}
