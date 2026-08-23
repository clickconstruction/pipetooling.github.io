import { useCallback, useRef, type CSSProperties, type ReactNode } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pencil, Plus, ChevronDown, ChevronRight, GripVertical, Lock } from 'lucide-react'
import type { StageBadge } from '../../lib/roadmapBridge'
import { techTreeEmptyGroupDropId } from '../../lib/techTreeTaskOrder'
import { RoadmapStageNumberBadge, RoadmapTaskNumber } from './RoadmapStageNumberBadge'

/**
 * The Map's React Flow custom node and its row components (extracted verbatim
 * from ChecklistTechTreeTab in v2.2156 — sub-decomposition move 2): the stage
 * cluster card (`GroupNode`) with its badge row (done / N of M / locked /
 * not planned yet / ⚡ next up), the static task rows and the dnd-kit reorder
 * rows, the long-press-to-edit title, the ⚡/★ and bridge chips, and the empty
 * group drop target. They talk to the tab only through `GroupNodeData`.
 */
export type GroupNodeData = {
  groupId: string
  title: string
  /** 1-based position in the roadmap's stage order; matches the Plan view. */
  stageNumber: number
  locked: boolean
  collapsed: boolean
  taskCount: number
  /** Progress badge: "✓ done" / "N of M done"; null for empty stages. */
  badge: StageBadge
  /** Task-less stage with no prerequisites — "not planned yet" (v2.2127). */
  unplanned: boolean
  /** How many of this stage's tasks are on the Plan's ⚡ Next up shortlist (v2.2138). */
  nextUpCount: number
  /** Locked stages only: "Unlocks when … is done" / auto-assign wording. */
  lockedHint: string | null
  onToggleCollapse: () => void
  tasks: Array<{
    id: string
    title: string
    /** "4.2" — stage number + position (v2.1964). */
    numberLabel: string
    completedAt: string | null
    assigneeLabel: string
    canAct: boolean
    bridgeChip: 'in_review' | 'signed_off' | 'on_list' | null
    /** On the Plan's ⚡ Next up shortlist (v2.2138). */
    nextUp: boolean
    /** ★ pinned (v2.2140) — leads the shortlist. */
    pinned: boolean
  }>
  onToggle: (taskId: string) => void
  canEditStructure: boolean
  onOpenGroupSettings: (groupId: string) => void
  onOpenAddTask: (groupId: string) => void
  /** When set, list uses drag-and-drop; only when canEditStructure. */
  reorderMode: boolean
  onEditTask: (taskId: string) => void
  /** When set, group title / task rows use search hit styling. */
  searchIsActive: boolean
  searchGroupTitleMatch: boolean
  /** Task ids in this group that match the roadmap search. */
  searchMatchingTaskIds: string[]
}

type GroupTask = GroupNodeData['tasks'][0]

/** ⚡ / ★ markers for tasks on the Plan's Next up shortlist (v2.2138) and pinned tasks (v2.2140) — static and reorder rows. */
function TaskNextUpSpan({ on, pinned }: { on: boolean; pinned?: boolean }) {
  if (!on && !pinned) return null
  return (
    <span
      className="nodrag"
      title={pinned ? 'Pinned — leads the Plan\'s ⚡ Next up shortlist' : "On the Plan's ⚡ Next up shortlist"}
      aria-label={pinned ? 'Pinned, next up' : 'Next up'}
      style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-amber-800)', verticalAlign: 'middle' }}
    >
      {pinned ? '★' : '⚡'}
    </span>
  )
}

/** Live bridge status chip on a task row — shared by the static and reorder rows. */
function TaskBridgeChipSpan({ chip }: { chip: GroupTask['bridgeChip'] }) {
  if (!chip) return null
  return (
    <span
      className="nodrag"
      style={{
        marginLeft: 5,
        fontSize: 10,
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: 6,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
        ...(chip === 'in_review'
          ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }
          : chip === 'signed_off'
            ? { background: '#16a34a', color: 'white' }
            : { background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }),
      }}
    >
      {chip === 'in_review' ? 'in review' : chip === 'signed_off' ? 'signed off' : 'on list'}
    </span>
  )
}

