import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { getNextDisplayOrders } from '../utils/checklistOrder'
import { SearchableSelect } from './SearchableSelect'
import { SearchableMultiSelect } from './SearchableMultiSelect'
import { checklistScheduleSummary, startNotOnChosenDay } from '../lib/checklistScheduleSummary'
import { syncChecklistTitleTextareaHeight } from '../lib/syncChecklistTitleTextareaHeight'
import { applyEditRegeneration } from '../lib/checklistEditRegenerate'
import { REMINDER_PRESETS, dailyFromScope, dayBeforeApplicable, reminderSummary, scopeFromDaily } from '../lib/checklistReminderOptions'
import { isAssistantLike } from '../lib/subcontractorLikeRole'

type UserRole =
  | 'dev'
  | 'master_technician'
  | 'assistant'
  | 'subcontractor'
  | 'helpers'
  | 'estimator'
  | 'primary'
  | 'superintendent'

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
  due_date: string | null
  show_until_completed: boolean
  notify_on_complete_user_id: string | null
  notify_creator_on_complete: boolean
  reminder_time: string | null
  reminder_scope: string | null
  remind_day_before: boolean | null
  escalate_after_days: number | null
  created_at: string | null
  updated_at: string | null
  users?: { name: string; email: string } | null
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type FormState = {
  title: string
  links: string[]
  assigned_to_user_ids: string[]
  repeat_type: 'day_of_week' | 'days_after_completion' | 'once'
  repeat_days_of_week: number[]
  repeat_days_after: number
  repeat_end_date: string
  start_date: string
  due_date: string
  show_until_completed: boolean
  notify_on_complete_user_id: string
  notify_creator_on_complete: boolean
  reminder_time: string
  reminder_daily: boolean
  remind_day_before: boolean
  escalate_enabled: boolean
  escalate_days: number
}

const initialForm: FormState = {
  title: '',
  links: [],
  assigned_to_user_ids: [],
  repeat_type: 'once',
  repeat_days_of_week: [],
  repeat_days_after: 1,
  repeat_end_date: '',
  start_date: new Date().toLocaleDateString('en-CA'),
  due_date: '',
  show_until_completed: true,
  notify_on_complete_user_id: '',
  notify_creator_on_complete: false,
  reminder_time: '',
  reminder_daily: true,
  remind_day_before: false,
  escalate_enabled: false,
  escalate_days: 3,
}

