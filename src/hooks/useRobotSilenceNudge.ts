import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { robotSilence, type RobotSilence } from '../lib/bids/robotSilence'
import { loadRobotSilenceDismissState, saveRobotSilenceDismissState, shouldShowRobotSilence, type RobotSilenceDismissState } from '../lib/robotSilenceDismiss'

const db = supabase as unknown as SupabaseClient
const SNOOZE_MS = 24 * 60 * 60 * 1000
const REFRESH_MS = 60_000

/**
 * The fleet's silence for the owner's Dashboard (Robot rounds PR 4, punch list #142): the newest
 * key's last call through `submittal_robot_liveness()`, read on mount, on focus and every minute;
 * asleep after fifteen minutes with no call. Null when disabled, loading, awake, snoozed or
 * dismissed. Fail-soft.
 */
export function useRobotSilenceNudge(enabled: boolean, userId: string | null | undefined): {
  silence: RobotSilence | null
  snooze24h: () => void
  dismissUntilNextRound: () => void
} {
  const [raw, setRaw] = useState<RobotSilence | null>(null)
  const [dismissState, setDismissState] = useState<RobotSilenceDismissState>({})
  useEffect(() => {
    if (!userId) {
      setDismissState({})
      return
    }
    setDismissState(loadRobotSilenceDismissState(userId))
  }, [userId])
  const load = useCallback(async () => {
    if (!enabled) {
      setRaw(null)
      return
    }
    try {
      const { data, error } = await db.rpc('submittal_robot_liveness')
      if (error) {
        setRaw(null)
        return
      }
      const seen = (data as { last_seen_at?: string | null } | null)?.last_seen_at ?? null
      setRaw(robotSilence(seen, Date.now()))
    } catch {
      setRaw(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!enabled) return
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(() => { if (document.visibilityState !== 'hidden') void load() }, REFRESH_MS)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(id)
    }
  }, [enabled, load])
  const persist = (next: RobotSilenceDismissState) => {
    if (!userId) return
    setDismissState(next)
    saveRobotSilenceDismissState(userId, next)
  }
  const visible = raw && raw.asleep && shouldShowRobotSilence(dismissState, raw.lastSeenAt, Date.now()) ? raw : null
  return {
    silence: visible,
    snooze24h: () => persist({ snoozeUntil: Date.now() + SNOOZE_MS }),
    dismissUntilNextRound: () => persist({ dismissedSeenAt: raw?.lastSeenAt ?? undefined }),
  }
}
