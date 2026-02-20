import { useState, useEffect, useRef, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { ChecklistItemEditModal } from '../components/ChecklistItemEditModal'

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'
type ChecklistTab = 'today' | 'history' | 'manage' | 'checklists'

type ChecklistInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  assigned_to_user_id: string
  completed_at: string | null
  notes: string | null
  completed_by_user_id: string | null
  created_at: string | null
  checklist_items?: { title: string } | null
}

function tabStyle(active: boolean) {
  return {
    padding: '0.5rem 0.6rem' as const,
    border: 'none' as const,
    background: 'none' as const,
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    color: active ? '#3b82f6' : '#6b7280',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer' as const,
    fontSize: '0.9375rem',
  }
}

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
    if (tab === 'today' || tab === 'history' || tab === 'manage' || tab === 'checklists') {
      setActiveTab(tab)
    } else if (!tab) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'today')
        return next
      }, { replace: true })
    }
  }, [searchParams])

  const canManageChecklists = role === 'dev' || role === 'master_technician' || role === 'assistant'
  const [editItemId, setEditItemId] = useState<string | null>(null)

  if (loading) return <p style={{ padding: '2rem' }}>Loading…</p>

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderBottom: '2px solid #e5e7eb', marginBottom: '2rem', flexWrap: 'wrap' }}>
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
                setActiveTab('manage')
                setSearchParams((p) => {
                  const next = new URLSearchParams(p)
                  next.set('tab', 'manage')
                  return next
                })
              }}
              style={tabStyle(activeTab === 'manage')}
            >
              Review
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('checklists')
                setSearchParams((p) => {
                  const next = new URLSearchParams(p)
                  next.set('tab', 'checklists')
                  return next
                })
              }}
              style={tabStyle(activeTab === 'checklists')}
            >
              Manage
            </button>
          </>
        )}
      </div>

      {activeTab === 'today' && (
        <ChecklistTodayTab authUserId={authUser?.id ?? null} isDev={role === 'dev'} setError={setError} />
      )}
      {activeTab === 'history' && (
        <ChecklistHistoryTab authUserId={authUser?.id ?? null} canViewOthers={canManageChecklists} canEditHistory={role === 'dev'} setError={setError} />
      )}
      {activeTab === 'manage' && canManageChecklists && (
        <ChecklistOutstandingTab authUserId={authUser?.id ?? null} isDev={role === 'dev'} setError={setError} setEditItemId={setEditItemId} />
      )}
      {activeTab === 'checklists' && canManageChecklists && (
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

      {error && <p style={{ color: '#b91c1c', marginTop: '1rem' }}>{error}</p>}
    </div>
  )
}

