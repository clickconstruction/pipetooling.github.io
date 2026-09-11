import { useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useBidCrewRate } from '../../hooks/useBidCrewRate'
import { useJobBudget } from '../../hooks/useJobBudget'
import { useJobBurnOverhead } from '../../hooks/useJobBurnOverhead'
import { useJobChargesTimelineInputs } from '../../hooks/useJobChargesTimelineInputs'
import { resolveJobBudget } from '../../lib/jobs/jobBudget'
import { JOB_SUMMARY_VIEW_STORAGE_KEY, readJobSummaryViewPrefs } from '../../lib/jobs/jobSummaryLedgerView'
import { resolveJobCurrentPercentFallback } from '../../lib/jobSummaryPercentComplete'
import type { JobWithDetails } from '../../types/jobWithDetails'
import JobChargesTimelineStandalone from './JobChargesTimelineStandalone'
import { JobBudgetCard } from './JobBudgetCard'
import { firstEventYmdOf, JobCostsBurnSection } from './JobCostsBurnSection'

/**
 * The Costs tab's charts (v2.3189): the Budget card (v2.3299) above the Burn
 * section above the Cost Timeline, all fed by ONE `useJobChargesTimelineInputs`
 * load. Burn and the Budget card render only for the wage roles
 * (`includeTeamLabor`) — without team labor the spend is not the spend the bid
 * estimated, so the projection would flatter every job.
 */
function readTargetMarginPct(): number | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(JOB_SUMMARY_VIEW_STORAGE_KEY) : null
    const t = readJobSummaryViewPrefs(raw).targetTrueMarginPct
    return t > 0 ? t : null
  } catch {
    return null
  }
}

export function JobCostsTabCharts({ job, includeTeamLabor }: { job: JobWithDetails; includeTeamLabor: boolean }) {
  const { user, role } = useAuth()
  const inputsState = useJobChargesTimelineInputs(job, includeTeamLabor)
  // ONE overhead load (v2.3271): Burn's projection and the Cost Timeline's amber band read the same share.
  const overheadState = useJobBurnOverhead(includeTeamLabor && inputsState.kind === 'ready', job.id, firstEventYmdOf(inputsState))
  const budget = useJobBudget(job.id, job.bid_id ?? null, includeTeamLabor)
  const { crewRate } = useBidCrewRate(includeTeamLabor)
  const inputs = inputsState.kind === 'ready' ? inputsState.inputs : null
  const priceUsd = inputs?.revenue ?? (job.revenue != null ? Number(job.revenue) : null)
  const resolved = useMemo(() => resolveJobBudget({ row: budget.row, priceUsd, targetMarginPct: readTargetMarginPct() }), [budget.row, priceUsd])
  const canWrite = role === 'dev' || role === 'assistant' || role === 'controller' || role === 'master_technician'
  const pctDone = useMemo(() => {
    const reported = inputs?.valueEvents.filter((v) => v.percent != null).slice(-1)[0]?.percent ?? null
    return reported ?? inputs?.fallbackPercent ?? resolveJobCurrentPercentFallback(job)
  }, [inputs, job])
  return (
    <>
      {includeTeamLabor ? (
        <JobBudgetCard
          jobId={job.id}
          jobLabel={job.job_name ?? ''}
          priceUsd={priceUsd}
          pctDone={pctDone}
          inputs={inputs}
          budget={budget}
          resolved={resolved}
          companyRate={crewRate?.companyRate ?? null}
          canWrite={canWrite}
          currentUserId={user?.id ?? null}
          linkedBid={job.linkedBid ? { id: job.linkedBid.id, bid_number: job.linkedBid.bid_number, project_name: job.linkedBid.project_name } : null}
        />
      ) : null}
      {includeTeamLabor ? <JobCostsBurnSection inputsState={inputsState} overheadState={overheadState} jobBudget={resolved} /> : null}
      <JobChargesTimelineStandalone job={job} includeTeamLabor={includeTeamLabor} inputsState={inputsState} overheadState={overheadState} />
    </>
  )
}
