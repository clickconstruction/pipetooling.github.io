import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  LOCAL_PICKS_KEY,
  parseLocalPicks,
  picksFromRows,
  withPick,
  type PickMap,
  type PunchPick,
  type PunchPickRow,
} from '../lib/todos/punchListView'

/**
 * The Punch list's picks (v2.3559): one `punch_list_picks` row per to-do slug, shared by
 * everyone who can open the page, stamped server-side with who and when. Until the table
 * is there (the client deploys before `supabase db push`) the picks stay on the device
 * under the key the old board used, and `shared` says so.
 *
 * Reads: one select on mount and whenever the tab regains focus — the board is looked at,
 * not watched. Writes: an upsert per change; the server trigger sets `updated_by` /
 * `updated_at`, and the row comes back with the name so the caller never guesses.
 */
export function usePunchListPicks(enabled: boolean): {
  picks: PickMap
  shared: boolean
  loading: boolean
  save: (slug: string, patch: Partial<{ pick: PunchPick | ''; note: string }>) => Promise<void>
} {
  const [picks, setPicks] = useState<PickMap>(() => readLocal())
  const [shared, setShared] = useState(false)
  const [loading, setLoading] = useState(enabled)
  const sharedRef = useRef(false)

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('punch_list_picks')
        .select('slug, pick, note, updated_at, updated_by, users:updated_by(name)')
      if (error) {
        // 42P01 / PGRST205: the table is not there yet — device picks, and say so.
        sharedRef.current = false
        setShared(false)
        return
      }
      sharedRef.current = true
      setShared(true)
      setPicks(picksFromRows((data ?? []) as unknown as PunchPickRow[]))
    } catch {
      sharedRef.current = false
      setShared(false)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
    const onFocus = (): void => {
      if (document.visibilityState === 'visible') void reload()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [reload])

  const save = useCallback(
    async (slug: string, patch: Partial<{ pick: PunchPick | ''; note: string }>) => {
      // Optimistic either way; the shared write replaces the row with the server's stamp.
      setPicks((prev) => {
        const next = { ...prev, [slug]: withPick(prev[slug], patch, new Date().toISOString(), prev[slug]?.by ?? '', prev[slug]?.byName ?? '') }
        if (!sharedRef.current) writeLocal(next)
        return next
      })
      if (!sharedRef.current) return
      const current = picks[slug]
      const row = { slug, pick: patch.pick ?? current?.pick ?? '', note: patch.note ?? current?.note ?? '' }
      const { data, error } = await supabase
        .from('punch_list_picks')
        .upsert(row, { onConflict: 'slug' })
        .select('slug, pick, note, updated_at, updated_by, users:updated_by(name)')
        .single()
      if (error || !data) return
      const fresh = picksFromRows([data as unknown as PunchPickRow])
      setPicks((prev) => ({ ...prev, ...fresh }))
    },
    [picks],
  )

  return { picks, shared, loading, save }
}

function readLocal(): PickMap {
  try {
    return parseLocalPicks(localStorage.getItem(LOCAL_PICKS_KEY))
  } catch {
    return {}
  }
}

function writeLocal(next: PickMap): void {
  try {
    localStorage.setItem(LOCAL_PICKS_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable — the pick still shows for this page load
  }
}
