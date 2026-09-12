import { useAuth } from '../../hooks/useAuth'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { TeamLaborRow } from '../../utils/teamLabor'
import { showJobCostBreakdownTeamLabor } from '../../lib/jobDetailModalRole'
import { JobCostsTabCharts } from './JobCostsTabCharts'

type JobFormLaborCostPanelProps = {
  editing: JobWithDetails | null
  editJobTeamLaborRow: TeamLaborRow | null
}

/**
 * The top of the Costs tab in the Edit-Job window: the verdict, the chart and
 * the folded detail (v2.3361). The Team / Sub Labor summary lines that used to
 * sit here moved into the "Where the money went" table in
 * `JobFormPartsCostSection`, beside the parts they are compared with.
 */
export function JobFormLaborCostPanel({ editing, editJobTeamLaborRow }: JobFormLaborCostPanelProps) {
  const { role: authRole } = useAuth()
  if (!editing?.id) return null
  return <JobCostsTabCharts job={editing} includeTeamLabor={showJobCostBreakdownTeamLabor(authRole)} teamPeople={editJobTeamLaborRow ? editJobTeamLaborRow.people.length : null} />
}
