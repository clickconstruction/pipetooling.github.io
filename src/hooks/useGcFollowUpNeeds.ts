import { useEffect, useState } from 'react'
import type { GcNeedsYou } from '../lib/gcMode/gcNeedsYou'
import type { GcChangeRequestsNeedsYou } from '../lib/gcMode/gcChangeRequestsWaiting'
import type { GcBackChargesNeedsYou } from '../lib/gcMode/gcBackChargesWaiting'
import type { GcStaleSchedulesNeedsYou } from '../lib/gcMode/gcStaleSchedules'
import type { GcScheduleMovesNeedsYou } from '../lib/gcMode/gcCounts'

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

/**
 * GC mode design spike (the owner, 2026-10-05): back-charges waiting on the office, for the
 * dashboard's own Needs you line, kept current as the GC page settles them. Loads the GC model only when on.
 */
export function useGcBackCharges(enabled: boolean): GcBackChargesNeedsYou | null {
  const [needs, setNeeds] = useState<GcBackChargesNeedsYou | null>(null)
  useEffect(() => {
    if (!enabled) {
      setNeeds(null)
      return
    }
    let live = true
    let off = () => {}
    void import('../lib/gcMode/gcModel').then((gc) => {
      if (!live) return
      const read = () => setNeeds(gc.gcBackChargesNeedsYou(gc.gcStoreState()))
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
 * GC mode design spike (the Gantt, G-59; the owner's OK 2026-10-06): schedules nobody has walked
 * this week, for the dashboard's own Needs you line. Loads the GC model only when on.
 */
export function useGcStaleSchedules(enabled: boolean): GcStaleSchedulesNeedsYou | null {
  const [needs, setNeeds] = useState<GcStaleSchedulesNeedsYou | null>(null)
  useEffect(() => {
    if (!enabled) {
      setNeeds(null)
      return
    }
    let live = true
    let off = () => {}
    void import('../lib/gcMode/gcModel').then((gc) => {
      if (!live) return
      const read = () => setNeeds(gc.gcStaleSchedulesNeedsYou(gc.gcStoreState()))
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
 * GC mode design spike (the counts, 2026-10-06): what waits on us on the jobs' schedules, for the
 * dashboard's own Needs you line, kept current as the GC page changes them. Loads the GC model and
 * the counts' kernel (out of the barrel) only when on.
 */
export function useGcScheduleMoves(enabled: boolean): GcScheduleMovesNeedsYou | null {
  const [needs, setNeeds] = useState<GcScheduleMovesNeedsYou | null>(null)
  useEffect(() => {
    if (!enabled) {
      setNeeds(null)
      return
    }
    let live = true
    let off = () => {}
    void Promise.all([import('../lib/gcMode/gcModel'), import('../lib/gcMode/gcCounts')]).then(([gc, counts]) => {
      if (!live) return
      const read = () => setNeeds(counts.gcScheduleMovesNeedsYou(gc.gcStoreState()))
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
