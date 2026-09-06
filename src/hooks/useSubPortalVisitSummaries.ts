/**
 * Sub-portal visit summaries for a set of people (v2.2922): one RPC call for
 * the whole list — the pay run's Who's owed, the sheet story's Portal cell,
 * the globe's gear. Re-fetches when the id set changes or `reload()` is
 * called (the visits modal calls it on close so a look taken from the modal
 * shows up behind it). Absent rows (RPC not pushed yet, or no permission)
 * leave the map empty and the callers render nothing.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseVisitSummaryRow, type SubPortalVisitSummary } from '../lib/portal/subPortalVisits'

/** `null` = the RPC is not there (migration not pushed) or the viewer may not read it — callers show nothing, never zeros. */
export async function fetchSubPortalVisitSummaries(personIds: readonly string[]): Promise<Map<string, SubPortalVisitSummary> | null> {
  const ids = [...new Set(personIds.filter(Boolean))]
  const out = new Map<string, SubPortalVisitSummary>()
  if (ids.length === 0) return out
  const { data, error } = await supabase.rpc('sub_portal_visit_summary' as never, { p_person_ids: ids } as never)
  if (error) return null
  for (const raw of (data ?? []) as unknown[]) {
    const row = parseVisitSummaryRow(raw)
    if (row) out.set(row.personId, row)
  }
  return out
}

export function useSubPortalVisitSummaries(personIds: readonly string[], enabled = true): { byPerson: ReadonlyMap<string, SubPortalVisitSummary>; reload: () => void } {
  const key = useMemo(() => [...new Set(personIds.filter(Boolean))].sort().join(','), [personIds])
  const [byPerson, setByPerson] = useState<ReadonlyMap<string, SubPortalVisitSummary>>(new Map())
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled || !key) return
    let cancelled = false
    void fetchSubPortalVisitSummaries(key.split(',')).then((m) => {
      if (!cancelled && m) setByPerson(m)
    })
    return () => {
      cancelled = true
    }
  }, [key, enabled, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { byPerson, reload }
}
