import type { ReflexId } from './waits'

/**
 * What a fix is worth (v2.6840, punch list #303): *This week* sized three what-ifs in dollars a
 * day, and the list left the page with the doors. Two of the three were already presses on the
 * usual fixes, so their sizes ride on those rows; the third, a bid that is due, is two lines
 * under them with its door. The sums are `buildThisWeek`'s own (`thisWeek.ts`, which the weekly
 * mail's sheet still reads): an extra field day is eight hours' margin spread over the week,
 * overhead is cut by a tenth, and a win is its margin spread over sixty days of work.
 */

export const FIX_BID_DAYS = 60
export const FIX_BIDS_SHOWN = 2

export type FixSize = { size: string; why: string }

export type FixBid = { id: string; label: string; sub: string; size: string | null; door: { to: string; label: string } }

export type FixSizes = {
  /** By the usual fix's id: only the two the app can size. */
  rows: Partial<Record<ReflexId, FixSize>>
  bids: FixBid[]
  bidsNote: string
}

export type FixSizesInput = {
  /** Field earned per approved hour over the window, and the margin on it. */
  fieldEarnedPerHour: number | null
  contributionMargin: number | null
  overheadPerDayUsd: number
  bidsDue: ReadonlyArray<{ id: string; label: string; bidValueUsd: number; dueYmd: string }>
  dayLabel: (ymd: string) => string
}

const money = (n: number): string => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const shortK = (n: number): string => (Math.abs(n) >= 100_000 ? `$${(Math.abs(n) / 1000).toFixed(0)}k` : Math.abs(n) >= 1000 ? `$${(Math.abs(n) / 1000).toFixed(1).replace(/\.0$/, '')}k` : money(n))

export function buildFixSizes(input: FixSizesInput): FixSizes {
  const rows: FixSizes['rows'] = {}
  const perHour = input.fieldEarnedPerHour
  const margin = input.contributionMargin
  if (perHour != null && perHour > 0 && margin != null && margin > 0) {
    rows.fieldday = { size: `+${money((perHour * margin * 8) / 7)} a day`, why: `One more day a week, at ${money(perHour)} an hour earned.` }
  }
  if (input.overheadPerDayUsd > 0) {
    rows.overhead = { size: `+${money(input.overheadPerDayUsd * 0.1)} a day`, why: `A tenth of ${money(input.overheadPerDayUsd)} a day.` }
  }
  const bids = input.bidsDue.slice(0, FIX_BIDS_SHOWN).map((b) => ({
    id: b.id,
    label: b.label,
    sub: `${shortK(b.bidValueUsd)}, due ${input.dayLabel(b.dueYmd)}`,
    size: margin != null && margin > 0 ? `+${money((b.bidValueUsd * margin) / FIX_BID_DAYS)} a day` : null,
    door: { to: '/bids', label: 'Bids' },
  }))
  return { rows, bids, bidsNote: `A win is spread over ${FIX_BID_DAYS} days of work.` }
}
