import type { CSSProperties, ReactNode } from 'react'
import { useVisualViewportHeight } from '../../../hooks/useVisualViewportHeight'

type Props = {
  /** The id of the title, which the dialog is labelled by. */
  titleId: string
  title: string
  /** A quiet line under the title, such as the stage a roadmap task joins. */
  subtitle?: ReactNode
  /** The presses at the right of the title: a second Send, a door, the ×. */
  headActions: ReactNode
  /** The form. It scrolls between the head and the bar. */
  children: ReactNode
  /** The bar with the sentence and Send. It never scrolls away. */
  bar: ReactNode
  phone: boolean
  zIndex: number
  overlayBackground?: string
  /** A press on the backdrop. Left out, a stray tap outside does nothing, so a draft is never thrown away. */
  onBackdrop?: () => void
  cardTestId?: string
}

/**
 * The frame of a task window (punch list #331): a column of the head, the form that scrolls, and the bar with Send.
 *
 * On a phone (v2.3188) the card docks to the top, under the status bar, edge to edge with rounded bottom corners. The
 * overlay keeps only the safe-area inset above (viewport-fit=cover makes env() real on iPhones; 0 elsewhere). Since
 * v2.7085 the card is no taller than the part of the screen the keyboard leaves, so the bar sits just above the
 * keyboard. At a desk the card is centered.
 */
export function TaskWindowShell({ titleId, title, subtitle, headActions, children, bar, phone, zIndex, overlayBackground = 'rgba(0,0,0,0.5)', onBackdrop, cardTestId }: Props) {
  const keyboardRoom = useVisualViewportHeight()
  const overlayPadding = phone ? 'env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px)' : 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))'
  const padX = phone ? '1rem' : '1.25rem'
  const column: CSSProperties = { display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{ position: 'fixed', padding: overlayPadding, inset: 0, background: overlayBackground, display: 'flex', alignItems: phone ? 'flex-start' : 'center', justifyContent: 'center', zIndex }}
      onClick={onBackdrop}
    >
      <div
        data-testid={cardTestId}
        style={
          phone
            ? { ...column, borderRadius: '0 0 14px 14px', width: '100%', maxHeight: keyboardRoom ? `min(100%, calc(${Math.round(keyboardRoom)}px - env(safe-area-inset-top, 0px)))` : '100%', boxSizing: 'border-box' }
            : { ...column, borderRadius: 12, maxWidth: 480, width: '90%', maxHeight: 'min(90vh, 100%)' }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: phone ? `0.75rem ${padX} 0.4rem` : `1.1rem ${padX} 0.4rem` }}>
          <div style={{ minWidth: 0 }}>
            <h3 id={titleId} style={{ margin: 0 }}>
              {title}
            </h3>
            {subtitle ? <div style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>{headActions}</div>
        </div>
        <div data-testid="new-task-form" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: `0 ${padX}` }}>
          {children}
        </div>
        <div style={{ flex: 'none', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', padding: `0.6rem ${padX} 0.8rem` }}>{bar}</div>
      </div>
    </div>
  )
}

/** The × at the top of a task window. */
export function TaskWindowClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      title="Close"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', padding: '0.25rem', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}
    >
      ×
    </button>
  )
}
