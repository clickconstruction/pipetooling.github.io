import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
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
  type ReactFlowInstance,
  type OnConnect,
  type OnConnectEnd,
  type IsValidConnection,
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
  computeCompleteGroupIdsWithMilestones,
  computeUnlockedGroupIds,
  getAddPrereqLinkBlockReason,
  type TechTreeEdge,
} from '../../lib/checklistTechTreeGraph'
import { computeRoadmapSearchMatches } from '../../lib/checklistTechTreeSearch'
import {
  blockingStageTitles,
  bridgeChipFor,
  lockedStageHint,
  stageBadgeFor,
} from '../../lib/roadmapBridge'
import type { Database } from '../../types/database'
import { useChecklistTechTreeData, type TaskView } from '../../hooks/useChecklistTechTreeData'
import { useTechTreeTaskMutations } from '../../hooks/useTechTreeTaskMutations'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { GroupNode, type GroupNodeData } from './ChecklistTechTreeGroupNode'
import { RoadmapCanvasSearchPanel } from './ChecklistTechTreeCanvasSearchPanel'
import { clientCoordsForConnectEnd } from '../../lib/checklistTechTreeCanvas'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import {
  getCurrentFullscreenElement,
  isDomFullscreenEnabled,
  requestElementFullscreen,
  exitDomFullscreen,
} from '../../lib/domFullscreen'
import {
  computeTaskReorderUpdates,
  orderedTaskIdsByGroup,
} from '../../lib/techTreeTaskOrder'
import { ChecklistTechTreeGroupModal } from './ChecklistTechTreeGroupModal'
import { ChecklistTechTreeAddTaskModal } from './ChecklistTechTreeAddTaskModal'
import { ChecklistTechTreeTaskCardModal } from './ChecklistTechTreeTaskCardModal'
import { ChecklistRoadmapPlanView } from './ChecklistRoadmapPlanView'
import { nextUpPicks } from '../../lib/roadmapNextUp'
import { ChecklistRoadmapTimelineView } from './ChecklistRoadmapTimelineView'
import { ChecklistTechTreeOrderStagesModal } from './ChecklistTechTreeOrderStagesModal'
import { computeStageOrderUpdates, computeTaskOrderUpdates, stageNumbersByGroupId, taskNumbersByTaskId } from '../../lib/roadmapStageNumbers'
import { ChecklistTechTreeAddGroupModal } from './ChecklistTechTreeAddGroupModal'
import { ChecklistTechTreeLineUpModal } from './ChecklistTechTreeLineUpModal'
import { ChecklistTechTreeLinksModal } from './ChecklistTechTreeLinksModal'
import { TechTreeRoadmapToolbarActions } from './ChecklistTechTreeRoadmapToolbar'
import { ChecklistTechTreeMapActionIconButtons } from './ChecklistTechTreeMapActionIconButtons'
import { ChecklistTechTreeRoadmapBar } from './ChecklistTechTreeRoadmapBar'
import { ChecklistTechTreeRoadmapMembersModal } from './ChecklistTechTreeRoadmapMembersModal'
import { useToastContext } from '../../contexts/ToastContext'
import { usePromptDialog } from '../../contexts/ConfirmDialogContext'

type RoadmapRow = Database['public']['Tables']['checklist_tech_tree_roadmaps']['Row']
type RoadmapMemberRow = Database['public']['Tables']['checklist_tech_tree_roadmap_members']['Row']


const PREREQ_LINK_TOAST_MS = 2000

type AddPrereqLinkOptions = { fromConnect?: boolean }

