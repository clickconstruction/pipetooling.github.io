/**
 * Ordering for the no-bid-selected picker on the bid workflow tabs (Counts,
 * Takeoffs, Labor, Pricing, Cover Letter, RFI, Change Order, Lien Release).
 *
 * The picker previously rendered in fetch order (`bid_due_date` desc, nulls
 * first), which read as random. Rows now sort by a user-chosen view; the
 * choice persists per browser and is shared by all eight tabs.
 */

export type BidPickerSortView = 'number' | 'due' | 'sent' | 'value'

export const BID_PICKER_SORT_VIEWS: { key: BidPickerSortView; label: string; title: string }[] = [
  { key: 'number', label: 'Bid # ↓', title: 'Highest bid number first' },
  { key: 'due', label: 'Due date', title: 'Soonest due date first; bids with no due date last' },
  { key: 'sent', label: 'Sent', title: 'Most recently sent first; unsent bids last' },
  { key: 'value', label: 'Value', title: 'Largest bid value first; bids with no value last' },
]

export const DEFAULT_BID_PICKER_SORT_VIEW: BidPickerSortView = 'number'

export function normalizeBidPickerSortView(raw: unknown): BidPickerSortView {
  return BID_PICKER_SORT_VIEWS.some((v) => v.key === raw) ? (raw as BidPickerSortView) : DEFAULT_BID_PICKER_SORT_VIEW
}

export type BidPickerSortBid = {
  id: string
  bid_number: string | null
  bid_due_date: string | null
  bid_date_sent: string | null
  bid_value: number | string | null
}

/** First run of digits in `bid_number` as a number ("302" → 302, "302R1" → 302); null when none. */
export function parseBidNumberNumeric(bidNumber: string | null | undefined): number | null {
  const m = (bidNumber ?? '').match(/\d+/)
  return m ? Number(m[0]) : null
}

function normalizedYmd(d: string | null | undefined): string | null {
  const t = (d ?? '').trim()
  return t === '' ? null : t.slice(0, 10)
}

function numericValue(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Descending numeric bid number, unnumbered last; stable `id` tie-break. */
function compareByNumberDesc(a: BidPickerSortBid, b: BidPickerSortBid): number {
  const an = parseBidNumberNumeric(a.bid_number)
  const bn = parseBidNumberNumeric(b.bid_number)
  if (an == null && bn == null) return a.id.localeCompare(b.id)
  if (an == null) return 1
  if (bn == null) return -1
  if (an !== bn) return bn - an
  return a.id.localeCompare(b.id)
}

export function compareBidsForPicker(view: BidPickerSortView, a: BidPickerSortBid, b: BidPickerSortBid): number {
  if (view === 'due') {
    const ad = normalizedYmd(a.bid_due_date)
    const bd = normalizedYmd(b.bid_due_date)
    if (ad == null && bd == null) return compareByNumberDesc(a, b)
    if (ad == null) return 1
    if (bd == null) return -1
    const byDate = ad.localeCompare(bd)
    if (byDate !== 0) return byDate
    return compareByNumberDesc(a, b)
  }
  if (view === 'sent') {
    const ad = normalizedYmd(a.bid_date_sent)
    const bd = normalizedYmd(b.bid_date_sent)
    if (ad == null && bd == null) return compareByNumberDesc(a, b)
    if (ad == null) return 1
    if (bd == null) return -1
    const byDate = bd.localeCompare(ad)
    if (byDate !== 0) return byDate
    return compareByNumberDesc(a, b)
  }
  if (view === 'value') {
    const av = numericValue(a.bid_value)
    const bv = numericValue(b.bid_value)
    if (av == null && bv == null) return compareByNumberDesc(a, b)
    if (av == null) return 1
    if (bv == null) return -1
    if (av !== bv) return bv - av
    return compareByNumberDesc(a, b)
  }
  return compareByNumberDesc(a, b)
}

export function sortBidsForPicker<T extends BidPickerSortBid>(bids: readonly T[], view: BidPickerSortView): T[] {
  return [...bids].sort((a, b) => compareBidsForPicker(view, a, b))
}
