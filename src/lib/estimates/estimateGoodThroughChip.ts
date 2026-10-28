/**
 * The Pipeline's good-through-passed chip (v2.6037, punch list #206's follow-up). A sent estimate
 * whose good-through day is behind us used to wear the same Sent chip as a live one (*never opened ·
 * sent 34d ago — nudge?*), so the office learned the date had passed when the customer called
 * (the City of Seguin, 2026-10-27). Now the chip turns red and reads *good through passed · extend?*,
 * and its press lands on the sent view's **Extend good-through** door — v2.5992's panel, the one
 * door — with the date field in hand. The office reads it; the customer never sees it.
 *
 * Pure: the rule, the words, the tone and the press's address. The chip is drawn by
 * `components/estimates/EstimateGoodThroughPassedChip.tsx` from the list table and the phone cards;
 * the page scrolls to the panel on the hash. "Today" is the company's calendar day
 * (`todayYmdInAppTz`), never the browser's, as `goodThroughState` compares it.
 */
import { canExtendEstimateGoodThrough, extendLeadWords, goodThroughState } from './estimateGoodThroughExtend'

/** The hash the chip's press lands on: the sent view's Extend good-through panel carries it as its id. */
export const EXTEND_GOOD_THROUGH_HASH = 'extend-good-through'

/** The chip's words, the card's own (`to-dos/estimate-extend-pdf-options.md`). */
export const GOOD_THROUGH_PASSED_CHIP_WORDS = 'good through passed · extend?'

/**
 * The chip's tone: red, the status colour a passed date earns, drawn as a pill so it reads as a
 * press. The pair is held at 4.5:1 in both themes by `src/lib/readablePairs.test.ts`.
 */
export const GOOD_THROUGH_PASSED_CHIP_COLORS = {
  fg: 'var(--text-red-700)',
  bg: 'var(--bg-red-tint)',
  border: 'var(--border-red)',
} as const

export type GoodThroughPassedChip = {
  /** `good through passed · extend?` */
  label: string
  /** The hover: *Pricing passed its good-through date on Oct 26, 2026. Extend it and the link they have works again.* */
  title: string
  /** Where the press lands: the estimate's sent view, scrolled to the Extend good-through door. */
  href: string
  /** The day that passed, YYYY-MM-DD. */
  ymd: string
}

/** What the chip reads off a Pipeline row. */
export type GoodThroughChipRow = {
  status: string | null | undefined
  sent_at?: string | null
  valid_until?: string | null
  bid_room_id?: string | null
  estimate_number: number
}

/** The sent view with the Extend door in view: `/estimates/176#extend-good-through`. */
export function extendGoodThroughHref(estimateNumber: number): string {
  return `/estimates/${estimateNumber}#${EXTEND_GOOD_THROUGH_HASH}`
}

/**
 * The chip for a Pipeline row, or null when today's chip stays. It shows only where the door it
 * opens is offered — `canExtendEstimateGoodThrough`: a `sent` row with a send on record, not in a
 * bid room; never a draft, an accepted, a declined or a superseded row — and only once the day is
 * strictly before today in the company's calendar, the day the accept page starts answering
 * *Estimate expired*. The same day is still live.
 */
export function goodThroughPassedChip(row: GoodThroughChipRow, todayYmd: string): GoodThroughPassedChip | null {
  if (!canExtendEstimateGoodThrough(row.status, row.sent_at, { inBidRoom: Boolean(row.bid_room_id) }).ok) return null
  const state = goodThroughState(row.valid_until, todayYmd)
  if (state.kind !== 'passed') return null
  return {
    label: GOOD_THROUGH_PASSED_CHIP_WORDS,
    title: extendLeadWords(row.valid_until, todayYmd),
    href: extendGoodThroughHref(row.estimate_number),
    ymd: state.ymd,
  }
}
