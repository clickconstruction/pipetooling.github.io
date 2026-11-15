import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { stageProgressRowsFromRpc, type StageProgressRow } from '../lib/reports/stageProgressReport'

/**
 * The job's stages with how far each stands (punch list #355, Today's work): the read the report form makes
 * (`list_job_stage_progress`, SECURITY DEFINER, since field roles cannot read line items), kept as plain rows for a
 * screen that only shows them. `rev` reads again after a report lands. A refused or missing RPC, or any error, reads
 * as no rows, and the screen draws no stage: the card is an addition, never a gate on the window.
 */

type UntypedRpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>

export function useJobStageRows(jobId: string | null | undefined, enabled: boolean, rev = 0): StageProgressRow[] | null {
  const [loaded, setLoaded] = useState<{ jobId: string; rows: StageProgressRow[] } | null>(null)
  useEffect(() => {
    if (!enabled || !jobId) return
    let live = true
    // Cast the client, not `rpc.bind`: a detached `supabase.rpc` loses `this`, and binding the typed overloads trips TS2589.
    const client = supabase as unknown as { rpc: UntypedRpc }
    client.rpc('list_job_stage_progress', { p_job_id: jobId }).then(
      ({ data, error }) => {
        if (!live) return
        setLoaded(error || !Array.isArray(data) ? null : { jobId, rows: stageProgressRowsFromRpc(data as Parameters<typeof stageProgressRowsFromRpc>[0]) })
      },
      () => live && setLoaded(null),
    )
    return () => {
      live = false
    }
  }, [jobId, enabled, rev])
  return enabled && loaded && loaded.jobId === jobId ? loaded.rows : null
}
