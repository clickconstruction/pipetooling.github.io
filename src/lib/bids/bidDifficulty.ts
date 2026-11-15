/**
 * GC difficulty rating (punch list #357, PR 4): the lines a bid was priced with, pinned on the bid.
 *
 * When the Workbench first costs a bid to a rated GC it runs `difficultyLines` over the standing rating and the
 * published price list, writes the lines as rows of the estimate's Other direct costs (one row per line, the dollars
 * split by stage as the bid's field hours are), and pins what it wrote in `bid_difficulty`: the rating, the two
 * versions, the lines, the rows' ids. The pin is what the Workbench strip reads, what the Labor tab marks as
 * difficulty rows, and what says "rated higher since this was priced" when the GC's rating moved on.
 *
 * Pure: the rows to insert, the stage split, the stale check, the words. The reads and writes are in
 * `bidDifficultyIo.ts`.
 */
import type { DifficultyLine, DifficultyLineStored, DifficultyLines } from './difficultyLines'
import { difficultyRowDescription } from './difficultyLines'
import type { GcDifficultyStanding } from './gcDifficultyRating'
import { laborRowRough, laborRowTop, laborRowTrim } from './laborRowHours'

export type BidDifficultyRemoved = { key: string; name: string; amount: number; reason: string; byName: string; at: string }

export type BidDifficulty = {
  id: string
  bidId: string
  costEstimateId: string | null
  ratingId: string | null
  criteriaVersionId: string | null
  priceVersionId: string | null
  picks: Record<string, number>
  lines: DifficultyLineStored[]
  rowIds: string[]
  removed: BidDifficultyRemoved[]
  points: number
  totalUsd: number
  fieldHours: number
  laborRate: number
  ownCostUsd: number
  carriedUsd: number
  pricedByName: string
  pricedAt: string
}

/** A labor row as the hours kernel reads it. */
export type LaborStageRow = Parameters<typeof laborRowRough>[0]

