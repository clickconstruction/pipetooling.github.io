import { Component, Suspense, useEffect, useState, type CSSProperties, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import AuthPublicLandingLayout from './AuthPublicLandingLayout'
import {
  browserSaysOffline,
  chunkBoundaryView,
  chunkRecoveryReloadStarted,
  isChunkLoadError,
  startChunkRecoveryReload,
} from '../lib/chunkLoadRecovery'
import { hardReloadFromRoot } from '../lib/hardReload'
import { CARD, COPPER, INK, MUTED, PAPER, PORTAL_FONT } from '../lib/portal/portalTheme'
import {
  PUBLIC_PAGE_LOADING_WORDS,
  PUBLIC_PAGE_SLOW_AFTER_MS,
  PUBLIC_PAGE_SLOW_WORDS,
  PUBLIC_PAGE_TRY_AGAIN,
  PUBLIC_PAGE_WORD_AFTER_MS,
  publicPageLostView,
  type PublicPageTone,
} from '../lib/publicPageLoad'

/**
 * A page someone opens from a link with no sign-in, loaded on demand (v2.8306). `App.tsx` holds each one
 * through `lazyWindow` and draws it inside this: the page's own frame with *Loading…* while its code
 * comes, and words with a press when the code did not come. Each page keeps a `Suspense` of its own, since
 * a press on one that opens another would otherwise suspend in a click and blank the page (v2.6868).
 */

type FrameProps = {
  /** The ground the page itself stands on, so the wait and the page are one picture. */
  tone?: PublicPageTone
  /** The landing's thin band on a phone, as the estimate draws it. */
  compact?: boolean
}

const session = (): Storage | null => (typeof sessionStorage !== 'undefined' ? sessionStorage : null)

function PublicPageFrame({ tone = 'paper', compact = false, children }: FrameProps & { children: ReactNode }) {
  if (tone === 'landing') {
    // The same shell, title and box the estimate, the agreement, the contract and the bid room draw.
    return (
      <AuthPublicLandingLayout
        titleLinkText="Click Plumbing and Electrical"
        titleLinkAriaLabel="Visit Click Plumbing and Electrical (opens in new tab)"
        compact={compact}
      >
        <div className="auth-public-landing__signin-stack auth-public-landing__signin-stack--wide">
          <div className="auth-public-landing__signin-box">{children}</div>
        </div>
      </AuthPublicLandingLayout>
    )
  }
  const paper = tone === 'paper'
  return (
    <div
      data-theme="light"
      data-public-page-frame={tone}
      style={{
        minHeight: '100vh',
        boxSizing: 'border-box',
        padding: '3rem 1rem 4rem',
        textAlign: 'center',
        fontFamily: PORTAL_FONT,
        fontSize: 16,
        lineHeight: 1.45,
        background: paper ? PAPER : 'var(--surface)',
        color: paper ? INK : 'var(--text-strong)',
      }}
    >
      {children}
    </div>
  )
}

const press: CSSProperties = {
  marginTop: '0.9rem',
  minHeight: 44,
  padding: '0.6rem 1.5rem',
  borderRadius: 8,
  border: 'none',
  background: COPPER,
  color: CARD,
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
}

/**
 * What shows while a public page's code loads. On the landing it is the page's own loading look, word for
 * word, so the customer sees one picture from the first paint to the estimate. On paper the word waits a
 * quarter second, so a page already on the device draws with no flash of it: a timer, not a CSS delay,
 * since a tab in the background holds its animations still and the word must come. A fetch that hangs
 * never fails, so past ten seconds the wait says so and offers a press.
 */
export function PublicPageLoading({ tone = 'paper', compact = false }: FrameProps) {
  const landing = tone === 'landing'
  const [worded, setWorded] = useState(landing)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const word = setTimeout(() => setWorded(true), PUBLIC_PAGE_WORD_AFTER_MS)
    const late = setTimeout(() => setSlow(true), PUBLIC_PAGE_SLOW_AFTER_MS)
    return () => {
      clearTimeout(word)
      clearTimeout(late)
    }
  }, [])
  return (
    <PublicPageFrame tone={tone} compact={compact}>
      <div role="status" aria-live="polite" data-public-page={slow ? 'slow' : 'loading'}>
        {landing ? (
          <p>{PUBLIC_PAGE_LOADING_WORDS}</p>
        ) : worded ? (
          <p style={{ margin: 0, color: tone === 'paper' ? MUTED : 'var(--text-muted)' }}>{PUBLIC_PAGE_LOADING_WORDS}</p>
        ) : null}
        {slow ? (
          <>
            <p style={landing ? { margin: 0 } : { margin: '0.75rem auto 0', maxWidth: '28ch' }}>{PUBLIC_PAGE_SLOW_WORDS}</p>
            <button type="button" style={press} onClick={() => window.location.reload()}>
              {PUBLIC_PAGE_TRY_AGAIN}
            </button>
          </>
        ) : null}
      </div>
    </PublicPageFrame>
  )
}

