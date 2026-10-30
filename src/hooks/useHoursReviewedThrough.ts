import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/**
 * Each shown person's newest `hours_reviewed.end_date` (punch list #217, people-docs-6): the
 * Hours tab's Review Hours press drew a green ✓ whether or not a review existed. One read per
 * roster, null for a person with no review on record; `reviewHoursButtonWords` turns the list
 * into the press's words. Null until the read lands, so the press keeps its plain words.
 */
export function useHoursReviewedThrough(peopleNames: ReadonlyArray<string>, reloadKey = 0): ReadonlyArray<string | null> | null {
  const key = useMemo(() => peopleNames.map((n) => n.trim()).filter(Boolean).join('\u0001'), [peopleNames])
  const [byName, setByName] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    const names = key ? key.split('\u0001') : []
    if (names.length === 0) {
      setByName({})
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () => supabase.from('hours_reviewed').select('person_name, end_date').in('person_name', names).order('end_date', { ascending: false }).limit(5000),
          'load hours reviewed through',
        )
        if (cancelled) return
        const out: Record<string, string> = {}
        for (const r of (rows ?? []) as Array<{ person_name: string; end_date: string }>) {
          const name = (r.person_name ?? '').trim()
          if (!name || !r.end_date) continue
          if (!(name in out) || out[name]! < r.end_date) out[name] = r.end_date
        }
        setByName(out)
      } catch {
        if (!cancelled) setByName(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, reloadKey])
  return useMemo(() => {
    if (byName == null) return null
    return (key ? key.split('\u0001') : []).map((n) => byName[n] ?? null)
  }, [byName, key])
}
