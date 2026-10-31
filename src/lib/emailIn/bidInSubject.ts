/**
 * Punch list #223 PR 4 (v2.6231): the bid we are pricing that an email's subject names. An addendum, a site-visit
 * notice or a GC's question about *Oak Hill Clinic, Boerne* lands on bid b512 the way a job's name ties a line
 * (`jobInSubject.ts`), whoever sent it: the bid's own invitation and its addenda then read as one story on the bid's
 * thread. Pure, mirrored to the edge; `gmail-sync` reads the live bids once a run.
 */

export interface LiveBid {
  id: string
  project_name: string | null
}

/** A name shorter than this names nothing: "Shell" is in too many subjects (`jobInSubject.ts`'s rule). */
export const BID_NAME_MIN = 8

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The name stands alone in the subject: no letter or digit runs into either end of it, and the spaces may be any run of them. */
const standsAlone = (subject: string, name: string): boolean =>
  new RegExp(`(?:^|[^A-Za-z0-9])${escape(name).replace(/\s+/g, '\\s+')}(?![A-Za-z0-9])`, 'i').test(subject)

/**
 * The key (`bid:<id>`) of the one live bid whose name the subject carries, the longest name when one holds another
 * (*Oak Hill Clinic* inside *Oak Hill Clinic Phase 2*); null when none does, or two bids wear the same name.
 */
export function bidInSubject(subject: string, bids: readonly LiveBid[]): string | null {
  const s = subject.replace(/\s+/g, ' ').trim()
  if (!s) return null
  const named = bids
    .map((b) => ({ id: b.id, name: (b.project_name ?? '').replace(/\s+/g, ' ').trim() }))
    .filter((b) => b.name.length >= BID_NAME_MIN && standsAlone(s, b.name))
  if (named.length === 0) return null
  const longest = Math.max(...named.map((b) => b.name.length))
  const top = named.filter((b) => b.name.length === longest)
  const ids = [...new Set(top.map((b) => b.id))]
  return ids.length === 1 ? `bid:${ids[0]}` : null
}
