import type { JobChargesTimelineInputsState } from '../../hooks/useJobChargesTimelineInputs'
import type { JobBurnOverheadState } from '../../hooks/useJobBurnOverhead'
import { buildJobBurn, resolveJobBurnBudget, type JobBurnModel } from './jobBurn'
import { budgetForBurn, type ResolvedJobBudget } from './jobBudget'
import { chargeEventsAtBurden } from './burnAtBurden'
import { JOB_SUMMARY_VIEW_STORAGE_KEY, readJobSummaryViewPrefs } from './jobSummaryLedgerView'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * The Costs tab's burn build, moved out of `JobCostsBurnSection.tsx` (v2.5046) so Bids → Bid Costs →
 * Bid vs actual builds each linked job's verdict with the same two functions, and the two can
 * never disagree. Job Summary's Target chip is per device (localStorage), read the same way.
 */

/** Job Summary's Target chip on this device as a burn target; null when off or unreadable. */
export function readTargetMarginPct(): number | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(JOB_SUMMARY_VIEW_STORAGE_KEY) : null
    const t = readJobSummaryViewPrefs(raw).targetTrueMarginPct
    return t > 0 ? t : null
  } catch {
    return null
  }
}

/**
 * The burn model the Costs tab's verdict reads (v2.3361) — the same build the chart uses, earned off the price.
 * `laborBurden` is the company's burden factor (punch list #448): the burn's team labor is priced at it, as the
 * budget's is. Every caller hands it in, so no screen can draw a burn at raw wages by leaving it out.
 */
export function buildBurnForVerdict(inputs: NonNullable<Extract<JobChargesTimelineInputsState, { kind: 'ready' }>['inputs']>, overhead: JobBurnOverheadState['overhead'], jobBudget: ResolvedJobBudget | null | undefined, laborBurden: number): JobBurnModel {
  const budget = resolveJobBurnBudget({ priceUsd: inputs.revenue, bidEstimateUsd: jobBudget ? budgetForBurn(jobBudget) : null, targetMarginPct: readTargetMarginPct() })
  return buildJobBurn({ chargeEvents: chargeEventsAtBurden(inputs.chargeEvents, laborBurden), valueEvents: inputs.valueEvents, fallbackPercent: inputs.fallbackPercent, priceUsd: inputs.revenue, budget, overhead, todayYmd: todayYmdInAppTz(), earnedBasis: 'price' })
}
