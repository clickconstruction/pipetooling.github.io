import { useJobBurnOverhead } from '../../hooks/useJobBurnOverhead'
import { useJobChargesTimelineInputs } from '../../hooks/useJobChargesTimelineInputs'
import type { JobWithDetails } from '../../types/jobWithDetails'
import JobChargesTimelineStandalone from './JobChargesTimelineStandalone'
import { firstEventYmdOf, JobCostsBurnSection } from './JobCostsBurnSection'

/**
 * The Costs tab's charts (v2.3189): the Burn section above the Cost Timeline,
 * both fed by ONE `useJobChargesTimelineInputs` load. Burn renders only for
 * the wage roles (`includeTeamLabor`) — without team labor the spend is not
 * the spend the bid estimated, so the projection would flatter every job.
 */
export function JobCostsTabCharts({ job, includeTeamLabor }: { job: JobWithDetails; includeTeamLabor: boolean }) {
  const inputsState = useJobChargesTimelineInputs(job, includeTeamLabor)
  // ONE overhead load (v2.3271): Burn's projection and the Cost Timeline's amber band read the same share.
  const overheadState = useJobBurnOverhead(includeTeamLabor && inputsState.kind === 'ready', job.id, firstEventYmdOf(inputsState))
  return (
    <>
      {includeTeamLabor ? <JobCostsBurnSection inputsState={inputsState} overheadState={overheadState} /> : null}
      <JobChargesTimelineStandalone job={job} includeTeamLabor={includeTeamLabor} inputsState={inputsState} overheadState={overheadState} />
    </>
  )
}
