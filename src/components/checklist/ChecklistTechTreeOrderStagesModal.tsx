import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RoadmapStageNumberBadge } from './RoadmapStageNumberBadge'

export type OrderStagesOption = {
  id: string
  title: string
  /** Short status text after the title, e.g. "✓ done" / "3 of 8" / "🔒". */
  meta: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  /** Stages in their current order (top = #1). */
  groups: OrderStagesOption[]
  /** Persists the new order; return true to close. Parent reloads on success. */
  onSave: (orderedIds: string[]) => Promise<boolean>
  /** e.g. roadmap canvas in Fullscreen API — modals must mount inside the fullscreen element */
  portalContainer?: HTMLElement | null
}

function OrderStageRow({ id, index, title, meta, disabled }: { id: string; index: number; title: string; meta: string | null; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0.45rem 0.6rem',
        marginBottom: 6,
        border: `1px solid ${isDragging ? '#3b82f6' : 'var(--border-strong)'}`,
        borderRadius: 10,
        background: isDragging ? 'var(--bg-blue-tint)' : 'var(--surface)',
        boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.25)' : undefined,
        fontSize: '0.8125rem',
        cursor: disabled ? 'default' : 'grab',
        touchAction: 'none',
        zIndex: isDragging ? 1 : undefined,
        position: 'relative',
      }}
      {...attributes}
      {...listeners}
    >
      <span aria-hidden style={{ color: 'var(--text-muted)', letterSpacing: -1 }}>
        ⠿
      </span>
      <RoadmapStageNumberBadge n={index + 1} />
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={title}>
        {title}
      </span>
      {meta ? <span style={{ flex: 'none', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{meta}</span> : null}
    </li>
  )
}

/**
 * Reorder a roadmap's stages (v2.1941): drag rows, top stage is always #1,
 * numbers renumber live while dragging. Save persists sort_index 1..N and the
 * badges on Map and Plan follow.
 */
export function ChecklistTechTreeOrderStagesModal({ open, onClose, groups, onSave, portalContainer }: Props) {
  const [orderIds, setOrderIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    if (open) setOrderIds(groups.map((g) => g.id))
    // re-seed only when (re)opened; mid-edit external reloads shouldn't stomp the drag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])

  if (!open) return null

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrderIds((ids) => {
      const from = ids.indexOf(String(active.id))
      const to = ids.indexOf(String(over.id))
      if (from < 0 || to < 0) return ids
      return arrayMove(ids, from, to)
    })
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const ok = await onSave(orderIds)
      if (ok) onClose()
    } finally {
      setSaving(false)
    }
  }

  const target = typeof document !== 'undefined' ? (portalContainer ?? document.body) : null
  if (!target) return null

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
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-tree-order-stages-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 20,
          maxWidth: 460,
          width: '100%',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="tech-tree-order-stages-modal-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>
          Order stages
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: 12, color: 'var(--text-slate-500)' }}>
          Drag to reorder — the top stage is #1. Numbers update on the Map and Plan views when you save.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
            <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0 }}>
              {orderIds.map((id, i) => {
                const g = byId.get(id)
                if (!g) return null
                return <OrderStageRow key={id} id={id} index={i} title={g.title} meta={g.meta} disabled={saving} />
              })}
            </ul>
          </SortableContext>
        </DndContext>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save order'}
          </button>
        </div>
      </div>
    </div>,
    target,
  )
}
