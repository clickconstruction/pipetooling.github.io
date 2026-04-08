import type { CSSProperties, RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MIN_MENU_WIDTH = 108
const FALLBACK_MENU_HEIGHT = 60
const VIEWPORT_PAD = 8

const plusCopyMenuItemStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.28rem 0.4rem',
  fontSize: '0.65rem',
  border: 'none',
  background: '#fff',
  color: '#1e3a8a',
  cursor: 'pointer',
  textAlign: 'left',
}

export type ScheduleDispatchPlusCopyMenuProps = {
  open: boolean
  anchorRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onLinkedCopy: () => void
  onSoloCopy: () => void
  /** Default 200: above sticky grid headers, below schedule modals. */
  zIndex?: number
}

function computeMenuPosition(
  anchor: DOMRectReadOnly,
  menuWidth: number,
  menuHeight: number,
): { top: number; left: number } {
  const margin = 2
  let top = anchor.top - menuHeight - margin
  let left = anchor.right - menuWidth

  if (top < VIEWPORT_PAD) {
    top = anchor.bottom + margin
  }

  left = Math.min(Math.max(left, VIEWPORT_PAD), window.innerWidth - menuWidth - VIEWPORT_PAD)
  const maxTop = window.innerHeight - menuHeight - VIEWPORT_PAD
  if (top > maxTop) {
    top = Math.max(VIEWPORT_PAD, maxTop)
  }

  return { top, left }
}

function renderPosition(
  pos: { top: number; left: number } | null,
  anchor: HTMLButtonElement | null,
): { top: number; left: number } {
  if (pos != null) return pos
  if (anchor == null) return { top: 0, left: 0 }
  return computeMenuPosition(anchor.getBoundingClientRect(), MIN_MENU_WIDTH, FALLBACK_MENU_HEIGHT)
}

export function ScheduleDispatchPlusCopyMenu({
  open,
  anchorRef,
  onClose,
  onLinkedCopy,
  onSoloCopy,
  zIndex = 200,
}: ScheduleDispatchPlusCopyMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const updatePosition = useCallback(() => {
    if (!open) return
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const menuEl = menuRef.current
    const mw = Math.max(menuEl?.offsetWidth ?? MIN_MENU_WIDTH, MIN_MENU_WIDTH)
    const mh = Math.max(menuEl?.offsetHeight ?? FALLBACK_MENU_HEIGHT, 1)
    setPos(computeMenuPosition(rect, mw, mh))
  }, [open, anchorRef])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePosition()
    const id = requestAnimationFrame(() => updatePosition())
    return () => cancelAnimationFrame(id)
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => updatePosition()
    document.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      onClose()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  const stylePos = renderPosition(pos, anchorRef.current)

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        top: stylePos.top,
        left: stylePos.left,
        zIndex,
        minWidth: MIN_MENU_WIDTH,
        borderRadius: 4,
        border: '1px solid #93c5fd',
        background: '#f8fafc',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        style={{ ...plusCopyMenuItemStyle, borderBottom: '1px solid #e2e8f0' }}
        onClick={(e) => {
          e.stopPropagation()
          onLinkedCopy()
        }}
      >
        Linked copy
      </button>
      <button
        type="button"
        role="menuitem"
        style={plusCopyMenuItemStyle}
        onClick={(e) => {
          e.stopPropagation()
          onSoloCopy()
        }}
      >
        Solo copy
      </button>
    </div>,
    document.body,
  )
}
