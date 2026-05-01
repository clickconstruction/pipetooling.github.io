import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

type ToastType = 'info' | 'warning' | 'error' | 'success'

export type ToastAnchor = { clientX: number; clientY: number }

/** When `anchor` is set, anchored positioning wins and `placement` is ignored. */
export type ToastPlacement = 'corner' | 'center'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  anchor?: ToastAnchor
  /** Default `corner` (top-right). Ignored when `anchor` is set. */
  placement?: ToastPlacement
  onClose: () => void
}

const MARGIN = 8
const MAX_WIDTH_PX = 400
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
  onClose,
}: ToastProps) {
  const messageId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [anchoredPos, setAnchoredPos] = useState<{ left: number; top: number } | null>(() =>
    anchor ? clampAnchoredPosition(anchor.clientX, anchor.clientY) : null,
  )

  const anchorKey = anchor ? `${anchor.clientX},${anchor.clientY}` : ''

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

  const cornerStyle = {
    position: 'fixed' as const,
    top: '1rem',
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
