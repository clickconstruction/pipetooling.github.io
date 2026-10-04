import { type SovLine, lineSplit, scaleLinesToContract } from './bidDocuments/sovLines'
import type { SovStageSplit } from './bidDocuments/sovLaborMaterial'
import { stageRank } from './jobs/stageRecognition'
import { type PayApplicationLine, type PayApplicationLineStage, cents, linePercentDone } from './aiaPayApplicationLines'

/**
 * The bid's schedule of values as the lines of a job's first pay application (v2.4502).
 *
 * The owner, 2026-10-04: use the bid's schedule (it is what the GC saw), with the job's reported
 * percents offered on it. A bid with its own lines comes over as written; a bid left on the three
 * stages comes over as three lines; a job with no bid keeps its one line. After application 1 the
 * lines are the job's: they carry forward from the saved application, not from the bid.
 */

export type BidSchedule = {
  lines: PayApplicationLine[]
  /** The bid prints labor and material apart, so the job starts that way too. */
  splitLaborMaterial: boolean
  shape: 'lines' | 'stage'
}

const blankAmounts = { fromPrevious: 0, thisPeriod: 0, stored: 0 }

/** The estimator's own lines (`bid_sov_lines`), in their order; an empty row is left behind. Labor is the typed figure, else the company share. */
export function linesFromBidSovLines(sovLines: ReadonlyArray<SovLine>, ruleLaborPct: number): PayApplicationLine[] {
  return [...sovLines]
    .filter((l) => l.label.trim() || cents(l.value) > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({
      id: `sov-${l.id}`,
      label: l.label.trim(),
      scheduledValue: cents(l.value),
      labor: lineSplit(l, ruleLaborPct).labor,
      stage: l.stage,
      ...blankAmounts,
    }))
}

/**
 * The three stages as lines, each with its labor part: what a bid left on the stages gives.
 * Fewer than two stages with a value is no schedule ([]): a half-staged bid puts the whole
 * contract on one stage, and the job's own one line says more than that.
 */
export function linesFromStageSplits(splits: ReadonlyArray<SovStageSplit>): PayApplicationLine[] {
  if (splits.filter((s) => cents(s.value) > 0).length < 2) return []
  return splits.map((s) => ({ id: `stage-${s.stage}`, label: s.label, scheduledValue: cents(s.value), labor: cents(s.labor), stage: s.stage, ...blankAmounts }))
}

/** How the lines stand against the contract to date: `gap` is the contract less the lines (positive = the lines are short). */
export function scheduleGap(lines: ReadonlyArray<Pick<PayApplicationLine, 'scheduledValue'>>, contractSumToDate: number): { total: number; gap: number } {
  const total = cents(lines.reduce((t, l) => t + l.scheduledValue, 0))
  return { total, gap: cents(contractSumToDate - total) }
}

/**
 * Every line's scheduled value scaled by the same factor so they add to the amount to the cent
 * (the bid tab's rule); a line's labor scales with it. Work already claimed is left as it is.
 * null when the lines are all zero or the amount is not positive.
 */
export function scaleLinesToAmount(lines: ReadonlyArray<PayApplicationLine>, amount: number): PayApplicationLine[] | null {
  const scaled = scaleLinesToContract(
    lines.map((l) => ({ value: l.scheduledValue, labor: l.labor })),
    amount,
  )
  if (!scaled) return null
  return lines.map((l, i) => ({ ...l, scheduledValue: scaled[i]!.value, labor: scaled[i]!.labor }))
}

type JobStageLine = { name: string | null; count: number | null; line_unit_price: number | null; progress_pct: number | null }

/** A job line's stage word as one of the bid's three stages: ground and rough → Rough In, top out → Top Out, trim and final → Trim Set. */
export function bidStageOfJobLine(name: string | null | undefined): PayApplicationLineStage | null {
  const rank = stageRank(name)
  if (rank == null) return null
  return rank <= 1 ? 'rough_in' : rank === 2 ? 'top_out' : 'trim_set'
}

/**
 * What the crew has reported per stage, from the job's own stage lines: the percent of each line
 * that names a stage, weighted by the line's price when a stage has several. A stage no line
 * names, or whose lines carry no report, has no entry.
 */
export function crewPercentByStage(fixtures: ReadonlyArray<JobStageLine>): Partial<Record<PayApplicationLineStage, number>> {
  const sums = new Map<PayApplicationLineStage, { weight: number; done: number }>()
  for (const f of fixtures) {
    const stage = bidStageOfJobLine(f.name)
    if (!stage || f.progress_pct == null) continue
    // An unpriced stage line still counts: weigh it as 1 so a lone report is not lost.
    const weight = (Number(f.count) || 0) * (Number(f.line_unit_price) || 0) || 1
    const s = sums.get(stage) ?? { weight: 0, done: 0 }
    s.weight += weight
    s.done += weight * Math.min(100, Math.max(0, Number(f.progress_pct)))
    sums.set(stage, s)
  }
  const out: Partial<Record<PayApplicationLineStage, number>> = {}
  for (const [stage, s] of sums) out[stage] = Math.round(s.done / s.weight)
  return out
}

/** The crew's percent to offer on a line: its stage's, when that is ahead of what the line claims. null = nothing to offer. */
export function crewOfferForLine(
  line: Pick<PayApplicationLine, 'stage' | 'scheduledValue' | 'fromPrevious' | 'thisPeriod'>,
  crew: Partial<Record<PayApplicationLineStage, number>>,
): number | null {
  if (!line.stage) return null
  const reported = crew[line.stage]
  const done = linePercentDone(line)
  if (reported == null || done == null) return null
  return reported > done ? reported : null
}

export const BID_STAGE_NAMES: Record<PayApplicationLineStage, string> = { rough_in: 'Rough In', top_out: 'Top Out', trim_set: 'Trim Set' }
