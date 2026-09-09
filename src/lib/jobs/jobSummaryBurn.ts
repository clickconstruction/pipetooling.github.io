import { resolveJobBurnBudget, type JobBurnBudget } from './jobBurn'

/**
 * Burn for a Job Summary row and the Pipeline card (v2.3191, mock-up part B).
 *
 * The Costs tab's `buildJobBurn` works from dated events; Job Summary already
 * holds each job's aggregates (labor + subs + parts, the report %, field days
 * and the overhead day-share over the window), so this is the same arithmetic
 * over those aggregates, one row at a time:
 *
 *   spent ÷ % done = cost at completion · price − that = projected margin
 *   overhead so far + (overhead per field day × field days left) → true margin
 *
 * Same rules as the Costs tab: `hot` when spend leads progress by > 5 points,
 * `early` under 3 field days or 10 %, no budget without a price. A finished
 * job is `done` — its projection is just what happened (gross / true profit).
 * Pure.
 */

export type JobSummaryBurnStatus = 'no_budget' | 'early' | 'ok' | 'hot' | 'done'

export type JobSummaryBurn = {
  status: JobSummaryBurnStatus
  budget: JobBurnBudget | null
  /** contract − budget: the margin the budget rule expects. */
  targetMarginUsd: number | null
  spentUsd: number
  spentPct: number | null
  leadPts: number | null
  eacUsd: number | null
  projectedMarginUsd: number | null
  projectedMarginPct: number | null
  /** Overhead so far + projected remaining; null when the ledger has not loaded. */
  projectedOverheadUsd: number | null
  projectedTrueMarginUsd: number | null
  projectedTrueMarginPct: number | null
}

const HOT_LEAD_PTS = 5

export function projectJobSummaryBurn(args: {
  contractUsd: number
  spentUsd: number
  pct: number | null
  finished: boolean
  /** Field days worked so far; null when unknown (no ledger) — the 3-day rule is then skipped. */
  fieldDays: number | null
  /** Overhead share to date; null until the ledger loads. */
  overheadUsd: number | null
  /** Job Summary's Target chip (0 = off → the kernel default). */
  targetMarginPct: number
}): JobSummaryBurn {
  const budget = resolveJobBurnBudget({ priceUsd: args.contractUsd, bidEstimateUsd: null, targetMarginPct: args.targetMarginPct > 0 ? args.targetMarginPct : null })
  const spent = args.spentUsd
  const base: JobSummaryBurn = {
    status: 'no_budget',
    budget,
    targetMarginUsd: budget ? args.contractUsd - budget.usd : null,
    spentUsd: spent,
    spentPct: null,
    leadPts: null,
    eacUsd: null,
    projectedMarginUsd: null,
    projectedMarginPct: null,
    projectedOverheadUsd: null,
    projectedTrueMarginUsd: null,
    projectedTrueMarginPct: null,
  }
  if (!budget) return base
  const spentPct = (spent / budget.usd) * 100
  const pct = args.pct
  const leadPts = pct != null ? spentPct - pct : null

  if (args.finished) {
    const eac = spent
    const margin = args.contractUsd - eac
    const oh = args.overheadUsd
    return {
      ...base,
      status: 'done',
      spentPct,
      leadPts,
      eacUsd: eac,
      projectedMarginUsd: margin,
      projectedMarginPct: (margin / args.contractUsd) * 100,
      projectedOverheadUsd: oh,
      projectedTrueMarginUsd: oh == null ? null : margin - oh,
      projectedTrueMarginPct: oh == null ? null : ((margin - oh) / args.contractUsd) * 100,
    }
  }

  const tooEarly = pct == null || pct < 10 || (args.fieldDays != null && args.fieldDays < 3)
  if (tooEarly) return { ...base, status: 'early', spentPct, leadPts }

  const eac = spent / (pct / 100)
  const margin = args.contractUsd - eac
  let projectedOverhead: number | null = null
  if (args.overheadUsd != null && args.fieldDays != null && args.fieldDays > 0) {
    const perDay = args.overheadUsd / args.fieldDays
    const progressPerDay = pct / args.fieldDays
    const daysLeft = progressPerDay > 0 ? (100 - pct) / progressPerDay : 0
    projectedOverhead = args.overheadUsd + perDay * daysLeft
  }
  const trueMargin = projectedOverhead == null ? null : margin - projectedOverhead
  return {
    ...base,
    status: leadPts != null && leadPts > HOT_LEAD_PTS ? 'hot' : 'ok',
    spentPct,
    leadPts,
    eacUsd: eac,
    projectedMarginUsd: margin,
    projectedMarginPct: (margin / args.contractUsd) * 100,
    projectedOverheadUsd: projectedOverhead,
    projectedTrueMarginUsd: trueMargin,
    projectedTrueMarginPct: trueMargin == null ? null : (trueMargin / args.contractUsd) * 100,
  }
}

/** The figure a row sorts and the card sums on: true margin when the ledger is in, direct margin until then. */
export function burnProjectedMarginForSort(b: JobSummaryBurn | null | undefined): number | null {
  if (!b) return null
  return b.projectedTrueMarginUsd ?? b.projectedMarginUsd
}

export type PipelineBurnAlertJob = {
  jobId: string
  label: string
  spentPct: number
  pct: number
  projectedMarginUsd: number
  /** Shortfall against the margin the budget rule expected (≥ 0). */
  atRiskUsd: number
}

export type PipelineBurnAlert = {
  count: number
  marginAtRiskUsd: number
  /** Worst three by shortfall. */
  worst: PipelineBurnAlertJob[]
}

/**
 * The Pipeline card: every unfinished job whose spend leads its progress by
 * more than 5 points, with the margin shortfall against the target summed.
 * Null when nothing is hot (the card hides).
 */
export function buildPipelineBurnAlert(rows: ReadonlyArray<{ jobId: string; label: string; burn: JobSummaryBurn | null }>): PipelineBurnAlert | null {
  const hot: PipelineBurnAlertJob[] = []
  for (const r of rows) {
    const b = r.burn
    if (!b || b.status !== 'hot' || b.spentPct == null || b.projectedMarginUsd == null || b.targetMarginUsd == null) continue
    hot.push({
      jobId: r.jobId,
      label: r.label,
      spentPct: b.spentPct,
      pct: Math.max(0, b.spentPct - (b.leadPts ?? 0)),
      projectedMarginUsd: b.projectedMarginUsd,
      atRiskUsd: Math.max(0, b.targetMarginUsd - b.projectedMarginUsd),
    })
  }
  if (hot.length === 0) return null
  hot.sort((a, b) => b.atRiskUsd - a.atRiskUsd)
  return { count: hot.length, marginAtRiskUsd: hot.reduce((s, h) => s + h.atRiskUsd, 0), worst: hot.slice(0, 3) }
}
