import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties, type PointerEvent } from 'react'
import { pageTabStyle } from '../lib/pageTabStyle'
import { useSearchParams } from 'react-router-dom'
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFarmModeEnabled } from '../hooks/useFarmModeEnabled'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { ChecklistItemEditModal } from '../components/ChecklistItemEditModal'
import ChecklistItemMuteModal from '../components/ChecklistItemMuteModal'
import { ChecklistTitleWithLinks } from '../components/ChecklistTitleWithLinks'
import { compactTimeAgo } from '../lib/subcontractorLastActivityCompact'
import { getNextDisplayOrders } from '../utils/checklistOrder'
import { withSupabaseRetry } from '../utils/errorHandling'
import { ChecklistReviewInboxes } from '../components/checklist/ChecklistReviewInboxes'
import RoadmapTaskContextModal from '../components/checklist/RoadmapTaskContextModal'
import { ChecklistTechTreeTab } from '../components/checklist/ChecklistTechTreeTab'
import { ChecklistInstanceCard } from '../components/checklist/ChecklistInstanceCard'
import { ChecklistHistoryLedger } from '../components/checklist/ChecklistHistoryLedger'
import { historyShortDate, splitHistoryItems } from '../lib/checklistHistorySplit'
import { useIsNarrowScreen } from '../hooks/useIsNarrowScreen'
import { groupEventsByInstance, lastTransitionIsReopen, type ChecklistCardEvent } from '../lib/checklistCardEvents'
import { ChecklistItemActivity } from '../components/checklist/ChecklistItemActivity'
import { completeChecklistInstance } from '../lib/checklistCompleteInstance'
import { qualifiesOutstanding, sortOutstanding, weekStartSunday } from '../lib/checklistHistoryLedger'
import { BOARD_RANGE_LABELS, BOARD_RANGE_ORDER, ageSeverity, initialsFor, oldestAgeDays, type BoardRange } from '../lib/checklistTeamBoard'
import { nextOccurrenceLabel, openAgeLabel, repeatChipLabel } from '../lib/checklistManageGroups'
import { goalsStageRows, goalsStripRows, lockedStageHint, type GoalsStageRow, type GoalsStripRow } from '../lib/roadmapBridge'
import { ChecklistReviewInboxSection } from '../components/checklist/ChecklistReviewInboxSection'
import { ChecklistOutstandingSection } from '../components/checklist/ChecklistOutstandingSection'

type UserRole =
  | 'dev'
  | 'master_technician'
  | 'assistant'
  | 'subcontractor'
  | 'helpers'
  | 'estimator'
  | 'primary'
  | 'superintendent'
type ChecklistTab = 'today' | 'history' | 'roadmap' | 'review' | 'manage'

type ChecklistInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  completed_at: string | null
  notes: string | null
  completed_by_user_id: string | null
  created_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  checklist_items?: {
    title: string
    links?: string[] | null
    notify_on_complete_user_id?: string | null
    notify_creator_on_complete?: boolean
    created_at?: string | null
    created_by_user_id?: string | null
    show_until_completed?: boolean | null
    repeat_type?: string | null
    roadmap_group_task_id?: string | null
    checklist_tech_tree_group_tasks?: RoadmapTaskEmbed | null
  } | null
}

type RoadmapTaskEmbed = {
  group_id?: string
  checklist_tech_tree_groups?: {
    roadmap_id?: string
    checklist_tech_tree_roadmaps?: { title?: string | null } | null
  } | null
}

/**
 * "⛰ <roadmap title>" chip for roadmap-born items; title falls back to "goal"
 * when RLS hides the tree (field roles). With `onOpen` it becomes a button
 * opening the "Where this task fits" modal (v2.2087).
 */
function roadmapGoalChip(
  item: { roadmap_group_task_id?: string | null; checklist_tech_tree_group_tasks?: RoadmapTaskEmbed | null } | null | undefined,
  onOpen?: (roadmapGroupTaskId: string) => void,
) {
  if (!item?.roadmap_group_task_id) return null
  const title = item.checklist_tech_tree_group_tasks?.checklist_tech_tree_groups?.checklist_tech_tree_roadmaps?.title?.trim()
  const chipStyle = {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.12rem 0.5rem',
    borderRadius: 7,
    background: 'var(--bg-purple-tint, var(--bg-blue-tint))',
    color: 'var(--text-purple-800, var(--text-blue-800))',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  } as const
  if (!onOpen) {
    return <span style={chipStyle}>⛰ {title || 'goal'}</span>
  }
  const taskId = item.roadmap_group_task_id
  return (
    <button
      type="button"
      title="See where this task fits in the roadmap"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(taskId)
      }}
      style={{ ...chipStyle, font: 'inherit', ...{ fontSize: chipStyle.fontSize, fontWeight: chipStyle.fontWeight }, border: 'none', cursor: 'pointer' }}
    >
      ⛰ {title || 'goal'}
    </button>
  )
}

const tabStyle = pageTabStyle

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Checklist() {
  const { user: authUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [role, setRole] = useState<UserRole | null>(null)
  const [activeTab, setActiveTab] = useState<ChecklistTab>('today')
  const tabStripRef = useRef<HTMLDivElement | null>(null)

  // keep the active pill visible in the one-row scrollable strip (v2.1970)
  useEffect(() => {
    const strip = tabStripRef.current
    const el = strip?.querySelector<HTMLElement>('button[data-active="true"]')
    if (!strip || !el) return
    const left = el.offsetLeft
    const right = left + el.offsetWidth
    if (left < strip.scrollLeft || right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: Math.max(0, left - 16) })
    }
  }, [activeTab])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    supabase.from('users').select('role').eq('id', authUser.id).single().then(({ data }) => {
      setRole((data as { role: UserRole } | null)?.role ?? null)
      setLoading(false)
    })
  }, [authUser?.id])

  // Farm Mode (checklist-only lens): the page keeps just Today + History; the
  // office tabs hide and their deep links bounce to Today until the mode is off.
  const [farmModeEnabled] = useFarmModeEnabled(authUser?.id ?? null)

  // Roadmap is dev-only for now (owner request, 2026-08-10) — hide the tab and
  // bounce deep links for everyone else. Widen this gate to re-release it.
  const canSeeRoadmap = role === 'dev' && !farmModeEnabled

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (farmModeEnabled && (tab === 'review' || tab === 'manage' || tab === 'roadmap')) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'today')
        next.delete('roadmap')
        return next
      }, { replace: true })
      return
    }
    if (tab === 'roadmap' && role !== null && !canSeeRoadmap) {
      // Deep link from a non-dev: rewrite to their default tab instead.
      const fallbackTab =
        role === 'master_technician' || isAssistantLike(role) ? 'review' : 'today'
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', fallbackTab)
        next.delete('roadmap')
        return next
      }, { replace: true })
      return
    }
    if (tab === 'today' || tab === 'history' || tab === 'review' || tab === 'manage' || (tab === 'roadmap' && canSeeRoadmap)) {
      setActiveTab(tab)
    } else if (!tab && role !== null) {
      const defaultTab =
        !farmModeEnabled && (role === 'dev' || role === 'master_technician' || isAssistantLike(role))
          ? 'review'
          : 'today'
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', defaultTab)
        return next
      }, { replace: true })
    }
  }, [searchParams, role, canSeeRoadmap, farmModeEnabled])

  const canManageChecklists =
    (role === 'dev' || role === 'master_technician' || isAssistantLike(role)) && !farmModeEnabled
  /** Matches is_dev_or_master_or_assistant() in DB (includes primary) for roadmap structure + staff overrides */
  const canEditTechTree =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
  const [editItemId, setEditItemId] = useState<string | null>(null)

  const onRoadmapUrlParamChange = useCallback(
    (roadmapId: string) => {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'roadmap')
        next.set('roadmap', roadmapId)
        return next
      })
    },
    [setSearchParams],
  )

  /** Roadmap task card → "Open on the checklist" (v2.1901). */
  const onOpenTodayTab = useCallback(() => {
    setActiveTab('today')
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'today')
      next.delete('roadmap')
      return next
    })
  }, [setSearchParams])

  if (loading) return <p style={{ padding: '2rem' }}>Loading…</p>

  return (
    <div
      style={{
        padding:
          activeTab === 'roadmap' ? '0.25rem 1.5rem 0.25rem' : '0.25rem 1.5rem 1.5rem',
        ...(activeTab === 'roadmap'
          ? {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }
          : {}),
      }}
    >
      <div className="checklist-tab-bar">
        <div className="checklist-tab-strip" ref={tabStripRef}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('today')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'today')
              return next
            })
          }}
          data-active={activeTab === 'today'}
          style={tabStyle(activeTab === 'today')}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('history')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'history')
              return next
            })
          }}
          data-active={activeTab === 'history'}
          style={tabStyle(activeTab === 'history')}
        >
          History
        </button>
        {canManageChecklists && (
          <>
            <button
              type="button"
              onClick={() => {
                setActiveTab('review')
                setSearchParams((p) => {
                  const next = new URLSearchParams(p)
                  next.set('tab', 'review')
                  return next
                })
              }}
              data-active={activeTab === 'review'}
          style={tabStyle(activeTab === 'review')}
            >
              Review
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('manage')
                setSearchParams((p) => {
                  const next = new URLSearchParams(p)
                  next.set('tab', 'manage')
                  return next
                })
              }}
              data-active={activeTab === 'manage'}
          style={tabStyle(activeTab === 'manage')}
            >
              Manage
            </button>
          </>
        )}
        {canSeeRoadmap && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('roadmap')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'roadmap')
                return next
              })
            }}
            data-active={activeTab === 'roadmap'}
          style={tabStyle(activeTab === 'roadmap')}
          >
            Roadmap
          </button>
        )}
        </div>
        <h1 className="checklist-tab-title">Checklist</h1>
      </div>

      {activeTab === 'today' && (
        <ChecklistTodayTab authUserId={authUser?.id ?? null} isDev={role === 'dev'} setError={setError} />
      )}
      {activeTab === 'history' && (
        <ChecklistHistoryTab authUserId={authUser?.id ?? null} canViewOthers={canManageChecklists} canEditHistory={role === 'dev'} setError={setError} />
      )}
      {activeTab === 'roadmap' && canSeeRoadmap && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ChecklistTechTreeTab
            authUserId={authUser?.id ?? null}
            canEditTechTree={canEditTechTree}
            setError={setError}
            roadmapIdFromUrl={searchParams.get('roadmap')}
            onRoadmapUrlParamChange={onRoadmapUrlParamChange}
            onOpenTodayTab={onOpenTodayTab}
          />
        </div>
      )}
      {activeTab === 'review' && canManageChecklists && (
        <ChecklistOutstandingTab authUserId={authUser?.id ?? null} isDev={role === 'dev'} canManageChecklists={canManageChecklists} setError={setError} setEditItemId={setEditItemId} onOpenRoadmap={canSeeRoadmap ? onRoadmapUrlParamChange : undefined} />
      )}
      {activeTab === 'manage' && canManageChecklists && (
        <ChecklistManageTab authUserId={authUser?.id ?? null} role={role} setError={setError} setEditItemId={setEditItemId} onOpenRoadmap={canSeeRoadmap ? onRoadmapUrlParamChange : undefined} />
      )}
      {editItemId && (
        <ChecklistItemEditModal
          itemId={editItemId}
          onClose={() => setEditItemId(null)}
          onSaved={() => {}}
          setError={setError}
          role={role}
        />
      )}

      {error && <p style={{ color: 'var(--text-red-700)', marginTop: '1rem' }}>{error}</p>}
    </div>
  )
}

