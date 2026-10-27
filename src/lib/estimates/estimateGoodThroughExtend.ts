/**
 * Extend the good-through date (v2.5992, punch list #204 PR 1): the rule and the words behind the
 * **Extend good-through** press on a sent estimate. A city's estimate (#156, 2026-10-27) expired while
 * its five people each held a copy of the one emailed link; Resend was refused for the past date and
 * would have re-minted the link anyway, so the office remade the estimate by hand. Now the office
 * picks a new day and the RPC `extend_estimate_good_through` moves `valid_until`, pushes the link's
 * own end (and every shared link's) past that day, and writes the trail row — the hash untouched, so
 * every copy of the link keeps working.
 *
 * Pure; the panel is `components/estimates/EstimateExtendGoodThroughPanel.tsx`, the activity line
 * is drawn by the page's Customer activity section.
 */
import { addCalendarDaysYmd } from '../addCalendarDaysYmd'
import { formatValidUntilCompact, formatValidUntilForDisplay } from '../formatEstimateValidUntilDisplay'

export type EstimateExtendBlockReason = 'draft' | 'accepted' | 'declined' | 'superseded' | 'never_sent' | 'bid_room' | 'unknown_status'

export type EstimateExtendVerdict = { ok: true } | { ok: false; reason: EstimateExtendBlockReason }

/**
 * Can this estimate's good-through date be moved? Only a `sent` row with a send on record and not
 * in a bid room. A past date is never a blocker — that is what the press fixes — and neither is an
 * expired link, which the RPC pushes forward with the date.
 */
export function canExtendEstimateGoodThrough(
  status: string | null | undefined,
  sentAt: string | null | undefined,
  opts: { inBidRoom?: boolean } = {},
): EstimateExtendVerdict {
  switch (status) {
    case 'draft':
      return { ok: false, reason: 'draft' }
    case 'customer_accepted':
      return { ok: false, reason: 'accepted' }
    case 'declined':
      return { ok: false, reason: 'declined' }
    case 'superseded':
      return { ok: false, reason: 'superseded' }
    case 'sent':
      break
    default:
      return { ok: false, reason: 'unknown_status' }
  }
  if (!sentAt || Number.isNaN(Date.parse(String(sentAt)))) return { ok: false, reason: 'never_sent' }
  if (opts.inBidRoom) return { ok: false, reason: 'bid_room' }
  return { ok: true }
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** `estimates.valid_until` as a calendar day, or null when the row has none or it does not read. */
export function goodThroughYmd(validUntil: string | null | undefined): string | null {
  const t = (validUntil ?? '').trim().slice(0, 10)
  return YMD.test(t) ? t : null
}

export type GoodThroughState =
  | { kind: 'none' }
  | { kind: 'live'; ymd: string; words: string }
  | { kind: 'passed'; ymd: string; words: string }

/**
 * Where the date stands today (the company's calendar day): `Good through Nov 26, 2026`, or
 * `Good through Oct 24, 2026 · passed` once the day is behind us. The accept page answers
 * *Estimate expired* from the day after, so "passed" means strictly before today.
 */
export function goodThroughState(validUntil: string | null | undefined, todayYmd: string): GoodThroughState {
  const ymd = goodThroughYmd(validUntil)
  if (!ymd) return { kind: 'none' }
  const pretty = formatValidUntilForDisplay(ymd)
  if (ymd < todayYmd) return { kind: 'passed', ymd, words: `Good through ${pretty} · passed` }
  return { kind: 'live', ymd, words: `Good through ${pretty}` }
}

/** The three quick picks beside the date, counted from today. */
export const EXTEND_PRESETS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 14, label: '+2 weeks' },
  { days: 30, label: '+30 days' },
  { days: 60, label: '+60 days' },
]

/** The day a preset lands on, from today (local calendar, as the draft's own presets count). */
export function extendPresetYmd(days: number, base: Date = new Date()): string {
  return addCalendarDaysYmd(days, base)
}

