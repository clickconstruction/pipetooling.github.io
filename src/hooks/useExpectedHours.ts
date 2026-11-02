/**
 * Expected hours (design spike, punch list #234): the leader's target for a
 * project's hours, set in the open — who, when, from → to, and why — read by
 * the superintendent's line as its pace budget while the bonus baseline stays
 * frozen apart from it. The spike keeps the targets and their history in
 * browser storage; the build writes them as the job's typed budget with a
 * change log, so the Costs tab, the Pipeline's burning card and the phone move
 * together.
 */
import { useCallback, useSyncExternalStore } from 'react'

export type ExpectedHoursTarget = { jobId: string; hours: number; from: number | null; by: string; at: string; why: string }
type Snapshot = { byJob: Record<string, ExpectedHoursTarget>; history: ExpectedHoursTarget[] }

const KEY = 'spike.expectedHours.v1'
function read(): Snapshot {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    return raw ? (JSON.parse(raw) as Snapshot) : { byJob: {}, history: [] }
  } catch {
    return { byJob: {}, history: [] }
  }
}
let snapshot: Snapshot = read()
const listeners = new Set<() => void>()
function commit(next: Snapshot) {
  snapshot = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* the spike's browser storage */
  }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getSnapshot = () => snapshot

export function useExpectedHours() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  /** Sets a job's expected hours with the reason; `from` is what the line read before (the bid's hours or the last target). */
  const setTarget = useCallback((jobId: string, hours: number, from: number | null, by: string, why: string) => {
    const t: ExpectedHoursTarget = { jobId, hours: Math.max(0, Math.round(hours)), from, by, at: new Date().toISOString(), why }
    commit({ byJob: { ...snapshot.byJob, [jobId]: t }, history: [t, ...snapshot.history].slice(0, 50) })
  }, [])
  /** Undoes the latest change: the job goes back to what it read before. */
  const undoLatest = useCallback(() => {
    const [latest, ...rest] = snapshot.history
    if (!latest) return
    const byJob = { ...snapshot.byJob }
    const earlier = rest.find((h) => h.jobId === latest.jobId)
    if (earlier) byJob[latest.jobId] = earlier
    else delete byJob[latest.jobId]
    commit({ byJob, history: rest })
  }, [])
  const clearTarget = useCallback((jobId: string, by: string) => {
    const cur = snapshot.byJob[jobId]
    if (!cur) return
    const byJob = { ...snapshot.byJob }
    delete byJob[jobId]
    commit({ byJob, history: [{ jobId, hours: 0, from: cur.hours, by, at: new Date().toISOString(), why: 'back to the budget' }, ...snapshot.history].slice(0, 50) })
  }, [])
  const reset = useCallback(() => commit({ byJob: {}, history: [] }), [])
  return { byJob: snap.byJob, history: snap.history, setTarget, undoLatest, clearTarget, reset }
}
