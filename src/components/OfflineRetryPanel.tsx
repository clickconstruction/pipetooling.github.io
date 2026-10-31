import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { recordNavClick } from '../lib/navClickTelemetry'
import { offlineRecoveryState, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { ErrorDoorButton, ErrorDoorCard } from './help/ErrorDoor'
import { errorFamilyOf } from '../lib/help/errorGuides'

type Props = {
  /** The last failure (class + sentence); null hides the panel. */
  failure: OfflineRecoveryLastError | null
  /** Re-runs the action that failed. */
  onRetry: () => void | Promise<void>
  /** Telemetry surface key (`dispatch-schedule`, `clock-in`, …). */
  surface: string
  /** Re-running is safe (a read) → retries by itself when the signal returns. Writes leave this off. */
  idempotent?: boolean
  /** The action is in flight — hides the button and holds auto-retry. */
  busy?: boolean
  /** A read's own words for a lost signal, in place of the write sentence's *nothing was saved* (v2.6198). */
  offlineMessage?: string
  style?: CSSProperties
  messageStyle?: CSSProperties
}

/**
 * Error paragraph that knows when it is worth trying again (J2-F3, Tier-1 #6b).
 *
 * Renders the failure sentence exactly as the old `<p>{error}</p>` did — but
 * when the failure was the network (v2.2843's `kind === 'network'`, decided by
 * class, not text) it adds a Retry button and listens for the browser's
 * `online` event, flipping the copy to "Back online" and, for idempotent
 * actions, retrying on its own. Any other failure (a refusal, a broken link, a
 * timeout whose write may still land) renders its own sentence with no Retry.
 *
 * Telemetry: `offline_retry_clicked` on `ui_nav_clicks`, target
 * `#<surface>:tap` or `#<surface>:auto`.
 */
export default function OfflineRetryPanel({
  failure,
  onRetry,
  surface,
  idempotent = false,
  busy = false,
  offlineMessage,
  style,
  messageStyle,
}: Props) {
  const { user, role } = useAuth()
  const online = useOnlineStatus()
  const [attempts, setAttempts] = useState(0)
  /** Count of `online` events since the failure — each one is one chance to auto-retry. */
  const [onlineEvents, setOnlineEvents] = useState(0)
  const autoFiredForEventRef = useRef<number>(0)
  // The door on the line (punch list #187 PR 6): What this means opens the family's card under it.
  const [doorOpen, setDoorOpen] = useState(false)

  // A fresh success (failure → null) starts everything over.
  useEffect(() => {
    if (failure == null) {
      setAttempts(0)
      setOnlineEvents(0)
      autoFiredForEventRef.current = 0
    }
  }, [failure])

  // The signal coming back is an event, not a flag: the browser's online flag
  // can say "online" through a failed fetch (dead wifi, unreachable server).
  useEffect(() => {
    if (typeof window === 'undefined' || failure == null) return
    const onOnline = () => setOnlineEvents((n) => n + 1)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [failure])

  const state = offlineRecoveryState({
    online,
    lastError: failure,
    attempts,
    idempotent,
    reconnected: onlineEvents > 0,
    offlineMessage,
  })

  const retry = (auto: boolean) => {
    recordNavClick(user?.id, role, 'offline_retry_clicked', `#${surface}:${auto ? 'auto' : 'tap'}`)
    setAttempts((n) => n + 1)
    void onRetry()
  }

  // One automatic retry per `online` event, idempotent actions only, under the cap.
  useEffect(() => {
    if (!state.autoRetry || busy) return
    if (autoFiredForEventRef.current === onlineEvents) return
    autoFiredForEventRef.current = onlineEvents
    retry(true)
    // `retry` closes over props that change per render; the ref above is the dedupe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.autoRetry, busy, onlineEvents])

  if (state.phase === 'idle') return null
  const family = errorFamilyOf({ kind: failure?.kind ?? 'unknown', message: failure?.message })

  const text = (
    <p
      style={{
        margin: 0,
        fontSize: '0.875rem',
        color: state.phase === 'back-online' ? 'var(--text-amber-800)' : 'var(--text-red-700)',
        ...messageStyle,
      }}
    >
      <span>{state.message}</span>
      {failure ? (
        <>
          {' · '}
          <ErrorDoorButton family={family} open={doorOpen} onToggle={setDoorOpen} />
        </>
      ) : null}
    </p>
  )
  const card = doorOpen && failure ? <ErrorDoorCard family={family} onClose={() => setDoorOpen(false)} style={{ flexBasis: '100%' }} /> : null

  if (!state.showRetry)
    return (
      <div style={style}>
        {text}
        {card}
      </div>
    )

  return (
    <div
      role="alert"
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem', ...style }}
    >
      {text}
      {busy ? null : (
        <button
          type="button"
          onClick={() => retry(false)}
          style={{
            padding: '0.4rem 0.9rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            background: 'var(--surface)',
            color: 'var(--text-strong)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            minHeight: 36,
          }}
        >
          {state.retryLabel}
        </button>
      )}
      {card}
    </div>
  )
}
