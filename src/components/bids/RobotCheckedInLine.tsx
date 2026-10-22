import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { robotCheckedInWords } from '../../lib/bids/robotProgress'

// submittal_robot_liveness is typed Json; the generated types follow the push.
const db = supabase as unknown as SupabaseClient

/**
 * The Robots lenses' one sentence about the fleet (v2.5732, punch list #142): when the newest key
 * last called twin-mcp, read through `submittal_robot_liveness()` so no key name crosses. Says
 * nothing until a key has called at all; re-reads each minute while mounted.
 */
export function RobotCheckedInLine() {
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    let cancelled = false
    const read = async () => {
      try {
        const { data, error } = await db.rpc('submittal_robot_liveness')
        if (cancelled || error) return
        const seen = (data as { last_seen_at?: string | null } | null)?.last_seen_at ?? null
        setLastSeenAt(seen)
        setNowMs(Date.now())
      } catch {
        /* the line stays silent */
      }
    }
    void read()
    const id = window.setInterval(() => { if (document.visibilityState !== 'hidden') void read() }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])
  const words = robotCheckedInWords(lastSeenAt, nowMs)
  if (!words) return null
  return <span data-testid="robot-checked-in">{words}</span>
}
