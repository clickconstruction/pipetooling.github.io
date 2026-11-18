import { useCallback, useEffect, useState } from 'react'
import { JOB_PAPERS_CHANGED_EVENT, type JobNeedingMe, type MyJobPapers, jobPapersPromptOnlyRole } from '../lib/jobs/jobPapers'
import { supabaseJobPapersIo, type JobPapersIo } from '../lib/jobs/jobPapersIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'

/**
 * The jobs the signed-in person still owes a paper on (papers before a job opens, step 3), read once for the whole
 * tab. The job window's prompt, Job Mode's card, the schedule, the calendar and the clock-in picker all follow this
 * one read, so a job is locked in every list or in none.
 *
 * It reads when the first follower mounts, when a job's papers change in this tab (`jobPapersChanged`), when the
 * window comes back into focus, and every 90 seconds while the tab is on screen. A read that fails keeps what was
 * read before; with nothing read yet it answers that no job is closed, so a lost signal never shuts anyone out of
 * their work. The database holds the lock behind the prompt.
 */

export type ClosedJobsSnapshot = { ready: boolean; closed: ReadonlySet<string> }

const REREAD_MS = 90_000
const FIRST_READ_PATIENCE_MS = 4_000
const NONE: ReadonlySet<string> = new Set()

let io: JobPapersIo = supabaseJobPapersIo
let snapshot: ClosedJobsSnapshot = { ready: false, closed: NONE }
let reading = false
let again = false
const followers = new Set<(s: ClosedJobsSnapshot) => void>()
let stop: (() => void) | null = null
/** The caller's papers on a closed job, kept until the next read of the closed set. */
const mineCache = new Map<string, Promise<MyJobPapers>>()

function publish(next: ClosedJobsSnapshot) {
  snapshot = next
  for (const f of [...followers]) f(next)
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

async function read(): Promise<void> {
  if (reading) {
    again = true
    return
  }
  reading = true
  try {
    const next = new Set(await io.readClosed())
    mineCache.clear()
    // The same answer keeps the same set, so a follower does not draw again for nothing.
    publish({ ready: true, closed: snapshot.ready && sameSet(snapshot.closed, next) ? snapshot.closed : next })
  } catch {
    publish({ ready: true, closed: snapshot.closed })
  } finally {
    reading = false
    if (again) {
      again = false
      void read()
    }
  }
}

function start() {
  const onChanged = () => void read()
  const onFocus = () => void read()
  window.addEventListener(JOB_PAPERS_CHANGED_EVENT, onChanged)
  window.addEventListener('focus', onFocus)
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void read()
  }, REREAD_MS)
  // A first read that hangs must not hold a job shut: after a few seconds the answer is what is known, which is none.
  const patience = window.setTimeout(() => {
    if (!snapshot.ready) publish({ ready: true, closed: snapshot.closed })
  }, FIRST_READ_PATIENCE_MS)
  stop = () => {
    window.removeEventListener(JOB_PAPERS_CHANGED_EVENT, onChanged)
    window.removeEventListener('focus', onFocus)
    window.clearInterval(timer)
    window.clearTimeout(patience)
  }
  void read()
}

/** Tell every follower in this tab that a job's papers changed: a paper required, taken off or signed. */
export function jobPapersChanged(jobId = ''): void {
  window.dispatchEvent(new CustomEvent(JOB_PAPERS_CHANGED_EVENT, { detail: jobId }))
}

/** Read the closed jobs again now, and wait for the answer. */
export async function rereadJobsClosedToMe(): Promise<ClosedJobsSnapshot> {
  await read()
  return snapshot
}

/** `enabled` false follows nothing and reads nothing: nobody is signed in. */
export function useJobsClosedToMe(enabled = true): ClosedJobsSnapshot {
  const [state, setState] = useState<ClosedJobsSnapshot>(snapshot)
  useEffect(() => {
    if (!enabled) return
    followers.add(setState)
    if (followers.size === 1) start()
    else setState(snapshot)
    return () => {
      followers.delete(setState)
      if (followers.size === 0) {
        stop?.()
        stop = null
        // The next person to sign in on this tab must not see the last one's locks.
        snapshot = { ready: false, closed: NONE }
        mineCache.clear()
      }
    }
  }, [enabled])
  return enabled ? state : { ready: true, closed: NONE }
}

/**
 * The jobs whose name, address and customer a list hides from this person. The crew and subs see a closed job by its
 * number alone. The office's and a primary's lists keep showing the job (the owner's call 8: for them the prompt at
 * the job is the lock), so for those roles this is always empty.
 */
export function useJobsLockedInLists(role: string | null | undefined): ReadonlySet<string> {
  const { closed } = useJobsClosedToMe()
  return jobPapersPromptOnlyRole(role) ? NONE : closed
}

export type MyJobPapersRead = { mine: MyJobPapers | null; failure: OfflineRecoveryLastError | null; loading: boolean; reload: () => void }

/**
 * The caller's own papers on one job: the job's number, the papers' names and which are signed. Shared by every
 * row and prompt that shows the same closed job. `jobId` null reads nothing.
 */
export function useMyJobPapers(jobId: string | null): MyJobPapersRead {
  const [state, setState] = useState<{ mine: MyJobPapers | null; failure: OfflineRecoveryLastError | null; loading: boolean }>({ mine: null, failure: null, loading: jobId != null })
  const [rev, setRev] = useState(0)
  useEffect(() => {
    if (!jobId) {
      setState({ mine: null, failure: null, loading: false })
      return
    }
    let live = true
    let pending = mineCache.get(jobId)
    if (!pending) {
      pending = io.readMine(jobId)
      mineCache.set(jobId, pending)
      pending.catch(() => mineCache.delete(jobId))
    }
    setState((s) => ({ ...s, loading: true }))
    pending.then(
      (mine) => {
        if (live) setState({ mine, failure: null, loading: false })
      },
      (e: unknown) => {
        if (live) setState((s) => ({ mine: s.mine, failure: recoveryFailureFromError(e, 'Couldn’t read this job’s papers'), loading: false }))
      },
    )
    return () => {
      live = false
    }
  }, [jobId, rev])
  const reload = useCallback(() => {
    if (jobId) mineCache.delete(jobId)
    setRev((r) => r + 1)
  }, [jobId])
  return { ...state, reload }
}

const NO_JOBS: JobNeedingMe[] = []

/**
 * The jobs that wait on this person's signature and are theirs to open, for the Needs you line. It follows the closed
 * set: with no job closed to them it reads nothing more, and it reads again whenever that set changes.
 */
export function useJobsNeedingMe(enabled = true): JobNeedingMe[] {
  const { ready, closed } = useJobsClosedToMe(enabled)
  const [jobs, setJobs] = useState<JobNeedingMe[]>(NO_JOBS)
  useEffect(() => {
    if (!enabled || !ready || closed.size === 0) {
      setJobs(NO_JOBS)
      return
    }
    let live = true
    io.readNeedingMe().then(
      (rows) => {
        if (live) setJobs(rows)
      },
      () => {
        // The line is a reminder: a failed read leaves it as it was, and the job's own prompt still stands.
      },
    )
    return () => {
      live = false
    }
  }, [enabled, ready, closed])
  return jobs
}

/** For tests: hand the store a fake io and forget what it read. */
export function resetJobsClosedToMeForTest(next: JobPapersIo = supabaseJobPapersIo): void {
  io = next
  stop?.()
  stop = null
  followers.clear()
  snapshot = { ready: false, closed: NONE }
  mineCache.clear()
  reading = false
  again = false
}
