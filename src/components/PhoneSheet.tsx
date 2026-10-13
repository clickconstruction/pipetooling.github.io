import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { useModalStackEntry } from '../hooks/useModalStackEntry'
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight'

/** Where a window becomes a sheet: the phone width the thread window fills the screen at (`ThreadWindow.tsx`). */
export const PHONE_SHEET_QUERY = '(max-width: 760px)'

const BACKDROP = 'rgba(15, 23, 42, 0.35)'

/**
 * A window that is a centred box at a desk and a sheet from the bottom on a phone (Messages cut 10, the cut list's P2,
 * `phone-mockups.html` screen 1c). The windows drawn inside a person's thread use it: the message window, Who is this?,
 * the job picker and the ⋯ menu. At a desk it draws the frame those windows drew themselves: the backdrop at z 1300,
 * the panel `min(width, 100%)` wide, the title row with ×. On a phone the panel rises from the bottom at full width with
 * a grab bar, scrolls inside at most 85% of the room, and keeps above the software keyboard: the backdrop is as tall as
 * the visual viewport, the room the keyboard leaves, so the sheet's foot sits on the keyboard's top.
 *
 * The caller's children are the body, which scrolls itself. Escape closes only the window on top (`useModalStackEntry`)
 * and is marked handled, so the thread window behind stays open. A press on the backdrop stops there before it closes,
 * so a sheet drawn inside another window's panel never closes that window too (the nested-windows check).
 */
export function PhoneSheet({
  label,
  title,
  width = 520,
  maxHeight = '90vh',
  zIndex = 1300,
  dataAttrs,
  onClose,
  children,
}: {
  /** The dialog's name for a screen reader. */
  label: string
  /** The title row's heading. Absent: no title row (the ⋯ menu), and on a phone only the grab bar. */
  title?: ReactNode
  /** The box's width at a desk, in px. */
  width?: number
  /** The box's tallest at a desk, clamped to the room the backdrop leaves. */
  maxHeight?: string
  zIndex?: number
  /** The window's own marks, `data-message-window` and the like. */
  dataAttrs?: Readonly<Record<`data-${string}`, string>>
  onClose: () => void
  children: ReactNode
}) {
  const phone = useMatchMedia(PHONE_SHEET_QUERY)
  const keyboardRoom = useVisualViewportHeight()
  const isTopmost = useModalStackEntry()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !isTopmost()) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose, isTopmost])

  const backdrop: CSSProperties = phone
    ? { position: 'fixed', top: 0, left: 0, right: 0, height: keyboardRoom ? `${keyboardRoom}px` : '100%', background: BACKDROP, zIndex, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 'var(--app-top-chrome, 0px) 0 0' }
    : { position: 'fixed', inset: 0, background: BACKDROP, zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }
  const panel: CSSProperties = phone
    ? {
        background: 'var(--surface)',
        color: 'var(--text-base)',
        width: '100%',
        maxHeight: '85%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '14px 14px 0 0',
        borderTop: '1px solid var(--border-strong)',
        boxShadow: '0 -10px 30px rgba(15, 23, 42, 0.18)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }
    : { background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: `min(${width}px, 100%)`, maxHeight: `min(${maxHeight}, 100%)`, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }

  return (
    <div
      data-phone-sheet={phone ? 'sheet' : 'window'}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      style={backdrop}
    >
      <div role="dialog" aria-modal="true" aria-label={label} {...dataAttrs} onClick={(e) => e.stopPropagation()} style={panel}>
        {phone && <span aria-hidden="true" style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0.5rem auto 0.1rem', flex: 'none' }} />}
        {title !== undefined && (
          <div style={{ padding: phone ? '0.35rem 1rem 0.6rem' : '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flex: 'none' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', minWidth: 0 }}>{title}</h2>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
