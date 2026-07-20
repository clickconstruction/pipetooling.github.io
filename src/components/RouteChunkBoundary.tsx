import React from 'react'
import { isChunkLoadError, tryClaimChunkRecoveryReload } from '../lib/chunkLoadRecovery'
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
 * Error boundary for the lazy route outlet. A stale-chunk import failure (old build's
 * hashed asset 404s after a deploy) triggers one guarded automatic reload instead of a
 * white screen; repeated failures and non-chunk errors get a visible fallback with a
 * manual reload path.
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
      tryClaimChunkRecoveryReload(
        Date.now(),
        typeof sessionStorage !== 'undefined' ? sessionStorage : null,
      )
    ) {
      this.setState({ recovering: true })
      hardReloadFromRoot()
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.error && !this.state.recovering) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.recovering) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Updating app…
        </div>
      )
    }
    if (this.state.error) {
      const chunkError = isChunkLoadError(this.state.error)
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
    return this.props.children
  }
}