/**
 * The page's code did not come and the one automatic reload is spent, or there is no network to reload
 * from. Says so in a customer's words, with one press. Offline the press stays here and answers in words,
 * since a reload would land on the browser's own error page; the page loads by itself when the signal is back.
 */
function PublicPageLost({ tone = 'paper', compact = false }: FrameProps) {
  const [offline, setOffline] = useState(browserSaysOffline)
  const [pressedOffline, setPressedOffline] = useState(false)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const back = () => {
      setOffline(false)
      if (startChunkRecoveryReload(Date.now(), session(), hardReloadFromRoot)) setLeaving(true)
    }
    const gone = () => setOffline(true)
    window.addEventListener('online', back)
    window.addEventListener('offline', gone)
    return () => {
      window.removeEventListener('online', back)
      window.removeEventListener('offline', gone)
    }
  }, [])
  if (leaving) return <PublicPageLoading tone={tone} compact={compact} />
  const view = publicPageLostView(!offline, pressedOffline)
  const tryAgain = () => {
    if (browserSaysOffline()) {
      setOffline(true)
      setPressedOffline(true)
      return
    }
    setLeaving(true)
    hardReloadFromRoot()
  }
  return (
    <PublicPageFrame tone={tone} compact={compact}>
      <div role="alert" data-public-page={view.reload ? 'lost' : 'offline'}>
        <p style={tone === 'landing' ? { margin: 0 } : { margin: '0 auto', maxWidth: '30ch' }}>{view.words}</p>
        <button type="button" style={press} onClick={tryAgain}>
          {PUBLIC_PAGE_TRY_AGAIN}
        </button>
      </div>
    </PublicPageFrame>
  )
}

type BoundaryProps = FrameProps & {
  children: ReactNode
  /** Change (the path) clears a caught error, so the next page gets its own try. */
  resetKey?: string
}

type BoundaryState = { error: Error | null; recovering: boolean }

/**
 * A public page's own chunk boundary. A lost chunk gets the same one guarded reload every lazy page gets
 * (`chunkLoadRecovery`), which is what brings an old tab onto a new deploy, and while it is on its way the
 * page keeps its loading look. When the reload is spent or the browser is offline it draws `PublicPageLost`.
 * Any other error is not this boundary's: it is thrown on to the one around the routes.
 */
export class PublicPageBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props)
    this.state = { error: null, recovering: false }
  }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (!isChunkLoadError(error)) return
    console.error('PublicPageBoundary caught:', error, errorInfo)
    if (startChunkRecoveryReload(Date.now(), session(), hardReloadFromRoot)) this.setState({ recovering: true })
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (this.props.resetKey !== prev.resetKey && this.state.error && !this.state.recovering) this.setState({ error: null })
  }

  render() {
    const { tone, compact, children } = this.props
    const view = chunkBoundaryView(this.state.error, this.state.recovering || chunkRecoveryReloadStarted())
    if (view === 'page') return children
    if (view === 'updating') return <PublicPageLoading tone={tone} compact={compact} />
    if (view === 'broken') throw this.state.error
    return <PublicPageLost tone={tone} compact={compact} />
  }
}

export function PublicPage({ tone = 'paper', compact = false, children }: FrameProps & { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <PublicPageBoundary tone={tone} compact={compact} resetKey={pathname}>
      <Suspense fallback={<PublicPageLoading tone={tone} compact={compact} />}>{children}</Suspense>
    </PublicPageBoundary>
  )
}
