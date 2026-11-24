import React, { useEffect, useRef, useState } from 'react'
import {
  chunkBoundaryView,
  chunkRecoveryReloadStarted,
  isChunkLoadError,
  startChunkRecoveryReload,
} from '../lib/chunkLoadRecovery'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../lib/deadPress'
import { hardReloadFromRoot } from '../lib/hardReload'
import { askReloadOverWords } from '../lib/reloadOverWords'
import { probeForSignal } from '../lib/publicPageLoad'
import {
  ROUTE_RELOAD_PRESS,
  ROUTE_RELOAD_PRESS_MIN_HEIGHT,
  routeReloadAfterAsk,
  routeReloadView,
  type RouteReloadState,
} from '../lib/routeReload'

type Props = {
  children: React.ReactNode
  /** Change (e.g. to location.pathname) clears a caught error so navigation retries. */
  resetKey?: string
}

type State = {
  error: Error | null
  /** True while an automatic recovery reload is in flight — render "Updating app…". */
  recovering: boolean
}

/**
 * The fallback's **Reload**. It asks the network first and reloads only on an answer (`routeReload.ts`): the
 * reload empties the caches before it navigates, and with no network that left the browser's own error page.
 * While the ask is out the press is dead, in the theme's dead-press pair, so a second press sends no second ask.
 */
function RouteReloadPress() {
  const [state, setState] = useState<RouteReloadState>('ready')
  const here = useRef(true)
  useEffect(() => {
    here.current = true
    return () => {
      here.current = false
    }
  }, [])
  const view = routeReloadView(state)
  const press = () => {
    if (view.pressDead) return
    // Over typed words the press is asked first, and the page is walked through each place (v2.8513).
    askReloadOverWords(askTheNetwork)
  }
  const askTheNetwork = () => {
    if (!here.current) return
    setState('checking')
    void probeForSignal().then((answered) => {
      if (!here.current) return
      if (routeReloadAfterAsk(answered) === 'reload') {
        // The press stays dead while the page leaves.
        hardReloadFromRoot()
        return
      }
      setState('no-signal')
    })
  }
  return (
    <>
      <button
        type="button"
        disabled={view.pressDead}
        onClick={press}
        style={{
          minHeight: ROUTE_RELOAD_PRESS_MIN_HEIGHT,
          padding: '0.5rem 1.25rem',
          borderRadius: '0.375rem',
          border: '1px solid var(--border)',
          background: view.pressDead ? DEAD_PRESS_FILL : 'var(--surface)',
          color: view.pressDead ? DEAD_PRESS_TEXT : 'var(--text-base)',
          cursor: view.pressDead ? 'default' : 'pointer',
          fontSize: '0.875rem',
        }}
      >
        {ROUTE_RELOAD_PRESS}
      </button>
      {view.words ? (
        <div role="status" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {view.words}
        </div>
      ) : null}
    </>
  )
}

/**
 * Error boundary for lazy routes: one around every route in `App.tsx`, one around the
 * Layout's outlet. A stale-chunk import failure (old build's hashed asset 404s after a
 * deploy) triggers one guarded automatic reload instead of a white screen; repeated
 * failures and non-chunk errors get a visible fallback with a manual reload path. While a
 * recovery reload started anywhere is on its way it draws "Updating app…".
 */
export class RouteChunkBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, recovering: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('RouteChunkBoundary caught:', error, errorInfo)
    if (
      isChunkLoadError(error) &&
      startChunkRecoveryReload(
        Date.now(),
        typeof sessionStorage !== 'undefined' ? sessionStorage : null,
        hardReloadFromRoot,
      )
    ) {
      this.setState({ recovering: true })
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.error && !this.state.recovering) {
      this.setState({ error: null })
    }
  }

  render() {
    const view = chunkBoundaryView(
      this.state.error,
      this.state.recovering || chunkRecoveryReloadStarted(),
    )
    if (view === 'page') return this.props.children
    if (view === 'updating') {
      return (
        <div className="appBareScreen" style={{ color: 'var(--text-muted)' }}>
          Updating app…
        </div>
      )
    }
    const chunkError = view === 'lost-chunk'
    return (
      <div className="appBareScreen">
        <div style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
          {chunkError
            ? 'This page could not load — the app may have just been updated.'
            : 'Something went wrong loading this page.'}
        </div>
        <RouteReloadPress />
        <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-faint)' }}>
          Still stuck? <a href="/fix-cache.html">Fix app</a>
        </div>
      </div>
    )
  }
}
