/**
 * Bid history, Put back (punch list #73, PR 4). In the History window, every changed value on the
 * open bid has **Put back**: one press writes the value it had before that change, through
 * `put_back_bid_change`, which runs under the presser's own policies (the owner, 2026-10-08: anyone
 * who can edit the bid may Put back). The ledger records the put back as their change, tagged
 * `put-back`, so it can itself be put back. A removed row is not a changed value; it comes back
 * another way (a later PR).
 *
 * Pure: which line offers Put back, and the words around it.
 */
import { bidHistoryColumnName, bidHistoryValueWords, type BidHistoryRow } from './bidHistory'

/** Tells the open bid's tabs that a value was put back, so they read the bid again. */
export const BID_HISTORY_PUT_BACK_EVENT = 'bid-history-put-back'
export type BidHistoryPutBackDetail = { bidId: string; table: string }

export type BidPutBackTarget = {
  changeId: number
  column: string
  /** What goes back, in words: "Lav-1 price", "Bid due". */
  what: string
  /** The value it goes back to, in words: "$9,800". */
  value: string
}

/**
 * What a line's Put back writes, or null when the line offers none: a removal or an addition, a
 * row from the delete archive, or a row of a bid adopted into this one (put that back on its bid).
 */
export function bidPutBackTarget(row: BidHistoryRow, column: string | null | undefined, openBidId: string): BidPutBackTarget | null {
  if (!column || row.source !== 'ledger' || row.op !== 'update' || row.id == null) return null
  if (row.bidId !== openBidId || !row.changed.includes(column)) return null
  const subject = row.table === 'bids' ? 'Bid' : row.label?.trim() || 'The row'
  return { changeId: row.id, column, what: `${subject} ${bidHistoryColumnName(column)}`, value: bidHistoryValueWords(column, row.oldValues?.[column]) }
}

/** The button's name for a screen reader: "Put back Lav-1 price to $9,800". */
export function bidPutBackLabel(target: BidPutBackTarget): string {
  return `Put back ${target.what} to ${target.value}`
}

/** `put_back_bid_change`'s answer. */
export type BidPutBackResult = {
  table: string
  record_id: string
  label: string | null
  columns: string[]
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

/** The line after a put back: "Lav-1 price is $9,800 again.", or "… was already $9,800." when nothing moved. */
export function bidPutBackDoneWords(target: BidPutBackTarget, result: BidPutBackResult): string {
  const same = JSON.stringify(result.before?.[target.column] ?? null) === JSON.stringify(result.after?.[target.column] ?? null)
  return same ? `${target.what} was already ${target.value}.` : `${target.what} is ${target.value} again.`
}

/**
 * The line when a put back fails. The function's own refusals are already sentences ("That row
 * was removed since. Put the row back first."); a missing function means the update has not
 * reached the database yet.
 */
export function bidPutBackFailWords(message: string): string {
  const m = message.trim()
  if (/could not find the function|put_back_bid_change.*does not exist/i.test(m)) return 'Put back is not ready yet. Try again after the next update.'
  if (/^(That|Only|Another|What|You) .*\.$/.test(m)) return m
  return `It was not put back: ${m}`
}
