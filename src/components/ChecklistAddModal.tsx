import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'

export default function ChecklistAddModal() {
  const { user: authUser } = useAuth()
  const modalContext = useChecklistAddModal()
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [role, setRole] = useState<UserRole | null>(null)
  const [reminderScopeModalOpen, setReminderScopeModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    assigned_to_user_id: '',
    repeat_type: 'once' as 'day_of_week' | 'days_after_completion' | 'once',
    repeat_days_of_week: [] as number[],
    repeat_days_after: 1,
    repeat_end_date: '',
    start_date: toLocalDateString(new Date()),
    show_until_completed: true,
    notify_on_complete_user_id: '',
    notify_creator_on_complete: false,
    reminder_time: '',
    reminder_scope: '' as 'today_only' | 'today_and_overdue' | '',
  })

  useEffect(() => {
    if (!modalContext?.isOpen) return
    supabase.from('users').select('id, name, email').order('name').then(({ data }) => {
      setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
    })
    if (authUser?.id) {
      supabase.from('users').select('role').eq('id', authUser.id).single().then(({ data }) => {
        setRole((data as { role: UserRole } | null)?.role ?? null)
      })
    }
  }, [modalContext?.isOpen, authUser?.id])

  useEffect(() => {
    if (modalContext?.isOpen && users.length > 0 && !form.assigned_to_user_id) {
      setForm((f) => ({ ...f, assigned_to_user_id: users[0]?.id ?? '' }))
    }
  }, [modalContext?.isOpen, users, form.assigned_to_user_id])

  useEffect(() => {
    if (modalContext?.isOpen) {
      setForm({
        title: '',
        assigned_to_user_id: users[0]?.id ?? '',
        repeat_type: 'once',
        repeat_days_of_week: [],
        repeat_days_after: 1,
        repeat_end_date: '',
        start_date: toLocalDateString(new Date()),
        show_until_completed: true,
        notify_on_complete_user_id: '',
        notify_creator_on_complete: false,
        reminder_time: '',
        reminder_scope: '',
      })
      setFormError(null)
    }
  }, [modalContext?.isOpen])

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
    if (!authUser?.id || !modalContext) return
    setFormError(null)
    if (form.repeat_type === 'day_of_week' && form.repeat_days_of_week.length === 0) {
      setFormError('Select at least one day of the week.')
      return
    }
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({
        title: form.title,
        assigned_to_user_id: form.assigned_to_user_id,
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
    if (newId) await generateInstances(newId, form)
    modalContext.closeModal()
    window.dispatchEvent(new CustomEvent('checklist-item-saved'))
  }

  if (!modalContext?.isOpen) return null

  const canManage = role === 'dev' || role === 'master_technician' || role === 'assistant'
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
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button type="button" onClick={saveItem} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            Save
          </button>
          <button type="button" onClick={() => modalContext.closeModal()} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
