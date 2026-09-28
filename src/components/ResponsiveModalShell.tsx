import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { STICKY_MODAL_CLOSE_BUTTON_STYLE, STICKY_MODAL_INSET, stickyModalHeaderStyle } from '../lib/stickyModalHeaderStyle'
import { modalFullScreenToggleLabel, readModalFullScreen, writeModalFullScreen } from '../lib/modalFullScreen'
import { useIsMobile } from '../hooks/useIsMobile'
import { ModalFullScreenIcon } from './icons/ModalFullScreenIcon'

/** What the children get when they are a function: whether the dialog is filling the screen right now. */
export type ResponsiveModalShellState = { fullScreen: boolean }

/** The toggle's chrome — the ⋯ header menu's, so the two read as one row of controls. */
const FULL_SCREEN_BUTTON_STYLE: CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: 6,
  padding: '0.35rem 0.6rem',
  cursor: 'pointer',
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 32,
}

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
 * - `fullScreenKey` (v2.4045) puts a toggle in the title bar, before
 *   `headerAction`: the dialog jumps between its window and the whole screen,
 *   and the choice is remembered per key on this device
 *   (`src/lib/modalFullScreen.ts`). Phones are already full screen, so the
 *   button is not shown there. Children may be a function of
 *   `{ fullScreen }` to lay themselves out for the room they have.
 */
export default function ResponsiveModalShell({
  title,
  onRequestClose,
  children,
  footer,
  headerAction,
  fullScreenKey,
  maxWidthDesktop = 560,
  // Above the app's fixed bottom tab bar (z 1000) so the full-screen sheet truly
  // covers it; below the stacked leaf dialogs (Active Accounts 1200, PartForm 1300).
  zIndex = 1100,
}: {
  title: string
  onRequestClose: () => void
  children: ReactNode | ((state: ResponsiveModalShellState) => ReactNode)
  footer?: ReactNode
  /** Rendered in the sticky title bar, just before the close button (v2.2738: the Contract modal's "Upload signed contract"). */
  headerAction?: ReactNode
  /** Names this modal's remembered full-screen choice (`'contract-sweep'`); omitted, there is no toggle. */
  fullScreenKey?: string
  maxWidthDesktop?: number
  zIndex?: number
}) {
  const titleId = useId()
  const inset = STICKY_MODAL_INSET.x
  const isMobile = useIsMobile()
  const [fullScreenChoice, setFullScreenChoice] = useState(() => (fullScreenKey ? readModalFullScreen(fullScreenKey) : false))
  // A phone is the full-screen sheet already; the choice waits for a desktop.
  const fullScreen = Boolean(fullScreenKey) && !isMobile && fullScreenChoice
  const toggleFullScreen = () => {
    if (!fullScreenKey) return
    const next = !fullScreenChoice
    setFullScreenChoice(next)
    writeModalFullScreen(fullScreenKey, next)
  }
  /** v2.3723: where the press began. A click that starts on a button in the panel and ends on the backdrop —
   *  the panel reflowed under the pointer (a field committing on blur) — is not a request to close; it used
   *  to throw a half-filled sheet away. Only a press that began on the backdrop closes. */
  const downOnBackdrop = useRef(false)

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
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        const began = downOnBackdrop.current
        downOnBackdrop.current = false
        if (began && e.target === e.currentTarget) onRequestClose()
      }}
    >
      <div
        className={fullScreen ? 'respModalPanel respModalPanelFull' : 'respModalPanel'}
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
          width: fullScreen ? '100%' : `min(${maxWidthDesktop}px, 100%)`,
          // v2.4049: full screen, the panel is a column and the children's box is the room left
          // between the bars, so a modal can fill the height instead of scrolling through it.
          ...(fullScreen ? { display: 'flex', flexDirection: 'column' } : {}),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', ...stickyModalHeaderStyle() }}>
          <h2 id={titleId} style={{ margin: 0, flex: 1, minWidth: 0 }}>{title}</h2>
          {fullScreenKey && !isMobile ? (
            <button
              type="button"
              onClick={toggleFullScreen}
              style={{ ...FULL_SCREEN_BUTTON_STYLE, background: fullScreen ? 'var(--bg-muted)' : 'var(--surface)' }}
              aria-label={modalFullScreenToggleLabel(fullScreen)}
              aria-pressed={fullScreen}
              title={modalFullScreenToggleLabel(fullScreen)}
              data-testid="modal-full-screen-toggle"
            >
              <ModalFullScreenIcon fullScreen={fullScreen} />
            </button>
          ) : null}
          {headerAction ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>{headerAction}</div> : null}
          <button type="button" onClick={onRequestClose} style={STICKY_MODAL_CLOSE_BUTTON_STYLE} aria-label="Close">×</button>
        </div>
        {/* Always one box around the children, so the toggle never remounts them (a typed field survives it). */}
        <div style={fullScreen ? { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined} data-testid="modal-body">
          {typeof children === 'function' ? children({ fullScreen }) : children}
        </div>
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
