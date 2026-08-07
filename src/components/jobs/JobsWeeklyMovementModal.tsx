import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { addDaysYmd } from '../../lib/emailSchedule/emailScheduleWeek'
import { chicagoYmdOf } from '../../lib/gcStatementStandingCopies'
import { salaryZonedWallClockToUtcMs } from '../../lib/salaryZonedWallClock'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import {
  cancelWeeklyMovementSend,
  listMyPendingWeeklyMovementSends,
  scheduleWeeklyMovementSend,
  type PendingWeeklyMovementSend,
} from '../../lib/weeklyMovementEmailRequests'
import {
  buildWeeklyMovement,
  buildWeeklyMovementReportHtml,
  mondayOfWeekYmd,
  weekLabel,
  type JobStatusEventLite,
  type WeeklyJobLite,
  type WeeklyMovementData,
} from '../../lib/jobs/stagesWeeklyMovement'

/**
 * Weekly movement (v2.1436): every job that entered a stage in a chosen
 * Mon–Sun Central week, from job_status_events (complete since the v2.1435
 * single-writer trigger). Opened from the Pipeline group of the stage strip's
 * Section tools menu, or the ?stagesWeekly= deep link. Self-fetching — the
 * board's jobs cache omits Paid, so this modal loads its own job rows.
 */

type JobsWeeklyMovementModalProps = {
  open: boolean
  onClose: () => void
  users: Array<{ id: string; name: string; email?: string | null; role?: string }>
  showToast: (msg: string, kind: 'success' | 'error') => void
  /** Scheduling is for the sender cohort (dev / master_technician / assistant-like — mirrors RLS). */
  canSchedule: boolean
}

