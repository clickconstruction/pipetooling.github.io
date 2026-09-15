/**
 * "Sent Jul 1 at $379,895.70 · the book prices it at $385,506.07 today (+$5,610.37)".
 *
 * A sent bid's only trustworthy number is `bids.bid_value`, stamped from the cover letter
 * at send. The Pricing grid and the letter recompute from the bid's price copy — and for
 * the 188 bids the 2026-09-03 backfill froze at *that day's* book (not the send day's), or
 * any bid edited after it went out, that recomputation is not what the customer was quoted.
 * `price_book_entries` keeps no history, so the copies cannot be rebuilt; this line puts the
 * sent number beside the live one wherever the live one is read aloud
 * (`to-dos/frozen-bid-prices/`, PR 2).
 */
import { formatCurrency } from '../format'
import { formatWorkDateYmdFriendly, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

export type SentVsToday =
  | { kind: 'agrees'; sentOn: string; sentValue: number; today: number }
  | { kind: 'differs'; sentOn: string; sentValue: number; today: number; delta: number }

/** A cent either way is rounding, not drift. */
export const SENT_VS_TODAY_TOLERANCE = 0.01

/**
 * Null when the bid was never sent, carries no sent value, or the live number is not known
 * yet (the grid still loading) — the line stays off rather than comparing against nothing.
 */
export function compareSentVsToday(input: {
  bidDateSent: string | null | undefined
  bidValue: number | null | undefined
  today: number | null | undefined
}): SentVsToday | null {
  const { bidDateSent, bidValue, today } = input
  if (!bidDateSent) return null
  if (bidValue == null || !Number.isFinite(bidValue) || bidValue <= 0) return null
  if (today == null || !Number.isFinite(today)) return null
  const delta = today - bidValue
  if (Math.abs(delta) <= SENT_VS_TODAY_TOLERANCE) return { kind: 'agrees', sentOn: bidDateSent, sentValue: bidValue, today }
  return { kind: 'differs', sentOn: bidDateSent, sentValue: bidValue, today, delta }
}

/** `Jul 1` in the current year, `Sep 22, 2025` otherwise — a sent date must never read as this year's. */
export function formatSentOn(ymd: string, currentYear: number): string {
  const y = Number(ymd.slice(0, 4))
  return Number.isFinite(y) && y === currentYear ? formatWorkDateYmdMonthDayShort(ymd) : formatWorkDateYmdFriendly(ymd)
}

export function formatSignedDelta(delta: number): string {
  return `${delta < 0 ? '−' : '+'}$${formatCurrency(Math.abs(delta))}`
}

/**
 * The one sentence. `where` names the live number: the Pricing grid reads from the book,
 * the Cover Letter tab reads what the letter would say today.
 */
export function sentVsTodayText(r: SentVsToday, opts: { where: 'grid' | 'letter'; currentYear: number }): string {
  const lead = `Sent ${formatSentOn(r.sentOn, opts.currentYear)} at $${formatCurrency(r.sentValue)}`
  if (r.kind === 'agrees') return `${lead} · ${opts.where === 'grid' ? 'the book still prices it there' : 'the letter still says so'}`
  const live = opts.where === 'grid' ? `the book prices it at $${formatCurrency(r.today)} today` : `the letter would say $${formatCurrency(r.today)} today`
  return `${lead} · ${live} (${formatSignedDelta(r.delta)})`
}
