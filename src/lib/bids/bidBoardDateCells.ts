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

export type BidBoardDueCellParts = BidBoardDateCellParts & {
  urgency: BidBoardDueUrgency
  /** True when the bid has a terminal outcome — the deadline no longer calls for action. */
  decided: boolean
}

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

/**
 * Due-date chip parts from a date-only `YYYY-MM-DD` string (bids.bid_due_date).
 *
 * `outcome`: once a bid is decided (won / lost / started_or_complete) the
 * urgency colors would be false alarms — a Won bid is not "overdue" — so the
 * chip goes quiet: urgency 'normal' and `decided: true` (renderers drop the
 * day-count line).
 *
 * `dateSent` (v2.1914): a sent-but-undecided bid (the Pending section) is past
 * our action too — the deadline was met, we're waiting on the GC — so it also
 * loses the urgency colors, but keeps its day count as waiting-time context.
 * Red/amber stay exclusive to unsent bids.
 */
export function bidBoardDueCellParts(
  dateStr: string | null | undefined,
  today: Date = new Date(),
  outcome?: string | null,
  dateSent?: string | null,
): BidBoardDueCellParts | null {
  if (!dateStr || !dateStr.trim()) return null
  const d = new Date(dateStr.trim() + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  const base = partsFromDate(d, today)
  const decided = outcome === 'won' || outcome === 'lost' || outcome === 'started_or_complete'
  const sent = Boolean(dateSent && dateSent.trim())
  const urgency: BidBoardDueUrgency = decided || sent
    ? 'normal'
    : base.deltaDays > 0
      ? 'overdue'
      : base.deltaDays >= -DUE_SOON_WINDOW_DAYS
        ? 'soon'
        : 'normal'
  return { ...base, urgency, decided }
}

/** Last-contact cell parts from a timestamp ISO string (bids.last_contact). */
export function bidBoardLastContactParts(iso: string | null | undefined, today: Date = new Date()): BidBoardDateCellParts | null {
  if (!iso || !iso.trim()) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return partsFromDate(d, today)
}

/**
 * Pending rows print their SENT date beside the due chip (J10-F2). The section
 * sorts by `bid_date_sent` (v2.1760) while the only date it used to print was
 * the due date — the column read shuffled unless you knew the hidden key.
 * Date-only `YYYY-MM-DD` in, `sent Thu 9/2` out; null when there is no sent date.
 */
export function bidBoardSentLabel(dateSent: string | null | undefined): string | null {
  if (!dateSent || !dateSent.trim()) return null
  const d = new Date(dateSent.trim() + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  return `sent ${WEEKDAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * An unsent bid with no due date turns red after this many days on the board
 * (J10-F4). Due date and value are optional on New Bid, so 6 of 11 Unsent bids
 * had no due date and could never earn an urgency color — the board's whole
 * urgency system disarmed itself for exactly the bids most likely to rot.
 */
export const UNSENT_NO_DUE_DATE_RED_AFTER_DAYS = 14

export type BidBoardNoDueDateParts = {
  /** Always `No due date`. */
  label: string
  /** Days since the bid was created; null when created_at is unknown. */
  ageDays: number | null
  /** `(+N)` days on the board; empty when the age is unknown. */
  deltaLabel: string
  /** 'overdue' once older than UNSENT_NO_DUE_DATE_RED_AFTER_DAYS, else 'normal'. */
  urgency: BidBoardDueUrgency
}

/**
 * The "no due date" chip for an UNSENT, undecided bid. Returns null when the
 * bid has a due date (the due chip renders), is sent, or is decided — those
 * rows already say what they need to.
 */
export function bidBoardNoDueDateParts(
  bid: { bid_due_date: string | null | undefined; created_at?: string | null; outcome?: string | null; bid_date_sent?: string | null },
  today: Date = new Date(),
): BidBoardNoDueDateParts | null {
  if (bid.bid_due_date && bid.bid_due_date.trim()) return null
  const decided = bid.outcome === 'won' || bid.outcome === 'lost' || bid.outcome === 'started_or_complete'
  if (decided) return null
  if (bid.bid_date_sent && bid.bid_date_sent.trim()) return null
  let ageDays: number | null = null
  if (bid.created_at) {
    const created = new Date(bid.created_at)
    if (!isNaN(created.getTime())) ageDays = partsFromDate(created, today).deltaDays
  }
  return {
    label: 'No due date',
    ageDays,
    deltaLabel: ageDays == null ? '' : `(+${Math.max(0, ageDays)})`,
    urgency: ageDays != null && ageDays > UNSENT_NO_DUE_DATE_RED_AFTER_DAYS ? 'overdue' : 'normal',
  }
}
