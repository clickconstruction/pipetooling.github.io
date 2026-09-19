/**
 * Dashboard → My crew (Supervision, PR 3 — to-dos/supervision).
 *
 * For anyone who supervised a job-day this week — a master, or a helper / sub the office
 * has marked as able to run a job — three things, all read off the schedule and the
 * clock, nothing assigned: the reports owed for the job-days they supervised (one tap to
 * write), the reports filed, and the crew's hours read-only. No Approve: approval stays
 * with the office. Renders nothing for anyone else, or for a week with no supervised
 * job-day. Fed by `get_supervised_days_payload` (SECURITY DEFINER — the one narrow
 * window the supervision rule opens on a sub's or helper's sessions).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { formatWorkDateYmdWeekdayShortFriendly, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { dayBookRangeLabel, dayBookWeekOf } from '../../lib/people/dayBook'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { PersonNameDoor } from '../personDesk/PersonNameDoor'
import { buildSupervisedView, reportsSummary, type SupervisedDaysPayload } from '../../lib/people/supervisedDays'

type Props = {
  authUserId: string | null | undefined
  role: string | null
  /** The Dashboard's report door (`AdditionalReportModal`). */
  onLeaveReport: (job: { id: string; hcpNumber: string; jobName: string; jobAddress: string }) => void
}

const SUPERVISOR_ROLES = new Set(['master_technician', 'helpers', 'subcontractor'])

const navButtonStyle: React.CSSProperties = { font: 'inherit', fontSize: '0.8rem', border: 'none', background: 'transparent', color: 'var(--text-muted)', padding: '0.1rem 0.35rem', cursor: 'pointer' }
const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.8rem' }
const lineStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '0.3rem 0', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }

export default function DashboardSupervisorSection({ authUserId, role, onLeaveReport }: Props) {
  const eligible = !!authUserId && role != null && SUPERVISOR_ROLES.has(role)
  const today = useMemo(() => todayYmdInAppTz(), [])
  const prefixMap = useLedgerPrefixMap()
  const [range, setRange] = useState(() => dayBookWeekOf(today))
  const [payload, setPayload] = useState<SupervisedDaysPayload | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eligible) return
    setError(null)
    try {
      const data = await withSupabaseRetry(
        () => supabase.rpc('get_supervised_days_payload' as never, { p_from: range.from, p_to: range.to } as never),
        'get_supervised_days_payload',
      )
      setPayload((data as unknown as SupervisedDaysPayload | null) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPayload(null)
    } finally {
      setLoaded(true)
    }
  }, [eligible, range.from, range.to])

  useEffect(() => {
    void load()
  }, [load])

  const view = useMemo(() => buildSupervisedView(payload, { todayYmd: today, nowMs: Date.now(), prefixMap }), [payload, today, prefixMap])

  if (!eligible || !loaded || !view.supervisor) return null
  const thisWeek = dayBookWeekOf(today)
  const onThisWeek = range.from === thisWeek.from
  if (view.jobDays === 0 && onThisWeek && !error) return null

  const summary = reportsSummary(view)
  return (
    <section aria-label="My crew" style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>My crew</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>job-days you supervised · nothing here is assigned</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginLeft: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '0.1rem 0.3rem', fontSize: '0.8rem' }} role="group" aria-label="Week">
          <button type="button" style={navButtonStyle} onClick={() => setRange((r) => ({ from: ymdAddDays(r.from, -7), to: ymdAddDays(r.to, -7) }))} aria-label="Earlier week">
            ◀
          </button>
          <b style={{ whiteSpace: 'nowrap' }}>{dayBookRangeLabel(range.from, range.to)}</b>
          <button type="button" style={navButtonStyle} onClick={() => setRange((r) => ({ from: ymdAddDays(r.from, 7), to: ymdAddDays(r.to, 7) }))} aria-label="Later week">
            ▶
          </button>
          {!onThisWeek && (
            <button type="button" style={navButtonStyle} onClick={() => setRange(thisWeek)}>
              This week
            </button>
          )}
        </span>
      </div>
      {error && <p style={{ color: 'var(--text-red-600)', fontSize: '0.8125rem' }}>Could not load your crew — {error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.7rem', alignItems: 'start' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <b style={{ fontSize: '0.875rem' }}>Reports owed</b>
            <span style={{ fontSize: '0.72rem', color: view.reportsOwed.length > 0 ? 'var(--text-red-600)' : 'var(--text-muted)' }}>{summary ?? 'no job-days yet'}</span>
          </div>
          {view.reportsOwed.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {view.reportsFiled > 0 ? `Every job-day you supervised has a report — ${view.reportsFiled} filed.` : 'Nothing owed.'}
            </p>
          ) : (
            view.reportsOwed.map((r) => (
              <div key={`${r.jobId}:${r.workDate}`} style={lineStyle}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{r.label}</span>
                  <span style={{ color: 'var(--text-muted)' }}> · {formatWorkDateYmdWeekdayShortFriendly(r.workDate)}</span>
                  {r.crewNames.length > 0 && <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-faint)' }}>with {r.crewNames.join(', ')}</span>}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.72rem', color: r.isToday ? 'var(--text-amber-700)' : 'var(--text-red-600)', fontWeight: 600 }}>{r.isToday ? 'no report yet' : 'no report'}</span>
                  <button
                    type="button"
                    onClick={() => onLeaveReport({ id: r.jobId, hcpNumber: r.hcpNumber, jobName: r.jobName, jobAddress: r.address ?? '' })}
                    style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.6rem', borderRadius: 6, border: 'none', background: 'var(--text-blue-600)', color: 'white', cursor: 'pointer' }}
                  >
                    Write it
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <b style={{ fontSize: '0.875rem' }}>My crew's hours</b>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>read-only · approval stays with the office</span>
          </div>
          {view.crew.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nobody clocked on a job-day you supervised.</p>
          ) : (
            view.crew.map((p) => (
              <div key={p.userId} style={{ borderTop: '1px solid var(--border)', padding: '0.35rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <PersonNameDoor name={p.name} userId={p.userId} personId={null} style={{ fontWeight: 600, color: 'var(--text-link)' }} />
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{p.totalHours.toFixed(2)}h</b>
                </div>
                {p.days.map((d, i) => (
                  <div key={`${d.workDate}:${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '0.5rem' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatWorkDateYmdWeekdayShortFriendly(d.workDate)} · {d.jobLabel}
                      {d.notes ? <span style={{ color: 'var(--text-faint)' }}> · {d.notes}</span> : null}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {d.hours.toFixed(2)}h{d.open ? ' · in' : ''}{d.approved ? ' ✓' : ''}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