function populateForm(item: ChecklistItem, assigneeIds: string[]): FormState {
  const rt = item.reminder_time
  return {
    title: item.title.replace(/\n/g, ' '),
    links: item.links ?? [],
    assigned_to_user_ids: assigneeIds,
    repeat_type: item.repeat_type as FormState['repeat_type'],
    repeat_days_of_week: item.repeat_days_of_week ?? [],
    repeat_days_after: item.repeat_days_after ?? 1,
    repeat_end_date: item.repeat_end_date ?? '',
    start_date: item.start_date,
    due_date: item.due_date ?? '',
    show_until_completed: item.show_until_completed ?? true,
    notify_on_complete_user_id: item.notify_on_complete_user_id ?? '',
    notify_creator_on_complete: item.notify_creator_on_complete,
    reminder_time: rt ? (rt.length === 5 ? rt : rt.slice(0, 5)) : '',
    reminder_daily: dailyFromScope(item.reminder_scope),
    remind_day_before: item.remind_day_before ?? false,
    escalate_enabled: item.escalate_after_days != null,
    escalate_days: item.escalate_after_days ?? 3,
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
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [form, setForm] = useState<FormState>(initialForm)
  const [customTimeOpen, setCustomTimeOpen] = useState(false)
  /** user ids among the assignees that have ≥1 push device (null = unknown/not fetched). */
  const [pushEnabledIds, setPushEnabledIds] = useState<Set<string> | null>(null)
  /** Same When grammar as the Add modal (v2.2075); derived from the stored item on open. */
  const [when, setWhen] = useState<'today' | 'date' | 'repeat'>('date')
  const [repeatMode, setRepeatMode] = useState<'weekly' | 'after_done'>('weekly')

  // Reachability (v2.2096): which assignees can this reminder actually reach?
  // push_subscriptions is SELECT-visible to dev/master/assistant-like only.
  const canSeeReach = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  useEffect(() => {
    if (!itemId || !canSeeReach || !form.reminder_time || form.assigned_to_user_ids.length === 0) {
      setPushEnabledIds(null)
      return
    }
    let cancelled = false
    void supabase
      .from('push_subscriptions')
      .select('user_id')
      .in('user_id', form.assigned_to_user_ids)
      .then(({ data }) => {
        if (cancelled) return
        setPushEnabledIds(new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)))
      })
    return () => {
      cancelled = true
    }
  }, [itemId, canSeeReach, form.reminder_time, form.assigned_to_user_ids])

  const notifyUserSelectOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: u.name?.trim() || u.email,
      })),
    [users],
  )

  useEffect(() => {
    if (!itemId) return
    setLoading(true)
    setError(null)
    Promise.all([
      supabase
        .from('checklist_items')
        .select('id, title, links, created_by_user_id, repeat_type, repeat_days_of_week, repeat_days_after, repeat_end_date, start_date, due_date, show_until_completed, notify_on_complete_user_id, notify_creator_on_complete, reminder_time, reminder_scope, remind_day_before, escalate_after_days, created_at, updated_at')
        .eq('id', itemId)
        .single(),
      supabase.from('checklist_item_assignees').select('user_id').eq('checklist_item_id', itemId),
      supabase.from('users').select('id, name, email').is('archived_at', null).order('name'),
    ]).then(([itemRes, assigneesRes, usersRes]) => {
      const item = itemRes.data as ChecklistItem | null
      const assigneeIds = (assigneesRes.data ?? []).map((r: { user_id: string }) => r.user_id)
      const usersData = (usersRes.data ?? []) as Array<{ id: string; name: string; email: string }>
      if (itemRes.error) {
        setError(itemRes.error.message)
        onClose()
        return
      }
      if (item) {
        setForm(populateForm(item, assigneeIds))
        const today = new Date().toLocaleDateString('en-CA')
        if (item.repeat_type === 'day_of_week') {
          setWhen('repeat')
          setRepeatMode('weekly')
        } else if (item.repeat_type === 'days_after_completion') {
          setWhen('repeat')
          setRepeatMode('after_done')
        } else {
          setWhen(item.start_date === today ? 'today' : 'date')
        }
      }
      setUsers(usersData)
      setLoading(false)
    })
  }, [itemId, onClose, setError])

  useLayoutEffect(() => {
    if (!itemId) return
    syncChecklistTitleTextareaHeight(titleInputRef.current)
  }, [itemId, form.title])

  async function handleSave() {
    if (!itemId) return
    setError(null)
    if (form.assigned_to_user_ids.length === 0) {
      setError('Select at least one assignee.')
      return
    }
    const effRepeatType: 'once' | 'day_of_week' | 'days_after_completion' =
      when === 'repeat' ? (repeatMode === 'weekly' ? 'day_of_week' : 'days_after_completion') : 'once'
    const effStartDate = when === 'today' ? new Date().toLocaleDateString('en-CA') : form.start_date
    // A due date implies staying on the list — a deadline is meaningless for a task that vanishes first (v2.2351).
    const effDueDate = when !== 'repeat' && form.due_date ? form.due_date : null
    const effShowUntil = when === 'repeat' ? false : effDueDate ? true : form.show_until_completed
    if (when === 'date' && !form.start_date) {
      setError('Pick a date.')
      return
    }
    if (effDueDate && effDueDate < effStartDate) {
      setError('The due date can’t be before the task starts.')
      return
    }
    if (effRepeatType === 'day_of_week' && form.repeat_days_of_week.length === 0) {
      setError('Pick at least one weekday.')
      return
    }
    setSaving(true)
    try {
      const reminderCols = {
        remind_day_before:
          Boolean(form.reminder_time) &&
          form.remind_day_before &&
          dayBeforeApplicable(when === 'repeat' ? 'repeat' : when, effStartDate, new Date().toLocaleDateString('en-CA')),
        escalate_after_days: form.reminder_time && form.escalate_enabled ? Math.max(1, form.escalate_days) : null,
      }
      const { error } = await supabase
        .from('checklist_items')
        .update({
          ...reminderCols,
          title: form.title,
          links: form.links.filter(Boolean).length ? form.links.filter(Boolean) : [],
          repeat_type: effRepeatType,
          repeat_days_of_week: effRepeatType === 'day_of_week' ? (form.repeat_days_of_week.length ? form.repeat_days_of_week : null) : null,
          repeat_days_after: effRepeatType === 'days_after_completion' ? form.repeat_days_after : null,
          repeat_end_date: effRepeatType === 'day_of_week' ? form.repeat_end_date || null : null,
          start_date: effStartDate,
          due_date: effDueDate,
          show_until_completed: effShowUntil,
          notify_on_complete_user_id: form.notify_on_complete_user_id || null,
          notify_creator_on_complete: form.notify_creator_on_complete,
          reminder_time: form.reminder_time || null,
          reminder_scope: form.reminder_time ? scopeFromDaily(form.reminder_daily) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
      if (error) throw error
      await supabase.from('checklist_item_assignees').delete().eq('checklist_item_id', itemId)
      if (form.assigned_to_user_ids.length > 0) {
        const nextOrders = await getNextDisplayOrders(form.assigned_to_user_ids)
        await supabase.from('checklist_item_assignees').insert(
          form.assigned_to_user_ids.map((uid) => ({
            checklist_item_id: itemId,
            user_id: uid,
            display_order: nextOrders.get(uid) ?? 1,
          }))
        )
      }
      // v2.2057: make the occurrences follow the edit — before this, changing
      // days/dates/people updated the template only and every occurrence kept
      // the old schedule and roster.
      const regen = await applyEditRegeneration(
        itemId,
        {
          repeat_type: effRepeatType,
          repeat_days_of_week: effRepeatType === 'day_of_week' ? form.repeat_days_of_week : null,
          start_date: effStartDate,
          repeat_end_date: effRepeatType === 'day_of_week' ? form.repeat_end_date || null : null,
        },
        form.assigned_to_user_ids,
      )
      if (!regen.ok) throw new Error(regen.error ?? 'Failed to update occurrences')
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
      style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="checklist-edit-modal-title" style={{ marginTop: 0 }}>Edit checklist item</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <label>
              <span style={{ display: 'block', marginBottom: '0.25rem' }}>Title</span>
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
            </label>
            <div style={{ marginTop: '0.25rem' }}>
              <span id="checklist-edit-assign-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Assign to</span>
              <SearchableMultiSelect
                id="checklist-edit-assign"
                searchPlaceholder="Search people…"
                options={notifyUserSelectOptions}
                value={form.assigned_to_user_ids}
                onChange={(ids) => setForm((f) => ({ ...f, assigned_to_user_ids: ids }))}
                listAriaLabel="Assign to"
                pinSelectedToTop
                keyboardSelect
              />
            </div>
          </div>
          <label>
            <span style={{ display: 'block', marginBottom: '0.25rem' }}>Links</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                      background: 'var(--bg-muted)',
                      border: '1px solid var(--border-strong)',
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
                      color: 'var(--text-muted)',
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
                  color: 'var(--text-link)',
                  textDecoration: 'underline',
                  fontSize: '0.875rem',
                }}
              >
                [+ add]
              </button>
            </div>
          </label>
          <div style={{ marginBottom: '1rem' }}>
            {/* ── When (v2.2075): same grammar as the Add modal ── */}
            <div style={{ marginTop: '0.85rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>When</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['today', 'Today'], ['date', 'On a date'], ['repeat', 'Repeats']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWhen(key)}
                    aria-pressed={when === key}
                    style={{
                      ...{ flex: '1 1 90px', padding: '0.45rem 0.5rem', fontSize: '0.875rem', borderRadius: 9, cursor: 'pointer' },
                      border: when === key ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
                      background: when === key ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      color: when === key ? 'var(--text-blue-800)' : 'var(--text-700)',
                      fontWeight: when === key ? 600 : 400,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {when === 'date' ? (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <span>Do on</span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    style={{ padding: '0.4rem' }}
                  />
                </label>
              ) : null}
              {when !== 'repeat' ? (
                // Due by (v2.2351): optional deadline — on the list from Do on, late after this.
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>Due by</span>
                    <input
                      type="date"
                      value={form.due_date}
                      min={when === 'today' ? new Date().toLocaleDateString('en-CA') : form.start_date || undefined}
                      onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                      style={{ padding: '0.4rem' }}
                    />
                  </label>
                  {form.due_date ? (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, due_date: '' }))}
                      style={{ border: 'none', background: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8125rem', padding: 0 }}
                    >
                      clear — no due date
                    </button>
                  ) : null}
                </div>
              ) : null}
              {when !== 'repeat' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.875rem', cursor: form.due_date ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.due_date ? true : form.show_until_completed}
                    disabled={Boolean(form.due_date)}
                    onChange={(e) => setForm((f) => ({ ...f, show_until_completed: e.target.checked }))}
                  />
                  <span>Stays on the list until done{form.due_date ? ' (a due date keeps it on the list)' : ''}</span>
                </label>
              ) : null}
              {when === 'repeat' ? (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {([['weekly', 'Weekly on\u2026'], ['after_done', "\u2014 days after it's done"]] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRepeatMode(key)}
                        aria-pressed={repeatMode === key}
                        style={{
                          ...{ flex: '1 1 90px', padding: '0.45rem 0.5rem', fontSize: '0.875rem', borderRadius: 9, cursor: 'pointer' },
                          flex: '0 1 auto',
                          border: repeatMode === key ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
                          background: repeatMode === key ? 'var(--bg-blue-tint)' : 'var(--surface)',
                          color: repeatMode === key ? 'var(--text-blue-800)' : 'var(--text-700)',
                          fontWeight: repeatMode === key ? 600 : 400,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {repeatMode === 'weekly' ? (
                    <>
                      <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="Days of the week">
                        {DAYS.map((name, i) => {
                          const on = form.repeat_days_of_week.includes(i)
                          return (
                            <button
                              key={i}
                              type="button"
                              aria-pressed={on}
                              aria-label={name}
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  repeat_days_of_week: on
                                    ? f.repeat_days_of_week.filter((d) => d !== i)
                                    : [...f.repeat_days_of_week, i].sort((a, b) => a - b),
                                }))
                              }
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '0.35rem 0',
                                borderRadius: 8,
                                fontSize: '0.8125rem',
                                fontWeight: on ? 700 : 400,
                                border: on ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
                                background: on ? '#2563eb' : 'var(--surface)',
                                color: on ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer',
                              }}
                            >
                              {name[0]}
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Starts</span>
                          <input
                            type="date"
                            value={form.start_date}
                            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                            style={{ padding: '0.4rem' }}
                          />
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Ends (optional)</span>
                          <input
                            type="date"
                            value={form.repeat_end_date}
                            onChange={(e) => setForm((f) => ({ ...f, repeat_end_date: e.target.value }))}
                            style={{ padding: '0.4rem' }}
                          />
                        </label>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>Repeat</span>
                        <input
                          type="number"
                          min={1}
                          value={form.repeat_days_after}
                          onChange={(e) => setForm((f) => ({ ...f, repeat_days_after: Number(e.target.value) || 1 }))}
                          style={{ padding: '0.4rem', width: 64 }}
                        />
                        <span>days after it's completed</span>
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Starts</span>
                        <input
                          type="date"
                          value={form.start_date}
                          onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                          style={{ padding: '0.4rem' }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              ) : null}
              <div
                role="status"
                style={{
                  marginTop: '0.6rem',
                  padding: '0.5rem 0.7rem',
                  borderRadius: 9,
                  background: 'var(--bg-green-100)',
                  border: '1px solid #16a34a',
                  color: 'var(--text-green-700)',
                  fontSize: '0.85rem',
                }}
              >
                {checklistScheduleSummary({
                  when,
                  repeatMode,
                  startDate: form.start_date,
                  todayStr: new Date().toLocaleDateString('en-CA'),
                  daysOfWeek: form.repeat_days_of_week,
                  daysAfter: form.repeat_days_after,
                  endDate: form.repeat_end_date || null,
                  staysUntilDone: form.due_date ? true : form.show_until_completed,
                  dueDate: when !== 'repeat' ? form.due_date || null : null,
                  assigneeNames: form.assigned_to_user_ids.map(
                    (id) => users.find((u) => u.id === id)?.name?.trim() || users.find((u) => u.id === id)?.email || '\u2026',
                  ),
                })}
                {when === 'repeat' && repeatMode === 'weekly' && startNotOnChosenDay(form.start_date, form.repeat_days_of_week)
                  ? ' First occurrence lands on the next chosen day.'
                  : ''}
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Saving reshapes upcoming occurrences — completed ones and their notes stay put.
              </p>
            </div>

            {/* ── Notify: one line (v2.2075) ── */}
            <div style={{ marginTop: '0.75rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>When it's done, notify</span>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    id="checklist-edit-notify-creator"
                    type="checkbox"
                    checked={form.notify_creator_on_complete}
                    onChange={(e) => setForm((f) => ({ ...f, notify_creator_on_complete: e.target.checked }))}
                  />
                  Me
                </label>
                <div style={{ minWidth: 200, flex: '1 1 200px' }}>
                  <SearchableSelect
                    id="checklist-edit-notify-on-complete"
                    value={form.notify_on_complete_user_id}
                    onChange={(id) => setForm((f) => ({ ...f, notify_on_complete_user_id: id }))}
                    options={notifyUserSelectOptions}
                    emptyOption={{ value: '', label: '\u2014 add someone else \u2014' }}
                    placeholder="\u2014 add someone else \u2014"
                    listAriaLabel="Also notify when completed"
                    searchReplacesTrigger
                    hideEmptyOptionInListWhenUnset
                  />
                </div>
              </div>
            </div>

            {/* Remind (v2.2096): open to every task creator — preset chips, plain-words options, reachability. */}
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontWeight: 700, fontSize: '1.05rem', margin: '0 0 0.5rem' }}>Remind</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(() => {
                  const isPreset = REMINDER_PRESETS.some((p) => p.time === form.reminder_time)
                  const customVisible = customTimeOpen || (form.reminder_time !== '' && !isPreset)
                  const chips: Array<{ label: string; active: boolean; onClick: () => void }> = [
                    {
                      label: 'No reminder',
                      active: !form.reminder_time && !customVisible,
                      onClick: () => {
                        setForm((f) => ({ ...f, reminder_time: '' }))
                        setCustomTimeOpen(false)
                      },
                    },
                    ...REMINDER_PRESETS.map((p) => ({
                      label: p.label,
                      active: !customVisible && form.reminder_time === p.time,
                      onClick: () => {
                        setForm((f) => ({ ...f, reminder_time: p.time }))
                        setCustomTimeOpen(false)
                      },
                    })),
                    { label: 'Custom…', active: customVisible, onClick: () => setCustomTimeOpen(true) },
                  ]
                  return chips.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={c.onClick}
                      style={{
                        padding: '0.45rem 0.9rem',
                        borderRadius: 9,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        border: c.active ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
                        background: c.active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        color: c.active ? 'var(--text-blue-800)' : 'var(--text-700)',
                        fontWeight: c.active ? 600 : 400,
                      }}
                    >
                      {c.label}
                    </button>
                  ))
                })()}
              </div>
              {(customTimeOpen || (form.reminder_time !== '' && !REMINDER_PRESETS.some((p) => p.time === form.reminder_time))) && (
                <label style={{ display: 'block', marginTop: '0.6rem' }}>
                  <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Remind at (CST)</span>
                  <input
                    type="time"
                    value={form.reminder_time}
                    onChange={(e) => setForm((f) => ({ ...f, reminder_time: e.target.value }))}
                    style={{ padding: '0.5rem' }}
                  />
                </label>
              )}
              {form.reminder_time ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                    <input
                      type="checkbox"
                      checked={form.reminder_daily}
                      onChange={(e) => setForm((f) => ({ ...f, reminder_daily: e.target.checked }))}
                    />
                    Keep reminding every day until it&apos;s done
                  </label>
                  {dayBeforeApplicable(when === 'repeat' ? 'repeat' : when, form.start_date, new Date().toLocaleDateString('en-CA')) && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input
                        type="checkbox"
                        checked={form.remind_day_before}
                        onChange={(e) => setForm((f) => ({ ...f, remind_day_before: e.target.checked }))}
                      />
                      Also remind the day before it&apos;s due
                    </label>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.95rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.escalate_enabled}
                        onChange={(e) => setForm((f) => ({ ...f, escalate_enabled: e.target.checked }))}
                      />
                      Still not done after
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.escalate_days}
                      disabled={!form.escalate_enabled}
                      onChange={(e) => setForm((f) => ({ ...f, escalate_days: Math.min(30, Math.max(1, Number(e.target.value) || 1)) }))}
                      aria-label="Days overdue before reminding the creator"
                      style={{ width: 52, padding: '0.25rem 0.35rem' }}
                    />
                    <span>days? Remind me too</span>
                  </div>
                  {canSeeReach && pushEnabledIds && form.assigned_to_user_ids.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: '0.55rem' }}>
                      {form.assigned_to_user_ids.map((uid) => {
                        const u = users.find((x) => x.id === uid)
                        const name = u?.name?.trim() || u?.email || 'Unknown'
                        const hasPush = pushEnabledIds.has(uid)
                        return (
                          <span key={uid}>
                            <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{name}</b>{' '}
                            {hasPush ? (
                              <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{'📱'} phone alert</span>
                            ) : (
                              <>
                                <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>{'✉️'} email</span>
                                <span> {'—'} no phone alerts set up</span>
                              </>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  ) : null}
                  {(() => {
                    const names = form.assigned_to_user_ids
                      .map((uid) => {
                        const u = users.find((x) => x.id === uid)
                        return u?.name?.trim() || u?.email || ''
                      })
                      .filter(Boolean)
                    const s = reminderSummary(
                      {
                        time: form.reminder_time,
                        dailyUntilDone: form.reminder_daily,
                        dayBefore:
                          form.remind_day_before && dayBeforeApplicable(when === 'repeat' ? 'repeat' : when, form.start_date, new Date().toLocaleDateString('en-CA')),
                        escalateAfterDays: form.escalate_enabled ? form.escalate_days : null,
                      },
                      names,
                    )
                    return s ? (
                      <div
                        role="status"
                        style={{
                          padding: '0.5rem 0.7rem',
                          borderRadius: 9,
                          background: 'var(--bg-green-100)',
                          border: '1px solid #16a34a',
                          color: 'var(--text-green-700)',
                          fontSize: '0.85rem',
                        }}
                      >
                        {s}
                      </div>
                    ) : null
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        </div>
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
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