function TechTreeEmptyGroupDrop({ groupId, visible }: { groupId: string; visible: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: techTreeEmptyGroupDropId(groupId) })
  if (!visible) return null
  return (
    <div
      ref={setNodeRef}
      className="nodrag nopan"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        minHeight: 32,
        marginTop: 4,
        borderRadius: 4,
        border: `1px dashed ${isOver ? '#3b82f6' : '#cbd5e1'}`,
        background: isOver ? 'rgba(59,130,246,0.08)' : 'rgba(148,163,184,0.12)',
        fontSize: 12,
        color: 'var(--text-slate-500)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        boxSizing: 'border-box',
      }}
    >
      Drop to move a task here
    </div>
  )
}

const TASK_TITLE_LONG_PRESS_MS = 500
const TASK_TITLE_LONG_PRESS_MOVE_PX = 10

function TechTreeEditableTaskTitle({
  taskId,
  canEdit,
  onEditTask,
  children,
}: {
  taskId: string
  canEdit: boolean
  onEditTask: (taskId: string) => void
  children: ReactNode
}) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressNextClickRef = useRef(false)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressStartRef.current = null
  }, [])

  if (!canEdit) {
    return <span className="nodrag">{children}</span>
  }

  return (
    <span
      className="nodrag"
      style={{
        cursor: 'text',
        userSelect: 'text' as const,
        touchAction: 'manipulation' as const,
      }}
      title="Press and hold to open"
      onClick={(e) => {
        if (suppressNextClickRef.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        longPressStartRef.current = { x: e.clientX, y: e.clientY }
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null
          longPressStartRef.current = null
          suppressNextClickRef.current = true
          onEditTask(taskId)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              suppressNextClickRef.current = false
            })
          })
        }, TASK_TITLE_LONG_PRESS_MS)
      }}
      onPointerMove={(e) => {
        if (!longPressStartRef.current) return
        const { x, y } = longPressStartRef.current
        const dx = e.clientX - x
        const dy = e.clientY - y
        if (dx * dx + dy * dy > TASK_TITLE_LONG_PRESS_MOVE_PX * TASK_TITLE_LONG_PRESS_MOVE_PX) {
          clearLongPress()
        }
      }}
      onPointerUp={() => clearLongPress()}
      onPointerCancel={() => clearLongPress()}
      onPointerLeave={() => clearLongPress()}
    >
      {children}
    </span>
  )
}

function TechTreeDndTaskRow({
  task,
  onToggle,
  onEditTask,
  canEditTaskTitle,
  canAct,
  disabled,
  searchRowHighlight = false,
}: {
  task: GroupTask
  onToggle: (id: string) => void
  onEditTask: (taskId: string) => void
  canEditTaskTitle: boolean
  canAct: boolean
  disabled: boolean
  searchRowHighlight?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const cbId = `tt-task-cb-${task.id}`

  let style: CSSProperties = {
    marginBottom: 4,
    color: task.completedAt ? 'var(--text-slate-500)' : 'var(--text-strong)',
    textDecoration: task.completedAt ? 'line-through' : undefined,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
    zIndex: isDragging ? 2 : undefined,
  }
  if (searchRowHighlight) {
    style = {
      ...style,
      borderRadius: 4,
      background: 'rgba(59, 130, 246, 0.1)',
      marginLeft: -2,
      marginRight: -2,
      paddingLeft: 2,
      paddingRight: 2,
      boxSizing: 'border-box',
    }
  }
  return (
    <li ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, flex: 1, minWidth: 0 }}>
        <button
          type="button"
          className="nodrag nopan"
          aria-label={`Drag to reorder: ${task.title}`}
          title="Drag to reorder or move to another group"
          disabled={disabled}
          style={{
            flexShrink: 0,
            marginTop: 1,
            padding: 2,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-slate-400)',
            cursor: disabled ? 'not-allowed' : 'grab',
            display: 'flex',
            alignItems: 'center',
            touchAction: 'none',
          }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} strokeWidth={2} aria-hidden />
        </button>
        <div className="nodrag" style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0, gap: 4 }}>
          {task.numberLabel ? (
            <span style={{ marginTop: 1 }}>
              <RoadmapTaskNumber label={task.numberLabel} />
            </span>
          ) : null}
          <input
            id={cbId}
            type="checkbox"
            className="nodrag"
            checked={!!task.completedAt}
            disabled={!canAct}
            onChange={() => canAct && onToggle(task.id)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ marginTop: 2, flexShrink: 0 }}
            aria-label={`Complete: ${task.title}`}
          />
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
            <TechTreeEditableTaskTitle taskId={task.id} canEdit={canEditTaskTitle} onEditTask={onEditTask}>
              {task.title}
            </TechTreeEditableTaskTitle>
            {task.assigneeLabel ? (
              <span style={{ color: 'var(--text-slate-500)' }}> — {task.assigneeLabel}</span>
            ) : null}
            <TaskNextUpSpan on={task.nextUp} pinned={task.pinned} />
            <TaskBridgeChipSpan chip={task.bridgeChip} />
          </div>
        </div>
      </div>
    </li>
  )
}

