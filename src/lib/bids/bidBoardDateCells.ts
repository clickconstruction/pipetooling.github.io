/**
 * Bid Board Due Date / Last Contact cell parts (v2.1342).
 *
 * Both columns render two lines: `Thu 7/30` (weekday + M/D) on top and a
 * signed day count below — `(+4)` = 4 days after the date, `(-2)` = 2 days
 * until it (owner-chosen convention, same polarity as the old `[+N]/[-N]`
 * bracket from `formatDateYYMMDDParts`). Due dates also carry an urgency for
 * the chip color: past due → 'overdue', due within DUE_SOON_WINDOW_DAYS
 * (including today) → 'soon', else 'normal'.
 *
 * Pure — `today` is injectable for tests; defaults to the current date.
 */

export type BidBoardDueUrgency = 'overdue' | 'soon' | 'normal'

export type BidBoardDateCellParts = {
  /** e.g. `Thu 7/30` */
  dateLabel: string
  /** Days after the date; negative = days until it. */
  deltaDays: number
  /** e.g. `(+4)` or `(-2)` */
  deltaLabel: string
}

export type BidBoardDueCellParts = BidBoardDateCellParts & { urgency: BidBoardDueUrgency }

/** Due dates this many days out (or closer, including today) get the amber "soon" chip. */
export const DUE_SOON_WINDOW_DAYS = 3

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function partsFromDate(d: Date, today: Date): BidBoardDateCellParts {
  const dayStart = new Date(d)
  dayStart.setHours(0, 0, 0, 0)
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  const deltaDays = Math.round((todayStart.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000))
  return {
    dateLabel: `${WEEKDAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`,
    deltaDays,
    deltaLabel: deltaDays < 0 ? `(${deltaDays})` : `(+${deltaDays})`,
  }
}

/** Due-date chip parts from a date-only `YYYY-MM-DD` string (bids.bid_due_date). */
export function bidBoardDueCellParts(dateStr: string | null | undefined, today: Date = new Date()): BidBoardDueCellParts | null {
  if (!dateStr || !dateStr.trim()) return null
  const d = new Date(dateStr.trim() + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  const base = partsFromDate(d, today)
  const urgency: BidBoardDueUrgency =
    base.deltaDays > 0 ? 'overdue' : base.deltaDays >= -DUE_SOON_WINDOW_DAYS ? 'soon' : 'normal'
  return { ...base, urgency }
}

/** Last-contact cell parts from a timestamp ISO string (bids.last_contact). */
export function bidBoardLastContactParts(iso: string | null | undefined, today: Date = new Date()): BidBoardDateCellParts | null {
  if (!iso || !iso.trim()) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return partsFromDate(d, today)
}
