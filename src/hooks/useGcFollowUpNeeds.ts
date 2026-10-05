import { useEffect, useState } from 'react'
import type { GcNeedsYou } from '../lib/gcMode/gcNeedsYou'
import type { GcChangeRequestsNeedsYou } from '../lib/gcMode/gcChangeRequestsWaiting'

/**
 * GC mode design spike (the owner, 2026-10-04): GC Follow up for the dashboard's Needs you, read
 * from the prototype's session state and kept current as the GC page changes it. The GC model
 * loads only when the item is on, so the dashboard's own load is unchanged for everyone else.
 */
export function useGcFollowUpNeeds(enabled: boolean): GcNeedsYou | null {
  const [needs, setNeeds] = useState<GcNeedsYou | null>(null)
  useEffect(() => {
    if (!enabled) {
      setNeeds(null)
      return
    }
    let live = true
    let off = () => {}
    void import('../lib/gcMode/gcModel').then((gc) => {
      if (!live) return
      const read = () => setNeeds(gc.gcNeedsYou(gc.gcStoreState()))
      read()
      off = gc.gcStoreSubscribe(read)
    })
    return () => {
      live = false
      off()
    }
  }, [enabled])
  return needs
}

/**
 * GC mode design spike (the owner, 2026-10-05): change requests waiting on us, for the dashboard's
 * own Needs you line, kept current as the GC page answers them. Loads the GC model only when on.
 */
export function useGcChangeRequests(enabled: boolean): GcChangeRequestsNeedsYou | null {
  const [needs, setNeeds] = useState<GcChangeRequestsNeedsYou | null>(null)
  useEffect(() => {
    if (!enabled) {
      setNeeds(null)
      return
    }
    let live = true
    let off = () => {}
    void import('../lib/gcMode/gcModel').then((gc) => {
      if (!live) return
      const read = () => setNeeds(gc.gcChangeRequestsNeedsYou(gc.gcStoreState()))
      read()
      off = gc.gcStoreSubscribe(read)
    })
    return () => {
      live = false
      off()
    }
  }, [enabled])
  return needs
}
