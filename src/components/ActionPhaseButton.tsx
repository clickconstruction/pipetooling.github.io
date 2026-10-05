import type { CSSProperties, ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { DownloadPhase } from '../lib/jobs/downloadFeedback'

/**
 * A button that shows its work (v2.4584): solid blue with a spinner while
 * busy, solid green with a tick when done. It keeps its resting size through
 * all three states — the resting words stay in the layout, hidden, under the
 * state's own. Pair it with `useActionPhase`.
 */
export function ActionPhaseButton({
  action,
  phase,
  onClick,
  disabled,
  children,
  busyLabel,
  doneLabel,
  busyBackground = '#2563eb',
  outlined = true,
  style,
}: {
  /** Names the button for tests and styling: `data-action`. */
  action: string
  phase: DownloadPhase
  onClick: () => void
  disabled?: boolean
  /** The resting words. */
  children: ReactNode
  busyLabel: string
  doneLabel: string
  busyBackground?: string
  /** The resting look has a 1px border, which takes the fill's colour; false for a button with none, so its size does not move. */
  outlined?: boolean
  /** The resting look; the busy and done fills are laid over it. */
  style?: CSSProperties
}) {
  const fill: CSSProperties =
    phase === 'busy'
      ? { background: busyBackground, ...(outlined ? { border: `1px solid ${busyBackground}` } : {}), color: 'white', cursor: 'wait' }
      : phase === 'done'
        ? { background: '#15803d', ...(outlined ? { border: '1px solid #15803d' } : {}), color: 'white', cursor: 'default' }
        : {}
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || phase !== 'idle'}
      data-action={action}
      data-action-phase={phase}
      aria-live="polite"
      style={{ position: 'relative', transition: 'background 0.15s, border-color 0.15s', ...style, ...fill }}
    >
      <span aria-hidden={phase !== 'idle'} style={{ visibility: phase === 'idle' ? 'visible' : 'hidden' }}>
        {children}
      </span>
      {phase !== 'idle' ? (
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {phase === 'busy' ? (
            <span aria-hidden style={{ width: 13, height: 13, flex: '0 0 auto', border: '2px solid rgba(255,255,255,0.45)', borderTopColor: 'white', borderRadius: '50%', animation: 'bid-resolve-spin 0.8s linear infinite' }} />
          ) : (
            <Check size={15} aria-hidden />
          )}
          {phase === 'busy' ? busyLabel : doneLabel}
        </span>
      ) : null}
    </button>
  )
}
