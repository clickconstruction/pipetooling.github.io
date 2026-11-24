import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { footClearanceCss } from '../lib/bottomChrome'
import { JOB_MODE_PRESS_BAR_VAR } from '../lib/jobMode/pressBar'
import { toastActionPress, toastDismissPress } from '../lib/toastPress'

type ToastType = 'info' | 'warning' | 'error' | 'success'

export type ToastAnchor = { clientX: number; clientY: number }

/** When `anchor` is set, anchored positioning wins and `placement` is ignored. */
export type ToastPlacement = 'corner' | 'center'

/** One inline action on the toast (v2 Tier-2 #42): e.g. "Undo" after a bulk import. Clicking it also dismisses the toast. */
export type ToastAction = { label: string; onClick: () => void }

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  anchor?: ToastAnchor
  /** Default `corner` (top-right). Ignored when `anchor` is set. */
  placement?: ToastPlacement
  action?: ToastAction
  onClose: () => void
}

const MARGIN = 8
const MAX_WIDTH_PX = 400
/**
 * The phone's toast sits at the foot of the screen (punch list #414, v2.8359): a corner toast at the top of a phone
 * covered the heading of the card under it for as long as it showed. At the foot no heading is. It stands this far
 * above the bottom chrome: the tab bar while one is up (`--app-bottom-chrome`, which holds the home indicator's
 * inset), the Job Mode press bar pinned on it (`--job-mode-press-bar`, 0px when none is mounted), and the inset
 * alone with neither. The outbox bar is the app-health strip at the top of the page, in flow, so the foot is clear
 * of it. The section dock draws nothing at phone width.
 */
const FOOT_GAP_PX = 12
/** Fallback corner-toast top when there is no app header (login / public pages): 1rem. */
const CORNER_TOP_FALLBACK_PX = 16
const Z_CORNER = 9999
const Z_CENTER_BACKDROP = 10000
const Z_CENTER_CARD = 10001

