import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pencil, Plus, ChevronDown, ChevronRight, GripVertical, Lock , Settings } from 'lucide-react'
import type { StageBadge } from '../../lib/roadmapBridge'
import { splitTextForHighlight } from '../../lib/checklistTechTreeSearch'
import { techTreeEmptyGroupDropId, techTreeGroupDropId } from '../../lib/techTreeTaskOrder'
import { RoadmapParallelBadge } from './RoadmapParallelBadge'
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
    /** Sequential stages: an earlier sibling is still open (v2.2264). */
    waiting: boolean
    /** "after 3.2" — the open sibling this task waits behind. */
    waitingAfter: string | null
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
  /** Stage-mode gear (v2.2266): opens the in-order/parallel menu at the pointer. */
  onOpenStageMode: (groupId: string, x: number, y: number) => void
  /** false = ⇊ parallel (every task offered at once). */
  sequential: boolean
  /** Just placed (v2.2291): brief glow so the new stage is findable without a camera move. */
  justAdded: boolean
  /** When set, list uses drag-and-drop; only when canEditStructure. */
  reorderMode: boolean
  onEditTask: (taskId: string) => void
  /** When set, group title / task rows use search hit styling. */
  searchIsActive: boolean
  searchGroupTitleMatch: boolean
  /** Task ids in this group that match the roadmap search. */
  searchMatchingTaskIds: string[]
  /** Normalized (trimmed, lowercased) canvas search query — for substring marks. */
  searchQuery: string
}

type GroupTask = GroupNodeData['tasks'][0]

