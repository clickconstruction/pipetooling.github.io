import { useJobChargesTimelineInputs } from '../../hooks/useJobChargesTimelineInputs'
import type { JobWithDetails } from '../../types/jobWithDetails'
import JobChargesTimelineStandalone from './JobChargesTimelineStandalone'
import { JobCostsBurnSection } from './JobCostsBurnSection'

/**
 * The Costs tab's charts (v2.3189): the Burn section above the Cost Timeline,
 * both fed by ONE `useJobChargesTimelineInputs` load. Burn renders only for
 * the wage roles (`includeTeamLabor`) — without team labor the spend is not
 * the spend the bid estimated, so the projection would flatter every job.
 */
export function JobCostsTabCharts({ job, includeTeamLabor }: { job: JobWithDetails; includeTeamLabor: boolean }) {
  const inputsState = useJobChargesTimelineInputs(job, includeTeamLabor)
  return (
    <>
      {includeTeamLabor ? <JobCostsBurnSection job={job} inputsState={inputsState} /> : null}
      <JobChargesTimelineStandalone job={job} includeTeamLabor={includeTeamLabor} inputsState={inputsState} />
    </>
  )
}
