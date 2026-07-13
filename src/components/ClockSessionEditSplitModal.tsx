import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { splitOwnClockSessionSegments } from '../lib/splitOwnClockSessionSegments'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { fromDatetimeLocal, toDatetimeLocal } from '../utils/datetimeLocal'
import { SearchableSelect } from './SearchableSelect'

export type ClockSessionEditSplitSession = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string | null
  job_ledger_id: string | null
  bid_id: string | null
  approved_at?: string | null
}

export type ClockSessionEditSplitModalEditProps = {
  session: ClockSessionEditSplitSession
  onClose: () => void
  onSaved?: () => void
  showToast?: (message: string, variant?: 'success' | 'error') => void
  zIndex?: number
}

export type ClockSessionEditSplitModalCreateProps = {
  createFor: { userId: string; workDate: string }
  /**
   * When provided, the create modal shows a person picker (the user chooses who the
   * session is for). Options are `{ value: user_id, label: name }`. When omitted, the
   * session is created for `createFor.userId` (existing day-audit behavior).
   */
  people?: { value: string; label: string }[]
  onClose: () => void
  onSaved?: () => void
  showToast?: (message: string, variant?: 'success' | 'error') => void
  zIndex?: number
}

export type ClockSessionEditSplitModalProps = ClockSessionEditSplitModalEditProps | ClockSessionEditSplitModalCreateProps

