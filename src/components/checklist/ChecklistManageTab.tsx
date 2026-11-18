/**
 * Checklist → Manage: the library of tasks, one card a task, with its search, its person filter, its view pills
 * and its delete and mute windows. It was a component inside `pages/Checklist.tsx` until v2.7724 and moved here
 * whole, so the page keeps the tab bar, the `?tab` router and the one edit window (`setEditItemId`). The tab reads
 * its own items and hears `checklist-item-saved`; nothing in it changed in the move (CHECKLIST_TABS map).
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { activeUsersQuery } from '../../lib/people/fetchActiveUsers'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import ChecklistItemMuteModal from '../ChecklistItemMuteModal'
import { ChecklistTitleWithLinks } from '../ChecklistTitleWithLinks'
import { compactTimeAgo } from '../../lib/subcontractorLastActivityCompact'
import { ChecklistItemActivity } from './ChecklistItemActivity'
import { completeChecklistInstance } from '../../lib/checklistCompleteInstance'
import { initialsFor } from '../../lib/checklistTeamBoard'
import { recordNavClick } from '../../lib/navClickTelemetry'
import {
  AGING_ITEM_OPENED_CONTROL,
  ageStateForDays,
  agingItemOpenedTarget,
  compareOldestFirst,
  ONE_OFF_TASK_AGE,
  shouldRecordAgingOpen,
  ymdAgeDays,
} from '../../lib/ageState'
import { dueChipLabel } from '../../lib/checklistDueDates'
import { pushedChipLabel, summarizeDuePushes, type DueChangeRow } from '../../lib/checklistDuePushes'
import { ChecklistManageTimeline } from './ChecklistManageTimeline'
import { isScheduledAhead, nextOccurrenceLabel, openAgeLabel, repeatChipLabel } from '../../lib/checklistManageGroups'
import { EmptyState } from '../EmptyState'
import { showsNotifiesOnDone } from '../../lib/checklistManageRow'
import { ManageRowMenu } from './ManageRowMenu'
import { checklistManageEmptyWords } from '../../lib/checklistEmptyWords'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { RoadmapTaskEmbed } from '../../lib/tasks/personDay'
import { roadmapGoalChip, type ChecklistRole } from './checklistPageShared'

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
  due_date: string | null
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
export function ChecklistManageTab({ authUserId, role, setError, setEditItemId, onOpenRoadmap }: { authUserId: string | null; role: ChecklistRole | null; setError: (s: string | null) => void; setEditItemId: (id: string) => void; onOpenRoadmap?: (roadmapId: string) => void }) {
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
  /** Due-change ledger rows per item (v2.2371) — powers the "pushed ×N" chip. */
  const [duePushesByItem, setDuePushesByItem] = useState<Map<string, DueChangeRow[]>>(new Map())
  const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null)
  /** The list did not load: the error says so, and the empty line stays out of its way (punch list #348). */
  const [loadFailed, setLoadFailed] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
  /** Card expanded to show its activity spine (history + notes), v2.2010. */
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  /** View pills (v2.2066): Repeating gets a front door instead of living below 28 one-offs.
   *  Default is One-offs (v2.2118) — the open list is what people come here for; All is one tap away. */
  const [manageView, setManageView] = useState<'all' | 'one_offs' | 'repeating' | 'completed' | 'timeline'>('one_offs')
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
    const { data } = await activeUsersQuery('id, name, email', { includeDev: true, withLogin: true })
    setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
  }

  async function loadItems() {
    const baseSelect = 'id, title, links, created_by_user_id, repeat_type, repeat_days_of_week, repeat_days_after, repeat_end_date, start_date, due_date, show_until_completed, notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope, created_at, updated_at, roadmap_group_task_id, checklist_tech_tree_group_tasks(group_id, checklist_tech_tree_groups(title, roadmap_id, checklist_tech_tree_roadmaps(title)))'
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
      setLoadFailed(true)
      return
    }
    setLoadFailed(false)
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
    const todayForNext = todayYmdInAppTz()
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
    // Pushed-back markers (v2.2371): the due-change ledger, chronological.
    const { data: pushData } = await supabase
      .from('checklist_item_due_changes')
      .select('checklist_item_id, changed_at, changed_by, from_due, to_due')
      .in('checklist_item_id', ids)
      .order('changed_at', { ascending: true })
    const pushes = new Map<string, DueChangeRow[]>()
    for (const r of (pushData ?? []) as Array<DueChangeRow & { checklist_item_id: string }>) {
      pushes.set(r.checklist_item_id, [...(pushes.get(r.checklist_item_id) ?? []), r])
    }
    setDuePushesByItem(pushes)
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
  const todayLocalStr = todayYmdInAppTz()
  const incompleteItems = filteredItems.filter((i) => !isRepeating(i) && !isItemComplete(i)).sort(byCreatedDesc)
  // Scheduled split (v2.2346): "open" means actionable today — future-dated
  // one-offs park in their own section, soonest start first.
  // Open one-offs OLDEST first (journey-map #40 / J30-3): the 128-day task
  // leads the list instead of sinking under this week's. Oldest open instance
  // date wins; an item with no instance yet falls back to its created date.
  const openOneOffs = incompleteItems
    .filter((i) => !isScheduledAhead(oldestOpenByItem.get(i.id), todayLocalStr))
    .sort((a, b) =>
      compareOldestFirst(
        oldestOpenByItem.get(a.id) ?? a.created_at ?? undefined,
        oldestOpenByItem.get(b.id) ?? b.created_at ?? undefined,
      ),
    )
  const scheduledOneOffs = incompleteItems
    .filter((i) => isScheduledAhead(oldestOpenByItem.get(i.id), todayLocalStr))
    .sort((a, b) => (oldestOpenByItem.get(a.id) ?? '').localeCompare(oldestOpenByItem.get(b.id) ?? ''))
  const repeatingItems = filteredItems.filter((i) => isRepeating(i)).sort(byCreatedDesc)
  const completeItems = filteredItems.filter((i) => !isRepeating(i) && isItemComplete(i)).sort(byCreatedDesc)

  const renderLibraryRow = (item: ChecklistItem, showOpenAge: boolean) => {
    const assignees = (item.checklist_item_assignees ?? [])
      .map((a) => a.users?.name || a.users?.email || '')
      .filter(Boolean)
    // Due-aware age chip (v2.2351): scheduled-ahead → "starts …"; a due date
    // inside its window → "due …"; late or legacy → the open/late clock.
    const oldestOpen = oldestOpenByItem.get(item.id)
    const openAge = !showOpenAge
      ? ''
      : isScheduledAhead(oldestOpen, todayLocalStr) || !item.due_date
        ? openAgeLabel(oldestOpen, todayLocalStr)
        : oldestOpen
          ? dueChipLabel(item.due_date, todayLocalStr)
          : ''
    const menuOpen = openMenuItemId === item.id
    const expanded = expandedItemId === item.id
    const toggleExpanded = () => {
      // Opening an aging one-off records `aging_item_opened` (journey-map #40) — scheduled-ahead rows aren't aging.
      if (!expanded && showOpenAge && oldestOpen && !isScheduledAhead(oldestOpen, todayLocalStr)) {
        const days = ymdAgeDays(oldestOpen, todayLocalStr)
        const state = ageStateForDays(days, ONE_OFF_TASK_AGE)
        if (days != null && shouldRecordAgingOpen(state)) {
          recordNavClick(authUserId, role, AGING_ITEM_OPENED_CONTROL, agingItemOpenedTarget('one-off-task', days, state))
        }
      }
      setExpandedItemId(expanded ? null : item.id)
    }
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
              // Chip palette (v2.2346/v2.2351): "starts …" calm blue; "due <day>"
              // neutral; "due today" amber; late/open stays the red clock.
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.12rem 0.5rem',
                  borderRadius: 7,
                  ...(openAge.startsWith('starts ')
                    ? { background: 'var(--bg-blue-tint)', border: '1px solid #2563eb', color: 'var(--text-blue-800)' }
                    : openAge === 'due today'
                      ? { background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }
                      : openAge.startsWith('due ')
                        ? { background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-700)' }
                        : { background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }),
                }}
              >
                {openAge}
              </span>
            ) : null}
            {(() => {
              // "pushed ×N" (v2.2371): only while the current due sits later than the original commitment.
              const label = item.due_date ? pushedChipLabel(summarizeDuePushes(duePushesByItem.get(item.id) ?? [], item.due_date)) : ''
              return label ? (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.12rem 0.5rem', borderRadius: 7, background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }}>
                  {label}
                </span>
              ) : null
            })()}
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
            {showsNotifiesOnDone({
              notifyCreator: !!item.notify_creator_on_complete,
              notifyOtherUserId: item.notify_on_complete_user_id ?? null,
              creatorId: item.created_by_user_id ?? null,
              assigneeIds: (item.checklist_item_assignees ?? []).map((a) => a.user_id),
            }) ? (
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
        <ManageRowMenu
          title={item.title}
          open={menuOpen}
          onOpenChange={(open) => setOpenMenuItemId(open ? item.id : null)}
          lines={[
            ...(item.roadmap_group_task_id && onOpenRoadmap
              ? [
                  {
                    key: 'roadmap',
                    label: '⛰ Open in Roadmap',
                    onPress: () => {
                      const rid = item.checklist_tech_tree_group_tasks?.checklist_tech_tree_groups?.roadmap_id
                      if (rid) onOpenRoadmap(rid)
                    },
                  },
                ]
              : []),
            ...(!item.roadmap_group_task_id ? [{ key: 'edit', label: 'Edit', onPress: () => setEditItemId(item.id) }] : []),
            ...(isNotificationRecipient(item)
              ? [
                  {
                    key: 'mute',
                    label: 'Mute notifications',
                    onPress: () => {
                      setMuteModalItemId(item.id)
                      setMuteModalTitle(item.title)
                    },
                  },
                ]
              : []),
            ...(!item.roadmap_group_task_id ? [{ key: 'delete', label: 'Delete', danger: true, onPress: () => setManageDeletePending({ id: item.id, title: item.title?.trim() || 'Untitled' }) }] : []),
          ]}
        />
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

  // Empty words (punch list #184, sweep C): no task yet offers ＋ New task, a search with no match offers Clear the search.
  const manageEmpty = checklistManageEmptyWords({
    total: items.length,
    shown: filteredItems.length,
    query: manageSearchQuery,
    forPerson: filterUserId !== '',
    loadFailed,
    newTask: () => checklistAddModal?.openAddModal(filterUserId || undefined),
    clearSearch: () => setManageSearchQuery(''),
  })

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
            ['one_offs', 'One-offs', incompleteItems.length],
            ['all', 'All', null],
            ['repeating', '↻ Repeating', repeatingItems.length],
            ['completed', '✓ Completed', completeItems.length],
            ['timeline', '📅 Timeline', incompleteItems.filter((i) => i.due_date != null).length],
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
      {filteredItems.length > 0 && manageView === 'one_offs' ? (
        <>
          {librarySection(`ONE-OFFS · ${openOneOffs.length} open · oldest first`, openOneOffs, true)}
          {scheduledOneOffs.length > 0 ? librarySection(`SCHEDULED · ${scheduledOneOffs.length}`, scheduledOneOffs, true) : null}
        </>
      ) : null}
      {manageView === 'timeline' ? (
        <ChecklistManageTimeline
          items={[...incompleteItems, ...completeItems].map((i) => ({
            id: i.id,
            title: i.title,
            start_date: i.start_date,
            due_date: i.due_date,
            complete: !isRepeating(i) && isItemComplete(i),
          }))}
          pushesByItem={duePushesByItem}
          onOpenItem={(id) => setEditItemId(id)}
        />
      ) : null}
      {filteredItems.length > 0 && manageView === 'repeating'
        ? librarySection(`REPEATING · ${repeatingItems.length}`, repeatingItems, false)
        : null}
      {filteredItems.length > 0 && manageView === 'completed'
        ? librarySection(`✓ COMPLETED ONE-OFFS · ${completeItems.length}`, completeItems, false)
        : null}
      {filteredItems.length > 0 && manageView === 'all' ? (
        <>
          {librarySection(`ONE-OFFS · ${openOneOffs.length} open · oldest first`, openOneOffs, true)}
          {scheduledOneOffs.length > 0 ? librarySection(`SCHEDULED · ${scheduledOneOffs.length}`, scheduledOneOffs, true) : null}
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
      {manageEmpty ? <EmptyState {...manageEmpty} /> : null}

      {manageDeletePending && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 750,
            padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem',
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
