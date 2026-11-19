/**
 * Take from a box: the run kept on the phone. A phone can drop a web page while its camera is open, and a person can
 * photograph a box and walk off, so a run is written to this phone's storage on every change. Back on the box, the run
 * is offered again (`takeLeftWords`). After twelve hours it is forgotten (`takeIsStale`): the photo as found stays in
 * the job's folder, tied to a take with nothing marked. Browser io; a phone with no storage keeps nothing and the run
 * lives for the page's life.
 */
import { takeIsStale, type TakeRun } from './takeRun'

const PREFIX = 'pt.onSite.take.'
const keyOf = (jobId: string, containerId: string) => `${PREFIX}${jobId}.${containerId}`

function isRun(v: unknown): v is TakeRun {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.jobId === 'string' && typeof o.containerId === 'string' && typeof o.startedAt === 'string' && !!o.marks && typeof o.marks === 'object' && Array.isArray(o.extras)
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

function storage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function keepTakeRun(run: TakeRun, store: Store | null = storage()): void {
  try {
    store?.setItem(keyOf(run.jobId, run.containerId), JSON.stringify(run))
  } catch {
    // A full or shut store: the run lives for the page's life.
  }
}

export function forgetTakeRun(jobId: string, containerId: string, store: Store | null = storage()): void {
  try {
    store?.removeItem(keyOf(jobId, containerId))
  } catch {
    // Nothing to forget.
  }
}

/** The run left on one box, or null. A run past its hours is forgotten here. */
export function readTakeRun(jobId: string, containerId: string, nowMs: number, store: Store | null = storage()): TakeRun | null {
  try {
    const raw = store?.getItem(keyOf(jobId, containerId))
    if (!raw) return null
    const run: unknown = JSON.parse(raw)
    if (!isRun(run) || takeIsStale(run, nowMs)) {
      store?.removeItem(keyOf(jobId, containerId))
      return null
    }
    return { ...run, savedAt: typeof run.savedAt === 'string' ? run.savedAt : null, savedCount: Number(run.savedCount) || 0 }
  } catch {
    return null
  }
}

/** Every run left on a job's boxes, oldest first. */
export function readTakeRuns(jobId: string, nowMs: number, store: Store | null = storage()): TakeRun[] {
  const out: TakeRun[] = []
  try {
    if (!store) return out
    const mine = `${PREFIX}${jobId}.`
    const boxes: string[] = []
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (k && k.startsWith(mine)) boxes.push(k.slice(mine.length))
    }
    for (const b of boxes) {
      const run = readTakeRun(jobId, b, nowMs, store)
      if (run) out.push(run)
    }
  } catch {
    return out
  }
  return out.sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))
}
