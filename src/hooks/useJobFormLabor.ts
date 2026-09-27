import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { loadTeamLaborData, type TeamLaborRow } from '../utils/teamLabor'
import { subLaborSummary, type SubLaborSummary } from '../lib/jobs/subLaborSummary'
import { useJobDetailSubLaborCost } from './useJobDetailSubLaborCost'

export type JobFormLabor = {
  editJobTeamLaborLoading: boolean
  editJobTeamLaborRow: TeamLaborRow | null
  editJobTeamLaborError: boolean
  editJobSubLaborLoading: boolean
  editJobSubLaborData: SubLaborSummary | null
  editJobSubLaborError: boolean
}

/**
 * The job form's labor for its cost block and delete gate (v2.3871, the Job form map's order #1):
 * the team-labor row for the job, and the sub-labor sheets on it as a count and a total. Out of
 * `JobFormModal`'s 116-line inline effect: the team half is the same read (`loadTeamLaborData`,
 * then the job's row); the sub half now rides the tested `useJobDetailSubLaborCost` and the shared
 * `laborJobSubCost` kernel instead of a hand copy of the drive-cost formula. Keyed on the job id
 * alone — the sheets are read by their job link since v2.3060, so a change to the job's number
 * no longer re-runs it. Null / false with no job.
 */
export function useJobFormLabor(jobId: string | null): JobFormLabor {
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamRow, setTeamRow] = useState<TeamLaborRow | null>(null)
  const [teamError, setTeamError] = useState(false)

  useEffect(() => {
    if (!jobId) {
      setTeamLoading(false)
      setTeamRow(null)
      setTeamError(false)
      return
    }
    let cancelled = false
    setTeamLoading(true)
    setTeamError(false)
    setTeamRow(null)
    void (async () => {
      try {
        const teamRows = await withSupabaseRetry(async () => ({ data: await loadTeamLaborData(supabase), error: null }), 'loadTeamLaborData edit job')
        if (!cancelled) setTeamRow(teamRows.find((r) => r.jobId === jobId) ?? null)
      } catch {
        if (!cancelled) {
          setTeamRow(null)
          setTeamError(true)
        }
      } finally {
        if (!cancelled) setTeamLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])

  const sub = useJobDetailSubLaborCost(Boolean(jobId), jobId)
  const subSummary = useMemo(() => subLaborSummary(sub.data), [sub.data])

  return {
    editJobTeamLaborLoading: teamLoading,
    editJobTeamLaborRow: teamRow,
    editJobTeamLaborError: teamError,
    editJobSubLaborLoading: sub.loading,
    editJobSubLaborData: subSummary,
    editJobSubLaborError: sub.failed,
  }
}