/** The preset the picked day matches, or null. */
export function extendPresetMatching(ymd: string, base: Date = new Date()): number | null {
  for (const p of EXTEND_PRESETS) if (extendPresetYmd(p.days, base) === ymd) return p.days
  return null
}

export type ExtendDateProblem = 'not_a_date' | 'before_today' | 'same_day'

/** Why the picked day cannot be the new good-through, or null when it can. */
export function extendDateProblem(ymd: string, todayYmd: string, currentValidUntil: string | null | undefined): ExtendDateProblem | null {
  const t = ymd.trim()
  if (!YMD.test(t)) return 'not_a_date'
  if (t < todayYmd) return 'before_today'
  if (t === goodThroughYmd(currentValidUntil)) return 'same_day'
  return null
}

export function extendDateProblemWords(problem: ExtendDateProblem): string {
  switch (problem) {
    case 'not_a_date':
      return 'Pick the day the pricing is good through.'
    case 'before_today':
      return 'The day must be today or later.'
    case 'same_day':
      return 'That is already the good-through day.'
  }
}

export const EXTEND_WORDS = {
  /** The panel's label over the date. */
  label: 'Good through',
  /** The toast after the press: `Good through Nov 26, 2026. The link they have works again.` */
  done: (ymd: string, wasPassed: boolean) =>
    wasPassed ? `Good through ${formatValidUntilForDisplay(ymd)}. The link they have works again.` : `Good through ${formatValidUntilForDisplay(ymd)}.`,
  busy: 'Extending…',
} as const

/**
 * The sentence over the date field. Once the day has passed: *Pricing passed its good-through date
 * on Oct 24, 2026. Extend it and the link they have works again.* While it is still good: *Good
 * through Nov 26, 2026. Extend it to give them more room.* With no date: *This estimate has no
 * good-through date. Set one here.*
 */
export function extendLeadWords(validUntil: string | null | undefined, todayYmd: string): string {
  const state = goodThroughState(validUntil, todayYmd)
  if (state.kind === 'passed') return `Pricing passed its good-through date on ${formatValidUntilCompact(state.ymd)}. Extend it and the link they have works again.`
  if (state.kind === 'live') return `Good through ${formatValidUntilCompact(state.ymd)}. Extend it to give them more room.`
  return 'This estimate has no good-through date. Set one here.'
}

/** The button names the act and the day: `Extend good-through to Nov 26, 2026`. */
export function extendButtonLabel(ymd: string): string {
  return YMD.test(ymd.trim()) ? `Extend good-through to ${formatValidUntilCompact(ymd.trim())}` : 'Extend good-through'
}

/** The `good_through_extended` event's metadata, as the RPC writes it. */
export type GoodThroughExtendedMeta = { from: string | null; to: string | null; userName: string | null }

export function parseGoodThroughExtendedMetadata(meta: unknown): GoodThroughExtendedMeta {
  const m = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {}
  const day = (v: unknown) => (typeof v === 'string' && YMD.test(v.trim().slice(0, 10)) ? v.trim().slice(0, 10) : null)
  const name = typeof m.user_name === 'string' && m.user_name.trim() ? m.user_name.trim() : null
  return { from: day(m.from), to: day(m.to), userName: name }
}

/**
 * The Customer activity line: *Good-through date extended to Nov 26, 2026 by Taunya (was Oct 24,
 * 2026)*. A row with no `to` reads *Good-through date extended*.
 */
export function goodThroughExtendedLine(meta: GoodThroughExtendedMeta): string {
  if (!meta.to) return 'Good-through date extended'
  const by = meta.userName ? ` by ${meta.userName}` : ''
  const was = meta.from ? ` (was ${formatValidUntilCompact(meta.from)})` : ''
  return `Good-through date extended to ${formatValidUntilCompact(meta.to)}${by}${was}`
}
