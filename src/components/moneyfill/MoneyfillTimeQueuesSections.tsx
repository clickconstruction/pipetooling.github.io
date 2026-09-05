import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { approveClockSessions } from '../../lib/approveClockSessions'
import { recordHoursApproved } from '../../lib/hoursApprovedTelemetry'
import { formatPayWeekLabel } from '../../lib/payWeekAnchor'
import { useAuth } from '../../hooks/useAuth'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  fetchPendingApprovalForWeek,
  fetchUnassignedTimeForWeek,
  pendingApprovalPayWeek,
  type PendingApprovalSessionRow,
  type UnassignedTimeWeekData,
} from '../../lib/moneyfillWeekClose'

/**
 * Moneyfill clock-time queues (v2.1446 — WEEKLY_MONEY_PLAN.md Phase 3,
 * queues 3c + 3d): approved time no job absorbs (at wage) and closed sessions
 * still pending approval. Fix surfaces stay canonical — the day audit and
 * pending lists live on People → Hours; Approve here reuses the same
 * approve_clock_sessions RPC path as the Dashboard strip.
 */

const th = (right = false): React.CSSProperties => ({
  textAlign: right ? 'right' : 'left',
  fontSize: '0.625rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontWeight: 600,
  padding: '0.2rem 0.5rem',
  borderBottom: '1px solid var(--border)',
})
const td = (right = false): React.CSSProperties => ({
  padding: '0.4rem 0.5rem',
  textAlign: right ? 'right' : 'left',
  fontVariantNumeric: 'tabular-nums',
})
const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '1rem 1.25rem',
  marginBottom: '1rem',
}
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dayLabel = (ymd: string) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export function MoneyfillUnassignedTimeSection({ weekMonday }: { weekMonday: string }) {
  const navigate = useNavigate()
  const [data, setData] = useState<UnassignedTimeWeekData | null | 'loading'>('loading')

  useEffect(() => {
    let cancelled = false
    setData('loading')
    void fetchUnassignedTimeForWeek(weekMonday).then((d) => {
      if (!cancelled) setData(d)
    })
    return () => {
      cancelled = true
    }
  }, [weekMonday])

  return (
    <section aria-label="Approved time with no job" style={sectionStyle}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>Approved time with no job</h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Field hours the org paid for this week that no job can absorb — same math as Quickfill’s Unassigned field time,
        shown as dollars.{' '}
        {data !== 'loading' && data != null ? (
          <b style={{ color: 'var(--text-700)' }}>
            {data.totalUnallocatedHours.toFixed(1)} h · {money(data.totalAtWage)}
          </b>
        ) : null}
      </p>
      {data === 'loading' ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
      ) : data == null ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Couldn’t load clock data for this queue.</div>
      ) : data.rows.length === 0 ? (
        <div style={{ color: '#15803d', fontSize: '0.875rem', fontWeight: 600 }}>✓ All clear for this week</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={th()}>Person</th>
                <th style={th()}>Day</th>
                <th style={th(true)}>Day hrs</th>
                <th style={th(true)}>Overhead</th>
                <th style={th(true)}>Unassigned</th>
                <th style={th(true)}>At wage</th>
                <th style={th(true)} />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const wage = data.wageByPersonName[r.personName]
                return (
                  <tr key={`${r.personName}|${r.workDate}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={td()}>{r.personName}</td>
                    <td style={{ ...td(), color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{dayLabel(r.workDate)}</td>
                    <td style={td(true)}>{r.dayHoursRaw.toFixed(1)}</td>
                    <td style={{ ...td(true), color: 'var(--text-muted)' }}>{r.overheadOnDay.toFixed(1)}</td>
                    <td style={{ ...td(true), fontWeight: 700, color: 'var(--text-red-700)' }}>{r.unallocatedHrs.toFixed(1)} h</td>
                    <td style={{ ...td(true), fontWeight: 650 }}>{wage != null ? money(r.unallocatedHrs * wage) : '—'}</td>
                    <td style={td(true)}>
                      <button
                        type="button"
                        onClick={() => navigate('/people?tab=hours')}
                        title="Open People → Hours to audit and assign this day"
                        style={{ padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-blue-500)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Open day audit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function MoneyfillPendingApprovalSection({
  weekMonday,
  onChanged,
}: {
  weekMonday: string
  onChanged?: () => void
}) {
  const navigate = useNavigate()
  const { user: authUser, role } = useAuth()
  const [rows, setRows] = useState<PendingApprovalSessionRow[] | null | 'loading'>('loading')
  const [approvingIds, setApprovingIds] = useState<ReadonlySet<string>>(new Set())
  /** Sun–Sat pay week ending inside the Mon–Sun close week — the window Draft Payroll opens to (Tier-1 #15). */
  const payWeekLabel = formatPayWeekLabel(pendingApprovalPayWeek(weekMonday))

  const load = useCallback(() => {
    setRows('loading')
    void fetchPendingApprovalForWeek(weekMonday).then(setRows)
  }, [weekMonday])
  useEffect(() => {
    load()
  }, [load])

  const approve = async (id: string) => {
    setApprovingIds((prev) => new Set([...prev, id]))
    const res = await approveClockSessions([id])
    setApprovingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (!res.error) {
      recordHoursApproved(authUser?.id, role, 'moneyfill-queue', res.data?.[0]?.approved_count ?? 1)
      load()
      onChanged?.()
    }
  }

  const dollars = rows !== 'loading' && rows != null ? rows.reduce((s, r) => s + (r.atWage ?? 0), 0) : 0
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' })

  return (
    <section aria-label="Sessions pending approval" style={sectionStyle}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.25rem' }}>Sessions pending approval</h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Closed clock sessions in the <b style={{ color: 'var(--text-700)' }}>Sun–Sat pay week {payWeekLabel}</b> nobody has approved —
        labor cost that isn’t booked to any job yet. Same week as Draft Payroll; the other queues here keep the Mon–Sun close week.{' '}
        {rows !== 'loading' && rows != null ? (
          <b style={{ color: 'var(--text-700)' }}>
            {rows.length} session{rows.length === 1 ? '' : 's'} · {money(dollars)} at wage
          </b>
        ) : null}
      </p>
      {rows === 'loading' ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
      ) : rows == null ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Couldn’t load pending sessions.</div>
      ) : rows.length === 0 ? (
        <div style={{ color: '#15803d', fontSize: '0.875rem', fontWeight: 600 }}>✓ All clear for pay week {payWeekLabel}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={th()}>Person</th>
                <th style={th()}>Day</th>
                <th style={th()}>Span</th>
                <th style={th(true)}>Hours</th>
                <th style={th(true)}>At wage</th>
                <th style={th(true)} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td()}>
                    {r.personName}
                    {r.jobOrBid == null ? (
                      <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-faint)' }}>no job or bid</span>
                    ) : null}
                  </td>
                  <td style={{ ...td(), color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{dayLabel(r.workDate)}</td>
                  <td style={{ ...td(), color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {fmtTime(r.clockedInAt)} – {fmtTime(r.clockedOutAt)}
                  </td>
                  <td style={td(true)}>{r.hours.toFixed(1)}</td>
                  <td style={{ ...td(true), fontWeight: 650 }}>{r.atWage != null ? money(r.atWage) : '—'}</td>
                  <td style={{ ...td(true), whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      disabled={approvingIds.has(r.id)}
                      onClick={() => void approve(r.id)}
                      title="Approve this session (same approve_clock_sessions path as People → Hours)"
                      style={{ padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, border: 'none', borderRadius: 5, background: '#3b82f6', color: 'white', cursor: approvingIds.has(r.id) ? 'wait' : 'pointer', marginRight: 6 }}
                    >
                      {approvingIds.has(r.id) ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/people?tab=hours')}
                      title="Review, reject, or edit in People → Hours"
                      style={{ padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
