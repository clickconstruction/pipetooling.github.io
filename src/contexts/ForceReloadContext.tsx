import { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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

  const base = window.location.origin + window.location.pathname
  const hash = window.location.hash || ''
  const reload = () => { window.location.href = base + '?nocache=' + Date.now() + hash }
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(reload, reload)
  } else {
    reload()
  }
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
      ch.send({ type: 'broadcast', event: 'force_reload', payload: {} })
    }
  }, [])

  useEffect(() => {
    const channel = supabase.channel('force-reload')
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'force_reload' }, () => {
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