function ClockSessionCreateModal({
  createFor,
  people,
  onClose,
  onSaved,
  showToast,
  zIndex = 1100,
}: ClockSessionEditSplitModalCreateProps) {
  const [clockIn, setClockIn] = useState(`${createFor.workDate}T08:00`)
  const [clockOut, setClockOut] = useState(`${createFor.workDate}T17:00`)
  const [notes, setNotes] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(createFor.userId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setClockIn(`${createFor.workDate}T08:00`)
    setClockOut(`${createFor.workDate}T17:00`)
    setNotes('')
    setSelectedUserId(createFor.userId)
    setError(null)
  }, [createFor.workDate, createFor.userId])

  function handleBackdropClose() {
    if (!saving) onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
      }}
      onClick={handleBackdropClose}
      role="presentation"
    >
      <div
        style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleBackdropClose()
        }}
        role="dialog"
        aria-modal
        aria-labelledby="clock-session-create-title"
      >
        <h3 id="clock-session-create-title" style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>
          Add clock session
        </h3>
        {error && <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {people ? (
            <div>
              <label htmlFor="clock-create-person" style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>
                Person
              </label>
              <SearchableSelect
                id="clock-create-person"
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={people}
                placeholder="Pick a person…"
                required
                disabled={saving}
                portalZIndex={zIndex + 1}
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="clock-create-in" style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>
              Clocked in
            </label>
            <input
              id="clock-create-in"
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              disabled={saving}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
          </div>
          <div>
            <label htmlFor="clock-create-out" style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>
              Clocked out
            </label>
            <input
              id="clock-create-out"
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              disabled={saving}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
          </div>
          <div>
            <label htmlFor="clock-create-notes" style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>
              What are you working on?
            </label>
            <textarea
              id="clock-create-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={saving}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              setError(null)
              if (!selectedUserId) {
                setError('Pick a person')
                return
              }
              const inVal = fromDatetimeLocal(clockIn)
              const outVal = fromDatetimeLocal(clockOut)
              if (!inVal || !outVal) {
                setError('Invalid date/time')
                return
              }
              if (!notes.trim()) {
                setError('Notes are required')
                return
              }
              if (clockIn.slice(0, 10) !== createFor.workDate || clockOut.slice(0, 10) !== createFor.workDate) {
                setError(`Clock in and out must fall on ${createFor.workDate} (this day).`)
                return
              }
              if (new Date(outVal) <= new Date(inVal)) {
                setError('Clocked out must be after clocked in')
                return
              }
              if (new Date(inVal) > new Date()) {
                setError('Clock-in cannot be in the future')
                return
              }
              if (new Date(outVal) > new Date()) {
                setError('Clock-out cannot be in the future')
                return
              }
              setSaving(true)
              try {
                await withSupabaseRetry(
                  async () => {
                    const { error: err } = await supabase.from('clock_sessions').insert({
                      user_id: selectedUserId,
                      clocked_in_at: inVal,
                      clocked_out_at: outVal,
                      work_date: createFor.workDate,
                      notes: notes.trim(),
                      job_ledger_id: null,
                      bid_id: null,
                    })
                    return { data: null, error: err }
                  },
                  'create clock session'
                )
                showToast?.('Clock session added', 'success')
                onSaved?.()
                onClose()
              } catch (e: unknown) {
                setError(formatErrorMessage(e))
              } finally {
                setSaving(false)
              }
            }}
            disabled={!selectedUserId || !notes.trim() || saving || !fromDatetimeLocal(clockIn) || !fromDatetimeLocal(clockOut)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #3b82f6',
              borderRadius: 4,
              background: '#3b82f6',
              color: 'white',
              cursor:
                selectedUserId && notes.trim() && !saving && fromDatetimeLocal(clockIn) && fromDatetimeLocal(clockOut)
                  ? 'pointer'
                  : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ClockSessionEditSplitModalEdit({ session, onClose, onSaved, showToast, zIndex = 1100 }: ClockSessionEditSplitModalEditProps) {
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [notes, setNotes] = useState('')
  const [splitMode, setSplitMode] = useState(false)
  const [splitAt, setSplitAt] = useState('')
  const [splitNotesSecond, setSplitNotesSecond] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editingOpen = session.clocked_out_at == null

  // Re-initialize the form only when a DIFFERENT session is opened — keyed on `session.id`,
  // not the `session` object. Call sites pass a fresh inline object literal every render, so
  // depending on `session` would re-run this on every parent re-render (e.g. a People→Hours
  // realtime refetch from approving sessions) and silently wipe the user's in-progress edits —
  // forcing them to enter the change twice before a Save would persist.
  useEffect(() => {
    setClockIn(toDatetimeLocal(session.clocked_in_at))
    setClockOut(session.clocked_out_at ? toDatetimeLocal(session.clocked_out_at) : '')
    setNotes(session.notes ?? '')
    setSplitMode(false)
    setSplitAt('')
    setSplitNotesSecond('')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  /**
   * Recompute people_hours for each affected day after an approved session's hours change, anchored
   * on a SURVIVING session of the same user — the edited row itself for an in-place edit, or one of
   * the new segments when a split deletes the approved original. Each RPC call resyncs the anchor's
   * own day plus the passed day, so {anchor's day} ∪ `days` is covered. Best-effort: the edit already
   * persisted, so a failed resync just leaves the grid on the prior total.
   */
  async function recomputeApprovedPeopleHoursDays(anchorSessionId: string, days: (string | null | undefined)[]) {
    const distinct = [...new Set(days.filter((d): d is string => !!d))]
    try {
      for (const d of distinct.length ? distinct : [undefined]) {
        await supabase.rpc('recompute_people_hours_after_session_edit', {
          p_session_id: anchorSessionId,
          p_old_work_date: d,
        })
      }
    } catch {
      // best-effort
    }
  }

  /**
   * Resync people_hours after an in-place time edit of an ALREADY-APPROVED session (its row survives).
   * people_hours is maintained incrementally (approve adds the duration, revoke/reject subtracts), so a
   * plain UPDATE never applies the delta and the People → Hours grid stays frozen at the old total.
   * Gated on `approved_at`: an unapproved edit can't make people_hours stale, and skipping it avoids
   * clobbering manually-entered hours. Pass the pre-edit work_date so a cross-day move resyncs both days.
   */
  async function resyncApprovedPeopleHours() {
    if (!session.approved_at) return
    await recomputeApprovedPeopleHoursDays(session.id, [session.work_date])
  }

  function handleBackdropClose() {
    if (!saving) onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
      }}
      onClick={handleBackdropClose}
      role="presentation"
    >
      <div
        style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleBackdropClose()
        }}
        role="dialog"
        aria-modal
      >
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>{splitMode ? 'Split clock session' : 'Edit clock session'}</h3>
        {error && <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Clocked in</label>
            <input
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              disabled={splitMode}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
          </div>
          {splitMode && (
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Split at</label>
              <input
                type="datetime-local"
                value={splitAt}
                onChange={(e) => setSplitAt(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
              {(() => {
                const inVal = fromDatetimeLocal(clockIn)
                const splitVal = fromDatetimeLocal(splitAt)
                if (!inVal || !splitVal) return null
                const inMs = new Date(inVal).getTime()
                const splitMs = new Date(splitVal).getTime()
                const hrs1 = (splitMs - inMs) / (1000 * 3600)
                if (editingOpen) {
                  const nowMs = Date.now()
                  const valid = splitMs > inMs && hrs1 >= 0.01 && splitMs <= nowMs
                  return (
                    <p style={{ marginTop: 4, fontSize: '0.8125rem', color: valid ? 'var(--text-muted)' : 'var(--text-red-600)' }}>
                      Part 1: {hrs1.toFixed(2)}h | Part 2: open (still clocked in)
                      {!valid && splitVal && ' — Split must be after clock-in, at least 0.01h for part 1, and not in the future'}
                    </p>
                  )
                }
                const outVal = fromDatetimeLocal(clockOut)
                if (!outVal) return null
                const outMs = new Date(outVal).getTime()
                const hrs2 = (outMs - splitMs) / (1000 * 3600)
                const valid = splitMs > inMs && splitMs < outMs && hrs1 >= 0.01 && hrs2 >= 0.01
                return (
                  <p style={{ marginTop: 4, fontSize: '0.8125rem', color: valid ? 'var(--text-muted)' : 'var(--text-red-600)' }}>
                    Part 1: {hrs1.toFixed(2)}h | Part 2: {hrs2.toFixed(2)}h
                    {!valid && splitVal && ' — Split time must be strictly between in and out, with at least 0.01h per part'}
                  </p>
                )
              })()}
            </div>
          )}
          {editingOpen ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {splitMode
                ? 'First segment ends at the split time; the remainder continues as an open session.'
                : 'Session is still open—only clock-in time and notes are editable; clock-out is unchanged.'}
            </p>
          ) : (
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Clocked out</label>
              <input
                type="datetime-local"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                disabled={splitMode}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
            </div>
          )}
          {splitMode ? (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>
                  What are you working on? (first part, through split)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  disabled={saving}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>
                  What are you working on? (second part, after split)
                  {editingOpen ? ' — still clocked in' : ''}
                </label>
                <textarea
                  value={splitNotesSecond}
                  onChange={(e) => setSplitNotesSecond(e.target.value)}
                  rows={3}
                  disabled={saving}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
            </>
          ) : (
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>What are you working on?</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={saving}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
            </div>
          )}
          {!splitMode && (
            <button
              type="button"
              onClick={() => {
                setSplitMode(true)
                setSplitNotesSecond(notes)
                const inVal = fromDatetimeLocal(clockIn)
                if (!inVal) return
                const inMs = new Date(inVal).getTime()
                if (editingOpen) {
                  const nowMs = Date.now()
                  let midMs = (inMs + nowMs) / 2
                  if (midMs <= inMs) midMs = inMs + 60_000
                  if (midMs > nowMs) midMs = nowMs
                  setSplitAt(toDatetimeLocal(new Date(midMs).toISOString()))
                } else {
                  const outVal = fromDatetimeLocal(clockOut)
                  if (outVal) {
                    const outMs = new Date(outVal).getTime()
                    const midMs = (inMs + outMs) / 2
                    setSplitAt(toDatetimeLocal(new Date(midMs).toISOString()))
                  }
                }
              }}
              style={{
                alignSelf: 'flex-start',
                padding: '0.25rem 0',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--text-blue-500)',
                textDecoration: 'underline',
              }}
            >
              Split session
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {splitMode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSplitMode(false)
                  setSplitNotesSecond('')
                }}
                disabled={saving}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Cancel split
              </button>
              <button
                type="button"
                onClick={async () => {
                  setError(null)
                  const splitVal = fromDatetimeLocal(splitAt)
                  const inVal = fromDatetimeLocal(clockIn)
                  if (!inVal || !splitVal) {
                    setError('Invalid date/time')
                    return
                  }
                  if (!notes.trim() || !splitNotesSecond.trim()) {
                    setError('Notes are required for both parts')
                    return
                  }
                  const inMs = new Date(inVal).getTime()
                  const splitMs = new Date(splitVal).getTime()
                  const hrs1 = (splitMs - inMs) / (1000 * 3600)

                  if (editingOpen) {
                    if (splitMs <= inMs) {
                      setError('Split time must be after clock in')
                      return
                    }
                    if (hrs1 < 0.01) {
                      setError('First part must be at least 0.01 hours (~36 seconds)')
                      return
                    }
                    if (splitMs > Date.now()) {
                      setError('Split time cannot be in the future')
                      return
                    }
                    setSaving(true)
                    try {
                      if (session.approved_at) {
                        const ok = window.confirm(
                          'This session was already approved. Saving will remove those hours from payroll until it is approved again. Continue?'
                        )
                        if (!ok) {
                          setSaving(false)
                          return
                        }
                      }
                      const { data: authData } = await supabase.auth.getSession()
                      const authUid = authData.session?.user?.id
                      const splitPayloads = [
                        {
                          clocked_in_at: inVal,
                          clocked_out_at: splitVal,
                          notes: notes.trim(),
                        },
                        {
                          clocked_in_at: splitVal,
                          clocked_out_at: null as string | null,
                          notes: splitNotesSecond.trim(),
                        },
                      ]
                      if (authUid === session.user_id) {
                        await splitOwnClockSessionSegments(session.id, splitPayloads)
                      } else {
                        const workDateA = clockIn.slice(0, 10)
                        const workDateB = splitAt.slice(0, 10)
                        await withSupabaseRetry(
                          async () => {
                            const { error: errU } = await supabase
                              .from('clock_sessions')
                              .update({
                                clocked_in_at: inVal,
                                clocked_out_at: splitVal,
                                work_date: workDateA,
                                notes: notes.trim(),
                              })
                              .eq('id', session.id)
                            if (errU) return { data: null, error: errU }
                            const { error: errI } = await supabase.from('clock_sessions').insert({
                              user_id: session.user_id,
                              clocked_in_at: splitVal,
                              clocked_out_at: null,
                              work_date: workDateB,
                              notes: splitNotesSecond.trim(),
                              job_ledger_id: session.job_ledger_id,
                              bid_id: session.bid_id,
                            })
                            return { data: null, error: errI }
                          },
                          'split open clock session'
                        )
                        // Original row survives (updated to a closed segment); resync its day(s).
                        await resyncApprovedPeopleHours()
                      }
                      showToast?.('Session split into closed segment and open continuation', 'success')
                      onSaved?.()
                      onClose()
                    } catch (e) {
                      setError(formatErrorMessage(e, 'Failed to split session'))
                    } finally {
                      setSaving(false)
                    }
                    return
                  }

                  const outVal = fromDatetimeLocal(clockOut)
                  if (!outVal) {
                    setError('Invalid date/time')
                    return
                  }
                  const outMs = new Date(outVal).getTime()
                  const hrs2 = (outMs - splitMs) / (1000 * 3600)
                  if (splitMs <= inMs || splitMs >= outMs) {
                    setError('Split time must be strictly between clock in and clock out')
                    return
                  }
                  if (hrs1 < 0.01 || hrs2 < 0.01) {
                    setError('Each part must be at least 0.01 hours (~36 seconds)')
                    return
                  }
                  setSaving(true)
                  try {
                    if (session.approved_at) {
                      const ok = window.confirm(
                        'This session was already approved. Saving will remove those hours from payroll until the new segments are approved again. Continue?'
                      )
                      if (!ok) {
                        setSaving(false)
                        return
                      }
                    }
                    const { data: authData } = await supabase.auth.getSession()
                    const authUid = authData.session?.user?.id
                    const splitPayloads = [
                      {
                        clocked_in_at: inVal,
                        clocked_out_at: splitVal,
                        notes: notes.trim(),
                      },
                      {
                        clocked_in_at: splitVal,
                        clocked_out_at: outVal,
                        notes: splitNotesSecond.trim(),
                      },
                    ]
                    if (authUid === session.user_id) {
                      await splitOwnClockSessionSegments(session.id, splitPayloads)
                    } else {
                      const workDateA = clockIn.slice(0, 10)
                      const workDateB = splitAt.slice(0, 10)
                      const firstNewId = await withSupabaseRetry<string | null>(
                        async () => {
                          const { data: ins1, error: err1 } = await supabase
                            .from('clock_sessions')
                            .insert({
                              user_id: session.user_id,
                              clocked_in_at: inVal,
                              clocked_out_at: splitVal,
                              work_date: workDateA,
                              notes: notes.trim(),
                              job_ledger_id: session.job_ledger_id,
                              bid_id: session.bid_id,
                            })
                            .select('id')
                            .single()
                          if (err1) return { data: null, error: err1 }
                          const { error: err2 } = await supabase.from('clock_sessions').insert({
                            user_id: session.user_id,
                            clocked_in_at: splitVal,
                            clocked_out_at: outVal,
                            work_date: workDateB,
                            notes: splitNotesSecond.trim(),
                            job_ledger_id: session.job_ledger_id,
                            bid_id: session.bid_id,
                          })
                          if (err2) return { data: null, error: err2 }
                          const { error: err3 } = await supabase.from('clock_sessions').delete().eq('id', session.id)
                          if (err3) return { data: null, error: err3 }
                          return { data: ins1?.id ?? null, error: null }
                        },
                        'split clock session'
                      )
                      // Approved original was deleted; the new segments are pending. Resync the
                      // affected day(s) off a surviving new segment so its hours come off the total.
                      if (session.approved_at && firstNewId) {
                        await recomputeApprovedPeopleHoursDays(firstNewId, [session.work_date, workDateA, workDateB])
                      }
                    }
                    showToast?.('Session split into 2 parts', 'success')
                    onSaved?.()
                    onClose()
                  } catch (e) {
                    setError(formatErrorMessage(e, 'Failed to split session'))
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={
                  !notes.trim() ||
                  !splitNotesSecond.trim() ||
                  saving ||
                  (editingOpen
                    ? (() => {
                        const iv = fromDatetimeLocal(clockIn)
                        const sv = fromDatetimeLocal(splitAt)
                        if (!iv || !sv) return true
                        const im = new Date(iv).getTime()
                        const sm = new Date(sv).getTime()
                        const h1 = (sm - im) / (1000 * 3600)
                        return sm <= im || h1 < 0.01 || sm > Date.now()
                      })()
                    : (() => {
                        const iv = fromDatetimeLocal(clockIn)
                        const ov = fromDatetimeLocal(clockOut)
                        const sv = fromDatetimeLocal(splitAt)
                        if (!iv || !ov || !sv) return true
                        const im = new Date(iv).getTime()
                        const om = new Date(ov).getTime()
                        const sm = new Date(sv).getTime()
                        const h1 = (sm - im) / (1000 * 3600)
                        const h2 = (om - sm) / (1000 * 3600)
                        return sm <= im || sm >= om || h1 < 0.01 || h2 < 0.01
                      })())
                }
                style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 4, background: '#3b82f6', color: 'white', cursor: 'pointer' }}
              >
                {saving ? 'Splitting…' : 'Split'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setError(null)
                  const inVal = fromDatetimeLocal(clockIn)
                  if (!inVal) {
                    setError('Invalid date/time')
                    return
                  }
                  if (!notes.trim()) {
                    setError('Notes are required')
                    return
                  }
                  if (editingOpen) {
                    if (new Date(inVal) > new Date()) {
                      setError('Clock-in cannot be in the future')
                      return
                    }
                    setSaving(true)
                    const workDate = clockIn.slice(0, 10)
                    try {
                      const { error: err } = await supabase
                        .from('clock_sessions')
                        .update({
                          clocked_in_at: inVal,
                          work_date: workDate,
                          notes: notes.trim(),
                        })
                        .eq('id', session.id)
                      if (err) {
                        setError(err.message)
                        return
                      }
                      await resyncApprovedPeopleHours()
                      onSaved?.()
                      onClose()
                    } finally {
                      setSaving(false)
                    }
                    return
                  }
                  const outVal = fromDatetimeLocal(clockOut)
                  if (!outVal) {
                    setError('Invalid date/time')
                    return
                  }
                  if (new Date(outVal) <= new Date(inVal)) {
                    setError('Clocked out must be after clocked in')
                    return
                  }
                  setSaving(true)
                  const workDate = clockIn.slice(0, 10)
                  try {
                    const { error: err } = await supabase
                      .from('clock_sessions')
                      .update({
                        clocked_in_at: inVal,
                        clocked_out_at: outVal,
                        work_date: workDate,
                        notes: notes.trim(),
                      })
                      .eq('id', session.id)
                    if (err) {
                      setError(err.message)
                      return
                    }
                    await resyncApprovedPeopleHours()
                    onSaved?.()
                    onClose()
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={
                  !notes.trim() ||
                  saving ||
                  (editingOpen ? !fromDatetimeLocal(clockIn) : !fromDatetimeLocal(clockIn) || !fromDatetimeLocal(clockOut))
                }
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #3b82f6',
                  borderRadius: 4,
                  background: '#3b82f6',
                  color: 'white',
                  cursor:
                    notes.trim() &&
                    !saving &&
                    fromDatetimeLocal(clockIn) &&
                    (editingOpen || fromDatetimeLocal(clockOut))
                      ? 'pointer'
                      : 'not-allowed',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ClockSessionEditSplitModal(props: ClockSessionEditSplitModalProps) {
  if ('createFor' in props) {
    return <ClockSessionCreateModal {...props} />
  }
  return <ClockSessionEditSplitModalEdit {...props} />
}
