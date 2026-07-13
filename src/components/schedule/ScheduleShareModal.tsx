import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import {
  computeShareDates,
  isShareConfigValid,
  type ShareScope,
} from '../../lib/scheduleShareDates'

const USER_PICK_LIMIT = 500
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

type UserRow = { id: string; name: string; email: string }

type RecurringRow = {
  id: string
  recipient_user_id: string
  time_local: string
  timezone: string
  days_of_week: number[]
  include_current_day: boolean
  scope: ShareScope
  enabled: boolean
}

function userLabel(name: string, email: string): string {
  const n = name.trim() || 'Unknown'
  const e = email.trim()
  return e ? `${n} (${e})` : n
}

function parseHm24(value: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return { h, m: min }
}

function formatTimeLocal12(timeLocal: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(timeLocal.trim())
  if (!m) return timeLocal
  const d = new Date(Date.UTC(2000, 0, 1, Number(m[1]), Number(m[2]), 0))
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

function formatDatePreview(dates: string[]): string {
  if (dates.length === 0) return 'no dates'
  return dates
    .map((ymd) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
      if (!m) return ymd
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    })
    .join(', ')
}

const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 } as const
const checkboxRow = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' } as const

/** Shared "what to include" fields: current day + (next day XOR rest of week). */
function ShareConfigFields({
  includeCurrentDay,
  scope,
  onChange,
  idPrefix,
}: {
  includeCurrentDay: boolean
  scope: ShareScope
  onChange: (next: { includeCurrentDay: boolean; scope: ShareScope }) => void
  idPrefix: string
}) {
  return (
    <fieldset style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.65rem', margin: 0 }}>
      <legend style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0 4px' }}>Include</legend>
      <label htmlFor={`${idPrefix}-cur`} style={{ ...checkboxRow, marginBottom: 4 }}>
        <input
          id={`${idPrefix}-cur`}
          type="checkbox"
          checked={includeCurrentDay}
          onChange={(e) => onChange({ includeCurrentDay: e.target.checked, scope })}
        />
        Current day
      </label>
      <label htmlFor={`${idPrefix}-next`} style={{ ...checkboxRow, marginBottom: 4 }}>
        <input
          id={`${idPrefix}-next`}
          type="checkbox"
          checked={scope === 'next_day'}
          onChange={(e) => onChange({ includeCurrentDay, scope: e.target.checked ? 'next_day' : 'none' })}
        />
        Next day
      </label>
      <label htmlFor={`${idPrefix}-rest`} style={checkboxRow}>
        <input
          id={`${idPrefix}-rest`}
          type="checkbox"
          checked={scope === 'rest_of_week'}
          onChange={(e) => onChange({ includeCurrentDay, scope: e.target.checked ? 'rest_of_week' : 'none' })}
        />
        Rest of week <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>(through Sunday)</span>
      </label>
    </fieldset>
  )
}

