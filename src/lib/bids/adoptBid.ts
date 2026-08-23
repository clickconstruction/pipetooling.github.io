/**
 * "Adopt an existing bid" (v2.2133, Send or Compare F6b): fold a bid that already sits on the board
 * into another bid as one of its versions. Pure helpers for the chooser — ordering, naming, the
 * one-line preview. The move itself is the `adopt_bid_as_version` RPC.
 */

export type AdoptCandidate = {
  id: string
  bid_number: string | null
  project_name: string | null
  customer_id: string | null
  bid_date_sent: string | null
  bid_value: number | null
  outcome: string | null
  countRows: number
  scenarios: number
}

/** Same-customer bids first, then everyone else; within a group newest bid number first. */
export function sortAdoptCandidates<T extends Pick<AdoptCandidate, 'bid_number' | 'customer_id'>>(rows: ReadonlyArray<T>, targetCustomerId: string | null): T[] {
  const num = (r: T) => Number.parseInt(r.bid_number ?? '', 10) || 0
  return [...rows].sort((a, b) => {
    const sa = targetCustomerId != null && a.customer_id === targetCustomerId ? 0 : 1
    const sb = targetCustomerId != null && b.customer_id === targetCustomerId ? 0 : 1
    return sa - sb || num(b) - num(a)
  })
}

/**
 * A short version name from the adopted bid's project name: drop the part it shares with the
 * package's name ("Jakes Burgers Revised" into "Jakes" → "Burgers Revised"; "JAKES BURGERS" → "BURGERS").
 * Falls back to the full name, then the bid number.
 */
export function suggestVersionName(sourceProjectName: string | null, targetProjectName: string | null, sourceBidNumber: string | null): string {
  const src = (sourceProjectName ?? '').trim()
  const tgt = (targetProjectName ?? '').trim()
  if (!src) return sourceBidNumber ? `B${sourceBidNumber}` : 'Adopted bid'
  const srcWords = src.split(/\s+/)
  const tgtWords = tgt.split(/\s+/).filter(Boolean)
  let i = 0
  while (i < srcWords.length - 1 && i < tgtWords.length && (srcWords[i] ?? '').toLowerCase() === (tgtWords[i] ?? '').toLowerCase()) i++
  const rest = srcWords.slice(i).join(' ').replace(/^[-–—:·]\s*/, '').trim()
  return rest || src
}

/** "57 count rows · 2 price scenarios · sent 7/17 · $274,249" (pieces omitted when absent). */
export function adoptPreviewLine(c: Pick<AdoptCandidate, 'countRows' | 'scenarios' | 'bid_date_sent' | 'bid_value'>): string {
  const parts: string[] = []
  parts.push(`${c.countRows} count row${c.countRows === 1 ? '' : 's'}`)
  parts.push(`${c.scenarios} price scenario${c.scenarios === 1 ? '' : 's'}`)
  if (c.bid_date_sent) {
    const [, m, d] = c.bid_date_sent.split('-')
    const date = m && d ? `${Number(m)}/${Number(d)}` : c.bid_date_sent
    parts.push(c.bid_value != null ? `sent ${date} · $${Math.round(Number(c.bid_value)).toLocaleString('en-US')}` : `sent ${date}`)
  } else {
    parts.push('not sent')
  }
  return parts.join(' · ')
}
