import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { DashboardGroupCard } from './DashboardGroupCard'
import { ChecklistSkeleton } from './DashboardSkeletons'
import { ChecklistTitleWithLinks } from '../ChecklistTitleWithLinks'
import ChecklistItemMuteModal from '../ChecklistItemMuteModal'
import { getNextDisplayOrders } from '../../utils/checklistOrder'
import { formatErrorMessage } from '../../utils/errorHandling'
import { toLocalDateString } from '../../lib/dailyGoalsGate'
import { formatTDays, getDaysUntilDue } from '../../lib/dashboardMyInbox'
import type { ChecklistInstance } from '../../lib/dashboardBootTypes'

/**
 * Dashboard "My Inbox" group card: Due Today / Overdue checklists and the
 * dev-only Recently Completed corner section, plus the checklist CRUD engine
 * (toggles, forward, mute, completion notifications, days-after-completion
 * repeat) and the Forward + Mute modals (extraction-series refactor; no
 * behavior change).
 *
 * The parent renders ONE element at THREE mutually exclusive role positions
 * (assistant-like / dev+master / everyone else — quirk #4), so exactly one
 * copy always mounts; the component self-gates its card render on
 * `showMyInboxCard` and reports that gate up via `onVisibleChange` so the
 * parent's SectionDock entry can mirror it (same seam as
 * DashboardMyBidsSection's `onContentVisibleChange`).
 *
 * Today-checklist data comes from the parent's `useDashboardBoot` seam
 * (`todayChecklist` + setter, `checklistLoading`, `userLoading`); the engine
 * here mutates it via the setter. `getCurrentUserName` and `setUserError`
 * stay parent-owned (boot seam) and come in as props.
 *
 * Quirk #13 (preserve): the Recently Completed corner link only appears when
 * `completedItems.length > 0`; its unread count filters out ignored task
 * types first, then unread.
 */