export function ScheduleShareModal({
  open,
  onClose,
  baseDateYmd,
}: {
  open: boolean
  onClose: () => void
  /** Today (Central) — base date for an instant share. */
  baseDateYmd: string
}) {
  const { showToast } = useToastContext()
  const [tab, setTab] = useState<'now' | 'recurring'>('now')
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersError, setUsersError] = useState<string | null>(null)

  // Send-now state
  const [pickerValue, setPickerValue] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [nowInclude, setNowInclude] = useState(true)
  const [nowScope, setNowScope] = useState<ShareScope>('none')
  const [sending, setSending] = useState(false)
  const [nowError, setNowError] = useState<string | null>(null)

  // Recurring state
  const [recurring, setRecurring] = useState<RecurringRow[]>([])
  const [recurringLoading, setRecurringLoading] = useState(false)
  const [recurringError, setRecurringError] = useState<string | null>(null)
  const [busyRowId, setBusyRowId] = useState<string | null>(null)
  const [formRecipient, setFormRecipient] = useState('')
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [formTime, setFormTime] = useState('17:00')
  const [formInclude, setFormInclude] = useState(true)
  const [formScope, setFormScope] = useState<ShareScope>('none')
  const [savingForm, setSavingForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const userMap = useMemo(() => {
    const m = new Map<string, UserRow>()
    for (const u of users) m.set(u.id, u)
    return m
  }, [users])

  const userOptions = useMemo<SearchableSelectOption[]>(
    () => users.map((u) => ({ value: u.id, label: userLabel(u.name, u.email) })),
    [users],
  )

  const loadRecurring = useCallback(async () => {
    setRecurringLoading(true)
    setRecurringError(null)
    try {
      const rows = await withSupabaseRetry(
        () =>
          supabase
            .from('schedule_share_recurring')
            .select('id, recipient_user_id, time_local, timezone, days_of_week, include_current_day, scope, enabled')
            .order('created_at', { ascending: false }),
        'schedule share recurring list',
      )
      setRecurring((rows ?? []) as RecurringRow[])
    } catch (e: unknown) {
      setRecurringError(formatErrorMessage(e, 'Could not load recurring shares'))
    } finally {
      setRecurringLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setTab('now')
    setNowError(null)
    setSelectedIds([])
    setPickerValue('')
    setNowInclude(true)
    setNowScope('none')
    setFormError(null)
    let cancelled = false
    ;(async () => {
      try {
        const rows = await withSupabaseRetry(
          () =>
            supabase
              .from('users')
              .select('id,name,email')
              .is('archived_at', null)
              .order('name', { ascending: true })
              .limit(USER_PICK_LIMIT),
          'schedule share user list',
        )
        if (cancelled) return
        setUsers((rows ?? []) as UserRow[])
        setUsersError(null)
      } catch (e: unknown) {
        if (!cancelled) setUsersError(formatErrorMessage(e, 'Could not load users'))
      }
    })()
    void loadRecurring()
    return () => {
      cancelled = true
    }
  }, [open, loadRecurring])

  const nowDates = useMemo(
    () => computeShareDates(baseDateYmd, { includeCurrentDay: nowInclude, scope: nowScope }),
    [baseDateYmd, nowInclude, nowScope],
  )

  const handleAddRecipient = useCallback((id: string) => {
    if (!id) return
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setPickerValue('')
  }, [])

  const handleSendNow = useCallback(async () => {
    if (selectedIds.length === 0) {
      setNowError('Pick at least one recipient.')
      return
    }
    if (!isShareConfigValid({ includeCurrentDay: nowInclude, scope: nowScope })) {
      setNowError('Choose at least one of current day / next day / rest of week.')
      return
    }
    if (nowDates.length === 0) {
      setNowError('Those options cover no dates today.')
      return
    }
    setSending(true)
    setNowError(null)
    try {
      const { data, error } = await supabase.functions.invoke('schedule-share-dispatch', {
        body: {
          recipientUserIds: selectedIds,
          baseDate: baseDateYmd,
          includeCurrentDay: nowInclude,
          scope: nowScope,
        },
      })
      if (error) throw error
      const sent = typeof (data as { sent?: number })?.sent === 'number' ? (data as { sent: number }).sent : 0
      if (sent > 0) {
        showToast(`Schedule sent to ${sent} recipient${sent === 1 ? '' : 's'}`, 'success')
        onClose()
      } else {
        setNowError('No emails were sent (recipients may be missing email addresses).')
      }
    } catch (e: unknown) {
      setNowError(formatErrorMessage(e, 'Could not send'))
    } finally {
      setSending(false)
    }
  }, [selectedIds, nowInclude, nowScope, nowDates.length, baseDateYmd, showToast, onClose])

  const handleSaveRecurring = useCallback(async () => {
    if (!formRecipient) {
      setFormError('Pick a recipient.')
      return
    }
    if (formDays.length === 0) {
      setFormError('Pick at least one day of the week.')
      return
    }
    if (!parseHm24(formTime)) {
      setFormError('Use a valid time like 17:00 (Central).')
      return
    }
    if (!isShareConfigValid({ includeCurrentDay: formInclude, scope: formScope })) {
      setFormError('Choose at least one of current day / next day / rest of week.')
      return
    }
    setSavingForm(true)
    setFormError(null)
    try {
      await withSupabaseRetry(
        () =>
          supabase.from('schedule_share_recurring').insert({
            recipient_user_id: formRecipient,
            time_local: `${formTime}:00`,
            timezone: APP_CALENDAR_TZ,
            days_of_week: [...formDays].sort((a, b) => a - b),
            include_current_day: formInclude,
            scope: formScope,
            enabled: true,
          }),
        'schedule share recurring insert',
      )
      showToast('Recurring share created', 'success')
      setFormRecipient('')
      setFormScope('none')
      setFormInclude(true)
      await loadRecurring()
    } catch (e: unknown) {
      setFormError(formatErrorMessage(e, 'Could not save'))
    } finally {
      setSavingForm(false)
    }
  }, [formRecipient, formDays, formTime, formInclude, formScope, showToast, loadRecurring])

  const toggleEnabled = useCallback(
    async (row: RecurringRow) => {
      setBusyRowId(row.id)
      try {
        await withSupabaseRetry(
          () => supabase.from('schedule_share_recurring').update({ enabled: !row.enabled }).eq('id', row.id),
          'schedule share recurring toggle',
        )
        await loadRecurring()
      } catch (e: unknown) {
        showToast(formatErrorMessage(e, 'Could not update'), 'error')
      } finally {
        setBusyRowId(null)
      }
    },
    [loadRecurring, showToast],
  )

  const deleteRow = useCallback(
    async (row: RecurringRow) => {
      setBusyRowId(row.id)
      try {
        await withSupabaseRetry(
          () => supabase.from('schedule_share_recurring').delete().eq('id', row.id),
          'schedule share recurring delete',
        )
        await loadRecurring()
      } catch (e: unknown) {
        showToast(formatErrorMessage(e, 'Could not delete'), 'error')
      } finally {
        setBusyRowId(null)
      }
    },
    [loadRecurring, showToast],
  )

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={sending ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="schedule-share-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          padding: '1rem 1.1rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="schedule-share-title" style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
          Share schedule
        </h2>

        <div role="tablist" aria-label="Share mode" style={{ display: 'flex', gap: 4, marginBottom: '0.75rem' }}>
          {(['now', 'recurring'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.85rem',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                background: tab === t ? '#2563eb' : 'var(--surface)',
                color: tab === t ? '#fff' : 'var(--text-700)',
                fontWeight: tab === t ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {t === 'now' ? 'Send now' : 'Recurring'}
            </button>
          ))}
        </div>

        {usersError ? (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{usersError}</p>
        ) : null}

        {tab === 'now' ? (
          <div>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--text-600)', lineHeight: 1.4 }}>
              Email an immediate copy of the full dispatch board (grouped by person) to the people you pick.
              Times are <strong>{APP_CALENDAR_TZ.replace(/_/g, ' ')}</strong>.
            </p>

            <div style={{ marginBottom: '0.6rem' }}>
              <span style={labelStyle}>Recipients</span>
              <SearchableSelect
                id="schedule-share-add-recipient"
                value={pickerValue}
                onChange={handleAddRecipient}
                options={userOptions}
                placeholder="Add a user…"
                disabled={sending || userOptions.length === 0}
                listAriaLabel="Add recipient"
                portalZIndex={1400}
                minSearchChars={2}
                searchReplacesTrigger
              />
              {selectedIds.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {selectedIds.map((id) => {
                    const u = userMap.get(id)
                    return (
                      <span
                        key={id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'var(--bg-blue-tint)',
                          border: '1px solid #bfdbfe',
                          borderRadius: 999,
                          padding: '2px 8px',
                          fontSize: '0.8rem',
                        }}
                      >
                        {u ? u.name.trim() || u.email : id.slice(-8)}
                        <button
                          type="button"
                          aria-label="Remove recipient"
                          onClick={() => setSelectedIds((prev) => prev.filter((x) => x !== id))}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-blue-700)', fontSize: '0.9rem', lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div style={{ marginBottom: '0.6rem' }}>
              <ShareConfigFields
                idPrefix="now"
                includeCurrentDay={nowInclude}
                scope={nowScope}
                onChange={({ includeCurrentDay, scope }) => {
                  setNowInclude(includeCurrentDay)
                  setNowScope(scope)
                }}
              />
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Covers: {formatDatePreview(nowDates)}
              </p>
            </div>

            {nowError ? (
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{nowError}</p>
            ) : null}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={sending}
                onClick={onClose}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: sending ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sending || selectedIds.length === 0}
                onClick={() => void handleSendNow()}
                style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', border: 'none', borderRadius: 6, background: '#ff6600', color: '#fff', fontWeight: 600, cursor: sending || selectedIds.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                {sending ? 'Sending…' : 'Send now'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--text-600)', lineHeight: 1.4 }}>
              Standing emails of the dispatch board. Everyone with dispatch access can see and manage these.
              Times are <strong>{APP_CALENDAR_TZ.replace(/_/g, ' ')}</strong>.
            </p>

            {/* Existing recurring shares */}
            <div style={{ marginBottom: '0.85rem' }}>
              <span style={labelStyle}>Active &amp; paused shares</span>
              {recurringLoading ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading…</p>
              ) : recurringError ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{recurringError}</p>
              ) : recurring.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>None yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recurring.map((row) => {
                    const u = userMap.get(row.recipient_user_id)
                    const dayStr = [...row.days_of_week].sort((a, b) => a - b).map((d) => DOW_LABELS[d] ?? d).join(' ')
                    const scopeStr =
                      row.scope === 'next_day' ? '+ next day' : row.scope === 'rest_of_week' ? '+ rest of week' : ''
                    const includeStr = row.include_current_day ? 'current day' : ''
                    const covers = [includeStr, scopeStr].filter(Boolean).join(' ') || '—'
                    return (
                      <li
                        key={row.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '0.5rem 0.6rem',
                          background: row.enabled ? 'var(--surface)' : 'var(--bg-subtle)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', lineHeight: 1.35 }}>
                          <strong>{u ? u.name.trim() || u.email : row.recipient_user_id.slice(-8)}</strong>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {dayStr} · {formatTimeLocal12(row.time_local)} · {covers}
                            {row.enabled ? '' : ' · paused'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            disabled={busyRowId === row.id}
                            onClick={() => void toggleEnabled(row)}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', cursor: 'pointer' }}
                          >
                            {row.enabled ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            type="button"
                            disabled={busyRowId === row.id}
                            onClick={() => void deleteRow(row)}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', border: '1px solid #fca5a5', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-red-700)', cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Create new recurring share */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
              <span style={labelStyle}>New recurring share</span>

              <div style={{ marginBottom: '0.5rem' }}>
                <SearchableSelect
                  id="schedule-share-recurring-recipient"
                  value={formRecipient}
                  onChange={setFormRecipient}
                  options={userOptions}
                  placeholder="Recipient…"
                  disabled={savingForm || userOptions.length === 0}
                  listAriaLabel="Recurring recipient"
                  portalZIndex={1400}
                  minSearchChars={2}
                  searchReplacesTrigger
                />
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ ...labelStyle, marginBottom: 6 }}>Days</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {DOW_LABELS.map((lbl, idx) => {
                    const on = formDays.includes(idx)
                    return (
                      <button
                        key={lbl}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setFormDays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]))
                        }
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.78rem',
                          borderRadius: 5,
                          border: on ? '1px solid #2563eb' : '1px solid var(--border-strong)',
                          background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                          color: on ? 'var(--text-blue-700)' : 'var(--text-700)',
                          cursor: 'pointer',
                          minWidth: 40,
                        }}
                      >
                        {lbl}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <div>
                  <label htmlFor="schedule-share-recurring-time" style={labelStyle}>
                    Send at (Central, 24h)
                  </label>
                  <input
                    id="schedule-share-recurring-time"
                    type="time"
                    step={900}
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    disabled={savingForm}
                    style={{ fontSize: '0.95rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6 }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <ShareConfigFields
                    idPrefix="recurring"
                    includeCurrentDay={formInclude}
                    scope={formScope}
                    onChange={({ includeCurrentDay, scope }) => {
                      setFormInclude(includeCurrentDay)
                      setFormScope(scope)
                    }}
                  />
                </div>
              </div>

              {formError ? (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{formError}</p>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={savingForm}
                  onClick={() => void handleSaveRecurring()}
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 600, cursor: savingForm ? 'not-allowed' : 'pointer' }}
                >
                  {savingForm ? 'Saving…' : 'Create recurring share'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
