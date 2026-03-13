import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

type OpenSession = {
  id: string
  clocked_in_at: string
}

type TodaySession = {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
}

function computeTotalSecondsToday(sessions: TodaySession[]): number {
  const now = Date.now()
  return sessions.reduce((sum, s) => {
    const inMs = new Date(s.clocked_in_at).getTime()
    const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : now
    return sum + Math.floor((outMs - inMs) / 1000)
  }, 0)
}

type Props = {
  userId: string
  userName: string | null
}

export default function ClockInOutButton({ userId, userName }: Props) {
  const [openSession, setOpenSession] = useState<OpenSession | null>(null)
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [totalSecondsToday, setTotalSecondsToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clockInModalOpen, setClockInModalOpen] = useState(false)
  const [clockInNotes, setClockInNotes] = useState('')
  const [clockInError, setClockInError] = useState<string | null>(null)
  const clockInNotesRef = useRef<HTMLTextAreaElement>(null)

  const fetchSessions = useCallback(async () => {
    if (!userId) return
    const today = toLocalDateString(new Date())
    const { data, error: err } = await supabase
      .from('clock_sessions')
      .select('id, clocked_in_at, clocked_out_at')
      .eq('user_id', userId)
      .eq('work_date', today)
    if (err) {
      setError(err.message)
      setOpenSession(null)
      setTodaySessions([])
      return
    }
    setError(null)
    const sessions = (data ?? []) as TodaySession[]
    setTodaySessions(sessions)
    const open = sessions.find((s) => !s.clocked_out_at)
    setOpenSession(open ? { id: open.id, clocked_in_at: open.clocked_in_at } : null)
    if (sessions.length > 0) {
      setTotalSecondsToday(computeTotalSecondsToday(sessions))
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchSessions().finally(() => setLoading(false))
  }, [userId, fetchSessions])

  useEffect(() => {
    if (!openSession || todaySessions.length === 0) return
    const interval = setInterval(() => {
      setTotalSecondsToday(computeTotalSecondsToday(todaySessions))
    }, 1000)
    return () => clearInterval(interval)
  }, [openSession, todaySessions])

  useEffect(() => {
    if (clockInModalOpen) {
      setClockInNotes('')
      setClockInError(null)
    }
  }, [clockInModalOpen])

  useEffect(() => {
    if (clockInModalOpen) {
      const id = setTimeout(() => clockInNotesRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [clockInModalOpen])

  useEffect(() => {
    if (clockInModalOpen) {
      const scrollY = window.scrollY
      const prevOverflow = document.body.style.overflow
      const prevPosition = document.body.style.position
      const prevTop = document.body.style.top
      const prevLeft = document.body.style.left
      const prevRight = document.body.style.right

      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'

      return () => {
        document.body.style.overflow = prevOverflow
        document.body.style.position = prevPosition
        document.body.style.top = prevTop
        document.body.style.left = prevLeft
        document.body.style.right = prevRight
        window.scrollTo(0, scrollY)
      }
    }
  }, [clockInModalOpen])

  function handleOpenClockInModal() {
    if (!userId || !userName?.trim() || openSession) return
    setClockInModalOpen(true)
  }

  async function handleCompleteClockIn() {
    if (!userId || !userName?.trim() || !clockInNotes.trim()) return
    setActionLoading(true)
    setClockInError(null)
    try {
      const now = new Date()
      const { error: err } = await supabase.from('clock_sessions').insert({
        user_id: userId,
        clocked_in_at: now.toISOString(),
        work_date: toLocalDateString(now),
        notes: clockInNotes.trim(),
      })
      if (err) throw err
      setClockInModalOpen(false)
      await fetchSessions()
    } catch (e) {
      setClockInError(e instanceof Error ? e.message : 'Failed to clock in')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleClockOut() {
    if (!openSession) return
    setActionLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('clock_sessions')
        .update({ clocked_out_at: new Date().toISOString() })
        .eq('id', openSession.id)
      if (err) throw err
      setOpenSession(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clock out')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '0.5rem 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
        Loading…
      </div>
    )
  }

  const canClockIn = userName?.trim() && !openSession
  const hasOpenSession = !!openSession

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%' }}>
      {hasOpenSession ? (
        <button
          type="button"
          onClick={handleClockOut}
          disabled={actionLoading}
          title="Clock out"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            fontWeight: 600,
            border: '2px solid #dc2626',
            borderRadius: 8,
            background: '#fef2f2',
            color: '#dc2626',
            cursor: actionLoading ? 'not-allowed' : 'pointer',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatElapsed(totalSecondsToday)} — Clock Out
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpenClockInModal}
          disabled={!canClockIn || actionLoading}
          title={!userName?.trim() ? 'Set your name in Settings to clock in' : 'Clock in'}
          style={{
            width: '100%',
            padding: '0 1.5rem',
            minHeight: 48,
            height: 48,
            boxSizing: 'border-box',
            fontSize: '1.125rem',
            fontWeight: 600,
            border: '2px solid #ff6600',
            borderRadius: 8,
            background: canClockIn ? '#ff6600' : '#f3f4f6',
            color: canClockIn ? 'white' : '#9ca3af',
            cursor: canClockIn && !actionLoading ? 'pointer' : 'not-allowed',
          }}
        >
          Clock In
        </button>
      )}
      {error && (
        <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>{error}</span>
      )}
      {clockInModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clock-in-modal-title"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => !actionLoading && setClockInModalOpen(false)}
        >
          <div
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="clock-in-modal-title" style={{ marginTop: 0, marginBottom: '1rem', textAlign: 'center' }}>Complete Clock In</h3>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>What are you working on today?</span>
              <textarea
                ref={clockInNotesRef}
                value={clockInNotes}
                onChange={(e) => setClockInNotes(e.target.value)}
                placeholder="e.g. Rough-in at 123 Main St"
                rows={3}
                disabled={actionLoading}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </label>
            {clockInError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>{clockInError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => !actionLoading && setClockInModalOpen(false)}
                disabled={actionLoading}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteClockIn}
                disabled={!clockInNotes.trim() || actionLoading}
                style={{ padding: '0.5rem 1rem', border: '1px solid #3b82f6', borderRadius: 4, background: '#3b82f6', color: 'white', cursor: clockInNotes.trim() && !actionLoading ? 'pointer' : 'not-allowed' }}
              >
                {actionLoading ? 'Clocking in…' : 'Complete Clock In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
