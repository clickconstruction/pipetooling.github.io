import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Drilldown modal shell for the Team Summary surface.
 *
 * Renders into a `<div>` appended to `document.body` so the modal sits
 * above any z-stacked parent (`People` is wrapped in several positioned
 * panels) and so the print-CSS scoping rules in `teamSummaryPrintCss`
 * — which hide everything outside the team-summary section — leave the
 * modal portal alone when the user prints from inside.
 *
 * Two print modes are supported and live as siblings inside `<body>`:
 *   - Whole-table print: caller adds `body.printing-team-summary`; we are
 *     not the print target so we set `display:none` via the same class.
 *   - Modal-only print: the modal's Print button sets
 *     `body.printing-team-summary-modal` and calls `window.print()`;
 *     `teamSummaryPrintCss` hides every other root-level child so only
 *     the modal body shows.
 *
 * Esc closes; clicking the backdrop closes; focus moves to the close
 * button on open and returns to the trigger element on close (the
 * caller passes `triggerEl` so we don't have to walk the activeElement
 * chain at close time).
 */
export function TeamSummaryDrilldownModal(props: {
  title: string
  open: boolean
  onClose: () => void
  /**
   * Optional trigger element to return focus to on close. Passing
   * `document.activeElement` is the simplest source; falling back to
   * doing nothing is fine for keyboard users hitting Esc.
   */
  triggerEl: HTMLElement | null
  /**
   * Notifies the parent before/after a drilldown is open so the
   * autorefresh effect can defer re-loading the data while the user is
   * reading a breakdown (avoids the body disappearing mid-read).
   * Optional — the parent uses these to manage `teamSummaryRefreshPending`
   * the same way the iframe version did via postMessage.
   */
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}) {
  const { title, open, onClose, triggerEl, onOpenChange, children } = props
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const portalElRef = useRef<HTMLDivElement | null>(null)

  // Stable portal root — created once per modal mount, removed on
  // unmount, so a parent re-render doesn't blow away the open modal.
  // useLayoutEffect (not useEffect) so the portal target is attached
  // before the first paint; otherwise createPortal renders into a
  // detached node on first render and the modal flashes blank.
  useLayoutEffect(() => {
    const el = document.createElement('div')
    el.className = 'team-summary-modal-portal'
    document.body.appendChild(el)
    portalElRef.current = el
    return () => {
      try {
        document.body.removeChild(el)
      } catch {
        /* element already gone (e.g. SSR or test teardown) */
      }
      portalElRef.current = null
    }
  }, [])

  // Notify parent on open/close. Done as a useEffect so the parent's
  // refresh-deferral runs after React commits, never inside a render.
  useEffect(() => {
    if (!onOpenChange) return
    onOpenChange(open)
  }, [open, onOpenChange])

  // Esc-to-close + focus management. Body scroll lock kept off
  // intentionally so the parent page can still scroll under a tall
  // modal on narrow viewports (the modal itself is `max-height: 85vh`
  // with internal overflow).
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Defensive cleanup mirroring the iframe version: if a modal-only
      // print was cancelled (no afterprint), the body class would
      // linger and break the screen view. Always strip it on close.
      document.body.classList.remove('printing-team-summary-modal')
      onClose()
    }
    document.addEventListener('keydown', onKey)
    // Move focus to the close button so screen-reader / keyboard users
    // land inside the dialog. Defer one tick so the portal has painted.
    const t = window.setTimeout(() => {
      try {
        closeBtnRef.current?.focus()
      } catch {
        /* portal unmounted before focus could land — ignore */
      }
    }, 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open, onClose])

  // Restore focus to the cell that opened us. Done as a separate
  // effect so it fires on close even if the trigger element was
  // captured in a stale render.
  const prevOpenRef = useRef(open)
  useEffect(() => {
    if (prevOpenRef.current && !open && triggerEl) {
      try {
        triggerEl.focus()
      } catch {
        /* trigger removed from DOM — focus default (body) */
      }
    }
    prevOpenRef.current = open
  }, [open, triggerEl])

  function handlePrint() {
    document.body.classList.add('printing-team-summary-modal')
    function onAfterPrint() {
      document.body.classList.remove('printing-team-summary-modal')
      window.removeEventListener('afterprint', onAfterPrint)
    }
    window.addEventListener('afterprint', onAfterPrint)
    try {
      window.print()
    } catch {
      document.body.classList.remove('printing-team-summary-modal')
    }
  }

  if (!open || !portalElRef.current) return null
  return createPortal(
    <div className="team-summary-modal-root">
      <div
        className="team-summary-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="team-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-summary-modal-title"
      >
        <div className="team-summary-modal-header">
          <h2 id="team-summary-modal-title">{title}</h2>
          <div className="team-summary-modal-header-actions">
            <button
              type="button"
              className="team-summary-modal-print"
              onClick={handlePrint}
              aria-label="Print this breakdown"
              title="Print only this breakdown"
            >
              Print
            </button>
            <button
              ref={closeBtnRef}
              type="button"
              className="team-summary-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="team-summary-modal-body">{children}</div>
      </div>
    </div>,
    portalElRef.current,
  )
}