const assigneeNameMap = (users: Array<{ id: string; name: string; email: string }>) => {
  const m = new Map<string, string>()
  for (const u of users) m.set(u.id, u.name?.trim() || u.email)
  return m
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

/** React Flow node registry — module-level so the map never re-registers node types. */
const nodeTypes = { groupNode: GroupNode }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function ChecklistTechTreeTab({
  authUserId,
  canEditTechTree,
  setError,
  roadmapIdFromUrl,
  viewFromUrl,
  onRoadmapUrlParamChange,
  onOpenTodayTab,
}: {
  authUserId: string | null
  /** true for dev, master, assistant, primary (matches is_dev_or_master_or_assistant RLS) */
  canEditTechTree: boolean
  setError: (s: string | null) => void
  roadmapIdFromUrl: string | null
  /** `?view=map|plan|timeline` deep link (v2.2138, Dashboard nudge → Plan); wins over the remembered view once, then persists. */
  viewFromUrl?: string | null
  onRoadmapUrlParamChange: (roadmapId: string) => void
  /** Jump to the Today tab — the task card modal's "Open on the checklist". */
  onOpenTodayTab?: () => void
}) {
  const { showToast } = useToastContext()
  const promptDialog = usePromptDialog()
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

  const { groups, tasks, treeEdges, users, loading, load, bridgeByTaskId } = useChecklistTechTreeData(
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

  const graphEdges = useMemo<TechTreeEdge[]>(
    () => treeEdges.map((e) => ({ fromGroupId: e.from_group_id, toGroupId: e.to_group_id })),
    [treeEdges],
  )

  const allGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups])

  // Milestone-aware (v2.1913): task-less goal stages count complete once their
  // predecessors are, so they stop permanently locking everything behind them.
  // Mirrors the SQL in sync_roadmap_to_checklist — keep the two in sync.
  const completeGroupIds = useMemo(
    () => computeCompleteGroupIdsWithMilestones(allGroupIds, graphEdges, tasksByGroup),
    [allGroupIds, graphEdges, tasksByGroup],
  )
  const unlockedIds = useMemo(
    () => computeUnlockedGroupIds(allGroupIds, graphEdges, completeGroupIds),
    [allGroupIds, graphEdges, completeGroupIds],
  )

  // ⚡ Next up (v2.2138): the same picks the Plan panel shows, so Map clusters
  // can mark them — computed once here, rendered as row markers + a stage chip.
  const nextUpTaskIds = useMemo(() => {
    const lanes = nextUpPicks({ groups, tasksByGroup, edges: graphEdges, unlockedIds, completeIds: completeGroupIds })
    return new Set([...lanes.ready, ...lanes.needsName].map((p) => p.taskId))
  }, [groups, tasksByGroup, graphEdges, unlockedIds, completeGroupIds])

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
  // Task card modal (v2.1901): everyone can open it — the activity thread and
  // composer are the point; edit fields inside self-gate on canEditStructure.
  const openEditTask = useCallback((taskId: string) => {
    setAddTaskModalGroupId(null)
    setEditTaskId(taskId)
  }, [])

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
  // Map = the canvas; Plan = the flat work-front list (v2.1913). Remembered
  // per device — field crews live in Plan, structure edits happen in Map.
  // Plan is the landing view for a device with no remembered choice; an
  // explicit toggle (including to Map) still sticks. The key was bumped from
  // roadmap_view_v1 when Plan became the default, deliberately dropping every
  // device's remembered view so the whole team lands on Plan once.
  const [viewMode, setViewMode] = useState<'map' | 'plan' | 'timeline'>(() => {
    try {
      const stored = localStorage.getItem('roadmap_view_v2')
      return stored === 'map' || stored === 'timeline' ? stored : 'plan'
    } catch {
      return 'plan'
    }
  })
  const setViewModePersisted = useCallback((mode: 'map' | 'plan' | 'timeline') => {
    setViewMode(mode)
    try {
      localStorage.setItem('roadmap_view_v2', mode)
    } catch {
      // private mode: toggle still works for the session
    }
  }, [])
  // `?view=` deep link (v2.2138): the Dashboard nudge lands on Plan regardless
  // of the remembered view; the choice then persists like a manual toggle.
  useEffect(() => {
    if (viewFromUrl === 'map' || viewFromUrl === 'plan' || viewFromUrl === 'timeline') setViewModePersisted(viewFromUrl)
  }, [viewFromUrl, setViewModePersisted])
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

  // Task write path (v2.2182): shared with the Review tab's "Where this task fits" sheet.
  const getTaskForMutation = useCallback((taskId: string) => tasks.find((t) => t.id === taskId), [tasks])
  const isGroupUnlockedForMutation = useCallback((groupId: string) => unlockedIds.has(groupId), [unlockedIds])
  const {
    canActOnTask,
    toggleTaskDone,
    loadInstanceEvents,
    postInstanceComment,
    assignTaskToUser,
    updateTaskInGroup,
    toggleTaskPin,
  } = useTechTreeTaskMutations({
    authUserId,
    canEditStructure,
    getTask: getTaskForMutation,
    isGroupUnlocked: isGroupUnlockedForMutation,
    reload: load,
    setError,
  })
  const onToggleTask = useCallback(
    (taskId: string) => {
      void toggleTaskDone(taskId)
    },
    [toggleTaskDone],
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

  const titleByGroupId = useMemo(
    () => new Map(groups.map((g) => [g.id, g.title])),
    [groups],
  )

  // groups arrive sort_index-ordered from the loader, so this is the stage order
  const stageNumbers = useMemo(() => stageNumbersByGroupId(groups), [groups])
  // tasks arrive sort_index-ordered too — task #N.M rides on both orders
  const taskNumbers = useMemo(() => taskNumbersByTaskId(stageNumbers, tasksByGroup), [stageNumbers, tasksByGroup])

  // people already staffed somewhere on this roadmap — the task card's "likely names" picker tier
  const roadmapAssigneeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of tasks) for (const id of t.assigneeIds) ids.add(id)
    return [...ids]
  }, [tasks])

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
          stageNumber: stageNumbers.get(gid) ?? 0,
          locked: !gu,
          badge: stageBadgeFor(tlist.map((t) => ({ completedAt: t.completed_at }))),
          unplanned: tlist.length === 0 && !graphEdges.some((e) => e.toGroupId === gid),
          nextUpCount: tlist.filter((t) => nextUpTaskIds.has(t.id)).length,
          lockedHint: gu
            ? null
            : lockedStageHint(
                blockingStageTitles({ groupId: gid, edges: graphEdges, completeGroupIds, titleByGroupId }),
                tlist.some((t) => t.assigneeIds.length > 0),
              ),
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
              numberLabel: taskNumbers.get(t.id) ?? '',
              completedAt: t.completed_at,
              assigneeLabel: names.length ? names.join(', ') : '',
              canAct: canActOnTask(t, gu),
              bridgeChip: bridgeChipFor(t.completed_at, bridgeByTaskId.get(t.id)),
              nextUp: nextUpTaskIds.has(t.id),
              pinned: Boolean(t.pinned_at),
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
    bridgeByTaskId,
    unlockedIds,
    graphEdges,
    completeGroupIds,
    titleByGroupId,
    stageNumbers,
    taskNumbers,
    nextUpTaskIds,
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
  const [orderStagesModalOpen, setOrderStagesModalOpen] = useState(false)
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

  const saveStageOrder = useCallback(
    async (orderedIds: string[], taskOrdersByGroup: ReadonlyMap<string, string[]>): Promise<boolean> => {
      if (!canEditStructure) return false
      const stageUpdates = computeStageOrderUpdates(orderedIds, groups)
      const taskUpdates = computeTaskOrderUpdates(taskOrdersByGroup, tasks)
      if (stageUpdates.length === 0 && taskUpdates.length === 0) return true
      setError(null)
      try {
        await Promise.all([
          ...stageUpdates.map((u) =>
            withSupabaseRetry(
              () => supabase.from('checklist_tech_tree_groups').update({ sort_index: u.sort_index }).eq('id', u.id),
              'reorder tech tree stage',
            ),
          ),
          ...taskUpdates.map((u) =>
            withSupabaseRetry(
              () => supabase.from('checklist_tech_tree_group_tasks').update({ sort_index: u.sort_index }).eq('id', u.id),
              'reorder tech tree stage task',
            ),
          ),
        ])
        await load()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the order')
        await load()
        return false
      }
    },
    [canEditStructure, groups, tasks, load, setError],
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

  // CSS fullscreen fallback: freeze the page (shared iOS-safe lock, v2.2186) and allow Esc to exit (no native handling).
  useBodyScrollLock(cssFullscreen)
  useEffect(() => {
    if (!cssFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCssFullscreen(false)
        triggerCanvasResize()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
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
    const title = await promptDialog({ message: 'Name for the new roadmap?', confirmLabel: 'Create' })
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
  }, [authUserId, canEditTechTree, loadRoadmaps, onRoadmapUrlParamChange, roadmaps, setError, promptDialog])

  const handleRenameRoadmap = useCallback(async () => {
    if (!canEditTechTree || !effectiveRoadmapId) return
    const current = roadmaps.find((r) => r.id === effectiveRoadmapId)
    const title = await promptDialog({
      message: 'Rename this roadmap',
      defaultValue: current?.title ?? '',
      confirmLabel: 'Rename',
    })
    if (title === null) return
    const trimmed = title.trim()
    if (!trimmed || trimmed === current?.title) return
    try {
      setError(null)
      await withSupabaseRetry(
        () => supabase.from('checklist_tech_tree_roadmaps').update({ title: trimmed }).eq('id', effectiveRoadmapId),
        'rename roadmap',
      )
      await loadRoadmaps()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rename roadmap')
    }
  }, [canEditTechTree, effectiveRoadmapId, roadmaps, promptDialog, loadRoadmaps, setError])

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
    border: '1px solid var(--border)',
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
              border: '1px solid var(--border-strong)',
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
        canRenameRoadmap={canEditTechTree && Boolean(effectiveRoadmapId)}
        onRenameRoadmap={() => void handleRenameRoadmap()}
        canOpenMembers={Boolean(effectiveRoadmapId)}
        onOpenMembers={() => setMembersModalOpen(true)}
        trailing={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }}>
              {(['map', 'plan', 'timeline'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewModePersisted(mode)}
                  aria-pressed={viewMode === mode}
                  style={{
                    border: 'none',
                    padding: '6px 16px',
                    fontSize: '0.8125rem',
                    fontWeight: viewMode === mode ? 600 : 400,
                    background: viewMode === mode ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: viewMode === mode ? 'var(--text-blue-800)' : 'var(--text-700)',
                    cursor: 'pointer',
                  }}
                >
                  {mode === 'map' ? 'Map' : mode === 'plan' ? 'Plan' : 'Timeline'}
                </button>
              ))}
            </div>
            {canEditStructure ? (
              // both views: Order stages (and the empty-graph starters) work
              // from Plan just as well as from Map
              <TechTreeRoadmapToolbarActions
                sections="editor"
                canEditTechTree={canEditStructure}
                groupCount={groups.length}
                reorderMode={reorderMode}
                showLineUpInToolbar={!(canEditStructure && treeEdges.length > 0)}
                onAddGroup={() => setAddGroupModal({ kind: 'toolbar' })}
                onLineUp={() => setLineUpModalOpen(true)}
                onOrderStages={() => setOrderStagesModalOpen(true)}
                onToggleReorder={() => setReorderMode((o) => !o)}
              />
            ) : null}
          </div>
        }
      />
      {viewMode === 'timeline' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '1rem' }}>
          <ChecklistRoadmapTimelineView
            groups={groups.map((g) => ({ id: g.id, title: g.title }))}
            tasks={tasks}
            edges={graphEdges}
            unlockedIds={unlockedIds}
            completeIds={completeGroupIds}
            users={users}
            onOpenTask={openEditTask}
          />
        </div>
      ) : null}
      {viewMode === 'plan' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <ChecklistRoadmapPlanView
            groups={groups.map((g) => ({ id: g.id, title: g.title }))}
            tasks={tasks}
            edges={graphEdges}
            unlockedIds={unlockedIds}
            completeIds={completeGroupIds}
            users={users}
            currentUserId={authUserId}
            canEditStructure={canEditStructure}
            onAssign={assignTaskToUser}
            onOpenTask={openEditTask}
          />
        </div>
      ) : null}
      {viewMode === 'map' ? (
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
            border: isCanvasFullscreen ? 'none' : '1px solid var(--border)',
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
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)',
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
                      onOrderStages={() => setOrderStagesModalOpen(true)}
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
      ) : null}

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
      <ChecklistTechTreeOrderStagesModal
        open={orderStagesModalOpen}
        onClose={() => setOrderStagesModalOpen(false)}
        groups={groups.map((g) => {
          const tlist = tasksByGroup.get(g.id) ?? []
          const done = tlist.filter((t) => t.completed_at != null).length
          const meta = completeGroupIds.has(g.id)
            ? '✓ done'
            : !unlockedIds.has(g.id)
              ? '🔒'
              : tlist.length > 0
                ? `${done} of ${tlist.length}`
                : null
          return {
            id: g.id,
            title: g.title,
            meta,
            tasks: tlist.map((t) => ({ id: t.id, title: t.title, done: t.completed_at != null })),
          }
        })}
        onSave={saveStageOrder}
        portalContainer={roadmapModalPortalHost ?? undefined}
      />
      <ChecklistTechTreeAddTaskModal
        open={addTaskModalGroupId !== null}
        groupId={addTaskModalGroupId}
        groupTitle={addTaskModalGroup?.title ?? ''}
        users={users}
        currentUserId={authUserId}
        onClose={() => setAddTaskModalGroupId(null)}
        onSave={async (title, assigneeUserIds) => {
          if (addTaskModalGroupId) {
            return addTaskToGroup(addTaskModalGroupId, title, assigneeUserIds)
          }
          return false
        }}
        portalContainer={roadmapModalPortalHost ?? undefined}
      />
      <ChecklistTechTreeTaskCardModal
        open={editTaskId !== null}
        task={editTaskForModal ? { id: editTaskForModal.id, title: editTaskForModal.title, assigneeIds: editTaskForModal.assigneeIds } : null}
        groupTitle={editTaskModalGroup?.title ?? ''}
        stageNumber={editTaskModalGroup ? stageNumbers.get(editTaskModalGroup.id) : undefined}
        taskNumberLabel={editTaskForModal ? taskNumbers.get(editTaskForModal.id) : undefined}
        bridge={editTaskForModal ? bridgeByTaskId.get(editTaskForModal.id) : undefined}
        chip={editTaskForModal ? bridgeChipFor(editTaskForModal.completed_at, bridgeByTaskId.get(editTaskForModal.id)) : null}
        users={users}
        suggestedUserIds={roadmapAssigneeIds}
        currentUserId={authUserId}
        canEditStructure={canEditStructure}
        loadEvents={loadInstanceEvents}
        postComment={postInstanceComment}
        onSave={async (title, assigneeUserIds) => {
          if (!editTaskId) return false
          return updateTaskInGroup(editTaskId, title, assigneeUserIds)
        }}
        pinned={Boolean(editTaskForModal?.pinned_at)}
        onTogglePin={async () => (editTaskId ? toggleTaskPin(editTaskId) : false)}
        done={Boolean(editTaskForModal?.completed_at)}
        onToggleDone={
          editTaskForModal && canActOnTask(editTaskForModal, unlockedIds.has(editTaskForModal.group_id))
            ? async () => (editTaskId ? toggleTaskDone(editTaskId) : false)
            : undefined
        }
        onOpenTodayTab={onOpenTodayTab}
        onClose={() => setEditTaskId(null)}
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
