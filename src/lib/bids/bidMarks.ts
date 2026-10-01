/**
 * Bid marks (v2.4287) — the pure half of "hold a row to mark it".
 *
 * A mark is a private, per-person flag on a bid: `bid_marks` holds one row per (person, bid)
 * with the moment it was made. The map here is bid id → marked_at (ISO). Everything a screen
 * needs to say about marks is a function of that map and the bids on screen:
 *
 *   - `toggleBidMark`: make or clear one mark.
 *   - `bidMarkSinceWords`: "marked today" / "marked Fri" / "marked Sep 12" on the row, so a
 *     stale mark is visible.
 *   - `isFinishedBidForMark` / `splitBidMarks`: a mark on a bid that has since been won, lost,
 *     started or archived is "finished" — it wears a dashed bar and *Clear marks* offers to
 *     clear just those. The Bid Board's own stage rule (`bidPickerGroupKey`) decides.
 *
 * The hold gesture itself is `bidMarkHold.ts`; the store that syncs with the table is
 * `bidMarksStore.ts`.
 */
import { bidPickerGroupKey, type BidPickerGroupBid } from '../bidPickerGroups'

/** bid id → marked_at (ISO timestamp). */
export type BidMarkMap = Readonly<Record<string, string>>

export const EMPTY_BID_MARKS: BidMarkMap = Object.freeze({})

export function isBidMarked(marks: BidMarkMap, bidId: string): boolean {
  return Object.prototype.hasOwnProperty.call(marks, bidId)
}

export function bidMarkCount(marks: BidMarkMap): number {
  return Object.keys(marks).length
}

/** Make the mark if there is none, clear it if there is. `now` stamps a new mark. */
export function toggleBidMark(marks: BidMarkMap, bidId: string, now: Date): { next: BidMarkMap; marked: boolean } {
  if (isBidMarked(marks, bidId)) {
    const next: Record<string, string> = { ...marks }
    delete next[bidId]
    return { next, marked: false }
  }
  return { next: { ...marks, [bidId]: now.toISOString() }, marked: true }
}

export function removeBidMarks(marks: BidMarkMap, bidIds: ReadonlyArray<string>): BidMarkMap {
  if (bidIds.length === 0) return marks
  const drop = new Set(bidIds)
  const next: Record<string, string> = {}
  for (const [id, at] of Object.entries(marks)) if (!drop.has(id)) next[id] = at
  return next
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function localDayNumber(d: Date): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000)
}

/**
 * The row's "marked …" words, in the viewer's local calendar: today, yesterday, a weekday
 * inside the last week, else a month and day (with the year once it is not this year). An
 * unreadable stamp prints plain "marked".
 */
export function bidMarkSinceWords(markedAt: string, now: Date): string {
  const at = new Date(markedAt)
  if (Number.isNaN(at.getTime())) return 'marked'
  const days = localDayNumber(now) - localDayNumber(at)
  if (days <= 0) return 'marked today'
  if (days === 1) return 'marked yesterday'
  if (days < 7) return `marked ${WEEKDAY[at.getDay()]}`
  const md = `${MONTH[at.getMonth()]} ${at.getDate()}`
  return at.getFullYear() === now.getFullYear() ? `marked ${md}` : `marked ${md}, ${at.getFullYear()}`
}

export type BidForMark = Pick<BidPickerGroupBid, 'outcome' | 'bid_date_sent' | 'working_board_archived_at'> & { id: string }

/** True when the bid has left the working stages: won, started or complete, lost, or archived. */
export function isFinishedBidForMark(bid: BidForMark): boolean {
  const key = bidPickerGroupKey(bid)
  return key === 'won' || key === 'startedOrComplete' || key === 'lost' || key === 'archived'
}

/**
 * The marks that fall on the bids given, split live / finished. A mark on a bid that is not
 * in the list (another trade, not loaded) is in neither — it is never cleared by accident.
 */
export function splitBidMarks(marks: BidMarkMap, bids: ReadonlyArray<BidForMark>): { live: string[]; finished: string[] } {
  const live: string[] = []
  const finished: string[] = []
  for (const bid of bids) {
    if (!isBidMarked(marks, bid.id)) continue
    if (isFinishedBidForMark(bid)) finished.push(bid.id)
    else live.push(bid.id)
  }
  return { live, finished }
}

/** The rows the *Marked* filter keeps: marked bids, in the order given. */
export function onlyMarkedBids<T extends { id: string }>(marks: BidMarkMap, bids: ReadonlyArray<T>): T[] {
  return bids.filter((b) => isBidMarked(marks, b.id))
}

/** The mark button's words: "Mark" or "Marked · today". */
export function bidMarkButtonWords(marks: BidMarkMap, bidId: string, now: Date): { label: string; since: string | null } {
  const at = marks[bidId]
  if (at == null) return { label: 'Mark', since: null }
  return { label: 'Marked', since: bidMarkSinceWords(at, now).replace(/^marked /, '') }
}
