/**
 * The field roster for the Capacity view (v2.2828): every person row with its
 * kind and dates, so the kernel can count who was active on each weekday.
 * Null while loading or when the roster can't be read (RLS) — the kernel then
 * estimates capacity from who clocked in and says so.
 *
 * With a `window` (v2.3523) it also reads the recorded time off
 * (`user_time_off`) that touches those days and maps each row to the person
 * through `people.account_user_id`, so the kernel can take days off out of
 * the available hours. Unreadable time off reads as none, and says so.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CapacityPerson, CapacityTimeOff } from '../lib/jobs/jobSummaryCapacity'

type RosterRow = CapacityPerson & { account_user_id: string | null }

export function useFieldRoster(
  enabled: boolean,
  window?: { startYmd: string; endYmd: string } | null,
): { people: CapacityPerson[] | null; error: string | null; timeOff: CapacityTimeOff[]; timeOffError: string | null } {
  const [people, setPeople] = useState<CapacityPerson[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timeOff, setTimeOff] = useState<CapacityTimeOff[]>([])
  const [timeOffError, setTimeOffError] = useState<string | null>(null)
  const startYmd = window?.startYmd ?? null
  const endYmd = window?.endYmd ?? null
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const { data, error: e } = await supabase.from('people').select('id, kind, start_date, end_date, archived_at, account_user_id')
      if (cancelled) return
      if (e) {
        setError(e.message)
        setPeople(null)
        setTimeOff([])
        return
      }
      const rows = (data ?? []) as RosterRow[]
      setError(null)
      setPeople(rows.map(({ account_user_id: _u, ...p }) => p))
      if (!startYmd || !endYmd) {
        setTimeOff([])
        return
      }
      const personByUser = new Map<string, string>()
      for (const r of rows) if (r.account_user_id) personByUser.set(r.account_user_id, r.id)
      const { data: off, error: offErr } = await supabase
        .from('user_time_off')
        .select('user_id, start_date, end_date')
        .lte('start_date', endYmd)
        .gte('end_date', startYmd)
      if (cancelled) return
      if (offErr) {
        setTimeOffError(offErr.message)
        setTimeOff([])
        return
      }
      setTimeOffError(null)
      const mapped: CapacityTimeOff[] = []
      for (const r of (off ?? []) as Array<{ user_id: string; start_date: string; end_date: string }>) {
        const personId = personByUser.get(r.user_id)
        if (personId) mapped.push({ personId, startYmd: r.start_date, endYmd: r.end_date })
      }
      setTimeOff(mapped)
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, startYmd, endYmd])
  return { people, error, timeOff, timeOffError }
}
