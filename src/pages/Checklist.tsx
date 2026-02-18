import { useState, useEffect, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

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
  const [openAddFormOnMount, setOpenAddFormOnMount] = useState(false)

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
    if (searchParams.get('add') === 'true' && (role === 'dev' || role === 'master_technician' || role === 'assistant')) {
      setActiveTab('checklists')
      setOpenAddFormOnMount(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, role, setSearchParams])

  const canManageChecklists = role === 'dev' || role === 'master_technician' || role === 'assistant'

  if (loading) return <p style={{ padding: '2rem' }}>Loading…</p>

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderBottom: '2px solid #e5e7eb', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setActiveTab('today')} style={tabStyle(activeTab === 'today')}>
          Today
        </button>
        <button type="button" onClick={() => setActiveTab('history')} style={tabStyle(activeTab === 'history')}>
          History
        </button>
        {canManageChecklists && (
          <>
            <button type="button" onClick={() => setActiveTab('manage')} style={tabStyle(activeTab === 'manage')}>
              Review
            </button>
            <button type="button" onClick={() => setActiveTab('checklists')} style={tabStyle(activeTab === 'checklists')}>
              Manage
            </button>
          </>
        )}
      </div>

      {activeTab === 'today' && (
        <ChecklistTodayTab authUserId={authUser?.id ?? null} setError={setError} />
      )}
      {activeTab === 'history' && (
        <ChecklistHistoryTab authUserId={authUser?.id ?? null} canViewOthers={canManageChecklists} canEditHistory={role === 'dev'} setError={setError} />
      )}
      {activeTab === 'manage' && canManageChecklists && (
        <ChecklistOutstandingTab setError={setError} />
      )}
      {activeTab === 'checklists' && canManageChecklists && (
        <ChecklistManageTab authUserId={authUser?.id ?? null} role={role} setError={setError} openAddOnMount={openAddFormOnMount} onAddOpened={() => setOpenAddFormOnMount(false)} />
      )}

      {error && <p style={{ color: '#b91c1c', marginTop: '1rem' }}>{error}</p>}
    </div>
  )
}

function ChecklistTodayTab({ authUserId, setError }: { authUserId: string | null; setError: (s: string | null) => void }) {
  const [todayInstances, setTodayInstances] = useState<ChecklistInstance[]>([])
  const [upcomingInstances, setUpcomingInstances] = useState<ChecklistInstance[]>([])
  const [upcomingExpanded, setUpcomingExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [notesByInstance, setNotesByInstance] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!authUserId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([loadToday(), loadUpcoming()]).finally(() => setLoading(false))
  }, [authUserId])

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
                  <div style={{ flex: 1 }}>
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
                      }}
                    >
                      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{inst.scheduled_date}</span>
                      <span>{title}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </section>
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
  scheduled_date: string
  assigned_to_user_id: string
  checklist_items?: { title: string; repeat_type?: string } | null
  users?: { name: string; email: string } | null
}

