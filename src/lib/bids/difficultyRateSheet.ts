/**
 * GC difficulty rating (punch list #357, PR 5): the master's phone sheet, the pure half.
 *
 * A master in the field rates a GC from a bid: the same scales and the same save as the GC's card, with one thing
 * the card cannot say, what the points do to *this* bid in dollars, before Save. The sheet prices the picks on screen
 * with the kernel that writes the lines (`difficultyLines`) over the bid's numbers, read in this order: the bid's pin
 * (`bid_difficulty`, the numbers its lines were made from), else the margin kept on the bid with its estimate's field
 * hours, else nothing, and the box says the bid is not costed yet. Under it, how bids to this GC have gone.
 *
 * Pure: no React, no supabase. `difficultyRateSheetIo.ts` reads; `DifficultyRateSheet.tsx` draws.
 */
import { difficultyPointsWords, difficultyRungSentence, type DifficultyCriteriaBody, type DifficultyPicks } from './difficultyCriteria'
import { bidRatedScales } from './bidDifficultyPicks'
import { difficultyCapWords, difficultyLines, difficultySkippedWords, type DifficultyLines, type DifficultyRatedScale } from './difficultyLines'
import { difficultyPayingByHandOf, difficultyPayingMedianOf, difficultyPayingWords, type DifficultyPayingRead } from './difficultyPaying'
import type { DifficultyPriceList } from './difficultyPrice'
import type { BidPricingHistoryRow } from '../../types/database-functions'

export const RATE_SHEET_WORDS = {
  title: (gc: string) => `Rate ${gc.trim() || 'this GC'}`,
  lead: 'Your points become hours on this bid’s estimate. The office sets what a point costs. Pick the sentence that fits them.',
  askLead: (job: string) => `${job.trim() || 'The job'} is done. Say how they were to work with while it is fresh. Every new bid to them reads it.`,
  notMine: 'Not yours to pick.',
  notReadYet: 'Not read yet.',
  notCosted: 'This bid is not costed yet, so the points have no dollars to show. They will when it is priced.',
  noBid: 'Every new bid to them will carry these points as cost.',
  notNow: 'Not now',
  cannotRate: 'The price list does not let you rate a GC. You can read the rating here.',
  askNotePlaceholder: (job: string) => `On ${job.trim() || 'the job'}: what happened`,
  savedBidOnly: 'Saved on this bid.',
  nothingChanged: 'Nothing changed since the rating that stands.',
} as const

