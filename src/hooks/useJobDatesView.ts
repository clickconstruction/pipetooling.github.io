import { useSyncExternalStore } from 'react'

/**
 * How a job's dates are drawn — Words or Track (v2.6139, punch list #217: jobs-pipeline-1 and
 * jobs-pipeline-6), remembered per browser the way the lien strip remembers Steps · Windows
 * (`useLienTimelineView`). **Words** is every screen as it reads today: the Billed row's dates
 * ledger (*Billed Oct 9 · 21d ago …*) and the Job tab's two date bands. **Track** draws the same
 * dates against today: the Billed row's three dates on one axis with the guessed one marked, and
 * the Job tab's days as one strip. One choice drives both surfaces, and it defaults to Words, so
 * nothing changes until the person switches. The owner asked for the drawings "only as an
 * alternative view that a user can choose to engage in" (2026-10-30).
 */

export type JobDatesView = 'words' | 'track'

const STORAGE_KEY = 'jobDatesView'
const DEFAULT_VIEW: JobDatesView = 'words'

function readStoredView(): JobDatesView {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'track' || stored === 'words' ? stored : DEFAULT_VIEW
  } catch {
    return DEFAULT_VIEW
  }
}

const store = {
  view: typeof window === 'undefined' ? DEFAULT_VIEW : readStoredView(),
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    store.listeners.add(listener)
    return () => {
      store.listeners.delete(listener)
    }
  },
  snapshot: (): JobDatesView => store.view,
  server: (): JobDatesView => DEFAULT_VIEW,
}

export function setJobDatesView(view: JobDatesView) {
  store.view = view
  try {
    window.localStorage.setItem(STORAGE_KEY, view)
  } catch {
    // Private-mode storage failures just lose persistence, not the session's choice.
  }
  for (const l of store.listeners) l()
}

export function useJobDatesView(): JobDatesView {
  return useSyncExternalStore(store.subscribe, store.snapshot, store.server)
}
