import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'

const cache = new Map<string, string>()

/**
 * Display names for a set of user ids (name, else email), one chunked read
 * per new id set, remembered for the session. Used by the bid flow strip to
 * caption the Review step ("by Wendi · Tue 9/9") without another join on the
 * board's bids query.
 */
export function useUserDisplayNames(ids: ReadonlyArray<string | null | undefined>): Record<string, string> {
  const idsKey = useMemo(() => [...new Set(ids.filter((x): x is string => !!x))].sort().join(','), [ids])
  // Bumped when a fetch fills the cache so the memo below re-reads it.
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const missing = idsKey ? idsKey.split(',').filter((id) => !cache.has(id)) : []
    if (missing.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchAllRowsChunkedIn<{ id: string; name: string | null; email: string | null }, string>(
          missing,
          (chunk, from, to) => supabase.from('users').select('id, name, email').in('id', chunk).order('id').range(from, to),
          'user display names',
        )
        for (const r of rows) cache.set(r.id, r.name?.trim() || r.email?.trim() || '')
      } catch (err) {
        console.warn('[user-names] load failed', err)
      }
      if (!cancelled) setTick((n) => n + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [idsKey])

  return useMemo(() => {
    const out: Record<string, string> = {}
    for (const id of idsKey ? idsKey.split(',') : []) {
      const n = cache.get(id)
      if (n) out[id] = n
    }
    return out
  }, [idsKey, tick])
}
