import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CLOCK_SESSION_LIST_SELECT } from '../lib/clockSessionSelect'
import { approveClockSessions } from '../lib/approveClockSessions'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import {
  AssignSessionJobPopover,
  ClockSessionsTable,
  formatClockSessionJobOrBidLabel,
} from './clock-sessions'
import type { ClockSessionRow } from '../types/clockSessions'

function weekStartEndEnCA(): { start: string; end: string } {
  const d = new Date()
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(d)
  end.setDate(d.getDate() - day + 6)
  return { start: start.toLocaleDateString('en-CA'), end: end.toLocaleDateString('en-CA') }
}

export default function DashboardMyTeamSection() {
  const { user: authUser } = useAuth()
  const [memberUserIds, setMemberUserIds] = useState<string[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [pendingSessions, setPendingSessions] = useState<ClockSessionRow[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myTeamExpanded, setMyTeamExpanded] = useState(true)
  const [{ start: dateStart, end: dateEnd }, setDateRange] = useState(weekStartEndEnCA)

  const loadAssignments = useCallback(async () => {
    if (!authUser?.id) {
      setMemberUserIds([])
      setLoadingMeta(false)
      return
    }
    setLoadingMeta(true)
    setError(null)
    try {
      const rows = await withSupabaseRetry(
        async () =>
          supabase
            .from('team_leader_assignments')
            .select('member_user_id')
            .eq('leader_user_id', authUser.id),
        'load team leader assignments',
      )
      const ids = [...new Set((rows ?? []).map((r) => (r as { member_user_id: string }).member_user_id))]
      setMemberUserIds(ids)
    } catch (e) {
      setError(formatErrorMessage(e))
      setMemberUserIds([])
    } finally {
      setLoadingMeta(false)
    }
  }, [authUser?.id])

  const loadPending = useCallback(async () => {
    if (!authUser?.id || memberUserIds.length === 0) {
      setPendingSessions([])
      return
    }
    setLoadingSessions(true)
    setError(null)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select(CLOCK_SESSION_LIST_SELECT)
            .in('user_id', memberUserIds)
            .is('approved_at', null)
            .is('rejected_at', null)
            .gte('work_date', dateStart)
            .lte('work_date', dateEnd)
            .order('work_date', { ascending: false })
            .order('clocked_in_at', { ascending: false }),
        'load team pending clock sessions',
      )
      setPendingSessions((data ?? []) as unknown as ClockSessionRow[])
    } catch (e) {
      setError(formatErrorMessage(e))
      setPendingSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }, [authUser?.id, memberUserIds, dateStart, dateEnd])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  function shiftWeek(delta: number) {
    const s = new Date(dateStart + 'T12:00:00')
    s.setDate(s.getDate() + delta * 7)
    const e = new Date(s)
    e.setDate(s.getDate() + 6)
    setDateRange({ start: s.toLocaleDateString('en-CA'), end: e.toLocaleDateString('en-CA') })
  }

  if (!authUser?.id || loadingMeta) {
    return null
  }
  if (memberUserIds.length === 0) {
    return null
  }

  return (
    <section style={{ marginTop: '2rem', marginBottom: '2rem' }}>
      <button
        type="button"
        onClick={() => setMyTeamExpanded((open) => !open)}
        aria-expanded={myTeamExpanded}
        aria-controls="dashboard-my-team-content"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          width: '100%',
          textAlign: 'left',
          fontSize: '1.125rem',
          fontWeight: 600,
          margin: 0,
          marginBottom: myTeamExpanded ? '0.75rem' : 0,
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        <span aria-hidden>{myTeamExpanded ? '▼' : '▶'}</span>
        <span>My Team</span>
        {!myTeamExpanded && (
          <span style={{ fontWeight: 500, color: '#6b7280', fontSize: '0.875rem' }}>
            {loadingSessions ? ' — …' : ` — ${pendingSessions.length} pending`}
          </span>
        )}
      </button>
      {myTeamExpanded && (
        <div id="dashboard-my-team-content">
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', marginTop: 0 }}>
            Pending clock sessions for people you lead. Approve or reject after they clock out. First approver wins; other leads see who approved.
          </p>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <label>
          <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
            style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </label>
        <label>
          <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
            style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </label>
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← last week
        </button>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          next week →
        </button>
      </div>
      {loadingSessions ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontWeight: 600, fontSize: '0.875rem' }}>
            Pending sessions ({pendingSessions.length})
          </div>
          <ClockSessionsTable
            sessions={pendingSessions}
            showActionsColumn
            locationVariant="full"
            emptyMessage="No pending sessions in this date range"
            renderNotesSecondary={(s) => {
              const label = formatClockSessionJobOrBidLabel(s)
              return label ? <span title={label}>{label}</span> : null
            }}
            renderJob={(s) => {
              const isActive = s.clocked_out_at == null
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', minWidth: 0 }}>
                  {!isActive && (
                    <span style={{ flexShrink: 0 }}>
                      <AssignSessionJobPopover
                        session={s}
                        onSaved={() => void loadPending()}
                        onError={(msg) => setError(msg)}
                      />
                    </span>
                  )}
                </div>
              )
            }}
            renderActions={(s) => {
              const personName = s.users?.name?.trim() ?? 'Unknown'
              const isActive = s.clocked_out_at == null
              return (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {isActive && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Force clock out ${personName}?`)) return
                        const now = new Date().toISOString()
                        try {
                          await withSupabaseRetry(
                            async () => supabase.from('clock_sessions').update({ clocked_out_at: now }).eq('id', s.id),
                            'force clock out',
                          )
                          await loadPending()
                        } catch (e) {
                          setError(formatErrorMessage(e))
                        }
                      }}
                      style={{
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #dc2626',
                        borderRadius: 4,
                        background: '#fef2f2',
                        color: '#dc2626',
                        cursor: 'pointer',
                      }}
                    >
                      Force clock out
                    </button>
                  )}
                  {!isActive && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          const { data, error: rpcErr } = await approveClockSessions([s.id])
                          if (rpcErr) {
                            setError(rpcErr.message)
                            return
                          }
                          const result = (data ?? []) as Array<{ approved_count: number; error_message: string | null }>
                          const row = result[0]
                          if (row?.error_message) {
                            setError(row.error_message)
                            return
                          }
                          await loadPending()
                        }}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.8125rem',
                          border: '1px solid #22c55e',
                          borderRadius: 4,
                          background: '#f0fdf4',
                          color: '#16a34a',
                          cursor: 'pointer',
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('Reject this clock session?')) return
                          try {
                            await withSupabaseRetry(
                              async () =>
                                supabase
                                  .from('clock_sessions')
                                  .update({ rejected_at: new Date().toISOString(), rejected_by: authUser?.id ?? null })
                                  .eq('id', s.id),
                              'reject clock session',
                            )
                            await loadPending()
                          } catch (e) {
                            setError(formatErrorMessage(e))
                          }
                        }}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.8125rem',
                          border: '1px solid #dc2626',
                          borderRadius: 4,
                          background: '#fef2f2',
                          color: '#dc2626',
                          cursor: 'pointer',
                        }}
                      >
                        Reject
                      </button>
                      <Link
                        to="/people?tab=hours"
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.8125rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: 'white',
                          color: '#374151',
                          cursor: 'pointer',
                          textDecoration: 'none',
                        }}
                      >
                        Edit
                      </Link>
                    </>
                  )}
                </div>
              )
            }}
          />
        </div>
      )}
        </div>
      )}
    </section>
  )
}
