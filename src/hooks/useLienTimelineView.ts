/**
 * The lien timeline's view (v2.3815, punch list #42): **Steps** — the strip as it has always
 * been, the default — or **Windows**, each paper drawn from its first day to its last. One
 * choice per browser, shared by every strip and the desk's Months table: a module store synced
 * to localStorage, the BidPickerSortToggle pattern. Storage that cannot be read falls back to
 * Steps; it is a convenience, never state anyone else relies on.
 */
import { useSyncExternalStore } from 'react'

export type LienTimelineView = 'steps' | 'windows'

const STORAGE_KEY = 'lienTimelineView'
const DEFAULT_VIEW: LienTimelineView = 'steps'

function readStoredView(): LienTimelineView {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'windows' ? 'windows' : DEFAULT_VIEW
  } catch {
    return DEFAULT_VIEW
  }
}

let currentView: LienTimelineView = typeof window === 'undefined' ? DEFAULT_VIEW : readStoredView()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setLienTimelineView(view: LienTimelineView) {
  currentView = view
  try {
    window.localStorage.setItem(STORAGE_KEY, view)
  } catch {
    // Private-mode storage failures just lose persistence, not the session's choice.
  }
  for (const l of listeners) l()
}

export function useLienTimelineView(): LienTimelineView {
  return useSyncExternalStore(subscribe, () => currentView, () => DEFAULT_VIEW)
}
