import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { stagesLaborBreakdownByJobId, stagesManHoursByJobId, type StagesManHoursRow } from '../lib/jobs/stagesManHours'

/** The board waits this long after it shows before it asks for the hours, so the first paint goes first. */
export const STAGES_MAN_HOURS_DELAY_MS = 80

/**
 * The Pipeline's man-hours per job (the Stages map's step 15; cluster F): one read of `get_man_hours_by_job` per visit,
 * governed by RLS, so a role with no labor access gets no rows. It loads once while the board shows and someone is
 * signed in. A read that fails leaves no hours and lets the next showing of the board try again.
 */
export function useStagesManHours(active: boolean, userId: string | null | undefined) {
  const [rows, setRows] = useState<StagesManHoursRow[]>([])
  const [stagesManHoursLoading, setStagesManHoursLoading] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!active || !userId) return
    const t = setTimeout(() => {
      void (async () => {
        if (loadedRef.current) return
        loadedRef.current = true
        setStagesManHoursLoading(true)
        const { data, error } = await supabase.rpc('get_man_hours_by_job')
        setStagesManHoursLoading(false)
        if (error) {
          loadedRef.current = false // allow retry on the next showing of the board
          return
        }
        setRows((data ?? []) as StagesManHoursRow[])
      })()
    }, STAGES_MAN_HOURS_DELAY_MS)
    return () => clearTimeout(t)
  }, [active, userId])

  /** Total man-hours per job id, and per person (most hours first) for the hover (`lib/jobs/stagesManHours`, v2.3860). */
  const byJobId = useMemo(() => stagesManHoursByJobId(rows), [rows])
  const laborBreakdownByJobId = useMemo(() => stagesLaborBreakdownByJobId(rows), [rows])

  return { stagesManHoursByJobId: byJobId, stagesLaborBreakdownByJobId: laborBreakdownByJobId, stagesManHoursLoading }
}