function ChecklistTodayTab({ authUserId, isDev, setError }: { authUserId: string | null; isDev: boolean; setError: (s: string | null) => void }) {
  const [todayInstances, setTodayInstances] = useState<ChecklistInstance[]>([])
  const [upcomingInstances, setUpcomingInstances] = useState<ChecklistInstance[]>([])
  const [upcomingExpanded, setUpcomingExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [notesByInstance, setNotesByInstance] = useState<Record<string, string>>({})
  const [fwdInstance, setFwdInstance] = useState<ChecklistInstance | null>(null)
  const [fwdTitle, setFwdTitle] = useState('')
  const [fwdAssigneeId, setFwdAssigneeId] = useState('')
  const [fwdSaving, setFwdSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])

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
      supabase.from('users').select('id, name, email').order('name').then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    }
  }, [isDev])

  async function loadToday() {
    if (!authUserId) return
    const today = toLocalDateString(new Date())
    const { data: todayData, error: e1 } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, assigned_to_user_id, completed_at, notes, completed_by_user_id, created_at, checklist_items(title)')
      .eq('assigned_to_user_id', authUserId)
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
        .select('id, checklist_item_id, scheduled_date, assigned_to_user_id, completed_at, notes, completed_by_user_id, created_at, checklist_items(title)')
        .eq('assigned_to_user_id', authUserId)
        .is('completed_at', null)
        .lt('scheduled_date', today)
        .in('checklist_item_id', itemIds)
        .order('scheduled_date', { ascending: true })
      overdueData = (data ?? []) as ChecklistInstance[]
    }
    const merged = [...overdueData, ...(todayData ?? [])]
    merged.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
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
      .select('id, checklist_item_id, scheduled_date, assigned_to_user_id, completed_at, notes, completed_by_user_id, created_at, checklist_items(title)')
      .eq('assigned_to_user_id', authUserId)
      .gt('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(30)
    if (e) return
    setUpcomingInstances((data ?? []) as ChecklistInstance[])
  }

  async function toggleComplete(inst: ChecklistInstance) {
    if (!authUserId || completingId) return
    setCompletingId(inst.id)
    setError(null)
    const isCompleted = !!inst.completed_at
    const notes = notesByInstance[inst.id] ?? inst.notes ?? ''
    const { error: e } = await supabase
      .from('checklist_instances')
      .update({
        completed_at: isCompleted ? null : new Date().toISOString(),
        notes: isCompleted ? null : notes || null,
        completed_by_user_id: isCompleted ? null : authUserId,
      })
      .eq('id', inst.id)
    setCompletingId(null)
    if (e) {
      setError(e.message)
      return
    }
    await loadToday()
    if (!isCompleted) {
      await sendCompletionNotifications(inst)
      await maybeCreateNextInstance(inst)
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
    await supabase.from('checklist_instances').insert({
      checklist_item_id: inst.checklist_item_id,
      scheduled_date: nextDateStr,
      assigned_to_user_id: inst.assigned_to_user_id,
    })
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

  function openFwd(inst: ChecklistInstance) {
    const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
    setFwdInstance(inst)
    setFwdTitle(title)
    setFwdAssigneeId(inst.assigned_to_user_id)
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
          assigned_to_user_id: fwdAssigneeId,
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
      if (newItem?.id) {
        await supabase.from('checklist_instances').insert({
          checklist_item_id: newItem.id,
          scheduled_date: fwdInstance.scheduled_date,
          assigned_to_user_id: fwdAssigneeId,
        })
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
          <p style={{ color: '#6b7280' }}>No checklist items due today.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {todayInstances.map((inst) => {
              const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
              const isCompleted = !!inst.completed_at
              return (
                <li
                  key={inst.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    marginBottom: '0.5rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={() => toggleComplete(inst)}
                    disabled={!!completingId}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{title}</div>
                    <textarea
                      value={notesByInstance[inst.id] ?? inst.notes ?? ''}
                      onChange={(e) => setNotesByInstance((prev) => ({ ...prev, [inst.id]: e.target.value }))}
                      onBlur={() => saveNotes(inst)}
                      placeholder="Notes (optional)"
                      rows={2}
                      style={{ width: '100%', fontSize: '0.875rem', padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                    {inst.completed_at && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        Completed {new Date(inst.completed_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  {isDev && (
                    <button
                      type="button"
                      className="fwd-btn-desktop"
                      onClick={() => openFwd(inst)}
                      style={{
                        flexShrink: 0,
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
              <p style={{ color: '#6b7280', margin: 0 }}>No upcoming items.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {upcomingInstances.map((inst) => {
                  const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
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
                      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{inst.scheduled_date}</span>
                      <span style={{ flex: 1 }}>{title}</span>
                      {isDev && (
                        <button
                          type="button"
                          className="fwd-btn-desktop"
                          onClick={() => openFwd(inst)}
                          style={{
                            flexShrink: 0,
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
              background: 'white',
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
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Assign to</label>
                <select
                  value={fwdAssigneeId}
                  onChange={(e) => setFwdAssigneeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
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
                style={{ padding: '0.5rem 1rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer' }}
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
      supabase.from('users').select('id, name, email').order('name').then(({ data }) => {
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
      .select('id, checklist_item_id, scheduled_date, assigned_to_user_id, completed_at, checklist_items(title)')
      .eq('assigned_to_user_id', selectedUserId)
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

  const byItem = new Map<string, { title: string; dates: Record<string, 'completed' | 'incomplete'> }>()
  for (const inst of instances) {
    const itemId = inst.checklist_item_id
    const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
    if (!byItem.has(itemId)) byItem.set(itemId, { title, dates: {} })
    const entry = byItem.get(itemId)!
    entry.dates[inst.scheduled_date] = inst.completed_at ? 'completed' : 'incomplete'
  }

  const allDates = new Set<string>()
  for (const inst of instances) allDates.add(inst.scheduled_date)
  const sortedDates = Array.from(allDates).sort()

  const instanceByKey = new Map<string, { id: string; checklist_item_id: string; scheduled_date: string; assigned_to_user_id: string }>()
  for (const inst of instances) {
    instanceByKey.set(`${inst.checklist_item_id}-${inst.scheduled_date}`, {
      id: inst.id,
      checklist_item_id: inst.checklist_item_id,
      scheduled_date: inst.scheduled_date,
      assigned_to_user_id: inst.assigned_to_user_id,
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
        const { error: insErr } = await supabase.from('checklist_instances').insert({
          checklist_item_id: itemId,
          scheduled_date: date,
          assigned_to_user_id: selectedUserId,
        })
        if (insErr) {
          setError(insErr.message)
          return
        }
      } else {
        const { error: err } = await supabase.from('checklist_instances').insert({
          checklist_item_id: itemId,
          scheduled_date: date,
          assigned_to_user_id: selectedUserId,
          completed_at: new Date().toISOString(),
        })
        if (err) {
          setError(err.message)
          return
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
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Green = completed, Red = incomplete, White = not due
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Item</th>
              {sortedDates.slice(-60).map((d) => {
                const parts = d.slice(5).split('-')
                const month = parts[0] ?? ''
                const day = parts[1] ?? ''
                return (
                  <th key={d} style={{ padding: '0.15rem', borderBottom: '1px solid #e5e7eb', minWidth: 12, maxWidth: 12, fontSize: '0.625rem', lineHeight: 1.1 }} title={d}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}><span>{month}</span><span>{day}</span></div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from(byItem.entries()).map(([itemId, { title, dates }]) => (
              <tr key={itemId}>
                <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={title}>
                  {title}
                </td>
                {sortedDates.slice(-60).map((d) => {
                  const rawStatus = dates[d]
                  const status = deletedCells.has(`${itemId}-${d}`) ? undefined : rawStatus
                  const bg = status === 'completed' ? '#22c55e' : status === 'incomplete' ? '#ef4444' : '#f9fafb'
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
      {byItem.size === 0 && <p style={{ color: '#6b7280' }}>No checklist history in this range.</p>}
    </div>
  )
}

type OutstandingInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  assigned_to_user_id: string
  checklist_items?: { title: string; repeat_type?: string; reminder_scope?: string | null } | null
  users?: { name: string; email: string } | null
}

function ChecklistOutstandingTab({ authUserId, isDev, setError, setEditItemId }: { authUserId: string | null; isDev: boolean; setError: (s: string | null) => void; setEditItemId: (id: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [byUser, setByUser] = useState<Array<{ userId: string; name: string; count: number; instances: OutstandingInstance[] }>>([])
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'next_day' | 'next_week' | 'non_repeating' | 'missed'>('next_day')
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null)
  const [fwdInstance, setFwdInstance] = useState<OutstandingInstance | null>(null)
  const [fwdTitle, setFwdTitle] = useState('')
  const [fwdAssigneeId, setFwdAssigneeId] = useState('')
  const [fwdSaving, setFwdSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [deletingInstanceId, setDeletingInstanceId] = useState<string | null>(null)

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
      supabase.from('users').select('id, name, email').order('name').then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    }
  }, [isDev])

  function openFwd(inst: OutstandingInstance) {
    const title = inst.checklist_items?.title ?? 'Untitled'
    setFwdInstance(inst)
    setFwdTitle(title)
    setFwdAssigneeId(inst.assigned_to_user_id)
  }

  async function deleteInstance(inst: OutstandingInstance) {
    if (!confirm(`Delete this outstanding task: ${inst.checklist_items?.title ?? '—'} (${inst.scheduled_date})?`)) return
    setDeletingInstanceId(inst.id)
    setError(null)
    try {
      const { error: err } = await supabase.from('checklist_instances').delete().eq('id', inst.id)
      if (err) throw err
      await loadOutstanding()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingInstanceId(null)
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
          assigned_to_user_id: fwdAssigneeId,
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
      if (newItem?.id) {
        await supabase.from('checklist_instances').insert({
          checklist_item_id: newItem.id,
          scheduled_date: fwdInstance.scheduled_date,
          assigned_to_user_id: fwdAssigneeId,
        })
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

  async function loadOutstanding() {
    setLoading(true)
    setError(null)
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
    const weekEnd = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)

    let query = supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, assigned_to_user_id, checklist_items(title, repeat_type, reminder_scope), users!checklist_instances_assigned_to_user_id_fkey(name, email)')
      .is('completed_at', null)
      .order('scheduled_date', { ascending: true })

    if (dateRange === 'missed') {
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10) // more than 1 day old = scheduled before yesterday
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
    let instances = (data ?? []) as OutstandingInstance[]
    if (dateRange === 'non_repeating') {
      instances = instances.filter((inst) => (inst.checklist_items as { repeat_type?: string } | null)?.repeat_type === 'once')
    }
    if (dateRange === 'missed') {
      instances = instances.filter((inst) => (inst.checklist_items as { reminder_scope?: string | null } | null)?.reminder_scope !== 'today_and_overdue')
    }
    const map = new Map<string, OutstandingInstance[]>()
    for (const inst of instances) {
      const list = map.get(inst.assigned_to_user_id) ?? []
      list.push(inst)
      map.set(inst.assigned_to_user_id, list)
    }
    const rows = Array.from(map.entries()).map(([userId, list]) => {
      const first = list[0]
      const name = first
        ? ((first.users as { name?: string; email?: string } | null)?.name || (first.users as { email?: string } | null)?.email || 'Unknown')
        : 'Unknown'
      return { userId, name, count: list.length, instances: list }
    })
    rows.sort((a, b) => b.count - a.count)
    setByUser(rows)
    setLoading(false)
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Outstanding by person</h3>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={() => setDateRange('non_repeating')}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.875rem',
              border: '1px solid #e5e7eb',
              borderRadius: '0.25rem',
              background: dateRange === 'non_repeating' ? '#e5e7eb' : 'transparent',
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
              border: '1px solid #e5e7eb',
              borderRadius: '0.25rem',
              background: dateRange === 'next_day' ? '#e5e7eb' : 'transparent',
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
              border: '1px solid #e5e7eb',
              borderRadius: '0.25rem',
              background: dateRange === 'next_week' ? '#e5e7eb' : 'transparent',
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
              border: '1px solid #e5e7eb',
              borderRadius: '0.25rem',
              background: dateRange === 'missed' ? '#e5e7eb' : 'transparent',
              cursor: 'pointer',
            }}
          >
            Missed
          </button>
        </div>
      </div>
      {byUser.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No outstanding checklist items.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
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
                  <td style={{ padding: '0.5rem 0.75rem' }}>{name}</td>
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
                        border: '1px solid #e5e7eb',
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
                    <td colSpan={4} style={{ padding: '0 0.75rem 0.75rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <ul style={{ margin: 0, paddingLeft: '1.5rem', listStyle: 'disc' }}>
                        {instances.map((inst) => (
                          <li key={inst.id} style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ flex: 1 }}>
                              {inst.checklist_items?.title ?? '—'} <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>({inst.scheduled_date})</span>
                            </span>
                            {isDev && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setEditItemId(inst.checklist_item_id) }}
                                  title="Edit"
                                  style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                    <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); deleteInstance(inst) }}
                                  disabled={deletingInstanceId === inst.id}
                                  title="Delete"
                                  style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: deletingInstanceId === inst.id ? 'not-allowed' : 'pointer', color: '#b91c1c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                    <path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="fwd-btn-desktop"
                                  onClick={(e) => { e.stopPropagation(); openFwd(inst) }}
                                  style={{
                                    flexShrink: 0,
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
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
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
              background: 'white',
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
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Assign to</label>
                <select
                  value={fwdAssigneeId}
                  onChange={(e) => setFwdAssigneeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
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
                style={{ padding: '0.5rem 1rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer' }}
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
  assigned_to_user_id: string
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
  users?: { name: string; email: string } | null
}

function ChecklistManageTab({ authUserId, role, setError, setEditItemId }: { authUserId: string | null; role: UserRole | null; setError: (s: string | null) => void; setEditItemId: (id: string) => void }) {
  const checklistAddModal = useChecklistAddModal()
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [loading, setLoading] = useState(true)
  const [filterUserId, setFilterUserId] = useState<string>('')

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
    const { data } = await supabase.from('users').select('id, name, email').order('name')
    setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
  }

  async function loadItems() {
    let q = supabase
      .from('checklist_items')
      .select('id, title, assigned_to_user_id, created_by_user_id, repeat_type, repeat_days_of_week, repeat_days_after, repeat_end_date, start_date, show_until_completed, notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope, created_at, updated_at, users!checklist_items_assigned_to_user_id_fkey(name, email)')
      .order('start_date', { ascending: false })
    if (filterUserId) q = q.eq('assigned_to_user_id', filterUserId)
    const { data, error } = await q
    if (error) {
      setError(error.message)
      return
    }
    setItems((data ?? []) as ChecklistItem[])
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this checklist item? Instances will also be removed.')) return
    const { error } = await supabase.from('checklist_items').delete().eq('id', id)
    if (error) setError(error.message)
    else await loadItems()
  }

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  if (loading) return <p>Loading…</p>

  return (
    <div>
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
          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Title</th>
            <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Assigned to</th>
            <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Repeat</th>
            <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Start</th>
            <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Notify</th>
            {role === 'dev' && <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Remind</th>}
            <th style={{ padding: '0.5rem 0.75rem' }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '0.5rem 0.75rem' }}>{item.title}</td>
              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{(item.users as { name: string; email: string } | null)?.name || (item.users as { email: string } | null)?.email || '—'}</td>
              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
                {item.show_until_completed
                  ? 'Until completed'
                  : item.repeat_type === 'day_of_week'
                    ? `Weekly: ${(item.repeat_days_of_week ?? []).length ? (item.repeat_days_of_week ?? []).map((d) => DAYS[d]?.slice(0, 3) ?? '').filter(Boolean).join(', ') : '—'}`
                    : item.repeat_type === 'days_after_completion'
                      ? `${item.repeat_days_after} days after completion`
                      : 'Once'}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                {(() => {
                  const d = new Date(item.start_date + 'T12:00:00')
                  const oneYearAgo = new Date()
                  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
                  return d >= oneYearAgo
                    ? `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    : String(d.getFullYear())
                })()}
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
              <td style={{ padding: '0.5rem 0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setEditItemId(item.id)}
                  title="Edit"
                  style={{ marginRight: '0.5rem', padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M128.1 64C92.8 64 64.1 92.7 64.1 128L64.1 512C64.1 547.3 92.8 576 128.1 576L274.3 576L285.2 521.5C289.5 499.8 300.2 479.9 315.8 464.3L448 332.1L448 234.6C448 217.6 441.3 201.3 429.3 189.3L322.8 82.7C310.8 70.7 294.5 64 277.6 64L128.1 64zM389.6 240L296.1 240C282.8 240 272.1 229.3 272.1 216L272.1 122.5L389.6 240zM332.3 530.9L320.4 590.5C320.2 591.4 320.1 592.4 320.1 593.4C320.1 601.4 326.6 608 334.7 608C335.7 608 336.6 607.9 337.6 607.7L397.2 595.8C409.6 593.3 421 587.2 429.9 578.3L548.8 459.4L468.8 379.4L349.9 498.3C341 507.2 334.9 518.6 332.4 531zM600.1 407.9C622.2 385.8 622.2 350 600.1 327.9C578 305.8 542.2 305.8 520.1 327.9L491.3 356.7L571.3 436.7L600.1 407.9z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => deleteItem(item.id)}
                  title="Delete"
                  style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p style={{ color: '#6b7280' }}>No checklist items yet.</p>}
    </div>
  )
}