export function JobsWeeklyMovementModal({ open, onClose, users, showToast, canSchedule }: JobsWeeklyMovementModalProps) {
  const { user: authUser } = useAuth()
  const [mondayYmd, setMondayYmd] = useState(() => mondayOfWeekYmd(chicagoYmdOf(new Date())))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<WeeklyMovementData | null>(null)
  /** Share section (v2.1438): scheduled sends of the previous-complete-week report. */
  const [shareRecipientId, setShareRecipientId] = useState('')
  const [shareDate, setShareDate] = useState(() => addDaysYmd(mondayOfWeekYmd(chicagoYmdOf(new Date())), 7))
  const [shareTime, setShareTime] = useState('07:00')
  const [shareWeekly, setShareWeekly] = useState(true)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [pendingSends, setPendingSends] = useState<PendingWeeklyMovementSend[]>([])
  useEffect(() => {
    if (!open || !canSchedule) return
    let cancelled = false
    void listMyPendingWeeklyMovementSends().then(
      (rows) => {
        if (!cancelled) setPendingSends(rows)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [open, canSchedule])
  const refreshPending = () => {
    void listMyPendingWeeklyMovementSends().then(setPendingSends, () => {})
  }
  const pickableRecipients = users
    .filter((u) => ['dev', 'master_technician', 'assistant', 'controller', 'primary'].includes(u.role ?? '') && (u.email ?? '').includes('@'))
    .sort((a, b) => a.name.localeCompare(b.name))
  const recipientName = (id: string) => users.find((u) => u.id === id)?.name ?? '—'
  const submitShare = () => {
    const hm = /^(\d{1,2}):(\d{2})$/.exec(shareTime.trim())
    if (!shareRecipientId || !/^\d{4}-\d{2}-\d{2}$/.test(shareDate) || !hm) {
      setShareError('Pick a person, date, and time.')
      return
    }
    const ms = salaryZonedWallClockToUtcMs(shareDate, Number(hm[1]), Number(hm[2]), 0, APP_CALENDAR_TZ)
    if (ms == null || ms <= Date.now()) {
      setShareError('Pick a time in the future (Central).')
      return
    }
    setShareBusy(true)
    setShareError(null)
    void scheduleWeeklyMovementSend({
      requestedBy: authUser?.id ?? '',
      recipientUserId: shareRecipientId,
      sendAtIso: new Date(ms).toISOString(),
      repeatWeekly: shareWeekly,
    }).then(
      () => {
        setShareBusy(false)
        setShareRecipientId('')
        refreshPending()
      },
      (e: unknown) => {
        setShareBusy(false)
        setShareError(e instanceof Error ? e.message : 'Could not schedule — try again.')
      },
    )
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const startMs = salaryZonedWallClockToUtcMs(mondayYmd, 0, 0, 0, APP_CALENDAR_TZ)
    const endMs = salaryZonedWallClockToUtcMs(addDaysYmd(mondayYmd, 7), 0, 0, 0, APP_CALENDAR_TZ)
    if (startMs == null || endMs == null) return
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const events = await withSupabaseRetry(
          () =>
            supabase
              .from('job_status_events')
              .select('id, job_id, from_status, to_status, changed_at, changed_by_user_id')
              .gte('changed_at', new Date(startMs).toISOString())
              .lt('changed_at', new Date(endMs).toISOString())
              .order('changed_at', { ascending: true }),
          'load weekly job status events',
        )
        const eventRows = (events ?? []) as JobStatusEventLite[]
        const jobIds = [...new Set(eventRows.map((e) => e.job_id))]
        let jobRows: WeeklyJobLite[] = []
        if (jobIds.length > 0) {
          const jobs = await withSupabaseRetry(
            () =>
              supabase
                .from('jobs_ledger')
                .select('id, hcp_number, click_number, job_name, job_address, revenue')
                .in('id', jobIds),
            'load weekly movement jobs',
          )
          jobRows = (jobs ?? []) as WeeklyJobLite[]
        }
        if (!cancelled) {
          setData(buildWeeklyMovement(eventRows, jobRows, users))
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatErrorMessage(e))
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, mondayYmd, users])

  if (!open) return null
  const label = weekLabel(mondayYmd)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Weekly movement — jobs that entered a stage this week"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.25rem 1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 640,
          width: 'calc(100vw - 2rem)',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 2 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0 }}>Weekly movement</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Every job that entered a stage this week, with who moved it and when.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setMondayYmd((m) => addDaysYmd(m, -7))}
            aria-label="Previous week"
            style={{ padding: '0.2rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
          >
            ‹
          </button>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Week of {label}</span>
          <button
            type="button"
            onClick={() => setMondayYmd((m) => addDaysYmd(m, 7))}
            aria-label="Next week"
            style={{ padding: '0.2rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
          >
            ›
          </button>
          {data ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {data.moveCount} move{data.moveCount === 1 ? '' : 's'} · {data.jobCount} job{data.jobCount === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            disabled={!data || data.moveCount === 0}
            onClick={() => {
              if (!data) return
              if (!openHtmlPrintWindow(buildWeeklyMovementReportHtml(data, label))) {
                showToast('Allow pop-ups to print the report.', 'error')
              }
            }}
            title="Print this week's movement (choose Save as PDF to download)"
            style={{ padding: '0.25rem 0.7rem', fontSize: '0.8125rem', fontWeight: 500, border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
          >
            <span aria-hidden>🖨</span> Print
          </button>
        </div>
        {canSchedule ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.75rem', marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 0.15rem', fontSize: '0.8125rem', fontWeight: 600 }}>Email this report</p>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Each send covers the previous complete week (a Monday 7 AM email reports last Mon–Sun), rebuilt fresh at
              send time.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <select
                value={shareRecipientId}
                onChange={(e) => setShareRecipientId(e.target.value)}
                disabled={shareBusy}
                aria-label="Send to"
                style={{ flex: 1, minWidth: 140, padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
              >
                <option value="">Send to…</option>
                {pickableRecipients.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {(u.role ?? '').replace('_', ' ')}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={shareDate}
                onChange={(e) => setShareDate(e.target.value)}
                disabled={shareBusy}
                aria-label="First send date"
                style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
              />
              <input
                type="time"
                value={shareTime}
                onChange={(e) => setShareTime(e.target.value)}
                disabled={shareBusy}
                aria-label="Send time (Central)"
                style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
              />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={shareWeekly} onChange={() => setShareWeekly((w) => !w)} disabled={shareBusy} style={{ margin: 0 }} />
                Repeat weekly
              </label>
              <button
                type="button"
                onClick={submitShare}
                disabled={shareBusy || !shareRecipientId}
                style={{ marginLeft: 'auto', padding: '0.25rem 0.7rem', fontSize: '0.8125rem', fontWeight: 500, border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', cursor: shareBusy ? 'wait' : 'pointer' }}
              >
                {shareBusy ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
            {shareError ? (
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{shareError}</p>
            ) : null}
            {pendingSends.length > 0 ? (
              <div style={{ marginTop: '0.5rem' }}>
                {pendingSends.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0' }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      → {recipientName(r.recipient_user_id)}
                    </span>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(r.send_at).toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      {r.repeat_weekly ? ' · weekly' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void cancelWeeklyMovementSend(r.id).then(refreshPending, refreshPending)
                      }}
                      title="Cancel this scheduled send (ends a weekly chain)"
                      style={{ padding: '0.05rem 0.45rem', fontSize: '0.6875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {loading ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }} role="status">
            Loading the week…
          </p>
        ) : error ? (
          <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</p>
        ) : data && data.moveCount === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No stage moves this week.</p>
        ) : data ? (
          <>
            {data.sections.map((s) => (
              <div key={s.toStatus} style={{ marginBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.25rem', padding: '0.3rem 0.5rem', background: 'var(--bg-subtle)', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600 }}>
                  Moved to {s.label}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                    {' '}· {s.jobCount} job{s.jobCount === 1 ? '' : 's'} · ${formatCurrency(s.total)}
                  </span>
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <tbody>
                    {s.entries.map((e) => (
                      <tr key={e.eventId} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.25rem 0.4rem' }}>
                          {e.display}
                          {e.address ? (
                            <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-faint)' }}>{e.address}</span>
                          ) : null}
                        </td>
                        <td style={{ padding: '0.25rem 0.4rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', width: 46 }}>{e.weekday}</td>
                        <td style={{ padding: '0.25rem 0.4rem', color: 'var(--text-muted)', width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.moverName}</td>
                        <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', width: 90 }}>${formatCurrency(e.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {data.sendBacks.length > 0 ? (
              <div style={{ marginBottom: '0.5rem' }}>
                <p style={{ margin: '0 0 0.25rem', padding: '0.3rem 0.5rem', background: 'var(--bg-subtle)', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600 }}>
                  Sent back
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {data.sendBacks.length} move{data.sendBacks.length === 1 ? '' : 's'}</span>
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <tbody>
                    {data.sendBacks.map((e) => (
                      <tr key={e.eventId} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.25rem 0.4rem' }}>{e.display}</td>
                        <td style={{ padding: '0.25rem 0.4rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {e.weekday} · {e.fromLabel} → {e.toLabel}
                        </td>
                        <td style={{ padding: '0.25rem 0.4rem', color: 'var(--text-muted)', textAlign: 'right', width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.moverName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
