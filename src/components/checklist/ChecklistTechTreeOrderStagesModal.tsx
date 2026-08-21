import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RoadmapStageNumberBadge, RoadmapTaskNumber } from './RoadmapStageNumberBadge'

export type OrderStagesOption = {
  id: string
  title: string
  /** Short status text after the title, e.g. "✓ done" / "3 of 8" / "🔒". */
  meta: string | null
  /** The stage's tasks in their current order (v2.1964: orderable inline). */
  tasks: Array<{ id: string; title: string; done: boolean }>
}

type Props = {
  open: boolean
  onClose: () => void
  /** Stages in their current order (top = #1). */
  groups: OrderStagesOption[]
  /** Persists both orders; return true to close. Parent reloads on success. */
  onSave: (orderedStageIds: string[], taskOrdersByGroup: ReadonlyMap<string, string[]>) => Promise<boolean>
  /** e.g. roadmap canvas in Fullscreen API — modals must mount inside the fullscreen element */
  portalContainer?: HTMLElement | null
}

// dnd ids share one DndContext, so stage and task ids wear prefixes
const stageDndId = (id: string) => `g:${id}`
const taskDndId = (id: string) => `t:${id}`
const stripDndId = (id: string) => id.slice(2)

function OrderStageRow({
  id,
  index,
  title,
  meta,
  taskCount,
  expanded,
  onToggleExpanded,
  disabled,
}: {
  id: string
  index: number
  title: string
  meta: string | null
  taskCount: number
  expanded: boolean
  onToggleExpanded: () => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stageDndId(id), disabled })
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '0.45rem 0.6rem',
        marginBottom: 6,
        border: `1px solid ${isDragging ? '#3b82f6' : 'var(--border-strong)'}`,
        borderRadius: 10,
        background: isDragging ? 'var(--bg-blue-tint)' : 'var(--surface)',
        boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.3)' : undefined,
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
      <button
        type="button"
        onClick={onToggleExpanded}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={taskCount === 0}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse tasks of ${title}` : `Order tasks of ${title}`}
        style={{
          flex: 'none',
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: 'transparent',
          color: taskCount === 0 ? 'var(--border-strong)' : 'var(--text-muted)',
          cursor: taskCount === 0 ? 'default' : 'pointer',
          fontSize: '0.7rem',
          padding: 0,
        }}
      >
        {expanded ? '▾' : '▸'}
      </button>
      <RoadmapStageNumberBadge n={index + 1} />
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={title}>
        {title}
      </span>
      {meta ? <span style={{ flex: 'none', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{meta}</span> : null}
    </li>
  )
}

function OrderTaskRow({ id, label, title, done, disabled }: { id: string; label: string; title: string; done: boolean; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: taskDndId(id), disabled })
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0.32rem 0.6rem',
        marginBottom: 4,
        border: `1px solid ${isDragging ? '#3b82f6' : 'var(--border)'}`,
        borderRadius: 8,
        background: isDragging ? 'var(--bg-blue-tint)' : 'var(--bg-slate-tint)',
        boxShadow: isDragging ? '0 6px 16px rgba(0,0,0,0.25)' : undefined,
        fontSize: '0.78rem',
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
      <RoadmapTaskNumber label={label} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          color: done ? 'var(--text-muted)' : 'var(--text-700)',
          textDecoration: done ? 'line-through' : undefined,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={title}
      >
        {title}
      </span>
    </li>
  )
}

/**
 * Reorder a roadmap's stages and, per stage, its tasks (v2.1941; nested task
 * lists v2.1964): drag stage rows as before, expand a stage to drag its
 * tasks. Numbers renumber live — top stage is #1, its top task is #N.1.
 * Task moves stay within their stage; cross-stage moves live on the Map's
 * Edit-Tasks drag. Save persists both sort_index orders and every badge on
 * Map and Plan follows.
 */
export function ChecklistTechTreeOrderStagesModal({ open, onClose, groups, onSave, portalContainer }: Props) {
  const [orderIds, setOrderIds] = useState<string[]>([])
  const [taskOrders, setTaskOrders] = useState<Map<string, string[]>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    if (open) {
      setOrderIds(groups.map((g) => g.id))
      setTaskOrders(new Map(groups.map((g) => [g.id, g.tasks.map((t) => t.id)])))
      setExpanded(new Set())
    }
    // re-seed only when (re)opened; mid-edit external reloads shouldn't stomp the drag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const taskById = useMemo(() => {
    const m = new Map<string, { title: string; done: boolean; groupId: string }>()
    for (const g of groups) for (const t of g.tasks) m.set(t.id, { title: t.title, done: t.done, groupId: g.id })
    return m
  }, [groups])

  if (!open) return null

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const a = String(active.id)
    const o = String(over.id)
    if (a.startsWith('g:') && o.startsWith('g:')) {
      setOrderIds((ids) => {
        const from = ids.indexOf(stripDndId(a))
        const to = ids.indexOf(stripDndId(o))
        if (from < 0 || to < 0) return ids
        return arrayMove(ids, from, to)
      })
      return
    }
    if (a.startsWith('t:') && o.startsWith('t:')) {
      const aTask = taskById.get(stripDndId(a))
      const oTask = taskById.get(stripDndId(o))
      if (!aTask || !oTask || aTask.groupId !== oTask.groupId) return
      const gid = aTask.groupId
      setTaskOrders((prev) => {
        const ids = prev.get(gid) ?? []
        const from = ids.indexOf(stripDndId(a))
        const to = ids.indexOf(stripDndId(o))
        if (from < 0 || to < 0) return prev
        const next = new Map(prev)
        next.set(gid, arrayMove(ids, from, to))
        return next
      })
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const ok = await onSave(orderIds, taskOrders)
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
          maxWidth: 480,
          width: '100%',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="tech-tree-order-stages-modal-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>
          Order stages &amp; tasks
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: 12, color: 'var(--text-slate-500)' }}>
          Drag to reorder — the top stage is #1, its top task is #1.1. Expand a stage (▸) to order its tasks.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={orderIds.map(stageDndId)} strategy={verticalListSortingStrategy}>
            <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0 }}>
              {orderIds.map((gid, i) => {
                const g = byId.get(gid)
                if (!g) return null
                const taskIds = taskOrders.get(gid) ?? []
                const isOpen = expanded.has(gid)
                return (
                  <li key={gid} style={{ listStyle: 'none' }}>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      <OrderStageRow
                        id={gid}
                        index={i}
                        title={g.title}
                        meta={g.meta}
                        taskCount={taskIds.length}
                        expanded={isOpen}
                        onToggleExpanded={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev)
                            if (next.has(gid)) next.delete(gid)
                            else next.add(gid)
                            return next
                          })
                        }
                        disabled={saving}
                      />
                    </ul>
                    {isOpen ? (
                      <SortableContext items={taskIds.map(taskDndId)} strategy={verticalListSortingStrategy}>
                        <ul style={{ listStyle: 'none', margin: '0 0 6px 26px', padding: 0 }}>
                          {taskIds.map((tid, ti) => {
                            const t = taskById.get(tid)
                            if (!t) return null
                            return <OrderTaskRow key={tid} id={tid} label={`${i + 1}.${ti + 1}`} title={t.title} done={t.done} disabled={saving} />
                          })}
                        </ul>
                      </SortableContext>
                    ) : null}
                  </li>
                )
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
