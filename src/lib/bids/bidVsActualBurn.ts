/**
 * Each linked job's dollar burn on Bids → Bid Costs → Bid vs actual (Burn against the bid, piece 2,
 * v2.5046 — the owner's call of 2026-10-09). Built with the job's own Costs tab calls, in its
 * order — the loader (`loadJobChargesTimelineInputs`), the budget (`resolveJobBudget`), the burn
 * (`buildBurnForVerdict`) and the verdict (`buildCostsVerdict`) — so the lens's direct margin at
 * completion and its sections can never disagree with the Costs tab. Direct margin only: the lens
 * loads no overhead day ledger (the Pipeline card made the same call), and the direct margin does
 * not depend on it.
 */
import type { JobChargesTimelineInputs } from '../../hooks/useJobChargesTimelineInputs'
import { buildBurnForVerdict, readTargetMarginPct } from '../jobs/jobBurnForVerdict'
import { resolveJobBudget, spendByComponent, type JobBudgetRowLike } from '../jobs/jobBudget'
import { buildCostsVerdict, type CostsVerdict } from '../jobs/jobCostsVerdict'
import { newestPercentEvent } from '../jobChargesTimeline'

/** A billed or paid job is finished, as the Costs tab reads it. */
export const isFinishedJobStatus = (status: string | null | undefined): boolean => status === 'billed' || status === 'paid'

/** One linked job's Costs verdict, overhead left out. */
export function bidVsActualJobVerdict(args: {
  inputs: JobChargesTimelineInputs
  /** The job's `job_budgets` row, whole; null when it has none. */
  budgetRow: JobBudgetRowLike | null
  status: string | null
  /** The bid's number, for the sections' "◆ B66" words. */
  bidNumber: string | null
  todayYmd: string
}): CostsVerdict {
  const { inputs } = args
  const finished = isFinishedJobStatus(args.status)
  const priceUsd = inputs.revenue
  const resolved = resolveJobBudget({ row: args.budgetRow, priceUsd, targetMarginPct: readTargetMarginPct() })
  // A billed or paid job with no % anywhere is done — as on the Costs tab.
  const burnInputs = inputs.fallbackPercent == null && finished ? { ...inputs, fallbackPercent: 100 } : inputs
  const burn = buildBurnForVerdict(burnInputs, null, resolved)
  const newest = newestPercentEvent(inputs.valueEvents)
  const latestReportYmd = newest && newest.kind !== 'manual' ? newest.dateKey : null
  return buildCostsVerdict({
    burn,
    priceUsd,
    spend: spendByComponent(inputs.chargeEvents),
    teamHours: inputs.teamHours,
    teamPeople: null,
    resolved,
    bidLabel: args.bidNumber,
    latestReportYmd,
    jobPct: inputs.fallbackPercent,
    jobFinished: finished,
    todayYmd: args.todayYmd,
  })
}

const usd0 = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`

/** The Direct column's two lines: "14%" over "$17,550 at completion", or why there is no figure yet. */
export function bidVsActualDirectWords(v: Pick<CostsVerdict, 'directMargin' | 'priceUsd' | 'eacUsd' | 'timeLeft' | 'pctDone'>): { big: string; sub: string } {
  if (v.priceUsd == null || !(v.priceUsd > 0)) return { big: '—', sub: 'no price on the job' }
  if (v.directMargin && v.directMargin.pct != null) return { big: `${Math.round(v.directMargin.pct)}%`, sub: `${usd0(v.directMargin.usd)} at completion` }
  if (v.pctDone == null) return { big: '—', sub: 'needs a % complete' }
  return { big: 'too early', sub: `${v.timeLeft.fieldDays} field ${v.timeLeft.fieldDays === 1 ? 'day' : 'days'} · ${Math.round(v.pctDone)}% done` }
}