function ChecklistOutstandingTab({ setError }: { setError: (s: string | null) => void }) {
  const [loading, setLoading] = useState(true)
  const [byUser, setByUser] = useState<Array<{ userId: string; name: string; count: number; instances: OutstandingInstance[] }>>([])
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'next_day' | 'next_week' | 'non_repeating'>('next_day')
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null)

  useEffect(() => {
    loadOutstanding()
  }, [dateRange])

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
      .select('id, scheduled_date, assigned_to_user_id, checklist_items(title, repeat_type), users!checklist_instances_assigned_to_user_id_fkey(name, email)')
      .is('completed_at', null)
      .order('scheduled_date', { ascending: true })

    if (dateRange !== 'non_repeating') {
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
                          <li key={inst.id} style={{ marginBottom: '0.25rem' }}>
                            {inst.checklist_items?.title ?? '—'} <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>({inst.scheduled_date})</span>
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

function ChecklistManageTab({ authUserId, role, setError, openAddOnMount, onAddOpened }: { authUserId: string | null; role: UserRole | null; setError: (s: string | null) => void; openAddOnMount?: boolean; onAddOpened?: () => void }) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [reminderScopeModalOpen, setReminderScopeModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterUserId, setFilterUserId] = useState<string>('')
  const [form, setForm] = useState<{
    title: string
    assigned_to_user_id: string
    repeat_type: 'day_of_week' | 'days_after_completion' | 'once'
    repeat_days_of_week: number[]
    repeat_days_after: number
    repeat_end_date: string
    start_date: string
    show_until_completed: boolean
    notify_on_complete_user_id: string
    notify_creator_on_complete: boolean
    reminder_time: string
    reminder_scope: 'today_only' | 'today_and_overdue' | ''
  }>({
    title: '',
    assigned_to_user_id: '',
    repeat_type: 'once',
    repeat_days_of_week: [],
    repeat_days_after: 1,
    repeat_end_date: '',
    start_date: toLocalDateString(new Date()),
    show_until_completed: false,
    notify_on_complete_user_id: '',
    notify_creator_on_complete: false,
    reminder_time: '',
    reminder_scope: '',
  })

  useEffect(() => {
    setLoading(true)
    Promise.all([loadItems(), loadUsers()]).finally(() => setLoading(false))
  }, [filterUserId])

  useEffect(() => {
    if (openAddOnMount) {
      openAdd()
      onAddOpened?.()
    }
  }, [openAddOnMount])

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

  function openAdd() {
    setEditingId(null)
    setForm({
      title: '',
      assigned_to_user_id: users[0]?.id ?? '',
      repeat_type: 'once',
      repeat_days_of_week: [],
      repeat_days_after: 1,
      repeat_end_date: '',
      start_date: toLocalDateString(new Date()),
      show_until_completed: false,
      notify_on_complete_user_id: '',
      notify_creator_on_complete: false,
      reminder_time: '',
      reminder_scope: '',
    })
    setFormOpen(true)
  }

  function openEdit(item: ChecklistItem) {
    setEditingId(item.id)
    const rt = item.reminder_time
    setForm({
      title: item.title,
      assigned_to_user_id: item.assigned_to_user_id,
      repeat_type: item.repeat_type as 'day_of_week' | 'days_after_completion' | 'once',
      repeat_days_of_week: item.repeat_days_of_week ?? [],
      repeat_days_after: item.repeat_days_after ?? 1,
      repeat_end_date: item.repeat_end_date ?? '',
      start_date: item.start_date,
      show_until_completed: item.show_until_completed ?? false,
      notify_on_complete_user_id: item.notify_on_complete_user_id ?? '',
      notify_creator_on_complete: item.notify_creator_on_complete,
      reminder_time: rt ? (rt.length === 5 ? rt : rt.slice(0, 5)) : '',
      reminder_scope: (item.reminder_scope as 'today_only' | 'today_and_overdue') ?? '',
    })
    setFormOpen(true)
  }

  async function generateInstances(itemId: string, item: typeof form) {
    const instances: { checklist_item_id: string; scheduled_date: string; assigned_to_user_id: string }[] = []
    const start = new Date(item.start_date)
    const endDate = item.repeat_end_date ? new Date(item.repeat_end_date) : null

    if (item.repeat_type === 'once') {
      instances.push({
        checklist_item_id: itemId,
        scheduled_date: item.start_date,
        assigned_to_user_id: item.assigned_to_user_id,
      })
    } else if (item.repeat_type === 'day_of_week') {
      const targetDows = item.repeat_days_of_week ?? []
      const maxWeeks = 104
      for (const targetDow of targetDows) {
        let d = new Date(start)
        while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1)
        for (let w = 0; w < maxWeeks; w++) {
          if (endDate && d > endDate) break
          instances.push({
            checklist_item_id: itemId,
            scheduled_date: toLocalDateString(d),
            assigned_to_user_id: item.assigned_to_user_id,
          })
          d.setDate(d.getDate() + 7)
        }
      }
    } else if (item.repeat_type === 'days_after_completion') {
      instances.push({
        checklist_item_id: itemId,
        scheduled_date: item.start_date,
        assigned_to_user_id: item.assigned_to_user_id,
      })
    }

    if (instances.length > 0) {
      await supabase.from('checklist_instances').insert(instances)
    }
  }

  async function saveItem() {
    if (!authUserId) return
    setError(null)
    if (form.repeat_type === 'day_of_week' && form.repeat_days_of_week.length === 0) {
      setError('Select at least one day of the week.')
      return
    }
    if (editingId) {
      const { error } = await supabase
        .from('checklist_items')
        .update({
          title: form.title,
          assigned_to_user_id: form.assigned_to_user_id,
          repeat_type: form.repeat_type,
          repeat_days_of_week: form.repeat_type === 'day_of_week' ? (form.repeat_days_of_week.length ? form.repeat_days_of_week : null) : null,
          repeat_days_after: form.repeat_type === 'days_after_completion' ? form.repeat_days_after : null,
          repeat_end_date: form.repeat_end_date || null,
          start_date: form.start_date,
          show_until_completed: form.show_until_completed,
          notify_on_complete_user_id: form.notify_on_complete_user_id || null,
          notify_creator_on_complete: form.notify_creator_on_complete,
          reminder_time: form.reminder_time || null,
          reminder_scope: form.reminder_time && form.reminder_scope ? form.reminder_scope : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
      if (error) {
        setError(error.message)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('checklist_items')
        .insert({
          title: form.title,
          assigned_to_user_id: form.assigned_to_user_id,
          created_by_user_id: authUserId,
          repeat_type: form.repeat_type,
          repeat_days_of_week: form.repeat_type === 'day_of_week' ? (form.repeat_days_of_week.length ? form.repeat_days_of_week : null) : null,
          repeat_days_after: form.repeat_type === 'days_after_completion' ? form.repeat_days_after : null,
          repeat_end_date: form.repeat_end_date || null,
          start_date: form.start_date,
          show_until_completed: form.show_until_completed,
          notify_on_complete_user_id: form.notify_on_complete_user_id || null,
          notify_creator_on_complete: form.notify_creator_on_complete,
          reminder_time: form.reminder_time || null,
          reminder_scope: form.reminder_time && form.reminder_scope ? form.reminder_scope : null,
        })
        .select('id')
        .single()
      if (error) {
        setError(error.message)
        return
      }
      const newId = (data as { id: string })?.id
      if (newId) await generateInstances(newId, form)
    }
    setFormOpen(false)
    await loadItems()
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
        <button type="button" onClick={openAdd} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
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
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Assigned to</th>
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Repeat</th>
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Start</th>
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Notify</th>
            {role === 'dev' && <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Remind</th>}
            <th style={{ padding: '0.5rem 0.75rem' }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '0.5rem 0.75rem' }}>{item.title}</td>
              <td style={{ padding: '0.5rem 0.75rem' }}>{(item.users as { name: string; email: string } | null)?.name || (item.users as { email: string } | null)?.email || '—'}</td>
              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                {item.repeat_type === 'day_of_week' && `Weekly: ${(item.repeat_days_of_week ?? []).length ? (item.repeat_days_of_week ?? []).map((d) => DAYS[d]?.slice(0, 3) ?? '').filter(Boolean).join(', ') : '—'}`}
                {item.repeat_type === 'days_after_completion' && `${item.repeat_days_after} days after completion`}
                {item.repeat_type === 'once' && 'Once'}
              </td>
              <td style={{ padding: '0.5rem 0.75rem' }}>{item.start_date}</td>
              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                {item.notify_creator_on_complete && 'Creator '}
                {item.notify_on_complete_user_id && '+1 user'}
              </td>
              {role === 'dev' && (
                <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                  {item.reminder_time
                    ? `${item.reminder_time.slice(0, 5)} (${item.reminder_scope === 'today_and_overdue' ? 'due date + daily until done' : 'due date'})`
                    : '—'}
                </td>
              )}
              <td style={{ padding: '0.5rem 0.75rem' }}>
                <button type="button" onClick={() => openEdit(item)} style={{ marginRight: '0.5rem' }}>Edit</button>
                <button type="button" onClick={() => deleteItem(item.id)} style={{ color: '#b91c1c' }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p style={{ color: '#6b7280' }}>No checklist items yet.</p>}

      {formOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit' : 'Add'} checklist item</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem' }}>Title</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem' }}>Assign to</span>
                <select
                  value={form.assigned_to_user_id}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_to_user_id: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem' }}>Repeat</span>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <label><input type="radio" name="repeat" checked={form.repeat_type === 'once'} onChange={() => setForm((f) => ({ ...f, repeat_type: 'once' }))} /> Once</label>
                  <label><input type="radio" name="repeat" checked={form.repeat_type === 'day_of_week'} onChange={() => setForm((f) => ({ ...f, repeat_type: 'day_of_week' }))} /> Day of week</label>
                  <label><input type="radio" name="repeat" checked={form.repeat_type === 'days_after_completion'} onChange={() => setForm((f) => ({ ...f, repeat_type: 'days_after_completion' }))} /> Days after completion</label>
                </div>
              </label>
              {form.repeat_type === 'day_of_week' && (
                <label>
                  <span style={{ display: 'block', marginBottom: '0.25rem' }}>Days of week</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                    {DAYS.map((name, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <input
                          type="checkbox"
                          checked={form.repeat_days_of_week.includes(i)}
                          onChange={(e) => {
                            setForm((f) => ({
                              ...f,
                              repeat_days_of_week: e.target.checked
                                ? [...f.repeat_days_of_week, i].sort((a, b) => a - b)
                                : f.repeat_days_of_week.filter((d) => d !== i),
                            }))
                          }}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </label>
              )}
              {form.repeat_type === 'days_after_completion' && (
                <label>
                  <span style={{ display: 'block', marginBottom: '0.25rem' }}>Days after completion</span>
                  <input
                    type="number"
                    min={1}
                    value={form.repeat_days_after}
                    onChange={(e) => setForm((f) => ({ ...f, repeat_days_after: Number(e.target.value) || 1 }))}
                    style={{ padding: '0.5rem', width: 80 }}
                  />
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={form.show_until_completed}
                  onChange={(e) => setForm((f) => ({ ...f, show_until_completed: e.target.checked }))}
                />
                <span>Show up until completed</span>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem' }}>Repeat end date (optional)</span>
                <input
                  type="date"
                  value={form.repeat_end_date}
                  onChange={(e) => setForm((f) => ({ ...f, repeat_end_date: e.target.value }))}
                  style={{ padding: '0.5rem' }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem' }}>Start date</span>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  style={{ padding: '0.5rem' }}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.25rem' }}>Notify once complete</span>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={form.notify_on_complete_user_id}
                    onChange={(e) => setForm((f) => ({ ...f, notify_on_complete_user_id: e.target.value }))}
                    style={{ padding: '0.5rem', minWidth: 180 }}
                  >
                    <option value="">— Select user —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.notify_creator_on_complete}
                      onChange={(e) => setForm((f) => ({ ...f, notify_creator_on_complete: e.target.checked }))}
                    />
                    {' '}Notify me
                  </label>
                </div>
              </label>
              {role === 'dev' && (
                <>
                  <label>
                    <span style={{ display: 'block', marginBottom: '0.25rem' }}>Remind at (CST, optional)</span>
                    <input
                      type="time"
                      value={form.reminder_time}
                      onChange={(e) => setForm((f) => ({ ...f, reminder_time: e.target.value }))}
                      style={{ padding: '0.5rem' }}
                    />
                  </label>
                  {form.reminder_time && (
                    <label>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                        Reminder scope
                        <button
                          type="button"
                          onClick={() => setReminderScopeModalOpen(true)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6b7280',
                          }}
                          title="What each option means"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor">
                            <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z" />
                          </svg>
                        </button>
                      </span>
                      <select
                        value={form.reminder_scope}
                        onChange={(e) => setForm((f) => ({ ...f, reminder_scope: e.target.value as 'today_only' | 'today_and_overdue' | '' }))}
                        style={{ padding: '0.5rem', minWidth: 180 }}
                      >
                        <option value="">— Select —</option>
                        <option value="today_only">Due date</option>
                        <option value="today_and_overdue">Due date + daily until done</option>
                      </select>
                    </label>
                  )}
                </>
              )}
            </div>
            {reminderScopeModalOpen && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1100,
                }}
                onClick={() => setReminderScopeModalOpen(false)}
              >
                <div
                  style={{
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: 8,
                    maxWidth: 420,
                    width: '90%',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>What each option means</h4>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                    <strong>Due date</strong> – Remind only when there is an incomplete instance due today.
                  </p>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.5 }}>
                    Example: &quot;Call client&quot; is due Monday. You get a reminder Monday at 9am if it&apos;s not done. You do not get a reminder Tuesday, Wednesday, etc., even if it&apos;s still incomplete.
                  </p>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                    <strong>Due date + daily until done</strong> – Remind when there is an incomplete instance due today or earlier.
                  </p>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.5 }}>
                    Example: &quot;Call client&quot; was due Monday. If it&apos;s still incomplete, you get a reminder every day at 9am (Tuesday, Wednesday, etc.) until it&apos;s completed.
                  </p>
                  <button
                    type="button"
                    onClick={() => setReminderScopeModalOpen(false)}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button type="button" onClick={saveItem} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                Save
              </button>
              <button type="button" onClick={() => setFormOpen(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