/** The share of the bid's field hours in each stage; all in rough-in when the bid has no hours. */
export function bidDifficultyStageShares(laborRows: readonly LaborStageRow[]): { rough_in: number; top_out: number; trim_set: number } {
  let rough = 0
  let top = 0
  let trim = 0
  for (const r of laborRows) {
    rough += laborRowRough(r)
    top += laborRowTop(r)
    trim += laborRowTrim(r)
  }
  const all = rough + top + trim
  if (!(all > 0)) return { rough_in: 1, top_out: 0, trim_set: 0 }
  return { rough_in: rough / all, top_out: top / all, trim_set: trim / all }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export type DifficultyOtherRowInsert = { cost_estimate_id: string; note: string; rough_in: number; top_out: number; trim_set: number; sequence_order: number }

/**
 * The Other rows the lines become, one per line, the dollars split by the stage shares to the cent (the last stage
 * takes the rounding). The note carries the line's name, points and arithmetic, so the Labor tab reads it alone.
 */
export function bidDifficultyRowsFor(lines: readonly DifficultyLine[], costEstimateId: string, shares: { rough_in: number; top_out: number; trim_set: number }, firstSequence: number): DifficultyOtherRowInsert[] {
  return lines.map((l, i) => {
    const rough = round2(l.amount * shares.rough_in)
    const top = round2(l.amount * shares.top_out)
    const trim = round2(l.amount - rough - top)
    return { cost_estimate_id: costEstimateId, note: difficultyRowDescription(l), rough_in: rough, top_out: top, trim_set: trim, sequence_order: firstSequence + i }
  })
}

/** The difficulty rows' dollars as they stand on the estimate now (a person may have taken one off). */
export function bidDifficultyAmountOnRows(rows: ReadonlyArray<{ id: string; rough_in: number; top_out: number; trim_set: number }>, rowIds: readonly string[]): number {
  const ids = new Set(rowIds)
  return round2(rows.filter((r) => ids.has(r.id)).reduce((n, r) => n + (Number(r.rough_in) || 0) + (Number(r.top_out) || 0) + (Number(r.trim_set) || 0), 0))
}

export type BidDifficultyStale = { kind: 'higher' | 'lower' | 'reworded' | 'bid'; words: string } | null

/**
 * Whether the GC's standing rating is a different rating from the one the bid was priced with: "rated higher since
 * this was priced" (the owner's line), lower, or the same points under new words. Since PR 6, also whether the bid's
 * own picks moved (`bidPicksWords`), and whether a bid priced on its own picks alone is to a GC rated since. Null
 * when the pin is what stands, or there is no pin.
 */
export function bidDifficultyStale(pin: BidDifficulty | null, standing: GcDifficultyStanding | null, bidPicksWords: string | null = null, bidScaleKeys: readonly string[] = []): BidDifficultyStale {
  if (!pin) return null
  // The bid's own picks (PR 6, the site) moved since it was priced: `bidPicksStaleWords` says how.
  const own: BidDifficultyStale = bidPicksWords ? { kind: 'bid', words: bidPicksWords } : null
  // A bid priced on its own picks alone, to a GC rated since: the rating is new to it.
  if (standing && !pin.ratingId) return { kind: 'higher', words: `Rated since this was priced: ${standing.points} point${standing.points === 1 ? '' : 's'}${standing.rating.ratedByName.trim() ? `, by ${standing.rating.ratedByName.trim()}` : ''} on ${standing.rating.ratedAt.slice(0, 10)}.` }
  if (!standing || !pin.ratingId || pin.ratingId === standing.rating.id) return own
  // The GC's part of what was priced: the pin's points less the bid's own scales, which the rating never held. After
  // a take-off the pin's points are its remaining lines'; before one they are every rated scale's.
  const ownPoints = pin.removed.length > 0 ? pin.lines.filter((l) => bidScaleKeys.includes(l.key)).reduce((n, l) => n + l.points, 0) : bidScaleKeys.reduce((n, k) => n + (pin.picks[k] ?? 0), 0)
  const was = pin.points - ownPoints
  const now = standing.points
  const by = standing.rating.ratedByName.trim()
  const when = standing.rating.ratedAt.slice(0, 10)
  const who = `${by ? `${by} ` : ''}on ${when}`
  if (now > was) return { kind: 'higher', words: `Rated higher since this was priced: ${now} points now, ${was} when priced, by ${who}.` }
  if (now < was) return { kind: 'lower', words: `Rated lower since this was priced: ${now} points now, ${was} when priced, by ${who}.` }
  return { kind: 'reworded', words: `Rated again since this was priced, ${now} points both times, by ${who}.` }
}

export const BID_DIFFICULTY_WORDS = {
  foldTitle: 'The difficulty lines, on the Labor tab’s direct costs',
  openRating: 'Open the GC’s rating',
  readIn: 'Read the new rating in',
  readInBusy: 'Reading it in…',
  takeOff: 'Take a line off this bid…',
  takeOffLead: 'The GC keeps its rating; the bid records who took it off and why.',
  takeOffLine: 'Which line',
  takeOffReason: 'Why',
  takeOffReasonPlaceholder: 'Their super on this one is the good one',
  takeOffNoReason: 'Say why. A line taken off with no reason is the problem this strip fixes.',
  takeOffPress: (name: string) => `Take ${name} off this bid`,
  notNow: 'Not now',
  nothingLeft: 'Every line is off this bid.',
  noPrice: 'No price list is published, so the rating adds nothing yet.',
  noRating: 'The GC is not rated, so nothing is added.',
  writing: 'Reading the GC’s rating into this bid…',
  wrote: (n: number, total: string) => `Read the GC’s rating in: ${n} line${n === 1 ? '' : 's'}, ${total} in cost, on the Labor tab.`,
  tookOff: (name: string) => `${name} is off this bid.`,
  laborChip: 'difficulty',
  laborChipTitle: 'From the GC’s rating by the Bid Board’s pricing rules. Take it off from the Pricing tab’s Workbench, with a reason.',
  pricedBy: (byName: string, day: string) => `priced ${byName ? `by ${byName} ` : ''}on ${day}`,
} as const

/** "Office 1 · $960 taken off by Robert on 2026-11-20: their office on this one is the good one." */
export function bidDifficultyRemovedWords(r: BidDifficultyRemoved): string {
  const money = `$${Math.round(r.amount).toLocaleString('en-US')}`
  const day = r.at.slice(0, 10)
  const reason = r.reason.trim()
  return `${r.name} · ${money} taken off${r.byName ? ` by ${r.byName}` : ''} on ${day}${reason ? `: ${reason}` : ''}`
}

/** What the pin becomes after one line is taken off: that line out, the rest and the total kept. */
export function bidDifficultyAfterTakeOff(pin: BidDifficulty, key: string, reason: string, byName: string, at: string): { lines: DifficultyLineStored[]; removed: BidDifficultyRemoved[]; points: number; totalUsd: number; rowIndex: number } | null {
  const rowIndex = pin.lines.findIndex((l) => l.key === key)
  if (rowIndex < 0) return null
  const line = pin.lines[rowIndex]!
  const lines = pin.lines.filter((_, i) => i !== rowIndex)
  return {
    lines,
    removed: [...pin.removed, { key: line.key, name: line.name, amount: line.amount, reason: reason.trim(), byName, at }],
    points: lines.reduce((n, l) => n + l.points, 0),
    totalUsd: round2(lines.reduce((n, l) => n + l.amount, 0)),
    rowIndex,
  }
}

/** The pin a fresh write makes, before the database stamps it. */
export function bidDifficultyPinFor(args: {
  bidId: string
  costEstimateId: string
  /** The GC's standing rating; null for a bid priced on its own picks alone (PR 6). */
  standing: GcDifficultyStanding | null
  /** The bid's own picks and the published version they were read under (PR 6). */
  bidPicks?: Record<string, number>
  publishedVersionId?: string | null
  priceVersionId: string
  lines: DifficultyLines
  fieldHours: number
  laborRate: number
  ownCost: number
  carried: number
  rowIds: string[]
}): Omit<BidDifficulty, 'id' | 'pricedByName' | 'pricedAt'> {
  return {
    bidId: args.bidId,
    costEstimateId: args.costEstimateId,
    ratingId: args.standing?.rating.id ?? null,
    criteriaVersionId: args.standing?.rating.criteriaVersionId ?? args.publishedVersionId ?? null,
    priceVersionId: args.priceVersionId,
    picks: { ...(args.standing?.rating.picks ?? {}), ...(args.bidPicks ?? {}) },
    lines: args.lines.lines.map(({ key, name, points, hours, rate, amount, sentence, words }) => ({ key, name, points, hours, rate, amount, sentence, words })),
    rowIds: args.rowIds,
    removed: [],
    points: args.lines.points,
    totalUsd: args.lines.total,
    fieldHours: args.fieldHours,
    laborRate: args.laborRate,
    ownCostUsd: args.ownCost,
    carriedUsd: args.carried,
  }
}
