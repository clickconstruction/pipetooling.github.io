import { Component, useCallback, type ErrorInfo, type ReactNode } from 'react'
import { useOptionalToastContext } from '../contexts/ToastContext'
import { browserSaysOffline, chunkRecoveryReloadStarted } from '../lib/chunkLoadRecovery'
import { pageHoldsTypedText } from '../lib/typedText'
import { WINDOW_UPDATING_WORDS, windowLoadView, windowLostLine } from '../lib/windowLoad'
import { WindowOpening } from './WindowOpening'

/**
 * The boundary every on-demand window's host puts around it (punch list #85). A window whose code does
 * not come used to throw to the boundary around the routes, which drew its fallback in place of the whole
 * signed-in app. Here only the window gives up: its host closes it, one line of words says so, and the
 * page behind stays as it was. `windowLoad.ts` decides; this draws.
 *
 * After it gives up it draws nothing until its host unmounts it or `resetKey` changes, so a host that
 * could not close its window is never asked again by a render alone.
 */

type Props = {
  children: ReactNode
  /** The window as its line names it, with its article: "The job" (`WINDOW_NAMES`). */
  what: string
  /** Closes the window in its host. Called once, when the load is given up on. */
  onGaveUp: () => void
  /** The open's own key. A change clears a caught failure, so the next open asks afresh. */
  resetKey?: string | number | null
}

type CatchProps = Props & { say: (words: string, ms: number) => void }

type State = { error: Error | null }

class WindowLoadCatch extends Component<CatchProps, State> {
  constructor(props: CatchProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (windowLoadView(error, chunkRecoveryReloadStarted()) !== 'gave-up') return
    console.error('WindowLoadBoundary caught:', error, errorInfo)
    // Typed words hold the reload that would load the window, so the line says what frees it.
    const line = windowLostLine(this.props.what, browserSaysOffline(), pageHoldsTypedText())
    this.props.say(line.words, line.ms)
    this.props.onGaveUp()
  }

  componentDidUpdate(prev: CatchProps) {
    if (this.props.resetKey !== prev.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    const view = windowLoadView(this.state.error, chunkRecoveryReloadStarted())
    if (view === 'window') return this.props.children
    if (view === 'updating') return <WindowOpening words={WINDOW_UPDATING_WORDS} />
    // Not a lost chunk: the boundary above takes it, as it did before this one stood here.
    if (view === 'broken') throw this.state.error
    return null
  }
}

export function WindowLoadBoundary({ children, what, onGaveUp, resetKey }: Props) {
  // Null in a render smoke with no provider: the window still closes, with no line.
  const toasts = useOptionalToastContext()
  const say = useCallback((words: string, ms: number) => toasts?.showToast(words, 'warning', ms), [toasts])
  return (
    <WindowLoadCatch what={what} onGaveUp={onGaveUp} resetKey={resetKey} say={say}>
      {children}
    </WindowLoadCatch>
  )
}
