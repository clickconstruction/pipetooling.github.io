import React from 'react'
import {
  chunkBoundaryView,
  chunkRecoveryReloadStarted,
  isChunkLoadError,
  startChunkRecoveryReload,
} from '../lib/chunkLoadRecovery'
import { hardReloadFromRoot } from '../lib/hardReload'

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
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Updating app…
        </div>
      )
    }
    const chunkError = view === 'lost-chunk'
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
          {chunkError
            ? 'This page could not load — the app may have just been updated.'
            : 'Something went wrong loading this page.'}
        </div>
        <button
          type="button"
          onClick={() => hardReloadFromRoot()}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-base)',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Reload
        </button>
        <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-faint)' }}>
          Still stuck? <a href="/fix-cache.html">Fix app</a>
        </div>
      </div>
    )
  }
}
