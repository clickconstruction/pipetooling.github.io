import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type PendingTaskMove = {
  taskId: string
  taskTitle: string
  fromStageNumber: number
  fromStageTitle: string
  /** "51.2" — the task's number before the move. */
  wasLabel: string
  toGroupId: string
  toStageNumber: number
  toStageTitle: string
  /** "52.5" — the number it takes on arrival. */
  becomesLabel: string
  /** Persisted on confirm — the full renumbering computed at drop time. */
  updates: Array<{ id: string; group_id: string; sort_index: number }>
}

/**
 * Cross-stage drop confirmation (v2.2305): dropping a dragged task on a
 * DIFFERENT stage asks before anything changes — in-stage reorders never
 * come here. Cancel (button, backdrop, or Esc) leaves the roadmap untouched.
 */
export function ChecklistTechTreeMoveTaskModal({
  move,
  onConfirm,
  onCancel,
  portalContainer,
}: {
  move: PendingTaskMove | null
  onConfirm: () => Promise<void>
  onCancel: () => void
  /** Canvas fullscreen: modals must mount inside the fullscreen element. */
  portalContainer?: HTMLElement | null
}) {
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!move) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [move, onCancel])

  if (!move) return null
  const target = typeof document !== 'undefined' ? (portalContainer ?? document.body) : null
  if (!target) return null

  const stagePill = (n: number, title: string, sub: string) => (
    <span
      style={{
        background: 'var(--bg-blue-tint)',
        border: '1px solid #2563eb',
        borderRadius: 8,
        padding: '4px 10px',
        maxWidth: '45%',
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: 'block',
          fontSize: '0.8125rem',
          color: 'var(--text-strong)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {n > 0 ? `${n} ` : ''}
        {title}
      </span>
      <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{sub}</span>
    </span>
  )

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-tree-move-task-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          padding: 20,
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="tech-tree-move-task-title" style={{ margin: '0 0 10px', fontSize: '1rem' }}>
          Move this task?
        </h2>
        <p style={{ margin: '0 0 10px', fontSize: '0.875rem', color: 'var(--text-strong)', fontWeight: 600, lineHeight: 1.4 }}>
          {move.taskTitle}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {stagePill(move.fromStageNumber, move.fromStageTitle, `was ${move.wasLabel}`)}
          <span aria-hidden style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            →
          </span>
          {stagePill(move.toStageNumber, move.toStageTitle, `becomes ${move.becomesLabel}`)}
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          Keeps its people, notes, and history. Both stages renumber, and it follows the new stage's in-order rule.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setSaving(true)
              void onConfirm().finally(() => setSaving(false))
            }}
            disabled={saving}
            style={{
              background: '#2563eb',
              border: '1px solid #2563eb',
              color: '#fff',
              borderRadius: 8,
              padding: '6px 16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {saving ? 'Moving…' : 'Move task'}
          </button>
        </div>
      </div>
    </div>,
    target,
  )
}
