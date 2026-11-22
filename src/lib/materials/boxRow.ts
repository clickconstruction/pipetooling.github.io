/**
 * A box as one row of a list (v2.8284): the Tally's On site list, and since v2.8284 the office's Materials desk on a
 * phone, where each box was a card a quarter of the screen tall with a table wider than the card. The row says the
 * box's name, how it sits, its line, and one state: how its count stands, or that it is empty.
 *
 * Pure: what the row's last line says and whether it is amber. A box with no part that nobody has counted reads
 * *Empty* in the muted colour. It read an amber *0 parts · never counted* before, which asked for a count of nothing.
 */
import { countIsDue, lastCountWords, type lastCountedAt } from './onSite'

export const BOX_ROW_EMPTY = 'Empty'

export type BoxRowState = {
  /** *3 parts*, before the state: left out where the box's own line already says how many, and on an empty box. */
  partsWords: string | null
  /** *counted Tue by Robert* · *never counted* · *Empty* · *put them in a cage*. */
  stateWords: string
  /** Due a count: the state is amber and the row's edge with it. */
  amber: boolean
  /** No part on hand and never counted: the row's press may be Add a part. */
  empty: boolean
}

export function boxRowState(input: { kind: string; parts: number; /** The box's line is the app's own, which already says how many. */ lineIsApps: boolean; last: ReturnType<typeof lastCountedAt>; now: Date }): BoxRowState {
  const { kind, parts, last, now } = input
  const partsWords = input.lineIsApps ? null : `${parts} ${parts === 1 ? 'part' : 'parts'}`
  if (kind === 'unsorted') return { partsWords, stateWords: 'put them in a cage', amber: false, empty: false }
  if (parts === 0 && !last) return { partsWords: null, stateWords: BOX_ROW_EMPTY, amber: false, empty: true }
  return { partsWords, stateWords: lastCountWords(last, now), amber: countIsDue(last, now), empty: parts === 0 }
}

/** Where a row of the office's desk leads on a phone: the Tally's box screen, which goes back to the desk. */
export const ON_SITE_FROM_MATERIALS = 'materials'

/** The Tally's box screen for a box, marked as opened from the Materials desk so its back press returns there. */
export function boxScreenFromMaterials(jobId: string, containerId: string): string {
  return `/tally?tab=on-site&job=${encodeURIComponent(jobId)}&container=${encodeURIComponent(containerId)}&from=${ON_SITE_FROM_MATERIALS}`
}

/** The Materials desk's page for a job: where that back press goes. */
export function materialsJobPage(jobId: string): string {
  return `/materials?tab=on-site&job=${encodeURIComponent(jobId)}`
}

/** Whether the Tally's address says the open box was reached from the Materials desk. */
export function cameFromMaterials(params: URLSearchParams): boolean {
  return params.get('from') === ON_SITE_FROM_MATERIALS
}

/**
 * The address with a stale mark taken off, or null when it stands. The mark lasts while a box is on the address: once
 * the person is on the Tally's own list, a box they open there goes back to that list.
 */
export function withoutStaleFrom(params: URLSearchParams): URLSearchParams | null {
  if (!params.get('from') || params.get('container')) return null
  const next = new URLSearchParams(params)
  next.delete('from')
  return next
}
