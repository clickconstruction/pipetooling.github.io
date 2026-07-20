import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'
import { formatClockSessionTimestampPartsChicago } from '../../lib/formatClockSessionTimestamp'
import {
  buildJobHistorySummary,
  buildJobHistoryWeeks,
  findJobOpenSessions,
  type JobHistorySessionRow,
  type JobHistoryWeek,
} from '../../lib/scheduleDispatchJobHistory'

/** Lean per-job history select — no GPS / approver joins, just times + names. */
const JOB_HISTORY_SELECT =
  'id, user_id, work_date, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at, notes, users!clock_sessions_user_id_fkey(name)'

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; rows: JobHistorySessionRow[] }

function weekRangeLabel(week: JobHistoryWeek): string {
  return `${formatWorkDateYmdMonthDayShort(week.weekStartYmd)} – ${formatWorkDateYmdMonthDayShort(week.weekEndYmd)}`
}

function sessionTime(iso: string): string {
  return formatClockSessionTimestampPartsChicago(iso)?.time ?? '—'
}

/**
 * "Work history" for the Dispatch per-job week view: every company week
 * (Sunday-start) this job saw approved work, newest first — who worked, hours
 * per person, week total — expandable down to the individual clock sessions.
 * Hours only (no wages), so it is safe for every role that can open Dispatch;
 * RLS trims what a viewer can't read. A live chip lists anyone currently
 * clocked in on the job.
 */
export function ScheduleDispatchJobWeekHistory({ jobId }: { jobId: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    setExpandedWeeks(new Set())
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            await supabase
              .from('clock_sessions')
              .select(JOB_HISTORY_SELECT)
              .eq('job_ledger_id', jobId)
              .order('work_date', { ascending: true }),
          'load dispatch job work history',
        )
        if (!cancelled) {
          setState({ kind: 'ready', rows: ((data ?? []) as unknown) as JobHistorySessionRow[] })
        }
      } catch {
        if (!cancelled) setState({ kind: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])

  const weeks = useMemo(() => (state.kind === 'ready' ? buildJobHistoryWeeks(state.rows) : []), [state])
  const summary = useMemo(() => buildJobHistorySummary(weeks), [weeks])
  const openSessions = useMemo(() => (state.kind === 'ready' ? findJobOpenSessions(state.rows) : []), [state])

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: '0.35rem 0.75rem',
    width: '100%',
  }

  return (
    <div style={{ margin: '1.5rem 0 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem 1rem', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-700)' }}>Work history</span>
        {state.kind === 'ready' && summary.weekCount > 0 ? (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDecimalWorkHoursToHhMm(summary.totalHours)} · {summary.peopleCount}{' '}
            {summary.peopleCount === 1 ? 'person' : 'people'}
            {summary.firstWorkDateYmd && summary.lastWorkDateYmd ? (
              <>
                {' · '}
                {formatWorkDateYmdMonthDayShort(summary.firstWorkDateYmd)} –{' '}
                {formatWorkDateYmdMonthDayShort(summary.lastWorkDateYmd)}
              </>
            ) : null}
          </span>
        ) : null}
        {openSessions.length > 0 ? (
          <span
            title={openSessions
              .map((o) => `${o.name} clocked in ${sessionTime(o.clockedInAt)}`)
              .join(' · ')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.1rem 0.5rem',
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'var(--bg-green-tint)',
              border: '1px solid #34d399',
              color: 'var(--text-green-800)',
            }}
          >
            <span
              aria-hidden
              style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }}
            />
            {openSessions.map((o) => o.name).join(', ')} on the job now
          </span>
        ) : null}
      </div>

      {state.kind === 'loading' ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>Loading work history…</p>
      ) : state.kind === 'error' ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>Could not load work history.</p>
      ) : weeks.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
          No approved clock sessions on this job yet.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
          {weeks.map((week, idx) => {
            const expanded = expandedWeeks.has(week.weekStartYmd)
            return (
              <div
                key={week.weekStartYmd}
                style={{ borderBottom: idx < weeks.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() =>
                    setExpandedWeeks((prev) => {
                      const next = new Set(prev)
                      if (next.has(week.weekStartYmd)) next.delete(week.weekStartYmd)
                      else next.add(week.weekStartYmd)
                      return next
                    })
                  }
                  style={{
                    ...rowStyle,
                    padding: '0.5rem 0.75rem',
                    background: expanded ? 'var(--bg-subtle)' : 'var(--surface)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                  }}
                >
                  <span aria-hidden style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', width: '0.85rem', flexShrink: 0 }}>
                    {expanded ? '▼' : '▶'}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>
                    {weekRangeLabel(week)}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', flex: '1 1 12rem', minWidth: 0 }}>
                    {week.people
                      .map((p) => `${p.name} ${formatDecimalWorkHoursToHhMm(p.hours)}`)
                      .join(' · ')}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      color: 'var(--text-strong)',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDecimalWorkHoursToHhMm(week.totalHours)}
                  </span>
                </button>
                {expanded ? (
                  <div style={{ padding: '0.25rem 0.75rem 0.6rem 1.85rem', background: 'var(--bg-subtle)' }}>
                    {week.people.map((person) => (
                      <div key={person.userId} style={{ marginBottom: '0.35rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                          {person.name}
                          <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                            {' '}
                            · {formatDecimalWorkHoursToHhMm(person.hours)}
                          </span>
                        </div>
                        {person.sessions.map((s) => (
                          <div
                            key={s.id}
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'baseline',
                              gap: '0.25rem 0.6rem',
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              padding: '0.1rem 0 0.1rem 0.75rem',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <span style={{ minWidth: '4.5rem' }}>{formatWorkDateYmdMonthDayShort(s.workDateYmd)}</span>
                            <span>
                              {sessionTime(s.clockedInAt)} → {sessionTime(s.clockedOutAt)}
                            </span>
                            <span style={{ color: 'var(--text-700)' }}>{formatDecimalWorkHoursToHhMm(s.hours)}</span>
                            {s.note ? <span style={{ fontStyle: 'italic' }}>“{s.note}”</span> : null}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
