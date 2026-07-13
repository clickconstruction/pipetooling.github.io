import { useState, useEffect, useRef, useCallback, useMemo, Fragment, type CSSProperties, type PointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { ChecklistItemEditModal } from '../components/ChecklistItemEditModal'
import ChecklistItemMuteModal from '../components/ChecklistItemMuteModal'
import { ChecklistTitleWithLinks } from '../components/ChecklistTitleWithLinks'
import { compactTimeAgo } from '../lib/subcontractorLastActivityCompact'
import { getNextDisplayOrders } from '../utils/checklistOrder'
import { withSupabaseRetry } from '../utils/errorHandling'
import { ChecklistReviewInboxes } from '../components/checklist/ChecklistReviewInboxes'
import { ChecklistTechTreeTab } from '../components/checklist/ChecklistTechTreeTab'

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
  checklist_items?: {
    title: string
    links?: string[] | null
    notify_on_complete_user_id?: string | null
    notify_creator_on_complete?: boolean
    created_by_user_id?: string | null
  } | null
}

const tabStyle = (active: boolean) => ({
  padding: '0.75rem 1.5rem',
  border: 'none' as const,
  background: 'none' as const,
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? 'var(--text-blue-500)' : 'var(--text-muted)',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
})

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

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'today' || tab === 'history' || tab === 'roadmap' || tab === 'review' || tab === 'manage') {
      setActiveTab(tab)
    } else if (!tab && role !== null) {
      const defaultTab =
        role === 'dev' || role === 'master_technician' || role === 'assistant' ? 'review' : 'today'
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', defaultTab)
        return next
      }, { replace: true })
    }
  }, [searchParams, role])

  const canManageChecklists = role === 'dev' || role === 'master_technician' || role === 'assistant'
  /** Matches is_dev_or_master_or_assistant() in DB (includes primary) for roadmap structure + staff overrides */
  const canEditTechTree =
    role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary'
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
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
              style={tabStyle(activeTab === 'manage')}
            >
              Manage
            </button>
          </>
        )}
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
          style={tabStyle(activeTab === 'roadmap')}
        >
          Roadmap
        </button>
        <h1 style={{ margin: 0, marginLeft: 'auto', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-strong)' }}>Checklist</h1>
      </div>

      {activeTab === 'today' && (
        <ChecklistTodayTab authUserId={authUser?.id ?? null} isDev={role === 'dev'} setError={setError} />
      )}
      {activeTab === 'history' && (
        <ChecklistHistoryTab authUserId={authUser?.id ?? null} canViewOthers={canManageChecklists} canEditHistory={role === 'dev'} setError={setError} />
      )}
      {activeTab === 'roadmap' && (
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
          />
        </div>
      )}
      {activeTab === 'review' && canManageChecklists && (
        <ChecklistOutstandingTab authUserId={authUser?.id ?? null} isDev={role === 'dev'} canManageChecklists={canManageChecklists} setError={setError} setEditItemId={setEditItemId} />
      )}
      {activeTab === 'manage' && canManageChecklists && (
        <ChecklistManageTab authUserId={authUser?.id ?? null} role={role} setError={setError} setEditItemId={setEditItemId} />
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
  const [notesByInstance, setNotesByInstance] = useState<Record<string, string>>({})
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
      .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id), checklist_instance_assignees!inner(user_id)')
      .eq('checklist_instance_assignees.user_id', authUserId)
      .eq('scheduled_date', today)
      .order('created_at', { ascending: true })
    if (e1) {
      setError(e1.message)
      return
    }
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
    const merged = [...overdueData, ...(todayData ?? [])] as ChecklistInstance[]
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
    setNotesByInstance((prev) => {
      const next = { ...prev }
      merged.forEach((r: ChecklistInstance) => {
        if (r.notes != null) next[r.id] = r.notes
      })
      return next
    })
  }

  async function loadUpcoming() {
    if (!authUserId) return
    const today = toLocalDateString(new Date())
    const { data, error: e } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id), checklist_instance_assignees!inner(user_id)')
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
    const notes = notesByInstance[inst.id] ?? inst.notes ?? ''
    const nextCompletedAt = isCompleted ? null : new Date().toISOString()
    const nextNotes = isCompleted ? null : notes || null
    const nextCompletedBy = isCompleted ? null : authUserId
    const previous = inst

    setTodayInstances((prev) =>
      prev.map((row) =>
        row.id === inst.id
          ? {
              ...row,
              completed_at: nextCompletedAt,
              notes: nextNotes,
              completed_by_user_id: nextCompletedBy,
            }
          : row,
      ),
    )
    if (isCompleted) {
      setNotesByInstance((prev) => {
        const next = { ...prev }
        delete next[inst.id]
        return next
      })
    }

    try {
      const { error: e } = await supabase
        .from('checklist_instances')
        .update({
          completed_at: nextCompletedAt,
          notes: nextNotes,
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
      setNotesByInstance((prev) => {
        const next = { ...prev }
        if (previous.notes != null && previous.notes !== '') next[inst.id] = previous.notes
        else delete next[inst.id]
        return next
      })
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

  async function saveNotes(inst: ChecklistInstance) {
    if (!authUserId) return
    const notes = notesByInstance[inst.id] ?? ''
    await supabase
      .from('checklist_instances')
      .update({ notes: notes || null })
      .eq('id', inst.id)
    await loadToday()
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
              const isCompleted = !!inst.completed_at
              return (
                <li
                  key={inst.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    marginBottom: '0.5rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={() => void toggleComplete(inst)}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}><ChecklistTitleWithLinks title={title} links={links} /></div>
                    <textarea
                      value={notesByInstance[inst.id] ?? inst.notes ?? ''}
                      onChange={(e) => setNotesByInstance((prev) => ({ ...prev, [inst.id]: e.target.value }))}
                      onBlur={() => saveNotes(inst)}
                      placeholder="Notes (optional)"
                      rows={2}
                      style={{ width: '100%', fontSize: '0.875rem', padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    />
                    {inst.completed_at && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Completed {new Date(inst.completed_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'flex-start' }}>
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
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

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
                        borderBottom: '1px solid #f3f4f6',
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
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [monthsBack, setMonthsBack] = useState(6)
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
      .select('id, checklist_item_id, scheduled_date, completed_at, completed_by_user_id, notes, created_at, checklist_items(title, links), checklist_instance_assignees!inner(user_id)')
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

  const byItem = new Map<string, { title: string; links?: string[] | null; dates: Record<string, 'completed' | 'completed_by_other' | 'incomplete'> }>()
  for (const inst of instances) {
    const itemId = inst.checklist_item_id
    const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
    const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
    if (!byItem.has(itemId)) byItem.set(itemId, { title, links, dates: {} })
    const entry = byItem.get(itemId)!
    let status: 'completed' | 'completed_by_other' | 'incomplete' = 'incomplete'
    if (inst.completed_at) {
      status = inst.completed_by_user_id && inst.completed_by_user_id !== selectedUserId ? 'completed_by_other' : 'completed'
    }
    entry.dates[inst.scheduled_date] = status
  }

  const allDates = new Set<string>()
  for (const inst of instances) allDates.add(inst.scheduled_date)
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
    const key = `${itemId}-${date}`
    const rawStatus = byItem.get(itemId)?.dates[date]
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
            {[3, 6, 12].map((n) => (
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
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Green = completed by you, Yellow = completed by someone else, Red = incomplete, White = not due
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Item</th>
              {sortedDates.slice(-60).map((d) => {
                const parts = d.slice(5).split('-')
                const month = parts[0] ?? ''
                const day = parts[1] ?? ''
                return (
                  <th key={d} style={{ padding: '0.15rem', borderBottom: '1px solid var(--border)', minWidth: 12, maxWidth: 12, fontSize: '0.625rem', lineHeight: 1.1 }} title={d}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}><span>{month}</span><span>{day}</span></div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from(byItem.entries()).map(([itemId, { title, links, dates }]) => (
              <tr key={itemId}>
                <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={title}>
                  <ChecklistTitleWithLinks title={title} links={links} />
                </td>
                {sortedDates.slice(-60).map((d) => {
                  const rawStatus = dates[d]
                  const status = deletedCells.has(`${itemId}-${d}`) ? undefined : rawStatus
                  const bg = status === 'completed' ? '#22c55e' : status === 'completed_by_other' ? '#eab308' : status === 'incomplete' ? '#ef4444' : '#f9fafb'
                  const cellKey = `${itemId}-${d}`
                  const isCycling = cyclingCell === cellKey
                  const isClickable = editMode && !isCycling
                  return (
                    <td key={d} style={{ padding: 2, borderBottom: '1px solid #f3f4f6' }}>
                      <div
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        onClick={isClickable ? () => handleCycleStatus(itemId, d) : undefined}
                        onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCycleStatus(itemId, d) } } : undefined}
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 2,
                          backgroundColor: isCycling ? '#d1d5db' : bg,
                          cursor: isClickable ? 'pointer' : undefined,
                          opacity: isCycling ? 0.7 : 1,
                        }}
                        title={`${d}: ${status || 'not due'}${editMode ? ' (click to cycle)' : ''}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {byItem.size === 0 && <p style={{ color: 'var(--text-muted)' }}>No checklist history in this range.</p>}
    </div>
  )
}

type OutstandingInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  checklist_items?: { title?: string; links?: string[] | null; repeat_type?: string; reminder_scope?: string | null } | null
}

function OutstandingByPersonSortableRow({
  inst,
  userId,
  dragDisabled,
  canManageChecklists,
  isDev,
  completingInstanceId,
  deletingInstanceId,
  onMarkComplete,
  onDeleteInstance,
  onOpenFwd,
  setEditItemId,
}: {
  inst: OutstandingInstance
  userId: string
  dragDisabled: boolean
  canManageChecklists: boolean
  isDev: boolean
  completingInstanceId: string | null
  deletingInstanceId: string | null
  onMarkComplete: (inst: OutstandingInstance) => void
  onDeleteInstance: (inst: OutstandingInstance) => void
  onOpenFwd: (inst: OutstandingInstance, rowUserId: string) => void
  setEditItemId: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: inst.id })
  const { onPointerDown: sortablePointerDown, ...restSortableListeners } = (listeners ?? {}) as {
    onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void
  } & Record<string, unknown>
  const style: CSSProperties = {
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.125rem',
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    position: 'relative',
    zIndex: isDragging ? 2 : undefined,
  }
  return (
    <li ref={setNodeRef} style={style}>
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
          aria-label={`Drag to reorder: ${inst.checklist_items?.title ?? 'Task'}`}
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setEditItemId(inst.checklist_item_id)
            }}
            title="Edit"
            style={{
              padding: '0.25rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-700)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteInstance(inst)
            }}
            disabled={deletingInstanceId === inst.id}
            title="Delete"
            style={{
              padding: '0.25rem',
              background: 'none',
              border: 'none',
              cursor: deletingInstanceId === inst.id ? 'not-allowed' : 'pointer',
              color: 'var(--text-red-700)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
            </svg>
          </button>
          <button
            type="button"
            className="fwd-btn-desktop"
            onClick={(e) => {
              e.stopPropagation()
              onOpenFwd(inst, userId)
            }}
            title="Forward"
            aria-label="Forward"
            style={{
              flexShrink: 0,
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
        </span>
      )}
      <span style={{ flex: 1 }}>
        <ChecklistTitleWithLinks title={inst.checklist_items?.title ?? '—'} links={inst.checklist_items?.links} />{' '}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>({inst.scheduled_date})</span>
      </span>
    </li>
  )
}

function OutstandingByPersonSortableList({
  userId,
  instances,
  reorderingUserId,
  canManageChecklists,
  isDev,
  onDragEnd,
  completingInstanceId,
  deletingInstanceId,
  onMarkComplete,
  onDeleteInstance,
  onOpenFwd,
  setEditItemId,
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
  setEditItemId: (id: string) => void
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
        <ul style={{ margin: 0, paddingLeft: '1.5rem', listStyle: 'disc' }}>
          {instances.map((inst) => (
            <OutstandingByPersonSortableRow
              key={inst.id}
              inst={inst}
              userId={userId}
              dragDisabled={dragDisabled}
              canManageChecklists={canManageChecklists}
              isDev={isDev}
              completingInstanceId={completingInstanceId}
              deletingInstanceId={deletingInstanceId}
              onMarkComplete={onMarkComplete}
              onDeleteInstance={onDeleteInstance}
              onOpenFwd={onOpenFwd}
              setEditItemId={setEditItemId}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function ChecklistOutstandingTab({ authUserId, isDev, canManageChecklists, setError, setEditItemId }: { authUserId: string | null; isDev: boolean; canManageChecklists: boolean; setError: (s: string | null) => void; setEditItemId: (id: string) => void }) {
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

  const fwdMissingFields: string[] = []
  if (!fwdTitle.trim()) fwdMissingFields.push('Title')
  if (!fwdAssigneeId) fwdMissingFields.push('Assignee')
  const fwdCanSubmit = fwdMissingFields.length === 0

  useEffect(() => {
    loadOutstanding()
  }, [dateRange])

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
    const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('en-CA')
    const weekEnd = new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-CA')

    let query = supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, checklist_items(title, links, repeat_type, reminder_scope), checklist_instance_assignees(user_id, users(name, email))')
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
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Outstanding by person</h3>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              type="button"
              onClick={() => setDateRange('non_repeating')}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border)',
                borderRadius: '0.25rem',
                background: dateRange === 'non_repeating' ? 'var(--bg-200)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              Non repeating
            </button>
            <button
              type="button"
              onClick={() => setDateRange('next_day')}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border)',
                borderRadius: '0.25rem',
                background: dateRange === 'next_day' ? 'var(--bg-200)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              Next day
            </button>
            <button
              type="button"
              onClick={() => setDateRange('next_week')}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border)',
                borderRadius: '0.25rem',
                background: dateRange === 'next_week' ? 'var(--bg-200)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              Next week
            </button>
            <button
              type="button"
              onClick={() => setDateRange('missed')}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border)',
                borderRadius: '0.25rem',
                background: dateRange === 'missed' ? 'var(--bg-200)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              Missed
            </button>
          </div>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : byUser.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No outstanding checklist items.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Name</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Outstanding</th>
                <th style={{ padding: '0.5rem 0.75rem', width: 40 }}></th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Remind</th>
              </tr>
            </thead>
            <tbody>
              {byUser.map(({ userId, name, count, instances }) => (
                <Fragment key={userId}>
                  <tr
                    key={userId}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onClick={() => setExpandedUserId((prev) => (prev === userId ? null : userId))}
                  >
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        {name}
                        {expandedUserId === userId && isDev && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); checklistAddModal?.openAddModal(userId) }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.8125rem',
                              border: '1px solid #3b82f6',
                              borderRadius: 4,
                              background: '#3b82f6',
                              color: 'white',
                              cursor: 'pointer',
                            }}
                          >
                            Add task
                          </button>
                        )}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>{count}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {expandedUserId === userId ? '▼' : '▶'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={remindingUserId === userId}
                        onClick={() => sendReminder(userId, instances)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.875rem',
                          border: '1px solid var(--border)',
                          borderRadius: '0.25rem',
                          background: 'transparent',
                          cursor: remindingUserId === userId ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {remindingUserId === userId ? 'Sending…' : 'Remind'}
                      </button>
                    </td>
                  </tr>
                  {expandedUserId === userId && (
                    <tr key={`${userId}-detail`}>
                      <td colSpan={4} style={{ padding: '0 0.75rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                        <OutstandingByPersonSortableList
                          userId={userId}
                          instances={instances}
                          reorderingUserId={reorderingUserId}
                          canManageChecklists={canManageChecklists}
                          isDev={isDev}
                          onDragEnd={onOutstandingDragEnd(userId, instances)}
                          completingInstanceId={completingInstanceId}
                          deletingInstanceId={deletingInstanceId}
                          onMarkComplete={markComplete}
                          onDeleteInstance={openOutstandingDeleteModal}
                          onOpenFwd={openFwd}
                          setEditItemId={setEditItemId}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ChecklistReviewInboxes />
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
  checklist_item_assignees?: Array<{ user_id: string; users?: { name?: string; email?: string } | null }>
}

function ChecklistManageTab({ authUserId, role, setError, setEditItemId }: { authUserId: string | null; role: UserRole | null; setError: (s: string | null) => void; setEditItemId: (id: string) => void }) {
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
  const [completedOpen, setCompletedOpen] = useState(false)

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
    const baseSelect = 'id, title, links, created_by_user_id, repeat_type, repeat_days_of_week, repeat_days_after, repeat_end_date, start_date, show_until_completed, notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope, created_at, updated_at'
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
      .select('checklist_item_id, completed_at')
      .in('checklist_item_id', ids)
    const completion = new Map<string, { total: number; hasIncomplete: boolean }>()
    for (const inst of (instData ?? []) as Array<{ checklist_item_id: string; completed_at: string | null }>) {
      const cur = completion.get(inst.checklist_item_id) ?? { total: 0, hasIncomplete: false }
      cur.total += 1
      if (!inst.completed_at) cur.hasIncomplete = true
      completion.set(inst.checklist_item_id, cur)
    }
    setItemCompletion(completion)
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

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

  const colCount = 7 + (role === 'dev' ? 1 : 0)

  type ManageRowEntry =
    | { kind: 'header'; key: string; title: string; count: number; collapsible: boolean; color: string }
    | { kind: 'none'; key: string }
    | { kind: 'item'; item: ChecklistItem }

  const orderedEntries: ManageRowEntry[] = []
  if (filteredItems.length > 0) {
    orderedEntries.push({ kind: 'header', key: 'sec-incomplete', title: 'Incomplete', count: incompleteItems.length, collapsible: false, color: 'var(--text-amber-700)' })
    if (incompleteItems.length === 0) orderedEntries.push({ kind: 'none', key: 'none-incomplete' })
    else for (const item of incompleteItems) orderedEntries.push({ kind: 'item', item })

    orderedEntries.push({ kind: 'header', key: 'sec-repeating', title: 'Repeating', count: repeatingItems.length, collapsible: false, color: 'var(--text-blue-700)' })
    if (repeatingItems.length === 0) orderedEntries.push({ kind: 'none', key: 'none-repeating' })
    else for (const item of repeatingItems) orderedEntries.push({ kind: 'item', item })

    orderedEntries.push({ kind: 'header', key: 'sec-complete', title: 'Complete', count: completeItems.length, collapsible: true, color: '#15803d' })
    if (completedOpen) {
      if (completeItems.length === 0) orderedEntries.push({ kind: 'none', key: 'none-complete' })
      else for (const item of completeItems) orderedEntries.push({ kind: 'item', item })
    }
  }

  const renderSectionHeaderRow = (entry: { key: string; title: string; count: number; collapsible: boolean; color: string }) => {
    const label = (
      <>
        {entry.collapsible && <span aria-hidden style={{ marginRight: 6 }}>{completedOpen ? '▼' : '▶'}</span>}
        {entry.title} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>({entry.count})</span>
      </>
    )
    const cellStyle = {
      padding: '0.5rem 0.75rem',
      background: 'var(--bg-subtle)',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      fontWeight: 700,
      fontSize: '0.8125rem',
      color: entry.color,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.03em',
    }
    return (
      <tr key={entry.key}>
        <td colSpan={colCount} style={cellStyle}>
          {entry.collapsible ? (
            <button
              type="button"
              onClick={() => setCompletedOpen((o) => !o)}
              aria-expanded={completedOpen}
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', textTransform: 'inherit', letterSpacing: 'inherit' }}
            >
              {label}
            </button>
          ) : (
            label
          )}
        </td>
      </tr>
    )
  }

  const renderNoneRow = (key: string) => (
    <tr key={key}>
      <td colSpan={colCount} style={{ padding: '0.5rem 0.75rem', color: 'var(--text-faint)', fontSize: '0.875rem' }}>None</td>
    </tr>
  )

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <div style={{ width: '100%', marginBottom: '1rem' }}>
        <input
          id="checklist-manage-search"
          type="search"
          placeholder="Search by title or assignee"
          value={manageSearchQuery}
          onChange={(e) => setManageSearchQuery(e.target.value)}
          aria-label="Search by title or assignee"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            fontSize: '1rem',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => checklistAddModal?.openAddModal()} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Add checklist item
        </button>
        <label>
          <span style={{ marginRight: '0.5rem' }}>Filter by assignee:</span>
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            style={{ padding: '0.35rem 0.5rem' }}
          >
            <option value="">All</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        </label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', width: '1%' }}></th>
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Title</th>
            <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Assigned to</th>
            <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Repeat</th>
            <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Start</th>
            <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Created</th>
            <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Notify</th>
            {role === 'dev' && <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Remind</th>}
          </tr>
        </thead>
        <tbody>
          {orderedEntries.map((entry) => {
            if (entry.kind === 'header') return renderSectionHeaderRow(entry)
            if (entry.kind === 'none') return renderNoneRow(entry.key)
            const item = entry.item
            return (
            <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td
                style={{
                  padding: '0.5rem 0.75rem',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  width: '1%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '0.25rem',
                    flexWrap: 'nowrap',
                  }}
                >
                  {isNotificationRecipient(item) && (
                    <button
                      type="button"
                      onClick={() => { setMuteModalItemId(item.id); setMuteModalTitle(item.title) }}
                      title="Mute notifications for this task"
                      aria-label="Mute notifications for this task"
                      style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}
                    >
                      🔕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditItemId(item.id)}
                    title="Edit"
                    style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManageDeletePending({ id: item.id, title: item.title?.trim() || 'Untitled' })}
                    title="Delete"
                    style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-red-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
                    </svg>
                  </button>
                </div>
              </td>
              <td style={{ padding: '0.5rem 0.75rem' }}><ChecklistTitleWithLinks title={item.title} links={item.links} /></td>
              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                {(item.checklist_item_assignees ?? []).map((a) => a.users?.name || a.users?.email || 'Unknown').filter(Boolean).join(', ') || '—'}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
                {item.show_until_completed
                  ? 'Until completed'
                  : item.repeat_type === 'day_of_week'
                    ? `Weekly: ${(item.repeat_days_of_week ?? []).length ? (item.repeat_days_of_week ?? []).map((d) => DAYS[d]?.slice(0, 3) ?? '').filter(Boolean).join(', ') : '—'}`
                    : item.repeat_type === 'days_after_completion'
                      ? `${item.repeat_days_after} days after completion`
                      : 'Once'}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {(() => {
                  const d = new Date(item.start_date + 'T12:00:00')
                  const oneYearAgo = new Date()
                  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
                  return d >= oneYearAgo
                    ? `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    : String(d.getFullYear())
                })()}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {item.created_at ? compactTimeAgo(item.created_at) : '—'}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
                {item.notify_creator_on_complete && 'Creator '}
                {item.notify_on_complete_user_id && '+1 user'}
              </td>
              {role === 'dev' && (
                <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
                  {item.reminder_time
                    ? `${item.reminder_time.slice(0, 5)} (${item.reminder_scope === 'today_and_overdue' ? 'due date + daily until done' : 'due date'})`
                    : '—'}
                </td>
              )}
            </tr>
            )
          })}
        </tbody>
      </table>
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
