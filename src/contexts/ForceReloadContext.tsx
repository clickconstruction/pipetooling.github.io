import { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { hardReloadFromRoot } from '../lib/hardReload'
import {
  FORCE_RELOAD_CHANNEL_OPTIONS,
  FORCE_RELOAD_EVENT,
  FORCE_RELOAD_MESSAGE,
  FORCE_RELOAD_TOPIC,
} from '../lib/forceReloadChannel'

function hardReload() {
  const lastReloadKey = 'force-reload-last'
  const minIntervalMs = 5000
  try {
    const last = sessionStorage.getItem(lastReloadKey)
    if (last && Date.now() - parseInt(last, 10) < minIntervalMs) return
    sessionStorage.setItem(lastReloadKey, String(Date.now()))
  } catch {
    // sessionStorage may be unavailable
  }

  hardReloadFromRoot()
}

type ForceReloadContextValue = {
  forceEveryoneToReload: () => void
}

const ForceReloadContext = createContext<ForceReloadContextValue | null>(null)

export function ForceReloadProvider({ children }: { children: React.ReactNode }) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const forceEveryoneToReload = useCallback(() => {
    const ch = channelRef.current
    if (ch) {
      // The server passes it on only when the sender is a dev (v2.8532). Anyone else's is dropped.
      void ch.send(FORCE_RELOAD_MESSAGE)
    }
  }, [])

  useEffect(() => {
    // Private since v2.8532: the database decides who hears the signal and who sends it (`forceReloadChannel.ts`).
    const channel = supabase.channel(FORCE_RELOAD_TOPIC, FORCE_RELOAD_CHANNEL_OPTIONS)
    channelRef.current = channel

    channel
      .on('broadcast', { event: FORCE_RELOAD_EVENT }, () => {
        hardReload()
      })
      .subscribe()

    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <ForceReloadContext.Provider value={{ forceEveryoneToReload }}>
      {children}
    </ForceReloadContext.Provider>
  )
}

export function useForceReload(): ForceReloadContextValue | null {
  return useContext(ForceReloadContext)
}
