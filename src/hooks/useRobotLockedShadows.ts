import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { ShadowRunRow } from '../lib/bids/shadowStory'
import { selectRobotLockedShadows, type RobotLockedShadow } from '../lib/bids/robotLockedShadows'

// list_shadow_runs predates the generated types (BidsAuditsTab pattern).
const shadowDb = supabase as unknown as SupabaseClient

/**
 * Sealed robot numbers on live bids (v2.3126): shadow runs that are locked,
 * whose reference bid has not gone out, locked within the last 14 days —
 * newest first. Read through `list_shadow_runs()` (sealed money stays NULL
 * there, so nothing here can anchor the human number). `locked` is null while
 * loading; a missing RPC or any error reads as an empty list so the Dashboard
 * card stays quiet rather than toasting.
 */
export function useRobotLockedShadows(enabled: boolean): { locked: RobotLockedShadow[] | null } {
  const [locked, setLocked] = useState<RobotLockedShadow[] | null>(enabled ? null : [])

  useEffect(() => {
    if (!enabled) {
      setLocked([])
      return
    }
    let cancelled = false
    setLocked(null)
    void (async () => {
      try {
        const { data, error } = await shadowDb.rpc('list_shadow_runs')
        if (error) throw new Error(error.message)
        if (cancelled) return
        setLocked(selectRobotLockedShadows((data ?? []) as ShadowRunRow[]))
      } catch {
        if (!cancelled) setLocked([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { locked }
}