export function DashboardMyInboxCard({
  authUserId,
  role,
  isMobile,
  todayChecklist,
  setTodayChecklist,
  checklistLoading,
  userLoading,
  setUserError,
  getCurrentUserName,
  onVisibleChange,
  loadOnMount = false,
}: {
  authUserId: string | undefined
  role: UserRole | null
  isMobile: boolean
  todayChecklist: ChecklistInstance[]
  setTodayChecklist: React.Dispatch<React.SetStateAction<ChecklistInstance[]>>
  checklistLoading: boolean
  userLoading: boolean
  setUserError: (err: string | null) => void
  getCurrentUserName: () => Promise<string>
  /** Reports the card's render gate so the parent's SectionDock entry can mirror it. */
  onVisibleChange: (visible: boolean) => void
  /**
   * Self-load Due Today on mount. Dashboard leaves this false (its boot query seeds
   * `todayChecklist`); the Quickfill adapter has no boot and passes true — that path
   * uses this card's own richer query (today + overdue show-until-completed).
   */
  loadOnMount?: boolean
}) {
  const { showToast } = useToastContext()
  const isDev = role === 'dev'

  const checklistToggleInFlightRef = useRef(new Set<string>())
  const [outstandingItems, setOutstandingItems] = useState<ChecklistInstance[]>([])
  const [outstandingLoading, setOutstandingLoading] = useState(true)
  const outstandingToggleInFlightRef = useRef(new Set<string>())
  const [sendTaskUsers, setSendTaskUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [fwdInstance, setFwdInstance] = useState<ChecklistInstance | null>(null)
  const [fwdTitle, setFwdTitle] = useState('')
  const [fwdAssigneeId, setFwdAssigneeId] = useState('')
  const [fwdSaving, setFwdSaving] = useState(false)
  const [muteModalItemId, setMuteModalItemId] = useState<string | null>(null)
  const [muteModalTitle, setMuteModalTitle] = useState('')
  const [completedItemsOpen, setCompletedItemsOpen] = useState(false)
  const [completedItems, setCompletedItems] = useState<ChecklistInstance[]>([])
  const [completedItemsLoading, setCompletedItemsLoading] = useState(false)
  const [readInstanceIds, setReadInstanceIds] = useState<Set<string>>(new Set())
  const [ignoredItemIds, setIgnoredItemIds] = useState<Set<string>>(new Set())
  const [ignoredSectionOpen, setIgnoredSectionOpen] = useState(false)
  const [ignoringItemId, setIgnoringItemId] = useState<string | null>(null)
  const [expandedCompleterIds, setExpandedCompleterIds] = useState<Set<string>>(new Set())
  const [markingReadId, setMarkingReadId] = useState<string | null>(null)
  const [markingUnreadId, setMarkingUnreadId] = useState<string | null>(null)
  const [completedItemsUserMap, setCompletedItemsUserMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!authUserId) {
      setOutstandingLoading(false)
      return
    }
    loadOutstanding()
  }, [authUserId])

  useEffect(() => {
    if (!loadOnMount || !authUserId) return
    void loadTodayChecklist()
  }, [loadOnMount, authUserId])

  // Load users for Forward modal (all users, for Outstanding Forward)
  useEffect(() => {
    if (!authUserId) return
    supabase.from('users').select('id, name, email').order('name').then(({ data }) => {
      setSendTaskUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
    })
  }, [authUserId])

  useEffect(() => {
    if (!authUserId || !isDev) return
    setCompletedItemsLoading(true)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    Promise.all([
      supabase
        .from('checklist_instances')
        .select('id, checklist_item_id, scheduled_date, completed_at, completed_by_user_id, checklist_items(title, links), checklist_instance_assignees(user_id)')
        .not('completed_at', 'is', null)
        .gte('completed_at', sevenDaysAgo)
        .order('completed_at', { ascending: false }),
      supabase
        .from('dev_read_completed_items')
        .select('checklist_instance_id')
        .eq('dev_user_id', authUserId),
      supabase
        .from('dev_ignored_checklist_items')
        .select('checklist_item_id')
        .eq('dev_user_id', authUserId),
    ]).then(async ([instRes, readRes, ignoredRes]) => {
      if (instRes.error) {
        setCompletedItemsLoading(false)
        return
      }
      const instances = (instRes.data ?? []) as ChecklistInstance[]
      const userIds = new Set<string>()
      instances.forEach((i) => {
        ;(i.checklist_instance_assignees ?? []).forEach((a) => userIds.add(a.user_id))
        if (i.completed_by_user_id) userIds.add(i.completed_by_user_id)
      })
      const userMap = new Map<string, string>()
      if (userIds.size > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', Array.from(userIds))
        ;(usersData ?? []).forEach((u: { id: string; name: string | null; email: string | null }) => {
          userMap.set(u.id, u.name || u.email || 'Unknown')
        })
      }
      setCompletedItems(instances)
      setCompletedItemsUserMap(userMap)
      const readSet = new Set<string>()
      ;(readRes.data ?? []).forEach((r: { checklist_instance_id: string }) => readSet.add(r.checklist_instance_id))
      setReadInstanceIds(readSet)
      const ignoredSet = new Set<string>()
      ;(ignoredRes.data ?? []).forEach((r: { checklist_item_id: string }) => ignoredSet.add(r.checklist_item_id))
      setIgnoredItemIds(ignoredSet)
      if (instances.length > 0) {
        const completerIds = new Set(instances.map((i) => i.completed_by_user_id).filter(Boolean) as string[])
        setExpandedCompleterIds((prev) => (prev.size === 0 ? completerIds : prev))
      }
      setCompletedItemsLoading(false)
    })
  }, [authUserId, isDev])

  async function markCompletedItemAsRead(inst: ChecklistInstance) {
    if (!authUserId || markingReadId) return
    setMarkingReadId(inst.id)
    await supabase.from('dev_read_completed_items').insert({
      dev_user_id: authUserId,
      checklist_instance_id: inst.id,
    })
    setMarkingReadId(null)
    setReadInstanceIds((prev) => new Set(prev).add(inst.id))
  }

  async function markCompletedItemAsUnread(inst: ChecklistInstance) {
    if (!authUserId || markingUnreadId) return
    setMarkingUnreadId(inst.id)
    await supabase.from('dev_read_completed_items').delete().eq('dev_user_id', authUserId).eq('checklist_instance_id', inst.id)
    setMarkingUnreadId(null)
    setReadInstanceIds((prev) => {
      const next = new Set(prev)
      next.delete(inst.id)
      return next
    })
  }

  async function ignoreTaskType(checklistItemId: string) {
    if (!authUserId || ignoringItemId) return
    setIgnoringItemId(checklistItemId)
    await supabase.from('dev_ignored_checklist_items').insert({
      dev_user_id: authUserId,
      checklist_item_id: checklistItemId,
    })
    setIgnoringItemId(null)
    setIgnoredItemIds((prev) => new Set(prev).add(checklistItemId))
  }

  async function unignoreTaskType(checklistItemId: string) {
    if (!authUserId || ignoringItemId) return
    setIgnoringItemId(checklistItemId)
    await supabase.from('dev_ignored_checklist_items').delete().eq('dev_user_id', authUserId).eq('checklist_item_id', checklistItemId)
    setIgnoringItemId(null)
    setIgnoredItemIds((prev) => {
      const next = new Set(prev)
      next.delete(checklistItemId)
      return next
    })
  }

  async function loadTodayChecklist() {
    if (!authUserId) return
    const today = toLocalDateString(new Date())
    const { data: todayData } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id), checklist_instance_assignees!inner(user_id)')
      .eq('checklist_instance_assignees.user_id', authUserId)
      .eq('scheduled_date', today)
      .order('created_at', { ascending: true })
    const { data: itemsData } = await supabase
      .from('checklist_items')
      .select('id')
      .eq('show_until_completed', true)
    const itemIds = (itemsData ?? []).map((i) => i.id)
    let overdueData: ChecklistInstance[] = []
    if (itemIds.length > 0) {
      const { data } = await supabase
        .from('checklist_instances')
        .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id), checklist_instance_assignees!inner(user_id)')
        .eq('checklist_instance_assignees.user_id', authUserId)
        .is('completed_at', null)
        .lt('scheduled_date', today)
        .in('checklist_item_id', itemIds)
        .order('scheduled_date', { ascending: true })
      overdueData = (data ?? []) as ChecklistInstance[]
    }
    const merged = [...overdueData, ...(todayData ?? [])]
    merged.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    setTodayChecklist(merged as ChecklistInstance[])
  }

  async function loadOutstanding() {
    if (!authUserId) return
    setOutstandingLoading(true)
    const { data, error } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, checklist_items(title, links, repeat_type), checklist_instance_assignees!inner(user_id)')
      .eq('checklist_instance_assignees.user_id', authUserId)
      .is('completed_at', null)
      .order('scheduled_date', { ascending: true })
    if (error) {
      setOutstandingLoading(false)
      return
    }
    const raw = (data ?? []) as Array<{
      id: string
      checklist_item_id: string
      scheduled_date: string
      completed_at: string | null
      notes: string | null
      completed_by_user_id: string | null
      created_at: string | null
      checklist_items?: { title?: string; links?: string[] | null; repeat_type?: string } | null
      checklist_instance_assignees?: Array<{ user_id: string }>
    }>
    const instances = raw.filter((inst) => {
      const assignees = inst.checklist_instance_assignees ?? []
      return assignees.length > 0 && (inst.checklist_items as { repeat_type?: string } | null)?.repeat_type === 'once'
    })
    const itemIds = [...new Set(instances.map((i) => i.checklist_item_id))]
    const orderMap = new Map<string, number>()
    if (itemIds.length > 0) {
      const { data: orderData } = await supabase
        .from('checklist_item_assignees')
        .select('checklist_item_id, display_order')
        .eq('user_id', authUserId)
        .in('checklist_item_id', itemIds)
      for (const row of (orderData ?? []) as Array<{ checklist_item_id: string; display_order: number | null }>) {
        orderMap.set(row.checklist_item_id, row.display_order ?? 999999)
      }
    }
    const sorted = [...instances].sort((a, b) => {
      const orderA = orderMap.get(a.checklist_item_id) ?? 999999
      const orderB = orderMap.get(b.checklist_item_id) ?? 999999
      if (orderA !== orderB) return orderA - orderB
      return a.scheduled_date.localeCompare(b.scheduled_date)
    })
    setOutstandingItems((sorted.slice(0, 10) as unknown) as ChecklistInstance[])
    setOutstandingLoading(false)
  }

  async function toggleChecklistComplete(inst: ChecklistInstance) {
    if (!authUserId) return
    if (checklistToggleInFlightRef.current.has(inst.id)) return
    checklistToggleInFlightRef.current.add(inst.id)

    const isCompleted = !!inst.completed_at
    const nextCompletedAt = isCompleted ? null : new Date().toISOString()
    const nextCompletedBy = isCompleted ? null : authUserId
    const previous = inst

    setTodayChecklist((prev) =>
      prev.map((row) =>
        row.id === inst.id
          ? { ...row, completed_at: nextCompletedAt, completed_by_user_id: nextCompletedBy }
          : row,
      ),
    )

    try {
      const { error: e } = await supabase
        .from('checklist_instances')
        .update({
          completed_at: nextCompletedAt,
          completed_by_user_id: nextCompletedBy,
        })
        .eq('id', inst.id)
      if (e) throw e
      await loadTodayChecklist()
      if (!isCompleted) {
        void sendChecklistCompletionNotifications(inst)
        void maybeCreateNextChecklistInstance(inst)
      }
    } catch (e: unknown) {
      setTodayChecklist((prev) => prev.map((row) => (row.id === inst.id ? previous : row)))
      showToast(formatErrorMessage(e, 'Could not update checklist'), 'error')
    } finally {
      checklistToggleInFlightRef.current.delete(inst.id)
    }
  }

  async function toggleOutstandingComplete(inst: ChecklistInstance) {
    if (!authUserId) return
    if (outstandingToggleInFlightRef.current.has(inst.id)) return
    const isCompleted = !!inst.completed_at
    if (isCompleted) {
      return
    }

    outstandingToggleInFlightRef.current.add(inst.id)
    let snapshot: ChecklistInstance[] = []
    setOutstandingItems((prev) => {
      snapshot = prev
      return prev.filter((row) => row.id !== inst.id)
    })

    try {
      const { error: e } = await supabase
        .from('checklist_instances')
        .update({
          completed_at: new Date().toISOString(),
          completed_by_user_id: authUserId,
        })
        .eq('id', inst.id)
      if (e) throw e
      await loadOutstanding()
      void sendChecklistCompletionNotifications(inst)
      void maybeCreateNextChecklistInstance(inst)
    } catch (e: unknown) {
      setOutstandingItems(snapshot)
      showToast(formatErrorMessage(e, 'Could not update checklist'), 'error')
    } finally {
      outstandingToggleInFlightRef.current.delete(inst.id)
    }
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
    setUserError(null)
    try {
      const { data: sourceItem } = await supabase
        .from('checklist_items')
        .select('notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope, show_until_completed')
        .eq('id', fwdInstance.checklist_item_id)
        .single()
      const src = sourceItem as { notify_on_complete_user_id: string | null; notify_creator_on_complete: boolean; reminder_time: string | null; reminder_scope: string | null; show_until_completed?: boolean } | null
      const { data: newItem, error: itemErr } = await supabase
        .from('checklist_items')
        .insert({
          title: fwdTitle.trim(),
          created_by_user_id: authUserId,
          repeat_type: 'once',
          start_date: fwdInstance.scheduled_date,
          show_until_completed: src?.show_until_completed ?? true,
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
      await loadTodayChecklist()
      await loadOutstanding()
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : 'Failed to forward')
    } finally {
      setFwdSaving(false)
    }
  }

  async function sendChecklistCompletionNotifications(inst: ChecklistInstance) {
    const { data: item } = await supabase
      .from('checklist_items')
      .select('notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id, title')
      .eq('id', inst.checklist_item_id)
      .single()
    if (!item) return
    const title = (item as { title: string }).title
    const assigneeName = await getCurrentUserName()
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

  async function maybeCreateNextChecklistInstance(inst: ChecklistInstance) {
    const { data: item } = await supabase
      .from('checklist_items')
      .select('repeat_type, repeat_days_after, repeat_end_date')
      .eq('id', inst.checklist_item_id)
      .single()
    if (!item) return
    const rt = (item as { repeat_type: string }).repeat_type
    if (rt !== 'days_after_completion') return
    const daysAfter = (item as { repeat_days_after: number | null }).repeat_days_after
    if (!daysAfter) return
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
    const { data: assignees } = await supabase
      .from('checklist_item_assignees')
      .select('user_id')
      .eq('checklist_item_id', inst.checklist_item_id)
    const assigneeIds = (assignees ?? []).map((r: { user_id: string }) => r.user_id)
    if (assigneeIds.length === 0) return
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
  }

  const showChecklist = checklistLoading || todayChecklist.length > 0
  /** Recently Completed only earns its corner link when something was actually completed (dev-only feature). */
  const showRecentlyCompleted = isDev && completedItems.length > 0
  /** My Inbox card: Due Today / Overdue / Recently Completed Tasks (dev) grouped as one unit. */
  const showMyInboxCard = userLoading || showChecklist || outstandingLoading || outstandingItems.length > 0 || showRecentlyCompleted

  useEffect(() => {
    onVisibleChange(showMyInboxCard)
  }, [showMyInboxCard, onVisibleChange])

  return (
    <>
      {showMyInboxCard && (
        <DashboardGroupCard
          id="dash-my-inbox"
          title="My Inbox"
          headerRight={
            showRecentlyCompleted ? (
              <button
                type="button"
                onClick={() => setCompletedItemsOpen((o) => !o)}
                aria-expanded={completedItemsOpen}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 400,
                  color: 'var(--text-link)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span aria-hidden style={{ fontSize: '0.6875rem', marginRight: 4 }}>{completedItemsOpen ? '▼' : '▶'}</span>
                Recently Completed
                {(() => {
                  const n = completedItems
                    .filter((inst) => !ignoredItemIds.has(inst.checklist_item_id))
                    .filter((inst) => !readInstanceIds.has(inst.id)).length
                  return n > 0 ? ` (${n} unread)` : ''
                })()}
              </button>
            ) : null
          }
        >
        {(userLoading || showChecklist) && (
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>
            Due Today
            <Link to="/checklist" style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-link)' }}>
              View all →
            </Link>
          </h2>
          {checklistLoading && todayChecklist.length === 0 ? (
            <ChecklistSkeleton />
          ) : todayChecklist.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {todayChecklist.map((inst) => {
              const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
              const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
              const isCompleted = !!inst.completed_at
              return (
                <li
                  key={inst.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    marginBottom: '0.5rem',
                    background: isCompleted ? 'var(--bg-green-tint)' : 'var(--surface)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={() => void toggleChecklistComplete(inst)}
                  />
                  <span style={{ flex: 1, fontWeight: 500, textDecoration: isCompleted ? 'line-through' : 'none', color: isCompleted ? 'var(--text-muted)' : 'inherit' }}>
                    <ChecklistTitleWithLinks title={title} links={links} />
                  </span>
                  {inst.completed_at && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(inst.completed_at).toLocaleString()}
                    </span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {isNotificationRecipient(inst) && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); openMuteModal(inst) }}
                        style={{
                          padding: '0.2rem',
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
                        onClick={(e) => { e.preventDefault(); openFwd(inst) }}
                        style={{
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          color: 'var(--text-faint)',
                          textDecoration: 'underline',
                        }}
                      >
                        fwd
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          ) : null}
        </div>
      )}
      {(outstandingLoading || outstandingItems.length > 0) && (
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>
            Overdue
            <Link to="/checklist?tab=review" style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-link)' }}>
              View all →
            </Link>
          </h2>
          {outstandingLoading && outstandingItems.length === 0 ? (
            <ChecklistSkeleton />
          ) : outstandingItems.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {outstandingItems.map((inst) => {
                const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
                const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
                return (
                  <li
                    key={inst.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      marginBottom: '0.5rem',
                      background: 'var(--surface)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!inst.completed_at}
                      onChange={() => void toggleOutstandingComplete(inst)}
                      title="Mark complete"
                      aria-label="Mark complete"
                    />
                    <span style={{ flex: 1, fontWeight: 500 }}>
                      <ChecklistTitleWithLinks title={title} links={links} />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {' '}({formatTDays(getDaysUntilDue(inst.scheduled_date))})
                    </span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); openFwd(inst) }}
                      title="Forward"
                      aria-label="Forward"
                      style={{
                        padding: '0.25rem',
                        border: 'none',
                        borderRadius: 4,
                        background: 'transparent',
                        color: 'var(--text-blue-500)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M371.8 82.4C359.8 87.4 352 99 352 112L352 192L240 192C142.8 192 64 270.8 64 368C64 481.3 145.5 531.9 164.2 542.1C166.7 543.5 169.5 544 172.3 544C183.2 544 192 535.1 192 524.3C192 516.8 187.7 509.9 182.2 504.8C172.8 496 160 478.4 160 448.1C160 395.1 203 352.1 256 352.1L352 352.1L352 432.1C352 445 359.8 456.7 371.8 461.7C383.8 466.7 397.5 463.9 406.7 454.8L566.7 294.8C579.2 282.3 579.2 262 566.7 249.5L406.7 89.5C397.5 80.3 383.8 77.6 371.8 82.6z" />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      )}
      {showRecentlyCompleted && (
        <div>
          {completedItemsOpen && (
            <>
              {completedItemsLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
              ) : completedItems.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No completed items in the last 7 days.</p>
              ) : (
                (() => {
                  const visibleItems = completedItems.filter((inst) => !ignoredItemIds.has(inst.checklist_item_id))
                  const ignoredItems = completedItems.filter((inst) => ignoredItemIds.has(inst.checklist_item_id))
                  const byCompleter = new Map<string, ChecklistInstance[]>()
                  visibleItems.forEach((inst) => {
                    const cid = inst.completed_by_user_id ?? 'unknown'
                    if (!byCompleter.has(cid)) byCompleter.set(cid, [])
                    byCompleter.get(cid)!.push(inst)
                  })
                  const getUserName = (id: string | null) => {
                    if (!id) return 'Unknown'
                    return completedItemsUserMap.get(id) ?? id.slice(0, 8) + '…'
                  }
                  return (
                    <>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {Array.from(byCompleter.entries()).map(([completerId, items]) => {
                        const isExpanded = expandedCompleterIds.has(completerId)
                        const completerName = getUserName(completerId === 'unknown' ? null : completerId)
                        const unreadCount = items.filter((inst) => !readInstanceIds.has(inst.id)).length
                        return (
                          <li key={completerId} style={{ marginBottom: '0.5rem' }}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setExpandedCompleterIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(completerId)) next.delete(completerId)
                                else next.add(completerId)
                                return next
                              })}
                              onKeyDown={(e) => e.key === 'Enter' && setExpandedCompleterIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(completerId)) next.delete(completerId)
                                else next.add(completerId)
                                return next
                              })}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                cursor: 'pointer',
                                background: 'var(--bg-subtle)',
                              }}
                            >
                              <span style={{ fontSize: '0.875rem', minWidth: 16 }}>{isExpanded ? '▼' : '▶'}</span>
                              <span style={{ fontWeight: 500 }}>{completerName}</span>
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>({items.length} item{items.length !== 1 ? 's' : ''}{unreadCount > 0 ? ` · ${unreadCount} unread` : ''})</span>
                            </div>
                            {isExpanded && (
                              <ul style={{ listStyle: 'none', padding: '0.5rem 0 0 1.5rem', margin: 0 }}>
                                {items.map((inst) => {
                                  const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
                                  const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
                                  const isRead = readInstanceIds.has(inst.id)
                                  const assigneeName = (inst.checklist_instance_assignees ?? [])
                                    .map((a) => getUserName(a.user_id))
                                    .filter(Boolean)
                                    .join(', ') || '—'
                                  return (
                                    <li
                                      key={inst.id}
                                      style={{
                                        display: 'flex',
                                        flexDirection: isMobile ? 'column' : 'row',
                                        alignItems: isMobile ? 'stretch' : 'center',
                                        gap: isMobile ? '0.5rem' : '0.75rem',
                                        padding: '0.5rem 0.75rem',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        marginTop: '0.5rem',
                                        background: isRead ? 'var(--surface)' : 'var(--bg-sky-tint)',
                                      }}
                                    >
                                      {!isMobile && (
                                        <button
                                          type="button"
                                          title="Ignore"
                                          onClick={(e) => { e.stopPropagation(); ignoreTaskType(inst.checklist_item_id) }}
                                          disabled={!!ignoringItemId}
                                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: ignoringItemId ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L513.1 479.4C530.6 476.1 543.9 460.7 543.9 442.3C543.9 435.6 542.1 429 538.8 423.3L517 385.7C498 353.1 488 316.1 488 278.4L488 263.9C488 179.3 425.4 109.2 344 97.6L344 87.9C344 74.6 333.3 63.9 320 63.9C306.7 63.9 296 74.6 296 87.9L296 97.6C253.8 103.6 216.6 125.4 190.6 156.7L73 39.1zM224.8 190.9C246.7 162.4 281.2 144 320 144C386.3 144 440 197.7 440 264L440 278.5C440 324.7 452.3 370 475.5 409.9L488.4 432L465.8 432L224.7 190.9zM164.5 409.9C184 376.5 195.8 339.2 199.1 300.9L152.4 254.2C152.2 257.5 152.1 260.8 152.1 264.1L152.1 278.6C152.1 316.3 142.1 353.3 123.1 385.9L101.1 423.2C97.7 429 96 435.5 96 442.2C96 463.1 112.9 480 133.8 480L378.2 480L330.2 432L151.6 432L164.5 409.9zM252.1 528C262 556 288.7 576 320 576C351.3 576 378 556 387.9 528L252.1 528z"/></svg>
                                        </button>
                                      )}
                                      <span style={{ width: isMobile ? '100%' : undefined, flex: isMobile ? undefined : 1, fontWeight: 500, minWidth: 0 }}><ChecklistTitleWithLinks title={title} links={links} /></span>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: isMobile ? undefined : 1, minWidth: 0 }}>
                                        {isMobile && (
                                          <button
                                            type="button"
                                            title="Ignore"
                                            onClick={(e) => { e.stopPropagation(); ignoreTaskType(inst.checklist_item_id) }}
                                            disabled={!!ignoringItemId}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: ignoringItemId ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L513.1 479.4C530.6 476.1 543.9 460.7 543.9 442.3C543.9 435.6 542.1 429 538.8 423.3L517 385.7C498 353.1 488 316.1 488 278.4L488 263.9C488 179.3 425.4 109.2 344 97.6L344 87.9C344 74.6 333.3 63.9 320 63.9C306.7 63.9 296 74.6 296 87.9L296 97.6C253.8 103.6 216.6 125.4 190.6 156.7L73 39.1zM224.8 190.9C246.7 162.4 281.2 144 320 144C386.3 144 440 197.7 440 264L440 278.5C440 324.7 452.3 370 475.5 409.9L488.4 432L465.8 432L224.7 190.9zM164.5 409.9C184 376.5 195.8 339.2 199.1 300.9L152.4 254.2C152.2 257.5 152.1 260.8 152.1 264.1L152.1 278.6C152.1 316.3 142.1 353.3 123.1 385.9L101.1 423.2C97.7 429 96 435.5 96 442.2C96 463.1 112.9 480 133.8 480L378.2 480L330.2 432L151.6 432L164.5 409.9zM252.1 528C262 556 288.7 576 320 576C351.3 576 378 556 387.9 528L252.1 528z"/></svg>
                                          </button>
                                        )}
                                        {isMobile ? (
                                          <span style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            <span style={{ display: 'block' }}>{inst.completed_at && new Date(inst.completed_at).toLocaleDateString()}</span>
                                            <span style={{ display: 'block' }}>{inst.completed_at && new Date(inst.completed_at).toLocaleTimeString()}</span>
                                          </span>
                                        ) : (
                                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {inst.completed_at && new Date(inst.completed_at).toLocaleString()}
                                          </span>
                                        )}
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→ {assigneeName}</span>
                                        {!isMobile && (
                                          <button
                                            type="button"
                                            title="Re-send"
                                            onClick={(e) => { e.stopPropagation(); openFwd(inst) }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, cursor: 'pointer', background: 'transparent', color: 'var(--text-blue-500)', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M371.8 82.4C359.8 87.4 352 99 352 112L352 192L240 192C142.8 192 64 270.8 64 368C64 481.3 145.5 531.9 164.2 542.1C166.7 543.5 169.5 544 172.3 544C183.2 544 192 535.1 192 524.3C192 516.8 187.7 509.9 182.2 504.8C172.8 496 160 478.4 160 448.1C160 395.1 203 352.1 256 352.1L352 352.1L352 432.1C352 445 359.8 456.7 371.8 461.7C383.8 466.7 397.5 463.9 406.7 454.8L566.7 294.8C579.2 282.3 579.2 262 566.7 249.5L406.7 89.5C397.5 80.3 383.8 77.6 371.8 82.6z"/></svg>
                                          </button>
                                        )}
                                        {isMobile && (
                                          <button
                                            type="button"
                                            title="Re-send"
                                            onClick={(e) => { e.stopPropagation(); openFwd(inst) }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, cursor: 'pointer', background: 'transparent', color: 'var(--text-blue-500)', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M371.8 82.4C359.8 87.4 352 99 352 112L352 192L240 192C142.8 192 64 270.8 64 368C64 481.3 145.5 531.9 164.2 542.1C166.7 543.5 169.5 544 172.3 544C183.2 544 192 535.1 192 524.3C192 516.8 187.7 509.9 182.2 504.8C172.8 496 160 478.4 160 448.1C160 395.1 203 352.1 256 352.1L352 352.1L352 432.1C352 445 359.8 456.7 371.8 461.7C383.8 466.7 397.5 463.9 406.7 454.8L566.7 294.8C579.2 282.3 579.2 262 566.7 249.5L406.7 89.5C397.5 80.3 383.8 77.6 371.8 82.6z"/></svg>
                                          </button>
                                        )}
                                        <span style={{ marginLeft: 'auto' }}>
                                          {!isRead && (
                                            <button
                                              type="button"
                                              title="Mark as read"
                                              onClick={() => markCompletedItemAsRead(inst)}
                                              disabled={!!markingReadId}
                                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-link)', border: '1px solid #93c5fd', cursor: markingReadId ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M125.4 128C91.5 128 64 155.5 64 189.4C64 190.3 64 191.1 64.1 192L64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192L575.9 192C575.9 191.1 576 190.3 576 189.4C576 155.5 548.5 128 514.6 128L125.4 128zM528 256.3L528 448C528 456.8 520.8 464 512 464L128 464C119.2 464 112 456.8 112 448L112 256.3L266.8 373.7C298.2 397.6 341.7 397.6 373.2 373.7L528 256.3zM112 189.4C112 182 118 176 125.4 176L514.6 176C522 176 528 182 528 189.4C528 193.6 526 197.6 522.7 200.1L344.2 335.5C329.9 346.3 310.1 346.3 295.8 335.5L117.3 200.1C114 197.6 112 193.6 112 189.4z"/></svg>
                                            </button>
                                          )}
                                          {isRead && (
                                            <button
                                              type="button"
                                              title="Mark as unread"
                                              onClick={() => markCompletedItemAsUnread(inst)}
                                              disabled={!!markingUnreadId}
                                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: markingUnreadId ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M576 480C576 515.3 547.5 544 512.1 544L128 544C92.6 544 64 515.3 64 480L64 228C64.1 212.5 71.8 198 84.5 189.2L270 61.3C300.1 40.6 339.8 40.6 369.9 61.3L555.5 189.2C568.3 198 575.9 212.5 576 228L576 480zM128 496L512.1 496C520.9 496 528 488.9 528 480L528 288.3L373.2 405.7C341.8 429.6 298.3 429.6 266.8 405.7L112 288.3L112 480C112 488.9 119.2 496 128 496zM527.6 228.4L342.7 100.8C329 91.4 311 91.4 297.3 100.8L112.4 228.4L295.8 367.5C310.1 378.3 329.9 378.3 344.2 367.5L527.6 228.4z"/></svg>
                                            </button>
                                          )}
                                        </span>
                                      </div>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    {ignoredItems.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setIgnoredSectionOpen((o) => !o)}
                          onKeyDown={(e) => e.key === 'Enter' && setIgnoredSectionOpen((o) => !o)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.9375rem',
                            color: 'var(--text-faint)',
                            marginBottom: ignoredSectionOpen ? '0.5rem' : 0,
                          }}
                        >
                          <span style={{ minWidth: 16 }}>{ignoredSectionOpen ? '▼' : '▶'}</span>
                          Ignored ({ignoredItems.length})
                        </div>
                        {ignoredSectionOpen && (
                          (() => {
                            const byCompleterIgnored = new Map<string, ChecklistInstance[]>()
                            ignoredItems.forEach((inst) => {
                              const cid = inst.completed_by_user_id ?? 'unknown'
                              if (!byCompleterIgnored.has(cid)) byCompleterIgnored.set(cid, [])
                              byCompleterIgnored.get(cid)!.push(inst)
                            })
                            const getUserNameIgnored = (id: string | null) => {
                              if (!id) return 'Unknown'
                              return completedItemsUserMap.get(id) ?? id.slice(0, 8) + '…'
                            }
                            return (
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {Array.from(byCompleterIgnored.entries()).map(([completerId, items]) => {
                                  const isExpanded = expandedCompleterIds.has(completerId)
                                  const completerName = getUserNameIgnored(completerId === 'unknown' ? null : completerId)
                                  return (
                                    <li key={`ignored-${completerId}`} style={{ marginBottom: '0.5rem' }}>
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setExpandedCompleterIds((prev) => {
                                          const next = new Set(prev)
                                          if (next.has(completerId)) next.delete(completerId)
                                          else next.add(completerId)
                                          return next
                                        })}
                                        onKeyDown={(e) => e.key === 'Enter' && setExpandedCompleterIds((prev) => {
                                          const next = new Set(prev)
                                          if (next.has(completerId)) next.delete(completerId)
                                          else next.add(completerId)
                                          return next
                                        })}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.5rem',
                                          padding: '0.5rem 0.75rem',
                                          border: '1px solid var(--border)',
                                          borderRadius: 8,
                                          cursor: 'pointer',
                                          background: 'var(--bg-subtle)',
                                        }}
                                      >
                                        <span style={{ fontSize: '0.875rem', minWidth: 16 }}>{isExpanded ? '▼' : '▶'}</span>
                                        <span style={{ fontWeight: 500 }}>{completerName}</span>
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>({items.length} item{items.length !== 1 ? 's' : ''})</span>
                                      </div>
                                      {isExpanded && (
                                        <ul style={{ listStyle: 'none', padding: '0.5rem 0 0 1.5rem', margin: 0 }}>
                                          {items.map((inst) => {
                                            const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
                                            const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
                                            const assigneeName = (inst.checklist_instance_assignees ?? [])
                                              .map((a) => getUserNameIgnored(a.user_id))
                                              .filter(Boolean)
                                              .join(', ') || '—'
                                            return (
                                              <li
                                                key={inst.id}
                                                style={{
                                                  display: 'flex',
                                                  flexDirection: isMobile ? 'column' : 'row',
                                                  alignItems: isMobile ? 'stretch' : 'center',
                                                  gap: isMobile ? '0.5rem' : '0.75rem',
                                                  padding: '0.5rem 0.75rem',
                                                  border: '1px solid var(--border)',
                                                  borderRadius: 8,
                                                  marginTop: '0.5rem',
                                                  background: 'var(--surface)',
                                                }}
                                              >
                                                {!isMobile && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); unignoreTaskType(inst.checklist_item_id) }}
                                                    disabled={!!ignoringItemId}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-link)', border: '1px solid #93c5fd', cursor: ignoringItemId ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                                                  >
                                                    Un-ignore
                                                  </button>
                                                )}
                                                <span style={{ width: isMobile ? '100%' : undefined, flex: isMobile ? undefined : 1, fontWeight: 500, minWidth: 0 }}><ChecklistTitleWithLinks title={title} links={links} /></span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                                                  {isMobile ? (
                                                    <span style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                      <span style={{ display: 'block' }}>{inst.completed_at && new Date(inst.completed_at).toLocaleDateString()}</span>
                                                      <span style={{ display: 'block' }}>{inst.completed_at && new Date(inst.completed_at).toLocaleTimeString()}</span>
                                                    </span>
                                                  ) : (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                      {inst.completed_at && new Date(inst.completed_at).toLocaleString()}
                                                    </span>
                                                  )}
                                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→ {assigneeName}</span>
                                                  {isMobile && (
                                                    <button
                                                      type="button"
                                                      onClick={(e) => { e.stopPropagation(); unignoreTaskType(inst.checklist_item_id) }}
                                                      disabled={!!ignoringItemId}
                                                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: 6, background: 'transparent', color: 'var(--text-link)', border: '1px solid #93c5fd', cursor: ignoringItemId ? 'not-allowed' : 'pointer' }}
                                                    >
                                                      Un-ignore
                                                    </button>
                                                  )}
                                                </div>
                                              </li>
                                            )
                                          })}
                                        </ul>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            )
                          })()
                        )}
                      </div>
                    )}
                    </>
                  )
                })()
              )}
            </>
          )}
        </div>
      )}
        </DashboardGroupCard>
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
                  {sendTaskUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={saveFwd}
                disabled={fwdSaving || !fwdTitle.trim() || !fwdAssigneeId}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: fwdSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {fwdSaving ? 'Saving…' : 'Forward'}
              </button>
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
        authUserId={authUserId ?? null}
        onClose={() => setMuteModalItemId(null)}
        onSaved={() => loadTodayChecklist()}
      />
    </>
  )
}
