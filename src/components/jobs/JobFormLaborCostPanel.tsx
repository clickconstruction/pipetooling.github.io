import { useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { TeamLaborRow } from '../../utils/teamLabor'
import { showJobCostBreakdownTeamLabor } from '../../lib/jobDetailModalRole'
import { ymdFromDateOnlyOrIso } from '../../lib/jobChargesTimeline'
import { liveOtherCharges, type JobCostsLiveValues } from '../../lib/jobs/jobCostsLiveInputs'
import type { MaterialRow } from '../../lib/jobs/jobFormTypes'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { JobCostsTabCharts } from './JobCostsTabCharts'

type JobFormLaborCostPanelProps = {
  editing: JobWithDetails | null
  editJobTeamLaborRow: TeamLaborRow | null
  /** The form's Job Total with riders — what the Bill tab shows and autosave writes as revenue. */
  livePriceUsd: number
  /** The form's other job charges, as typed. */
  liveMaterials: MaterialRow[]
}

/**
 * The top of the Costs tab in the Edit-Job window: the verdict, the chart and
 * the folded detail (v2.3361). The Team / Sub Labor summary lines that used to
 * sit here moved into the "Where the money went" table in
 * `JobFormPartsCostSection`, beside the parts they are compared with.
 *
 * The tab reads the job as it was loaded; the price and the other job charges
 * come from the form instead, so a change on the Bill tab shows here at once.
 */
export function JobFormLaborCostPanel({ editing, editJobTeamLaborRow, livePriceUsd, liveMaterials }: JobFormLaborCostPanelProps) {
  const { role: authRole } = useAuth()
  const loadedMaterials = editing?.materials
  const live = useMemo<JobCostsLiveValues>(
    () => ({
      priceUsd: livePriceUsd,
      otherCharges: liveOtherCharges(
        liveMaterials,
        (loadedMaterials ?? []).map((m) => ({ id: m.id, dateKey: ymdFromDateOnlyOrIso(m.created_at, calendarYmdInAppTzFromIso) })),
        todayYmdInAppTz(),
      ),
    }),
    [livePriceUsd, liveMaterials, loadedMaterials],
  )
  if (!editing?.id) return null
  return <JobCostsTabCharts job={editing} includeTeamLabor={showJobCostBreakdownTeamLabor(authRole)} teamPeople={editJobTeamLaborRow ? editJobTeamLaborRow.people.length : null} live={live} />
}