function clampAnchoredPosition(clientX: number, clientY: number): { left: number; top: number } {
  if (typeof window === 'undefined') {
    return { left: clientX, top: clientY + 8 }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const estW = Math.min(MAX_WIDTH_PX, vw * 0.9)
  const estH = 72
  let left = clientX
  let top = clientY + 8
  left = Math.max(MARGIN, Math.min(left, vw - estW - MARGIN))
  top = Math.max(MARGIN, Math.min(top, vh - estH - MARGIN))
  return { left, top }
}

function refineAnchoredPosition(
  rect: DOMRect,
  prevLeft: number,
  prevTop: number,
): { left: number; top: number } | null {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = prevLeft
  let top = prevTop
  let changed = false
  if (rect.right > vw - MARGIN) {
    left += vw - MARGIN - rect.right
    changed = true
  }
  if (rect.bottom > vh - MARGIN) {
    top += vh - MARGIN - rect.bottom
    changed = true
  }
  if (rect.left < MARGIN) {
    left += MARGIN - rect.left
    changed = true
  }
  if (rect.top < MARGIN) {
    top += MARGIN - rect.top
    changed = true
  }
  if (!changed) return null
  left = Math.max(MARGIN, Math.min(left, vw - rect.width - MARGIN))
  top = Math.max(MARGIN, Math.min(top, vh - rect.height - MARGIN))
  return { left, top }
}

export function Toast({
  message,
  type = 'info',
  duration = 5000,
  anchor,
  placement = 'corner',
  action,
  onClose,
}: ToastProps) {
  const messageId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [anchoredPos, setAnchoredPos] = useState<{ left: number; top: number } | null>(() =>
    anchor ? clampAnchoredPosition(anchor.clientX, anchor.clientY) : null,
  )

  const anchorKey = anchor ? `${anchor.clientX},${anchor.clientY}` : ''

  // Corner toasts sit top-right at z-index 9999 — above the app header (z-50).
  // Offset them below the header so a toast can never cover header nav controls
  // (Map / Calendar / Settings). Measured from the real header (.appNavChrome)
  // so it adapts to mobile safe-area / impersonation-banner heights; falls back
  // to 1rem on pages without a header. When scrolled (header not at top), the
  // clamp keeps the toast near the top edge, which the header no longer occupies.
  const isCorner = !anchor && placement === 'corner'
  // On a phone the corner toast moves to the foot (punch list #414): the top of a phone is where every card's heading is.
  const phone = useIsMobile()
  const atFoot = isCorner && phone
  const [cornerTopPx, setCornerTopPx] = useState<number>(CORNER_TOP_FALLBACK_PX)
  useLayoutEffect(() => {
    if (!isCorner || atFoot || typeof document === 'undefined') return
    const measure = () => {
      const navEl = document.querySelector('.appNavChrome')
      const bottom = navEl ? navEl.getBoundingClientRect().bottom : 0
      setCornerTopPx(Math.max(Math.round(bottom) + MARGIN, CORNER_TOP_FALLBACK_PX))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isCorner, atFoot])

  useLayoutEffect(() => {
    if (!anchor) {
      setAnchoredPos(null)
      return
    }
    const next = clampAnchoredPosition(anchor.clientX, anchor.clientY)
    setAnchoredPos(next)
    const id = requestAnimationFrame(() => {
      const el = rootRef.current
      if (!el) return
      const refined = refineAnchoredPosition(el.getBoundingClientRect(), next.left, next.top)
      if (refined) setAnchoredPos(refined)
    })
    return () => cancelAnimationFrame(id)
  }, [anchorKey, message, anchor])

  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const colors = {
    info: { bg: '#3b82f6', border: '#2563eb' },
    warning: { bg: '#f59e0b', border: '#d97706' },
    error: { bg: '#ef4444', border: '#dc2626' },
    success: { bg: '#10b981', border: '#059669' },
  }

  const cardStyleBase = {
    background: colors[type].bg,
    color: 'white',
    padding: '1rem 1.5rem',
    borderRadius: '8px',
    border: `2px solid ${colors[type].border}`,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxWidth: `${MAX_WIDTH_PX}px`,
  } as const

  const body = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <span id={messageId} style={{ whiteSpace: 'pre-line' }}>
        {message}
      </span>
      {action ? (
        <button
          type="button"
          onClick={() => {
            action.onClick()
            onClose()
          }}
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.7)',
            color: 'white',
            borderRadius: 4,
            padding: '0.25rem 0.6rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            // A fingertip tall on a phone: Undo leaves with the toast, so it must be easy to hit.
            ...toastActionPress(phone),
          }}
        >
          {action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          fontSize: '1.5rem',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
          ...toastDismissPress(phone),
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )

  const keyframes = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideInAnchored {
          from {
            transform: translateX(-12px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes toastCenterIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        @keyframes toastFootIn {
          from {
            opacity: 0;
            transform: translate(-50%, 12px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `

  if (anchor) {
    const positionStyle = {
      position: 'fixed' as const,
      left: anchoredPos?.left ?? 0,
      top: anchoredPos?.top ?? 0,
      zIndex: Z_CORNER,
      animation: 'slideInAnchored 0.25s ease-out',
    }
    return (
      <div ref={rootRef} style={{ ...cardStyleBase, ...positionStyle }}>
        {body}
        <style>{keyframes}</style>
      </div>
    )
  }

  if (placement === 'center') {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.38)',
            zIndex: Z_CENTER_BACKDROP,
          }}
          onClick={onClose}
          aria-hidden
        />
        <div
          ref={rootRef}
          role="alertdialog"
          aria-modal="true"
          aria-describedby={messageId}
          style={{
            ...cardStyleBase,
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: Z_CENTER_CARD,
            animation: 'toastCenterIn 0.22s ease-out',
          }}
        >
          {body}
          <style>{keyframes}</style>
        </div>
      </>
    )
  }

  if (atFoot) {
    const footStyle = {
      position: 'fixed' as const,
      left: '50%',
      bottom: `calc(${footClearanceCss()} + var(${JOB_MODE_PRESS_BAR_VAR}, 0px) + ${FOOT_GAP_PX}px)`,
      transform: 'translateX(-50%)',
      width: `min(${MAX_WIDTH_PX}px, calc(100vw - 2rem))`,
      boxSizing: 'border-box' as const,
      zIndex: Z_CORNER,
      animation: 'toastFootIn 0.25s ease-out',
    }
    return (
      <div ref={rootRef} data-toast-foot="" style={{ ...cardStyleBase, ...footStyle }}>
        {body}
        <style>{keyframes}</style>
      </div>
    )
  }

  const cornerStyle = {
    position: 'fixed' as const,
    // On a Home Screen iPhone a page with no header, or one scrolled past it, starts under the status bar: never above it.
    top: `max(${cornerTopPx}px, calc(${CORNER_TOP_FALLBACK_PX}px + var(--app-top-chrome, 0px)))`,
    right: '1rem',
    zIndex: Z_CORNER,
    animation: 'slideIn 0.3s ease-out',
  }

  return (
    <div ref={rootRef} style={{ ...cardStyleBase, ...cornerStyle }}>
      {body}
      <style>{keyframes}</style>
    </div>
  )
}

// Toast manager hook
export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: ToastType }>>([])

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return { toasts, showToast, removeToast }
}
