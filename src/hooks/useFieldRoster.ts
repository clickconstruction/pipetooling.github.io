/**
 * The field roster for the Capacity view (v2.2828): every person row with its
 * kind and dates, so the kernel can count who was active on each weekday.
 * Null while loading or when the roster can't be read (RLS) — the kernel then
 * estimates capacity from who clocked in and says so.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CapacityPerson } from '../lib/jobs/jobSummaryCapacity'

export function useFieldRoster(enabled: boolean): { people: CapacityPerson[] | null; error: string | null } {
  const [people, setPeople] = useState<CapacityPerson[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const { data, error: e } = await supabase.from('people').select('id, kind, start_date, end_date, archived_at')
      if (cancelled) return
      if (e) {
        setError(e.message)
        setPeople(null)
        return
      }
      setError(null)
      setPeople((data ?? []) as CapacityPerson[])
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
  return { people, error }
}
