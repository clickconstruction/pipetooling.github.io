import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { getNextDisplayOrders } from '../utils/checklistOrder'
import { SearchableMultiSelect } from './SearchableMultiSelect'
import { SearchableSelect } from './SearchableSelect'
import { syncChecklistTitleTextareaHeight } from '../lib/syncChecklistTitleTextareaHeight'

const FALLBACK_ASSIGNEE_EMAIL = 'taunya@clickplumbing.com'

function getDefaultAssigneeId(
  initialAssigneeUserId: string | null,
  users: Array<{ id: string; email?: string }>,
  currentUserId: string | null
): string | null {
  // Send task flow: use passed userId if valid
  if (initialAssigneeUserId && users.some((u) => u.id === initialAssigneeUserId)) {
    return initialAssigneeUserId
  }
  // Add checklist flow: current user first
  if (currentUserId && users.some((u) => u.id === currentUserId)) {
    return currentUserId
  }
  // Fallback: Taunya by email
  const taunya = users.find((u) => u.email?.toLowerCase() === FALLBACK_ASSIGNEE_EMAIL)
  return taunya?.id ?? users[0]?.id ?? null
}

/**
 * When assignees were only the current user and the user adds someone else, drop self so the new default is "other only" (they can add self back).
 */
function dedupeSoloSelfWhenAddingOthers(
  prev: string[],
  next: string[],
  authUserId: string | null
): string[] {
  if (!authUserId || prev.length !== 1 || prev[0] !== authUserId) return next
  if (next.includes(authUserId) && next.some((id) => id !== authUserId)) {
    return next.filter((id) => id !== authUserId)
  }
  return next
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator' | 'primary'

export default function ChecklistAddModal() {
  const { user: authUser } = useAuth()
  const modalContext = useChecklistAddModal()
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [recentAssigneeIds, setRecentAssigneeIds] = useState<string[]>([])
  const [role, setRole] = useState<UserRole | null>(null)
  const [reminderScopeModalOpen, setReminderScopeModalOpen] = useState(false)
  const [advancedSectionOpen, setAdvancedSectionOpen] = useState(false)
  const [linksSectionOpen, setLinksSectionOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null)
  const [form, setForm] = useState({
    title: '',
    links: [] as string[],
    assigned_to_user_ids: [] as string[],
    repeat_type: 'once' as 'day_of_week' | 'days_after_completion' | 'once',
    repeat_days_of_week: [] as number[],
    repeat_days_after: 1,
    repeat_end_date: '',
    start_date: toLocalDateString(new Date()),
    show_until_completed: true,
    notify_on_complete_user_id: '',
    notify_creator_on_complete: true,
    reminder_time: '',
    reminder_scope: '' as 'today_only' | 'today_and_overdue' | '',
  })

  const assignToSelectOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: u.name?.trim() || u.email,
      })),
    [users],
  )

  const canManage = useMemo(
    () =>
      role === 'dev' ||
      role === 'master_technician' ||
      role === 'assistant' ||
      role === 'primary' ||
      role === 'estimator',
    [role],
  )

  useEffect(() => {
    if (!modalContext?.isOpen) return
    supabase
      .from('users')
      .select('id, name, email')
      .is('archived_at', null)
      .order('name')
      .then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    if (authUser?.id) {
      supabase.from('users').select('role').eq('id', authUser.id).single().then(({ data }) => {
        setRole((data as { role: UserRole } | null)?.role ?? null)
      })
      supabase
        .from('checklist_items')
        .select('id')
        .eq('created_by_user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(30)
        .then(async ({ data: items }) => {
          const ids = (items ?? []).map((r) => r.id)
          if (ids.length === 0) {
            setRecentAssigneeIds([])
            return
          }
          const { data: assignees } = await supabase
            .from('checklist_item_assignees')
            .select('user_id')
            .in('checklist_item_id', ids)
          const seen = new Set<string>()
          const unique: string[] = []
          for (const row of (assignees ?? []) as Array<{ user_id: string }>) {
            const id = row.user_id
            if (id && !seen.has(id) && unique.length < 3) {
              seen.add(id)
              unique.push(id)
            }
          }
          setRecentAssigneeIds(unique)
        })
    } else {
      setRecentAssigneeIds([])
    }
  }, [modalContext?.isOpen, authUser?.id])

  useEffect(() => {
    if (modalContext?.isOpen && users.length > 0 && form.assigned_to_user_ids.length === 0) {
      const defaultId = getDefaultAssigneeId(
        modalContext.initialAssigneeUserId,
        users,
        authUser?.id ?? null
      )
      if (defaultId) setForm((f) => ({ ...f, assigned_to_user_ids: [defaultId] }))
    }
  }, [modalContext?.isOpen, modalContext?.initialAssigneeUserId, users, form.assigned_to_user_ids.length, authUser?.id])

  useEffect(() => {
    if (modalContext?.isOpen) {
      const defaultAssignee = getDefaultAssigneeId(
        modalContext.initialAssigneeUserId,
        users,
        authUser?.id ?? null
      )
      setForm({
        title: '',
        links: [],
        assigned_to_user_ids: defaultAssignee ? [defaultAssignee] : [],
        repeat_type: 'once',
        repeat_days_of_week: [],
        repeat_days_after: 1,
        repeat_end_date: '',
        start_date: toLocalDateString(new Date()),
        show_until_completed: true,
        notify_on_complete_user_id: '',
        notify_creator_on_complete: true,
        reminder_time: '',
        reminder_scope: '',
      })
      setFormError(null)
      setLinksSectionOpen(false)
    }
  }, [modalContext?.isOpen, modalContext?.initialAssigneeUserId, users, authUser?.id])

  useLayoutEffect(() => {
    if (!modalContext?.isOpen) return
    syncChecklistTitleTextareaHeight(titleInputRef.current)
  }, [modalContext?.isOpen, form.title])

  useLayoutEffect(() => {
    if (!modalContext?.isOpen) return
    if (!canManage) return
    titleInputRef.current?.focus({ preventScroll: true })
  }, [modalContext?.isOpen, canManage])

  async function generateInstances(itemId: string, item: typeof form) {
    const assigneeIds = item.assigned_to_user_ids?.length ? item.assigned_to_user_ids : []
    if (assigneeIds.length === 0) return

    const instanceDates: string[] = []
    const start = new Date(item.start_date)
    const endDate = item.repeat_end_date ? new Date(item.repeat_end_date) : null

    if (item.repeat_type === 'once') {
      instanceDates.push(item.start_date)
    } else if (item.repeat_type === 'day_of_week') {
      const targetDows = item.repeat_days_of_week ?? []
      const maxWeeks = 104
      for (const targetDow of targetDows) {
        let d = new Date(start)
        while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1)
        for (let w = 0; w < maxWeeks; w++) {
          if (endDate && d > endDate) break
          instanceDates.push(toLocalDateString(d))
          d.setDate(d.getDate() + 7)
        }
      }
    } else if (item.repeat_type === 'days_after_completion') {
      instanceDates.push(item.start_date)
    }

    for (const scheduledDate of instanceDates) {
      const { data: inst } = await supabase
        .from('checklist_instances')
        .insert({ checklist_item_id: itemId, scheduled_date: scheduledDate })
        .select('id')
        .single()
      if (inst?.id) {
        await supabase.from('checklist_instance_assignees').insert(
          assigneeIds.map((uid) => ({ checklist_instance_id: inst.id, user_id: uid }))
        )
      }
    }
  }

  async function saveItem() {
    if (!authUser?.id || !modalContext) return
    setFormError(null)
    if (form.assigned_to_user_ids.length === 0) {
      setFormError('Select at least one assignee.')
      return
    }
    if (form.repeat_type === 'day_of_week' && form.repeat_days_of_week.length === 0) {
      setFormError('Select at least one day of the week.')
      return
    }
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({
        title: form.title,
        links: form.links.filter(Boolean).length ? form.links.filter(Boolean) : [],
        created_by_user_id: authUser.id,
        repeat_type: form.repeat_type,
        repeat_days_of_week: form.repeat_type === 'day_of_week' && form.repeat_days_of_week.length ? form.repeat_days_of_week : null,
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
      setFormError(error.message)
      return
    }
    const newId = (data as { id: string })?.id
    if (newId) {
      const nextOrders = await getNextDisplayOrders(form.assigned_to_user_ids)
      await supabase.from('checklist_item_assignees').insert(
        form.assigned_to_user_ids.map((uid) => ({
          checklist_item_id: newId,
          user_id: uid,
          display_order: nextOrders.get(uid) ?? 1,
        }))
      )
      await generateInstances(newId, form)
    }
    modalContext.closeModal()
    window.dispatchEvent(new CustomEvent('checklist-item-saved'))
  }

  if (!modalContext?.isOpen) return null

  if (!canManage) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-add-modal-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={() => modalContext.closeModal()}
    >
      <div
        style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="checklist-add-modal-title" style={{ marginTop: 0 }}>Add checklist item</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div>
              <textarea
                ref={titleInputRef}
                value={form.title}
                onChange={(e) => {
                  const t = e.target.value.replace(/\n/g, ' ')
                  setForm((f) => ({ ...f, title: t }))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault()
                }}
                rows={1}
                aria-label="Checklist item title"
                style={{
                  width: '100%',
                  minHeight: '2.75rem',
                  padding: '0.5rem',
                  boxSizing: 'border-box',
                  font: 'inherit',
                  lineHeight: 1.5,
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                  resize: 'none',
                }}
              />
            </div>
            <div
              role="group"
              aria-labelledby="checklist-add-assign-label"
              style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: '0.25rem' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                }}
              >
                <span id="checklist-add-assign-label" style={{ display: 'block', flexShrink: 0 }}>
                  Assign to
                </span>
                <div
                  aria-label={recentAssigneeIds.length > 0 ? 'Recent assignees' : undefined}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    textAlign: 'center',
                  }}
                >
                  {recentAssigneeIds.length > 0
                    ? (
                        <>
                          <span style={{ marginRight: '0.5rem' }}>Recent:</span>
                          {recentAssigneeIds
                            .map((id) => users.find((x) => x.id === id))
                            .filter((u): u is { id: string; name: string; email: string } => !!u)
                            .map((u, i) => (
                              <span key={u.id}>
                                {i > 0 && ', '}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForm((f) => {
                                      const prev = f.assigned_to_user_ids
                                      const proposed = prev.includes(u.id)
                                        ? prev
                                        : [...prev, u.id]
                                      return {
                                        ...f,
                                        assigned_to_user_ids: dedupeSoloSelfWhenAddingOthers(
                                          prev,
                                          proposed,
                                          authUser?.id ?? null,
                                        ),
                                      }
                                    })
                                  }}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2563eb', textDecoration: 'underline', fontSize: 'inherit' }}
                                >
                                  {u.name || u.email}
                                </button>
                              </span>
                            ))}
                        </>
                      )
                    : null}
                </div>
                <button
                  type="button"
                  onClick={() => setLinksSectionOpen((o) => !o)}
                  aria-expanded={linksSectionOpen}
                  aria-label={linksSectionOpen ? 'Hide links' : 'Show links'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: '1rem',
                    color: '#9ca3af',
                    flexShrink: 0,
                  }}
                >
                  <span aria-hidden>{linksSectionOpen ? '▼' : '▶'}</span>
                  <span>Links</span>
                  {form.links.length > 0 ? (
                    <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'inherit' }}>({form.links.length})</span>
                  ) : null}
                </button>
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                <SearchableMultiSelect
                  id="checklist-add-assign"
                  options={assignToSelectOptions}
                  value={form.assigned_to_user_ids}
                  onChange={(ids) =>
                    setForm((f) => ({
                      ...f,
                      assigned_to_user_ids: dedupeSoloSelfWhenAddingOthers(
                        f.assigned_to_user_ids,
                        ids,
                        authUser?.id ?? null,
                      ),
                    }))
                  }
                  listAriaLabel="Assign to"
                  pinSelectedToTop
                />
              </div>
            </div>
            {linksSectionOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {form.links.map((url, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const input = titleInputRef.current
                        if (input) {
                          const start = input.selectionStart ?? form.title.length
                          const end = input.selectionEnd ?? form.title.length
                          const placeholder = `[${i + 1}]`
                          const newTitle = form.title.slice(0, start) + placeholder + form.title.slice(end)
                          setForm((f) => ({ ...f, title: newTitle }))
                          setTimeout(() => {
                            input.focus()
                            const pos = start + placeholder.length
                            input.setSelectionRange(pos, pos)
                          }, 0)
                        }
                      }}
                      style={{
                        flexShrink: 0,
                        padding: '0.25rem 0.5rem',
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      [{i + 1}]
                    </button>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          links: f.links.map((u, j) => (j === i ? e.target.value : u)),
                        }))
                      }
                      placeholder="URL"
                      style={{ flex: 1, padding: '0.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          links: f.links.filter((_, j) => j !== i),
                        }))
                      }
                      style={{
                        padding: '0.25rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6b7280',
                        fontSize: '1.25rem',
                        lineHeight: 1,
                      }}
                      title="Remove link"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, links: [...f.links, ''] }))}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '0.25rem 0.5rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#2563eb',
                    textDecoration: 'underline',
                    fontSize: '0.875rem',
                  }}
                >
                  [+ add]
                </button>
              </div>
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexWrap: 'wrap',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <button
                type="button"
                onClick={() => setAdvancedSectionOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '1rem',
                  color: '#9ca3af',
                  flexShrink: 0,
                }}
              >
                {advancedSectionOpen ? '\u25BC' : '\u25B6'} Advanced
              </button>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  minWidth: 0,
                }}
              >
                <input
                  id="checklist-add-notify-creator"
                  type="checkbox"
                  checked={form.notify_creator_on_complete}
                  onChange={(e) => setForm((f) => ({ ...f, notify_creator_on_complete: e.target.checked }))}
                />
                Push notify me once complete
              </label>
            </div>
            {advancedSectionOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <label>
                  <span style={{ display: 'block', marginBottom: '0.25rem' }}>Push notify once complete</span>
                  <div style={{ minWidth: 0 }}>
                    <SearchableSelect
                      id="checklist-add-notify-on-complete"
                      value={form.notify_on_complete_user_id}
                      onChange={(id) => setForm((f) => ({ ...f, notify_on_complete_user_id: id }))}
                      options={assignToSelectOptions}
                      emptyOption={{ value: '', label: '— Select user —' }}
                      placeholder="— Select user —"
                      listAriaLabel="Push notify once complete"
                      searchReplacesTrigger
                      hideEmptyOptionInListWhenUnset
                    />
                  </div>
                </label>
                <label>
                  <span style={{ display: 'block', marginBottom: '0.25rem' }}>Repeat start date</span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    style={{ padding: '0.5rem' }}
                  />
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
                {role === 'dev' && (
                  <>
                    <label>
                      <span style={{ display: 'block', marginBottom: '0.25rem' }}>Remind at (CST)</span>
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
            )}
          </div>
        </div>
        {formError && <p style={{ color: '#b91c1c', marginTop: '0.5rem', fontSize: '0.875rem' }}>{formError}</p>}
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '1.5rem',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <button type="button" onClick={() => modalContext.closeModal()} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={saveItem} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
