import { useSyncExternalStore } from 'react'

/**
 * The lien timeline's view — Steps or Windows (v2.3815, punch list #42) — remembered per browser.
 * Two scopes since v2.6104 (punch list #214, PR 1): the Lien window keeps opening on Steps, and the
 * Legal desk's Paper tab opens on Windows, the calendar, because the question there is where the
 * job stands in time. Each scope remembers its own choice under its own key.
 */

export type LienTimelineView = 'steps' | 'windows'

/** Where the choice is kept: the Lien window (and every other strip), or the Legal desk's Paper tab. */
export type LienTimelineViewScope = 'window' | 'desk'

const STORAGE_KEY: Record<LienTimelineViewScope, string> = { window: 'lienTimelineView', desk: 'lienTimelineView.desk' }
const DEFAULT_VIEW: Record<LienTimelineViewScope, LienTimelineView> = { window: 'steps', desk: 'windows' }

function readStoredView(scope: LienTimelineViewScope): LienTimelineView {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY[scope])
    return stored === 'windows' || stored === 'steps' ? stored : DEFAULT_VIEW[scope]
  } catch {
    return DEFAULT_VIEW[scope]
  }
}

type Store = { view: LienTimelineView; listeners: Set<() => void>; subscribe: (l: () => void) => () => void; snapshot: () => LienTimelineView; server: () => LienTimelineView }

function makeStore(scope: LienTimelineViewScope): Store {
  const store: Store = {
    view: typeof window === 'undefined' ? DEFAULT_VIEW[scope] : readStoredView(scope),
    listeners: new Set(),
    subscribe: (listener) => {
      store.listeners.add(listener)
      return () => store.listeners.delete(listener)
    },
    snapshot: () => store.view,
    server: () => DEFAULT_VIEW[scope],
  }
  return store
}

const STORES: Record<LienTimelineViewScope, Store> = { window: makeStore('window'), desk: makeStore('desk') }

export function setLienTimelineView(view: LienTimelineView, scope: LienTimelineViewScope = 'window') {
  const store = STORES[scope]
  store.view = view
  try {
    window.localStorage.setItem(STORAGE_KEY[scope], view)
  } catch {
    // Private-mode storage failures just lose persistence, not the session's choice.
  }
  for (const l of store.listeners) l()
}

export function useLienTimelineView(scope: LienTimelineViewScope = 'window'): LienTimelineView {
  const store = STORES[scope]
  return useSyncExternalStore(store.subscribe, store.snapshot, store.server)
}
