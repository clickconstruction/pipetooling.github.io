import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { denverWorkDateToday, syncSalaryClockSessionsForUserDay } from '../lib/salaryScheduleSync'
import { recordNotComingInSelf } from '../lib/notComingInTimeOff'

type TimeOffRow = Database['public']['Tables']['user_time_off']['Row']

export function TimeOffSettings({ userId }: { userId: string }) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<TimeOffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    if (!userId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.from('user_time_off').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
        'time off list',
      )
      setRows(data ?? [])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to load time off'), 'error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [userId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) {
      showToast('Start and end date required', 'warning')
      return
    }
    if (endDate < startDate) {
      showToast('End date must be on or after start date', 'warning')
      return
    }
    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('user_time_off').insert({
            user_id: userId,
            start_date: startDate,
            end_date: endDate,
            kind: 'unpaid',
            note: note.trim() || null,
          }),
        'time off insert',
      )
      showToast('Unpaid time off saved', 'success')
      setNote('')
      await load()
      const today = denverWorkDateToday()
      if (today >= startDate && today <= endDate) {
        const { error: syncErr } = await syncSalaryClockSessionsForUserDay(userId, today)
        if (syncErr) showToast(syncErr, 'warning')
      }
    } catch (err) {
      showToast(formatErrorMessage(err, 'Save failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleNotComingInToday() {
    if (
      !window.confirm(
        'Mark yourself as not coming in today? This adds unpaid time off on the calendar. You can still clock in if plans change.',
      )
    )
      return
    setSaving(true)
    try {
      const ymd = denverWorkDateToday()
      const result = await recordNotComingInSelf({ userId, workDateYmd: ymd })
      if (result.ok && result.alreadyMarked) {
        showToast('You already have unpaid time off on that date.', 'warning')
        return
      }
      if (!result.ok) {
        showToast(result.message, 'error')
        return
      }
      showToast('Not coming in saved for today.', 'success')
      await load()
      const { error: syncErr } = await syncSalaryClockSessionsForUserDay(userId, ymd)
      if (syncErr) showToast(syncErr, 'warning')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this unpaid time off entry?')) return
    try {
      await withSupabaseRetry(
        async () => supabase.from('user_time_off').delete().eq('id', id).eq('user_id', userId),
        'time off delete',
      )
      showToast('Removed', 'success')
      await load()
      const today = denverWorkDateToday()
      const { error: syncErr } = await syncSalaryClockSessionsForUserDay(userId, today)
      if (syncErr) showToast(syncErr, 'warning')
    } catch (err) {
      showToast(formatErrorMessage(err, 'Delete failed'), 'error')
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading time off…</p>
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 0 }}>
        Add planned <strong>unpaid</strong> time off using <strong>company calendar dates</strong> (Central). Salary
        auto-sessions are skipped on these days after sync.
      </p>
      <div style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          disabled={saving || !userId}
          onClick={() => void handleNotComingInToday()}
          style={{
            padding: '0.4rem 0.75rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#6b21a8',
            background: '#f3e8ff',
            border: '1px solid #e9d5ff',
            borderRadius: 6,
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          Not coming in today
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0' }}>
        {rows.length === 0 ? (
          <li style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No entries yet.</li>
        ) : (
          rows.map((r) => (
            <li
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.875rem',
              }}
            >
              <span>
                <strong>Unpaid time off</strong> · <strong>{r.start_date}</strong> → <strong>{r.end_date}</strong>
                {r.note ? ` — ${r.note}` : ''}
              </span>
              <button
                type="button"
                onClick={() => void handleDelete(r.id)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', color: 'var(--text-red-700)', border: '1px solid #fecaca', borderRadius: 4, background: 'var(--surface)' }}
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
      <form onSubmit={(e) => void handleAdd(e)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', background: 'var(--bg-page)' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Add range</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
          <label>
            <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Start</span>
            <input type="date" value={startDate} onChange={(ev) => setStartDate(ev.target.value)} required style={{ padding: '0.35rem' }} />
          </label>
          <label>
            <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>End</span>
            <input type="date" value={endDate} onChange={(ev) => setEndDate(ev.target.value)} required style={{ padding: '0.35rem' }} />
          </label>
        </div>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Note (optional)</span>
          <input type="text" value={note} onChange={(ev) => setNote(ev.target.value)} style={{ width: '100%', maxWidth: 400, padding: '0.35rem' }} />
        </label>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '0.5rem 1rem', fontWeight: 600, background: '#ea580c', color: 'white', border: 'none', borderRadius: 6 }}
        >
          {saving ? 'Saving…' : 'Add unpaid time off'}
        </button>
      </form>
    </div>
  )
}
