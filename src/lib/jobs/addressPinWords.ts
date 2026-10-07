import { buildAddressStatementPreview } from '../addressCommaNudge'

/**
 * The *On the map* line under the job address (v2.4783): when an address is whole
 * enough to spend a lookup on, and the words for each state. Pure.
 */

/** A city split off after a comma (the statements line's own rule), or a five-digit ZIP, or a state code at the end. */
export function addressLooksWhole(address: string): boolean {
  const a = address.trim()
  if (a.length < 8) return false
  if (buildAddressStatementPreview(a)?.quiet) return true
  return /\b\d{5}(?:-\d{4})?\b/.test(a) || /\b(TX|Texas)\s*\d{0,5}$/i.test(a)
}

/** Wait this long after the last keystroke before a lookup, so fragments cost nothing. */
export const ADDRESS_PIN_PAUSE_MS = 1200

export type AddressPinSource = 'cache' | 'nominatim' | 'google' | 'census'

export type AddressPinState =
  | { kind: 'idle' }
  | { kind: 'unplaced' }
  | { kind: 'placing' }
  | { kind: 'placed'; county: string; source: AddressPinSource }
  | { kind: 'failed'; reason: string }

/** `pinned from the street map` · `pinned by Google` · `pinned by the US Census` · `pinned earlier`. */
export function pinSourceWords(source: AddressPinSource): string {
  switch (source) {
    case 'google':
      return 'pinned by Google'
    case 'census':
      return 'pinned by the US Census'
    case 'nominatim':
      return 'pinned from the street map'
    default:
      return 'pinned earlier'
  }
}

/** The line's words: what sits after the ON THE MAP tag. */
export function addressPinWords(s: AddressPinState): { main: string; note: string; tone: 'ok' | 'muted' | 'amber' | 'pulse' } {
  switch (s.kind) {
    case 'placing':
      return { main: 'placing…', note: '', tone: 'pulse' }
    case 'placed':
      return { main: s.county ? `${s.county} County` : 'placed', note: pinSourceWords(s.source), tone: 'ok' }
    case 'failed':
      return { main: 'could not place it', note: s.reason, tone: 'amber' }
    case 'unplaced':
      return { main: 'not placed yet', note: '', tone: 'muted' }
    default:
      return { main: '', note: '', tone: 'muted' }
  }
}

/** The geocoder's failure code → the reason the line gives. */
export function addressPinFailureReason(code: string): string {
  switch (code) {
    case 'not_found':
      return 'it needs a street, a city or a ZIP; the night will try once more'
    case 'google_unconfigured':
      return 'Google is not set up for the office; the street map found nothing'
    case 'upstream':
    case 'census_upstream':
      return 'the map services did not answer; the night will try once more'
    default:
      return 'the night will try once more'
  }
}
