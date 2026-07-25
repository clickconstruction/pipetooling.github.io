import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * jobs_ledger.customer_phone for a set of job ids (v2.1006 — improvement-plan
 * item #7). Same fetch My Schedule uses (`useDashboardSubSchedule`), shared so
 * the Ready to Bill / Assigned Jobs / Superintendent Jobs cards can show the
 * call button + CallCustomerModal. RLS already lets each viewer read the jobs
 * they can see; ids they can't read simply return no row.
 */
export function useJobCustomerPhones(jobIds: readonly string[]): {
  phones: Map<string, string>
  /** True once the fetch for the current id set has settled — gate "no phone"
   * affordances on this so cards never flash the missing state while loading. */
  loaded: boolean
} {
  const [phones, setPhones] = useState<Map<string, string>>(() => new Map())
  const [loaded, setLoaded] = useState(false)
  const key = [...jobIds].sort().join(',')
  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (ids.length === 0) {
      setPhones(new Map())
      setLoaded(true)
      return
    }
    let cancelled = false
    setLoaded(false)
    void (async () => {
      try {
        const { data } = await supabase.from('jobs_ledger').select('id, customer_phone').in('id', ids)
        if (cancelled) return
        const m = new Map<string, string>()
        for (const r of (data ?? []) as Array<{ id: string; customer_phone: string | null }>) {
          const p = (r.customer_phone ?? '').trim()
          if (p) m.set(r.id, p)
        }
        setPhones(m)
        setLoaded(true)
      } catch {
        if (!cancelled) {
          setPhones(new Map())
          setLoaded(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key])
  return { phones, loaded }
}
