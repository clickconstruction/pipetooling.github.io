/**
 * Earned value by stage (Burn against the bid, piece 2, v2.5046 — the owner's call of 2026-10-09):
 * how many of the bid's hours the work done so far has earned, stage by stage, held against the
 * hours the crew recorded.
 *
 *   earned hours = Σ over stages (that stage's progress % × the bid's hours for the stage)
 *
 * The bid's hours by stage come from its estimate (`bid_estimate_breakdown.labor_hours_by_stage`:
 * rough, top, trim). A stage's progress comes from the job's staged billing lines
 * (`list_job_stage_progress`: Order / Any lines with their crew progress), each line mapped to a
 * stage by its name ("Rough in" → rough, "Top out" → top, "Trim set" → trim). A stage with several
 * lines takes their value-weighted progress. A line that names no stage ("Plumbing per plans") is
 * named, never guessed into one. A stage nobody has reported reads unknown, never 0%. Pure.
 */

export type BidStage = 'rough' | 'top' | 'trim'
export const BID_STAGES: readonly BidStage[] = ['rough', 'top', 'trim']
export const BID_STAGE_LABELS: Record<BidStage, string> = { rough: 'Rough-in', top: 'Top-out', trim: 'Trim' }

/** The bid stage a staged billing line's name means; null when it names none. */
export function bidStageOfLine(name: string | null | undefined): BidStage | null {
  const n = (name ?? '').toLowerCase()
  const hits: BidStage[] = []
  if (/\brough/.test(n)) hits.push('rough')
  if (/\btop[\s-]*out\b|\btopout\b/.test(n)) hits.push('top')
  if (/\btrim\b|\bfinish\b/.test(n)) hits.push('trim')
  // "Rough and top out" is two stages on one line: it can stand for neither alone.
  return hits.length === 1 ? hits[0]! : null
}

export type StageLine = { name: string; weightPct: number; progressPct: number | null }

export type StageEarnedRow = {
  stage: BidStage
  bidHours: number
  /** Value-weighted progress of the stage's lines, 0–100; null when no line of it carries a report. */
  progressPct: number | null
  /** progress × bid hours; null with no progress. */
  earnedHours: number | null
  lines: string[]
}

export type StageEarnedValueRead = 'no-stage-hours' | 'no-stage-lines' | 'no-progress' | 'partial' | 'complete'

export type StageEarnedValue = {
  stages: StageEarnedRow[]
  /** Staged billing lines whose name means no stage. */
  unmapped: string[]
  bidHours: number
  /** Σ earned over the stages with progress; null when no stage has any. */
  earnedHours: number | null
  recordedHours: number
  read: StageEarnedValueRead
  words: string
}

const round1 = (n: number): number => Math.round(n * 10) / 10
const h0 = (n: number): string => `${Math.round(n).toLocaleString('en-US')} h`

export function stageEarnedValue(args: {
  bidHoursByStage: Partial<Record<BidStage, number | string | null>> | null | undefined
  lines: ReadonlyArray<StageLine>
  recordedHours: number
}): StageEarnedValue {
  const hoursOf = (s: BidStage): number => {
    const v = Number(args.bidHoursByStage?.[s] ?? 0)
    return Number.isFinite(v) && v > 0 ? v : 0
  }
  const byStage = new Map<BidStage, StageLine[]>()
  const unmapped: string[] = []
  for (const l of args.lines) {
    const stage = bidStageOfLine(l.name)
    if (!stage) {
      unmapped.push(l.name)
      continue
    }
    byStage.set(stage, [...(byStage.get(stage) ?? []), l])
  }
  const stages: StageEarnedRow[] = BID_STAGES.map((stage) => {
    const lines = byStage.get(stage) ?? []
    const reported = lines.some((l) => l.progressPct != null)
    const weight = lines.reduce((s, l) => s + Math.max(0, Number(l.weightPct) || 0), 0)
    // A line of a reported stage that carries no % has not started: it weighs in at 0.
    const progressPct = reported
      ? weight > 0
        ? lines.reduce((s, l) => s + Math.max(0, Number(l.weightPct) || 0) * Math.min(100, Math.max(0, l.progressPct ?? 0)), 0) / weight
        : lines.reduce((s, l) => s + Math.min(100, Math.max(0, l.progressPct ?? 0)), 0) / lines.length
      : null
    const bidHours = hoursOf(stage)
    return { stage, bidHours, progressPct: progressPct == null ? null : round1(progressPct), earnedHours: progressPct == null ? null : round1((progressPct / 100) * bidHours), lines: lines.map((l) => l.name) }
  })
  const bidHours = stages.reduce((s, r) => s + r.bidHours, 0)
  const withProgress = stages.filter((r) => r.progressPct != null && r.bidHours > 0)
  const earnedHours = withProgress.length > 0 ? round1(withProgress.reduce((s, r) => s + (r.earnedHours ?? 0), 0)) : null
  const recordedHours = Math.max(0, Number(args.recordedHours) || 0)
  const pricedStages = stages.filter((r) => r.bidHours > 0)

  let read: StageEarnedValueRead
  let words: string
  if (bidHours <= 0) {
    read = 'no-stage-hours'
    words = 'the bid carries no hours by stage'
  } else if (pricedStages.every((r) => r.lines.length === 0)) {
    read = 'no-stage-lines'
    words = args.lines.length > 0 ? 'no billing line names a stage' : 'the job has no staged billing lines'
  } else if (earnedHours == null) {
    read = 'no-progress'
    words = 'no stage progress reported'
  } else {
    read = withProgress.length === pricedStages.length ? 'complete' : 'partial'
    words = `${h0(earnedHours)} earned of ${h0(bidHours)} bid · ${h0(recordedHours)} recorded`
  }
  return { stages, unmapped, bidHours: round1(bidHours), earnedHours, recordedHours, read, words }
}

/** Recorded ÷ earned hours, as the crew's pace against the bid: "1.25× the hours earned" / null without earned hours. */
export function stageEarnedPaceWords(ev: Pick<StageEarnedValue, 'earnedHours' | 'recordedHours'>): string | null {
  if (ev.earnedHours == null || ev.earnedHours <= 0) return null
  const x = ev.recordedHours / ev.earnedHours
  return `${(Math.round(x * 100) / 100).toFixed(2)}× the hours earned`
}
