import { useEffect, useId, type ReactNode } from 'react'
import { STICKY_MODAL_CLOSE_BUTTON_STYLE, STICKY_MODAL_INSET, stickyModalHeaderStyle } from '../lib/stickyModalHeaderStyle'

/**
 * Responsive modal shell (v2.1017): centered dialog on desktop, true full-screen
 * sheet on phones (≤640px — covers the app header and bottom tab bar entirely).
 * Sizing/keyboard behavior lives in the `.respModal*` classes in index.css
 * (dvh heights so the pinned footer stays reachable above the software
 * keyboard); this component owns structure and dismissal.
 *
 * - The PANEL is the scroller: sticky title bar (v2.990 pattern) and, when
 *   `footer` is given, a sticky bottom action bar — actions never require
 *   scrolling and never sit next to the app's tab bar.
 * - Escape and backdrop-click call `onRequestClose`; the caller decides what
 *   closing means (e.g. an unsaved-entries confirm), so guards live there.
 * - Footer buttons can submit a form inside `children` via the `form="<id>"`
 *   attribute — the footer renders outside any caller `<form>`.
 */
export default function ResponsiveModalShell({
  title,
  onRequestClose,
  children,
  footer,
  headerAction,
  maxWidthDesktop = 560,
  // Above the app's fixed bottom tab bar (z 1000) so the full-screen sheet truly
  // covers it; below the stacked leaf dialogs (Active Accounts 1200, PartForm 1300).
  zIndex = 1100,
}: {
  title: string
  onRequestClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Rendered in the sticky title bar, just before the close button (v2.2738: the Contract modal's "Upload signed contract"). */
  headerAction?: ReactNode
  maxWidthDesktop?: number
  zIndex?: number
}) {
  const titleId = useId()
  const inset = STICKY_MODAL_INSET.x

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onRequestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onRequestClose])

  return (
    <div
      className="respModalOverlay"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onRequestClose}
    >
      <div
        className="respModalPanel"
        onClick={(e) => e.stopPropagation()}
        onFocusCapture={(e) => {
          // Phone: nudge the focused field to mid-screen once the software
          // keyboard starts opening, so it never sits underneath it.
          const t = e.target as HTMLElement
          if (!window.matchMedia('(max-width: 640px)').matches) return
          if (!(t instanceof HTMLTextAreaElement) && !(t instanceof HTMLInputElement)) return
          window.setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150)
        }}
        style={{
          // No top padding (it lives on the sticky bar); no bottom padding when
          // a sticky footer carries it — a padded scroller otherwise leaves a
          // strip where content scrolls through past the pinned bar.
          padding: footer ? `0 ${inset} 0` : `0 ${inset} ${inset}`,
          boxSizing: 'border-box',
          width: `min(${maxWidthDesktop}px, 100%)`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', ...stickyModalHeaderStyle() }}>
          <h2 id={titleId} style={{ margin: 0, flex: 1, minWidth: 0 }}>{title}</h2>
          {headerAction ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>{headerAction}</div> : null}
          <button type="button" onClick={onRequestClose} style={STICKY_MODAL_CLOSE_BUTTON_STYLE} aria-label="Close">×</button>
        </div>
        {children}
        {footer && (
          <div
            className="respModalFooter"
            style={{ margin: `0 -${inset}`, paddingLeft: inset, paddingRight: inset }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
