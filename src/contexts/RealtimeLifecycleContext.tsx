import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// When a tab is hidden longer than this we drop ALL Supabase Realtime channels
// and bump the epoch. Channel-creating effects that include the epoch in their
// deps will rebuild on resume so we never resubscribe a stale WebSocket. Five
// minutes is short enough to catch the "stale tab left in another window for
// hours" failure mode that drove the v2.454 / Tier 1 mitigation work, and long
// enough that briefly switching tabs does not cause subscription churn.
const HIDDEN_DROP_AFTER_MS = 5 * 60 * 1000

type RealtimeLifecycleContextValue = {
  realtimeEpoch: number
}

const RealtimeLifecycleContext = createContext<RealtimeLifecycleContextValue>({
  realtimeEpoch: 0,
})

export function RealtimeLifecycleProvider({ children }: { children: ReactNode }) {
  const [epoch, setEpoch] = useState(0)
  const droppedRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const clearPending = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'hidden') {
        clearPending()
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null
          try {
            void supabase.removeAllChannels()
          } catch {
            // best effort; absence of channels is harmless
          }
          droppedRef.current = true
        }, HIDDEN_DROP_AFTER_MS)
      } else {
        clearPending()
        if (droppedRef.current) {
          droppedRef.current = false
          setEpoch((e) => e + 1)
        }
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
      clearPending()
    }
  }, [])

  return (
    <RealtimeLifecycleContext.Provider value={{ realtimeEpoch: epoch }}>
      {children}
    </RealtimeLifecycleContext.Provider>
  )
}

/** Increments whenever the global lifecycle has dropped all Realtime channels.
 * Channel-owning effects should include this in their dep array so the
 * subscription is rebuilt on resume from a long hidden interval. */
export function useRealtimeEpoch(): number {
  return useContext(RealtimeLifecycleContext).realtimeEpoch
}
