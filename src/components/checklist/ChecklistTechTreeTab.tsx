import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type ReactFlowInstance,
  type OnConnect,
  type OnConnectEnd,
  type IsValidConnection,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  layoutTechTreeFlow,
  nodeHeightForGroup,
  techTreeNodeWidth,
} from '../../lib/checklistTechTreeLayout'
import {
  completeGroupIdsFromTasks,
  computeUnlockedGroupIds,
  wouldAddEdgeCreateCycle,
  type TechTreeEdge,
} from '../../lib/checklistTechTreeGraph'
import { computeRoadmapSearchMatches, type RoadmapSearchResult } from '../../lib/checklistTechTreeSearch'
import type { Database } from '../../types/database'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pencil, Plus, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import {
  getCurrentFullscreenElement,
  isDomFullscreenEnabled,
  requestElementFullscreen,
  exitDomFullscreen,
} from '../../lib/domFullscreen'
import {
  computeTaskReorderUpdates,
  orderedTaskIdsByGroup,
  techTreeEmptyGroupDropId,
} from '../../lib/techTreeTaskOrder'
import { ChecklistTechTreeGroupModal } from './ChecklistTechTreeGroupModal'
import { ChecklistTechTreeAddTaskModal } from './ChecklistTechTreeAddTaskModal'
import { ChecklistTechTreeAddGroupModal } from './ChecklistTechTreeAddGroupModal'
import { ChecklistTechTreeLineUpModal } from './ChecklistTechTreeLineUpModal'
import { ChecklistTechTreeLinksModal } from './ChecklistTechTreeLinksModal'
import { TechTreeRoadmapToolbarActions } from './ChecklistTechTreeRoadmapToolbar'
import { ChecklistTechTreeMapActionIconButtons } from './ChecklistTechTreeMapActionIconButtons'
import { ChecklistTechTreeRoadmapBar } from './ChecklistTechTreeRoadmapBar'
import { ChecklistTechTreeRoadmapMembersModal } from './ChecklistTechTreeRoadmapMembersModal'
import { useToastContext } from '../../contexts/ToastContext'

type GroupRow = Database['public']['Tables']['checklist_tech_tree_groups']['Row']
type TaskRow = Database['public']['Tables']['checklist_tech_tree_group_tasks']['Row']
type EdgeRow = Database['public']['Tables']['checklist_tech_tree_edges']['Row']
type RoadmapRow = Database['public']['Tables']['checklist_tech_tree_roadmaps']['Row']
type RoadmapMemberRow = Database['public']['Tables']['checklist_tech_tree_roadmap_members']['Row']

type TaskView = TaskRow & { assigneeIds: string[] }

const PREREQ_LINK_TOAST_MS = 2000

type AddPrereqLinkOptions = { fromConnect?: boolean }

function getAddPrereqLinkBlockReason(
  canEdit: boolean,
  fromGroupId: string,
  toGroupId: string,
  treeEdges: EdgeRow[],
): string | null {
  if (!canEdit) return "You can't edit roadmap links (read-only)."
  if (!fromGroupId || !toGroupId) return null
  if (fromGroupId === toGroupId) return "A group can't be a prerequisite of itself."
  if (treeEdges.some((e) => e.from_group_id === fromGroupId && e.to_group_id === toGroupId)) {
    return 'This link already exists.'
  }
  const existing: TechTreeEdge[] = treeEdges.map((e) => ({
    fromGroupId: e.from_group_id,
    toGroupId: e.to_group_id,
  }))
  if (wouldAddEdgeCreateCycle(existing, fromGroupId, toGroupId)) {
    return 'That link would create a cycle.'
  }
  return null
}

const assigneeNameMap = (users: Array<{ id: string; name: string; email: string }>) => {
  const m = new Map<string, string>()
  for (const u of users) m.set(u.id, u.name?.trim() || u.email)
  return m
}