export function GroupNode({ data }: NodeProps) {
  const d = data as GroupNodeData
  const { collapsed } = d
  const taskMatch = (id: string) => d.searchMatchingTaskIds.includes(id)
  const cardSearchOutline =
    d.searchIsActive && (d.searchGroupTitleMatch || d.searchMatchingTaskIds.length > 0)
      ? '0 0 0 2px #facc15'
      : undefined
  return (
    <div
      style={{
        position: 'relative',
        width: 280,
        minHeight: 80,
        padding: 10,
        borderRadius: 8,
        border: `2px solid ${d.badge?.kind === 'done' ? '#16a34a' : d.locked ? '#cbd5e1' : '#3b82f6'}`,
        background: d.locked ? 'var(--bg-slate-tint)' : 'var(--surface)',
        fontSize: 13,
        boxSizing: 'border-box',
        boxShadow: cardSearchOutline,
      }}
    >
      {d.stageNumber > 0 ? <RoadmapStageNumberBadge n={d.stageNumber} corner /> : null}
      {d.canEditStructure ? (
        <>
          <button
            type="button"
            className="nodrag nopan"
            aria-label="Edit group"
            title="Rename or delete group"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              d.onOpenGroupSettings(d.groupId)
            }}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              padding: 0,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--text-slate-600)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Pencil size={16} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="nodrag nopan"
            aria-label="Add task"
            title="Add task to this group"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              d.onOpenAddTask(d.groupId)
            }}
            style={{
              position: 'absolute',
              top: 38,
              right: 6,
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              padding: 0,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--text-slate-600)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
          </button>
        </>
      ) : null}
      <Handle
        type="target"
        position={Position.Left}
        id="t"
        isConnectable={d.canEditStructure}
        style={{ width: 8, height: 8 }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
          marginBottom: collapsed ? 0 : 4,
          paddingRight: d.canEditStructure ? 40 : 0,
        }}
      >
        <button
          type="button"
          className="nodrag nopan"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            d.onToggleCollapse()
          }}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand group' : 'Collapse group'}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            marginTop: 1,
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-slate-600)',
            cursor: 'pointer',
            borderRadius: 4,
          }}
        >
          {collapsed ? <ChevronRight size={18} strokeWidth={2} aria-hidden /> : <ChevronDown size={18} strokeWidth={2} aria-hidden />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              color: 'var(--text-slate-900)',
              lineHeight: 1.25,
              display: 'inline-block',
              maxWidth: '100%',
              borderRadius: 4,
              padding: d.searchGroupTitleMatch && d.searchIsActive ? '2px 4px' : 0,
              background:
                d.searchIsActive && d.searchGroupTitleMatch ? 'rgba(250, 204, 21, 0.35)' : undefined,
            }}
          >
            {d.title}
          </div>
          {d.badge || d.locked || d.unplanned || d.nextUpCount > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              {d.nextUpCount > 0 ? (
                <span
                  title="Tasks in this stage on the Plan's ⚡ Next up shortlist"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 6,
                    background: 'var(--bg-amber-100)',
                    border: '1px solid var(--border-amber)',
                    color: 'var(--text-amber-800)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ⚡ {d.nextUpCount === 1 ? 'next up' : `${d.nextUpCount} next up`}
                </span>
              ) : null}
              {d.unplanned ? (
                <span
                  title="No tasks and nothing leading into it — add tasks, or link a stage into it"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 6,
                    border: '1px dashed var(--border-strong)',
                    color: 'var(--text-slate-500)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  not planned yet
                </span>
              ) : null}
              {d.badge?.kind === 'done' ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 6,
                    background: '#16a34a',
                    color: 'white',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✓ done
                </span>
              ) : d.badge?.kind === 'progress' ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 6,
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-slate-600)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.badge.done} of {d.badge.total} done
                </span>
              ) : null}
              {d.locked ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 6,
                    background: 'var(--bg-slate-tint)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-slate-600)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Lock size={10} strokeWidth={2.5} aria-hidden /> locked
                </span>
              ) : null}
            </div>
          ) : null}
          {collapsed && d.taskCount > 0 ? (
            <div style={{ color: 'var(--text-slate-500)', fontSize: 12, marginTop: 4, lineHeight: 1.3 }}>
              {d.taskCount === 1 ? '1 task' : `${d.taskCount} tasks`}
            </div>
          ) : null}
        </div>
      </div>
      {!collapsed && d.locked ? (
        <div style={{ color: 'var(--text-slate-500)', fontSize: 12, marginBottom: 6, fontStyle: 'italic' }}>
          {d.lockedHint ?? 'Complete prerequisite groups to unlock'}
        </div>
      ) : null}
      {!collapsed && d.reorderMode && d.canEditStructure ? (
        <>
          <SortableContext items={d.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ul style={{ margin: 0, padding: '0 0 0 0', listStyle: 'none' }}>
              {d.tasks.map((t) => (
                <TechTreeDndTaskRow
                  key={t.id}
                  task={t}
                  onToggle={d.onToggle}
                  onEditTask={d.onEditTask}
                  canEditTaskTitle={d.canEditStructure}
                  canAct={t.canAct}
                  disabled={false}
                  searchRowHighlight={d.searchIsActive && taskMatch(t.id)}
                />
              ))}
            </ul>
          </SortableContext>
          <TechTreeEmptyGroupDrop groupId={d.groupId} visible={d.tasks.length === 0} />
        </>
      ) : !collapsed ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {d.tasks.map((t) => (
              <li
                key={t.id}
                style={{
                  marginBottom: 4,
                  color: t.completedAt ? 'var(--text-slate-500)' : 'var(--text-strong)',
                  textDecoration: t.completedAt ? 'line-through' : undefined,
                  borderRadius: 4,
                  padding: d.searchIsActive && taskMatch(t.id) ? '2px 4px' : 0,
                  marginLeft: d.searchIsActive && taskMatch(t.id) ? -4 : 0,
                  background:
                    d.searchIsActive && taskMatch(t.id) ? 'rgba(59, 130, 246, 0.1)' : undefined,
                }}
              >
                <div
                  className="nodrag"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 4, minWidth: 0 }}
                >
                  {t.numberLabel ? (
                    <span style={{ marginTop: 1 }}>
                      <RoadmapTaskNumber label={t.numberLabel} />
                    </span>
                  ) : null}
                  <input
                    id={`tt-static-cb-${t.id}`}
                    type="checkbox"
                    className="nodrag"
                    checked={!!t.completedAt}
                    disabled={!t.canAct}
                    onChange={() => t.canAct && d.onToggle(t.id)}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ marginTop: 2, flexShrink: 0 }}
                    aria-label={`Complete: ${t.title}`}
                  />
                  <div style={{ lineHeight: 1.4, flex: 1, minWidth: 0 }}>
                    <TechTreeEditableTaskTitle
                      taskId={t.id}
                      canEdit
                      onEditTask={d.onEditTask}
                    >
                      {t.title}
                    </TechTreeEditableTaskTitle>
                    {t.assigneeLabel ? <span style={{ color: 'var(--text-slate-500)' }}> — {t.assigneeLabel}</span> : null}
                    <TaskNextUpSpan on={t.nextUp} pinned={t.pinned} />
                    <TaskBridgeChipSpan chip={t.bridgeChip} />
                  </div>
                </div>
              </li>
          ))}
        </ul>
      ) : null}
      {!collapsed && d.tasks.length === 0 && d.canEditStructure && !d.reorderMode ? (
        <div style={{ color: 'var(--text-slate-400)', fontSize: 12 }}>No tasks yet — add below</div>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        id="s"
        isConnectable={d.canEditStructure}
        style={{ width: 8, height: 8 }}
      />
    </div>
  )
}