function ChecklistTodayTab({ authUserId, isDev, setError }: { authUserId: string | null; isDev: boolean; setError: (s: string | null) => void }) {
  const [todayInstances, setTodayInstances] = useState<ChecklistInstance[]>([])
  const [upcomingInstances, setUpcomingInstances] = useState<ChecklistInstance[]>([])
  const [upcomingExpanded, setUpcomingExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const toggleCompleteInFlightRef = useRef(new Set<string>())
  /** Oldest-first card history per instance (checklist_instance_events, v2.1842). */
  const [eventsByInstance, setEventsByInstance] = useState<Map<string, ChecklistCardEvent[]>>(new Map())
  /** Overdue one-offs + show-until-completed items (Outstanding section, v2.1864). */
  const [outstandingInstances, setOutstandingInstances] = useState<ChecklistInstance[]>([])
  const [eventActorNameById, setEventActorNameById] = useState<Record<string, string>>({})
  const [fwdInstance, setFwdInstance] = useState<ChecklistInstance | null>(null)
  const [fwdTitle, setFwdTitle] = useState('')
  const [fwdAssigneeId, setFwdAssigneeId] = useState('')
  const [fwdSaving, setFwdSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [muteModalItemId, setMuteModalItemId] = useState<string | null>(null)
  const [muteModalTitle, setMuteModalTitle] = useState('')

  const fwdMissingFields: string[] = []
  if (!fwdTitle.trim()) fwdMissingFields.push('Title')
  if (!fwdAssigneeId) fwdMissingFields.push('Assignee')
  const fwdCanSubmit = fwdMissingFields.length === 0

  useEffect(() => {
    if (!authUserId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([loadToday(), loadUpcoming()]).finally(() => setLoading(false))
  }, [authUserId])

  useEffect(() => {
    if (isDev) {
      supabase
        .from('users')
        .select('id, name, email')
        .is('archived_at', null)
        .order('name')
        .then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    }
  }, [isDev])

  async function loadToday() {
    if (!authUserId) return
    const today = toLocalDateString(new Date())
    const { data: todayData, error: e1 } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, reviewed_at, reviewed_by, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_at, created_by_user_id, repeat_type, roadmap_group_task_id, checklist_tech_tree_group_tasks(group_id, checklist_tech_tree_groups(roadmap_id, checklist_tech_tree_roadmaps(title)))), checklist_instance_assignees!inner(user_id)')
      .eq('checklist_instance_assignees.user_id', authUserId)
      .eq('scheduled_date', today)
      .order('created_at', { ascending: true })
    if (e1) {
      setError(e1.message)
      return
    }
    // Outstanding (v2.1864, widened v2.1869): overdue instances whose work is
    // still wanted — one-off tasks, show-until-completed items, OR anything a
    // human deliberately reopened (last transition = reopened outranks the
    // recurrings-don't-carry-over rule). One capped query, qualified
    // client-side so the reopened check can share the same rows.
    const { data: pastData } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, reviewed_at, reviewed_by, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_at, created_by_user_id, show_until_completed, repeat_type, roadmap_group_task_id, checklist_tech_tree_group_tasks(group_id, checklist_tech_tree_groups(roadmap_id, checklist_tech_tree_roadmaps(title)))), checklist_instance_assignees!inner(user_id)')
      .eq('checklist_instance_assignees.user_id', authUserId)
      .is('completed_at', null)
      .lt('scheduled_date', today)
      .order('scheduled_date', { ascending: false })
      .limit(300)
    const pastIncomplete = (pastData ?? []) as ChecklistInstance[]
    const qualifying = pastIncomplete.filter((i) => qualifiesOutstanding(i.checklist_items))
    const rest = pastIncomplete.filter((i) => !qualifiesOutstanding(i.checklist_items))
    let reopenedOnes: ChecklistInstance[] = []
    if (rest.length > 0) {
      const { data: transData } = await supabase
        .from('checklist_instance_events')
        .select('id, instance_id, event_type, actor_user_id, body, created_at')
        .in('instance_id', rest.map((r) => r.id))
        .in('event_type', ['completed', 'reopened'])
        .order('created_at', { ascending: true })
      const grouped = groupEventsByInstance((transData ?? []) as ChecklistCardEvent[])
      reopenedOnes = rest.filter((i) => lastTransitionIsReopen(grouped.get(i.id) ?? []))
    }
    const overdueData = [...qualifying, ...reopenedOnes]
    setOutstandingInstances(sortOutstanding(overdueData))
    const merged = [...(todayData ?? [])] as ChecklistInstance[]
    const mergedItemIds = [...new Set(merged.map((r) => r.checklist_item_id))]
    const orderMap = new Map<string, number>()
    if (mergedItemIds.length > 0) {
      const { data: orderData } = await supabase
        .from('checklist_item_assignees')
        .select('checklist_item_id, display_order')
        .eq('user_id', authUserId)
        .in('checklist_item_id', mergedItemIds)
      for (const row of (orderData ?? []) as Array<{ checklist_item_id: string; display_order: number | null }>) {
        orderMap.set(row.checklist_item_id, row.display_order ?? 999999)
      }
    }
    merged.sort((a, b) => {
      const orderA = orderMap.get(a.checklist_item_id) ?? 999999
      const orderB = orderMap.get(b.checklist_item_id) ?? 999999
      if (orderA !== orderB) return orderA - orderB
      return a.scheduled_date.localeCompare(b.scheduled_date)
    })
    setTodayInstances(merged)
    void loadCardEvents([...merged.map((r) => r.id), ...overdueData.map((r) => r.id)])
  }

  /** Fetch the card history for the visible instances + names for its actors. */
  async function loadCardEvents(instanceIds: string[]) {
    if (instanceIds.length === 0) {
      setEventsByInstance(new Map())
      return
    }
    const { data, error: e } = await supabase
      .from('checklist_instance_events')
      .select('id, instance_id, event_type, actor_user_id, body, created_at')
      .in('instance_id', instanceIds)
      .order('created_at', { ascending: true })
    if (e) return
    const events = (data ?? []) as ChecklistCardEvent[]
    setEventsByInstance(groupEventsByInstance(events))
    const actorIds = [...new Set(events.map((ev) => ev.actor_user_id).filter((v): v is string => !!v))]
    const missing = actorIds.filter((id) => !(id in eventActorNameById))
    if (missing.length > 0) {
      const { data: nameRows } = await supabase.from('users').select('id, name').in('id', missing)
      if (nameRows) {
        setEventActorNameById((prev) => {
          const next = { ...prev }
          for (const r of nameRows as Array<{ id: string; name: string | null }>) {
            next[r.id] = (r.name ?? '').trim() || 'Someone'
          }
          return next
        })
      }
    }
  }

  /** Post a comment event; returns true on success (card clears its draft). */
  /** After the activity panel posts a note, keep the card badges honest. */
  function appendLocalCardComment(instanceId: string, body: string) {
    if (!authUserId) return
    setEventsByInstance((prev) => {
      const next = new Map(prev)
      const list = [...(next.get(instanceId) ?? [])]
      list.push({
        id: `local-${Date.now()}`,
        instance_id: instanceId,
        event_type: 'comment',
        actor_user_id: authUserId,
        body,
        created_at: new Date().toISOString(),
      })
      next.set(instanceId, list)
      return next
    })
  }

  async function postCardComment(inst: ChecklistInstance, body: string): Promise<boolean> {
    if (!authUserId) return false
    const { error: e } = await supabase.from('checklist_instance_events').insert({
      instance_id: inst.id,
      event_type: 'comment',
      actor_user_id: authUserId,
      body,
    })
    if (e) {
      setError(e.message)
      return false
    }
    void loadCardEvents(todayInstances.map((r) => r.id))
    return true
  }

  async function loadUpcoming() {
    if (!authUserId) return
    const today = toLocalDateString(new Date())
    const { data, error: e } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, reviewed_at, reviewed_by, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id, roadmap_group_task_id, checklist_tech_tree_group_tasks(group_id, checklist_tech_tree_groups(roadmap_id, checklist_tech_tree_roadmaps(title)))), checklist_instance_assignees!inner(user_id)')
      .eq('checklist_instance_assignees.user_id', authUserId)
      .gt('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(30)
    if (e) return
    setUpcomingInstances((data ?? []) as ChecklistInstance[])
  }

  async function toggleComplete(inst: ChecklistInstance) {
    if (!authUserId) return
    if (toggleCompleteInFlightRef.current.has(inst.id)) return
    toggleCompleteInFlightRef.current.add(inst.id)

    setError(null)
    const isCompleted = !!inst.completed_at
    const nextCompletedAt = isCompleted ? null : new Date().toISOString()
    const nextCompletedBy = isCompleted ? null : authUserId
    const previous = inst

    setTodayInstances((prev) =>
      prev.map((row) =>
        row.id === inst.id
          ? {
              ...row,
              completed_at: nextCompletedAt,
              completed_by_user_id: nextCompletedBy,
            }
          : row,
      ),
    )

    try {
      // Notes are no longer written here — card comments live in
      // checklist_instance_events; the completion trigger logs the transition.
      const { error: e } = await supabase
        .from('checklist_instances')
        .update({
          completed_at: nextCompletedAt,
          completed_by_user_id: nextCompletedBy,
        })
        .eq('id', inst.id)
      if (e) throw e
      await loadToday()
      if (!isCompleted) {
        void sendCompletionNotifications(inst)
        void maybeCreateNextInstance(inst)
      }
    } catch (e: unknown) {
      setTodayInstances((prev) => prev.map((row) => (row.id === inst.id ? previous : row)))
      setError(e instanceof Error ? e.message : 'Failed to update checklist')
    } finally {
      toggleCompleteInFlightRef.current.delete(inst.id)
    }
  }

  async function sendCompletionNotifications(inst: ChecklistInstance) {
    const { data: item } = await supabase
      .from('checklist_items')
      .select('notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id, title')
      .eq('id', inst.checklist_item_id)
      .single()
    if (!item) return
    const title = (item as { title: string }).title
    const assigneeName = 'You' // could fetch from users
    const body = `${assigneeName} completed: ${title}`
    const recipients: string[] = []
    const notifyUserId = (item as { notify_on_complete_user_id: string | null }).notify_on_complete_user_id
    if (notifyUserId) recipients.push(notifyUserId)
    const notifyCreator = (item as { notify_creator_on_complete: boolean }).notify_creator_on_complete
    const creatorId = (item as { created_by_user_id: string }).created_by_user_id
    if (notifyCreator && creatorId && !recipients.includes(creatorId)) recipients.push(creatorId)
    for (const uid of recipients) {
      try {
        await supabase.functions.invoke('send-checklist-notification', {
          body: {
            recipient_user_id: uid,
            push_title: 'Checklist completed',
            push_body: body,
            push_url: '/checklist',
            tag: `checklist-${inst.id}`,
          },
        })
      } catch {
        // ignore
      }
    }
  }

  async function maybeCreateNextInstance(inst: ChecklistInstance) {
    const [{ data: item }, { data: assignees }] = await Promise.all([
      supabase.from('checklist_items').select('repeat_type, repeat_days_after, repeat_end_date').eq('id', inst.checklist_item_id).single(),
      supabase.from('checklist_item_assignees').select('user_id').eq('checklist_item_id', inst.checklist_item_id),
    ])
    if (!item) return
    const rt = (item as { repeat_type: string }).repeat_type
    if (rt !== 'days_after_completion') return
    const daysAfter = (item as { repeat_days_after: number | null }).repeat_days_after
    if (!daysAfter) return
    const assigneeIds = (assignees ?? []).map((r: { user_id: string }) => r.user_id)
    if (assigneeIds.length === 0) return
    const endDate = (item as { repeat_end_date: string | null }).repeat_end_date
    const nextDate = new Date(inst.scheduled_date)
    nextDate.setDate(nextDate.getDate() + daysAfter)
    const nextDateStr = toLocalDateString(nextDate)
    if (endDate && nextDateStr > endDate) return
    const existing = await supabase
      .from('checklist_instances')
      .select('id')
      .eq('checklist_item_id', inst.checklist_item_id)
      .eq('scheduled_date', nextDateStr)
      .single()
    if (existing.data) return
    const { data: newInst } = await supabase
      .from('checklist_instances')
      .insert({ checklist_item_id: inst.checklist_item_id, scheduled_date: nextDateStr })
      .select('id')
      .single()
    if (newInst?.id) {
      await supabase.from('checklist_instance_assignees').insert(
        assigneeIds.map((uid) => ({ checklist_instance_id: newInst.id, user_id: uid }))
      )
    }
    await loadUpcoming()
  }

  function isNotificationRecipient(inst: ChecklistInstance): boolean {
    if (!authUserId) return false
    const item = inst.checklist_items as {
      notify_on_complete_user_id?: string | null
      notify_creator_on_complete?: boolean
      created_by_user_id?: string | null
    } | null
    if (!item) return false
    if (item.notify_on_complete_user_id === authUserId) return true
    if (item.notify_creator_on_complete && item.created_by_user_id === authUserId) return true
    return false
  }

  function openMuteModal(inst: ChecklistInstance) {
    const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
    setMuteModalItemId(inst.checklist_item_id)
    setMuteModalTitle(title)
  }

  function openFwd(inst: ChecklistInstance) {
    const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
    setFwdInstance(inst)
    setFwdTitle(title)
    setFwdAssigneeId('')
  }

  async function saveFwd() {
    if (!fwdInstance || !authUserId || !fwdTitle.trim() || !fwdAssigneeId) return
    setFwdSaving(true)
    setError(null)
    try {
      const { data: sourceItem } = await supabase
        .from('checklist_items')
        .select('notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope')
        .eq('id', fwdInstance.checklist_item_id)
        .single()
      const src = sourceItem as { notify_on_complete_user_id: string | null; notify_creator_on_complete: boolean; reminder_time: string | null; reminder_scope: string | null } | null
      const { data: newItem, error: itemErr } = await supabase
        .from('checklist_items')
        .insert({
          title: fwdTitle.trim(),
          created_by_user_id: authUserId,
          repeat_type: 'once',
          start_date: fwdInstance.scheduled_date,
          notify_on_complete_user_id: src?.notify_on_complete_user_id ?? null,
          notify_creator_on_complete: src?.notify_creator_on_complete ?? false,
          reminder_time: src?.reminder_time ?? null,
          reminder_scope: src?.reminder_scope ?? null,
        })
        .select('id')
        .single()
      if (itemErr) throw itemErr
      if (newItem?.id && fwdAssigneeId) {
        const nextOrders = await getNextDisplayOrders([fwdAssigneeId])
        await supabase.from('checklist_item_assignees').insert({
          checklist_item_id: newItem.id,
          user_id: fwdAssigneeId,
          display_order: nextOrders.get(fwdAssigneeId) ?? 1,
        })
        const { data: newInst } = await supabase
          .from('checklist_instances')
          .insert({ checklist_item_id: newItem.id, scheduled_date: fwdInstance.scheduled_date })
          .select('id')
          .single()
        if (newInst?.id) {
          await supabase.from('checklist_instance_assignees').insert({ checklist_instance_id: newInst.id, user_id: fwdAssigneeId })
        }
        await supabase.from('checklist_instances').delete().eq('id', fwdInstance.id)
      }
      setFwdInstance(null)
      await loadToday()
      await loadUpcoming()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to forward')
    } finally {
      setFwdSaving(false)
    }
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Today</h2>
        {todayInstances.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No checklist items due today.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {todayInstances.map((inst) => {
              const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
              const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
              return (
                <ChecklistInstanceCard
                  key={inst.id}
                  instance={inst}
                  title={<><ChecklistTitleWithLinks title={title} links={links} /> {roadmapGoalChip(inst.checklist_items)}</>}
                  events={eventsByInstance.get(inst.id) ?? []}
                  nameById={eventActorNameById}
                  currentUserId={authUserId}
                  onToggleComplete={() => void toggleComplete(inst)}
                  onPostComment={(body) => postCardComment(inst, body)}
                  fullHistory={{
                    item: {
                      id: inst.checklist_item_id,
                      title,
                      created_at: inst.checklist_items?.created_at ?? null,
                      created_by_user_id: inst.checklist_items?.created_by_user_id ?? null,
                    },
                    showInstanceDays: (inst.checklist_items?.repeat_type ?? 'once') !== 'once',
                    setError,
                    onPosted: appendLocalCardComment,
                    // Today's own toggle keeps its optimistic updates + side effects.
                    onComplete: async () => {
                      await toggleComplete(inst)
                      return true
                    },
                  }}
                  actions={
                    <>
                      {isNotificationRecipient(inst) && (
                        <button
                          type="button"
                          onClick={() => openMuteModal(inst)}
                          style={{
                            padding: '0.35rem',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 4,
                            background: 'var(--surface)',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            lineHeight: 1,
                          }}
                          title="Mute notifications for this task"
                          aria-label="Mute notifications for this task"
                        >
                          🔕
                        </button>
                      )}
                      {isDev && (
                        <button
                          type="button"
                          className="fwd-btn-desktop"
                          onClick={() => openFwd(inst)}
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            border: '1px solid #3b82f6',
                            borderRadius: 4,
                            background: '#3b82f6',
                            color: 'white',
                            cursor: 'pointer',
                          }}
                        >
                          FWD
                        </button>
                      )}
                    </>
                  }
                />
              )
            })}
          </ul>
        )}
      </section>

      <ChecklistOutstandingSection
        instances={outstandingInstances}
        eventsByInstance={eventsByInstance}
        currentUserId={authUserId}
        todayStr={toLocalDateString(new Date())}
        titleFor={(inst) => {
          const item = (inst as ChecklistInstance).checklist_items
          return (
            <>
              <ChecklistTitleWithLinks title={item?.title ?? 'Untitled'} links={item?.links} /> {roadmapGoalChip(item)}
            </>
          )
        }}
        activityFor={(inst) => {
          const full = inst as ChecklistInstance
          return {
            item: {
              id: full.checklist_item_id,
              title: full.checklist_items?.title ?? 'Untitled',
              created_at: full.checklist_items?.created_at ?? null,
              created_by_user_id: full.checklist_items?.created_by_user_id ?? null,
            },
            showInstanceDays: (full.checklist_items?.repeat_type ?? 'once') !== 'once',
          }
        }}
        onToggleComplete={(inst) => void toggleComplete(inst as ChecklistInstance)}
        onPosted={appendLocalCardComment}
        onCompleteForActivity={async (inst) => {
          await toggleComplete(inst as ChecklistInstance)
          return true
        }}
        setError={setError}
      />

      <section>
        <button
          type="button"
          onClick={() => setUpcomingExpanded(!upcomingExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '1rem',
          }}
        >
          {upcomingExpanded ? '▼' : '▶'} Upcoming
        </button>
        {upcomingExpanded && (
          <div style={{ marginTop: '0.5rem' }}>
            {upcomingInstances.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No upcoming items.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {upcomingInstances.map((inst) => {
                  const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
                  const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
                  return (
                    <li
                      key={inst.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{inst.scheduled_date}</span>
                      <span style={{ flex: 1 }}><ChecklistTitleWithLinks title={title} links={links} /></span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        {isNotificationRecipient(inst) && (
                          <button
                            type="button"
                            onClick={() => openMuteModal(inst)}
                            style={{
                              padding: '0.25rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: 'var(--surface)',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              lineHeight: 1,
                            }}
                            title="Mute notifications for this task"
                            aria-label="Mute notifications for this task"
                          >
                            🔕
                          </button>
                        )}
                        {isDev && (
                          <button
                            type="button"
                            className="fwd-btn-desktop"
                            onClick={() => openFwd(inst)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              border: '1px solid #3b82f6',
                              borderRadius: 4,
                              background: '#3b82f6',
                              color: 'white',
                              cursor: 'pointer',
                            }}
                          >
                            FWD
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {fwdInstance && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
          onClick={(e) => e.target === e.currentTarget && setFwdInstance(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.5rem',
              minWidth: 320,
              maxWidth: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Forward task</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Title</label>
                <input
                  type="text"
                  value={fwdTitle}
                  onChange={(e) => setFwdTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Assign to</label>
                <select
                  value={fwdAssigneeId}
                  onChange={(e) => setFwdAssigneeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={saveFwd}
                disabled={!fwdCanSubmit || fwdSaving}
                title={!fwdCanSubmit ? `Required: ${fwdMissingFields.join(', ')}` : undefined}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: fwdCanSubmit && !fwdSaving ? 'pointer' : 'not-allowed',
                  fontWeight: 500,
                }}
              >
                {fwdSaving ? 'Saving…' : 'Forward'}
              </button>
              {!fwdCanSubmit && !fwdSaving && fwdMissingFields.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem', display: 'inline-block' }}>
                <span style={{ display: 'block' }}>Required:</span>
                {fwdMissingFields.map((f) => (
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                ))}
              </span>
              )}
              <button
                type="button"
                onClick={() => setFwdInstance(null)}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-200)', color: 'var(--text-700)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ChecklistItemMuteModal
        open={!!muteModalItemId}
        checklistItemId={muteModalItemId}
        taskTitle={muteModalTitle}
        authUserId={authUserId}
        onClose={() => setMuteModalItemId(null)}
        onSaved={() => {}}
      />
    </div>
  )
}

function ChecklistHistoryTab({ authUserId, canViewOthers, canEditHistory, setError }: { authUserId: string | null; canViewOthers: boolean; canEditHistory: boolean; setError: (s: string | null) => void }) {
  const confirmDialog = useConfirmDialog()
  const isNarrow = useIsNarrowScreen()
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [loading, setLoading] = useState(true)
  // Phones default to 1 month — the day-ledger reads top-down and a season of
  // scrollback buries last week; desktop keeps the 6-month grid default.
  const [monthsBack, setMonthsBack] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches ? 1 : 6,
  )
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [selectedUserId, setSelectedUserId] = useState<string>(authUserId ?? '')
  const [editMode, setEditMode] = useState(false)
  const [cyclingCell, setCyclingCell] = useState<string | null>(null)
  const [deletedCells, setDeletedCells] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedUserId((prev) => (authUserId && !prev ? authUserId : prev))
  }, [authUserId])

  useEffect(() => {
    if (canViewOthers) {
      supabase
        .from('users')
        .select('id, name, email')
        .is('archived_at', null)
        .order('name')
        .then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    }
  }, [canViewOthers])

  useEffect(() => {
    setDeletedCells(new Set())
    if (!selectedUserId) {
      setLoading(false)
      return
    }
    loadHistory()
  }, [selectedUserId, monthsBack])

  async function loadHistory() {
    if (!selectedUserId) return
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - monthsBack)
    const startStr = toLocalDateString(start)
    const endStr = toLocalDateString(end)
    const { data, error } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, completed_at, completed_by_user_id, notes, created_at, reviewed_at, reviewed_by, checklist_items(title, links, repeat_type, created_at), checklist_instance_assignees!inner(user_id)')
      .eq('checklist_instance_assignees.user_id', selectedUserId)
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date', { ascending: true })
    if (error) {
      setLoading(false)
      return
    }
    setInstances((data ?? []) as ChecklistInstance[])
    setLoading(false)
  }

  if (loading) return <p>Loading…</p>

  // Repeating rows keep the grid (starting at each task's birthday); one-offs
  // move to the created → done ledger below it (v2.2091).
  const { repeating, oneOffs } = splitHistoryItems(instances, selectedUserId, toLocalDateString(new Date()))

  // Grid columns come from repeating instances only — a one-off's lone date no
  // longer mints a column of dashed boxes for every other row.
  const allDates = new Set<string>()
  for (const row of repeating) for (const d of Object.keys(row.dates)) allDates.add(d)
  const sortedDates = Array.from(allDates).sort()

  const instanceByKey = new Map<string, { id: string; checklist_item_id: string; scheduled_date: string }>()
  for (const inst of instances) {
    instanceByKey.set(`${inst.checklist_item_id}-${inst.scheduled_date}`, {
      id: inst.id,
      checklist_item_id: inst.checklist_item_id,
      scheduled_date: inst.scheduled_date,
    })
  }

  async function handleCycleStatus(itemId: string, date: string) {
    if (!editMode || cyclingCell || !selectedUserId) return
    // Edit mode rewrites prod rows on a single click — make it a two-step.
    const proceed = await confirmDialog({
      message: `Change ${date} for this item? (cycles completed → missed → not due)`,
      confirmLabel: 'Change',
    })
    if (!proceed) return
    const key = `${itemId}-${date}`
    const cellInst = instances.find((i) => i.checklist_item_id === itemId && i.scheduled_date === date)
    const rawStatus = !cellInst
      ? undefined
      : cellInst.completed_at
        ? cellInst.completed_by_user_id && cellInst.completed_by_user_id !== selectedUserId
          ? ('completed_by_other' as const)
          : ('completed' as const)
        : ('incomplete' as const)
    const status = deletedCells.has(key) ? undefined : rawStatus
    setCyclingCell(key)
    setError(null)
    try {
      if (status === 'incomplete') {
        const inst = instanceByKey.get(key)
        if (!inst) return
        const { error: err } = await supabase.from('checklist_instances').delete().eq('id', inst.id)
        if (err) {
          setError(err.message)
          return
        }
        setDeletedCells((prev) => new Set(prev).add(key))
        setCyclingCell(null)
        setTimeout(() => {
          loadHistory()
          setDeletedCells((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        }, 2000)
        return
      } else if (status === 'completed') {
        const inst = instanceByKey.get(key)
        if (!inst) return
        const { error: delErr } = await supabase.from('checklist_instances').delete().eq('id', inst.id)
        if (delErr) {
          setError(delErr.message)
          return
        }
        const { data: newInst, error: insErr } = await supabase.from('checklist_instances').insert({
          checklist_item_id: itemId,
          scheduled_date: date,
        }).select('id').single()
        if (insErr) {
          setError(insErr.message)
          return
        }
        if (newInst?.id) {
          await supabase.from('checklist_instance_assignees').insert({ checklist_instance_id: newInst.id, user_id: selectedUserId })
        }
      } else {
        const { data: newInst, error: err } = await supabase.from('checklist_instances').insert({
          checklist_item_id: itemId,
          scheduled_date: date,
          completed_at: new Date().toISOString(),
        }).select('id').single()
        if (err) {
          setError(err.message)
          return
        }
        if (newInst?.id) {
          await supabase.from('checklist_instance_assignees').insert({ checklist_instance_id: newInst.id, user_id: selectedUserId })
        }
        setDeletedCells((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
      await loadHistory()
    } finally {
      setCyclingCell(null)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {canViewOthers && users.length > 0 && (
          <label>
            <span style={{ marginRight: '0.5rem' }}>View history for:</span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', minWidth: 160 }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span style={{ marginRight: '0.5rem' }}>Months:</span>
          <select
            value={monthsBack}
            onChange={(e) => setMonthsBack(Number(e.target.value))}
            style={{ padding: '0.35rem 0.5rem' }}
          >
            {[1, 3, 6, 12].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        {canEditHistory && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
            <span style={{ fontSize: '0.875rem' }}>Edit mode</span>
          </label>
        )}
        {!isNarrow && (
          <span style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 7, background: '#22c55e', color: 'white' }}>✓ You</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 7, background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }}>✓ Someone else</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 7, background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }}>✗ Missed</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 7, border: '1px dashed var(--border-400)', color: 'var(--text-muted)' }}>Not due</span>
          </span>
        )}
      </div>
      {!isNarrow && (repeating.length > 0 || oneOffs.length > 0) ? (
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          REPEATING <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· {repeating.length} task{repeating.length === 1 ? '' : 's'} · rows start at each task’s creation</span>
        </p>
      ) : null}
      {isNarrow ? (
        <ChecklistHistoryLedger
          instances={instances}
          selectedUserId={selectedUserId}
          currentUserId={authUserId}
          todayStr={toLocalDateString(new Date())}
          setError={setError}
          onAfterReopen={() => void loadHistory()}
        />
      ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)' }}>Item</th>
              {sortedDates.slice(-60).map((d, i, arr) => {
                const parts = d.slice(5).split('-')
                const month = parts[0] ?? ''
                const day = parts[1] ?? ''
                const monthBoundary = i > 0 && (arr[i - 1] ?? '').slice(5, 7) !== d.slice(5, 7)
                return (
                  <th key={d} style={{ padding: '0.15rem', borderBottom: '1px solid var(--border)', minWidth: 26, fontSize: '0.6875rem', lineHeight: 1.15, ...(monthBoundary ? { borderLeft: '2px solid var(--border-400)' } : {}) }} title={d}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}><span style={{ color: 'var(--text-muted)' }}>{month}</span><span>{day}</span></div>
                  </th>
                )
              })}
              <th style={{ padding: '0.15rem 0.4rem', borderBottom: '1px solid var(--border)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>rate</th>
            </tr>
          </thead>
          <tbody>
            {repeating.map(({ itemId, title, links, sinceYmd, dates }) => {
              const visibleDates = sortedDates.slice(-60)
              let due = 0
              let done = 0
              for (const d of visibleDates) {
                const st = deletedCells.has(`${itemId}-${d}`) ? undefined : dates[d]
                if (st === 'completed' || st === 'completed_by_other') { due++; done++ }
                else if (st === 'incomplete') due++
              }
              const birthIndex = visibleDates.findIndex((d) => d >= sinceYmd)
              return (
              <tr key={itemId}>
                <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)' }} title={`${title} — created ${sinceYmd}`}>
                  <ChecklistTitleWithLinks title={title} links={links} />
                  <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-faint)' }}>since {historyShortDate(sinceYmd)}</span>
                </td>
                {visibleDates.map((d, i, arr) => {
                  const monthBoundaryEarly = i > 0 && (arr[i - 1] ?? '').slice(5, 7) !== d.slice(5, 7)
                  // Before the task existed there is nothing to grade — no box at all.
                  if (d < sinceYmd) {
                    return <td key={d} style={{ padding: 2, borderBottom: '1px solid var(--border)', ...(monthBoundaryEarly ? { borderLeft: '2px solid var(--border-400)' } : {}) }} />
                  }
                  const isBirth = i === birthIndex && i > 0
                  const rawStatus = dates[d]
                  const status = deletedCells.has(`${itemId}-${d}`) ? undefined : rawStatus
                  const cellKey = `${itemId}-${d}`
                  const isCycling = cyclingCell === cellKey
                  const isClickable = editMode && !isCycling
                  const monthBoundary = i > 0 && (arr[i - 1] ?? '').slice(5, 7) !== d.slice(5, 7)
                  const cellStyle = {
                    width: 24,
                    height: 24,
                    borderRadius: 5,
                    display: 'flex' as const,
                    alignItems: 'center' as const,
                    justifyContent: 'center' as const,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    boxSizing: 'border-box' as const,
                    cursor: isClickable ? 'pointer' : undefined,
                    opacity: isCycling ? 0.6 : 1,
                    ...(status === 'completed'
                      ? { background: '#22c55e', color: 'white' }
                      : status === 'completed_by_other'
                        ? { background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }
                        : status === 'incomplete'
                          ? { background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }
                          : { border: '1.5px dashed var(--border-400)' }),
                  }
                  return (
                    <td key={d} style={{ padding: 2, borderBottom: '1px solid var(--border)', ...(monthBoundary ? { borderLeft: '2px solid var(--border-400)' } : {}), ...(isBirth ? { borderLeft: '2px solid #2563eb' } : {}) }} title={isBirth ? `created ${sinceYmd}` : undefined}>
                      <div
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        onClick={isClickable ? () => handleCycleStatus(itemId, d) : undefined}
                        onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCycleStatus(itemId, d) } } : undefined}
                        style={cellStyle}
                        title={`${d}: ${status || 'not due'}${editMode ? ' (click to cycle)' : ''}`}
                      >
                        {status === 'completed' || status === 'completed_by_other' ? '✓' : status === 'incomplete' ? '✗' : ''}
                      </div>
                    </td>
                  )
                })}
                <td style={{ padding: '0.15rem 0.4rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: due > 0 && done === due ? 'var(--text-green-800)' : 'var(--text-700)' }}>
                  {due > 0 ? `${Math.round((done / due) * 100)}%` : '—'}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
      {!isNarrow && repeating.length === 0 && oneOffs.length > 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No repeating tasks in this range.</p>
      )}
      {!isNarrow && oneOffs.length > 0 && (
        <div style={{ marginTop: '1.1rem', maxWidth: '46rem' }}>
          <p style={{ margin: '0 0 0.3rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            ONE-OFF TASKS{' '}
            <span style={{ fontWeight: 400, letterSpacing: 0 }}>
              · {oneOffs.length} in this window · {oneOffs.filter((o) => o.status === 'done' || o.status === 'done_by_other').length} done · newest first
            </span>
          </p>
          {oneOffs.map((o) => {
            const cellKey = `${o.itemId}-${o.scheduledYmd}`
            const status = deletedCells.has(cellKey) ? 'open' : o.status
            const chip =
              status === 'done'
                ? { label: '✓ done', style: { background: 'var(--bg-emerald-tint)', color: 'var(--text-emerald-800)' } }
                : status === 'done_by_other'
                  ? { label: '✓ else', style: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid #d97706' } }
                  : status === 'missed'
                    ? { label: '✗ missed', style: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' } }
                    : { label: 'open', style: { border: '1px dashed var(--border-strong)', color: 'var(--text-muted)' } }
            const meta =
              status === 'done' || status === 'done_by_other'
                ? `created ${o.createdYmd ? historyShortDate(o.createdYmd) : '—'} → done ${o.completedYmd ? historyShortDate(o.completedYmd) : historyShortDate(o.scheduledYmd)}${status === 'done_by_other' ? ' by someone else' : ''}`
                : status === 'missed'
                  ? `created ${o.createdYmd ? historyShortDate(o.createdYmd) : '—'} · due ${historyShortDate(o.scheduledYmd)}, never done`
                  : `created ${o.createdYmd ? historyShortDate(o.createdYmd) : '—'} · still open`
            const clickable = editMode && cyclingCell !== cellKey
            return (
              <div key={o.instanceId} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.4rem 0.1rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                <span
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => handleCycleStatus(o.itemId, o.scheduledYmd) : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCycleStatus(o.itemId, o.scheduledYmd) } } : undefined}
                  title={editMode ? 'Click to cycle status' : undefined}
                  style={{ flexShrink: 0, fontSize: '0.7rem', fontWeight: 700, padding: '0.14rem 0.5rem', borderRadius: 999, width: '4.8rem', textAlign: 'center', boxSizing: 'border-box', cursor: clickable ? 'pointer' : undefined, opacity: cyclingCell === cellKey ? 0.6 : 1, ...chip.style }}
                >
                  {chip.label}
                </span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <ChecklistTitleWithLinks title={o.title} links={o.links} />
                </span>
                <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>{meta}</span>
              </div>
            )
          })}
        </div>
      )}
      {!isNarrow && repeating.length === 0 && oneOffs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No checklist history in this range.</p>}
    </div>
  )
}

type OutstandingInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  checklist_items?: { title?: string; links?: string[] | null; repeat_type?: string; reminder_scope?: string | null; created_at?: string | null; created_by_user_id?: string | null; roadmap_group_task_id?: string | null; checklist_tech_tree_group_tasks?: RoadmapTaskEmbed | null } | null
}

/** Severity-tinted "Nd" age chip shared by the Review rows (v2.2012). */
function outstandingAgeChip(scheduledDate: string, todayStr: string) {
  const days = oldestAgeDays([{ scheduled_date: scheduledDate }], todayStr)
  if (days <= 0) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>({scheduledDate})</span>
  }
  const sev = ageSeverity(days)
  const tone =
    sev === 'late'
      ? { background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }
      : sev === 'warn'
        ? { background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }
        : { background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-700)' }
  return (
    <span
      title={scheduledDate}
      style={{
        fontSize: '0.72rem',
        fontWeight: 600,
        padding: '0.1rem 0.45rem',
        borderRadius: 7,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
        ...tone,
      }}
    >
      {days}d
    </span>
  )
}

function OutstandingByPersonSortableRow({
  inst,
  userId,
  dragDisabled,
  canManageChecklists,
  isDev,
  authUserId,
  completingInstanceId,
  deletingInstanceId,
  expanded,
  notesCount,
  onToggleExpanded,
  onMarkComplete,
  onDeleteInstance,
  onOpenFwd,
  onCompleteFromPanel,
  onOpenRoadmapContext,
  setEditItemId,
  setError,
}: {
  inst: OutstandingInstance
  userId: string
  dragDisabled: boolean
  canManageChecklists: boolean
  isDev: boolean
  authUserId: string | null
  completingInstanceId: string | null
  deletingInstanceId: string | null
  expanded: boolean
  notesCount: number
  onToggleExpanded: (instanceId: string) => void
  onMarkComplete: (inst: OutstandingInstance) => void
  onDeleteInstance: (inst: OutstandingInstance) => void
  onOpenFwd: (inst: OutstandingInstance, rowUserId: string) => void
  onCompleteFromPanel: (args: { instanceId: string; checklistItemId: string; scheduledDate: string }) => Promise<boolean>
  onOpenRoadmapContext?: (roadmapGroupTaskId: string) => void
  setEditItemId: (id: string) => void
  setError: (s: string | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: inst.id })
  const { onPointerDown: sortablePointerDown, ...restSortableListeners } = (listeners ?? {}) as {
    onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void
  } & Record<string, unknown>
  const style: CSSProperties = {
    marginBottom: '0.25rem',
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    position: 'relative',
    zIndex: isDragging ? 2 : undefined,
  }
  const title = inst.checklist_items?.title ?? '\u2014'
  const footerLink = (label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 0,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: danger ? 'var(--text-red-700)' : 'var(--text-link)',
      }}
    >
      {label}
    </button>
  )
  return (
    <li ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
        {canManageChecklists && (
          <button
            type="button"
            {...attributes}
            {...restSortableListeners}
            disabled={dragDisabled}
            onPointerDown={(e) => {
              sortablePointerDown?.(e)
              e.stopPropagation()
            }}
            title="Drag to reorder"
            aria-label={`Drag to reorder: ${title}`}
            style={{
              flexShrink: 0,
              padding: '0.125rem',
              background: 'none',
              border: 'none',
              cursor: dragDisabled ? 'not-allowed' : 'grab',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              touchAction: 'none',
              opacity: dragDisabled ? 0.5 : 1,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="M8 5h2v2H8V5zm3 0h2v2h-2V5zm3 0h2v2h-2V5zM8 9h2v2H8V9zm3 0h2v2h-2V9zm3 0h2v2h-2V9zM8 13h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2zM8 17h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2z" />
            </svg>
          </button>
        )}
        {isDev && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMarkComplete(inst)
              }}
              disabled={completingInstanceId === inst.id}
              title="Mark complete"
              aria-label="Mark complete"
              style={{
                padding: '0.25rem',
                background: 'none',
                border: 'none',
                cursor: completingInstanceId === inst.id ? 'not-allowed' : 'pointer',
                color: '#16a34a',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z" />
              </svg>
            </button>
          </span>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} activity for ${title}`}
          onClick={(e) => {
            // Links inside the title stay links \u2014 don't toggle on them.
            if ((e.target as HTMLElement).closest('a')) return
            onToggleExpanded(inst.id)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleExpanded(inst.id)
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.3rem 0.35rem',
            borderRadius: 8,
            cursor: 'pointer',
            background: expanded ? 'var(--bg-muted)' : undefined,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <ChecklistTitleWithLinks title={title} links={inst.checklist_items?.links} />{' '}
            {roadmapGoalChip(inst.checklist_items, onOpenRoadmapContext)}
          </span>
          {notesCount > 0 ? (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.1rem 0.45rem',
                borderRadius: 7,
                background: 'var(--bg-blue-tint)',
                color: 'var(--text-blue-800)',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {'\uD83D\uDCAC'} {notesCount}
            </span>
          ) : null}
          <span style={{ flexShrink: 0 }}>{outstandingAgeChip(inst.scheduled_date, new Date().toLocaleDateString('en-CA'))}</span>
        </div>
        {isDev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteInstance(inst)
            }}
            disabled={deletingInstanceId === inst.id}
            title="Delete"
            aria-label="Delete"
            style={{
              flexShrink: 0,
              padding: '0.25rem',
              background: 'none',
              border: 'none',
              cursor: deletingInstanceId === inst.id ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
            </svg>
          </button>
        )}
      </div>
      {expanded ? (
        <div
          style={{
            margin: canManageChecklists ? '0.15rem 0 0.5rem 1.9rem' : '0.15rem 0 0.5rem 0.5rem',
            padding: '0.5rem 0.65rem 0.6rem',
            background: 'var(--bg-muted)',
            borderRadius: 10,
          }}
        >
          <ChecklistItemActivity
            item={{
              id: inst.checklist_item_id,
              title,
              created_at: inst.checklist_items?.created_at ?? null,
              created_by_user_id: inst.checklist_items?.created_by_user_id ?? null,
            }}
            authUserId={authUserId}
            showInstanceDays={(inst.checklist_items?.repeat_type ?? 'once') !== 'once'}
            setError={setError}
            onComplete={(activityInst) =>
              onCompleteFromPanel({
                instanceId: activityInst.id,
                checklistItemId: inst.checklist_item_id,
                scheduledDate: activityInst.scheduledDate,
              })
            }
            footerActions={
              isDev ? (
                <>
                  {footerLink('Edit', () => setEditItemId(inst.checklist_item_id))}
                  {footerLink('Forward', () => onOpenFwd(inst, userId))}
                </>
              ) : undefined
            }
          />
        </div>
      ) : null}
    </li>
  )
}

function OutstandingByPersonSortableList({
  userId,
  instances,
  reorderingUserId,
  canManageChecklists,
  isDev,
  authUserId,
  onDragEnd,
  completingInstanceId,
  deletingInstanceId,
  expandedInstanceId,
  notesByInstance,
  onToggleExpanded,
  onMarkComplete,
  onDeleteInstance,
  onOpenFwd,
  onCompleteFromPanel,
  onOpenRoadmapContext,
  setEditItemId,
  setError,
}: {
  userId: string
  instances: OutstandingInstance[]
  reorderingUserId: string | null
  canManageChecklists: boolean
  isDev: boolean
  onDragEnd: (e: DragEndEvent) => void
  completingInstanceId: string | null
  deletingInstanceId: string | null
  onMarkComplete: (inst: OutstandingInstance) => void
  onDeleteInstance: (inst: OutstandingInstance) => void
  onOpenFwd: (inst: OutstandingInstance, rowUserId: string) => void
  onCompleteFromPanel: (args: { instanceId: string; checklistItemId: string; scheduledDate: string }) => Promise<boolean>
  onOpenRoadmapContext?: (roadmapGroupTaskId: string) => void
  setEditItemId: (id: string) => void
  authUserId: string | null
  expandedInstanceId: string | null
  notesByInstance: Map<string, number>
  onToggleExpanded: (instanceId: string) => void
  setError: (s: string | null) => void
}) {
  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const dragDisabled = reorderingUserId === userId

  if (!canManageChecklists) {
    return (
      <ul style={{ margin: 0, paddingLeft: '1.5rem', listStyle: 'disc' }}>
        {instances.map((inst) => (
          <li key={inst.id} style={{ marginBottom: '0.25rem' }}>
            <ChecklistTitleWithLinks title={inst.checklist_items?.title ?? '—'} links={inst.checklist_items?.links} />{' '}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>({inst.scheduled_date})</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={instances.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {instances.map((inst) => (
            <OutstandingByPersonSortableRow
              key={inst.id}
              inst={inst}
              userId={userId}
              dragDisabled={dragDisabled}
              canManageChecklists={canManageChecklists}
              isDev={isDev}
              authUserId={authUserId}
              completingInstanceId={completingInstanceId}
              deletingInstanceId={deletingInstanceId}
              expanded={expandedInstanceId === inst.id}
              notesCount={notesByInstance.get(inst.id) ?? 0}
              onToggleExpanded={onToggleExpanded}
              onMarkComplete={onMarkComplete}
              onDeleteInstance={onDeleteInstance}
              onOpenFwd={onOpenFwd}
              onCompleteFromPanel={onCompleteFromPanel}
              onOpenRoadmapContext={onOpenRoadmapContext}
              setEditItemId={setEditItemId}
              setError={setError}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function ChecklistOutstandingTab({ authUserId, isDev, canManageChecklists, setError, setEditItemId, onOpenRoadmap }: { authUserId: string | null; isDev: boolean; canManageChecklists: boolean; setError: (s: string | null) => void; setEditItemId: (id: string) => void; onOpenRoadmap?: (roadmapId: string) => void }) {
  const checklistAddModal = useChecklistAddModal()
  const [loading, setLoading] = useState(true)
  const [byUser, setByUser] = useState<Array<{ userId: string; name: string; count: number; instances: OutstandingInstance[] }>>([])
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'next_day' | 'next_week' | 'non_repeating' | 'missed'>('non_repeating')
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null)
  const [fwdInstance, setFwdInstance] = useState<OutstandingInstance | null>(null)
  const [fwdTitle, setFwdTitle] = useState('')
  const [fwdAssigneeId, setFwdAssigneeId] = useState('')
  const [fwdSaving, setFwdSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [deletingInstanceId, setDeletingInstanceId] = useState<string | null>(null)
  const [completingInstanceId, setCompletingInstanceId] = useState<string | null>(null)
  const [reorderingUserId, setReorderingUserId] = useState<string | null>(null)
  const [outstandingDeletePending, setOutstandingDeletePending] = useState<OutstandingInstance | null>(null)
  const [roadmapContextTaskId, setRoadmapContextTaskId] = useState<string | null>(null)
  /** Row expanded to its activity spine (history + notes), v2.2012. */
  const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null)
  /** Comment-event counts per listed instance — powers the 💬 chips. */
  const [notesByInstance, setNotesByInstance] = useState<Map<string, number>>(new Map())
  // Team-board chrome (v2.1872): summary tiles + folded inboxes.
  const [reviewCount, setReviewCount] = useState<number | null>(null)
  const [openReqCount, setOpenReqCount] = useState<number | null>(null)
  const [foldReviewOpen, setFoldReviewOpen] = useState(false)
  const [foldInboxOpen, setFoldInboxOpen] = useState(false)
  const [missedWeekCount, setMissedWeekCount] = useState<number | null>(null)
  /** Goals strip (v2.1876): one progress row per roadmap the viewer can read. */
  const [goalRows, setGoalRows] = useState<GoalsStripRow[]>([])
  /** Per-stage rows behind each goal's segmented bar + ledger (v2.2021). */
  const [goalStageRows, setGoalStageRows] = useState<Map<string, GoalsStageRow[]>>(new Map())
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)
  /** "N more locked stages" fold, reset each time a goal expands. */
  const [showAllLockedStages, setShowAllLockedStages] = useState(false)
  const onReviewCount = useCallback((n: number) => setReviewCount(n), [])
  const onOpenReqCount = useCallback((n: number) => setOpenReqCount(n), [])

  const fwdMissingFields: string[] = []
  if (!fwdTitle.trim()) fwdMissingFields.push('Title')
  if (!fwdAssigneeId) fwdMissingFields.push('Assignee')
  const fwdCanSubmit = fwdMissingFields.length === 0

  useEffect(() => {
    loadOutstanding()
  }, [dateRange])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [{ data: rms }, { data: grps }, { data: edgs }] = await Promise.all([
        supabase.from('checklist_tech_tree_roadmaps').select('id, title').order('sort_index'),
        supabase.from('checklist_tech_tree_groups').select('id, roadmap_id, title, sort_index'),
        supabase.from('checklist_tech_tree_edges').select('from_group_id, to_group_id'),
      ])
      if (cancelled || !rms || rms.length === 0 || !grps || grps.length === 0) return
      const { data: tsks } = await supabase
        .from('checklist_tech_tree_group_tasks')
        .select('id, group_id, completed_at, checklist_tech_tree_task_assignees(user_id)')
        .in('group_id', grps.map((g) => g.id))
      if (cancelled) return
      const mappedTasks = (tsks ?? []).map((t) => ({
        id: t.id,
        group_id: t.group_id,
        completed_at: t.completed_at,
        assigneeCount: ((t as { checklist_tech_tree_task_assignees?: Array<{ user_id: string }> | null }).checklist_tech_tree_task_assignees ?? []).length,
      }))
      const mappedEdges = (edgs ?? []).map((e) => ({ fromGroupId: e.from_group_id, toGroupId: e.to_group_id }))
      setGoalRows(goalsStripRows({ roadmaps: rms, groups: grps, tasks: mappedTasks, edges: mappedEdges }))
      const stageMap = new Map<string, GoalsStageRow[]>()
      for (const rm of rms) {
        const rmGroups = grps.filter((g) => g.roadmap_id === rm.id)
        if (rmGroups.length === 0) continue
        stageMap.set(rm.id, goalsStageRows({ groups: rmGroups, tasks: mappedTasks, edges: mappedEdges }))
      }
      setGoalStageRows(stageMap)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadOutstandingRef = useRef(loadOutstanding)
  loadOutstandingRef.current = loadOutstanding
  useEffect(() => {
    const handler = () => loadOutstandingRef.current()
    window.addEventListener('checklist-item-saved', handler)
    return () => window.removeEventListener('checklist-item-saved', handler)
  }, [])

  useEffect(() => {
    if (isDev) {
      supabase
        .from('users')
        .select('id, name, email')
        .is('archived_at', null)
        .order('name')
        .then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    }
  }, [isDev])

  function openFwd(inst: OutstandingInstance, rowUserId: string) {
    const title = inst.checklist_items?.title ?? 'Untitled'
    setFwdInstance(inst)
    setFwdTitle(title)
    setFwdAssigneeId(rowUserId)
  }

  function openOutstandingDeleteModal(inst: OutstandingInstance) {
    setOutstandingDeletePending(inst)
  }

  async function performDeleteOutstandingInstance(inst: OutstandingInstance) {
    setDeletingInstanceId(inst.id)
    setError(null)
    try {
      const { error: err } = await supabase.from('checklist_instances').delete().eq('id', inst.id)
      if (err) throw err
      setOutstandingDeletePending(null)
      await loadOutstanding()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingInstanceId(null)
    }
  }

  /** ✓ Complete from a row's activity panel (v2.2039) — shared side effects, then refresh. */
  async function completePanelInstance(args: { instanceId: string; checklistItemId: string; scheduledDate: string }): Promise<boolean> {
    if (!authUserId) return false
    const res = await completeChecklistInstance({ ...args, authUserId })
    if (!res.ok) {
      setError(res.error ?? 'Failed to complete this task.')
      return false
    }
    await loadOutstanding()
    return true
  }

  async function markComplete(inst: OutstandingInstance) {
    if (!authUserId || completingInstanceId) return
    setCompletingInstanceId(inst.id)
    setError(null)
    try {
      const { data: updatedRows, error: err } = await supabase
        .from('checklist_instances')
        .update({
          completed_at: new Date().toISOString(),
          completed_by_user_id: authUserId,
        })
        .eq('id', inst.id)
        .select('id')
      if (err) throw err
      if (!updatedRows?.length) {
        setError('Could not mark this task complete (no rows updated).')
        return
      }
      const { data: item } = await supabase
        .from('checklist_items')
        .select('notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id, title')
        .eq('id', inst.checklist_item_id)
        .single()
      if (item) {
        const title = (item as { title: string }).title
        const body = `Dev completed: ${title}`
        const recipients: string[] = []
        const notifyUserId = (item as { notify_on_complete_user_id: string | null }).notify_on_complete_user_id
        if (notifyUserId) recipients.push(notifyUserId)
        const notifyCreator = (item as { notify_creator_on_complete: boolean }).notify_creator_on_complete
        const creatorId = (item as { created_by_user_id: string }).created_by_user_id
        if (notifyCreator && creatorId && !recipients.includes(creatorId)) recipients.push(creatorId)
        for (const uid of recipients) {
          try {
            await supabase.functions.invoke('send-checklist-notification', {
              body: { recipient_user_id: uid, push_title: 'Checklist completed', push_body: body, push_url: '/checklist', tag: `checklist-${inst.id}` },
            })
          } catch {
            /* ignore */
          }
        }
      }
      const [{ data: itemData }, { data: assignees }] = await Promise.all([
        supabase.from('checklist_items').select('repeat_type, repeat_days_after, repeat_end_date').eq('id', inst.checklist_item_id).single(),
        supabase.from('checklist_item_assignees').select('user_id').eq('checklist_item_id', inst.checklist_item_id),
      ])
      if (itemData) {
        const rt = (itemData as { repeat_type: string }).repeat_type
        if (rt === 'days_after_completion') {
          const daysAfter = (itemData as { repeat_days_after: number | null }).repeat_days_after
          const endDate = (itemData as { repeat_end_date: string | null }).repeat_end_date
          if (daysAfter) {
            const assigneeIds = (assignees ?? []).map((r: { user_id: string }) => r.user_id)
            if (assigneeIds.length > 0) {
              const nextDate = new Date(inst.scheduled_date)
              nextDate.setDate(nextDate.getDate() + daysAfter)
              const nextDateStr = toLocalDateString(nextDate)
              if (!endDate || nextDateStr <= endDate) {
                const { data: newInst } = await supabase.from('checklist_instances').insert({ checklist_item_id: inst.checklist_item_id, scheduled_date: nextDateStr }).select('id').single()
                if (newInst?.id) {
                  for (const uid of assigneeIds) {
                    await supabase.from('checklist_instance_assignees').insert({ checklist_instance_id: newInst.id, user_id: uid })
                  }
                }
              }
            }
          }
        }
      }
      await loadOutstanding()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark complete')
    } finally {
      setCompletingInstanceId(null)
    }
  }

  async function saveFwd() {
    if (!fwdInstance || !authUserId || !fwdTitle.trim() || !fwdAssigneeId) return
    setFwdSaving(true)
    setError(null)
    try {
      const { data: sourceItem } = await supabase
        .from('checklist_items')
        .select('notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope')
        .eq('id', fwdInstance.checklist_item_id)
        .single()
      const src = sourceItem as { notify_on_complete_user_id: string | null; notify_creator_on_complete: boolean; reminder_time: string | null; reminder_scope: string | null } | null
      const { data: newItem, error: itemErr } = await supabase
        .from('checklist_items')
        .insert({
          title: fwdTitle.trim(),
          created_by_user_id: authUserId,
          repeat_type: 'once',
          start_date: fwdInstance.scheduled_date,
          notify_on_complete_user_id: src?.notify_on_complete_user_id ?? null,
          notify_creator_on_complete: src?.notify_creator_on_complete ?? false,
          reminder_time: src?.reminder_time ?? null,
          reminder_scope: src?.reminder_scope ?? null,
        })
        .select('id')
        .single()
      if (itemErr) throw itemErr
      if (newItem?.id && fwdAssigneeId) {
        const nextOrders = await getNextDisplayOrders([fwdAssigneeId])
        await supabase.from('checklist_item_assignees').insert({
          checklist_item_id: newItem.id,
          user_id: fwdAssigneeId,
          display_order: nextOrders.get(fwdAssigneeId) ?? 1,
        })
        const { data: newInst } = await supabase
          .from('checklist_instances')
          .insert({ checklist_item_id: newItem.id, scheduled_date: fwdInstance.scheduled_date })
          .select('id')
          .single()
        if (newInst?.id) {
          await supabase.from('checklist_instance_assignees').insert({ checklist_instance_id: newInst.id, user_id: fwdAssigneeId })
        }
        await supabase.from('checklist_instances').delete().eq('id', fwdInstance.id)
      }
      setFwdInstance(null)
      await loadOutstanding()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to forward')
    } finally {
      setFwdSaving(false)
    }
  }

  async function sendReminder(userId: string, instances: OutstandingInstance[]) {
    setRemindingUserId(userId)
    const titles = instances.map((inst) => inst.checklist_items?.title ?? '—')
    const n = titles.length
    const body =
      n === 1
        ? `You have 1 outstanding task: ${titles[0]}`
        : n <= 3
          ? `You have ${n} outstanding tasks: ${titles.join(', ')}`
          : `You have ${n} outstanding tasks: ${titles.slice(0, 3).join(', ')} and ${n - 3} more`
    try {
      await supabase.functions.invoke('send-checklist-notification', {
        body: {
          recipient_user_id: userId,
          push_title: 'Task reminder',
          push_body: body,
          push_url: '/checklist',
          tag: 'task-reminder',
        },
      })
    } catch {
      // Best-effort; do not block UI
    } finally {
      setRemindingUserId(null)
    }
  }

  async function persistOutstandingOrderForUser(userId: string, ordered: OutstandingInstance[]) {
    setReorderingUserId(userId)
    setError(null)
    try {
      for (let i = 0; i < ordered.length; i++) {
        const inst = ordered[i]
        if (!inst) continue
        await withSupabaseRetry(
          async () =>
            supabase
              .from('checklist_item_assignees')
              .update({ display_order: i + 1 })
              .eq('checklist_item_id', inst.checklist_item_id)
              .eq('user_id', userId),
          'update checklist assignee display order'
        )
      }
      await loadOutstanding()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reorder')
    } finally {
      setReorderingUserId(null)
    }
  }

  function onOutstandingDragEnd(userId: string, instances: OutstandingInstance[]) {
    return (e: DragEndEvent) => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const oldIndex = instances.findIndex((i) => i.id === active.id)
      const newIndex = instances.findIndex((i) => i.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return
      if (oldIndex === newIndex) return
      const reordered = arrayMove(instances, oldIndex, newIndex)
      void persistOutstandingOrderForUser(userId, reordered)
    }
  }

  async function loadOutstanding() {
    setLoading(true)
    setError(null)
    // Summary tile: misses this company week (Sun -> today), independent of the
    // range filter below. Count-only HEAD request — cheap.
    void (async () => {
      const todayStr = new Date().toLocaleDateString('en-CA')
      const { count } = await supabase
        .from('checklist_instances')
        .select('id', { count: 'exact', head: true })
        .is('completed_at', null)
        .gte('scheduled_date', weekStartSunday(todayStr))
        .lt('scheduled_date', todayStr)
      setMissedWeekCount(count ?? 0)
    })()
    const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('en-CA')
    const weekEnd = new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-CA')

    let query = supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, checklist_items(title, links, repeat_type, reminder_scope, created_at, created_by_user_id, roadmap_group_task_id, checklist_tech_tree_group_tasks(group_id, checklist_tech_tree_groups(roadmap_id, checklist_tech_tree_roadmaps(title)))), checklist_instance_assignees(user_id, users(name, email))')
      .is('completed_at', null)
      .order('scheduled_date', { ascending: true })

    if (dateRange === 'missed') {
      const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('en-CA') // more than 1 day old = scheduled before yesterday
      query = query.lt('scheduled_date', yesterday)
    } else if (dateRange !== 'non_repeating') {
      const start = dateRange === 'next_day' ? tomorrow : tomorrow
      const end = dateRange === 'next_day' ? tomorrow : weekEnd
      query = query.gte('scheduled_date', start).lte('scheduled_date', end)
    }

    const { data, error } = await query
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const raw = (data ?? []) as Array<{
      id: string
      checklist_item_id: string
      scheduled_date: string
      checklist_items?: { title?: string; links?: string[] | null; repeat_type?: string; reminder_scope?: string | null } | null
      checklist_instance_assignees?: Array<{ user_id: string; users?: { name?: string; email?: string } | null }>
    }>
    let instances = raw.filter((inst) => {
      const assignees = inst.checklist_instance_assignees ?? []
      return assignees.length > 0
    })
    if (dateRange === 'non_repeating') {
      instances = instances.filter((inst) => (inst.checklist_items as { repeat_type?: string } | null)?.repeat_type === 'once')
    }
    if (dateRange === 'missed') {
      instances = instances.filter((inst) => (inst.checklist_items as { reminder_scope?: string | null } | null)?.reminder_scope !== 'today_and_overdue')
    }
    const map = new Map<string, { inst: OutstandingInstance; name: string }[]>()
    for (const row of instances) {
      const inst: OutstandingInstance = {
        id: row.id,
        checklist_item_id: row.checklist_item_id,
        scheduled_date: row.scheduled_date,
        checklist_items: row.checklist_items ?? null,
      }
      const assignees = row.checklist_instance_assignees ?? []
      for (const a of assignees) {
        const name = a.users?.name || a.users?.email || 'Unknown'
        const list = map.get(a.user_id) ?? []
        list.push({ inst, name })
        map.set(a.user_id, list)
      }
    }
    const userIds = [...map.keys()]
    const itemIds = [...new Set(instances.map((i) => i.checklist_item_id))]
    const orderMap = new Map<string, Map<string, number>>()
    if (userIds.length > 0 && itemIds.length > 0) {
      const { data: orderData } = await supabase
        .from('checklist_item_assignees')
        .select('checklist_item_id, user_id, display_order')
        .in('user_id', userIds)
        .in('checklist_item_id', itemIds)
      for (const row of (orderData ?? []) as Array<{ checklist_item_id: string; user_id: string; display_order: number | null }>) {
        let userMap = orderMap.get(row.user_id)
        if (!userMap) {
          userMap = new Map()
          orderMap.set(row.user_id, userMap)
        }
        userMap.set(row.checklist_item_id, row.display_order ?? 999999)
      }
    }
    const rows = Array.from(map.entries()).map(([userId, list]) => {
      const name = list[0]?.name ?? 'Unknown'
      const userOrderMap = orderMap.get(userId)
      const sortedInstances = [...list.map((x) => x.inst)].sort((a, b) => {
        const orderA = userOrderMap?.get(a.checklist_item_id) ?? 999999
        const orderB = userOrderMap?.get(b.checklist_item_id) ?? 999999
        if (orderA !== orderB) return orderA - orderB
        return a.scheduled_date.localeCompare(b.scheduled_date)
      })
      return { userId, name, count: list.length, instances: sortedInstances }
    })
    rows.sort((a, b) => b.count - a.count)
    setByUser(rows)
    setLoading(false)
    // 💬 chips: count comment events per listed instance. Non-blocking, and
    // chunked so a wide board can't overflow the .in() URL (ledger pattern).
    void (async () => {
      const ids = instances.map((i) => i.id)
      const counts = new Map<string, number>()
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150))
      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from('checklist_instance_events')
            .select('instance_id')
            .eq('event_type', 'comment')
            .in('instance_id', chunk),
        ),
      )
      for (const r of results) {
        for (const row of (r.data ?? []) as Array<{ instance_id: string }>) {
          counts.set(row.instance_id, (counts.get(row.instance_id) ?? 0) + 1)
        }
      }
      setNotesByInstance(counts)
    })()
  }

  const outstandingTotal = byUser.reduce((n, u) => n + u.count, 0)
  const boardTile = (label: string, value: string, valueColor?: string) => (
    <div style={{ flex: '1 1 96px', maxWidth: 220, background: 'var(--bg-muted)', borderRadius: 10, padding: '0.6rem 0.75rem', minWidth: 0, textAlign: 'center' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 600, color: valueColor ?? 'var(--text-strong)', marginTop: 2 }}>{value}</div>
    </div>
  )
  const foldHeader = (
    label: React.ReactNode,
    badge: string | null,
    badgeTone: 'blue' | 'red' | 'muted',
    open: boolean,
    onToggle: () => void,
  ) => (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        width: '100%',
        minHeight: 44,
        padding: '0.55rem 0.75rem',
        background: 'var(--surface)',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.9375rem',
        fontWeight: 600,
        color: 'var(--text-strong)',
        textAlign: 'left',
      }}
    >
      <span>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        {badge != null ? (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.1rem 0.55rem',
              borderRadius: 999,
              background:
                badgeTone === 'blue' ? 'var(--bg-blue-tint)' : badgeTone === 'red' ? 'var(--bg-red-100)' : 'var(--bg-muted)',
              color:
                badgeTone === 'blue' ? 'var(--text-link)' : badgeTone === 'red' ? 'var(--text-red-700)' : 'var(--text-muted)',
            }}
          >
            {badge}
          </span>
        ) : null}
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{open ? '▾' : '▸'}</span>
      </span>
    </button>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {boardTile('To sign off', reviewCount == null ? '—' : String(reviewCount), 'var(--text-link)')}
        {boardTile(`Outstanding · ${BOARD_RANGE_LABELS[dateRange as BoardRange].toLowerCase()}`, loading ? '—' : String(outstandingTotal), 'var(--text-red-700)')}
        {boardTile('Missed this week', missedWeekCount == null ? '—' : String(missedWeekCount))}
      </div>
      {goalRows.length > 0 ? (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.03em', color: 'var(--text-muted)' }}>GOALS</p>
          {goalRows.map((g) => {
            const stages = goalStageRows.get(g.roadmapId) ?? []
            const expanded = expandedGoalId === g.roadmapId
            const lockedCount = stages.filter((s) => s.state === 'locked').length
            // Fold the locked tail behind "N more" — but never fold a single row.
            const foldLocked = !showAllLockedStages && lockedCount > 3
            const hiddenLocked = lockedCount - 2
            const visibleStages: Array<{ row: GoalsStageRow; index: number }> = []
            let lockedSeen = 0
            stages.forEach((row, index) => {
              if (row.state === 'locked') {
                lockedSeen += 1
                if (foldLocked && lockedSeen > 2) return
              }
              visibleStages.push({ row, index })
            })
            const toggleGoal = () => {
              setExpandedGoalId((prev) => (prev === g.roadmapId ? null : g.roadmapId))
              setShowAllLockedStages(false)
            }
            return (
              <div
                key={g.roadmapId}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Hide' : 'Show'} stages for ${g.title}`}
                onClick={toggleGoal}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleGoal()
                  }
                }}
                style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '0.6rem 0.75rem', marginBottom: '0.5rem', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>⛰ {g.title}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{expanded ? '▾' : '▸'}</span>
                  </span>
                </div>
                {stages.length > 0 ? (
                  /* Segmented bar (v2.2021): one segment per stage in curated order —
                     done solid green, current amber-ringed with its own fill, locked muted. */
                  <div style={{ display: 'flex', gap: 2, height: 13 }}>
                    {stages.map((s, stageIndex) => (
                      <span
                        key={s.groupId}
                        title={`${stageIndex + 1} · ${s.title} — ${s.total > 0 ? `${s.done} of ${s.total}` : 'milestone'}`}
                        style={{
                          flex: 1,
                          minWidth: 5,
                          borderRadius: 3,
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: s.state === 'complete' ? '#16a34a' : 'var(--bg-muted)',
                          ...(s.state === 'current' ? { outline: '1.5px solid #d97706', outlineOffset: 1 } : {}),
                        }}
                      >
                        {s.state === 'current' && s.total > 0 && s.done > 0 ? (
                          <span style={{ position: 'absolute', inset: 0, display: 'block', width: `${Math.round((s.done / s.total) * 100)}%`, background: '#2563eb' }} />
                        ) : null}
                        {stages.length <= 40 ? (
                          <span
                            style={{
                              position: 'relative',
                              fontSize: '0.58rem',
                              fontWeight: 700,
                              lineHeight: 1,
                              pointerEvents: 'none',
                              color: s.state === 'complete' ? 'white' : s.state === 'current' ? 'var(--text-700)' : 'var(--text-faint)',
                            }}
                          >
                            {stageIndex + 1}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${g.pct}%`, height: '100%', background: '#2563eb' }} />
                  </div>
                )}
                {expanded && stages.length > 0 ? (
                  <div onClick={(e) => e.stopPropagation()} style={{ borderTop: '1px solid var(--border)', marginTop: '0.55rem', paddingTop: '0.35rem', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.1rem 0 0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>STAGES</span>
                      {onOpenRoadmap ? (
                        <button
                          type="button"
                          onClick={() => onOpenRoadmap(g.roadmapId)}
                          style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)' }}
                        >
                          Open roadmap →
                        </button>
                      ) : null}
                    </div>
                    {visibleStages.map(({ row: s, index }) => (
                      <div key={s.groupId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.28rem 0.1rem', fontSize: '0.8125rem' }}>
                        <span style={{ width: '1.35rem', textAlign: 'right', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: '0.72rem' }}>{index + 1}</span>
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: s.state === 'locked' ? 'var(--text-faint)' : 'var(--text-strong)' }}>{s.title}</span>
                        {s.state === 'complete' ? (
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.08rem 0.4rem', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap', background: '#16a34a', color: 'white' }}>✓ done</span>
                        ) : s.state === 'current' ? (
                          <>
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.08rem 0.4rem', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }}>current</span>
                            {s.openAssigned > 0 ? (
                              <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.08rem 0.4rem', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>
                                {s.openAssigned} on {s.openAssigned === 1 ? 'list' : 'lists'}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span
                            title={lockedStageHint(s.blockedBy, s.openAssigned > 0) ?? undefined}
                            style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.08rem 0.4rem', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--bg-muted)', color: 'var(--text-faint)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            🔒{s.blockedBy[0] ? ` after “${s.blockedBy[0]}”` : ''}
                          </span>
                        )}
                        <span style={{ width: 110, height: 7, borderRadius: 4, background: 'var(--bg-muted)', overflow: 'hidden', flexShrink: 0 }}>
                          {s.total > 0 ? (
                            <span style={{ display: 'block', height: '100%', width: `${Math.round((s.done / s.total) * 100)}%`, background: s.state === 'complete' ? '#16a34a' : '#2563eb' }} />
                          ) : s.state === 'complete' ? (
                            <span style={{ display: 'block', height: '100%', width: '100%', background: '#16a34a' }} />
                          ) : null}
                        </span>
                        <span style={{ width: 46, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', flexShrink: 0, fontSize: '0.75rem' }}>
                          {s.total > 0 ? `${s.done}/${s.total}` : '\u2014'}
                        </span>
                      </div>
                    ))}
                    {foldLocked ? (
                      <button
                        type="button"
                        onClick={() => setShowAllLockedStages(true)}
                        style={{ padding: '0.3rem 0 0.1rem 2rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'left' }}
                      >
                        ▸ {hiddenLocked} more locked {hiddenLocked === 1 ? 'stage' : 'stages'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: '0.6rem', overflow: 'hidden' }}>
        {foldHeader('Checklist review — sign off completed work', reviewCount == null ? null : String(reviewCount), 'blue', foldReviewOpen, () => setFoldReviewOpen((o) => !o))}
        <div style={{ display: foldReviewOpen ? 'block' : 'none', borderTop: '1px solid var(--border)', padding: foldReviewOpen ? '0.5rem 0.5rem 0.2rem' : 0 }}>
          <ChecklistReviewInboxSection onCountChange={onReviewCount} renderWhenEmpty />
        </div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: '1.25rem', overflow: 'hidden' }}>
        {foldHeader('Dispatch & estimator inboxes', openReqCount == null ? null : `${openReqCount} open`, openReqCount ? 'red' : 'muted', foldInboxOpen, () => setFoldInboxOpen((o) => !o))}
        <div style={{ display: foldInboxOpen ? 'block' : 'none', borderTop: '1px solid var(--border)', padding: '0.5rem 0.5rem 0' }}>
          <ChecklistReviewInboxes hideChecklistReviewSection onOpenRequestCount={onOpenReqCount} />
        </div>
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Outstanding by person</h3>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', marginLeft: 'auto' }}>
            {BOARD_RANGE_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                aria-pressed={dateRange === r}
                style={{
                  padding: '0.45rem 0.8rem',
                  fontSize: '0.8125rem',
                  fontWeight: dateRange === r ? 600 : 400,
                  border: 'none',
                  background: dateRange === r ? '#2563eb' : 'var(--surface)',
                  color: dateRange === r ? 'white' : 'var(--text-700)',
                  cursor: 'pointer',
                }}
              >
                {BOARD_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : byUser.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No outstanding checklist items.</p>
        ) : (
          <div>
            {byUser.map(({ userId, name, count, instances }) => {
              const todayLocal = new Date().toLocaleDateString('en-CA')
              const oldest = oldestAgeDays(instances, todayLocal)
              const oldestSeverity = ageSeverity(oldest)
              const notesTotal = instances.reduce((n, i) => n + (notesByInstance.get(i.id) ?? 0), 0)
              const expanded = expandedUserId === userId
              return (
                <div key={userId} style={{ border: '1px solid var(--border-strong)', borderRadius: 12, marginBottom: '0.6rem', overflow: 'hidden' }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedUserId((prev) => (prev === userId ? null : userId))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedUserId((prev) => (prev === userId ? null : userId))
                      }
                    }}
                    aria-expanded={expanded}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.75rem', cursor: 'pointer' }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 34,
                        height: 34,
                        flexShrink: 0,
                        borderRadius: '50%',
                        background: 'var(--bg-blue-tint)',
                        color: 'var(--text-blue-800)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                      }}
                    >
                      {initialsFor(name)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)' }}>{name}</span>
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                        {count} outstanding
                        {oldest > 0 ? (
                          <>
                            {' · '}
                            <span
                              style={{
                                color:
                                  oldestSeverity === 'late'
                                    ? 'var(--text-red-700)'
                                    : oldestSeverity === 'warn'
                                      ? 'var(--text-amber-800)'
                                      : 'var(--text-muted)',
                              }}
                            >
                              oldest {oldest} {oldest === 1 ? 'day' : 'days'}
                            </span>
                          </>
                        ) : null}
                        {notesTotal > 0 ? <> · 💬 {notesTotal} {notesTotal === 1 ? 'note' : 'notes'}</> : null}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={remindingUserId === userId}
                      onClick={(e) => {
                        e.stopPropagation()
                        sendReminder(userId, instances)
                      }}
                      style={{
                        minHeight: 36,
                        padding: '0 0.75rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        border: '1px solid var(--border-strong)',
                        borderRadius: 8,
                        background: 'var(--surface)',
                        color: 'var(--text-700)',
                        cursor: remindingUserId === userId ? 'not-allowed' : 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {remindingUserId === userId ? 'Sending…' : '🔔 Remind'}
                    </button>
                    <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{expanded ? '▾' : '▸'}</span>
                  </div>
                  {expanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)' }}>
                      <OutstandingByPersonSortableList
                        userId={userId}
                        instances={instances}
                        reorderingUserId={reorderingUserId}
                        canManageChecklists={canManageChecklists}
                        isDev={isDev}
                        authUserId={authUserId}
                        onDragEnd={onOutstandingDragEnd(userId, instances)}
                        completingInstanceId={completingInstanceId}
                        deletingInstanceId={deletingInstanceId}
                        expandedInstanceId={expandedInstanceId}
                        notesByInstance={notesByInstance}
                        onToggleExpanded={(instanceId) => setExpandedInstanceId((prev) => (prev === instanceId ? null : instanceId))}
                        onMarkComplete={markComplete}
                        onDeleteInstance={openOutstandingDeleteModal}
                        onOpenRoadmapContext={setRoadmapContextTaskId}
                        onOpenFwd={openFwd}
                        onCompleteFromPanel={completePanelInstance}
                        setEditItemId={setEditItemId}
                        setError={setError}
                      />
                      {isDev && (
                        <button
                          type="button"
                          onClick={() => checklistAddModal?.openAddModal(userId)}
                          style={{
                            marginTop: '0.4rem',
                            minHeight: 36,
                            padding: '0 0.8rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: 8,
                            background: '#2563eb',
                            color: 'white',
                            cursor: 'pointer',
                          }}
                        >
                          ＋ Add task for {name.split(' ')[0]}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {roadmapContextTaskId && (
        <RoadmapTaskContextModal
          roadmapGroupTaskId={roadmapContextTaskId}
          onClose={() => setRoadmapContextTaskId(null)}
          onOpenRoadmap={onOpenRoadmap}
        />
      )}
      {outstandingDeletePending && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 55,
            padding: '1rem',
          }}
          onClick={() => {
            if (deletingInstanceId) return
            setOutstandingDeletePending(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checklist-outstanding-delete-title"
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.5rem',
              minWidth: 320,
              maxWidth: 480,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="checklist-outstanding-delete-title"
              style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}
            >
              Delete outstanding task?
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-600)', lineHeight: 1.45 }}>
              <strong>{outstandingDeletePending.checklist_items?.title ?? '—'}</strong>
              <span style={{ color: 'var(--text-muted)' }}> ({outstandingDeletePending.scheduled_date})</span>
            </p>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { if (!deletingInstanceId) setOutstandingDeletePending(null) }}
                disabled={deletingInstanceId === outstandingDeletePending.id}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-200)',
                  color: 'var(--text-700)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: deletingInstanceId ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void performDeleteOutstandingInstance(outstandingDeletePending)}
                disabled={deletingInstanceId === outstandingDeletePending.id}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: deletingInstanceId === outstandingDeletePending.id ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {deletingInstanceId === outstandingDeletePending.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {fwdInstance && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
          onClick={(e) => e.target === e.currentTarget && setFwdInstance(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.5rem',
              minWidth: 320,
              maxWidth: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Forward task</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Title</label>
                <input
                  type="text"
                  value={fwdTitle}
                  onChange={(e) => setFwdTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Assign to</label>
                <select
                  value={fwdAssigneeId}
                  onChange={(e) => setFwdAssigneeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={saveFwd}
                disabled={!fwdCanSubmit || fwdSaving}
                title={!fwdCanSubmit ? `Required: ${fwdMissingFields.join(', ')}` : undefined}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: fwdCanSubmit && !fwdSaving ? 'pointer' : 'not-allowed',
                  fontWeight: 500,
                }}
              >
                {fwdSaving ? 'Saving…' : 'Forward'}
              </button>
              {!fwdCanSubmit && !fwdSaving && fwdMissingFields.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem', display: 'inline-block' }}>
                <span style={{ display: 'block' }}>Required:</span>
                {fwdMissingFields.map((f) => (
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                ))}
              </span>
              )}
              <button
                type="button"
                onClick={() => setFwdInstance(null)}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-200)', color: 'var(--text-700)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type ChecklistItem = {
  id: string
  title: string
  links?: string[] | null
  created_by_user_id: string
  repeat_type: string
  repeat_days_of_week: number[] | null
  repeat_days_after: number | null
  repeat_end_date: string | null
  start_date: string
  show_until_completed: boolean
  notify_on_complete_user_id: string | null
  notify_creator_on_complete: boolean
  reminder_time: string | null
  reminder_scope: string | null
  created_at: string | null
  updated_at: string | null
  roadmap_group_task_id?: string | null
  checklist_tech_tree_group_tasks?: RoadmapTaskEmbed | null
  checklist_item_assignees?: Array<{ user_id: string; users?: { name?: string; email?: string } | null }>
}
function ChecklistManageTab({ authUserId, setError, setEditItemId, onOpenRoadmap }: { authUserId: string | null; role: UserRole | null; setError: (s: string | null) => void; setEditItemId: (id: string) => void; onOpenRoadmap?: (roadmapId: string) => void }) {
  const checklistAddModal = useChecklistAddModal()
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [loading, setLoading] = useState(true)
  const [filterUserId, setFilterUserId] = useState<string>('')
  const [manageSearchQuery, setManageSearchQuery] = useState('')
  const [muteModalItemId, setMuteModalItemId] = useState<string | null>(null)
  const [muteModalTitle, setMuteModalTitle] = useState('')
  const [manageDeletePending, setManageDeletePending] = useState<{ id: string; title: string } | null>(null)
  const [manageDeleteSubmitting, setManageDeleteSubmitting] = useState(false)
  // Per-item instance completion (Manage items are templates; completion lives on instances).
  const [itemCompletion, setItemCompletion] = useState<Map<string, { total: number; hasIncomplete: boolean }>>(new Map())
  /** Oldest incomplete instance date per item — powers the "open N days" chip (v2.1873). */
  const [oldestOpenByItem, setOldestOpenByItem] = useState<Map<string, string>>(new Map())
  const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null)
  const [completedOpen, setCompletedOpen] = useState(false)
  /** Card expanded to show its activity spine (history + notes), v2.2010. */
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  /** View pills (v2.2066): Repeating gets a front door instead of living below 28 one-offs. */
  const [manageView, setManageView] = useState<'all' | 'one_offs' | 'repeating' | 'completed'>('all')
  /** Next upcoming open occurrence per item — the green "next Mon, Aug 24" chip. */
  const [nextOpenByItem, setNextOpenByItem] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    setLoading(true)
    Promise.all([loadItems(), loadUsers()]).finally(() => setLoading(false))
  }, [filterUserId])

  const loadItemsRef = useRef(loadItems)
  loadItemsRef.current = loadItems
  useEffect(() => {
    const handler = () => loadItemsRef.current()
    window.addEventListener('checklist-item-saved', handler)
    return () => window.removeEventListener('checklist-item-saved', handler)
  }, [])

  async function loadUsers() {
    const { data } = await supabase.from('users').select('id, name, email').is('archived_at', null).order('name')
    setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
  }

  async function loadItems() {
    const baseSelect = 'id, title, links, created_by_user_id, repeat_type, repeat_days_of_week, repeat_days_after, repeat_end_date, start_date, show_until_completed, notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope, created_at, updated_at, roadmap_group_task_id, checklist_tech_tree_group_tasks(group_id, checklist_tech_tree_groups(roadmap_id, checklist_tech_tree_roadmaps(title)))'
    const { data, error } = filterUserId
      ? await supabase
          .from('checklist_items')
          .select(`${baseSelect}, checklist_item_assignees!inner(user_id, users(name, email))`)
          .eq('checklist_item_assignees.user_id', filterUserId)
          .order('start_date', { ascending: false })
      : await supabase
          .from('checklist_items')
          .select(`${baseSelect}, checklist_item_assignees(user_id, users(name, email))`)
          .order('start_date', { ascending: false })
    if (error) {
      setError(error.message)
      return
    }
    const loaded = (data ?? []) as ChecklistItem[]
    setItems(loaded)
    // Derive per-item completion from instances so one-off tasks can be split Incomplete/Complete.
    const ids = loaded.map((i) => i.id)
    if (ids.length === 0) {
      setItemCompletion(new Map())
      return
    }
    const { data: instData } = await supabase
      .from('checklist_instances')
      .select('checklist_item_id, completed_at, scheduled_date')
      .in('checklist_item_id', ids)
    const completion = new Map<string, { total: number; hasIncomplete: boolean }>()
    const oldestOpen = new Map<string, string>()
    const nextOpen = new Map<string, string>()
    const todayForNext = new Date().toLocaleDateString('en-CA')
    for (const inst of (instData ?? []) as Array<{ checklist_item_id: string; completed_at: string | null; scheduled_date: string }>) {
      const cur = completion.get(inst.checklist_item_id) ?? { total: 0, hasIncomplete: false }
      cur.total += 1
      if (!inst.completed_at) {
        cur.hasIncomplete = true
        const prev = oldestOpen.get(inst.checklist_item_id)
        if (!prev || inst.scheduled_date < prev) oldestOpen.set(inst.checklist_item_id, inst.scheduled_date)
        if (inst.scheduled_date >= todayForNext) {
          const prevNext = nextOpen.get(inst.checklist_item_id)
          if (!prevNext || inst.scheduled_date < prevNext) nextOpen.set(inst.checklist_item_id, inst.scheduled_date)
        }
      }
      completion.set(inst.checklist_item_id, cur)
    }
    setItemCompletion(completion)
    setOldestOpenByItem(oldestOpen)
    setNextOpenByItem(nextOpen)
  }

  async function performDeleteChecklistItem(id: string) {
    setManageDeleteSubmitting(true)
    setError(null)
    try {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id)
      if (error) {
        setError(error.message)
        return
      }
      setManageDeletePending(null)
      await loadItems()
    } finally {
      setManageDeleteSubmitting(false)
    }
  }

  const filteredItems = useMemo(() => {
    const q = manageSearchQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      if ((item.title ?? '').toLowerCase().includes(q)) return true
      for (const a of item.checklist_item_assignees ?? []) {
        const name = (a.users?.name ?? '').toLowerCase()
        const email = (a.users?.email ?? '').toLowerCase()
        if (name.includes(q) || email.includes(q)) return true
      }
      return false
    })
  }, [items, manageSearchQuery])

  function isNotificationRecipient(item: ChecklistItem): boolean {
    if (!authUserId) return false
    if (item.notify_on_complete_user_id === authUserId) return true
    if (item.notify_creator_on_complete && item.created_by_user_id === authUserId) return true
    return false
  }

  // "Until completed" and "Once" are one-off tasks; the day_of_week / days_after_completion
  // types are repeating. (Mirrors the Repeat-column display logic.)
  const isRepeating = (item: ChecklistItem): boolean =>
    !item.show_until_completed &&
    (item.repeat_type === 'day_of_week' || item.repeat_type === 'days_after_completion')
  // A one-off item is complete when it has at least one instance and none are outstanding.
  const isItemComplete = (item: ChecklistItem): boolean => {
    const c = itemCompletion.get(item.id)
    return !!c && c.total > 0 && !c.hasIncomplete
  }

  // Each section is sorted by created date, newest first.
  const byCreatedDesc = (a: ChecklistItem, b: ChecklistItem) =>
    (b.created_at ? Date.parse(b.created_at) : 0) - (a.created_at ? Date.parse(a.created_at) : 0)
  const incompleteItems = filteredItems.filter((i) => !isRepeating(i) && !isItemComplete(i)).sort(byCreatedDesc)
  const repeatingItems = filteredItems.filter((i) => isRepeating(i)).sort(byCreatedDesc)
  const completeItems = filteredItems.filter((i) => !isRepeating(i) && isItemComplete(i)).sort(byCreatedDesc)

  const todayLocalStr = new Date().toLocaleDateString('en-CA')

  const renderLibraryRow = (item: ChecklistItem, showOpenAge: boolean) => {
    const assignees = (item.checklist_item_assignees ?? [])
      .map((a) => a.users?.name || a.users?.email || '')
      .filter(Boolean)
    const openAge = showOpenAge ? openAgeLabel(oldestOpenByItem.get(item.id), todayLocalStr) : ''
    const menuOpen = openMenuItemId === item.id
    const expanded = expandedItemId === item.id
    const toggleExpanded = () => setExpandedItemId(expanded ? null : item.id)
    return (
      <li key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.75rem', position: 'relative', background: expanded ? 'var(--bg-muted)' : undefined }}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} activity for ${item.title}`}
          onClick={(e) => {
            // Links inside the title stay links — don't toggle on them.
            if ((e.target as HTMLElement).closest('a')) return
            toggleExpanded()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleExpanded()
            }
          }}
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        >
          <div style={{ fontSize: '0.9375rem', color: 'var(--text-strong)' }}>
            <ChecklistTitleWithLinks title={item.title} links={item.links} />
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.12rem 0.5rem', borderRadius: 7, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }}>
              {repeatChipLabel(item)}
            </span>
            {roadmapGoalChip(item)}
            {openAge ? (
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.12rem 0.5rem', borderRadius: 7, background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }}>
                {openAge}
              </span>
            ) : null}
            {isRepeating(item) && nextOccurrenceLabel(nextOpenByItem.get(item.id), todayLocalStr) ? (
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.12rem 0.5rem', borderRadius: 7, background: 'var(--bg-green-100)', color: 'var(--text-green-700)' }}>
                {nextOccurrenceLabel(nextOpenByItem.get(item.id), todayLocalStr)}
              </span>
            ) : null}
            {item.reminder_time ? (
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.12rem 0.5rem', borderRadius: 7, background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-700)' }}>
                🔔 {item.reminder_time.slice(0, 5)}
              </span>
            ) : null}
            {(item.notify_creator_on_complete || item.notify_on_complete_user_id) ? (
              <span style={{ fontSize: '0.72rem', padding: '0.12rem 0.5rem', borderRadius: 7, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                notifies on done
              </span>
            ) : null}
            {item.created_at ? (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>created {compactTimeAgo(item.created_at)}</span>
            ) : null}
          </div>
        </div>
        <span style={{ display: 'inline-flex', flexShrink: 0 }} title={assignees.join(', ') || 'Unassigned'}>
          {assignees.slice(0, 3).map((n, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--bg-blue-tint)',
                color: 'var(--text-blue-800)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.68rem',
                fontWeight: 600,
                marginLeft: i > 0 ? -8 : 0,
                border: '2px solid var(--surface)',
                boxSizing: 'content-box',
              }}
            >
              {initialsFor(n)}
            </span>
          ))}
          {assignees.length > 3 ? (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 3 }}>+{assignees.length - 3}</span>
          ) : null}
          {assignees.length === 0 ? <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', alignSelf: 'center' }}>unassigned</span> : null}
        </span>
        <button
          type="button"
          onClick={() => setOpenMenuItemId(menuOpen ? null : item.id)}
          aria-label={`Actions for ${item.title}`}
          aria-expanded={menuOpen}
          style={{ width: 36, height: 36, flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', borderRadius: 8 }}
        >
          ⋮
        </button>
        {menuOpen ? (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpenMenuItemId(null)} />
            <div style={{ position: 'absolute', right: 8, top: '80%', zIndex: 41, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)', minWidth: 170, overflow: 'hidden' }}>
              {item.roadmap_group_task_id && onOpenRoadmap ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuItemId(null)
                    const rid = item.checklist_tech_tree_group_tasks?.checklist_tech_tree_groups?.roadmap_id
                    if (rid) onOpenRoadmap(rid)
                  }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.9rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-strong)' }}
                >
                  ⛰ Open in Roadmap
                </button>
              ) : null}
              {!item.roadmap_group_task_id ? (
              <button type="button" onClick={() => { setOpenMenuItemId(null); setEditItemId(item.id) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.9rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-strong)' }}>
                Edit
              </button>
              ) : null}
              {isNotificationRecipient(item) ? (
                <button type="button" onClick={() => { setOpenMenuItemId(null); setMuteModalItemId(item.id); setMuteModalTitle(item.title) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.9rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-strong)', borderTop: '1px solid var(--border)' }}>
                  Mute notifications
                </button>
              ) : null}
              {!item.roadmap_group_task_id ? (
              <button type="button" onClick={() => { setOpenMenuItemId(null); setManageDeletePending({ id: item.id, title: item.title?.trim() || 'Untitled' }) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.9rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-red-700)', borderTop: '1px solid var(--border)' }}>
                Delete
              </button>
              ) : null}
            </div>
          </>
        ) : null}
        </div>
        {expanded ? (
          <div style={{ padding: '0 0.75rem 0.7rem', background: 'var(--bg-muted)' }}>
            <ChecklistItemActivity
              item={item}
              authUserId={authUserId}
              showInstanceDays={isRepeating(item)}
              setError={setError}
              onComplete={async (activityInst) => {
                if (!authUserId) return false
                const res = await completeChecklistInstance({
                  instanceId: activityInst.id,
                  checklistItemId: item.id,
                  scheduledDate: activityInst.scheduledDate,
                  authUserId,
                })
                if (!res.ok) {
                  setError(res.error ?? 'Failed to complete this task.')
                  return false
                }
                await loadItems()
                return true
              }}
            />
          </div>
        ) : null}
      </li>
    )
  }

  const librarySection = (label: string, rows: ChecklistItem[], showOpenAge: boolean) => (
    <div style={{ marginBottom: '1rem' }}>
      <p style={{ margin: '0 0 0.35rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.03em', color: 'var(--text-muted)' }}>{label}</p>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-faint)' }}>None</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
          {rows.map((item) => renderLibraryRow(item, showOpenAge))}
        </ul>
      )}
    </div>
  )

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          id="checklist-manage-search"
          type="search"
          placeholder="Search tasks or people…"
          value={manageSearchQuery}
          onChange={(e) => setManageSearchQuery(e.target.value)}
          aria-label="Search tasks or people"
          style={{
            flex: '2 1 200px',
            minWidth: 0,
            boxSizing: 'border-box',
            height: 42,
            padding: '0 0.75rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            fontSize: '0.9375rem',
          }}
        />
        <select
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value)}
          aria-label="Filter by assignee"
          style={{ flex: '1 1 130px', height: 42, padding: '0 0.5rem', borderRadius: 8, border: '1px solid var(--border-strong)', fontSize: '0.9375rem' }}
        >
          <option value="">Everyone</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name || u.email}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => checklistAddModal?.openAddModal(filterUserId || undefined)}
          style={{ height: 42, padding: '0 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, flexShrink: 0 }}
        >
          ＋ New task
        </button>
      </div>
      {/* View pills (v2.2066): same grammar as Review's range filter. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
        {(
          [
            ['all', 'All', null],
            ['one_offs', 'One-offs', incompleteItems.length],
            ['repeating', '↻ Repeating', repeatingItems.length],
            ['completed', '✓ Completed', completeItems.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setManageView(key)}
            aria-pressed={manageView === key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0.3rem 0.8rem',
              borderRadius: 999,
              border: manageView === key ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              background: manageView === key ? '#2563eb' : 'var(--surface)',
              color: manageView === key ? 'white' : 'var(--text-700)',
              fontSize: '0.8125rem',
              fontWeight: manageView === key ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {label}
            {count != null ? (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0 7px',
                  borderRadius: 999,
                  background: manageView === key ? 'rgba(255,255,255,0.25)' : 'var(--bg-muted)',
                  color: manageView === key ? 'white' : 'var(--text-muted)',
                }}
              >
                {count}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {filteredItems.length > 0 && manageView === 'one_offs'
        ? librarySection(`ONE-OFFS · ${incompleteItems.length} open`, incompleteItems, true)
        : null}
      {filteredItems.length > 0 && manageView === 'repeating'
        ? librarySection(`REPEATING · ${repeatingItems.length}`, repeatingItems, false)
        : null}
      {filteredItems.length > 0 && manageView === 'completed'
        ? librarySection(`✓ COMPLETED ONE-OFFS · ${completeItems.length}`, completeItems, false)
        : null}
      {filteredItems.length > 0 && manageView === 'all' ? (
        <>
          {librarySection(`ONE-OFFS · ${incompleteItems.length} open`, incompleteItems, true)}
          {librarySection(`REPEATING · ${repeatingItems.length}`, repeatingItems, false)}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setCompletedOpen((o) => !o)}
              aria-expanded={completedOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                minHeight: 44,
                padding: '0.55rem 0.75rem',
                background: 'var(--surface)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-700)',
                textAlign: 'left',
              }}
            >
              <span>✓ Completed one-offs</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.1rem 0.55rem', borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                  {completeItems.length}
                </span>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{completedOpen ? '▾' : '▸'}</span>
              </span>
            </button>
            {completedOpen ? (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {completeItems.length === 0 ? (
                  <p style={{ margin: 0, padding: '0.6rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-faint)' }}>None</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {completeItems.map((item) => renderLibraryRow(item, false))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
      {items.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No checklist items yet.</p>}
      {items.length > 0 && filteredItems.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>No items match your search.</p>
      )}

      {manageDeletePending && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
          onClick={() => {
            if (!manageDeleteSubmitting) setManageDeletePending(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checklist-manage-delete-title"
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.5rem',
              minWidth: 320,
              maxWidth: 480,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="checklist-manage-delete-title"
              style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}
            >
              Delete checklist item?
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-600)', lineHeight: 1.45 }}>
              <strong>{manageDeletePending.title}</strong>
            </p>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              This removes the item and its instances. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { if (!manageDeleteSubmitting) setManageDeletePending(null) }}
                disabled={manageDeleteSubmitting}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-200)',
                  color: 'var(--text-700)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: manageDeleteSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void performDeleteChecklistItem(manageDeletePending.id)}
                disabled={manageDeleteSubmitting}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: manageDeleteSubmitting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {manageDeleteSubmitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ChecklistItemMuteModal
        open={!!muteModalItemId}
        checklistItemId={muteModalItemId}
        taskTitle={muteModalTitle}
        authUserId={authUserId}
        onClose={() => setMuteModalItemId(null)}
        onSaved={() => loadItems()}
      />
    </div>
  )
}