/** Wraps the exact characters matching the canvas search in an amber mark. */
function SearchMarkedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  return (
    <>
      {splitTextForHighlight(text, query).map((seg, i) =>
        seg.hit ? (
          <mark
            key={i}
            style={{ background: 'rgba(250, 204, 21, 0.45)', color: 'inherit', borderRadius: 3, padding: '0 1px' }}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  )
}

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
  // Tap opens the task card for EVERY role (mockup 9727d235) — the old
  // 500ms press-and-hold is gone because holding now means "lift to
  // reorder". The row-level ghost-click guard stops a drop from opening.
  void canEdit
  return (
    <span
      className="nodrag"
      role="button"
      tabIndex={0}
      title="Tap to open"
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation()
        onEditTask(taskId)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEditTask(taskId)
        }
      }}
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
  searchQuery = '',
  showGrip = true,
}: {
  task: GroupTask
  onToggle: (id: string) => void
  onEditTask: (taskId: string) => void
  canEditTaskTitle: boolean
  canAct: boolean
  disabled: boolean
  searchRowHighlight?: boolean
  searchQuery?: string
  /** Reorder mode still shows the grip; hold-anywhere works regardless. */
  showGrip?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled })
  // Suppress the ghost click after a drop — it would open the task card.
  const wasDraggedRef = useRef(false)
  useEffect(() => {
    if (isDragging) wasDraggedRef.current = true
  }, [isDragging])
  const cbId = `tt-task-cb-${task.id}`

  let style: CSSProperties = {
    marginBottom: 4,
    color: task.completedAt ? 'var(--text-slate-500)' : 'var(--text-strong)',
    textDecoration: task.completedAt ? 'line-through' : undefined,
    // Lift (mockup 9727d235): the held row scales up on a shadow — picked
    // up, not ghosted — mirroring the Outstanding boards (v2.2270).
    transform:
      isDragging && transform ? `${CSS.Transform.toString(transform)} scale(1.02)` : CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : undefined,
    position: 'relative',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    ...(isDragging
      ? { background: 'var(--surface)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)', borderRadius: 8, opacity: 1 }
      : {}),
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
    <li
      ref={setNodeRef}
      style={style}
      className="nodrag"
      {...attributes}
      {...listeners}
      onPointerDownCapture={() => {
        wasDraggedRef.current = false
      }}
      onClickCapture={(e) => {
        if (wasDraggedRef.current) {
          wasDraggedRef.current = false
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, flex: 1, minWidth: 0 }}>
        {showGrip ? (
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
        >
          <GripVertical size={16} strokeWidth={2} aria-hidden />
        </button>
        ) : null}
        <div
          className="nodrag"
          style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 0, gap: 4, ...(task.waiting ? { opacity: 0.5 } : {}) }}
        >
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
              <SearchMarkedText text={task.title} query={searchQuery} />
            </TechTreeEditableTaskTitle>
            {task.assigneeLabel ? (
              <span style={{ color: 'var(--text-slate-500)' }}>
                {' — '}
                <SearchMarkedText text={task.assigneeLabel} query={searchQuery} />
              </span>
            ) : null}
            {task.waiting && task.waitingAfter ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}> · after {task.waitingAfter}</span>
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
  // Cross-stage drag (v2.2267): the whole box accepts a dropped task row —
  // anywhere that isn't a row sends the task to the end of this stage.
  const dropEnabled = d.reorderMode && d.canEditStructure
  const { active: dndActive, over: dndOver } = useDndContext()
  const boxDrop = useDroppable({ id: techTreeGroupDropId(d.groupId), disabled: !dropEnabled })
  const dragActive = dropEnabled && dndActive != null
  const activeIsForeign = dragActive && !d.tasks.some((t) => t.id === String(dndActive.id))
  const dndOverId = dragActive && dndOver ? String(dndOver.id) : null
  const dropTargetHere =
    dndOverId != null &&
    (dndOverId === techTreeGroupDropId(d.groupId) ||
      dndOverId === techTreeEmptyGroupDropId(d.groupId) ||
      d.tasks.some((t) => t.id === dndOverId))
  const showEndSlot = activeIsForeign && dndOverId === techTreeGroupDropId(d.groupId)
  const taskMatch = (id: string) => d.searchMatchingTaskIds.includes(id)
  const cardHasHit = d.searchGroupTitleMatch || d.searchMatchingTaskIds.length > 0
  const cardSearchOutline = d.searchIsActive && cardHasHit ? '0 0 0 2px #facc15' : undefined
  return (
    <div
      ref={boxDrop.setNodeRef}
      style={{
        position: 'relative',
        // Search spotlight: stages with no hit fade back but stay in place, so
        // the graph's shape keeps reading while you search.
        opacity: d.searchIsActive && !cardHasHit ? 0.3 : undefined,
        transition: 'opacity 120ms ease, box-shadow 400ms ease',
        width: 280,
        minHeight: 80,
        padding: 10,
        borderRadius: 8,
        border: `2px solid ${d.badge?.kind === 'done' ? '#16a34a' : d.locked ? '#cbd5e1' : '#3b82f6'}`,
        background: d.locked ? 'var(--bg-slate-tint)' : 'var(--surface)',
        fontSize: 13,
        boxSizing: 'border-box',
        boxShadow: dropTargetHere
          ? '0 0 0 3px rgba(59, 130, 246, 0.45)'
          : d.justAdded
            ? '0 0 0 4px rgba(59, 130, 246, 0.5)'
            : cardSearchOutline,
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
            }}
          >
            <SearchMarkedText text={d.title} query={d.searchIsActive ? d.searchQuery : ''} />
          </div>
          {d.badge || d.locked || d.unplanned || d.nextUpCount > 0 || d.canEditStructure ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              {d.canEditStructure ? (
                <button
                  type="button"
                  className="nodrag nopan"
                  aria-label="Stage settings"
                  title="How tasks in this stage go out"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    d.onOpenStageMode(d.groupId, e.clientX, e.clientY)
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    padding: 0,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--surface)',
                    color: 'var(--text-slate-500)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Settings size={13} strokeWidth={2} aria-hidden />
                </button>
              ) : null}
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
              {!d.sequential ? <RoadmapParallelBadge /> : null}
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
      {!collapsed && d.canEditStructure ? (
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
                  searchQuery={d.searchIsActive ? d.searchQuery : ''}
                  showGrip={d.reorderMode}
                />
              ))}
            </ul>
          </SortableContext>
          <TechTreeEmptyGroupDrop groupId={d.groupId} visible={d.reorderMode && d.tasks.length === 0} />
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
                      <SearchMarkedText text={t.title} query={d.searchIsActive ? d.searchQuery : ''} />
                    </TechTreeEditableTaskTitle>
                    {t.assigneeLabel ? (
                      <span style={{ color: 'var(--text-slate-500)' }}>
                        {' — '}
                        <SearchMarkedText text={t.assigneeLabel} query={d.searchIsActive ? d.searchQuery : ''} />
                      </span>
                    ) : null}
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
      {showEndSlot ? (
        <div
          style={{
            marginTop: 6,
            minHeight: 30,
            border: '1.5px dashed #3b82f6',
            background: 'rgba(59, 130, 246, 0.08)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: 'var(--text-blue-500)',
            fontWeight: 600,
            padding: 4,
            boxSizing: 'border-box',
          }}
        >
          {d.stageNumber > 0 ? `Move here — becomes ${d.stageNumber}.${d.tasks.length + 1}` : 'Move here'}
        </div>
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
