import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useVisualViewportBox } from '../../../hooks/useVisualViewportBox'
import { scrollTopToReveal, taskWindowPhoneFrame } from '../../../lib/tasks/taskWindowFrame'

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
 * keyboard. An iPhone also slides the page under a field that sits where the keyboard will be, which pushed the
 * card off the top of the screen, so the card follows the part that shows (`taskWindowPhoneFrame`) and the field
 * that has the keyboard is scrolled back into the form. At a desk the card is centered.
 */
export function TaskWindowShell({ titleId, title, subtitle, headActions, children, bar, phone, zIndex, overlayBackground = 'rgba(0,0,0,0.5)', onBackdrop, cardTestId }: Props) {
  const shows = useVisualViewportBox()
  const frame = taskWindowPhoneFrame(shows)
  const formRef = useRef<HTMLDivElement>(null)
  const showsHeight = shows?.height ?? null
  const showsTop = frame.top
  // The card has just changed size or place, so the field that has the keyboard may sit under the bar. Bring it back.
  useLayoutEffect(() => {
    const form = formRef.current
    const field = document.activeElement
    if (!phone || !form || !(field instanceof HTMLElement) || !form.contains(field)) return
    const box = form.getBoundingClientRect()
    const at = field.getBoundingClientRect()
    // A search box goes to the top of the form, so what it finds shows under it and not under the bar.
    const align = field.closest('[data-keyboard-reveal="top"]') ? 'top' : 'nearest'
    const next = scrollTopToReveal({ scrollTop: form.scrollTop, boxTop: box.top, boxBottom: box.bottom, fieldTop: at.top, fieldBottom: at.bottom, align })
    if (next !== form.scrollTop) form.scrollTop = next
  }, [phone, showsHeight, showsTop])
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
            ? { ...column, borderRadius: '0 0 14px 14px', width: '100%', marginTop: frame.top, maxHeight: frame.maxHeight, boxSizing: 'border-box' }
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
        <div ref={formRef} data-testid="new-task-form" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: `0 ${padX}` }}>
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
