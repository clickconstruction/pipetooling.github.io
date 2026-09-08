import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobAccountShareRow } from '../lib/supplyHouseJobAccountsLedger'

/**
 * A job's supply-house job-account share records (v2.1605 packet sends), for
 * the job-window header icon: teal + "on file" tooltip once any exist. Null
 * while loading or disabled; [] when the job was never shared. `refreshKey`
 * re-reads after the share modal closes (a send may have been logged).
 */
export function useJobAccountShares(jobId: string | null, enabled: boolean, refreshKey = 0): { shares: JobAccountShareRow[] | null } {
  const [shares, setShares] = useState<JobAccountShareRow[] | null>(null)
  useEffect(() => {
    if (!enabled || !jobId) {
      setShares(null)
      return
    }
    let cancelled = false
    void supabase
      .from('supply_house_job_accounts')
      .select('job_id, contact_label, contact_email, sent_by_name, sent_at, send_method')
      .eq('job_id', jobId)
      .order('sent_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return
        setShares(error ? [] : ((data ?? []) as JobAccountShareRow[]))
      })
    return () => {
      cancelled = true
    }
  }, [jobId, enabled, refreshKey])
  return { shares }
}
