import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { approveClockSessions } from '../../lib/approveClockSessions'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { shortJobOrBidLabelFromEmbeds } from '../../types/clockSessions'
import {
  groupUpcomingWeekSessions,
  upcomingSessionHours,
  type UpcomingWeekSessionRow,
} from '../../lib/upcomingPayrollSummary'

export type UpcomingWeekSessionsModalProps = {
  personName: string
  userId: string
  weekStartYmd: string
  weekEndYmd: string
  /** Pre-formatted period label (e.g. "6/28–7/4 (w27)") — formatter lives in the Payroll tab. */
  weekLabel: string
  authUserId: string | null
  zIndex: number
  onClose: () => void
  /** Day-header click → shared My Time editor (fence widened to this week by the parent). */
  onOpenDay: (dateStr: string) => void
  /** Approve/reject landed — parent refetches the upcoming summary data. */
  onSessionsMutated: () => void
}

function timeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function dayLabel(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00')
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * Session-level drilldown for one person's upcoming (not-yet-reported) pay week: every clock
 * session grouped by day with status badges, per-session Approve / two-click Reject, and a bulk
 * "Approve all" — approval writes people_hours (approve_clock_sessions RPC), which is what moves
 * these hours into Draft Payroll. Modeled on the clock strip / Hours pending-popover flows.
 */
export function UpcomingWeekSessionsModal({
  personName,
  userId,
  weekStartYmd,
  weekEndYmd,
  weekLabel,
  authUserId,
  zIndex,
  onClose,
  onOpenDay,
  onSessionsMutated,
}: UpcomingWeekSessionsModalProps) {
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()

  const [sessions, setSessions] = useState<UpcomingWeekSessionRow[] | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            await supabase
              .from('clock_sessions')
              .select(
                'id, work_date, clocked_in_at, clocked_out_at, notes, approved_at, jobs_ledger(hcp_number, click_number, job_name, job_address, service_type_id), bids(bid_number, project_name, address, service_type_id, customers(name))',
              )
              .eq('user_id', userId)
              .gte('work_date', weekStartYmd)
              .lte('work_date', weekEndYmd)
              .is('rejected_at', null)
              .is('revoked_at', null)
              .order('clocked_in_at'),
          'load upcoming week sessions',
        )
        if (!cancelled) {
          setSessions((data ?? []) as unknown as UpcomingWeekSessionRow[])
          setFetchError(null)
        }
      } catch (e) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : 'Failed to load sessions')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, weekStartYmd, weekEndYmd, reloadTick])

  // Two-click reject: confirm state auto-resets so a stray click can't linger armed.
  useEffect(() => {
    if (!rejectConfirmId) return
    const t = setTimeout(() => setRejectConfirmId(null), 2500)
    return () => clearTimeout(t)
  }, [rejectConfirmId])

  const grouped = useMemo(
    () => (sessions ? groupUpcomingWeekSessions(sessions, Date.now()) : null),
    [sessions],
  )

  function refreshAfterMutation() {
    setReloadTick((n) => n + 1)
    onSessionsMutated()
  }

  async function handleApprove(ids: string[], bulk: boolean) {
    if (ids.length === 0) return
    if (bulk) setBulkBusy(true)
    else setBusyIds((prev) => new Set(prev).add(ids[0] ?? ''))
    try {
      const { data, error } = await approveClockSessions(ids)
      const rpcError = error?.message ?? data?.[0]?.error_message ?? null
      if (rpcError) {
        showToast(rpcError, 'error')
        return
      }
      const n = data?.[0]?.approved_count ?? ids.length
      showToast(`Approved ${n} session${n === 1 ? '' : 's'}.`, 'success')
      refreshAfterMutation()
    } finally {
      if (bulk) setBulkBusy(false)
      else
        setBusyIds((prev) => {
          const next = new Set(prev)
          for (const id of ids) next.delete(id)
          return next
        })
    }
  }

  async function handleReject(sessionId: string) {
    if (rejectConfirmId !== sessionId) {
      setRejectConfirmId(sessionId)
      return
    }
    setRejectConfirmId(null)
    setBusyIds((prev) => new Set(prev).add(sessionId))
    try {
      const { error } = await supabase
        .from('clock_sessions')
        .update({ rejected_at: new Date().toISOString(), rejected_by: authUserId })
        .eq('id', sessionId)
      if (error) {
        showToast(error.message, 'error')
        return
      }
      showToast('Session rejected.', 'success')
      refreshAfterMutation()
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
    }
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
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
        aria-labelledby="upcoming-week-sessions-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 620,
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 id="upcoming-week-sessions-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
              {personName} — {weekLabel}
            </h3>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {grouped ? `${grouped.totalHours.toFixed(2)}h this week · ` : ''}
              click a day to open My Time.
            </p>
          </div>
          {grouped && grouped.pendingClosedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleApprove(grouped.pendingClosedIds, true)}
              disabled={bulkBusy}
              style={{
                padding: '0.4rem 0.9rem',
                background: bulkBusy ? '#9ca3af' : '#059669',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: bulkBusy ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {bulkBusy ? 'Approving…' : `Approve all (${grouped.pendingClosedIds.length})`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{ padding: '0.35rem 0.65rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
          {fetchError ? (
            <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{fetchError}</p>
          ) : !grouped ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading sessions…</p>
          ) : grouped.days.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No clocked sessions this week.</p>
          ) : (
            grouped.days.map((day) => (
              <div key={day.workDate} style={{ marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => onOpenDay(day.workDate)}
                  title="Open My Time for this day"
                  aria-label={`Open My Time for ${personName} on ${day.workDate}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    font: 'inherit',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'var(--text-link)',
                    textDecoration: 'underline dotted',
                    textUnderlineOffset: '2px',
                    cursor: 'pointer',
                  }}
                >
                  {dayLabel(day.workDate)} · {day.hours.toFixed(2)}h
                </button>
                <ul style={{ listStyle: 'none', margin: '0.35rem 0 0', padding: 0 }}>
                  {day.sessions.map((s) => {
                    const open = s.clocked_out_at === null
                    const approved = s.approved_at !== null
                    const pendingClosed = !open && !approved
                    const busy = busyIds.has(s.id)
                    const jobLabel = shortJobOrBidLabelFromEmbeds(
                      { jobs_ledger: s.jobs_ledger, bids: s.bids },
                      prefixMap,
                    )
                    const notes = (s.notes ?? '').trim()
                    return (
                      <li
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.3rem 0 0.3rem 0.75rem',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {timeShort(s.clocked_in_at)} – {s.clocked_out_at ? timeShort(s.clocked_out_at) : 'open'}
                        </span>
                        <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {upcomingSessionHours(s, Date.now()).toFixed(2)}h
                        </span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-700)',
                          }}
                          title={[jobLabel, notes].filter(Boolean).join(' — ')}
                        >
                          {jobLabel ?? (notes || '—')}
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '0.1rem 0.45rem',
                            borderRadius: 9999,
                            whiteSpace: 'nowrap',
                            ...(approved
                              ? { background: 'var(--bg-emerald-100)', color: 'var(--text-emerald-800)' }
                              : open
                                ? { background: 'var(--bg-muted)', color: 'var(--text-muted)' }
                                : { background: 'var(--bg-amber-100)', color: 'var(--text-amber-700)' }),
                          }}
                        >
                          {approved ? 'Approved' : open ? 'Open' : 'Pending'}
                        </span>
                        {pendingClosed ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleApprove([s.id], false)}
                              disabled={busy || bulkBusy}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.75rem',
                                background: busy || bulkBusy ? '#9ca3af' : '#059669',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: busy || bulkBusy ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {busy ? '…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReject(s.id)}
                              disabled={busy || bulkBusy}
                              title={rejectConfirmId === s.id ? 'Click again to confirm reject' : 'Reject this session'}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.75rem',
                                background: 'var(--surface)',
                                color: rejectConfirmId === s.id ? 'white' : 'var(--text-red-700)',
                                border: '1px solid #b91c1c',
                                ...(rejectConfirmId === s.id ? { background: '#b91c1c' } : {}),
                                borderRadius: 4,
                                cursor: busy || bulkBusy ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {rejectConfirmId === s.id ? 'Confirm reject' : 'Reject'}
                            </button>
                          </>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
