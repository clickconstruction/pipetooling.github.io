import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mySubSheetsFromRpc, type MySubSheets } from '../lib/jobs/subPayRow'

/**
 * A subcontractor's own sheets on a job, for the job window's Your pay row (punch list #355, v2.7399):
 * `my_sub_sheets_on_job`, a definer read of the rows their portal reads. Null until the read answers, and null for
 * good when it cannot be read (a refusal, a client ahead of its push): the row is then not drawn. It never says
 * *no sheet* on a read that failed.
 */

type UntypedRpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>

export function useMySubPay(jobId: string | null | undefined, enabled: boolean): MySubSheets | null {
  const [read, setRead] = useState<{ jobId: string; sheets: MySubSheets | null } | null>(null)
  useEffect(() => {
    if (!enabled || !jobId) return
    let live = true
    // Cast the client, not `rpc.bind`: a detached `supabase.rpc` loses `this`, and binding the typed overloads trips TS2589.
    const client = supabase as unknown as { rpc: UntypedRpc }
    const none = () => live && setRead({ jobId, sheets: null })
    try {
      client.rpc('my_sub_sheets_on_job', { p_job_id: jobId }).then(({ data, error }) => {
        if (live) setRead({ jobId, sheets: error ? null : mySubSheetsFromRpc(data, window.location.origin) })
      }, none)
    } catch {
      none()
    }
    return () => {
      live = false
    }
  }, [jobId, enabled])
  return enabled && read && read.jobId === jobId ? read.sheets : null
}
