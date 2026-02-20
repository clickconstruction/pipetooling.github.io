import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'

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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type FormState = {
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
}

const initialForm: FormState = {
  title: '',
  assigned_to_user_id: '',
  repeat_type: 'once',
  repeat_days_of_week: [],
  repeat_days_after: 1,
  repeat_end_date: '',
  start_date: new Date().toISOString().slice(0, 10),
  show_until_completed: false,
  notify_on_complete_user_id: '',
  notify_creator_on_complete: false,
  reminder_time: '',
  reminder_scope: '',
}

function populateForm(item: ChecklistItem): FormState {
  const rt = item.reminder_time
  return {
    title: item.title,
    assigned_to_user_id: item.assigned_to_user_id,
    repeat_type: item.repeat_type as FormState['repeat_type'],
    repeat_days_of_week: item.repeat_days_of_week ?? [],
    repeat_days_after: item.repeat_days_after ?? 1,
    repeat_end_date: item.repeat_end_date ?? '',
    start_date: item.start_date,
    show_until_completed: item.show_until_completed ?? false,
    notify_on_complete_user_id: item.notify_on_complete_user_id ?? '',
    notify_creator_on_complete: item.notify_creator_on_complete,
    reminder_time: rt ? (rt.length === 5 ? rt : rt.slice(0, 5)) : '',
    reminder_scope: (item.reminder_scope as FormState['reminder_scope']) ?? '',
  }
}

export function ChecklistItemEditModal({
  itemId,
  onClose,
  onSaved,
  setError,
  role,
}: {
  itemId: string | null
  onClose: () => void
  onSaved: () => void
  setError: (s: string | null) => void
  role: UserRole | null
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [form, setForm] = useState<FormState>(initialForm)
  const [reminderScopeModalOpen, setReminderScopeModalOpen] = useState(false)

  useEffect(() => {
    if (!itemId) return
    setLoading(true)
    setError(null)
    Promise.all([
      supabase
        .from('checklist_items')
        .select('id, title, assigned_to_user_id, created_by_user_id, repeat_type, repeat_days_of_week, repeat_days_after, repeat_end_date, start_date, show_until_completed, notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope, created_at, updated_at, users!checklist_items_assigned_to_user_id_fkey(name, email)')
        .eq('id', itemId)
        .single(),
      supabase.from('users').select('id, name, email').order('name'),
    ]).then(([itemRes, usersRes]) => {
      const item = itemRes.data as ChecklistItem | null
      const usersData = (usersRes.data ?? []) as Array<{ id: string; name: string; email: string }>
      if (itemRes.error) {
        setError(itemRes.error.message)
        onClose()
        return
      }
      if (item) setForm(populateForm(item))
      setUsers(usersData)
      setLoading(false)
    })
  }, [itemId, onClose, setError])

  async function handleSave() {
    if (!itemId) return
    setError(null)
    if (form.repeat_type === 'day_of_week' && form.repeat_days_of_week.length === 0) {
      setError('Select at least one day of the week.')
      return
    }
    setSaving(true)
    try {
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
        .eq('id', itemId)
      if (error) throw error
      window.dispatchEvent(new Event('checklist-item-saved'))
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!itemId) return null
  if (loading) return <p style={{ padding: '2rem' }}>Loading…</p>

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-edit-modal-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="checklist-edit-modal-title" style={{ marginTop: 0 }}>Edit checklist item</h3>
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
          <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