/** "Bid b512 · Riverside Lofts" over the title; the parts that exist. */
export function rateSheetOverTitle(bid: { label: string | null; project: string | null } | null): string | null {
  if (!bid) return null
  const parts = [bid.label?.trim() ? `Bid ${bid.label.trim()}` : null, bid.project?.trim() || null].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/** The bid's numbers the consequence is priced with. */
export type RateSheetBidNumbers = {
  fieldHours: number
  laborRate: number
  /** The bid's own cost before difficulty. */
  ownCost: number
  /** What the paying point carries: the price when the bid has one, else its own cost. */
  carried: number
  /** The margin the bid is priced at, 0–100; null with no price on it. */
  marginPct: number | null
  source: 'pin' | 'priced' | 'estimate'
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * The numbers, by what the bid has. A pin holds exactly what its lines were made from. Without one: the estimate's
 * field hours and rate, the cost kept on the bid less its difficulty part, and the price kept on it, else the bid's
 * value. Null when the bid has neither hours nor a cost: nothing to price a point with.
 */
export function rateSheetBidNumbers(args: {
  pin: { fieldHours: number; laborRate: number; ownCostUsd: number; carriedUsd: number } | null
  stamp: { revenueUsd: number | null | undefined; costUsd: number | null | undefined; difficultyUsd: number | null | undefined } | null
  bidValue: number | null | undefined
  estimate: { fieldHours: number; laborRate: number | null | undefined } | null
}): RateSheetBidNumbers | null {
  const revenue = num(args.stamp?.revenueUsd)
  const cost = num(args.stamp?.costUsd)
  const marginPct = revenue > 0 && args.stamp?.costUsd != null ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null
  if (args.pin && (args.pin.fieldHours > 0 || args.pin.ownCostUsd > 0)) {
    return { fieldHours: args.pin.fieldHours, laborRate: args.pin.laborRate, ownCost: args.pin.ownCostUsd, carried: args.pin.carriedUsd, marginPct, source: 'pin' }
  }
  const fieldHours = Math.max(0, num(args.estimate?.fieldHours))
  const laborRate = Math.max(0, num(args.estimate?.laborRate))
  const ownCost = revenue > 0 ? Math.max(0, cost - num(args.stamp?.difficultyUsd)) : fieldHours * laborRate
  if (!(fieldHours > 0) && !(ownCost > 0)) return null
  const carried = revenue > 0 ? revenue : num(args.bidValue) > 0 ? num(args.bidValue) : ownCost
  return { fieldHours, laborRate, ownCost, carried, marginPct, source: revenue > 0 ? 'priced' : 'estimate' }
}

/**
 * The picks on screen as the lines kernel reads them: each picked scale of the GC, then the bid's own (PR 6, the
 * site), in the criteria's order.
 */
export function rateSheetScales(picks: DifficultyPicks, body: DifficultyCriteriaBody, bidPicks: DifficultyPicks = {}): DifficultyRatedScale[] {
  const of = (s: DifficultyCriteriaBody['scales'][number], from: DifficultyPicks): DifficultyRatedScale => ({ key: s.key, name: s.name, points: from[s.key]!, sentence: difficultyRungSentence(body, s.key, from[s.key]!) ?? '' })
  return [...body.scales.filter((s) => s.scope === 'gc' && picks[s.key] != null).map((s) => of(s, picks)), ...bidRatedScales(bidPicks, body)]
}

export type RateSheetConsequence = {
  /** "4 points · about +$6,400 in cost" */
  head: string
  /** "48 field hours, 12 office hours and the wait on their pay. About +$9,200 on the price at 30%." */
  detail: string | null
  /** The cap's line and each scale that adds nothing, as the Workbench says them. */
  notes: string[]
  lines: DifficultyLines | null
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const hoursOf = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}`

function listWords(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * What the picks on screen would add to this bid, before Save. With no numbers the head is the points alone and the
 * detail says why there are no dollars.
 */
export function rateSheetConsequence(args: {
  picks: DifficultyPicks
  body: DifficultyCriteriaBody
  price: DifficultyPriceList
  numbers: RateSheetBidNumbers | null
  /** The paying pick's words (`pick_reasons.paying`), for the days it carries. */
  payingReason: string | null
  /** A sheet opened with no bid (the end-of-job ask): the points apply to bids to come. */
  hasBid: boolean
  /** The bid's own picks on screen (PR 6); none from the ask. */
  bidPicks?: DifficultyPicks
}): RateSheetConsequence {
  const scales = rateSheetScales(args.picks, args.body, args.hasBid ? args.bidPicks : undefined)
  const points = scales.reduce((n, s) => n + s.points, 0)
  if (!args.hasBid) return { head: difficultyPointsWords(points), detail: RATE_SHEET_WORDS.noBid, notes: [], lines: null }
  if (!args.numbers) return { head: difficultyPointsWords(points), detail: RATE_SHEET_WORDS.notCosted, notes: [], lines: null }
  const n = args.numbers
  const lines = difficultyLines({
    scales,
    price: args.price,
    fieldHours: n.fieldHours,
    laborRate: n.laborRate,
    ownCost: n.ownCost,
    carried: n.carried,
    payingMedianDays: difficultyPayingMedianOf(args.payingReason),
    payingReason: args.payingReason,
  })
  const notes = [difficultyCapWords(lines), ...lines.skipped.map(difficultySkippedWords)].filter((s): s is string => !!s)
  if (lines.total <= 0) return { head: `${difficultyPointsWords(points)} · nothing added to this bid`, detail: null, notes, lines }
  const field = lines.lines.filter((l) => l.key === 'field' || l.key === 'site').reduce((s, l) => s + l.hours, 0)
  const office = lines.lines.filter((l) => l.key === 'office').reduce((s, l) => s + l.hours, 0)
  const paying = lines.lines.some((l) => l.key === 'paying')
  const parts = [field > 0 ? `${hoursOf(field)} field hour${field === 1 ? '' : 's'}` : null, office > 0 ? `${hoursOf(office)} office hour${office === 1 ? '' : 's'}` : null, paying ? 'the wait on their pay' : null].filter((s): s is string => !!s)
  const what = parts.length ? `${listWords(parts).replace(/^./, (c) => c.toUpperCase())}.` : ''
  const onPrice = n.marginPct != null && n.marginPct >= 0 && n.marginPct < 100 ? `About +${money(lines.total / (1 - n.marginPct / 100))} on the price at ${Number.isInteger(n.marginPct) ? n.marginPct : n.marginPct.toFixed(1)}%.` : ''
  return { head: `${difficultyPointsWords(points)} · about +${money(lines.total)} in cost`, detail: [what, onPrice].filter(Boolean).join(' ') || null, notes, lines }
}

/**
 * The Paying scale on the sheet, locked: the point and the numbers behind it, never a pick. The by-hand point the
 * rating that stands holds is said as that; a read is said with its numbers; neither reads *Not read yet*.
 */
export function rateSheetPayingWords(args: { pick: { points: number; reason: string } | null; read: DifficultyPayingRead | null }): string {
  const { pick, read } = args
  if (!pick) return read ? `${difficultyPayingWords(read)} ${RATE_SHEET_WORDS.notMine}` : RATE_SHEET_WORDS.notReadYet
  const byHand = difficultyPayingByHandOf(pick.reason)
  // The reason is a person's own words and may end without a full stop; the next sentence needs one before it.
  if (byHand != null) return `${difficultyPointsWords(pick.points)}, set by hand: ${endedSentence(byHand)} ${RATE_SHEET_WORDS.notMine}`
  const behind = read && read.points != null ? difficultyPayingWords(read) : pick.reason.replace(/^Read from their bills:\s*/, '')
  return `${difficultyPointsWords(pick.points)} from their bills · ${behind} ${RATE_SHEET_WORDS.notMine}`
}

/** A person's words as a sentence: a full stop added when they end without a mark. */
function endedSentence(words: string): string {
  const t = words.trim()
  return /[.!?…]$/.test(t) ? t : `${t}.`
}

export type RateSheetGcRecord = { total: number; won: number; lowPct: number | null; highPct: number | null }

/** The GC's decided bids of this kind of work, and the estimated margin the won ones went at. Null with none. */
export function rateSheetGcRecord(rows: readonly BidPricingHistoryRow[] | null, customerId: string | null | undefined): RateSheetGcRecord | null {
  if (!rows || !customerId) return null
  const mine = rows.filter((r) => r.customer_id === customerId)
  if (mine.length === 0) return null
  const margins = mine
    .filter((r) => r.outcome === 'won' && Number(r.bid_value) > 0 && Number(r.est_cost) > 0)
    .map((r) => Math.round(((Number(r.bid_value) - Number(r.est_cost)) / Number(r.bid_value)) * 100))
  return { total: mine.length, won: mine.filter((r) => r.outcome === 'won').length, lowPct: margins.length ? Math.min(...margins) : null, highPct: margins.length ? Math.max(...margins) : null }
}

/** "Bids like this: won 2 of 3 to them, at 28 to 32%." */
export function rateSheetGcRecordWords(r: RateSheetGcRecord | null): string | null {
  if (!r) return null
  const head = `Bids like this: won ${r.won} of ${r.total} to them`
  if (r.lowPct == null || r.highPct == null) return `${head}.`
  return r.lowPct === r.highPct ? `${head}, at ${r.lowPct}%.` : `${head}, at ${r.lowPct} to ${r.highPct}%.`
}

/**
 * What Save does (PR 6): the GC's rating when the person touched it, the bid's own picks when they moved, or both.
 * From a bid the rating is touched when a pick differs from the one that stands (or, with none standing, when a GC
 * scale is picked); from the ask it always is, since the same picks with what happened is a rating. The GC's rules
 * (a pick and a reason) bind only when the rating is being saved.
 */
export function rateSheetSavePlan(args: { fromAsk: boolean; hasStanding: boolean; gcChanged: boolean; gcPicked: boolean; gcProblems: readonly string[]; bidChanged: boolean; noPickWords: string }): { rating: boolean; bidPicks: boolean; dead: boolean; why: string | null } {
  const rating = args.fromAsk || (args.hasStanding ? args.gcChanged : args.gcPicked)
  if (rating && args.gcProblems.length > 0) return { rating, bidPicks: args.bidChanged, dead: true, why: args.gcProblems[0] ?? null }
  if (!rating && !args.bidChanged) return { rating, bidPicks: false, dead: true, why: args.hasStanding ? RATE_SHEET_WORDS.nothingChanged : args.noPickWords }
  return { rating, bidPicks: args.bidChanged, dead: false, why: null }
}