function useTechTreeData(
  authUserId: string | null,
  roadmapId: string | null,
  setError: (s: string | null) => void,
) {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [tasks, setTasks] = useState<TaskView[]>([])
  const [treeEdges, setTreeEdges] = useState<EdgeRow[]>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [loading, setLoading] = useState(true)
  /** First fetch after each auth (or fresh hook) shows the full-page loader; refetches do not, so the graph is not unmounted. */
  const blockingLoadOverlayRef = useRef(true)
  useEffect(() => {
    blockingLoadOverlayRef.current = true
  }, [authUserId, roadmapId])

  const load = useCallback(async () => {
    if (!authUserId || !roadmapId) {
      setGroups([])
      setTasks([])
      setTreeEdges([])
      setLoading(false)
      return
    }
    setError(null)
    if (blockingLoadOverlayRef.current) {
      setLoading(true)
    }
    try {
      const gRes = await withSupabaseRetry(
        () =>
          supabase
            .from('checklist_tech_tree_groups')
            .select('*')
            .eq('roadmap_id', roadmapId)
            .order('sort_index', { ascending: true }),
        'load checklist_tech_tree_groups',
      )
      const groupIds = gRes.map((g) => g.id)
      const groupIdSet = new Set(groupIds)

      const [tRes, eResRaw, uRes] = await Promise.all([
        groupIds.length === 0
          ? Promise.resolve([] as unknown[])
          : withSupabaseRetry(
              () =>
                supabase
                  .from('checklist_tech_tree_group_tasks')
                  .select(
                    'id, group_id, title, sort_index, completed_at, completed_by_user_id, created_at, checklist_tech_tree_task_assignees(user_id)',
                  )
                  .in('group_id', groupIds)
                  .order('sort_index', { ascending: true }),
              'load checklist_tech_tree_group_tasks',
            ),
        withSupabaseRetry(
          () => supabase.from('checklist_tech_tree_edges').select('*'),
          'load checklist_tech_tree_edges',
        ),
        withSupabaseRetry(
          () =>
            supabase.from('users').select('id, name, email').is('archived_at', null).order('name'),
          'load users for tech tree',
        ),
      ] as const)

      const eRes = (eResRaw as EdgeRow[]).filter(
        (e) => groupIdSet.has(e.from_group_id) && groupIdSet.has(e.to_group_id),
      )

      setGroups(gRes)
      setTreeEdges(eRes)
      setUsers(uRes)
      setTasks(
        (tRes as unknown[]).map((row) => {
          const r = row as {
            id: string
            group_id: string
            title: string
            sort_index: number
            completed_at: string | null
            completed_by_user_id: string | null
            created_at: string
            checklist_tech_tree_task_assignees: { user_id: string }[] | null
          }
          const assigneeIds = (r.checklist_tech_tree_task_assignees ?? []).map((a) => a.user_id)
          return {
            id: r.id,
            group_id: r.group_id,
            title: r.title,
            sort_index: r.sort_index,
            completed_at: r.completed_at,
            completed_by_user_id: r.completed_by_user_id,
            created_at: r.created_at,
            assigneeIds,
          }
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roadmap')
    } finally {
      setLoading(false)
      blockingLoadOverlayRef.current = false
    }
  }, [authUserId, roadmapId, setError])

  useEffect(() => {
    void load()
  }, [load])

  return { groups, tasks, treeEdges, users, loading, load }
}

type GroupNodeData = {
  groupId: string
  title: string
  locked: boolean
  collapsed: boolean
  taskCount: number
  onToggleCollapse: () => void
  tasks: Array<{
    id: string
    title: string
    completedAt: string | null
    assigneeLabel: string
    canAct: boolean
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
      title="Press and hold to edit"
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
    color: task.completedAt ? 'var(--text-slate-500)' : '#111',
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
          </div>
        </div>
      </div>
    </li>
  )
}

function GroupNode({ data }: NodeProps) {
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
        border: `2px solid ${d.locked ? '#cbd5e1' : '#3b82f6'}`,
        background: d.locked ? 'var(--bg-slate-tint)' : 'var(--surface)',
        fontSize: 13,
        boxSizing: 'border-box',
        boxShadow: cardSearchOutline,
      }}
    >
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
              border: '1px solid #e2e8f0',
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
              border: '1px solid #e2e8f0',
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
          {collapsed ? (
            <div style={{ color: 'var(--text-slate-500)', fontSize: 12, marginTop: 4, lineHeight: 1.3 }}>
              {d.taskCount === 1 ? '1 task' : `${d.taskCount} tasks`}
              {d.locked ? ' · Locked' : ''}
            </div>
          ) : null}
        </div>
      </div>
      {!collapsed && d.locked ? (
        <div style={{ color: 'var(--text-slate-500)', fontSize: 12, marginBottom: 6 }}>Complete prerequisite groups to unlock</div>
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
        <ul style={{ margin: 0, padding: '0 0 0 1.1em', listStyle: 'disc' }}>
          {d.tasks.map((t) => (
              <li
                key={t.id}
                style={{
                  marginBottom: 4,
                  color: t.completedAt ? 'var(--text-slate-500)' : '#111',
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
                      canEdit={d.canEditStructure}
                      onEditTask={d.onEditTask}
                    >
                      {t.title}
                    </TechTreeEditableTaskTitle>
                    {t.assigneeLabel ? <span style={{ color: 'var(--text-slate-500)' }}> — {t.assigneeLabel}</span> : null}
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

const nodeTypes = { groupNode: GroupNode }

function clientCoordsForConnectEnd(
  event: MouseEvent | TouchEvent,
): { x: number; y: number } | null {
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    if (event.touches.length > 0) {
      const t = event.touches[0]!
      return { x: t.clientX, y: t.clientY }
    }
    if (event.changedTouches.length > 0) {
      const t = event.changedTouches[0]!
      return { x: t.clientX, y: t.clientY }
    }
  }
  if ('clientX' in event && typeof (event as MouseEvent).clientX === 'number') {
    return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY }
  }
  return null
}

type AddGroupModalState =
  | null
  | { kind: 'toolbar' }
  | {
      kind: 'linkFromGroup'
      fromGroupId: string
      fromGroupTitle: string
      /** Top-left in flow space (centered on drop) */
      flowPosition: { x: number; y: number }
    }

type RoadmapCanvasSearchVariant = 'inline' | 'fullscreen'

function RoadmapCanvasSearchPanel({
  variant,
  inputId,
  iconButtonStyle,
  roadmapSearchQuery,
  onRoadmapSearchQueryChange,
  roadmapSearch,
  fitViewRoadmapSearchMatches,
}: {
  variant: RoadmapCanvasSearchVariant
  inputId: string
  iconButtonStyle: CSSProperties
  roadmapSearchQuery: string
  onRoadmapSearchQueryChange: (q: string) => void
  roadmapSearch: RoadmapSearchResult
  fitViewRoadmapSearchMatches: () => void
}) {
  const zIndex = variant === 'fullscreen' ? 11 : 5
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useLayoutEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target
      if (!(t instanceof Node)) return
      if (!containerRef.current?.contains(t)) setExpanded(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [expanded])

  return (
    <div
      ref={containerRef}
      className="nodrag nopan"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex,
        width: expanded ? 'min(440px, calc(100% - 120px))' : 'auto',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        className="nodrag nopan"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 6,
          width: '100%',
        }}
      >
        <button
          type="button"
          className="nodrag nopan"
          title="Search roadmap"
          aria-label="Search roadmap"
          aria-expanded={expanded}
          aria-controls={expanded ? inputId : undefined}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={iconButtonStyle}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 640"
            width={16}
            height={16}
            fill="currentColor"
            aria-hidden
          >
            <path d="M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z" />
          </svg>
        </button>
        {expanded ? (
          <input
            ref={inputRef}
            id={inputId}
            className="nodrag nopan"
            type="search"
            value={roadmapSearchQuery}
            onChange={(e) => onRoadmapSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                inputRef.current?.blur()
                setExpanded(false)
                return
              }
              if (e.key === 'Enter' && roadmapSearch.groupIdsWithAnyMatch.length > 0) {
                e.preventDefault()
                fitViewRoadmapSearchMatches()
              }
            }}
            placeholder="Search groups and tasks…"
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              font: 'inherit',
              background: 'var(--surface)',
            }}
            aria-label="Search roadmap by group or task"
          />
        ) : null}
      </div>
      {expanded && roadmapSearch.normalizedQuery ? (
        <div
          className="nodrag nopan"
          style={{
            fontSize: 12,
            color: roadmapSearch.matchCount > 0 ? 'var(--text-slate-500)' : 'var(--text-amber-700)',
          }}
        >
          {roadmapSearch.matchCount === 0
            ? 'No matches'
            : `${roadmapSearch.matchCount} match${roadmapSearch.matchCount === 1 ? '' : 'es'}`}
        </div>
      ) : null}
      {expanded &&
      roadmapSearch.normalizedQuery &&
      roadmapSearch.groupIdsWithAnyMatch.length > 0 ? (
        <div className="nodrag nopan">
          <button
            type="button"
            className="nodrag nopan"
            onClick={() => void fitViewRoadmapSearchMatches()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: 'var(--bg-slate-tint)',
              cursor: 'pointer',
            }}
          >
            Show on map
          </button>
        </div>
      ) : null}
    </div>
  )
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function ChecklistTechTreeTab({
  authUserId,
  canEditTechTree,
  setError,
  roadmapIdFromUrl,
  onRoadmapUrlParamChange,
}: {
  authUserId: string | null
  /** true for dev, master, assistant, primary (matches is_dev_or_master_or_assistant RLS) */
  canEditTechTree: boolean
  setError: (s: string | null) => void
  roadmapIdFromUrl: string | null
  onRoadmapUrlParamChange: (roadmapId: string) => void
}) {
  const { showToast } = useToastContext()
  const [roadmaps, setRoadmaps] = useState<RoadmapRow[]>([])
  const [roadmapMembers, setRoadmapMembers] = useState<RoadmapMemberRow[]>([])
  const [membersModalOpen, setMembersModalOpen] = useState(false)
  const [roadmapsLoading, setRoadmapsLoading] = useState(true)

  const loadRoadmaps = useCallback(async () => {
    if (!authUserId) {
      setRoadmapsLoading(false)
      return
    }
    setRoadmapsLoading(true)
    try {
      const r = await withSupabaseRetry(
        () =>
          supabase
            .from('checklist_tech_tree_roadmaps')
            .select('*')
            .order('sort_index', { ascending: true })
            .order('title', { ascending: true }),
        'load checklist tech tree roadmaps',
      )
      setRoadmaps(r as RoadmapRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roadmaps')
    } finally {
      setRoadmapsLoading(false)
    }
  }, [authUserId, setError])

  useEffect(() => {
    void loadRoadmaps()
  }, [loadRoadmaps])

  const normalizedRoadmapUrl = useMemo(() => {
    if (!roadmapIdFromUrl || !UUID_RE.test(roadmapIdFromUrl)) return null
    return roadmapIdFromUrl
  }, [roadmapIdFromUrl])

  const effectiveRoadmapId = useMemo(() => {
    if (!roadmaps.length) return null
    if (normalizedRoadmapUrl && roadmaps.some((r) => r.id === normalizedRoadmapUrl)) {
      return normalizedRoadmapUrl
    }
    const first = roadmaps[0]
    return first ? first.id : null
  }, [roadmaps, normalizedRoadmapUrl])

  useEffect(() => {
    if (!effectiveRoadmapId) return
    if (normalizedRoadmapUrl === effectiveRoadmapId) return
    onRoadmapUrlParamChange(effectiveRoadmapId)
  }, [effectiveRoadmapId, normalizedRoadmapUrl, onRoadmapUrlParamChange])

  const loadRoadmapMembers = useCallback(async () => {
    if (!effectiveRoadmapId) {
      setRoadmapMembers([])
      return
    }
    try {
      const m = await withSupabaseRetry(
        () =>
          supabase
            .from('checklist_tech_tree_roadmap_members')
            .select('*')
            .eq('roadmap_id', effectiveRoadmapId),
        'load checklist tech tree roadmap members',
      )
      setRoadmapMembers(m as RoadmapMemberRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roadmap members')
    }
  }, [effectiveRoadmapId, setError])

  useEffect(() => {
    void loadRoadmapMembers()
  }, [loadRoadmapMembers])

  const myRoadmapMemberRole = useMemo(
    () => roadmapMembers.find((m) => m.user_id === authUserId)?.role,
    [roadmapMembers, authUserId],
  )
  const canEditStructure = canEditTechTree || myRoadmapMemberRole === 'editor'

  const { groups, tasks, treeEdges, users, loading, load } = useTechTreeData(
    authUserId,
    effectiveRoadmapId,
    setError,
  )
  const nameById = useMemo(() => assigneeNameMap(users), [users])

  const tasksByGroup = useMemo(() => {
    const m = new Map<string, TaskView[]>()
    for (const t of tasks) {
      const list = m.get(t.group_id) ?? []
      list.push(t)
      m.set(t.group_id, list)
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id))
    }
    return m
  }, [tasks])

  const completeGroupIds = useMemo(
    () => completeGroupIdsFromTasks(tasksByGroup),
    [tasksByGroup],
  )

  const graphEdges = useMemo<TechTreeEdge[]>(
    () => treeEdges.map((e) => ({ fromGroupId: e.from_group_id, toGroupId: e.to_group_id })),
    [treeEdges],
  )

  const allGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups])
  const unlockedIds = useMemo(
    () => computeUnlockedGroupIds(allGroupIds, graphEdges, completeGroupIds),
    [allGroupIds, graphEdges, completeGroupIds],
  )

  const taskCountByGroup = useMemo(() => {
    const m = new Map<string, number>()
    for (const g of groups) m.set(g.id, (tasksByGroup.get(g.id) ?? []).length)
    return m
  }, [groups, tasksByGroup])

  const flowEdgeList = useMemo(
    () =>
      treeEdges.map((e) => ({ id: e.id, from: e.from_group_id, to: e.to_group_id })),
    [treeEdges],
  )

  const [roadmapSearchQuery, setRoadmapSearchQuery] = useState('')

  const groupsForRoadmapSearch = useMemo(
    () => groups.map((g) => ({ id: g.id, title: g.title })),
    [groups],
  )
  const tasksForRoadmapSearch = useMemo(
    () =>
      tasks.map((t) => ({
        id: t.id,
        groupId: t.group_id,
        title: t.title,
        assigneeLabel: t.assigneeIds.length
          ? t.assigneeIds.map((id) => nameById.get(id) ?? '…').join(', ')
          : '',
      })),
    [tasks, nameById],
  )
  const roadmapSearch = useMemo(
    () =>
      computeRoadmapSearchMatches(roadmapSearchQuery, {
        groups: groupsForRoadmapSearch,
        tasks: tasksForRoadmapSearch,
      }),
    [roadmapSearchQuery, groupsForRoadmapSearch, tasksForRoadmapSearch],
  )
  const taskIdMatchSetForFlow = useMemo(
    () => new Set(roadmapSearch.taskIdsMatching),
    [roadmapSearch.taskIdsMatching],
  )
  const groupTitleMatchSetForFlow = useMemo(
    () => new Set(roadmapSearch.groupIdsWithTitleMatch),
    [roadmapSearch.groupIdsWithTitleMatch],
  )

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const openGroupSettings = useCallback((groupId: string) => {
    setEditingGroupId(groupId)
  }, [])
  const [addTaskModalGroupId, setAddTaskModalGroupId] = useState<string | null>(null)
  const [editTaskId, setEditTaskId] = useState<string | null>(null)
  const openAddTask = useCallback((groupId: string) => {
    setEditTaskId(null)
    setAddTaskModalGroupId(groupId)
  }, [])
  const openEditTask = useCallback(
    (taskId: string) => {
      if (!canEditStructure) return
      setAddTaskModalGroupId(null)
      setEditTaskId(taskId)
    },
    [canEditStructure],
  )

  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set())
  const toggleGroupCollapsed = useCallback((groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  /** One-time "collapse all" after first group data; reset when auth changes. */
  const collapseBootstrapDoneRef = useRef(false)
  /** Tracks last seen group ids for new-group and prune. */
  const knownGroupIdsRef = useRef<Set<string>>(new Set())
  const prereqConnectJustSucceededRef = useRef(false)
  const newGroupManualPositionFromConnectRef = useRef<{
    id: string
    pos: { x: number; y: number }
  } | null>(null)

  const layoutCacheRef = useRef<{ key: string; nodes: Node[]; edges: Edge[] } | null>(null)
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null)
  const canvasShellRef = useRef<HTMLDivElement | null>(null)
  // Native (DOM Fullscreen API) state vs. a CSS fallback for platforms without it (e.g. iPhone Safari).
  const [isDomCanvasFullscreen, setIsDomCanvasFullscreen] = useState(false)
  const [cssFullscreen, setCssFullscreen] = useState(false)
  const isCanvasFullscreen = isDomCanvasFullscreen || cssFullscreen
  /** Fullscreen modals must portal into the roadmap shell; set after ref is attached (see useLayoutEffect). */
  const [roadmapModalPortalHost, setRoadmapModalPortalHost] = useState<HTMLElement | null>(null)
  const canUseDomFullscreen = useMemo(() => isDomFullscreenEnabled(), [])
  const [manualGroupPositions, setManualGroupPositions] = useState(
    () => new Map<string, { x: number; y: number }>(),
  )
  const [organizeVersion, setOrganizeVersion] = useState(0)
  const [reorderMode, setReorderMode] = useState(false)
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  /** Re-layout the graph in dagre only when group set, links, or collapse changes — not on task add/complete. */
  const structuralKey = useMemo(() => {
    if (groups.length === 0) return ''
    const edgeKeys = flowEdgeList
      .map((e) => ({ id: e.id, from: e.from, to: e.to }))
      .sort((a, b) => a.id.localeCompare(b.id))
    return JSON.stringify({
      gids: groups.map((g) => g.id),
      edges: edgeKeys,
      collapsed: [...collapsedGroupIds].sort(),
    })
  }, [groups, flowEdgeList, collapsedGroupIds])

  const onToggleTask = useCallback(
    (taskId: string) => {
      const t = tasks.find((x) => x.id === taskId)
      if (!t || !authUserId) return
      const g = groups.find((x) => x.id === t.group_id)
      if (!g) return
      const unlocked = unlockedIds.has(t.group_id)
      const isStaff = canEditStructure
      const isAssignee = t.assigneeIds.length === 0 ? false : t.assigneeIds.includes(authUserId)
      const canAct = isStaff || (unlocked && (isAssignee || t.assigneeIds.length === 0)) // empty assignee: only staff
      if (!canAct) return
      if (!unlocked && !isStaff) return

      const next = t.completed_at
        ? { completed_at: null as null, completed_by_user_id: null as null }
        : { completed_at: new Date().toISOString(), completed_by_user_id: authUserId }

      void (async () => {
        try {
          await withSupabaseRetry(
            () =>
              supabase.from('checklist_tech_tree_group_tasks').update(next).eq('id', taskId),
            'toggle tech tree task',
          )
          await load()
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not update task')
        }
      })()
    },
    [authUserId, canEditStructure, groups, load, setError, tasks, unlockedIds],
  )

  const canActOnTask = useCallback(
    (t: TaskView, groupUnlocked: boolean) => {
      if (!authUserId) return false
      if (canEditStructure) return true
      if (!groupUnlocked) return false
      if (t.assigneeIds.length === 0) return false
      return t.assigneeIds.includes(authUserId)
    },
    [authUserId, canEditStructure],
  )

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    if (groups.length === 0) {
      layoutCacheRef.current = null
      return { nodes: [] as Node[], edges: [] as Edge[] }
    }
    if (structuralKey && layoutCacheRef.current?.key === structuralKey) {
      return {
        nodes: layoutCacheRef.current.nodes,
        edges: layoutCacheRef.current.edges,
      }
    }
    const res = layoutTechTreeFlow({
      groupIds: groups.map((g) => g.id),
      taskCountByGroup,
      flowEdges: flowEdgeList,
      collapsedGroupIds,
    })
    if (structuralKey) {
      layoutCacheRef.current = { key: structuralKey, nodes: res.nodes, edges: res.edges }
    }
    return { nodes: res.nodes, edges: res.edges }
  }, [structuralKey, groups, taskCountByGroup, flowEdgeList, collapsedGroupIds, organizeVersion])

  const handleOrganize = useCallback(() => {
    if (groups.length === 0) return
    setManualGroupPositions(new Map())
    layoutCacheRef.current = null
    setOrganizeVersion((v) => v + 1)
  }, [groups.length])

  const handleCollapseAll = useCallback(() => {
    if (groups.length === 0) return
    setManualGroupPositions(new Map())
    setCollapsedGroupIds(new Set(groups.map((g) => g.id)))
    setOrganizeVersion((v) => v + 1)
  }, [groups])

  const handleShowAll = useCallback(() => {
    if (groups.length === 0) return
    setManualGroupPositions(new Map())
    setCollapsedGroupIds(new Set())
    setOrganizeVersion((v) => v + 1)
  }, [groups.length])

  useEffect(() => {
    collapseBootstrapDoneRef.current = false
    knownGroupIdsRef.current = new Set()
  }, [authUserId, effectiveRoadmapId])

  useEffect(() => {
    if (!authUserId) return
    if (groups.length === 0) return
    if (collapseBootstrapDoneRef.current) return
    setManualGroupPositions(new Map())
    setCollapsedGroupIds(new Set(groups.map((g) => g.id)))
    setOrganizeVersion((v) => v + 1)
    collapseBootstrapDoneRef.current = true
    knownGroupIdsRef.current = new Set(groups.map((g) => g.id))
  }, [authUserId, effectiveRoadmapId, groups])

  useEffect(() => {
    if (!authUserId) return
    if (!collapseBootstrapDoneRef.current) return
    if (groups.length === 0) return
    const current = new Set(groups.map((g) => g.id))
    const known = knownGroupIdsRef.current
    const added: string[] = []
    for (const id of current) {
      if (!known.has(id)) added.push(id)
    }
    const removed: string[] = []
    for (const id of known) {
      if (!current.has(id)) removed.push(id)
    }
    if (added.length === 0 && removed.length === 0) {
      if (current.size === known.size && [...current].every((id) => known.has(id))) {
        return
      }
    }
    setCollapsedGroupIds((prev) => {
      const next = new Set([...prev].filter((id) => current.has(id)))
      for (const id of added) next.add(id)
      return next
    })
    if (added.length > 0 || removed.length > 0) {
      const placeFromConnect = newGroupManualPositionFromConnectRef.current
      if (placeFromConnect && added.includes(placeFromConnect.id)) {
        newGroupManualPositionFromConnectRef.current = null
        setManualGroupPositions(
          new Map([[placeFromConnect.id, placeFromConnect.pos]]),
        )
      } else {
        setManualGroupPositions(new Map())
      }
      setOrganizeVersion((v) => v + 1)
    }
    knownGroupIdsRef.current = new Set(current)
  }, [authUserId, groups])

  useEffect(() => {
    if (!roadmapSearch.normalizedQuery) return
    const toExpand = roadmapSearch.groupIdsWithAnyMatch
    if (toExpand.length === 0) return
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const id of toExpand) {
        if (next.has(id)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [roadmapSearch])

  const flowNodes: Node[] = useMemo(() => {
    return layoutNodes.map((n) => {
      const gid = n.data.groupId as string
      const g = groups.find((x) => x.id === gid)
      const tlist = tasksByGroup.get(gid) ?? []
      const gu = unlockedIds.has(gid)
      const matchingTaskIds = tlist
        .map((t) => t.id)
        .filter((id) => taskIdMatchSetForFlow.has(id))
      return {
        ...n,
        data: {
          groupId: gid,
          title: g?.title ?? 'Group',
          locked: !gu,
          canEditStructure,
          onToggle: onToggleTask,
          onOpenGroupSettings: openGroupSettings,
          onOpenAddTask: openAddTask,
          onEditTask: openEditTask,
          collapsed: collapsedGroupIds.has(gid),
          taskCount: tlist.length,
          onToggleCollapse: () => toggleGroupCollapsed(gid),
          tasks: tlist.map((t) => {
            const names = t.assigneeIds.map((id) => nameById.get(id) ?? '…')
            return {
              id: t.id,
              title: t.title,
              completedAt: t.completed_at,
              assigneeLabel: names.length ? names.join(', ') : '',
              canAct: canActOnTask(t, gu),
            }
          }),
          reorderMode: canEditStructure && reorderMode,
          searchIsActive: Boolean(roadmapSearch.normalizedQuery),
          searchGroupTitleMatch: groupTitleMatchSetForFlow.has(gid),
          searchMatchingTaskIds: matchingTaskIds,
        } as GroupNodeData,
      }
    })
  }, [
    layoutNodes,
    groups,
    tasksByGroup,
    unlockedIds,
    canEditStructure,
    onToggleTask,
    nameById,
    canActOnTask,
    openGroupSettings,
    openAddTask,
    openEditTask,
    collapsedGroupIds,
    toggleGroupCollapsed,
    reorderMode,
    roadmapSearch,
    taskIdMatchSetForFlow,
    groupTitleMatchSetForFlow,
  ])

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)

  useEffect(() => {
    const valid = new Set(groups.map((g) => g.id))
    setManualGroupPositions((prev) => {
      let changed = false
      const next = new Map(prev)
      for (const id of next.keys()) {
        if (!valid.has(id)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [groups])

  useEffect(() => {
    setNodes(
      flowNodes.map((fn) => ({
        ...fn,
        position: manualGroupPositions.get(fn.id) ?? fn.position,
      })),
    )
  }, [flowNodes, manualGroupPositions, setNodes])

  const onNodeDragStop = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      setManualGroupPositions((prev) => {
        const next = new Map(prev)
        next.set(node.id, { x: node.position.x, y: node.position.y })
        return next
      })
    },
    [],
  )

  // Refit only after Organize / collapse-all / show-all (organizeVersion bumps). Do not depend on
  // flowNodes.length or adding a group would reset pan/zoom.
  useEffect(() => {
    if (organizeVersion === 0) return
    const t = requestAnimationFrame(() => {
      void rfInstanceRef.current?.fitView({ padding: 0.1 })
    })
    return () => cancelAnimationFrame(t)
  }, [organizeVersion])

  useEffect(() => {
    setEdges(layoutEdges)
  }, [layoutEdges, setEdges])

  const [addGroupModal, setAddGroupModal] = useState<AddGroupModalState>(null)
  const [lineUpModalOpen, setLineUpModalOpen] = useState(false)
  const editingGroup = editingGroupId ? groups.find((g) => g.id === editingGroupId) : null
  const addTaskModalGroup = addTaskModalGroupId ? groups.find((g) => g.id === addTaskModalGroupId) : null
  const editTaskForModal = useMemo(
    () => (editTaskId ? tasks.find((t) => t.id === editTaskId) : null),
    [editTaskId, tasks],
  )
  const editTaskModalGroup = editTaskForModal
    ? groups.find((g) => g.id === editTaskForModal.group_id) ?? null
    : null

  const [linksModalOpen, setLinksModalOpen] = useState(false)
  const [linksSearchQuery, setLinksSearchQuery] = useState('')

  const closeLinksModal = useCallback(() => {
    setLinksModalOpen(false)
    setLinksSearchQuery('')
  }, [])

  const openLineUpFromLinksModal = useCallback(() => {
    setLinksModalOpen(false)
    setLinksSearchQuery('')
    setLineUpModalOpen(true)
  }, [])

  const filteredTreeEdges = useMemo(() => {
    const q = linksSearchQuery.trim().toLowerCase()
    if (!q) return treeEdges
    return treeEdges.filter((e) => {
      const a = groups.find((g) => g.id === e.from_group_id)?.title ?? '…'
      const b = groups.find((g) => g.id === e.to_group_id)?.title ?? '…'
      const al = a.toLowerCase()
      const bl = b.toLowerCase()
      const combined = `${a} → ${b}`.toLowerCase()
      return al.includes(q) || bl.includes(q) || combined.includes(q)
    })
  }, [treeEdges, groups, linksSearchQuery])

  const addTaskToGroup = useCallback(
    async (groupId: string, title: string, assigneeUserIds: string[]): Promise<boolean> => {
      if (!canEditStructure || !authUserId || !title.trim()) return false
      try {
        setError(null)
        const list = tasksByGroup.get(groupId) ?? []
        const max = list.length ? Math.max(...list.map((t) => t.sort_index), 0) : 0
        const row = (await withSupabaseRetry(
          () =>
            supabase
              .from('checklist_tech_tree_group_tasks')
              .insert({
                group_id: groupId,
                title: title.trim(),
                sort_index: max + 1,
              })
              .select('id')
              .single(),
          'insert tech tree task',
        )) as { id: string }
        if (!row.id) return false
        for (const uid of assigneeUserIds) {
          await withSupabaseRetry(
            () =>
              supabase.from('checklist_tech_tree_task_assignees').insert({ task_id: row.id, user_id: uid }),
            'insert task assignee',
          )
        }
        await load()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add task')
        return false
      }
    },
    [authUserId, canEditStructure, load, setError, tasksByGroup],
  )

  const updateTaskInGroup = useCallback(
    async (taskId: string, title: string, assigneeUserIds: string[]): Promise<boolean> => {
      if (!canEditStructure || !title.trim()) return false
      try {
        setError(null)
        await withSupabaseRetry(
          () =>
            supabase.from('checklist_tech_tree_group_tasks').update({ title: title.trim() }).eq('id', taskId),
          'update tech tree task title',
        )
        await withSupabaseRetry(
          () => supabase.from('checklist_tech_tree_task_assignees').delete().eq('task_id', taskId),
          'clear tech tree task assignees',
        )
        for (const uid of assigneeUserIds) {
          await withSupabaseRetry(
            () => supabase.from('checklist_tech_tree_task_assignees').insert({ task_id: taskId, user_id: uid }),
            'insert tech tree task assignee',
          )
        }
        await load()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update task')
        return false
      }
    },
    [canEditStructure, load, setError],
  )

  const insertNewGroup = useCallback(
    async (title: string): Promise<string | null> => {
      if (!canEditStructure || !authUserId || !title.trim() || !effectiveRoadmapId) return null
      try {
        setError(null)
        const max = groups.length ? Math.max(...groups.map((g) => g.sort_index), 0) : 0
        const row = (await withSupabaseRetry(
          () =>
            supabase
              .from('checklist_tech_tree_groups')
              .insert({
                title: title.trim(),
                sort_index: max + 1,
                created_by_user_id: authUserId,
                roadmap_id: effectiveRoadmapId,
              })
              .select('id')
              .single(),
          'insert tech tree group',
        )) as { id: string }
        if (!row.id) return null
        return row.id
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add group')
        return null
      }
    },
    [authUserId, canEditStructure, effectiveRoadmapId, groups, setError],
  )

  const addGroupByTitle = useCallback(
    async (title: string): Promise<boolean> => {
      const id = await insertNewGroup(title)
      if (!id) return false
      await load()
      return true
    },
    [insertNewGroup, load],
  )

  const addPrereqLink = useCallback(
    async (
      fromGroupId: string,
      toGroupId: string,
      opts?: AddPrereqLinkOptions,
    ): Promise<boolean> => {
      const fromConnect = Boolean(opts?.fromConnect)
      if (!fromGroupId || !toGroupId) return false
      const block = getAddPrereqLinkBlockReason(
        canEditStructure,
        fromGroupId,
        toGroupId,
        treeEdges,
      )
      if (block) {
        if (fromConnect) showToast(block, 'warning', PREREQ_LINK_TOAST_MS)
        else setError(block)
        return false
      }
      setError(null)
      try {
        await withSupabaseRetry(
          () =>
            supabase
              .from('checklist_tech_tree_edges')
              .insert({ from_group_id: fromGroupId, to_group_id: toGroupId }),
          'insert tech tree edge',
        )
        await load()
        if (fromConnect) showToast('Link added', 'success', PREREQ_LINK_TOAST_MS)
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not add link'
        if (fromConnect) {
          if (/duplicate|unique key/i.test(msg)) {
            showToast('This link already exists.', 'warning', PREREQ_LINK_TOAST_MS)
          } else {
            showToast(msg, 'error', PREREQ_LINK_TOAST_MS)
          }
        } else {
          setError(msg)
        }
        return false
      }
    },
    [canEditStructure, load, setError, showToast, treeEdges],
  )

  const handleAddGroupSave = useCallback(
    async (title: string): Promise<boolean> => {
      const mode = addGroupModal
      if (!mode) return false
      if (mode.kind === 'toolbar') {
        return addGroupByTitle(title)
      }
      const newId = await insertNewGroup(title)
      if (!newId) return false
      newGroupManualPositionFromConnectRef.current = { id: newId, pos: mode.flowPosition }
      const ok = await addPrereqLink(mode.fromGroupId, newId, { fromConnect: false })
      if (!ok) {
        newGroupManualPositionFromConnectRef.current = null
        return false
      }
      return true
    },
    [addGroupModal, addGroupByTitle, insertNewGroup, addPrereqLink],
  )

  const onPrereqConnect: OnConnect = useCallback(
    (c) => {
      if (!c.source || !c.target) return
      prereqConnectJustSucceededRef.current = true
      void addPrereqLink(c.source, c.target, { fromConnect: true })
    },
    [addPrereqLink],
  )

  const onPrereqConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (prereqConnectJustSucceededRef.current) {
        prereqConnectJustSucceededRef.current = false
        return
      }
      if (!canEditStructure) return
      if (connectionState.toNode != null) return
      if (!connectionState.fromNode || !connectionState.fromHandle) return
      if (connectionState.fromHandle.id !== 's' || connectionState.fromHandle.type !== 'source') {
        return
      }
      const coords = clientCoordsForConnectEnd(event)
      if (!coords) return
      const rf = rfInstanceRef.current
      if (!rf) return
      const fromGroupId = connectionState.fromNode.id
      const raw = rf.screenToFlowPosition(coords)
      const w = techTreeNodeWidth
      const h = nodeHeightForGroup(0, true)
      setAddGroupModal({
        kind: 'linkFromGroup',
        fromGroupId,
        fromGroupTitle: groups.find((g) => g.id === fromGroupId)?.title ?? 'Group',
        flowPosition: { x: raw.x - w / 2, y: raw.y - h / 2 },
      })
    },
    [canEditStructure, groups],
  )

  const isValidPrereqConnection: IsValidConnection<Edge> = useCallback((c) => {
    if (!c.source || !c.target) return false
    if (c.source === c.target) return false
    if (c.sourceHandle != null && c.sourceHandle !== 's') return false
    if (c.targetHandle != null && c.targetHandle !== 't') return false
    return true
  }, [])

  const onTaskDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!reorderMode || !canEditStructure) return
      const { active, over } = event
      if (!over) return
      const activeId = String(active.id)
      const overId = String(over.id)
      if (activeId === overId) return
      const taskById = new Map(tasks.map((t) => [t.id, t]))
      const ordered = orderedTaskIdsByGroup(
        tasks.map((t) => ({ id: t.id, group_id: t.group_id, sort_index: t.sort_index })),
        groups.map((g) => g.id),
      )
      const updates = computeTaskReorderUpdates({
        activeId,
        overId,
        taskById,
        orderedIdsByGroup: ordered,
        allGroupIds: groups.map((g) => g.id),
      })
      if (updates == null || updates.length === 0) return
      setError(null)
      try {
        await Promise.all(
          updates.map((u) =>
            withSupabaseRetry(
              () =>
                supabase
                  .from('checklist_tech_tree_group_tasks')
                  .update({ group_id: u.group_id, sort_index: u.sort_index })
                  .eq('id', u.id),
              'reorder tech tree task',
            ),
          ),
        )
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not reorder task')
        await load()
      }
    },
    [reorderMode, canEditStructure, tasks, groups, load, setError],
  )

  const triggerCanvasResize = useCallback(() => {
    // React Flow v12 has no instance.resize(); a host resize makes the flow re-measure the pane.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'))
      })
    })
  }, [])

  const exitCanvasFullscreen = useCallback(() => {
    setCssFullscreen(false)
    void exitDomFullscreen()
    triggerCanvasResize()
  }, [triggerCanvasResize])

  const enterCanvasFullscreen = useCallback(() => {
    const el = canvasShellRef.current
    if (!el) return
    setError(null)
    if (canUseDomFullscreen) {
      void (async () => {
        try {
          await requestElementFullscreen(el)
        } catch {
          // Native fullscreen failed — fall back to the CSS overlay.
          setCssFullscreen(true)
          triggerCanvasResize()
        }
      })()
    } else {
      // No DOM Fullscreen API (e.g. iPhone Safari): use the CSS fullscreen overlay.
      setCssFullscreen(true)
      triggerCanvasResize()
    }
  }, [setError, canUseDomFullscreen, triggerCanvasResize])

  useEffect(() => {
    const sync = () => {
      const shell = canvasShellRef.current
      setIsDomCanvasFullscreen(!!(shell && getCurrentFullscreenElement() === shell))
      triggerCanvasResize()
    }
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [triggerCanvasResize])

  useLayoutEffect(() => {
    if (isCanvasFullscreen) {
      setRoadmapModalPortalHost(canvasShellRef.current)
    } else {
      setRoadmapModalPortalHost(null)
    }
  }, [isCanvasFullscreen])

  // CSS fullscreen fallback: lock body scroll and allow Esc to exit (no native handling).
  useEffect(() => {
    if (!cssFullscreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCssFullscreen(false)
        triggerCanvasResize()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [cssFullscreen, triggerCanvasResize])

  const removeEdge = async (id: string) => {
    if (!canEditStructure) return
    try {
      await withSupabaseRetry(
        () => supabase.from('checklist_tech_tree_edges').delete().eq('id', id),
        'delete tech tree edge',
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove link')
    }
  }

  const handleCreateRoadmap = useCallback(async () => {
    if (!authUserId || !canEditTechTree) return
    const title = window.prompt('Name for the new roadmap?')
    if (!title?.trim()) return
    try {
      setError(null)
      const maxSi = roadmaps.length ? Math.max(...roadmaps.map((r) => r.sort_index), 0) : 0
      const inserted = (await withSupabaseRetry(
        () =>
          supabase
            .from('checklist_tech_tree_roadmaps')
            .insert({
              title: title.trim(),
              created_by_user_id: authUserId,
              sort_index: maxSi + 1,
            })
            .select('id')
            .single(),
        'insert checklist tech tree roadmap',
      )) as { id: string }
      await withSupabaseRetry(
        () =>
          supabase.from('checklist_tech_tree_roadmap_members').insert({
            roadmap_id: inserted.id,
            user_id: authUserId,
            role: 'editor',
          }),
        'insert roadmap creator as editor',
      )
      await loadRoadmaps()
      onRoadmapUrlParamChange(inserted.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create roadmap')
    }
  }, [authUserId, canEditTechTree, loadRoadmaps, onRoadmapUrlParamChange, roadmaps, setError])

  const fitViewRoadmapSearchMatches = useCallback(() => {
    const ids = roadmapSearch.groupIdsWithAnyMatch
    if (ids.length === 0) return
    const rf = rfInstanceRef.current
    if (!rf) return
    void rf.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.2, duration: 220 })
  }, [roadmapSearch.groupIdsWithAnyMatch])

  const mapCanvasFloatButtonStyle: CSSProperties = {
    width: 30,
    height: 30,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text-slate-600)',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)',
  }

  const roadmapExitFullscreenIconButtonStyle: CSSProperties = {
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    boxShadow: 'none',
    color: 'var(--text-slate-600)',
    cursor: 'pointer',
    flexShrink: 0,
  }

  const floatGroupCount = groups.length
  const floatCollapsedCount = collapsedGroupIds.size
  const showAllFloatDisabled = floatCollapsedCount === 0
  const collapseAllFloatDisabled = floatCollapsedCount === floatGroupCount

  if (!authUserId) {
    return <p style={{ color: 'var(--text-slate-500)' }}>Sign in to use the roadmap.</p>
  }

  if (roadmapsLoading) {
    return <p>Loading roadmaps…</p>
  }

  if (roadmaps.length === 0) {
    return (
      <div style={{ color: 'var(--text-slate-500)' }}>
        <p>No roadmaps yet.</p>
        {canEditTechTree ? (
          <button
            type="button"
            onClick={() => void handleCreateRoadmap()}
            style={{
              marginTop: 8,
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: 'var(--bg-slate-tint)',
              cursor: 'pointer',
            }}
          >
            Create first roadmap
          </button>
        ) : null}
      </div>
    )
  }

  if (!effectiveRoadmapId) {
    return <p style={{ color: 'var(--text-slate-500)' }}>Select a roadmap.</p>
  }

  if (loading) {
    return <p>Loading roadmap…</p>
  }

  const selectedRoadmapTitle = roadmaps.find((r) => r.id === effectiveRoadmapId)?.title ?? 'Roadmap'

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
    <ReactFlowProvider>
    <DndContext
      sensors={dndSensors}
      collisionDetection={closestCenter}
      onDragEnd={(e) => {
        void onTaskDragEnd(e)
      }}
    >
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flex: 1,
        minHeight: 0,
      }}
    >
      <ChecklistTechTreeRoadmapBar
        roadmaps={roadmaps}
        selectedRoadmapId={effectiveRoadmapId}
        onSelectRoadmapId={onRoadmapUrlParamChange}
        canCreateRoadmap={canEditTechTree}
        onCreateRoadmap={() => void handleCreateRoadmap()}
        canOpenMembers={Boolean(effectiveRoadmapId)}
        onOpenMembers={() => setMembersModalOpen(true)}
      />
      {canEditStructure ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <TechTreeRoadmapToolbarActions
              sections="editor"
              canEditTechTree={canEditStructure}
              groupCount={groups.length}
              reorderMode={reorderMode}
              showLineUpInToolbar={!(canEditStructure && treeEdges.length > 0)}
              onAddGroup={() => setAddGroupModal({ kind: 'toolbar' })}
              onLineUp={() => setLineUpModalOpen(true)}
              onToggleReorder={() => setReorderMode((o) => !o)}
            />
          </div>
        </div>
      ) : null}

      <div
        style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          ref={canvasShellRef}
          className="checklistTechTreeCanvasShell"
          style={{
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box',
            ...(isCanvasFullscreen
              ? {
                  height: '100dvh',
                  minHeight: '100dvh',
                  flex: 'none' as const,
                  // CSS fallback (no DOM Fullscreen API): cover the viewport ourselves.
                  ...(cssFullscreen
                    ? {
                        position: 'fixed' as const,
                        inset: 0,
                        width: '100vw',
                        zIndex: 99999,
                      }
                    : null),
                }
              : { flex: 1, minHeight: 280 }),
            border: isCanvasFullscreen ? 'none' : '1px solid #e2e8f0',
            borderRadius: isCanvasFullscreen ? 0 : 8,
            overflow: 'visible',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            className="checklistTechTreeFlowClip"
            style={{
              width: '100%',
              height: '100%',
              minHeight: 0,
              flex: '1 1 0',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
          {groups.length > 0 && !isCanvasFullscreen ? (
            <RoadmapCanvasSearchPanel
              variant="inline"
              inputId="roadmap-graph-search"
              iconButtonStyle={mapCanvasFloatButtonStyle}
              roadmapSearchQuery={roadmapSearchQuery}
              onRoadmapSearchQueryChange={setRoadmapSearchQuery}
              roadmapSearch={roadmapSearch}
              fitViewRoadmapSearchMatches={fitViewRoadmapSearchMatches}
            />
          ) : null}
          {groups.length > 0 && !isCanvasFullscreen ? (
            <div
              className="nodrag nopan"
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 5,
                display: 'flex',
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ChecklistTechTreeMapActionIconButtons
                layout="corner"
                mapCanvasFloatButtonStyle={mapCanvasFloatButtonStyle}
                canEnterFullscreen={true}
                isCanvasFullscreen={isCanvasFullscreen}
                onEnterCanvasFullscreen={enterCanvasFullscreen}
                onOrganize={handleOrganize}
                canEditTechTree={canEditStructure}
                onAddGroup={() => setAddGroupModal({ kind: 'toolbar' })}
                reorderMode={reorderMode}
                onToggleReorder={() => setReorderMode((o) => !o)}
                onShowAll={handleShowAll}
                onCollapseAll={handleCollapseAll}
                showAllFloatDisabled={showAllFloatDisabled}
                collapseAllFloatDisabled={collapseAllFloatDisabled}
                onOpenLinksModal={
                  canEditStructure && treeEdges.length > 0 ? () => setLinksModalOpen(true) : undefined
                }
                linksEdgeCount={treeEdges.length}
              />
            </div>
          ) : null}
          {groups.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--text-slate-500)' }}>
              {canEditStructure
                ? 'Add your first group above to build the roadmap.'
                : 'No roadmap groups yet.'}
            </div>
          ) : (
            <ReactFlow
              style={{ width: '100%', height: '100%' }}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onConnect={onPrereqConnect}
              onConnectEnd={onPrereqConnectEnd}
              isValidConnection={isValidPrereqConnection}
              nodesConnectable={canEditStructure}
              onInit={(instance) => {
                rfInstanceRef.current = instance
                void instance.fitView({ padding: 0.1 })
              }}
              nodeTypes={nodeTypes}
              minZoom={0.2}
              maxZoom={1.4}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              {isCanvasFullscreen && groups.length > 0 ? (
                <RoadmapCanvasSearchPanel
                  variant="fullscreen"
                  inputId="roadmap-graph-search-fullscreen"
                  iconButtonStyle={mapCanvasFloatButtonStyle}
                  roadmapSearchQuery={roadmapSearchQuery}
                  onRoadmapSearchQueryChange={setRoadmapSearchQuery}
                  roadmapSearch={roadmapSearch}
                  fitViewRoadmapSearchMatches={fitViewRoadmapSearchMatches}
                />
              ) : null}
              {isCanvasFullscreen ? (
                <div
                  className="nodrag nopan"
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'rgba(248, 250, 252, 0.97)',
                    borderBottom: '1px solid #e2e8f0',
                    boxSizing: 'border-box',
                    pointerEvents: 'auto',
                  }}
                >
                    <TechTreeRoadmapToolbarActions
                      sections="all"
                      containerClassName="nodrag nopan"
                      canEditTechTree={canEditStructure}
                      groupCount={groups.length}
                      reorderMode={reorderMode}
                      showLineUpInToolbar={!(canEditStructure && treeEdges.length > 0)}
                      onAddGroup={() => setAddGroupModal({ kind: 'toolbar' })}
                      onLineUp={() => setLineUpModalOpen(true)}
                      onToggleReorder={() => setReorderMode((o) => !o)}
                    />
                    <div
                      className="nodrag nopan"
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexShrink: 0,
                      }}
                    >
                      {groups.length > 0 ? (
                        <div
                          className="nodrag nopan"
                          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        >
                          <ChecklistTechTreeMapActionIconButtons
                            layout="header"
                            mapCanvasFloatButtonStyle={mapCanvasFloatButtonStyle}
                            canEnterFullscreen={true}
                            isCanvasFullscreen={isCanvasFullscreen}
                            onEnterCanvasFullscreen={enterCanvasFullscreen}
                            onOrganize={handleOrganize}
                            canEditTechTree={canEditStructure}
                            onAddGroup={() => setAddGroupModal({ kind: 'toolbar' })}
                            reorderMode={reorderMode}
                            onToggleReorder={() => setReorderMode((o) => !o)}
                            onShowAll={handleShowAll}
                            onCollapseAll={handleCollapseAll}
                            showAllFloatDisabled={showAllFloatDisabled}
                            collapseAllFloatDisabled={collapseAllFloatDisabled}
                            onOpenLinksModal={
                              canEditStructure && treeEdges.length > 0
                                ? () => setLinksModalOpen(true)
                                : undefined
                            }
                            linksEdgeCount={treeEdges.length}
                          />
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={exitCanvasFullscreen}
                        className="nodrag nopan checklistTechTreeExitFs"
                        onPointerDown={(e) => e.stopPropagation()}
                        title="Exit full screen (Esc)"
                        aria-label="Exit full screen (Esc)"
                        style={roadmapExitFullscreenIconButtonStyle}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} aria-hidden>
                          <path
                            fill="currentColor"
                            d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM231 231C240.4 221.6 255.6 221.6 264.9 231L319.9 286L374.9 231C384.3 221.6 399.5 221.6 408.8 231C418.1 240.4 418.2 255.6 408.8 264.9L353.8 319.9L408.8 374.9C418.2 384.3 418.2 399.5 408.8 408.8C399.4 418.1 384.2 418.2 374.9 408.8L319.9 353.8L264.9 408.8C255.5 418.2 240.3 418.2 231 408.8C221.7 399.4 221.6 384.2 231 374.9L286 319.9L231 264.9C221.6 255.5 221.6 240.3 231 231z"
                          />
                        </svg>
                      </button>
                    </div>
                </div>
              ) : null}
            </ReactFlow>
          )}
          </div>
        </div>
      </div>

      <ChecklistTechTreeRoadmapMembersModal
        open={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        roadmapId={effectiveRoadmapId}
        roadmapTitle={selectedRoadmapTitle}
        authUserId={authUserId!}
        users={users}
        members={roadmapMembers}
        onMembersChanged={() => void loadRoadmapMembers()}
        canManage={canEditStructure}
        portalContainer={roadmapModalPortalHost ?? undefined}
      />
      <ChecklistTechTreeAddGroupModal
        open={addGroupModal != null}
        onClose={() => setAddGroupModal(null)}
        onSave={handleAddGroupSave}
        linkFromGroupTitle={addGroupModal?.kind === 'linkFromGroup' ? addGroupModal.fromGroupTitle : undefined}
        portalContainer={roadmapModalPortalHost ?? undefined}
      />
      <ChecklistTechTreeLinksModal
        open={linksModalOpen}
        onClose={closeLinksModal}
        portalContainer={roadmapModalPortalHost ?? undefined}
        edgeCount={treeEdges.length}
        groupCount={groups.length}
        linksSearchQuery={linksSearchQuery}
        onLinksSearchChange={setLinksSearchQuery}
        filteredTreeEdges={filteredTreeEdges}
        groups={groups}
        onRemoveEdge={(id) => void removeEdge(id)}
        onOpenLineUp={openLineUpFromLinksModal}
      />
      <ChecklistTechTreeLineUpModal
        open={lineUpModalOpen}
        onClose={() => setLineUpModalOpen(false)}
        groups={groups.map((g) => ({ id: g.id, title: g.title }))}
        onAddLink={addPrereqLink}
        portalContainer={roadmapModalPortalHost ?? undefined}
      />
      <ChecklistTechTreeAddTaskModal
        open={addTaskModalGroupId !== null || editTaskId !== null}
        groupId={addTaskModalGroupId ?? editTaskForModal?.group_id ?? null}
        groupTitle={addTaskModalGroup?.title ?? editTaskModalGroup?.title ?? ''}
        users={users}
        currentUserId={authUserId}
        editingTaskId={editTaskId}
        initialEditTitle={editTaskForModal?.title ?? ''}
        initialEditAssigneeUserIds={editTaskForModal?.assigneeIds ?? []}
        onClose={() => {
          setAddTaskModalGroupId(null)
          setEditTaskId(null)
        }}
        onSave={async (title, assigneeUserIds) => {
          if (editTaskId) {
            return updateTaskInGroup(editTaskId, title, assigneeUserIds)
          }
          if (addTaskModalGroupId) {
            return addTaskToGroup(addTaskModalGroupId, title, assigneeUserIds)
          }
          return false
        }}
        portalContainer={roadmapModalPortalHost ?? undefined}
      />
      <ChecklistTechTreeGroupModal
        open={editingGroupId !== null}
        groupId={editingGroupId}
        initialTitle={editingGroup?.title ?? ''}
        onClose={() => setEditingGroupId(null)}
        onSuccess={() => {
          void load()
        }}
        setError={setError}
        portalContainer={roadmapModalPortalHost ?? undefined}
      />
    </div>
    </DndContext>
    </ReactFlowProvider>
    </div>
  )
}
