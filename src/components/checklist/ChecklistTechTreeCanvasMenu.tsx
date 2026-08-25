import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ParallelArrowsIcon } from './RoadmapParallelBadge'

export type CanvasMenuState =
  | {
      kind: 'stageMode'
      groupId: string
      groupTitle: string
      sequential: boolean
      x: number
      y: number
    }
  | {
      kind: 'edge'
      edgeId: string
      fromTitle: string
      toTitle: string
      x: number
      y: number
    }
  | {
      kind: 'pane'
      x: number
      y: number
      /** Top-left in flow space (centered on the pointer). */
      flowPosition: { x: number; y: number }
    }

type Props = {
  menu: CanvasMenuState
  onRemoveLink: (edgeId: string) => void
  onAddStage: (flowPosition: { x: number; y: number }) => void
  /** Stage-mode gear (v2.2266): write sequential (false = parallel). */
  onSetStageMode: (groupId: string, sequential: boolean) => void
  onClose: () => void
  /** Roadmap canvas in fullscreen — menu must mount inside the fullscreen element. */
  portalContainer?: HTMLElement | null
}

const MENU_WIDTH = 240

/**
 * Pointer menu for the roadmap Map canvas: click a prerequisite line →
 * "Remove link" (the menu header names both stages, so the menu itself is the
 * confirm step); right-click empty canvas → "Add stage here" (the new stage is
 * created at the pointer). One menu at a time; a transparent backdrop catches
 * the dismissing click, and Esc closes. Amber = create, red = remove — same
 * color language as the toolbar.
 */
export function ChecklistTechTreeCanvasMenu({ menu, onRemoveLink, onAddStage, onSetStageMode, onClose, portalContainer }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const target = typeof document !== 'undefined' ? (portalContainer ?? document.body) : null
  if (!target) return null

  const vw = window.innerWidth || 1024
  const vh = window.innerHeight || 768
  const left = Math.max(8, Math.min(menu.x + 2, vw - MENU_WIDTH - 8))
  const top = Math.max(8, Math.min(menu.y + 2, vh - 110))

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10040 }}
      onMouseDown={onClose}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div
        role="menu"
        aria-label={menu.kind === 'edge' ? 'Link actions' : menu.kind === 'stageMode' ? 'Stage mode' : 'Canvas actions'}
        style={{
          position: 'fixed',
          left,
          top,
          width: MENU_WIDTH,
          boxSizing: 'border-box',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 10,
          boxShadow: '0 10px 32px rgba(0,0,0,0.22)',
          padding: 5,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <style>{`
          .ttcm-item { display: flex; align-items: center; gap: 9px; width: 100%; box-sizing: border-box; border: none; background: none; border-radius: 7px; padding: 9px 10px; font-size: 0.84375rem; font-weight: 600; cursor: pointer; text-align: left; }
          .ttcm-item--danger { color: var(--text-red-700); }
          .ttcm-item--danger:hover { background: var(--bg-red-100); }
          .ttcm-item--add { color: #d97706; }
          .ttcm-item--add:hover { background: var(--bg-amber-tint); }
        `}</style>
        {menu.kind === 'stageMode' ? (
          <>
            <div
              style={{
                padding: '6px 10px 7px',
                fontSize: '0.71875rem',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                marginBottom: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              How tasks in <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{menu.groupTitle}</b> go out
            </div>
            <button
              type="button"
              role="menuitem"
              className="ttcm-item"
              style={menu.sequential ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' } : { color: 'var(--text-700)' }}
              onClick={() => onSetStageMode(menu.groupId, true)}
            >
              → In order, one at a time{menu.sequential ? ' ✓' : ''}
            </button>
            <button
              type="button"
              role="menuitem"
              className="ttcm-item"
              style={!menu.sequential ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' } : { color: 'var(--text-700)' }}
              onClick={() => onSetStageMode(menu.groupId, false)}
            >
              <ParallelArrowsIcon size={14} /> All at once (parallel){!menu.sequential ? ' ✓' : ''}
            </button>
            <div style={{ padding: '2px 10px 6px', fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {menu.sequential
                ? 'Only the next task sits on its assignee’s list.'
                : 'Every task goes to its assignee’s list immediately.'}
            </div>
          </>
        ) : menu.kind === 'edge' ? (
          <>
            {/* Two lines so long stage titles both survive — you must be able
                to read what you're cutting before you cut it. */}
            <div
              style={{
                padding: '6px 10px 7px',
                fontSize: '0.71875rem',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                marginBottom: 4,
                display: 'grid',
                gap: 2,
              }}
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{menu.fromTitle}</b>
              </span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                → <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{menu.toTitle}</b>
              </span>
            </div>
            <button type="button" role="menuitem" className="ttcm-item ttcm-item--danger" onClick={() => onRemoveLink(menu.edgeId)}>
              <svg width="15" height="15" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2s-6.3 25.5 4.1 33.7l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7l-210.9-165.3 74.5-74.5c56.2-56.2 56.2-147.4 0-203.6s-147.4-56.2-203.6 0l-70.9 70.9L38.8 5.1zM239 162.1l91.5-91.5c37.5-37.5 98.3-37.5 135.8 0s37.5 98.3 0 135.8l-82.9 82.9L239 162.1z" />
              </svg>
              Remove link
            </button>
          </>
        ) : (
          <button
            type="button"
            role="menuitem"
            className="ttcm-item ttcm-item--add"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => onAddStage(menu.flowPosition)}
          >
            <span aria-hidden="true" style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>＋</span>
            Add stage here
          </button>
        )}
      </div>
    </div>,
    target,
  )
}
