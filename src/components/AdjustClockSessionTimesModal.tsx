import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { fromDatetimeLocal, toDatetimeLocal } from '../utils/datetimeLocal'

const MIN_SEGMENT_MS = 0.01 * 3600 * 1000

export type AdjustClockSessionTimesSession = {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
  approved_at: string | null
}

export type AdjustClockSessionTimesModalProps = {
  session: AdjustClockSessionTimesSession
  onClose: () => void
  onSaved?: () => void
  showToast?: (message: string, variant?: 'success' | 'error' | 'warning' | 'info') => void
  zIndex?: number
}

export function AdjustClockSessionTimesModal({
  session,
  onClose,
  onSaved,
  showToast,
  zIndex = 1110,
}: AdjustClockSessionTimesModalProps) {
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOpenSession = session.clocked_out_at == null
  const notesTrimmed = (session.notes ?? '').trim()

  useEffect(() => {
    setClockIn(toDatetimeLocal(session.clocked_in_at))
    setClockOut(session.clocked_out_at ? toDatetimeLocal(session.clocked_out_at) : '')
    setError(null)
  }, [session.id, session.clocked_in_at, session.clocked_out_at])

  /**
   * Best-effort resync of people_hours for this session's day(s) after an in-place time edit.
   * Approved hours are maintained incrementally (approve adds the duration), so changing an
   * approved session's times must recompute the day's total or the Hours grid stays stale.
   */
  async function resyncPeopleHoursForDay() {
    try {
      await supabase.rpc('recompute_people_hours_after_session_edit', {
        p_session_id: session.id,
        p_old_work_date: session.work_date,
      })
    } catch {
      // The time edit already saved; a failed resync just leaves the grid on the prior total.
    }
  }

  async function handleSubmit() {
    setError(null)
    const inVal = fromDatetimeLocal(clockIn)
    if (!inVal) {
      setError('Clock in is required.')
      return
    }
    const inMs = new Date(inVal).getTime()
    const nowMs = Date.now()
    if (inMs > nowMs) {
      setError('Clock-in cannot be in the future.')
      return
    }

    const workDate = clockIn.slice(0, 10)

    if (isOpenSession && !clockOut.trim()) {
      if (session.approved_at) {
        const ok = window.confirm(
          'This session was already approved. Changing clock-in will change recorded hours and may require re-approval. Continue?',
        )
        if (!ok) return
      }
      setSaving(true)
      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .update({
                clocked_in_at: inVal,
                work_date: workDate,
                notes: notesTrimmed,
                job_ledger_id: session.job_ledger_id,
                bid_id: session.bid_id,
              })
              .eq('id', session.id),
          'adjust clock session times',
        )
        await resyncPeopleHoursForDay()
        showToast?.('Times saved.', 'success')
        onSaved?.()
        onClose()
      } catch (e: unknown) {
        setError(formatErrorMessage(e, 'Failed to save times'))
      } finally {
        setSaving(false)
      }
      return
    }

    const outVal = fromDatetimeLocal(clockOut)
    if (!outVal) {
      setError(isOpenSession ? 'Enter clock out to close this session, or clear clock out to only update clock-in.' : 'Clock out is required.')
      return
    }
    const outMs = new Date(outVal).getTime()
    if (outMs <= inMs) {
      setError('Clock out must be after clock in.')
      return
    }
    if (outMs - inMs < MIN_SEGMENT_MS) {
      setError('Session must be at least 0.01 hours (~36 seconds).')
      return
    }
    if (outMs > nowMs) {
      setError('Clock out cannot be in the future.')
      return
    }

    if (session.approved_at) {
      const ok = window.confirm(
        'This session is approved. Saving updates the recorded payroll hours for this day to match the new times. Continue?',
      )
      if (!ok) return
    }

    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({
              clocked_in_at: inVal,
              clocked_out_at: outVal,
              work_date: workDate,
              notes: notesTrimmed,
              job_ledger_id: session.job_ledger_id,
              bid_id: session.bid_id,
            })
            .eq('id', session.id),
        'adjust clock session times',
      )
      await resyncPeopleHoursForDay()
      showToast?.('Times saved.', 'success')
      onSaved?.()
      onClose()
    } catch (e: unknown) {
      setError(formatErrorMessage(e, 'Failed to save times'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-clock-times-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !saving) onClose()
        }}
        style={{
          background: 'white',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 420,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h2 id="adjust-clock-times-title" style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: 600 }}>
          Adjust times
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
          {isOpenSession
            ? 'Change clock-in, or set clock-out to close the session. Focus notes and job links are unchanged.'
            : 'Change clock-in and clock-out. Focus notes and job links are unchanged.'}
        </p>
        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
            Clock in
          </span>
          <input
            type="datetime-local"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', width: '100%', maxWidth: 300 }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
            Clock out{isOpenSession ? ' (optional while still open)' : ''}
          </span>
          <input
            type="datetime-local"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', width: '100%', maxWidth: 300 }}
          />
        </label>
        {error ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#b91c1c' }} role="alert">
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: 'white',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            style={{
              padding: '0.45rem 0.85rem',
              border: 'none',
              borderRadius: 4,
              background: '#3b82f6',
              color: 'white',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
